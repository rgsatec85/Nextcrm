import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { OrdersService } from '../orders/orders.service';
import { CustomersService } from '../customers/customers.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { assertOwnership } from '../../common/crm/ownership';
import { GenerateInvoicesDto } from './dto/generate-invoices.dto';
import { PayInvoiceDto } from './dto/pay-invoice.dto';

// Mesmo padrão de ABAC do resto do CRM Comercial (ver
// common/crm/ownership.ts) — faturas não têm dono próprio, então o
// "vendedor só vê o que é seu" é resolvido via join no dono do CLIENTE,
// igual a OrdersService.
const OWNER_SCOPED_ROLES = ['vendedor'];

// "Vencido" não é um status gravado — é derivado na leitura (aberto/parcial
// com due_date no passado). Ver comentário na migration 0003.
function decorateInvoice<T extends { status: string; dueDate: Date }>(
  invoice: T,
) {
  const isOverdue =
    (invoice.status === 'aberto' || invoice.status === 'parcial') &&
    invoice.dueDate.getTime() < Date.now();
  return { ...invoice, isOverdue };
}

@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ordersService: OrdersService,
    private readonly customersService: CustomersService,
    private readonly webhooksService: WebhooksService,
  ) {}

  /**
   * Gera as parcelas de um Pedido (spec Fase 2 — "geração automática de
   * parcelas"). Divide o valor total igualmente, com a última parcela
   * absorvendo o arredondamento, e datas espaçadas por `intervalDays` a
   * partir de `firstDueDate`. Só pode ser feito uma vez por pedido — para
   * corrigir, cancele as faturas gente geradas e gere de novo (não há
   * fluxo de "regerar" nesta fase).
   */
  async generateForOrder(
    user: AuthenticatedUser,
    orderId: string,
    dto: GenerateInvoicesDto,
  ) {
    const order = await this.ordersService.findOne(user, orderId);

    const existingCount = await this.prisma.runWithTenant(
      user.tenantId,
      async (tx) =>
        tx.invoice.count({ where: { orderId, tenantId: user.tenantId } }),
    );
    if (existingCount > 0) {
      throw new ConflictException('Este pedido já tem parcelas geradas');
    }

    const total = Number(order.totalValue);
    const installments = dto.installments;
    const intervalDays = dto.intervalDays ?? 30;
    const baseAmount = Math.floor((total / installments) * 100) / 100;
    const firstDueDate = new Date(dto.firstDueDate);

    const rows = Array.from({ length: installments }, (_, index) => {
      const isLast = index === installments - 1;
      const amount = isLast
        ? Number((total - baseAmount * (installments - 1)).toFixed(2))
        : baseAmount;
      const dueDate = new Date(firstDueDate);
      dueDate.setDate(dueDate.getDate() + intervalDays * index);

      return {
        tenantId: user.tenantId,
        customerId: order.customerId,
        orderId,
        installmentNumber: index + 1,
        totalInstallments: installments,
        amount,
        dueDate,
        paymentMethod: dto.paymentMethod,
        createdBy: user.sub,
        updatedBy: user.sub,
      };
    });

    return this.prisma.runWithTenant(user.tenantId, async (tx) => {
      await tx.invoice.createMany({ data: rows });
      return tx.invoice.findMany({
        where: { orderId, tenantId: user.tenantId },
        orderBy: { installmentNumber: 'asc' },
      });
    });
  }

  async findAll(
    user: AuthenticatedUser,
    filters: {
      customerId?: string;
      orderId?: string;
      status?: string;
      overdueOnly?: boolean;
    },
  ) {
    if (filters.customerId) {
      await this.customersService.assertAccessible(user, filters.customerId);
    }

    const invoices = await this.prisma.runWithTenant(
      user.tenantId,
      async (tx) =>
        tx.invoice.findMany({
          where: {
            tenantId: user.tenantId,
            ...(filters.customerId ? { customerId: filters.customerId } : {}),
            ...(filters.orderId ? { orderId: filters.orderId } : {}),
            ...(filters.status ? { status: filters.status } : {}),
            ...(OWNER_SCOPED_ROLES.includes(user.roleSlug)
              ? { customer: { ownerId: user.sub } }
              : {}),
          },
          include: { customer: { select: { id: true, name: true } } },
          orderBy: { dueDate: 'asc' },
        }),
    );

    const decorated = invoices.map(decorateInvoice);
    return filters.overdueOnly
      ? decorated.filter((i: { isOverdue: boolean }) => i.isOverdue)
      : decorated;
  }

  async findOne(user: AuthenticatedUser, id: string) {
    const invoice = await this.prisma.runWithTenant(user.tenantId, async (tx) =>
      tx.invoice.findFirst({
        where: { id, tenantId: user.tenantId },
        include: {
          customer: { select: { id: true, name: true, ownerId: true } },
        },
      }),
    );

    if (!invoice) {
      throw new NotFoundException('Fatura não encontrada');
    }
    assertOwnership(user, { ownerId: invoice.customer.ownerId });

    return decorateInvoice(invoice);
  }

  /** Registra um pagamento (total ou parcial) — spec Fase 2 "Contas a receber". */
  async registerPayment(
    user: AuthenticatedUser,
    id: string,
    dto: PayInvoiceDto,
  ) {
    const invoice = await this.findOne(user, id);

    if (invoice.status === 'cancelado') {
      throw new ConflictException(
        'Fatura cancelada não pode receber pagamento',
      );
    }
    if (invoice.status === 'pago') {
      throw new ConflictException('Fatura já está totalmente paga');
    }

    const remaining = Number(invoice.amount) - Number(invoice.paidAmount);
    if (dto.amount > remaining + 0.01) {
      throw new ConflictException(
        `Valor informado (${dto.amount}) é maior que o saldo em aberto (${remaining.toFixed(2)})`,
      );
    }

    const newPaidAmount = Number(invoice.paidAmount) + dto.amount;
    const isFullyPaid = newPaidAmount >= Number(invoice.amount) - 0.01;

    const updated = await this.prisma.runWithTenant(user.tenantId, async (tx) =>
      tx.invoice.update({
        where: { id },
        data: {
          paidAmount: newPaidAmount,
          status: isFullyPaid ? 'pago' : 'parcial',
          paidAt: isFullyPaid
            ? dto.paidAt
              ? new Date(dto.paidAt)
              : new Date()
            : invoice.paidAt,
          paymentMethod: dto.paymentMethod,
          updatedBy: user.sub,
        },
      }),
    );

    // Webhook "invoice.paid" (spec Fase 3) só quando a fatura CHEGA a
    // totalmente paga nesta chamada — não em cada pagamento parcial.
    // Fora da transação/best-effort, igual ao order.created em QuotesService.
    if (isFullyPaid) {
      await this.webhooksService.dispatch(user.tenantId, 'invoice.paid', {
        invoiceId: id,
        customerId: invoice.customer.id,
        amount: updated.amount,
        paidAmount: updated.paidAmount,
      });
    }

    return updated;
  }

  /** Só pode cancelar fatura sem nenhum pagamento registrado. */
  async cancel(user: AuthenticatedUser, id: string) {
    const invoice = await this.findOne(user, id);

    if (invoice.status !== 'aberto') {
      throw new ConflictException(
        'Só é possível cancelar faturas em aberto (sem pagamento registrado)',
      );
    }

    return this.prisma.runWithTenant(user.tenantId, async (tx) =>
      tx.invoice.update({
        where: { id },
        data: { status: 'cancelado', updatedBy: user.sub },
      }),
    );
  }
}
