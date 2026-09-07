import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CustomersService } from '../customers/customers.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { assertOwnership } from '../../common/crm/ownership';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { QuoteItemDto } from '../quotes/dto/quote-item.dto';

const OWNER_SCOPED_ROLES = ['vendedor'];

function calculateTotal(items: QuoteItemDto[]): number {
  return items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
}

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly customersService: CustomersService,
    private readonly webhooksService: WebhooksService,
  ) {}

  /**
   * Pedido manual (spec v3.1, RF012) — sem proposta associada. `quoteId`
   * já era opcional no schema desde a Fase 1, mas até esta fase o único
   * jeito de criar um Pedido era via QuotesService.approve()/
   * convertToOrder(). ABAC: `assertAccessible` já garante que um vendedor
   * só cria pedido para cliente que é seu.
   */
  async create(user: AuthenticatedUser, dto: CreateOrderDto) {
    await this.customersService.assertAccessible(user, dto.customerId);

    const order = await this.prisma.runWithTenant(user.tenantId, async (tx) =>
      tx.order.create({
        data: {
          tenantId: user.tenantId,
          customerId: dto.customerId,
          status: dto.status ?? 'confirmado',
          totalValue: calculateTotal(dto.items),
          items: dto.items as unknown as object,
          deliveryDate: dto.deliveryDate
            ? new Date(dto.deliveryDate)
            : undefined,
          paymentTerms: dto.paymentTerms,
          internalNotes: dto.internalNotes,
          createdBy: user.sub,
          updatedBy: user.sub,
        },
      }),
    );

    await this.webhooksService.dispatch(user.tenantId, 'order.created', {
      orderId: order.id,
      customerId: order.customerId,
      totalValue: order.totalValue,
    });

    return order;
  }

  // Pedidos não têm dono próprio (spec não pede isso) — o ABAC aqui olha
  // para o dono do CLIENTE ao qual o pedido pertence, via join.
  async findAll(user: AuthenticatedUser, customerId?: string) {
    return this.prisma.runWithTenant(user.tenantId, (tx) =>
      tx.order.findMany({
        where: {
          tenantId: user.tenantId,
          ...(customerId ? { customerId } : {}),
          ...(OWNER_SCOPED_ROLES.includes(user.roleSlug)
            ? { customer: { ownerId: user.sub } }
            : {}),
        },
        include: {
          customer: { select: { id: true, name: true } },
          // Fase 7 (RF012) — a tela global de Pedidos mostra a proposta de
          // origem quando existir; pedido manual (sem `quoteId`) fica null.
          quote: { select: { id: true, number: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
    );
  }

  async findOne(user: AuthenticatedUser, id: string) {
    const order = await this.prisma.runWithTenant(user.tenantId, async (tx) =>
      tx.order.findFirst({
        where: { id, tenantId: user.tenantId },
        include: {
          customer: { select: { id: true, name: true, ownerId: true } },
          quote: true,
        },
      }),
    );

    if (!order) {
      throw new NotFoundException('Pedido não encontrado');
    }
    assertOwnership(user, { ownerId: order.customer.ownerId });

    return order;
  }

  async updateStatus(user: AuthenticatedUser, id: string, status: string) {
    await this.findOne(user, id);

    return this.prisma.runWithTenant(user.tenantId, (tx) =>
      tx.order.update({
        where: { id },
        data: { status, updatedBy: user.sub },
      }),
    );
  }

  /**
   * Edição do Pedido (spec v3.1, RF012 — "itens editáveis", prazo de
   * entrega, condição de pagamento, observações internas). `items` (e o
   * `totalValue` recalculado a partir dele) só pode mudar enquanto nenhuma
   * fatura já foi gerada para o pedido — mudar o valor depois disso
   * deixaria o financeiro dessincronizado do que já foi cobrado do
   * cliente. Os demais campos continuam editáveis livremente.
   */
  async update(user: AuthenticatedUser, id: string, dto: UpdateOrderDto) {
    await this.findOne(user, id);

    if (dto.items) {
      const invoiceCount = await this.prisma.runWithTenant(
        user.tenantId,
        async (tx) => tx.invoice.count({ where: { orderId: id } }),
      );
      if (invoiceCount > 0) {
        throw new ConflictException(
          'Não é possível alterar os itens: este pedido já tem faturas geradas',
        );
      }
    }

    return this.prisma.runWithTenant(user.tenantId, async (tx) =>
      tx.order.update({
        where: { id },
        data: {
          ...(dto.items
            ? {
                items: dto.items as unknown as object,
                totalValue: calculateTotal(dto.items),
              }
            : {}),
          ...(dto.deliveryDate !== undefined
            ? { deliveryDate: new Date(dto.deliveryDate) }
            : {}),
          ...(dto.paymentTerms !== undefined
            ? { paymentTerms: dto.paymentTerms }
            : {}),
          ...(dto.internalNotes !== undefined
            ? { internalNotes: dto.internalNotes }
            : {}),
          updatedBy: user.sub,
        },
      }),
    );
  }
}
