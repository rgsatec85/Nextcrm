import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CustomersService } from '../customers/customers.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';

const OWNER_SCOPED_ROLES = ['vendedor'];

type InvoiceForMath = {
  amount: unknown;
  paidAmount: unknown;
  dueDate: Date;
  status: string;
  paidAt: Date | null;
};

type VendorRateRow = {
  id: string;
  name: string;
  commissionRate: unknown;
};

@Injectable()
export class FinanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly customersService: CustomersService,
  ) {}

  /**
   * Dashboard financeiro (spec Fase 2): a receber, recebido, atrasado, e um
   * fluxo de caixa simplificado agrupado por mês de vencimento. Restrito a
   * admin/gestor/financeiro — é uma visão da empresa inteira, não por
   * cliente/vendedor.
   */
  async dashboard(user: AuthenticatedUser) {
    const invoices = await this.prisma.runWithTenant(
      user.tenantId,
      async (tx) =>
        tx.invoice.findMany({
          where: { tenantId: user.tenantId, status: { not: 'cancelado' } },
          select: {
            amount: true,
            paidAmount: true,
            dueDate: true,
            status: true,
          },
        }),
    );

    const now = Date.now();
    let totalReceivable = 0;
    let totalReceived = 0;
    let totalOverdue = 0;
    let overdueCount = 0;

    const cashflowByMonth = new Map<
      string,
      { expected: number; received: number }
    >();

    for (const inv of invoices as InvoiceForMath[]) {
      const amount = Number(inv.amount);
      const paid = Number(inv.paidAmount);
      const remaining = amount - paid;

      totalReceived += paid;
      if (remaining > 0.01) {
        totalReceivable += remaining;
        if (inv.dueDate.getTime() < now && inv.status !== 'pago') {
          totalOverdue += remaining;
          overdueCount += 1;
        }
      }

      const monthKey = inv.dueDate.toISOString().slice(0, 7);
      const entry = cashflowByMonth.get(monthKey) ?? {
        expected: 0,
        received: 0,
      };
      entry.expected += amount;
      entry.received += paid;
      cashflowByMonth.set(monthKey, entry);
    }

    const cashflow = Array.from(cashflowByMonth.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, values]) => ({ month, ...values }));

    return {
      totalReceivable: round2(totalReceivable),
      totalReceived: round2(totalReceived),
      totalOverdue: round2(totalOverdue),
      overdueCount,
      cashflow: cashflow.map((c) => ({
        month: c.month,
        expected: round2(c.expected),
        received: round2(c.received),
      })),
    };
  }

  /**
   * Score Financeiro (spec Fase 2/§10 Cliente 360°): heurística
   * determinística — pontualidade, inadimplência e volume de um cliente —
   * classificando em verde/amarelo/vermelho. NÃO é o "Score IA" da Fase 4
   * (que usa aprendizado de máquina de verdade sobre histórico maior);
   * este é um placeholder explícito, documentado em
   * docs/fase2-financeiro.md, para o Cliente 360° já mostrar algo útil
   * antes da IA entrar em cena.
   */
  async customerScore(user: AuthenticatedUser, customerId: string) {
    await this.customersService.assertAccessible(user, customerId);

    const [customer, invoices] = await this.prisma.runWithTenant(
      user.tenantId,
      async (tx) => {
        const c = await tx.customer.findFirst({
          where: { id: customerId, tenantId: user.tenantId },
          select: { createdAt: true },
        });
        const inv = await tx.invoice.findMany({
          where: { tenantId: user.tenantId, customerId },
          select: {
            amount: true,
            paidAmount: true,
            dueDate: true,
            paidAt: true,
            status: true,
          },
        });
        return [c, inv] as const;
      },
    );

    const list = invoices as InvoiceForMath[];
    const paidInvoices = list.filter((i) => i.status === 'pago');
    const onTimeCount = paidInvoices.filter(
      (i) => i.paidAt && i.paidAt.getTime() <= i.dueDate.getTime(),
    ).length;
    const punctualityRate =
      paidInvoices.length > 0 ? onTimeCount / paidInvoices.length : null;

    const now = Date.now();
    const totalInvoicedAmount = list.reduce(
      (sum, i) => sum + Number(i.amount),
      0,
    );
    const overdueAmount = list
      .filter(
        (i) =>
          i.status !== 'pago' &&
          i.status !== 'cancelado' &&
          i.dueDate.getTime() < now,
      )
      .reduce((sum, i) => sum + (Number(i.amount) - Number(i.paidAmount)), 0);
    const delinquencyRate =
      totalInvoicedAmount > 0 ? overdueAmount / totalInvoicedAmount : 0;

    const totalPaid = paidInvoices.reduce(
      (sum, i) => sum + Number(i.paidAmount),
      0,
    );
    const relationshipDays = customer
      ? Math.floor((now - customer.createdAt.getTime()) / (24 * 60 * 60 * 1000))
      : 0;

    let classification: 'verde' | 'amarelo' | 'vermelho';
    if (delinquencyRate > 0.3) {
      classification = 'vermelho';
    } else if (
      delinquencyRate > 0.1 ||
      (punctualityRate !== null && punctualityRate < 0.7)
    ) {
      classification = 'amarelo';
    } else {
      classification = 'verde';
    }

    return {
      customerId,
      classification,
      punctualityRate,
      delinquencyRate: round2(delinquencyRate),
      totalPaid: round2(totalPaid),
      totalInvoicedAmount: round2(totalInvoicedAmount),
      overdueAmount: round2(overdueAmount),
      relationshipDays,
    };
  }

  /**
   * Relatório de comissões (spec Fase 2): soma o valor RECEBIDO (não só
   * faturado) das faturas de pedidos de clientes que cada vendedor possui,
   * multiplicado pela commission_rate de cada um. Vendedor só vê a própria
   * linha; demais perfis veem o relatório completo (ou filtrado por
   * ownerId, se informado).
   */
  async commissionsReport(user: AuthenticatedUser, ownerId?: string) {
    const targetOwnerId = OWNER_SCOPED_ROLES.includes(user.roleSlug)
      ? user.sub
      : ownerId;

    return this.prisma.runWithTenant(user.tenantId, async (tx) => {
      const invoices = await tx.invoice.findMany({
        where: {
          tenantId: user.tenantId,
          status: 'pago',
          order: {
            customer: targetOwnerId ? { ownerId: targetOwnerId } : {},
          },
        },
        select: {
          paidAmount: true,
          order: { select: { customer: { select: { ownerId: true } } } },
        },
      });

      // Anotado explicitamente: sem `prisma generate` de verdade (ver
      // docs/setup.md), o client stub às vezes infere o retorno de
      // runWithTenant como `{}` em vez de `any` quando o valor é
      // encadeado logo em seguida — mesmo quirk documentado na Fase 1
      // (quotes/orders/activities/opportunities services).
      const users: VendorRateRow[] = await tx.user.findMany({
        where: { tenantId: user.tenantId },
        select: { id: true, name: true, commissionRate: true },
      });
      const userById = new Map(
        users.map((u): [string, VendorRateRow] => [u.id, u]),
      );

      const totals = new Map<string, number>();
      for (const inv of invoices) {
        const vendorId = inv.order?.customer.ownerId;
        if (!vendorId) continue;
        totals.set(
          vendorId,
          (totals.get(vendorId) ?? 0) + Number(inv.paidAmount),
        );
      }

      return Array.from(totals.entries()).map(([id, totalPaid]) => {
        const u = userById.get(id);
        const rate = u ? Number(u.commissionRate) : 0;
        return {
          ownerId: id,
          ownerName: u?.name ?? 'Desconhecido',
          totalPaid: round2(totalPaid),
          commissionRate: rate,
          commissionAmount: round2(totalPaid * rate),
        };
      });
    });
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
