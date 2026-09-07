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
