import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { OpportunitiesService } from '../opportunities/opportunities.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import { ProposalPdfService } from './proposal-pdf.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { assertOwnership, ownerScopeWhere } from '../../common/crm/ownership';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { UpdateQuoteDto } from './dto/update-quote.dto';
import { QuoteItemDto } from './dto/quote-item.dto';
import { ConvertQuoteToOrderDto } from './dto/convert-quote-to-order.dto';

function calculateTotal(items: QuoteItemDto[]): number {
  return items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
}

@Injectable()
export class QuotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly opportunitiesService: OpportunitiesService,
    private readonly webhooksService: WebhooksService,
    private readonly proposalPdfService: ProposalPdfService,
  ) {}

  // Proposta (spec §9/§11, expandida na spec v3.1/RF011): versionamento
  // simples — cada revisão é uma nova linha com version incremental, a
  // anterior fica congelada como histórico. `number` é o número comercial
  // (ex.: "PROP-2026-0001"), único por tenant — calculado aqui a partir da
  // contagem de propostas já existentes; não é perfeitamente à prova de
  // corrida sob concorrência extrema, mas o índice único parcial em
  // 0007_fase6_propostas.sql garante que uma colisão nunca seria salva
  // silenciosamente (o create() falharia e o usuário tentaria de novo).
  async create(user: AuthenticatedUser, dto: CreateQuoteDto) {
    await this.opportunitiesService.assertAccessible(user, dto.opportunityId);

    return this.prisma.runWithTenant(user.tenantId, async (tx) => {
      const [last, countForTenant] = await Promise.all([
        tx.quote.findFirst({
          where: { opportunityId: dto.opportunityId },
          orderBy: { version: 'desc' },
          select: { version: true },
        }),
        tx.quote.count({ where: { tenantId: user.tenantId } }),
      ]);

      const year = new Date().getFullYear();
      const number = `PROP-${year}-${String(countForTenant + 1).padStart(4, '0')}`;

      return tx.quote.create({
        data: {
          tenantId: user.tenantId,
          opportunityId: dto.opportunityId,
          version: (last?.version ?? 0) + 1,
          status: 'rascunho',
          totalValue: calculateTotal(dto.items),
          items: dto.items as unknown as object,
          number,
          validUntil: dto.validUntil ? new Date(dto.validUntil) : undefined,
          templateId: dto.templateId,
          createdBy: user.sub,
          updatedBy: user.sub,
        },
      });
    });
  }

  async findAll(user: AuthenticatedUser, opportunityId?: string) {
    const scope = ownerScopeWhere(user);

    return this.prisma.runWithTenant(user.tenantId, (tx) =>
      tx.quote.findMany({
        where: {
          tenantId: user.tenantId,
          ...(opportunityId ? { opportunityId } : {}),
          // ABAC (ownership.ts): vendedor só vê propostas de oportunidades
          // que são suas — `quotes` não tem ownerId próprio, então o filtro
          // é feito pela oportunidade relacionada.
          ...(scope.ownerId ? { opportunity: { ownerId: scope.ownerId } } : {}),
        },
        include: {
          opportunity: {
            select: {
              title: true,
              customer: { select: { id: true, name: true } },
            },
          },
          template: { select: { id: true, name: true } },
          // Fase 7 (RF012) — o frontend usa isso para decidir entre mostrar
          // "Converter em pedido" (nenhum pedido ainda) ou um link para o
          // pedido já existente (no máximo um, garantido pelo índice único
          // parcial em orders.quote_id, 0008).
          orders: { select: { id: true, status: true } },
        },
        orderBy: [{ createdAt: 'desc' }],
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
   * Aprova a proposta e marca a oportunidade como ganha, na mesma
   * transação. Até a Fase 6, aprovar também criava o Pedido automaticamente
   * — a partir da Fase 7 (spec v3.1, RF012) isso virou um passo explícito e
   * revisável (`convertToOrder()`), então aprovar não cria mais nada em
   * `orders`.
   */
  async approve(user: AuthenticatedUser, id: string) {
    const quote = await this.findAccessible(user, id);
    this.assertTransition(quote.status, 'enviada', 'aprovada');

    return this.prisma.runWithTenant(user.tenantId, async (tx) => {
      const approved = await tx.quote.update({
        where: { id },
        data: { status: 'aprovada', updatedBy: user.sub },
      });

      await tx.opportunity.update({
        where: { id: quote.opportunityId },
        data: { stage: 'fechado_ganho', updatedBy: user.sub },
      });

      return approved;
    });
  }

  /**
   * Converte uma proposta aprovada em Pedido (spec v3.1, RF012) — passo
   * explícito que substitui a conversão automática da Fase 1-6. Sem
   * `dto.items`/`dto.paymentTerms`/etc., o Pedido herda os valores da
   * própria proposta; informar `dto.items` permite revisar
   * quantidades/preços antes de confirmar. Só funciona uma vez por
   * proposta — o índice único parcial `idx_orders_quote_id_unique` (0008) é
   * a segunda camada de proteção contra converter a mesma proposta duas
   * vezes (a checagem abaixo é a primeira, mas tem uma janela de corrida
   * teórica entre o `findFirst` e o `create`).
   */
  async convertToOrder(
    user: AuthenticatedUser,
    id: string,
    dto: ConvertQuoteToOrderDto,
  ) {
    const quote = await this.findAccessible(user, id);

    if (quote.status !== 'aprovada') {
      throw new ConflictException(
        'Só é possível converter em pedido uma proposta aprovada',
      );
    }

    const items = dto.items ?? (quote.items as unknown as QuoteItemDto[]);
    const totalValue = dto.items
      ? calculateTotal(dto.items)
      : Number(quote.totalValue);

    const order = await this.prisma.runWithTenant(user.tenantId, async (tx) => {
      const alreadyConverted = await tx.order.findFirst({
        where: { quoteId: id },
        select: { id: true },
      });
      if (alreadyConverted) {
        throw new ConflictException(
          'Esta proposta já foi convertida em pedido',
        );
      }

      return tx.order.create({
        data: {
          tenantId: user.tenantId,
          quoteId: quote.id,
          customerId: quote.opportunity.customerId,
          status: 'confirmado',
          totalValue,
          items: items as unknown as object,
          deliveryDate: dto.deliveryDate
            ? new Date(dto.deliveryDate)
            : undefined,
          paymentTerms: dto.paymentTerms,
          internalNotes: dto.internalNotes,
          createdBy: user.sub,
          updatedBy: user.sub,
        },
      });
    });

    // Fora da transação de propósito: dispatch() é best-effort e nunca deve
    // poder fazer a conversão falhar/dar rollback por causa de um endpoint
    // de webhook fora do ar (mesmo raciocínio de sempre, spec Fase 3).
    await this.webhooksService.dispatch(user.tenantId, 'order.created', {
      orderId: order.id,
      customerId: order.customerId,
      totalValue: order.totalValue,
    });

    return order;
  }

  /**
   * "Apenas uma proposta pode ser marcada como vencedora" (spec v3.1) por
   * oportunidade — desmarca qualquer outra vencedora da mesma oportunidade
   * na mesma transação antes de marcar esta, então nunca existe (mesmo por
   * um instante) duas vencedoras ao mesmo tempo. O índice único parcial
   * `idx_quotes_one_winner_per_opportunity` (0007) garante isso também no
   * banco, como segunda camada.
   */
  async markWinner(user: AuthenticatedUser, id: string) {
    const quote = await this.findAccessible(user, id);

    return this.prisma.runWithTenant(user.tenantId, async (tx) => {
      await tx.quote.updateMany({
        where: { opportunityId: quote.opportunityId, isWinner: true },
        data: { isWinner: false },
      });

      return tx.quote.update({
        where: { id },
        data: { isWinner: true, updatedBy: user.sub },
      });
    });
  }

  /** Gera o PDF da proposta (spec v3.1, RF011) — ver ProposalPdfService. */
  async pdf(user: AuthenticatedUser, id: string): Promise<Buffer> {
    const quote = await this.prisma.runWithTenant(user.tenantId, async (tx) =>
      tx.quote.findFirst({
        where: { id, tenantId: user.tenantId },
        include: {
          opportunity: {
            select: {
              title: true,
              ownerId: true,
              customer: { select: { name: true } },
              owner: { select: { name: true } },
            },
          },
          template: true,
        },
      }),
    );

    if (!quote) {
      throw new NotFoundException('Proposta não encontrada');
    }
    assertOwnership(user, { ownerId: quote.opportunity.ownerId });

    const items = quote.items as unknown as QuoteItemDto[];

    return this.proposalPdfService.generate({
      number: quote.number,
      version: quote.version,
      status: quote.status,
      totalValue: Number(quote.totalValue),
      items,
      validUntil: quote.validUntil,
      createdAt: quote.createdAt,
      customerName: quote.opportunity.customer.name,
      opportunityTitle: quote.opportunity.title,
      ownerName: quote.opportunity.owner?.name ?? null,
      template: quote.template
        ? {
            name: quote.template.name,
            headerText: quote.template.headerText,
            footerText: quote.template.footerText,
            clauses: quote.template.clauses,
            primaryColor: quote.template.primaryColor,
          }
        : null,
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
