import { Module } from '@nestjs/common';
import { IdentityService } from './services/identity.service';
import { IdentityGrpcController } from './identity.grpc.controller';

@Module({
  imports: [],
  controllers: [IdentityGrpcController],
  providers: [IdentityService],
})
export class IdentityModule {}