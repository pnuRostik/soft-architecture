import { Body, Controller, Param, ParseIntPipe, Patch, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../../common/guards/admin.guard';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtAccessPayload } from '../../common/types/jwt-access-payload.type';
import { AuthService } from './auth.service';
import { ChangeUserRoleDto } from './dto/change-user-role.dto';

@Controller('admin')
@UseGuards(AuthGuard, AdminGuard)
export class AdminController {
  constructor(private readonly authService: AuthService) {}

  @Patch('users/:userId/role')
  async updateUserRole(
    @CurrentUser() actor: JwtAccessPayload,
    @Param('userId', ParseIntPipe) userId: number,
    @Body() dto: ChangeUserRoleDto,
  ) {
    return this.authService.updateUserRole(actor, userId, dto);
  }
}
