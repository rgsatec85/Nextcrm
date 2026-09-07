import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { CustomersService } from '../customers/customers.service';
import { FinanceService } from '../finance/finance.service';
import { OpportunitiesService } from '../opportunities/opportunities.service';
import { ContractsService } from '../contracts/contracts.service';
import { InvoicesService } from '../invoices/invoices.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { AI_PROVIDER, AiProvider } from './providers/ai-provider.interface';
import {
  CollectionsSummaryContext,
  CustomerSummaryContext,
  DraftEmailContext,
  NextActionContext,
  PipelineForecastContext,
  ScoreIaContext,
  formatBRL,
  splitEmailDraft,
} from './providers/ai-templates';
import { fuzzyFindCustomer, parseQuestion } from './intent-parser';
import {
  ScoreIaSignals,
  SCORE_IA_WEIGHTS,
  computeRenewalSignal,
  computeSatisfactionSignal,
  computeScoreIa,
  computeTenureSignal,
  computeVolumeTrendSignal,
} from './scoring';
import { computeNextAction } from './next-action';
import { computeCollectionSuggestion } from './collections';
import { OPEN_PIPELINE_STAGES, winRateForStage } from './pipeline-forecast';
import { AskQuestionDto } from './dto/ask-question.dto';

// Mesmo padrão de ABAC do resto do CRM (ver common/crm/ownership.ts) —
// invoices/tickets/opportunities não têm todos um `ownerId` próprio; onde
// este service consulta o Prisma diretamente (em vez de delegar a outro
// service que já aplica o filtro), redeclara a constante localmente, igual
// a invoices/contracts/tickets.service.ts.
const OWNER_SCOPED_ROLES = ['vendedor'];

const DAY_MS = 24 * 60 * 60 * 1000;
const RECENT_WINDOW_DAYS = 90;

type OverdueInvoiceRow = {
  customerId: string;
  amount: unknown;
  paidAmount: unknown;
  customer: { name: string };
};

type ScorePaidInvoiceRow = {
  paidAmount: unknown;
  paidAt: Date | null;
};

type ActivityRow = {
  scheduledAt: Date | null;
  doneAt: Date | null;
  createdAt: Date;
};

// `CustomersService.findOne`/`OpportunitiesService.findOne` passam um
// callback NÃO-async para `runWithTenant` (`(tx) => tx.model.findFirst(...)`,
// ver seus respectivos arquivos) — o quirk de inferência do client stub do
// Prisma (documentado em docs/setup.md) faz o retorno colapsar para `{}` em
// vez de `any` nesse caso específico. Em vez de tocar nesses services já
// verificados de fases anteriores só por causa de um consumidor novo, este
// module redeclara aqui só os campos que efetivamente lê, e faz um cast
// único no ponto de chamada.
type CustomerFor360 = {
  name: string;
  status: string;
  segment: string | null;
  invoices: {
    amount: unknown;
    paidAmount: unknown;
    dueDate: Date;
    status: string;
  }[];
  contracts: { status: string; endDate: Date }[];
  opportunities: { stage: string; value: unknown }[];
};

type OpportunityDetail = {
  title: string;
  stage: string;
  value: unknown;
  createdAt: Date;
  customer: { id: string; name: string };
  activities: ActivityRow[];
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  // Nome do provider CONFIGURADO (env AI_PROVIDER), gravado em ai_query_logs
  // para auditoria. Não reflete um eventual fallback interno e silencioso
  // do OllamaAiProvider para o determinístico (ver
  // providers/ollama-ai.provider.ts) — decisão documentada em
  // docs/fase4-ia-corporativa.md: saber "estava configurado para usar
  // Ollama" já cobre a necessidade de auditoria deste projeto, sem exigir
  // que o provider devolva metadado extra só para isso.
  private readonly configuredProviderName: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly customersService: CustomersService,
    private readonly financeService: FinanceService,
    private readonly opportunitiesService: OpportunitiesService,
    private readonly contractsService: ContractsService,
    private readonly invoicesService: InvoicesService,
    private readonly config: ConfigService,
    @Inject(AI_PROVIDER) private readonly aiProvider: AiProvider,
  ) {
    this.configuredProviderName = (
      this.config.get<string>('AI_PROVIDER') ?? 'deterministic'
    ).toLowerCase();
  }

  /**
   * `POST /ai/ask` (spec Fase 4). Roteia para um dos dois formatos de
   * pergunta suportados (ver intent-parser.ts) ou devolve o fallback
   * honesto. Nunca tenta "adivinhar" fora desses formatos.
   */
  async ask(user: AuthenticatedUser, dto: AskQuestionDto) {
    const intent = parseQuestion(dto.question);

    let intentLabel: string;
    let answer: string;
    let data: Record<string, unknown> | undefined;

    if (intent.type === 'overdue_threshold') {
      const customers = await this.customersWithOverdueAbove(
        user,
        intent.thresholdReais,
      );
      answer = await this.aiProvider.generateText(
        'Liste, em texto corrido, os clientes com faturas vencidas acima do limite informado, com os valores de cada um.',
        {
          kind: 'ask.overdue-threshold',
          threshold: intent.thresholdReais,
          customers,
        },
      );
      intentLabel = 'overdue_threshold';
      data = { threshold: intent.thresholdReais, customers };
    } else if (intent.type === 'summarize_customer') {
      const customers = await this.customersService.findAll(user);
      const match = fuzzyFindCustomer(
        customers as { id: string; name: string }[],
        intent.nameQuery,
      );

      if (!match) {
        answer = await this.aiProvider.generateText(
          'Explique, educadamente, que nenhum cliente foi encontrado com esse nome.',
          { kind: 'ask.customer-not-found', query: intent.nameQuery },
        );
        intentLabel = 'customer_not_found';
      } else {
        const summary = await this.customerSummary(user, match.id);
        answer = summary.summary;
        intentLabel = 'customer_summary';
        data = { customerId: match.id };
      }
    } else {
      answer = await this.aiProvider.generateText(
        'Explique, de forma honesta e sem inventar capacidades, quais tipos de pergunta este assistente entende hoje.',
        { kind: 'ask.fallback' },
      );
      intentLabel = 'unrecognized';
    }

    await this.logQuery(user, dto.question, intentLabel, answer);

    return { intent: intentLabel, answer, data };
  }

  /**
   * `GET /ai/customers/:id/summary`. Reaproveita o Cliente 360° existente
   * (`CustomersService.findOne`, já ABAC-scoped) em vez de duplicar as
   * queries, e delega o Score IA a `scoreIa()`.
   */
  async customerSummary(user: AuthenticatedUser, customerId: string) {
    const customer = (await this.customersService.findOne(
      user,
      customerId,
    )) as unknown as CustomerFor360;
    const scoreIaResult = await this.scoreIa(user, customerId);

    const now = Date.now();
    const invoices = customer.invoices;
    const totalInvoiced = invoices.reduce((s, i) => s + Number(i.amount), 0);
    const totalPaid = invoices.reduce((s, i) => s + Number(i.paidAmount), 0);
    const openInvoices = invoices.filter(
      (i) => i.status === 'aberto' || i.status === 'parcial',
    );
    const overdueAmount = openInvoices
      .filter((i) => new Date(i.dueDate).getTime() < now)
      .reduce((s, i) => s + (Number(i.amount) - Number(i.paidAmount)), 0);

    const contracts = customer.contracts;
    const activeContractsCount = contracts.filter(
      (c) => c.status === 'ativo' || c.status === 'renovado',
    ).length;
    const expiringSoonCount = contracts.filter(
      (c) =>
        c.status === 'ativo' &&
        Math.ceil((new Date(c.endDate).getTime() - now) / DAY_MS) <= 30,
    ).length;

    const opportunities = customer.opportunities;
    const openOpportunities = opportunities.filter(
      (o) => o.stage !== 'fechado_ganho' && o.stage !== 'fechado_perdido',
    );
    const openOpportunitiesValue = openOpportunities.reduce(
      (s, o) => s + Number(o.value),
      0,
    );

    const openTicketsCount = await this.countOpenTickets(user, customerId);

    const context: CustomerSummaryContext = {
      kind: 'customer.summary',
      name: customer.name,
      status: customer.status,
      segment: customer.segment,
      totalInvoiced: round2(totalInvoiced),
      totalPaid: round2(totalPaid),
      overdueAmount: round2(overdueAmount),
      openInvoicesCount: openInvoices.length,
      activeContractsCount,
      expiringSoonCount,
      openOpportunitiesCount: openOpportunities.length,
      openOpportunitiesValue: round2(openOpportunitiesValue),
      openTicketsCount,
      scoreIa: {
        score: scoreIaResult.score,
        classification: scoreIaResult.classification,
      },
    };

    const summary = await this.aiProvider.generateText(
      'Escreva um resumo executivo em texto corrido deste cliente, cobrindo financeiro, contratos, comercial e atendimento.',
      context,
    );

    return { customerId, summary, data: context };
  }

  /**
   * `GET /ai/customers/:id/score-ia` — o Score IA de verdade da Fase 4 (spec:
   * "Cálculo do Score IA de verdade... substituindo a heurística
   * determinística da Fase 2"). Continua sendo determinístico e transparente
   * (não há dataset rotulado nem infraestrutura de treino neste projeto) —
   * é um modelo ponderado sobre mais sinais que o Score Financeiro da Fase
   * 2, pronto para ser trocado por um modelo treinado depois, sem mudar o
   * contrato do endpoint. Ver scoring.ts para os pesos e
   * docs/fase4-ia-corporativa.md para a justificativa completa.
   */
  async scoreIa(user: AuthenticatedUser, customerId: string) {
    await this.customersService.assertAccessible(user, customerId);

    // Sinal 1 e 2: reusa o Score Financeiro da Fase 2 (pontualidade e
    // inadimplência) em vez de recalcular a mesma coisa duas vezes — ver
    // doc-comment de FinanceService.customerScore.
    const financeScore = await this.financeService.customerScore(
      user,
      customerId,
    );

    const now = Date.now();
    const recentCutoff = now - RECENT_WINDOW_DAYS * DAY_MS;
    const priorCutoff = now - 2 * RECENT_WINDOW_DAYS * DAY_MS;

    const paidInvoices: ScorePaidInvoiceRow[] = await this.prisma.runWithTenant(
      user.tenantId,
      async (tx) =>
        tx.invoice.findMany({
          where: {
            tenantId: user.tenantId,
            customerId,
            status: 'pago',
            paidAt: { not: null },
          },
          select: { paidAmount: true, paidAt: true },
        }),
    );

    let recentPaid = 0;
    let priorPaid = 0;
    for (const inv of paidInvoices) {
      if (!inv.paidAt) continue;
      const t = inv.paidAt.getTime();
      if (t >= recentCutoff) {
        recentPaid += Number(inv.paidAmount);
      } else if (t >= priorCutoff) {
        priorPaid += Number(inv.paidAmount);
      }
    }

    const recentTickets: { priority: string }[] =
      await this.prisma.runWithTenant(user.tenantId, async (tx) =>
        tx.ticket.findMany({
          where: {
            tenantId: user.tenantId,
            customerId,
            createdAt: { gte: new Date(now - 180 * DAY_MS) },
          },
          select: { priority: true },
        }),
      );

    const contracts = await this.contractsService.findAll(user, customerId);
    const totalContracts = contracts.length;
    const renewedContracts = contracts.filter(
      (c: { status: string }) => c.status === 'renovado',
    ).length;

    const signals: ScoreIaSignals = {
      punctuality: financeScore.punctualityRate ?? 0.5,
      overdueHealth: 1 - Math.min(financeScore.delinquencyRate, 1),
      volumeTrend: computeVolumeTrendSignal(recentPaid, priorPaid),
      tenure: computeTenureSignal(financeScore.relationshipDays),
      satisfaction: computeSatisfactionSignal(recentTickets),
      renewal: computeRenewalSignal(totalContracts, renewedContracts),
    };

    const { score, classification } = computeScoreIa(signals);
    const name = await this.getCustomerName(user, customerId);

    const narrative = await this.aiProvider.generateText(
      'Explique em uma frase curta o Score IA deste cliente.',
      {
        kind: 'customer.score-ia',
        name,
        score,
        classification,
      } as ScoreIaContext,
    );

    return {
      customerId,
      score,
      classification,
      signals,
      weights: SCORE_IA_WEIGHTS,
      narrative,
    };
  }

  /** `GET /ai/opportunities/:id/next-action`. */
  async nextAction(user: AuthenticatedUser, opportunityId: string) {
    const opportunity = (await this.opportunitiesService.findOne(
      user,
      opportunityId,
    )) as unknown as OpportunityDetail;

    const lastActivityAt = this.mostRecentActivityDate(
      opportunity.activities,
      opportunity.createdAt,
    );
    const daysSinceLastActivity = Math.floor(
      (Date.now() - lastActivityAt.getTime()) / DAY_MS,
    );
    const value = Number(opportunity.value);

    const { suggestedAction, priority } = computeNextAction(
      opportunity.stage,
      daysSinceLastActivity,
      value,
    );

    const narrative = await this.aiProvider.generateText(
      'Explique, em uma frase, a próxima ação sugerida para esta oportunidade.',
      {
        kind: 'opportunity.next-action',
        title: opportunity.title,
        customerName: opportunity.customer.name,
        stage: opportunity.stage,
        daysSinceLastActivity,
        value,
        suggestedAction,
        priority,
      } as NextActionContext,
    );

    return {
      opportunityId,
      stage: opportunity.stage,
      daysSinceLastActivity,
      value,
      suggestedAction,
      priority,
      narrative,
    };
  }

  /** `POST /ai/opportunities/:id/draft-email`. */
  async draftEmail(user: AuthenticatedUser, opportunityId: string) {
    const opportunity = (await this.opportunitiesService.findOne(
      user,
      opportunityId,
    )) as unknown as OpportunityDetail;
    const contact = await this.getPrimaryContact(user, opportunity.customer.id);

    const context: DraftEmailContext = {
      kind: 'opportunity.draft-email',
      customerName: opportunity.customer.name,
      contactName: contact?.name ?? null,
      opportunityTitle: opportunity.title,
      stage: opportunity.stage,
      value: Number(opportunity.value),
    };

    const text = await this.aiProvider.generateText(
      'Escreva um rascunho de email de follow-up para esta oportunidade. A primeira linha deve começar exatamente com "Assunto: ", seguida de uma linha em branco e o corpo do email.',
      context,
    );

    const { subject, body } = splitEmailDraft(text);
    return { opportunityId, subject, body };
  }

  /**
   * `GET /ai/finance/collections-suggestions` (spec Fase 4 — "cobrança
   * inteligente"). Estende a listagem de faturas vencidas da Fase 2
   * (`InvoicesService.findAll`, já ABAC-scoped — vendedor só vê as suas) com
   * prioridade/canal sugeridos por fatura. A frase-resumo passa pelo
   * `AiProvider` uma única vez (agregada), não por fatura — evitar N
   * chamadas de "IA" para uma lista que pode ter dezenas de itens é uma
   * decisão de custo/latência, documentada em
   * docs/fase4-ia-corporativa.md.
   */
  async collectionsSuggestions(user: AuthenticatedUser) {
    const invoices = await this.invoicesService.findAll(user, {
      overdueOnly: true,
    });

    const now = Date.now();
    const suggestions = (
      invoices as {
        id: string;
        customerId: string;
        amount: unknown;
        paidAmount: unknown;
        dueDate: string | Date;
        customer?: { name: string };
      }[]
    )
      .map((inv) => {
        const remaining = round2(Number(inv.amount) - Number(inv.paidAmount));
        const daysOverdue = Math.floor(
          (now - new Date(inv.dueDate).getTime()) / DAY_MS,
        );
        const { priority, channel } = computeCollectionSuggestion(daysOverdue);
        const customerName = inv.customer?.name ?? 'cliente sem nome';
        return {
          invoiceId: inv.id,
          customerId: inv.customerId,
          customerName,
          remaining,
          daysOverdue,
          priority,
          channel,
          suggestedAction: `Contatar ${customerName} por ${channel} — ${daysOverdue} dia(s) em atraso, saldo ${formatBRL(remaining)}.`,
        };
      })
      .sort(
        (a, b) => b.daysOverdue * b.remaining - a.daysOverdue * a.remaining,
      );

    const totalOverdueAmount = round2(
      suggestions.reduce((s, i) => s + i.remaining, 0),
    );
    const top = suggestions[0];

    const narrative = await this.aiProvider.generateText(
      'Escreva um resumo de uma frase sobre a situação atual de cobrança.',
      {
        kind: 'finance.collections-summary',
        count: suggestions.length,
        totalOverdueAmount,
        topCustomerName: top?.customerName ?? null,
        topCustomerOverdue: top?.remaining ?? 0,
      } as CollectionsSummaryContext,
    );

    return {
      generatedAt: new Date().toISOString(),
      count: suggestions.length,
      totalOverdueAmount,
      narrative,
      suggestions,
    };
  }

  /**
   * `GET /ai/predictions/pipeline` (spec Fase 4). Previsão heurística — ver
   * pipeline-forecast.ts para os pesos assumidos e por quê.
   */
  async pipelineForecast(user: AuthenticatedUser) {
    const opportunities = await this.opportunitiesService.findAll(user);

    const openOpportunities = (
      opportunities as { stage: string; value: unknown }[]
    ).filter((o) => OPEN_PIPELINE_STAGES.includes(o.stage));

    const totalsByStage = new Map<
      string,
      { count: number; totalValue: number }
    >();
    for (const stage of OPEN_PIPELINE_STAGES) {
      totalsByStage.set(stage, { count: 0, totalValue: 0 });
    }
    for (const o of openOpportunities) {
      const entry = totalsByStage.get(o.stage) ?? { count: 0, totalValue: 0 };
      entry.count += 1;
      entry.totalValue += Number(o.value);
      totalsByStage.set(o.stage, entry);
    }

    const byStage = OPEN_PIPELINE_STAGES.map((stage) => {
      const entry = totalsByStage.get(stage) ?? { count: 0, totalValue: 0 };
      const winRate = winRateForStage(stage);
      const weightedValue = round2(entry.totalValue * winRate);
      return {
        stage,
        count: entry.count,
        totalValue: round2(entry.totalValue),
        winRate,
        weightedValue,
      };
    });

    const forecastTotal = round2(
      byStage.reduce((s, b) => s + b.weightedValue, 0),
    );

    const narrative = await this.aiProvider.generateText(
      'Explique a previsão de fechamento do pipeline em texto corrido, mencionando que é uma estimativa heurística.',
      {
        kind: 'predictions.pipeline',
        forecastTotal,
        openCount: openOpportunities.length,
        byStage,
      } as PipelineForecastContext,
    );

    return {
      forecastTotal,
      openCount: openOpportunities.length,
      byStage,
      narrative,
    };
  }

  // --- helpers privados -------------------------------------------------

  private async customersWithOverdueAbove(
    user: AuthenticatedUser,
    thresholdReais: number,
  ): Promise<{ customerId: string; name: string; totalOverdue: number }[]> {
    const rows: OverdueInvoiceRow[] = await this.prisma.runWithTenant(
      user.tenantId,
      async (tx) =>
        tx.invoice.findMany({
          where: {
            tenantId: user.tenantId,
            status: { in: ['aberto', 'parcial'] },
            dueDate: { lt: new Date() },
            ...(OWNER_SCOPED_ROLES.includes(user.roleSlug)
              ? { customer: { ownerId: user.sub } }
              : {}),
          },
          select: {
            customerId: true,
            amount: true,
            paidAmount: true,
            customer: { select: { name: true } },
          },
        }),
    );

    const totals = new Map<string, { name: string; total: number }>();
    for (const row of rows) {
      const remaining = Number(row.amount) - Number(row.paidAmount);
      if (remaining <= 0.01) continue;
      const entry = totals.get(row.customerId) ?? {
        name: row.customer.name,
        total: 0,
      };
      entry.total += remaining;
      totals.set(row.customerId, entry);
    }

    return Array.from(totals.entries())
      .map(([customerId, { name, total }]) => ({
        customerId,
        name,
        totalOverdue: round2(total),
      }))
      .filter((c) => c.totalOverdue > thresholdReais)
      .sort((a, b) => b.totalOverdue - a.totalOverdue);
  }

  private async countOpenTickets(
    user: AuthenticatedUser,
    customerId: string,
  ): Promise<number> {
    return this.prisma.runWithTenant(user.tenantId, async (tx) =>
      tx.ticket.count({
        where: {
          tenantId: user.tenantId,
          customerId,
          status: { notIn: ['resolvido', 'fechado'] },
        },
      }),
    );
  }

  private async getCustomerName(
    user: AuthenticatedUser,
    customerId: string,
  ): Promise<string> {
    const row: { name: string } | null = await this.prisma.runWithTenant(
      user.tenantId,
      async (tx) =>
        tx.customer.findFirst({
          where: { id: customerId, tenantId: user.tenantId },
          select: { name: true },
        }),
    );
    return row?.name ?? 'Cliente';
  }

  private async getPrimaryContact(
    user: AuthenticatedUser,
    customerId: string,
  ): Promise<{ name: string } | null> {
    return this.prisma.runWithTenant(user.tenantId, async (tx) =>
      tx.contact.findFirst({
        where: { tenantId: user.tenantId, customerId },
        orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
        select: { name: true },
      }),
    );
  }

  private mostRecentActivityDate(
    activities: ActivityRow[],
    fallback: Date,
  ): Date {
    const dates = activities
      .map((a) => a.doneAt ?? a.scheduledAt ?? a.createdAt)
      .filter((d): d is Date => d instanceof Date);
    if (dates.length === 0) return fallback;
    return new Date(Math.max(...dates.map((d) => d.getTime())));
  }

  /**
   * Grava a auditoria específica do assistente (`ai_query_logs`,
   * migration 0005). Best-effort — mesma filosofia de
   * `WebhooksService.dispatch`/`AuditLogInterceptor`: uma falha ao gravar
   * nunca deve derrubar a resposta já calculada para o usuário.
   */
  private async logQuery(
    user: AuthenticatedUser,
    question: string,
    intent: string,
    answer: string,
  ): Promise<void> {
    try {
      await this.prisma.runWithTenant(user.tenantId, async (tx) =>
        tx.aiQueryLog.create({
          data: {
            tenantId: user.tenantId,
            userId: user.sub,
            question,
            intent,
            answer,
            provider: this.configuredProviderName,
          },
        }),
      );
    } catch (err) {
      this.logger.warn(`Falha ao gravar ai_query_log: ${String(err)}`);
    }
  }
}
