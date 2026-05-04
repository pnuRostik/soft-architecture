import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { IdentityService } from './services/identity.service';

interface ValidateTokenRequest {
  accessToken: string;
}

export interface ValidateTokenResponse {
  valid: boolean;
  userId: number;
  role: string;
}

@Controller()
export class IdentityGrpcController {
  constructor(private readonly identityService: IdentityService) {}

  @GrpcMethod('IdentityService', 'ValidateToken')
  async validateToken(data: ValidateTokenRequest): Promise<ValidateTokenResponse> {
    return this.identityService.validateToken(data.accessToken);
  }
}
