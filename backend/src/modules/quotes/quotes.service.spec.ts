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
    const proposalPdfService = {
      generate: jest.fn().mockResolvedValue(Buffer.from('pdf')),
    };
    return {
      service: new QuotesService(
        prisma as never,
        opportunitiesService as never,
        webhooksService as never,
        proposalPdfService as never,
      ),
      prisma,
      webhooksService,
      proposalPdfService,
    };
  };

  it('create() calcula version incremental e totalValue a partir dos itens', async () => {
    const findFirst = jest.fn().mockResolvedValue({ version: 2 });
    const count = jest.fn().mockResolvedValue(4);
    const create = jest.fn().mockImplementation(({ data }) => data);
    const { service } = makeService({ quote: { findFirst, count, create } });

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
    expect(result.number).toBe(`PROP-${new Date().getFullYear()}-0005`);
  });

  it('create() começa em version 1 quando não há proposta anterior', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const count = jest.fn().mockResolvedValue(0);
    const create = jest.fn().mockImplementation(({ data }) => data);
    const { service } = makeService({ quote: { findFirst, count, create } });

    const result = await service.create(user('admin'), {
      opportunityId: 'o1',
      items: [{ description: 'Item único', quantity: 1, unitPrice: 10 }],
    });

    expect(result.version).toBe(1);
    expect(result.number).toBe(`PROP-${new Date().getFullYear()}-0001`);
  });

  it('markWinner() desmarca outras vencedoras da mesma oportunidade antes de marcar esta', async () => {
    const findFirst = jest.fn().mockResolvedValue({
      id: 'q2',
      opportunityId: 'o1',
      opportunity: { ownerId: 'user-1', customerId: 'c1' },
    });
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const update = jest.fn().mockResolvedValue({ id: 'q2', isWinner: true });
    const { service } = makeService({
      quote: { findFirst, updateMany, update },
    });

    const result = await service.markWinner(user('admin'), 'q2');

    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { opportunityId: 'o1', isWinner: true },
        data: { isWinner: false },
      }),
    );
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'q2' },
        data: expect.objectContaining({ isWinner: true }),
      }),
    );
    expect(result.isWinner).toBe(true);
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

  // Fase 7 (spec v3.1, RF012): aprovar não cria mais o Pedido sozinho — só
  // fecha a oportunidade como ganha. A criação do Pedido virou um passo
  // explícito (convertToOrder(), testado abaixo).
  it('approve() fecha a oportunidade como ganha e NÃO cria pedido nem dispara webhook', async () => {
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
    const orderCreate = jest.fn();
    const opportunityUpdate = jest.fn().mockResolvedValue({});

    const { service, webhooksService } = makeService({
      quote: { findFirst, update: quoteUpdate },
      order: { create: orderCreate },
      opportunity: { update: opportunityUpdate },
    });

    const result = await service.approve(user('admin'), 'q1');

    expect(orderCreate).not.toHaveBeenCalled();
    expect(opportunityUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'o1' },
        data: expect.objectContaining({ stage: 'fechado_ganho' }),
      }),
    );
    expect(result.status).toBe('aprovada');
    expect(webhooksService.dispatch).not.toHaveBeenCalled();
  });

  it('convertToOrder() cria o pedido herdando itens/valor da proposta quando nada é informado', async () => {
    const findFirst = jest
      .fn()
      .mockResolvedValueOnce({
        id: 'q1',
        status: 'aprovada',
        opportunityId: 'o1',
        totalValue: 250,
        items: [{ description: 'Item único', quantity: 1, unitPrice: 250 }],
        opportunity: { ownerId: 'user-1', customerId: 'c1' },
      })
      .mockResolvedValueOnce(null); // nenhum pedido existente ainda para esta proposta
    const orderCreate = jest.fn().mockImplementation(({ data }) => data);

    const { service, webhooksService } = makeService({
      quote: { findFirst },
      order: { findFirst, create: orderCreate },
    });

    const order = await service.convertToOrder(user('admin'), 'q1', {});

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
    expect(order.customerId).toBe('c1');
    expect(webhooksService.dispatch).toHaveBeenCalledWith(
      'tenant-1',
      'order.created',
      expect.objectContaining({ customerId: 'c1', totalValue: 250 }),
    );
  });

  it('convertToOrder() permite sobrescrever itens/valor/prazo de entrega/condição de pagamento', async () => {
    const findFirst = jest
      .fn()
      .mockResolvedValueOnce({
        id: 'q1',
        status: 'aprovada',
        opportunityId: 'o1',
        totalValue: 250,
        items: [{ description: 'Item único', quantity: 1, unitPrice: 250 }],
        opportunity: { ownerId: 'user-1', customerId: 'c1' },
      })
      .mockResolvedValueOnce(null);
    const orderCreate = jest.fn().mockImplementation(({ data }) => data);

    const { service } = makeService({
      quote: { findFirst },
      order: { findFirst, create: orderCreate },
    });

    const order = await service.convertToOrder(user('admin'), 'q1', {
      items: [{ description: 'Item revisado', quantity: 2, unitPrice: 100 }],
      deliveryDate: '2026-12-01',
      paymentTerms: '30/60/90',
    });

    expect(order.totalValue).toBe(200);
    expect(order.paymentTerms).toBe('30/60/90');
  });

  it('convertToOrder() rejeita proposta que ainda não foi aprovada', async () => {
    const findFirst = jest.fn().mockResolvedValue({
      id: 'q1',
      status: 'enviada',
      opportunityId: 'o1',
      opportunity: { ownerId: 'user-1', customerId: 'c1' },
    });
    const { service } = makeService({ quote: { findFirst } });

    await expect(
      service.convertToOrder(user('admin'), 'q1', {}),
    ).rejects.toThrow(ConflictException);
  });

  it('convertToOrder() rejeita converter a mesma proposta duas vezes', async () => {
    const quoteFindFirst = jest.fn().mockResolvedValue({
      id: 'q1',
      status: 'aprovada',
      opportunityId: 'o1',
      totalValue: 250,
      items: [],
      opportunity: { ownerId: 'user-1', customerId: 'c1' },
    });
    const orderFindFirst = jest
      .fn()
      .mockResolvedValue({ id: 'existing-order' });
    const orderCreate = jest.fn();

    const { service } = makeService({
      quote: { findFirst: quoteFindFirst },
      order: { findFirst: orderFindFirst, create: orderCreate },
    });

    await expect(
      service.convertToOrder(user('admin'), 'q1', {}),
    ).rejects.toThrow(ConflictException);
    expect(orderCreate).not.toHaveBeenCalled();
  });
});
