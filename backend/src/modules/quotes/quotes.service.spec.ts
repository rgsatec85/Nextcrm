import { ConflictException } from '@nestjs/common';
import { QuotesService } from './quotes.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';

function user(roleSlug: string, sub = 'user-1'): AuthenticatedUser {
  return { sub, tenantId: 'tenant-1', email: 'x@x.com', roleSlug };
}

describe('QuotesService', () => {
  const makeService = (tx: Record<string, unknown>) => {
    const prisma = {
      runWithTenant: jest.fn(
        (_tenantId: string, fn: (tx: unknown) => unknown) => fn(tx),
      ),
    };
    const opportunitiesService = {
      assertAccessible: jest
        .fn()
        .mockResolvedValue({ id: 'o1', ownerId: 'user-1', customerId: 'c1' }),
    };
    const webhooksService = {
      dispatch: jest.fn().mockResolvedValue(undefined),
    };
    return {
      service: new QuotesService(
        prisma as never,
        opportunitiesService as never,
        webhooksService as never,
      ),
      prisma,
      webhooksService,
    };
  };

  it('create() calcula version incremental e totalValue a partir dos itens', async () => {
    const findFirst = jest.fn().mockResolvedValue({ version: 2 });
    const create = jest.fn().mockImplementation(({ data }) => data);
    const { service } = makeService({ quote: { findFirst, create } });

    const result = await service.create(user('vendedor'), {
      opportunityId: 'o1',
      items: [
        { description: 'Item 1', quantity: 2, unitPrice: 100 },
        { description: 'Item 2', quantity: 1, unitPrice: 50 },
      ],
    });

    expect(result.version).toBe(3);
    expect(result.totalValue).toBe(250);
    expect(result.status).toBe('rascunho');
  });

  it('create() começa em version 1 quando não há proposta anterior', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const create = jest.fn().mockImplementation(({ data }) => data);
    const { service } = makeService({ quote: { findFirst, create } });

    const result = await service.create(user('admin'), {
      opportunityId: 'o1',
      items: [{ description: 'Item único', quantity: 1, unitPrice: 10 }],
    });

    expect(result.version).toBe(1);
  });

  it('approve() só funciona a partir de "enviada" — rejeita rascunho direto', async () => {
    const findFirst = jest.fn().mockResolvedValue({
      id: 'q1',
      status: 'rascunho',
      opportunityId: 'o1',
      opportunity: { ownerId: 'user-1', customerId: 'c1' },
    });
    const { service } = makeService({ quote: { findFirst } });

    await expect(service.approve(user('admin'), 'q1')).rejects.toThrow(
      ConflictException,
    );
  });

  it('approve() cria o Pedido automaticamente e fecha a oportunidade como ganha', async () => {
    const findFirst = jest.fn().mockResolvedValue({
      id: 'q1',
      status: 'enviada',
      opportunityId: 'o1',
      totalValue: 250,
      opportunity: { ownerId: 'user-1', customerId: 'c1' },
    });
    const quoteUpdate = jest
      .fn()
      .mockResolvedValue({ id: 'q1', status: 'aprovada', totalValue: 250 });
    const orderCreate = jest.fn().mockImplementation(({ data }) => data);
    const opportunityUpdate = jest.fn().mockResolvedValue({});

    const { service, webhooksService } = makeService({
      quote: { findFirst, update: quoteUpdate },
      order: { create: orderCreate },
      opportunity: { update: opportunityUpdate },
    });

    const result = await service.approve(user('admin'), 'q1');

    expect(orderCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          quoteId: 'q1',
          customerId: 'c1',
          totalValue: 250,
          status: 'confirmado',
        }),
      }),
    );
    expect(opportunityUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'o1' },
        data: expect.objectContaining({ stage: 'fechado_ganho' }),
      }),
    );
    expect(result.order.customerId).toBe('c1');
    expect(webhooksService.dispatch).toHaveBeenCalledWith(
      'tenant-1',
      'order.created',
      expect.objectContaining({ customerId: 'c1', totalValue: 250 }),
    );
  });
});
