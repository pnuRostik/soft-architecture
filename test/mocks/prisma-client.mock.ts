/**
 * Minimal PrismaClient stub for Jest e2e (no DB / real engine).
 */
export const Role = {
  USER: 'USER' as const,
  ADMIN: 'ADMIN' as const,
};

export class PrismaClient {
  constructor(_options?: unknown) {}

  async $connect(): Promise<void> {}

  async $disconnect(): Promise<void> {}

  async $transaction<T>(arg: Promise<T>[]): Promise<T[]> {
    return Promise.all(arg);
  }

  user = {
    create: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  };

  session = {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  };
}

export const Prisma = {};
