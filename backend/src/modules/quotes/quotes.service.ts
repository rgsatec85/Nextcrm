import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { OpportunitiesService } from '../opportunities/opportunities.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { assertOwnership } from '../../common/crm/ownership';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { UpdateQuoteDto } from './dto/update-quote.dto';
import { QuoteItemDto } from './dto/quote-item.dto';

function calculateTotal(items: QuoteItemDto[]): number {
  return items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
}

@Injectable()
export class QuotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly opportunitiesService: OpportunitiesService,
    private readonly webhooksService: WebhooksService,
  ) {}

  // Proposta (spec §9/§11): versionamento simples — cada revisão é uma nova
  // linha com version incremental, a anterior fica congelada como histórico.
  async create(user: AuthenticatedUser, dto: CreateQuoteDto) {
    await this.opportunitiesService.assertAccessible(user, dto.opportunityId);

    return this.prisma.runWithTenant(user.tenantId, async (tx) => {
      const last = await tx.quote.findFirst({
        where: { opportunityId: dto.opportunityId },
        orderBy: { version: 'desc' },
        select: { version: true },
      });

      return tx.quote.create({
        data: {
          tenantId: user.tenantId,
          opportunityId: dto.opportunityId,
          version: (last?.version ?? 0) + 1,
          status: 'rascunho',
          totalValue: calculateTotal(dto.items),
          items: dto.items as unknown as object,
          createdBy: user.sub,
          updatedBy: user.sub,
        },
      });
    });
  }

  async findAll(user: AuthenticatedUser, opportunityId?: string) {
    return this.prisma.runWithTenant(user.tenantId, (tx) =>
      tx.quote.findMany({
        where: {
          tenantId: user.tenantId,
          ...(opportunityId ? { opportunityId } : {}),
        },
        orderBy: [{ opportunityId: 'asc' }, { version: 'desc' }],
      }),
    );
  }

  private async findAccessible(user: AuthenticatedUser, id: string) {
    const quote = await this.prisma.runWithTenant(user.tenantId, async (tx) =>
      tx.quote.findFirst({
        where: { id, tenantId: user.tenantId },
        include: {
          opportunity: { select: { ownerId: true, customerId: true } },
        },
      }),
    );

    if (!quote) {
      throw new NotFoundException('Proposta não encontrada');
    }
    assertOwnership(user, { ownerId: quote.opportunity.ownerId });

    return quote;
  }

  async findOne(user: AuthenticatedUser, id: string) {
    return this.findAccessible(user, id);
  }

  async update(user: AuthenticatedUser, id: string, dto: UpdateQuoteDto) {
    const quote = await this.findAccessible(user, id);

    if (quote.status !== 'rascunho') {
      throw new ConflictException(
        'Só é possível editar propostas em rascunho — crie uma nova versão',
      );
    }

    return this.prisma.runWithTenant(user.tenantId, (tx) =>
      tx.quote.update({
        where: { id },
        data: {
          items: dto.items as unknown as object,
          totalValue: calculateTotal(dto.items),
          updatedBy: user.sub,
        },
      }),
    );
  }

  async send(user: AuthenticatedUser, id: string) {
    const quote = await this.findAccessible(user, id);
    this.assertTransition(quote.status, 'rascunho', 'enviada');

    return this.prisma.runWithTenant(user.tenantId, (tx) =>
      tx.quote.update({
        where: { id },
        data: { status: 'enviada', updatedBy: user.sub },
      }),
    );
  }

  async reject(user: AuthenticatedUser, id: string) {
    const quote = await this.findAccessible(user, id);
    this.assertTransition(quote.status, 'enviada', 'rejeitada');

    return this.prisma.runWithTenant(user.tenantId, (tx) =>
      tx.quote.update({
        where: { id },
        data: { status: 'rejeitada', updatedBy: user.sub },
      }),
    );
  }

  /**
   * Aprova a proposta e converte automaticamente em Pedido (spec §9
   * "Conversão automática"), além de marcar a oportunidade como ganha —
   * tudo na mesma transação, então nunca existe um estado intermediário
   * onde a proposta está aprovada mas o pedido ainda não existe.
   */
  async approve(user: AuthenticatedUser, id: string) {
    const quote = await this.findAccessible(user, id);
    this.assertTransition(quote.status, 'enviada', 'aprovada');

    return this.prisma
      .runWithTenant(user.tenantId, async (tx) => {
        const approved = await tx.quote.update({
          where: { id },
          data: { status: 'aprovada', updatedBy: user.sub },
        });

        const order = await tx.order.create({
          data: {
            tenantId: user.tenantId,
            quoteId: approved.id,
            customerId: quote.opportunity.customerId,
            status: 'confirmado',
            totalValue: approved.totalValue,
            createdBy: user.sub,
            updatedBy: user.sub,
          },
        });

        await tx.opportunity.update({
          where: { id: quote.opportunityId },
          data: { stage: 'fechado_ganho', updatedBy: user.sub },
        });

        return { quote: approved, order };
      })
      .then(async (result) => {
        // Fora da transação de propósito: dispatch() é best-effort e nunca
        // deve poder fazer o approve() falhar/dar rollback por causa de um
        // endpoint de webhook fora do ar (spec Fase 3 — evento order.created).
        await this.webhooksService.dispatch(user.tenantId, 'order.created', {
          orderId: result.order.id,
          customerId: result.order.customerId,
          totalValue: result.order.totalValue,
        });
        return result;
      });
  }

  private assertTransition(current: string, expected: string, next: string) {
    if (current !== expected) {
      throw new ConflictException(
        `Não é possível ir de "${current}" para "${next}" (esperado estar em "${expected}")`,
      );
    }
  }
}
