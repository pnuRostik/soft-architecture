import { randomBytes } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Request } from 'express';
import type { SignOptions } from 'jsonwebtoken';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { Role, type Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { JwtAccessPayload } from '../../common/types/jwt-access-payload.type';
import { JwtPasswordResetPayload } from '../../common/types/jwt-password-reset-payload.type';
import { EmailService } from '../email/email.service';
import { KafkaService } from '../kafka/services/kafka.service';
import { userRecordToKafkaPayload } from '../kafka/interfaces/user-payload.interface';
import { ChangeUserRoleDto } from './dto/change-user-role.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { extractClientSessionMeta, readRefreshTokenFromCookie } from './utils/client-meta.util';
import { apiRoleToPrisma, prismaRoleToApi } from './utils/role-mapping.util';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly kafkaService: KafkaService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
  ) {}

  private get refreshExpiresMs(): number {
    const days = Number(this.configService.get<string>('JWT_REFRESH_EXPIRES_DAYS') ?? '7');
    return Math.max(1, days) * 86_400_000;
  }

  /** Access token lifetime in seconds (default 15 minutes). */
  private get accessExpiresSeconds(): number {
    const raw = this.configService.get<string>('JWT_ACCESS_EXPIRES_IN') ?? '15m';
    const match = /^(\d+)(s|m|h|d)$/i.exec(raw.trim());
    if (!match) {
      return 15 * 60;
    }
    const n = Number(match[1]);
    const u = match[2].toLowerCase();
    const mult = u === 's' ? 1 : u === 'm' ? 60 : u === 'h' ? 3600 : 86400;
    return Math.max(60, n * mult);
  }

  private get jwtSecret(): string {
    const secret = this.configService.get<string>('JWT_SECRET');
    if (!secret) {
      throw new Error('JWT_SECRET is not configured');
    }
    return secret;
  }

  private get passwordResetExpiresIn(): string {
    return this.configService.get<string>('JWT_PASSWORD_RESET_EXPIRES_IN')?.trim() || '1h';
  }

  private newRefreshTokenValue(): string {
    return randomBytes(48).toString('hex');
  }

  private async signAccessToken(user: { id: number; email: string; role: Role }): Promise<string> {
    const expiresIn = this.accessExpiresSeconds;
    return this.jwtService.signAsync(
      { sub: user.id, email: user.email, role: user.role },
      {
        secret: this.jwtSecret,
        expiresIn,
      },
    );
  }

  async register(dto: RegisterDto) {
    const password_hash = await bcrypt.hash(dto.password, 12);
    const email_verification_hash = randomBytes(32).toString('hex');

    try {
      const user = await this.prisma.client.user.create({
        data: {
          first_name: dto.firstname,
          last_name: dto.lastname,
          email: dto.email.toLowerCase(),
          password_hash,
          email_verification_hash,
          role: Role.USER,
          is_activated: false,
          auth_provider: 'local',
          locality_id: dto.locality_id,
          longitude: dto.longitude,
          latitude: dto.latitude,
        },
      });

      this.kafkaService.emitUserEvent(
        'UserCreated',
        userRecordToKafkaPayload({
          id: user.id,
          first_name: user.first_name,
          last_name: user.last_name,
          email: user.email,
          role: user.role,
          auth_provider: user.auth_provider,
          is_activated: user.is_activated,
          locality_id: user.locality_id,
          longitude: user.longitude,
          latitude: user.latitude,
          updatedAt: user.created_at,
        }),
      );

      this.emailService.sendVerificationEmail(user.email, email_verification_hash);

      return {
        id: user.id,
        email: user.email,
        message: 'User created. Please verify your email using the link sent to your inbox.',
      };
    } catch (err) {
      if (err instanceof PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('Email already registered');
      }
      throw err;
    }
  }

  async verifyEmail(token: string) {
    if (!token?.trim()) {
      throw new BadRequestException('Verification token is required');
    }

    const user = await this.prisma.client.user.findFirst({
      where: { email_verification_hash: token },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    await this.prisma.client.user.update({
      where: { id: user.id },
      data: {
        is_activated: true,
        email_verification_hash: null,
      },
    });

    return { message: 'Email successfully verified' };
  }

  async requestPasswordReset(email: string) {
    const normalized = email.toLowerCase().trim();
    const user = await this.prisma.client.user.findUnique({
      where: { email: normalized },
    });

    if (user?.password_hash) {
      const resetToken = await this.jwtService.signAsync(
        { sub: user.id, purpose: 'password_reset' } satisfies JwtPasswordResetPayload,
        {
          secret: this.jwtSecret,
          expiresIn: this.passwordResetExpiresIn as SignOptions['expiresIn'],
        },
      );
      this.emailService.sendPasswordResetEmail(user.email, resetToken);
    }

    return {
      message: 'If an account exists for this email, password reset instructions have been sent.',
    };
  }

  async completePasswordReset(dto: ResetPasswordDto) {
    let payload: JwtPasswordResetPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPasswordResetPayload>(dto.token.trim(), {
        secret: this.jwtSecret,
      });
    } catch {
      throw new BadRequestException('Invalid or expired password reset token');
    }

    if (payload.purpose !== 'password_reset') {
      throw new BadRequestException('Invalid or expired password reset token');
    }

    const userId = Number(payload.sub);
    if (!Number.isInteger(userId) || userId < 1) {
      throw new BadRequestException('Invalid or expired password reset token');
    }

    const user = await this.prisma.client.user.findUnique({ where: { id: userId } });
    if (!user?.password_hash) {
      throw new BadRequestException('Invalid or expired password reset token');
    }

    const password_hash = await bcrypt.hash(dto.newPassword, 12);

    await this.prisma.client.$transaction([
      this.prisma.client.session.deleteMany({ where: { user_id: user.id } }),
      this.prisma.client.user.update({
        where: { id: user.id },
        data: { password_hash },
      }),
    ]);

    return { message: 'Password has been updated. Please log in again.' };
  }

  async login(dto: LoginDto, req: Request) {
    const user = await this.prisma.client.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (!user?.password_hash) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const match = await bcrypt.compare(dto.password, user.password_hash);
    if (!match) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.is_activated) {
      throw new ForbiddenException('Email address is not verified yet');
    }

    return this.issueTokensForUser(user, req);
  }

  async refreshTokens(dto: { refreshToken?: string }, req: Request) {
    const fromCookie = readRefreshTokenFromCookie(req);
    const refreshToken = dto.refreshToken?.trim() || fromCookie;

    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token is required (body or cookie)');
    }

    const session = await this.prisma.client.session.findUnique({
      where: { refresh_token: refreshToken },
      include: { user: true },
    });

    if (!session || session.expires_at <= new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = session.user;
    if (!user.is_activated) {
      throw new ForbiddenException('Email address is not verified yet');
    }

    const meta = extractClientSessionMeta(req);
    const newRefresh = this.newRefreshTokenValue();
    const expiresAt = new Date(Date.now() + this.refreshExpiresMs);

    await this.prisma.client.$transaction([
      this.prisma.client.session.delete({ where: { id: session.id } }),
      this.prisma.client.session.create({
        data: {
          user_id: user.id,
          refresh_token: newRefresh,
          ip_address: meta.ip_address,
          device: meta.device,
          os: meta.os,
          browser: meta.browser,
          expires_at: expiresAt,
        },
      }),
    ]);

    const accessToken = await this.signAccessToken(user);

    return {
      accessToken,
      refreshToken: newRefresh,
      refreshTokenExpiresAt: expiresAt.toISOString(),
    };
  }

  async logout(
    dto: { refreshToken?: string },
    req: Request,
    accessToken?: string,
  ): Promise<{ message: string }> {
    let accessUser: JwtAccessPayload | undefined;
    if (accessToken?.trim()) {
      try {
        accessUser = await this.jwtService.verifyAsync<JwtAccessPayload>(accessToken.trim(), {
          secret: this.jwtSecret,
        });
      } catch {
        throw new UnauthorizedException('Invalid access token');
      }
    }

    const fromCookie = readRefreshTokenFromCookie(req);
    const refreshToken = dto.refreshToken?.trim() || fromCookie;

    if (!refreshToken) {
      throw new BadRequestException('Refresh token is required (body or cookie)');
    }

    const session = await this.prisma.client.session.findUnique({
      where: { refresh_token: refreshToken },
    });

    if (!session) {
      throw new UnauthorizedException('Session not found');
    }

    if (accessUser && Number(accessUser.sub) !== session.user_id) {
      throw new ForbiddenException('Refresh token does not belong to the authenticated user');
    }

    await this.prisma.client.session.delete({ where: { id: session.id } });

    return { message: 'Logged out from this device' };
  }

  async updateUserRole(actor: JwtAccessPayload, targetUserId: number, dto: ChangeUserRoleDto) {
    if (Number(actor.sub) === targetUserId) {
      throw new ForbiddenException('You cannot change your own role');
    }

    const target = await this.prisma.client.user.findUnique({ where: { id: targetUserId } });
    if (!target) {
      throw new NotFoundException('User not found');
    }

    const newRole = apiRoleToPrisma(dto.role);

    if (target.role === newRole) {
      return this.toUserResponse(target);
    }

    const updated = await this.prisma.client.user.update({
      where: { id: targetUserId },
      data: { role: newRole },
    });

    await this.prisma.client.session.deleteMany({ where: { user_id: targetUserId } });

    this.kafkaService.emitUserEvent(
      'UserUpdated',
      userRecordToKafkaPayload({
        id: updated.id,
        first_name: updated.first_name,
        last_name: updated.last_name,
        email: updated.email,
        role: updated.role,
        auth_provider: updated.auth_provider,
        is_activated: updated.is_activated,
        locality_id: updated.locality_id,
        longitude: updated.longitude,
        latitude: updated.latitude,
        updatedAt: new Date(),
      }),
    );

    return this.toUserResponse(updated);
  }

  async getProfile(userId: number) {
    const user = await this.prisma.client.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return this.toUserResponse(user);
  }

  async updateProfile(userId: number, dto: UpdateProfileDto) {
    const data: Prisma.UserUpdateInput = {};
    if (dto.firstname !== undefined) data.first_name = dto.firstname;
    if (dto.lastname !== undefined) data.last_name = dto.lastname;
    if (dto.locality_id !== undefined) data.locality_id = dto.locality_id;
    if (dto.longitude !== undefined) data.longitude = dto.longitude;
    if (dto.latitude !== undefined) data.latitude = dto.latitude;

    const user = await this.prisma.client.user.update({
      where: { id: userId },
      data,
    });
    return this.toUserResponse(user);
  }

  async listSessions(userId: number) {
    const sessions = await this.prisma.client.session.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        ip_address: true,
        device: true,
        os: true,
        browser: true,
        created_at: true,
        expires_at: true,
      },
    });
    return sessions.map((s) => ({
      ...s,
      created_at: s.created_at.toISOString(),
      expires_at: s.expires_at.toISOString(),
    }));
  }

  toUserResponse(user: {
    id: number;
    first_name: string | null;
    last_name: string | null;
    email: string;
    role: Role;
    is_activated: boolean;
    auth_provider: string;
    locality_id: number | null;
    longitude: number | null;
    latitude: number | null;
    created_at: Date;
  }) {
    return {
      id: user.id,
      firstname: user.first_name,
      lastname: user.last_name,
      email: user.email,
      role: prismaRoleToApi(user.role),
      is_activated: user.is_activated,
      auth_provider: user.auth_provider,
      locality_id: user.locality_id,
      longitude: user.longitude,
      latitude: user.latitude,
      created_at: user.created_at.toISOString(),
    };
  }

  private async issueTokensForUser(
    user: { id: number; email: string; role: Role },
    req: Request,
  ) {
    const meta = extractClientSessionMeta(req);
    const refreshToken = this.newRefreshTokenValue();
    const expiresAt = new Date(Date.now() + this.refreshExpiresMs);

    await this.prisma.client.session.create({
      data: {
        user_id: user.id,
        refresh_token: refreshToken,
        ip_address: meta.ip_address,
        device: meta.device,
        os: meta.os,
        browser: meta.browser,
        expires_at: expiresAt,
      },
    });

    const accessToken = await this.signAccessToken(user);

    return {
      accessToken,
      refreshToken,
      refreshTokenExpiresAt: expiresAt.toISOString(),
    };
  }
}
