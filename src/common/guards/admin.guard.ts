import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Role } from 'generated/prisma/enums';
import { JwtAccessPayload } from '../types/jwt-access-payload.type';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user as JwtAccessPayload | undefined;

    if (!user || user.role !== Role.ADMIN) {
      throw new ForbiddenException('Administrator access required');
    }

    return true;
  }
}
