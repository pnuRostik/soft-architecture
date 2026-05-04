import { Role } from 'generated/prisma/enums';

export type JwtAccessPayload = {
  sub: number;
  email: string;
  role: Role;
  iat?: number;
  exp?: number;
};
