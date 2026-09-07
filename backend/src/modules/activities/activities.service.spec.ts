import { BadRequestException } from '@nestjs/common';
import { ActivitiesService } from './activities.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';

function user(roleSlug: string, sub = 'user-1'): AuthenticatedUser {
  return { sub, tenantId: 'tenant-1', email: 'x@x.com', roleSlug };
}

describe('ActivitiesService', () => {
  const makeService = (tx: Record<string, unknown>) => {
    const prisma = {
      runWithTenant: jest.fn(
        (_tenantId: string, fn: (tx: unknown) => unknown) => fn(tx),
      ),
    };
    const customersService = {
      assertAccessible: jest.fn().mockResolvedValue({}),
    };
    const opportunitiesService = {
      assertAccessible: jest.fn().mockResolvedValue({}),
    };
    return {
      service: new ActivitiesService(
        prisma as never,
        customersService as never,
        opportunitiesService as never,
      ),
      customersService,
      opportunitiesService,
    };
  };

  it('create() exige customerId ou opportunityId', async () => {
    const { service } = makeService({});

    await expect(
      service.create(user('admin'), { type: 'nota' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('create() valida acesso ao cliente quando customerId é informado', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'a1' });
    const { service, customersService } = makeService({ activity: { create } });

    await service.create(user('vendedor'), {
      customerId: 'c1',
      type: 'ligacao',
    });

    expect(customersService.assertAccessible).toHaveBeenCalledWith(
      expect.objectContaining({ sub: 'user-1' }),
      'c1',
    );
    expect(create).toHaveBeenCalled();
  });

  it('findAll() aplica escopo de dono (OR customer/opportunity) para vendedor sem filtro', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const { service } = makeService({ activity: { findMany } });

    await service.findAll(user('vendedor', 'user-1'), {});

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { customer: { ownerId: 'user-1' } },
            { opportunity: { ownerId: 'user-1' } },
          ],
        }),
      }),
    );
  });

  it('findAll() não aplica escopo de dono para admin', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const { service } = makeService({ activity: { findMany } });

    await service.findAll(user('admin'), {});

    const callArgs = findMany.mock.calls[0][0];
    expect(callArgs.where.OR).toBeUndefined();
  });
});
