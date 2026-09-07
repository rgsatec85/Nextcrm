/**
 * Cliente para o backend NestJS, usado apenas em código server-side
 * (route handlers e server components). O token JWT nunca chega ao
 * JavaScript do browser — fica em um cookie httpOnly (ver as route handlers
 * em app/api/auth/), o que reduz a superfície de XSS (spec §17).
 */

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:3001/api';

export class BackendError extends Error {
  constructor(
    public status: number,
    public body: unknown,
  ) {
    super(`Backend respondeu ${status}`);
  }
}

async function request<T>(
  path: string,
  init: RequestInit & { token?: string } = {},
): Promise<T> {
  const { token, headers, ...rest } = init;

  const res = await fetch(`${BACKEND_URL}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    cache: 'no-store',
  });

  const contentType = res.headers.get('content-type') ?? '';
  const body = contentType.includes('application/json')
    ? await res.json()
    : await res.text();

  if (!res.ok) {
    throw new BackendError(res.status, body);
  }

  return body as T;
}

export interface SignupPayload {
  companyName: string;
  cnpj: string;
  adminName: string;
  adminEmail: string;
  adminPassword: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface AuthResponse {
  accessToken: string;
  user: { id: string; name: string; email: string; role: string };
  company?: { id: string; name: string };
}

// --- Fase 1 — CRM Comercial -------------------------------------------------
// Tipos mínimos para o que as páginas server-side realmente leem — não são um
// espelho 1:1 do schema Prisma (ex.: Decimal chega serializado como string ou
// number, dependendo do driver, então os campos monetários aceitam ambos).

export interface Customer {
  id: string;
  name: string;
  document: string | null;
  segment: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  notes: string | null;
  status: string;
  ownerId: string | null;
  createdAt: string;
  // Refinamento de UI (0006_fase_ui_cadastro_cliente.sql).
  tradeName: string | null;
  stateRegistration: string | null;
  municipalRegistration: string | null;
  personType: string;
  subsegment: string | null;
  companySize: string | null;
  leadSource: string | null;
  isStrategicAccount: boolean;
}

export interface Contact {
  id: string;
  customerId: string;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  isPrimary: boolean;
}

export interface Quote {
  id: string;
  opportunityId: string;
  version: number;
  status: string;
  totalValue: string | number;
  items: Array<{ description: string; quantity: number; unitPrice: number }>;
  createdAt: string;
  // Fase 6 (spec v3.1) — Propostas como entidade própria.
  number: string | null;
  validUntil: string | null;
  templateId: string | null;
  isWinner: boolean;
  // Fase 7 (spec v3.1, RF012) — no máximo um pedido por proposta (índice
  // único parcial em orders.quote_id, 0008); a UI usa isso para decidir
  // entre mostrar "Converter em pedido" ou o status do pedido já criado.
  orders: Array<{ id: string; status: string }>;
}

export interface OpportunityWithQuotes {
  id: string;
  customerId: string;
  title: string;
  stage: string;
  value: string | number;
  expectedCloseDate: string | null;
  notes: string | null;
  ownerId: string | null;
  createdAt: string;
  quotes: Quote[];
}

export interface OpportunityWithCustomer {
  id: string;
  customerId: string;
  title: string;
  stage: string;
  value: string | number;
  ownerId: string | null;
  createdAt: string;
  customer: { id: string; name: string };
}

export interface Order {
  id: string;
  quoteId: string | null;
  customerId: string;
  status: string;
  totalValue: string | number;
  createdAt: string;
  // Fase 7 (spec v3.1, RF012) — gestão ampliada de Pedido. `items` vem nulo
  // em pedidos criados antes desta coluna existir (conversão automática das
  // Fases 1-6).
  deliveryDate: string | null;
  paymentTerms: string | null;
  internalNotes: string | null;
  items: Array<{ description: string; quantity: number; unitPrice: number }> | null;
}

export interface Activity {
  id: string;
  customerId: string | null;
  opportunityId: string | null;
  type: string;
  notes: string | null;
  scheduledAt: string | null;
  // Fase 8 (RF016) — fim do compromisso; só presente junto de scheduledAt
  // quando a atividade é um "slot" de calendário (sujeito a conflito).
  endAt: string | null;
  doneAt: string | null;
  createdAt: string;
  createdBy: string | null;
}

// Fase 8 (RF016) — bloqueio pessoal de período na agenda de um usuário.
export interface AgendaBlock {
  id: string;
  userId: string;
  startsAt: string;
  endsAt: string;
  reason: string | null;
  createdAt: string;
}

// --- Fase 2 — Módulo Financeiro ---------------------------------------------

export interface Invoice {
  id: string;
  customerId: string;
  orderId: string | null;
  installmentNumber: number;
  totalInstallments: number;
  amount: string | number;
  paidAmount: string | number;
  dueDate: string;
  paidAt: string | null;
  paymentMethod: string | null;
  status: string;
  isOverdue: boolean;
  customer?: { id: string; name: string };
}

export interface Contract {
  id: string;
  customerId: string;
  title: string;
  value: string | number;
  startDate: string;
  endDate: string;
  renewalPeriodMonths: number | null;
  status: string;
  daysUntilExpiration: number;
  expiringSoon: boolean;
  customer?: { id: string; name: string };
}

export interface FinanceDashboard {
  totalReceivable: number;
  totalReceived: number;
  totalOverdue: number;
  overdueCount: number;
  cashflow: Array<{ month: string; expected: number; received: number }>;
}

export interface CustomerScore {
  customerId: string;
  classification: 'verde' | 'amarelo' | 'vermelho';
  punctualityRate: number | null;
  delinquencyRate: number;
  totalPaid: number;
  totalInvoicedAmount: number;
  overdueAmount: number;
  relationshipDays: number;
}

export interface CommissionRow {
  ownerId: string;
  ownerName: string;
  totalPaid: number;
  commissionRate: number;
  commissionAmount: number;
}

export interface CustomerDetail extends Customer {
  contacts: Contact[];
  opportunities: OpportunityWithQuotes[];
  orders: Order[];
  activities: Activity[];
  invoices: Invoice[];
  contracts: Contract[];
}

// --- Fase 3 — Portal do Cliente e Atendimento -------------------------------

export interface TicketComment {
  id: string;
  ticketId: string;
  authorId: string | null;
  authorType: 'interno' | 'cliente';
  body: string;
  createdAt: string;
}

export interface Ticket {
  id: string;
  customerId: string;
  subject: string;
  description: string | null;
  status: string;
  priority: string;
  slaDueAt: string;
  assignedTo: string | null;
  createdAt: string;
  customer?: { id: string; name: string };
  comments?: TicketComment[];
}

export interface KnowledgeArticle {
  id: string;
  title: string;
  slug: string;
  body: string;
  category: string | null;
  isPublished: boolean;
  createdAt: string;
}

export interface WebhookSubscription {
  id: string;
  url: string;
  events: string[];
  isActive: boolean;
  createdAt: string;
}

export interface PortalLogin {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  lastLoginAt?: string | null;
  createdAt: string;
}

export interface PortalCustomer {
  id: string;
  name: string;
  document: string | null;
  segment: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  status: string;
  createdAt: string;
}

// --- Fase 4 — Inteligência Artificial Corporativa --------------------------
// Mesma ressalva de sempre: tipos mínimos para o que as páginas server-side
// realmente leem. `narrative`/`summary`/`answer` são texto já pronto,
// fraseado pelo AiProvider (determinístico neste ambiente) a partir de
// números computados pelo backend — nunca inventados no frontend.

export interface AiAskResponse {
  intent: string;
  answer: string;
  data?: Record<string, unknown>;
}

export interface AiCustomerSummary {
  customerId: string;
  summary: string;
}

export interface AiScoreIa {
  customerId: string;
  score: number;
  classification: 'verde' | 'amarelo' | 'vermelho';
  signals: Record<string, number>;
  weights: Record<string, number>;
  narrative: string;
}

export interface AiNextAction {
  opportunityId: string;
  stage: string;
  daysSinceLastActivity: number;
  value: number;
  suggestedAction: string;
  priority: 'baixa' | 'media' | 'alta' | 'urgente';
  narrative: string;
}

export interface AiDraftEmail {
  opportunityId: string;
  subject: string;
  body: string;
}

export interface AiCollectionSuggestion {
  invoiceId: string;
  customerId: string;
  customerName: string;
  remaining: number;
  daysOverdue: number;
  priority: 'baixa' | 'media' | 'alta' | 'critica';
  channel: string;
  suggestedAction: string;
}

export interface AiCollectionsSuggestions {
  generatedAt: string;
  count: number;
  totalOverdueAmount: number;
  narrative: string;
  suggestions: AiCollectionSuggestion[];
}

export interface AiPipelineForecastStage {
  stage: string;
  count: number;
  totalValue: number;
  winRate: number;
  weightedValue: number;
}

export interface AiPipelineForecast {
  forecastTotal: number;
  openCount: number;
  byStage: AiPipelineForecastStage[];
  narrative: string;
}

// --- Fase 6 — Propostas como entidade própria (spec v3.1, RF011) -----------

export interface ProposalTemplate {
  id: string;
  name: string;
  category: string | null;
  logoUrl: string | null;
  primaryColor: string | null;
  headerText: string | null;
  footerText: string | null;
  clauses: string | null;
  isActive: boolean;
  createdAt: string;
}

// Formato de retorno de GET /quotes (lista global, fora do Cliente 360°) —
// inclui os dados aninhados que só fazem sentido fora do contexto de uma
// oportunidade específica (nome do cliente/oportunidade, modelo usado).
export interface QuoteWithDetails extends Quote {
  opportunity: { title: string; customer: { id: string; name: string } };
  template: { id: string; name: string } | null;
}

// --- Fase 7 — Pedido: conversão explícita e gestão ampliada (RF012) --------

// Formato de retorno de GET /orders (lista global) — inclui cliente e, se
// houver, o número da proposta de origem (`null` num pedido manual, sem
// `quoteId`).
export interface OrderWithDetails extends Order {
  customer: { id: string; name: string };
  quote: { id: string; number: string | null } | null;
}

export const backend = {
  signup: (payload: SignupPayload) =>
    request<AuthResponse>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  login: (payload: LoginPayload) =>
    request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  me: (token: string) => request('/auth/me', { token }),

  myCompany: (token: string) => request('/tenants/me', { token }),

  users: (token: string) => request('/users', { token }),

  // Fase 1 — CRM Comercial. Só leituras: criação/edição acontece client-side
  // via o proxy autenticado em app/api/crm/[...path], que já injeta o cookie.
  customers: (token: string) => request<Customer[]>('/customers', { token }),

  customer: (token: string, id: string) =>
    request<CustomerDetail>(`/customers/${id}`, { token }),

  opportunities: (token: string, customerId?: string) =>
    request<OpportunityWithCustomer[]>(
      `/opportunities${customerId ? `?customerId=${customerId}` : ''}`,
      { token },
    ),

  // Fase 2 — Módulo Financeiro. dashboard/commissions são restritos por role
  // no backend (RolesGuard) — as páginas tratam o 403 com uma mensagem
  // amigável em vez de deixar a exceção estourar (ver BackendError).
  financeDashboard: (token: string) =>
    request<FinanceDashboard>('/finance/dashboard', { token }),

  customerScore: (token: string, customerId: string) =>
    request<CustomerScore>(`/finance/customers/${customerId}/score`, { token }),

  commissions: (token: string) =>
    request<CommissionRow[]>('/finance/commissions', { token }),

  invoicesOverdue: (token: string) =>
    request<Invoice[]>('/invoices?overdueOnly=true', { token }),

  contracts: (token: string) => request<Contract[]>('/contracts', { token }),

  // Fase 3 — Atendimento interno (tickets/knowledge/webhooks). Escritas
  // acontecem client-side via os proxies autenticados em app/api/crm/ e
  // app/api/portal/, mesmo padrão da Fase 1/2.
  tickets: (token: string, filters?: { customerId?: string; status?: string }) => {
    const params = new URLSearchParams();
    if (filters?.customerId) params.set('customerId', filters.customerId);
    if (filters?.status) params.set('status', filters.status);
    const qs = params.toString();
    return request<Ticket[]>(`/tickets${qs ? `?${qs}` : ''}`, { token });
  },

  ticket: (token: string, id: string) => request<Ticket>(`/tickets/${id}`, { token }),

  knowledgeArticles: (token: string) => request<KnowledgeArticle[]>('/knowledge', { token }),

  webhookSubscriptions: (token: string) =>
    request<WebhookSubscription[]>('/webhooks', { token }),

  portalLogins: (token: string, customerId: string) =>
    request<PortalLogin[]>(`/customers/${customerId}/portal-logins`, { token }),

  // Fase 3 — Portal do Cliente (hard-scoped ao próprio cliente no backend).
  portalMe: (token: string) => request<PortalCustomer>('/portal/me', { token }),

  portalOrders: (token: string) => request<Order[]>('/portal/orders', { token }),

  portalInvoices: (token: string) => request<Invoice[]>('/portal/invoices', { token }),

  portalContracts: (token: string) => request<Contract[]>('/portal/contracts', { token }),

  portalTickets: (token: string) => request<Ticket[]>('/portal/tickets', { token }),

  portalKnowledge: (token: string) =>
    request<KnowledgeArticle[]>('/portal/knowledge', { token }),

  // Fase 4 — Inteligência Artificial Corporativa. Só leituras aqui também —
  // `POST /ai/ask` e `POST /ai/opportunities/:id/draft-email` acontecem
  // client-side via o proxy `/api/crm/ai/...`, mesmo padrão do resto do CRM.
  aiCustomerSummary: (token: string, customerId: string) =>
    request<AiCustomerSummary>(`/ai/customers/${customerId}/summary`, { token }),

  aiScoreIa: (token: string, customerId: string) =>
    request<AiScoreIa>(`/ai/customers/${customerId}/score-ia`, { token }),

  aiNextAction: (token: string, opportunityId: string) =>
    request<AiNextAction>(`/ai/opportunities/${opportunityId}/next-action`, {
      token,
    }),

  aiCollectionsSuggestions: (token: string) =>
    request<AiCollectionsSuggestions>('/ai/finance/collections-suggestions', {
      token,
    }),

  aiPipelineForecast: (token: string) =>
    request<AiPipelineForecast>('/ai/predictions/pipeline', { token }),

  // Fase 6 — Propostas (spec v3.1). Escritas (criar/enviar/aprovar/rejeitar/
  // marcar vencedora/baixar PDF) acontecem client-side via o proxy
  // `/api/crm/quotes/...`, mesmo padrão do resto do CRM.
  quotes: (token: string) => request<QuoteWithDetails[]>('/quotes', { token }),

  proposalTemplates: (token: string) =>
    request<ProposalTemplate[]>('/proposal-templates', { token }),

  // Fase 7 — Pedidos (spec v3.1, RF012). Escritas (criar manual, converter
  // de proposta, editar, mudar status) acontecem client-side via o proxy
  // `/api/crm/orders/...` e `/api/crm/quotes/:id/convert-to-order`, mesmo
  // padrão do resto do CRM.
  orders: (token: string) => request<OrderWithDetails[]>('/orders', { token }),

  // Fase 8 — Atividades & Calendário (RF016). Escritas (criar atividade,
  // concluir, bloquear/desbloquear período) acontecem client-side via os
  // proxies `/api/crm/activities/...` e `/api/crm/agenda-blocks/...`, mesmo
  // padrão do resto do CRM. `from`/`to`/`userId` alimentam a tela
  // `/dashboard/agenda` — sem eles, mantém o uso já existente no Cliente
  // 360° (todas as atividades daquele cliente).
  activities: (
    token: string,
    filters?: { from?: string; to?: string; userId?: string },
  ) => {
    const params = new URLSearchParams();
    if (filters?.from) params.set('from', filters.from);
    if (filters?.to) params.set('to', filters.to);
    if (filters?.userId) params.set('userId', filters.userId);
    const qs = params.toString();
    return request<Activity[]>(`/activities${qs ? `?${qs}` : ''}`, { token });
  },

  agendaBlocks: (
    token: string,
    filters?: { from?: string; to?: string; userId?: string },
  ) => {
    const params = new URLSearchParams();
    if (filters?.from) params.set('from', filters.from);
    if (filters?.to) params.set('to', filters.to);
    if (filters?.userId) params.set('userId', filters.userId);
    const qs = params.toString();
    return request<AgendaBlock[]>(`/agenda-blocks${qs ? `?${qs}` : ''}`, {
      token,
    });
  },
};
