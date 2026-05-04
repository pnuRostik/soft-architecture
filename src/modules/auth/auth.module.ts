import { Module } from '@nestjs/common';
import { AdminGuard } from '../../common/guards/admin.guard';
import { AuthGuard } from '../../common/guards/auth.guard';
import { KafkaModule } from '../kafka/kafka.module';
import { AdminController } from './admin.controller';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { ProfileController } from './profile.controller';

@Module({
  imports: [KafkaModule],
  controllers: [AuthController, ProfileController, AdminController],
  providers: [AuthService, AuthGuard, AdminGuard],
  exports: [AuthService],
})
export class AuthModule {}
