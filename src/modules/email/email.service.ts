import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EmailService {
  constructor(private readonly configService: ConfigService) {}

  private get publicAppBaseUrl(): string {
    return (this.configService.get<string>('PUBLIC_APP_URL') ?? 'http://localhost:3000').replace(/\/$/, '');
  }

  sendVerificationEmail(to: string, verificationToken: string): void {
    const verifyUrl = `${this.publicAppBaseUrl}/auth/verify-email?token=${encodeURIComponent(verificationToken)}`;
    console.log('[EmailService] sendVerificationEmail');
    console.log(`  to: ${to}`);
    console.log(`  subject: Verify your email`);
    console.log(`  verifyUrl: ${verifyUrl}`);
  }

  sendPasswordResetEmail(to: string, resetJwt: string): void {
    const hintUrl = `${this.publicAppBaseUrl}/auth/reset-password (POST with token + newPassword)`;
    console.log('[EmailService] sendPasswordResetEmail');
    console.log(`  to: ${to}`);
    console.log(`  subject: Reset your password`);
    console.log(`  resetJwt: ${resetJwt}`);
    console.log(`  hint: ${hintUrl}`);
  }
}
