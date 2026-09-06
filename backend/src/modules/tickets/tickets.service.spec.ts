import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { computeSlaDueAt, SLA_HOURS_BY_PRIORITY } from './sla';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';

function user(roleSlug: string, sub = 'user-1'): AuthenticatedUser {
  return { sub, tenantId: 'tenant-1', email: 'x@x.com', roleSlug };
}

describe('computeSlaDueAt', () => {
  const from = new Date('2026-09-06T12:00:00.000Z');

  it.each(Object.entries(SLA_HOURS_BY_PRIORITY))(
    'soma %s horas para priority=%s',
    (priority, hours) => {
      const due = computeSlaDueAt(priority, from);
      expect(due.getTime() - from.getTime()).toBe(hours * 60 * 60 * 1000);
    },
  );

  it('usa o SLA de "media" para priority desconhecida', () => {
    const due = computeSlaDueAt('inexistente', from);
    expect(due.getTime() - from.getTime()).toBe(
      SLA_HOURS_BY_PRIORITY.media * 60 * 60 * 1000,
    );
  });
});

describe('TicketsService', () => {
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
    const webhooksService = {
      dispatch: jest.fn().mockResolvedValue(undefined),
    };
    return {
      service: new TicketsService(
        prisma as never,
        customersService as never,
        webhooksService as never,
      ),
      webhooksService,
    };
  };

  it('create() calcula sla_due_at a partir da priority informada', async () => {
    const create = jest
      .fn()
      .mockImplementation(
        ({ data }: { data: Record<string, unknown> }) => data,
      );
    const { service } = makeService({ ticket: { create } });

    await service.create(user('admin'), {
      customerId: 'c1',
      subject: 'Não consigo emitir boleto',
      priority: 'urgente',
    });

    const data = create.mock.calls[0][0].data as {
      slaDueAt: Date;
      priority: string;
    };
    expect(data.priority).toBe('urgente');
    expect(data.slaDueAt).toBeInstanceOf(Date);
    expect(data.slaDueAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('create() usa priority "media" como padrão quando não informada', async () => {
    const create = jest
      .fn()
      .mockImplementation(
        ({ data }: { data: Record<string, unknown> }) => data,
      );
    const { service } = makeService({ ticket: { create } });

    await service.create(user('admin'), {
      customerId: 'c1',
      subject: 'Dúvida geral',
    });

    const data = create.mock.calls[0][0].data as { priority: string };
    expect(data.priority).toBe('media');
  });

  it('findAll() aplica o filtro de dono do cliente para vendedor', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const { service } = makeService({ ticket: { findMany } });

    await service.findAll(user('vendedor'), {});

    const where = findMany.mock.calls[0][0].where as Record<string, unknown>;
    expect(where.customer).toEqual({ ownerId: 'user-1' });
  });

  it('findAll() não filtra por dono para admin/gestor/financeiro', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const { service } = makeService({ ticket: { findMany } });

    await service.findAll(user('financeiro'), {});

    const where = findMany.mock.calls[0][0].where as Record<string, unknown>;
    expect(where.customer).toBeUndefined();
  });

  it('findOne() lança NotFoundException quando o chamado não existe no tenant', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const { service } = makeService({ ticket: { findFirst } });

    await expect(
      service.findOne(user('admin'), 't-inexistente'),
    ).rejects.toThrow(NotFoundException);
  });

  it('findOne() bloqueia vendedor lendo chamado de cliente de outro dono', async () => {
    const findFirst = jest.fn().mockResolvedValue({
      id: 't1',
      customer: { id: 'c1', name: 'Acme', ownerId: 'outro-user' },
    });
    const { service } = makeService({ ticket: { findFirst } });

    await expect(
      service.findOne(user('vendedor', 'user-1'), 't1'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('updateStatus() atualiza o status e dispara o webhook ticket.updated', async () => {
    const findFirst = jest.fn().mockResolvedValue({
      id: 't1',
      customer: { id: 'c1', name: 'Acme', ownerId: 'user-1' },
    });
    const update = jest
      .fn()
      .mockResolvedValue({ id: 't1', status: 'resolvido' });
    const { service, webhooksService } = makeService({
      ticket: { findFirst, update },
    });

    const result = await service.updateStatus(user('admin'), 't1', {
      status: 'resolvido',
    });

    expect(result.status).toBe('resolvido');
    expect(webhooksService.dispatch).toHaveBeenCalledWith(
      'tenant-1',
      'ticket.updated',
      expect.objectContaining({ ticketId: 't1', status: 'resolvido' }),
    );
  });

  it('addComment() grava o comentário com author_type "interno"', async () => {
    const findFirst = jest.fn().mockResolvedValue({
      id: 't1',
      customer: { id: 'c1', name: 'Acme', ownerId: 'user-1' },
    });
    const create = jest
      .fn()
      .mockImplementation(
        ({ data }: { data: Record<string, unknown> }) => data,
      );
    const { service } = makeService({
      ticket: { findFirst },
      ticketComment: { create },
    });

    const result = await service.addComment(user('admin'), 't1', {
      body: 'Olá!',
    });

    expect(result.authorType).toBe('interno');
    expect(result.body).toBe('Olá!');
  });
});
