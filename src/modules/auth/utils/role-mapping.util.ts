import { Role } from '@prisma/client';

export function apiRoleToPrisma(role: 'user' | 'admin'): Role {
  return role === 'admin' ? Role.ADMIN : Role.USER;
}

export function prismaRoleToApi(role: Role): 'user' | 'admin' {
  return role === Role.ADMIN ? 'admin' : 'user';
}
