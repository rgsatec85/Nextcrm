import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';

function user(roleSlug: string, sub = 'user-1'): AuthenticatedUser {
  return { sub, tenantId: 'tenant-1', email: 'x@x.com', roleSlug };
}

describe('CustomersService', () => {
  const makeService = (tx: Record<string, unknown>) => {
    const prisma = {
      runWithTenant: jest.fn(
        (_tenantId: string, fn: (tx: unknown) => unknown) => fn(tx),
      ),
    };
    return { service: new CustomersService(prisma as never), prisma };
  };

  it('create() força ownerId = próprio usuário quando o perfil é vendedor', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'c1' });
    const { service } = makeService({ customer: { create } });

    await service.create(user('vendedor', 'user-1'), {
      name: 'Cliente X',
      ownerId: 'outro-user',
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ ownerId: 'user-1' }),
      }),
    );
  });

  it('create() respeita ownerId explícito quando o perfil é admin', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'c1' });
    const { service } = makeService({ customer: { create } });

    await service.create(user('admin', 'user-1'), {
      name: 'Cliente X',
      ownerId: 'outro-user',
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ ownerId: 'outro-user' }),
      }),
    );
  });

  it('findAll() filtra por ownerId quando o perfil é vendedor', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const { service } = makeService({ customer: { findMany } });

    await service.findAll(user('vendedor', 'user-1'));

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: 'tenant-1', ownerId: 'user-1' },
      }),
    );
  });

  it('findAll() não filtra por owner quando o perfil é gestor', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const { service } = makeService({ customer: { findMany } });

    await service.findAll(user('gestor', 'user-1'));

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: 'tenant-1' } }),
    );
  });

  it('findOne() lança NotFoundException quando o cliente não existe no tenant', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const { service } = makeService({ customer: { findFirst } });

    await expect(service.findOne(user('admin'), 'c1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('findOne() bloqueia vendedor acessando cliente de outro dono', async () => {
    const findFirst = jest
      .fn()
      .mockResolvedValue({ id: 'c1', ownerId: 'outro-user' });
    const { service } = makeService({ customer: { findFirst } });

    await expect(
      service.findOne(user('vendedor', 'user-1'), 'c1'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('findOne() permite vendedor acessar o próprio cliente', async () => {
    const findFirst = jest
      .fn()
      .mockResolvedValue({ id: 'c1', ownerId: 'user-1' });
    const { service } = makeService({ customer: { findFirst } });

    await expect(
      service.findOne(user('vendedor', 'user-1'), 'c1'),
    ).resolves.toEqual({ id: 'c1', ownerId: 'user-1' });
  });
});
