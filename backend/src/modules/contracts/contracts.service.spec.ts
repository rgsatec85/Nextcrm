import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { ContractsService } from './contracts.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';

function user(roleSlug: string, sub = 'user-1'): AuthenticatedUser {
  return { sub, tenantId: 'tenant-1', email: 'x@x.com', roleSlug };
}

describe('ContractsService', () => {
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
      service: new ContractsService(prisma as never, customersService as never),
    };
  };

  it('create() rejeita endDate anterior ou igual a startDate', async () => {
    const { service } = makeService({ contract: {} });

    await expect(
      service.create(user('admin'), {
        customerId: 'c1',
        title: 'Contrato X',
        startDate: '2026-01-10',
        endDate: '2026-01-01',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('findOne() calcula daysUntilExpiration e expiringSoon', async () => {
    const inThirtyDays = new Date();
    inThirtyDays.setDate(inThirtyDays.getDate() + 10);

    const findFirst = jest.fn().mockResolvedValue({
      id: 'k1',
      status: 'ativo',
      endDate: inThirtyDays,
      customer: { id: 'c1', ownerId: 'user-1' },
    });
    const { service } = makeService({ contract: { findFirst } });

    const result = await service.findOne(user('admin'), 'k1');

    expect(result.expiringSoon).toBe(true);
    expect(result.daysUntilExpiration).toBeLessThanOrEqual(10);
  });

  it('findOne() bloqueia vendedor acessando contrato de cliente de outro dono', async () => {
    const findFirst = jest.fn().mockResolvedValue({
      id: 'k1',
      status: 'ativo',
      endDate: new Date(),
      customer: { id: 'c1', ownerId: 'outro-user' },
    });
    const { service } = makeService({ contract: { findFirst } });

    await expect(
      service.findOne(user('vendedor', 'user-1'), 'k1'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('renew() estende endDate por renewalPeriodMonths quando newEndDate não é informado', async () => {
    const findFirst = jest.fn().mockResolvedValue({
      id: 'k1',
      status: 'ativo',
      endDate: new Date('2026-01-01'),
      renewalPeriodMonths: 12,
      customer: { id: 'c1', ownerId: 'user-1' },
    });
    const update = jest.fn().mockImplementation(({ data }) => data);
    const { service } = makeService({ contract: { findFirst, update } });

    const result = await service.renew(user('admin'), 'k1', {});

    expect(result.status).toBe('renovado');
    expect((result.endDate as Date).getFullYear()).toBe(2027);
  });

  it('renew() rejeita quando não há renewalPeriodMonths nem newEndDate explícito', async () => {
    const findFirst = jest.fn().mockResolvedValue({
      id: 'k1',
      status: 'ativo',
      endDate: new Date('2026-01-01'),
      renewalPeriodMonths: null,
      customer: { id: 'c1', ownerId: 'user-1' },
    });
    const { service } = makeService({ contract: { findFirst } });

    await expect(service.renew(user('admin'), 'k1', {})).rejects.toThrow(
      ConflictException,
    );
  });
});
