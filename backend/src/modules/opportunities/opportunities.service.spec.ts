import { ForbiddenException } from '@nestjs/common';
import { OpportunitiesService } from './opportunities.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';

function user(roleSlug: string, sub = 'user-1'): AuthenticatedUser {
  return { sub, tenantId: 'tenant-1', email: 'x@x.com', roleSlug };
}

describe('OpportunitiesService', () => {
  const makeService = (tx: Record<string, unknown>) => {
    const prisma = {
      runWithTenant: jest.fn(
        (_tenantId: string, fn: (tx: unknown) => unknown) => fn(tx),
      ),
    };
    const customersService = {
      assertAccessible: jest
        .fn()
        .mockResolvedValue({ id: 'c1', ownerId: 'user-1' }),
    };
    return {
      service: new OpportunitiesService(
        prisma as never,
        customersService as never,
      ),
      prisma,
      customersService,
    };
  };

  it('create() valida acesso ao cliente antes de criar a oportunidade', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'o1' });
    const { service, customersService } = makeService({
      opportunity: { create },
    });

    await service.create(user('vendedor', 'user-1'), {
      customerId: 'c1',
      title: 'Negócio X',
    });

    expect(customersService.assertAccessible).toHaveBeenCalledWith(
      expect.objectContaining({ sub: 'user-1' }),
      'c1',
    );
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ ownerId: 'user-1', stage: 'lead' }),
      }),
    );
  });

  it('changeStage() move o card só depois de validar ownership', async () => {
    const findFirst = jest
      .fn()
      .mockResolvedValue({ id: 'o1', ownerId: 'user-1' });
    const update = jest.fn().mockResolvedValue({ id: 'o1', stage: 'proposta' });
    const { service } = makeService({
      opportunity: { findFirst, update },
    });

    const result = await service.changeStage(
      user('vendedor', 'user-1'),
      'o1',
      'proposta',
    );

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'o1' },
        data: expect.objectContaining({ stage: 'proposta' }),
      }),
    );
    expect(result.stage).toBe('proposta');
  });

  it('changeStage() bloqueia vendedor movendo card de outro dono', async () => {
    const findFirst = jest
      .fn()
      .mockResolvedValue({ id: 'o1', ownerId: 'outro-user' });
    const { service } = makeService({ opportunity: { findFirst } });

    await expect(
      service.changeStage(user('vendedor', 'user-1'), 'o1', 'proposta'),
    ).rejects.toThrow(ForbiddenException);
  });
});
