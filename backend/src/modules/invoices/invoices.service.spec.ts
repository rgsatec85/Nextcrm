import { ConflictException, ForbiddenException } from '@nestjs/common';
import { InvoicesService } from './invoices.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';

function user(roleSlug: string, sub = 'user-1'): AuthenticatedUser {
  return { sub, tenantId: 'tenant-1', email: 'x@x.com', roleSlug };
}

describe('InvoicesService', () => {
  const makeService = (
    tx: Record<string, unknown>,
    order: Record<string, unknown> = {},
  ) => {
    const prisma = {
      runWithTenant: jest.fn(
        (_tenantId: string, fn: (tx: unknown) => unknown) => fn(tx),
      ),
    };
    const ordersService = {
      findOne: jest.fn().mockResolvedValue({
        id: 'o1',
        customerId: 'c1',
        totalValue: 300,
        customer: { id: 'c1', ownerId: 'user-1' },
        ...order,
      }),
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
      service: new InvoicesService(
        prisma as never,
        ordersService as never,
        customersService as never,
        webhooksService as never,
      ),
      webhooksService,
    };
  };

  it('generateForOrder() divide o valor igualmente, última parcela absorve o arredondamento', async () => {
    const createMany = jest.fn().mockResolvedValue({ count: 3 });
    const findMany = jest.fn().mockResolvedValue([]);
    const count = jest.fn().mockResolvedValue(0);
    const { service } = makeService({
      invoice: { createMany, findMany, count },
    });

    await service.generateForOrder(user('admin'), 'o1', {
      installments: 3,
      firstDueDate: '2026-01-01',
    });

    const rows = createMany.mock.calls[0][0].data as Array<{ amount: number }>;
    expect(rows).toHaveLength(3);
    expect(rows[0].amount).toBe(100);
    expect(rows[1].amount).toBe(100);
    expect(rows[2].amount).toBe(100);
    expect(rows.reduce((sum, r) => sum + r.amount, 0)).toBeCloseTo(300, 2);
  });

  it('generateForOrder() rejeita gerar parcelas duas vezes para o mesmo pedido', async () => {
    const count = jest.fn().mockResolvedValue(3);
    const { service } = makeService({ invoice: { count } });

    await expect(
      service.generateForOrder(user('admin'), 'o1', {
        installments: 2,
        firstDueDate: '2026-01-01',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('registerPayment() marca "parcial" quando o valor não cobre o saldo total', async () => {
    const findFirst = jest.fn().mockResolvedValue({
      id: 'i1',
      amount: 100,
      paidAmount: 0,
      status: 'aberto',
      dueDate: new Date('2026-01-01'),
      customer: { id: 'c1', ownerId: 'user-1' },
    });
    const update = jest.fn().mockImplementation(({ data }) => data);
    const { service, webhooksService } = makeService({
      invoice: { findFirst, update },
    });

    const result = await service.registerPayment(user('admin'), 'i1', {
      amount: 40,
      paymentMethod: 'pix',
    });

    expect(result.status).toBe('parcial');
    expect(result.paidAmount).toBe(40);
    // Pagamento parcial NUNCA dispara invoice.paid — só quando fica 100% pago.
    expect(webhooksService.dispatch).not.toHaveBeenCalled();
  });

  it('registerPayment() marca "pago" e seta paidAt quando o valor cobre o saldo total', async () => {
    const findFirst = jest.fn().mockResolvedValue({
      id: 'i1',
      amount: 100,
      paidAmount: 60,
      status: 'parcial',
      dueDate: new Date('2026-01-01'),
      customer: { id: 'c1', ownerId: 'user-1' },
    });
    const update = jest.fn().mockImplementation(({ data }) => data);
    const { service, webhooksService } = makeService({
      invoice: { findFirst, update },
    });

    const result = await service.registerPayment(user('admin'), 'i1', {
      amount: 40,
      paymentMethod: 'pix',
    });

    expect(result.status).toBe('pago');
    expect(result.paidAmount).toBe(100);
    expect(result.paidAt).toBeInstanceOf(Date);
    expect(webhooksService.dispatch).toHaveBeenCalledWith(
      'tenant-1',
      'invoice.paid',
      expect.objectContaining({ invoiceId: 'i1', customerId: 'c1' }),
    );
  });

  it('registerPayment() rejeita valor maior que o saldo em aberto', async () => {
    const findFirst = jest.fn().mockResolvedValue({
      id: 'i1',
      amount: 100,
      paidAmount: 0,
      status: 'aberto',
      dueDate: new Date('2026-01-01'),
      customer: { id: 'c1', ownerId: 'user-1' },
    });
    const { service } = makeService({ invoice: { findFirst } });

    await expect(
      service.registerPayment(user('admin'), 'i1', {
        amount: 999,
        paymentMethod: 'pix',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('registerPayment() bloqueia vendedor pagando fatura de cliente de outro dono', async () => {
    const findFirst = jest.fn().mockResolvedValue({
      id: 'i1',
      amount: 100,
      paidAmount: 0,
      status: 'aberto',
      dueDate: new Date('2026-01-01'),
      customer: { id: 'c1', ownerId: 'outro-user' },
    });
    const { service } = makeService({ invoice: { findFirst } });

    await expect(
      service.registerPayment(user('vendedor', 'user-1'), 'i1', {
        amount: 10,
        paymentMethod: 'pix',
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('cancel() só funciona com fatura em aberto (sem pagamento)', async () => {
    const findFirst = jest.fn().mockResolvedValue({
      id: 'i1',
      amount: 100,
      paidAmount: 40,
      status: 'parcial',
      dueDate: new Date('2026-01-01'),
      customer: { id: 'c1', ownerId: 'user-1' },
    });
    const { service } = makeService({ invoice: { findFirst } });

    await expect(service.cancel(user('admin'), 'i1')).rejects.toThrow(
      ConflictException,
    );
  });
});
