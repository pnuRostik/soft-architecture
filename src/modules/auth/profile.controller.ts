import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtAccessPayload } from '../../common/types/jwt-access-payload.type';
import { AuthService } from './auth.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Controller('profile')
export class ProfileController {
  constructor(private readonly authService: AuthService) {}

  @Get('me')
  @UseGuards(AuthGuard)
  async me(@CurrentUser() user: JwtAccessPayload) {
    return this.authService.getProfile(Number(user.sub));
  }

  @Patch()
  @UseGuards(AuthGuard)
  async update(@CurrentUser() user: JwtAccessPayload, @Body() dto: UpdateProfileDto) {
    return this.authService.updateProfile(Number(user.sub), dto);
  }

  @Get('sessions')
  @UseGuards(AuthGuard)
  async sessions(@CurrentUser() user: JwtAccessPayload) {
    return this.authService.listSessions(Number(user.sub));
  }
}
