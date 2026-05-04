import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ValidateTokenResponse } from '../identity.grpc.controller';

@Injectable()
export class IdentityService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async validateToken(token: string): Promise<ValidateTokenResponse> {
    try {
      const secret = this.configService.get<string>('JWT_SECRET');
      if (!secret) {
        return { valid: false, userId: 0, role: '' };
      }
      const decoded = await this.jwtService.verifyAsync<{ sub: number | string; role: string }>(token, {
        secret,
      });
      const userId = typeof decoded.sub === 'string' ? Number(decoded.sub) : decoded.sub;
      return { valid: true, userId: Number.isFinite(userId) ? userId : 0, role: decoded.role ?? '' };
    } catch {
      return { valid: false, userId: 0, role: '' };
    }
  }
}