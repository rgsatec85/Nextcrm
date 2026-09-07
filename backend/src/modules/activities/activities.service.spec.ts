import { BadRequestException, ConflictException } from '@nestjs/common';
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

  it('create() exige customerId ou opportunityId para tipos ligados a CRM', async () => {
    const { service } = makeService({});

    await expect(
      service.create(user('admin'), { type: 'nota' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('create() permite "tarefa"/"evento" sem customerId nem opportunityId (Fase 8)', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'a1' });
    const findFirst = jest.fn().mockResolvedValue(null);
    const { service } = makeService({
      activity: { create, findFirst },
      agendaBlock: { findFirst },
    });

    await expect(
      service.create(user('vendedor'), {
        type: 'tarefa',
        notes: 'Organizar CRM',
      }),
    ).resolves.toEqual({ id: 'a1' });
    expect(create).toHaveBeenCalled();
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

  it('create() rejeita quando o fim vem sem o início', async () => {
    const { service } = makeService({});

    await expect(
      service.create(user('admin'), {
        type: 'tarefa',
        endAt: '2026-01-01T11:00:00.000Z',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('create() rejeita quando o fim é antes (ou igual) do início', async () => {
    const { service } = makeService({});

    await expect(
      service.create(user('admin'), {
        type: 'tarefa',
        scheduledAt: '2026-01-01T11:00:00.000Z',
        endAt: '2026-01-01T10:00:00.000Z',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('create() rejeita por conflito com outra atividade já agendada da mesma pessoa', async () => {
    const activityFindFirst = jest.fn().mockResolvedValue({ id: 'existing' });
    const create = jest.fn();
    const { service } = makeService({
      activity: { create, findFirst: activityFindFirst },
    });

    await expect(
      service.create(user('vendedor'), {
        type: 'evento',
        scheduledAt: '2026-01-01T10:00:00.000Z',
        endAt: '2026-01-01T11:00:00.000Z',
      }),
    ).rejects.toThrow(ConflictException);
    expect(create).not.toHaveBeenCalled();
  });

  it('create() rejeita por conflito com um bloqueio de agenda', async () => {
    const activityFindFirst = jest.fn().mockResolvedValue(null);
    const agendaBlockFindFirst = jest
      .fn()
      .mockResolvedValue({ id: 'block-1', reason: 'Férias' });
    const create = jest.fn();
    const { service } = makeService({
      activity: { create, findFirst: activityFindFirst },
      agendaBlock: { findFirst: agendaBlockFindFirst },
    });

    await expect(
      service.create(user('vendedor'), {
        type: 'evento',
        scheduledAt: '2026-01-01T10:00:00.000Z',
        endAt: '2026-01-01T11:00:00.000Z',
      }),
    ).rejects.toThrow(ConflictException);
    expect(create).not.toHaveBeenCalled();
  });

  it('create() sem endAt não faz checagem de conflito (não é um slot de calendário)', async () => {
    const activityFindFirst = jest.fn().mockResolvedValue({ id: 'existing' });
    const create = jest.fn().mockResolvedValue({ id: 'a1' });
    const { service } = makeService({
      activity: { create, findFirst: activityFindFirst },
    });

    await service.create(user('vendedor'), {
      type: 'follow_up',
      customerId: 'c1',
      scheduledAt: '2026-01-01T10:00:00.000Z',
    });

    expect(activityFindFirst).not.toHaveBeenCalled();
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

  it('findAll() com userId força o próprio id para vendedor, mesmo pedindo outro', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const { service } = makeService({ activity: { findMany } });

    await service.findAll(user('vendedor', 'user-1'), { userId: 'user-2' });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ createdBy: 'user-1' }),
      }),
    );
  });

  it('findAll() com userId permite admin consultar a agenda de outra pessoa', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const { service } = makeService({ activity: { findMany } });

    await service.findAll(user('admin'), { userId: 'user-2' });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ createdBy: 'user-2' }),
      }),
    );
  });
});
