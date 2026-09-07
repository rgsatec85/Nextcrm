import { FinanceService } from './finance.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';

function user(roleSlug: string, sub = 'user-1'): AuthenticatedUser {
  return { sub, tenantId: 'tenant-1', email: 'x@x.com', roleSlug };
}

describe('FinanceService', () => {
  const makeService = (tx: Record<string, unknown>) => {
    const prisma = {
      runWithTenant: jest.fn(
        (_tenantId: string, fn: (tx: unknown) => unknown) => fn(tx),
      ),
    };
    const customersService = {
      assertAccessible: jest.fn().mockResolvedValue({ id: 'c1' }),
    };
    return {
      service: new FinanceService(prisma as never, customersService as never),
    };
  };

  it('dashboard() soma a receber/recebido/atrasado e agrupa o fluxo de caixa por mês', async () => {
    const paidDueDate = new Date();
    paidDueDate.setDate(paidDueDate.getDate() - 5);
    const futureDueDate = new Date();
    futureDueDate.setDate(futureDueDate.getDate() + 30);
    const overdueDueDate = new Date('2020-01-01');

    const findMany = jest.fn().mockResolvedValue([
      { amount: 100, paidAmount: 100, dueDate: paidDueDate, status: 'pago' },
      { amount: 200, paidAmount: 0, dueDate: futureDueDate, status: 'aberto' },
      // vencida: aberto e no passado
      { amount: 50, paidAmount: 0, dueDate: overdueDueDate, status: 'aberto' },
    ]);
    const { service } = makeService({ invoice: { findMany } });

    const result = await service.dashboard(user('admin'));

    expect(result.totalReceived).toBe(100);
    expect(result.totalReceivable).toBe(250);
    expect(result.totalOverdue).toBe(50);
    expect(result.overdueCount).toBe(1);
  });

  it('customerScore() classifica "vermelho" quando a inadimplência é alta', async () => {
    const findFirst = jest
      .fn()
      .mockResolvedValue({ createdAt: new Date('2024-01-01') });
    const findMany = jest.fn().mockResolvedValue([
      {
        amount: 100,
        paidAmount: 0,
        dueDate: new Date('2020-01-01'),
        paidAt: null,
        status: 'aberto',
      },
    ]);
    const { service } = makeService({
      customer: { findFirst },
      invoice: { findMany },
    });

    const result = await service.customerScore(user('admin'), 'c1');

    expect(result.classification).toBe('vermelho');
    expect(result.delinquencyRate).toBe(1);
  });

  it('customerScore() classifica "verde" quando tudo foi pago em dia', async () => {
    const findFirst = jest
      .fn()
      .mockResolvedValue({ createdAt: new Date('2024-01-01') });
    const findMany = jest.fn().mockResolvedValue([
      {
        amount: 100,
        paidAmount: 100,
        dueDate: new Date('2026-01-10'),
        paidAt: new Date('2026-01-05'),
        status: 'pago',
      },
    ]);
    const { service } = makeService({
      customer: { findFirst },
      invoice: { findMany },
    });

    const result = await service.customerScore(user('admin'), 'c1');

    expect(result.classification).toBe('verde');
    expect(result.punctualityRate).toBe(1);
  });

  it('commissionsReport() força o filtro para o próprio vendedor quando o perfil é vendedor', async () => {
    const findMany = jest
      .fn()
      .mockResolvedValueOnce([]) // tx.invoice.findMany
      .mockResolvedValueOnce([]); // tx.user.findMany
    const { service } = makeService({
      invoice: { findMany },
      user: { findMany },
    });

    await service.commissionsReport(user('vendedor', 'user-1'), 'outro-user');

    const invoiceCall = findMany.mock.calls[0][0];
    expect(invoiceCall.where.order.customer).toEqual({ ownerId: 'user-1' });
  });

  it('commissionsReport() calcula o valor da comissão a partir da taxa do vendedor', async () => {
    const invoiceFindMany = jest.fn().mockResolvedValue([
      { paidAmount: 1000, order: { customer: { ownerId: 'vendor-1' } } },
      { paidAmount: 500, order: { customer: { ownerId: 'vendor-1' } } },
    ]);
    const userFindMany = jest
      .fn()
      .mockResolvedValue([
        { id: 'vendor-1', name: 'Vendedor Um', commissionRate: 0.1 },
      ]);
    const { service } = makeService({
      invoice: { findMany: invoiceFindMany },
      user: { findMany: userFindMany },
    });

    const result = await service.commissionsReport(user('admin'));

    expect(result).toEqual([
      {
        ownerId: 'vendor-1',
        ownerName: 'Vendedor Um',
        totalPaid: 1500,
        commissionRate: 0.1,
        commissionAmount: 150,
      },
    ]);
  });
});
