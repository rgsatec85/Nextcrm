import { ConflictException, NotFoundException } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';

function user(roleSlug = 'admin', sub = 'user-1'): AuthenticatedUser {
  return { sub, tenantId: 'tenant-1', email: 'x@x.com', roleSlug };
}

describe('OrdersService', () => {
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
      service: new OrdersService(
        prisma as never,
        customersService as never,
        webhooksService as never,
      ),
      customersService,
      webhooksService,
    };
  };

  // Fase 7 (spec v3.1, RF012) — Pedido manual, sem proposta associada.
  it('create() calcula totalValue a partir dos itens e dispara order.created', async () => {
    const create = jest.fn().mockImplementation(({ data }) => data);
    const { service, customersService, webhooksService } = makeService({
      order: { create },
    });

    const order = await service.create(user('vendedor'), {
      customerId: 'c1',
      items: [
        { description: 'Item 1', quantity: 2, unitPrice: 100 },
        { description: 'Item 2', quantity: 1, unitPrice: 50 },
      ],
    });

    expect(customersService.assertAccessible).toHaveBeenCalledWith(
      expect.objectContaining({ sub: 'user-1' }),
      'c1',
    );
    expect(order.totalValue).toBe(250);
    expect(order.status).toBe('confirmado');
    expect(webhooksService.dispatch).toHaveBeenCalledWith(
      'tenant-1',
      'order.created',
      expect.objectContaining({ customerId: 'c1', totalValue: 250 }),
    );
  });

  it('create() propaga o erro do ABAC quando o cliente não é acessível', async () => {
    const create = jest.fn();
    const prisma = {
      runWithTenant: jest.fn((_t: string, fn: (tx: unknown) => unknown) =>
        fn({ order: { create } }),
      ),
    };
    const customersService = {
      assertAccessible: jest
        .fn()
        .mockRejectedValue(new NotFoundException('Cliente não encontrado')),
    };
    const webhooksService = { dispatch: jest.fn() };
    const service = new OrdersService(
      prisma as never,
      customersService as never,
      webhooksService as never,
    );

    await expect(
      service.create(user('vendedor'), {
        customerId: 'c-outro',
        items: [{ description: 'Item', quantity: 1, unitPrice: 10 }],
      }),
    ).rejects.toThrow(NotFoundException);
    expect(create).not.toHaveBeenCalled();
  });

  it('update() recalcula totalValue quando items são informados e não há fatura gerada', async () => {
    const orderFindFirst = jest.fn().mockResolvedValue({
      id: 'ord1',
      customer: { id: 'c1', name: 'Cliente', ownerId: 'user-1' },
      quote: null,
    });
    const invoiceCount = jest.fn().mockResolvedValue(0);
    const orderUpdate = jest.fn().mockImplementation(({ data }) => data);
    const { service } = makeService({
      order: { findFirst: orderFindFirst, update: orderUpdate },
      invoice: { count: invoiceCount },
    });

    const result = await service.update(user('admin'), 'ord1', {
      items: [{ description: 'Item revisado', quantity: 3, unitPrice: 20 }],
      paymentTerms: 'à vista',
    });

    expect(result.totalValue).toBe(60);
    expect(result.paymentTerms).toBe('à vista');
  });

  it('update() rejeita alterar itens quando o pedido já tem fatura gerada', async () => {
    const orderFindFirst = jest.fn().mockResolvedValue({
      id: 'ord1',
      customer: { id: 'c1', name: 'Cliente', ownerId: 'user-1' },
      quote: null,
    });
    const invoiceCount = jest.fn().mockResolvedValue(1);
    const orderUpdate = jest.fn();
    const { service } = makeService({
      order: { findFirst: orderFindFirst, update: orderUpdate },
      invoice: { count: invoiceCount },
    });

    await expect(
      service.update(user('admin'), 'ord1', {
        items: [{ description: 'Item revisado', quantity: 1, unitPrice: 10 }],
      }),
    ).rejects.toThrow(ConflictException);
    expect(orderUpdate).not.toHaveBeenCalled();
  });

  it('update() permite alterar prazo de entrega/observações sem tocar em itens, mesmo com fatura gerada', async () => {
    const orderFindFirst = jest.fn().mockResolvedValue({
      id: 'ord1',
      customer: { id: 'c1', name: 'Cliente', ownerId: 'user-1' },
      quote: null,
    });
    const invoiceCount = jest.fn().mockResolvedValue(1);
    const orderUpdate = jest.fn().mockImplementation(({ data }) => data);
    const { service } = makeService({
      order: { findFirst: orderFindFirst, update: orderUpdate },
      invoice: { count: invoiceCount },
    });

    const result = await service.update(user('admin'), 'ord1', {
      internalNotes: 'Cliente pediu entrega expressa',
    });

    expect(invoiceCount).not.toHaveBeenCalled();
    expect(result.internalNotes).toBe('Cliente pediu entrega expressa');
  });
});
