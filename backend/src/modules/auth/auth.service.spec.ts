import { UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { AuthService } from './auth.service';

jest.mock('argon2', () => ({
  hash: jest.fn().mockResolvedValue('hashed-password'),
  verify: jest.fn(),
  argon2id: 'argon2id',
}));

describe('AuthService', () => {
  const tenantsService = {
    createTenantWithAdmin: jest.fn(),
  };
  const jwtService = { sign: jest.fn().mockReturnValue('signed.jwt.token') };
  const prismaAdmin = {
    user: { findUnique: jest.fn() },
  };
  const prisma = {
    runWithTenant: jest.fn((_tenantId: string, fn: (tx: unknown) => unknown) =>
      fn({ user: { update: jest.fn() } }),
    ),
  };

  let authService: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    authService = new AuthService(
      tenantsService as never,
      jwtService as never,
      prismaAdmin as never,
      prisma as never,
    );
  });

  describe('signup', () => {
    it('cria o tenant + admin e retorna um token com tenantId no payload', async () => {
      tenantsService.createTenantWithAdmin.mockResolvedValue({
        company: { id: 'tenant-1', name: 'Empresa A' },
        adminUser: { id: 'user-1', name: 'Admin', email: 'admin@a.com' },
        adminRole: { slug: 'admin' },
      });

      const result = await authService.signup({
        companyName: 'Empresa A',
        cnpj: '11111111000191',
        adminName: 'Admin',
        adminEmail: 'admin@a.com',
        adminPassword: 'super-senha-forte',
      });

      expect(argon2.hash).toHaveBeenCalledWith(
        'super-senha-forte',
        expect.objectContaining({ type: 'argon2id' }),
      );
      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: 'tenant-1', roleSlug: 'admin' }),
      );
      expect(result.accessToken).toBe('signed.jwt.token');
      expect(result.company.id).toBe('tenant-1');
    });
  });

  describe('login', () => {
    const existingUser = {
      id: 'user-1',
      tenantId: 'tenant-1',
      email: 'admin@a.com',
      passwordHash: 'hashed-password',
      isActive: true,
      role: { slug: 'admin' },
      name: 'Admin',
    };

    it('lança UnauthorizedException quando o usuário não existe', async () => {
      prismaAdmin.user.findUnique.mockResolvedValue(null);

      await expect(
        authService.login({ email: 'nope@a.com', password: 'x' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('lança UnauthorizedException quando o usuário está inativo', async () => {
      prismaAdmin.user.findUnique.mockResolvedValue({
        ...existingUser,
        isActive: false,
      });

      await expect(
        authService.login({ email: 'admin@a.com', password: 'x' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('lança UnauthorizedException quando a senha está errada', async () => {
      prismaAdmin.user.findUnique.mockResolvedValue(existingUser);
      (argon2.verify as jest.Mock).mockResolvedValue(false);

      await expect(
        authService.login({ email: 'admin@a.com', password: 'senha-errada' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('retorna accessToken quando as credenciais são válidas', async () => {
      prismaAdmin.user.findUnique.mockResolvedValue(existingUser);
      (argon2.verify as jest.Mock).mockResolvedValue(true);

      const result = await authService.login({
        email: 'admin@a.com',
        password: 'senha-correta',
      });

      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: 'tenant-1', sub: 'user-1' }),
      );
      expect(result.accessToken).toBe('signed.jwt.token');
      expect(prisma.runWithTenant).toHaveBeenCalledWith(
        'tenant-1',
        expect.any(Function),
      );
    });
  });
});
