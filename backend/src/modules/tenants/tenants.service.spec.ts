import { ConflictException } from '@nestjs/common';
import { TenantsService } from './tenants.service';

describe('TenantsService.createTenantWithAdmin', () => {
  const makeService = (overrides: Partial<Record<string, unknown>> = {}) => {
    const prismaAdmin = {
      company: { findUnique: jest.fn().mockResolvedValue(null) },
      user: { findUnique: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn(),
      ...overrides,
    };
    const prisma = { runWithTenant: jest.fn() };
    const service = new TenantsService(prismaAdmin as never, prisma as never);
    return { service, prismaAdmin, prisma };
  };

  it('rejeita quando já existe empresa com o mesmo CNPJ', async () => {
    const { service, prismaAdmin } = makeService({
      company: { findUnique: jest.fn().mockResolvedValue({ id: 'existing' }) },
    });

    await expect(
      service.createTenantWithAdmin('Empresa X', '11111111000191', {
        name: 'Admin',
        email: 'admin@x.com',
        passwordHash: 'hash',
      }),
    ).rejects.toThrow(ConflictException);

    expect(prismaAdmin.$transaction).not.toHaveBeenCalled();
  });

  it('rejeita quando já existe usuário com o mesmo email', async () => {
    const { service } = makeService({
      user: { findUnique: jest.fn().mockResolvedValue({ id: 'existing' }) },
    });

    await expect(
      service.createTenantWithAdmin('Empresa X', '11111111000191', {
        name: 'Admin',
        email: 'admin@x.com',
        passwordHash: 'hash',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('cria empresa, os 5 perfis padrão e o usuário admin numa única transação', async () => {
    const createdRoles = [
      { id: 'role-admin', slug: 'admin' },
      { id: 'role-fin', slug: 'financeiro' },
      { id: 'role-vend', slug: 'vendedor' },
      { id: 'role-gestor', slug: 'gestor' },
      { id: 'role-cliente', slug: 'cliente_portal' },
    ];

    const tx = {
      company: { create: jest.fn().mockResolvedValue({ id: 'tenant-1' }) },
      role: {
        create: jest.fn((args: { data: { slug: string } }) =>
          Promise.resolve(createdRoles.find((r) => r.slug === args.data.slug)),
        ),
      },
      user: { create: jest.fn().mockResolvedValue({ id: 'user-1' }) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };

    const { service, prismaAdmin } = makeService({
      $transaction: jest.fn((fn: (tx: unknown) => unknown) => fn(tx)),
    });

    const result = await service.createTenantWithAdmin(
      'Empresa X',
      '11111111000191',
      { name: 'Admin', email: 'admin@x.com', passwordHash: 'hash' },
    );

    expect(tx.role.create).toHaveBeenCalledTimes(5);
    expect(tx.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ roleId: 'role-admin' }),
      }),
    );
    expect(result.adminRole.slug).toBe('admin');
    expect(prismaAdmin.$transaction).toHaveBeenCalled();
  });
});
