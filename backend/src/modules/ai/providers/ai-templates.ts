/**
 * Templates determinísticos que fraseiam, em português, os dados JÁ
 * computados pelo `AiService` a partir dos dados reais do tenant. É o que o
 * `DeterministicAiProvider` usa (sempre) e o que descreve, em código, todo o
 * "conhecimento" do assistente — não há nada aprendido, é texto fixo com
 * valores interpolados. Extraído para um módulo à parte (em vez de inline no
 * provider) para poder ser testado sem instanciar o Nest.
 */

/**
 * Extrai assunto/corpo de um rascunho de email no formato pedido ao
 * `AiProvider` ("Assunto: ...\n\n<corpo>"). O `DeterministicAiProvider`
 * sempre segue esse formato (é ele quem o define, ver `renderDraftEmail`);
 * o Ollama é instruído a seguir o mesmo formato, mas pode não obedecer —
 * neste caso, cai num assunto genérico com o texto inteiro como corpo em
 * vez de quebrar o endpoint.
 */
export function splitEmailDraft(text: string): {
  subject: string;
  body: string;
} {
  const lines = text.split('\n');
  const subjectMatch = (lines[0] ?? '').match(/^assunto:\s*(.+)$/i);
  if (subjectMatch) {
    const body = lines.slice(1).join('\n').replace(/^\n+/, '').trim();
    return { subject: subjectMatch[1].trim(), body };
  }
  return { subject: 'Follow-up', body: text.trim() };
}

export function formatBRL(value: number): string {
  return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Cada interface abaixo carrega `[key: string]: unknown` só para
 * satisfazer estruturalmente o parâmetro `Record<string, unknown>` de
 * `AiProvider.generateText` quando uma VARIÁVEL já tipada (em vez de um
 * objeto literal inline) é passada como argumento — limitação de
 * checagem de índice do TypeScript para `interface`, não um contrato a
 * mais que o restante do código precise respeitar.
 */
export interface OverdueThresholdContext {
  [key: string]: unknown; // ver nota acima de AiTemplateContext
  kind: 'ask.overdue-threshold';
  threshold: number;
  customers: { customerId: string; name: string; totalOverdue: number }[];
}

export interface CustomerNotFoundContext {
  [key: string]: unknown; // ver nota acima de AiTemplateContext
  kind: 'ask.customer-not-found';
  query: string;
}

export interface FallbackContext {
  [key: string]: unknown; // ver nota acima de AiTemplateContext
  kind: 'ask.fallback';
}

export interface CustomerSummaryContext {
  [key: string]: unknown; // ver nota acima de AiTemplateContext
  kind: 'customer.summary';
  name: string;
  status: string;
  segment: string | null;
  totalInvoiced: number;
  totalPaid: number;
  overdueAmount: number;
  openInvoicesCount: number;
  activeContractsCount: number;
  expiringSoonCount: number;
  openOpportunitiesCount: number;
  openOpportunitiesValue: number;
  openTicketsCount: number;
  scoreIa: { score: number; classification: string };
}

export interface ScoreIaContext {
  [key: string]: unknown; // ver nota acima de AiTemplateContext
  kind: 'customer.score-ia';
  name: string;
  score: number;
  classification: string;
}

export interface NextActionContext {
  [key: string]: unknown; // ver nota acima de AiTemplateContext
  kind: 'opportunity.next-action';
  title: string;
  customerName: string;
  stage: string;
  daysSinceLastActivity: number;
  value: number;
  suggestedAction: string;
  priority: string;
}

export interface DraftEmailContext {
  [key: string]: unknown; // ver nota acima de AiTemplateContext
  kind: 'opportunity.draft-email';
  customerName: string;
  contactName: string | null;
  opportunityTitle: string;
  stage: string;
  value: number;
}

export interface CollectionsSummaryContext {
  [key: string]: unknown; // ver nota acima de AiTemplateContext
  kind: 'finance.collections-summary';
  count: number;
  totalOverdueAmount: number;
  topCustomerName: string | null;
  topCustomerOverdue: number;
}

export interface PipelineForecastContext {
  [key: string]: unknown; // ver nota acima de AiTemplateContext
  kind: 'predictions.pipeline';
  forecastTotal: number;
  openCount: number;
  byStage: {
    stage: string;
    count: number;
    totalValue: number;
    winRate: number;
    weightedValue: number;
  }[];
}

export type AiTemplateContext =
  | OverdueThresholdContext
  | CustomerNotFoundContext
  | FallbackContext
  | CustomerSummaryContext
  | ScoreIaContext
  | NextActionContext
  | DraftEmailContext
  | CollectionsSummaryContext
  | PipelineForecastContext;

const FALLBACK_TEXT =
  'Ainda não sei responder isso. Hoje eu só entendo estes tipos de pergunta: ' +
  '"quais clientes possuem mais de R$X mil vencidos" (ou "vencido", com um ' +
  'valor em reais/mil) e "resuma a empresa X" / "resuma o cliente X". ' +
  'Reformule sua pergunta usando um desses formatos, ou use as telas de ' +
  'Financeiro/Cliente 360° diretamente. Prefiro dizer isso a inventar uma ' +
  'resposta sem dados reais por trás.';

/** Escolhe o template certo a partir de `context.kind` e monta o texto final. */
export function renderTemplate(context: AiTemplateContext): string {
  switch (context.kind) {
    case 'ask.overdue-threshold':
      return renderOverdueThreshold(context);
    case 'ask.customer-not-found':
      return `Não encontrei nenhum cliente com um nome parecido com "${context.query}". Confira a grafia ou veja a lista completa em Clientes.`;
    case 'ask.fallback':
      return FALLBACK_TEXT;
    case 'customer.summary':
      return renderCustomerSummary(context);
    case 'customer.score-ia':
      return renderScoreIa(context);
    case 'opportunity.next-action':
      return renderNextAction(context);
    case 'opportunity.draft-email':
      return renderDraftEmail(context);
    case 'finance.collections-summary':
      return renderCollectionsSummary(context);
    case 'predictions.pipeline':
      return renderPipelineForecast(context);
  }
}

function renderOverdueThreshold(ctx: OverdueThresholdContext): string {
  if (ctx.customers.length === 0) {
    return `Nenhum cliente acessível a você tem mais de ${formatBRL(ctx.threshold)} em faturas vencidas no momento.`;
  }
  const lines = ctx.customers
    .map(
      (c, i) => `${i + 1}. ${c.name} — ${formatBRL(c.totalOverdue)} vencidos`,
    )
    .join('\n');
  return `${ctx.customers.length} cliente(s) com mais de ${formatBRL(ctx.threshold)} em faturas vencidas:\n\n${lines}`;
}

function renderCustomerSummary(ctx: CustomerSummaryContext): string {
  const parts = [
    `${ctx.name} — status ${ctx.status}${ctx.segment ? `, segmento ${ctx.segment}` : ''}.`,
    `Score IA: ${ctx.scoreIa.score}/100 (${ctx.scoreIa.classification}).`,
    `Financeiro: ${formatBRL(ctx.totalPaid)} recebidos de ${formatBRL(ctx.totalInvoiced)} faturados, ${formatBRL(ctx.overdueAmount)} vencidos em ${ctx.openInvoicesCount} fatura(s) em aberto.`,
    `Contratos: ${ctx.activeContractsCount} ativo(s)${ctx.expiringSoonCount > 0 ? `, ${ctx.expiringSoonCount} vencendo em até 30 dias` : ''}.`,
    `Comercial: ${ctx.openOpportunitiesCount} oportunidade(s) em aberto somando ${formatBRL(ctx.openOpportunitiesValue)}.`,
    `Atendimento: ${ctx.openTicketsCount} chamado(s) em aberto.`,
  ];
  return parts.join(' ');
}

function renderScoreIa(ctx: ScoreIaContext): string {
  return `Score IA de ${ctx.name}: ${ctx.score}/100, classificação ${ctx.classification}.`;
}

function renderNextAction(ctx: NextActionContext): string {
  return (
    `Oportunidade "${ctx.title}" (${ctx.customerName}), estágio ${ctx.stage}, ` +
    `${formatBRL(ctx.value)}, ${ctx.daysSinceLastActivity} dia(s) sem atividade registrada. ` +
    `Próxima ação sugerida (prioridade ${ctx.priority}): ${ctx.suggestedAction}`
  );
}

function renderDraftEmail(ctx: DraftEmailContext): string {
  const greeting = ctx.contactName ? `Olá, ${ctx.contactName}` : 'Olá';
  const subject = `Assunto: Follow-up — ${ctx.opportunityTitle} (${ctx.customerName})`;
  const body = [
    `${greeting},`,
    '',
    `Escrevo para dar continuidade à nossa conversa sobre "${ctx.opportunityTitle}", ` +
      `atualmente na etapa de ${ctx.stage} e no valor de ${formatBRL(ctx.value)}.`,
    '',
    'Fico à disposição para esclarecer dúvidas, ajustar detalhes da proposta ' +
      'ou agendar uma conversa rápida para avançarmos.',
    '',
    'Aguardo seu retorno.',
    '',
    'Atenciosamente,',
  ].join('\n');
  return `${subject}\n\n${body}`;
}

function renderCollectionsSummary(ctx: CollectionsSummaryContext): string {
  if (ctx.count === 0) {
    return 'Nenhuma fatura vencida no momento — nenhuma ação de cobrança sugerida.';
  }
  const top =
    ctx.topCustomerName && ctx.topCustomerOverdue > 0
      ? ` O maior valor em atraso é de ${ctx.topCustomerName} (${formatBRL(ctx.topCustomerOverdue)}).`
      : '';
  return (
    `${ctx.count} fatura(s) vencida(s), somando ${formatBRL(ctx.totalOverdueAmount)}.` +
    `${top} Veja abaixo a lista priorizada com canal e prioridade sugeridos por fatura.`
  );
}

function renderPipelineForecast(ctx: PipelineForecastContext): string {
  if (ctx.openCount === 0) {
    return 'Não há oportunidades em aberto no pipeline no momento — previsão de fechamento é R$ 0,00.';
  }
  const byStage = ctx.byStage
    .filter((s) => s.count > 0)
    .map(
      (s) =>
        `${s.stage}: ${s.count} oportunidade(s), ${formatBRL(s.totalValue)} em aberto, taxa histórica assumida de ${(s.winRate * 100).toFixed(0)}% → ${formatBRL(s.weightedValue)} ponderado`,
    )
    .join('; ');
  return (
    `Previsão heurística de fechamento do pipeline: ${formatBRL(ctx.forecastTotal)}, ` +
    `a partir de ${ctx.openCount} oportunidade(s) em aberto. Por estágio: ${byStage}.`
  );
}
