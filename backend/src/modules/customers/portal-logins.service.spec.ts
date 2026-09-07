import { ConflictException, NotFoundException } from '@nestjs/common';
import { PortalLoginsService } from './portal-logins.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';

function user(roleSlug = 'admin'): AuthenticatedUser {
  return {
    sub: 'admin-1',
    tenantId: 'tenant-1',
    email: 'admin@a.com',
    roleSlug,
  };
}

describe('PortalLoginsService', () => {
  const makeService = (
    tx: Record<string, unknown>,
    adminUser: Record<string, unknown> = {},
  ) => {
    const prisma = {
      runWithTenant: jest.fn(
        (_tenantId: string, fn: (tx: unknown) => unknown) => fn(tx),
      ),
    };
    const prismaAdmin = {
      user: { findUnique: jest.fn().mockResolvedValue(null), ...adminUser },
    };
    const customersService = {
      assertAccessible: jest
        .fn()
        .mockResolvedValue({ id: 'c1', ownerId: 'user-1' }),
    };
    return {
      service: new PortalLoginsService(
        prisma as never,
        prismaAdmin as never,
        customersService as never,
      ),
      customersService,
    };
  };

  it('create() cria o usuário com o roleId de cliente_portal e o customerId informado', async () => {
    const roleFindFirst = jest
      .fn()
      .mockResolvedValue({ id: 'role-portal', slug: 'cliente_portal' });
    const userCreate = jest
      .fn()
      .mockImplementation(({ data }: { data: Record<string, unknown> }) => ({
        id: 'u1',
        name: data.name,
        email: data.email,
        isActive: true,
      }));
    const { service } = makeService({
      role: { findFirst: roleFindFirst },
      user: { create: userCreate },
    });

    await service.create(user(), 'c1', {
      name: 'Fulano',
      email: 'fulano@cliente.com',
      password: 'senha-com-12-chars',
    });

    const data = userCreate.mock.calls[0][0].data as Record<string, unknown>;
    expect(data.roleId).toBe('role-portal');
    expect(data.customerId).toBe('c1');
    expect(data.passwordHash).not.toBe('senha-com-12-chars'); // nunca texto puro
  });

  it('create() rejeita email já cadastrado (lookup global via PrismaAdminService)', async () => {
    const { service } = makeService(
      {},
      { findUnique: jest.fn().mockResolvedValue({ id: 'existing' }) },
    );

    await expect(
      service.create(user(), 'c1', {
        name: 'Fulano',
        email: 'ja-existe@cliente.com',
        password: 'senha-com-12-chars',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('create() valida que o admin/gestor tem acesso ao customer antes de criar o login', async () => {
    const roleFindFirst = jest.fn().mockResolvedValue({ id: 'role-portal' });
    const userCreate = jest.fn().mockResolvedValue({});
    const { service, customersService } = makeService({
      role: { findFirst: roleFindFirst },
      user: { create: userCreate },
    });

    await service.create(user(), 'c1', {
      name: 'Fulano',
      email: 'f@c.com',
      password: 'senha-com-12-chars',
    });

    expect(customersService.assertAccessible).toHaveBeenCalledWith(
      user(),
      'c1',
    );
  });

  it('toggle() desativa o login e nunca devolve o passwordHash', async () => {
    const findFirst = jest
      .fn()
      .mockResolvedValue({ id: 'u1', customerId: 'c1' });
    const update = jest.fn().mockResolvedValue({
      id: 'u1',
      name: 'Fulano',
      email: 'f@c.com',
      isActive: false,
    });
    const { service } = makeService({ user: { findFirst, update } });

    const result = await service.toggle(user(), 'c1', 'u1', false);

    expect(result.isActive).toBe(false);
    expect(result).not.toHaveProperty('passwordHash');
  });

  it('toggle() lança NotFoundException se o login não pertencer a este customer', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const { service } = makeService({ user: { findFirst } });

    await expect(
      service.toggle(user(), 'c1', 'login-de-outro-cliente', true),
    ).rejects.toThrow(NotFoundException);
  });
});
