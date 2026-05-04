import { Role } from '@prisma/client';

export type JwtAccessPayload = {
  sub: number;
  email: string;
  role: Role;
  iat?: number;
  exp?: number;
};
