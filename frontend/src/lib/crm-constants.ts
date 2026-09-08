import type { BadgeTone } from '@/components/ui/badge';

// Espelha backend/src/modules/opportunities/stages.ts — mantido separado (e
// não importado do backend) porque frontend e backend são pacotes distintos
// nesta arquitetura de monorepo sem workspace compartilhado.
export const OPPORTUNITY_STAGES = [
  'lead',
  'qualificacao',
  'proposta',
  'negociacao',
  'fechado_ganho',
  'fechado_perdido',
] as const;

export type OpportunityStage = (typeof OPPORTUNITY_STAGES)[number];

export const STAGE_LABELS: Record<OpportunityStage, string> = {
  lead: 'Lead',
  qualificacao: 'Qualificação',
  proposta: 'Proposta',
  negociacao: 'Negociação',
  fechado_ganho: 'Fechado (ganho)',
  fechado_perdido: 'Fechado (perdido)',
};

// Cadastro de cliente — refinamento de UI (espelha
// backend/src/modules/customers/dto/create-customer.dto.ts).
export const PERSON_TYPE_LABELS: Record<string, string> = {
  juridica: 'Jurídica',
  fisica: 'Física',
};

export const COMPANY_SIZE_LABELS: Record<string, string> = {
  micro: 'Microempresa',
  pequena: 'Pequena',
  media: 'Média',
  grande: 'Grande',
};

export const LEAD_SOURCE_LABELS: Record<string, string> = {
  indicacao: 'Indicação',
  site: 'Site',
  evento: 'Evento',
  prospeccao_ativa: 'Prospecção ativa',
  midia_paga: 'Mídia paga',
  outro: 'Outro',
};

export const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  reuniao: 'Reunião',
  ligacao: 'Ligação',
  follow_up: 'Follow-up',
  nota: 'Nota',
  // Fase 8 (RF016) — tipos de propósito geral, sem cliente/oportunidade
  // obrigatórios (espelha CRM_LINKED_ACTIVITY_TYPES em
  // backend/src/modules/activities/dto/create-activity.dto.ts).
  tarefa: 'Tarefa',
  evento: 'Evento',
};

// Tipos que exigem cliente e/ou oportunidade (espelha
// CRM_LINKED_ACTIVITY_TYPES do backend) — usado pelo formulário de nova
// atividade para decidir se mostra o seletor de cliente/oportunidade.
export const CRM_LINKED_ACTIVITY_TYPES = ['reuniao', 'ligacao', 'follow_up', 'nota'];

// Fase 3 — Portal do Cliente e Atendimento (espelha
// backend/src/modules/tickets/dto/*.ts).
export const TICKET_STATUS_LABELS: Record<string, string> = {
  aberto: 'Aberto',
  em_andamento: 'Em andamento',
  resolvido: 'Resolvido',
  fechado: 'Fechado',
};

export const TICKET_PRIORITY_LABELS: Record<string, string> = {
  baixa: 'Baixa',
  media: 'Média',
  alta: 'Alta',
  urgente: 'Urgente',
};

export const WEBHOOK_EVENT_LABELS: Record<string, string> = {
  'order.created': 'Pedido criado',
  'invoice.paid': 'Fatura paga',
  'ticket.updated': 'Chamado atualizado',
  'contract.expiring': 'Contrato vencendo',
};

// --- Refinamento visual — tons semânticos por status ------------------------
// Mapas de status → `BadgeTone` (ver components/ui/badge.tsx), um por
// entidade, para que toda tabela/lista use a mesma cor para o mesmo status
// em vez de decidir isso separadamente em cada page.tsx. Valores possíveis
// espelham os enums de string validados nos DTOs do backend (não são um
// palpite): tickets (`update-ticket-status.dto.ts`), faturas
// (`invoices.service.ts`), pedidos (`update-order-status.dto.ts`), propostas
// (`quotes.service.ts`) e contratos (`contracts.service.ts`).

export const TICKET_STATUS_TONE: Record<string, BadgeTone> = {
  aberto: 'warning',
  em_andamento: 'info',
  resolvido: 'success',
  fechado: 'neutral',
};

export const INVOICE_STATUS_TONE: Record<string, BadgeTone> = {
  aberto: 'warning',
  parcial: 'warning',
  pago: 'success',
  cancelado: 'neutral',
};

export const ORDER_STATUS_TONE: Record<string, BadgeTone> = {
  confirmado: 'info',
  em_andamento: 'warning',
  concluido: 'success',
  cancelado: 'danger',
};

// Fase 7 (spec v3.1, RF012) — espelha ORDER_STATUSES de
// backend/src/modules/orders/dto/update-order-status.dto.ts.
export const ORDER_STATUS_LABELS: Record<string, string> = {
  confirmado: 'Confirmado',
  em_andamento: 'Em andamento',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
};

export const ORDER_STATUSES = Object.keys(ORDER_STATUS_LABELS);

export const QUOTE_STATUS_TONE: Record<string, BadgeTone> = {
  rascunho: 'neutral',
  enviada: 'info',
  aprovada: 'success',
  rejeitada: 'danger',
  // Fase 6 (spec v3.1) — proposta cuja validUntil passou sem decisão do
  // cliente. Não é uma rejeição explícita, então 'warning' em vez de 'danger'.
  expirada: 'warning',
};

// Fase 6 — Propostas como entidade própria (espelha o enum de status de
// backend/src/modules/quotes, agora incluindo 'expirada').
export const QUOTE_STATUS_LABELS: Record<string, string> = {
  rascunho: 'Rascunho',
  enviada: 'Enviada',
  aprovada: 'Aprovada',
  rejeitada: 'Rejeitada',
  expirada: 'Expirada',
};

// Categorias sugeridas para modelos de proposta (spec v3.1) — texto livre no
// backend (sem CHECK), esta lista só popula o seletor da UI; um valor fora
// dela ainda é aceito e mostrado como está.
export const PROPOSAL_TEMPLATE_CATEGORY_LABELS: Record<string, string> = {
  venda_servico: 'Venda de Serviço',
  venda_produto: 'Venda de Produto',
  locacao: 'Locação',
  consultoria: 'Consultoria',
  outro: 'Outro',
};

export const CONTRACT_STATUS_TONE: Record<string, BadgeTone> = {
  rascunho: 'neutral',
  ativo: 'success',
  renovado: 'success',
  encerrado: 'danger',
};

// Fase 9 (RF013) — 'rascunho' é o estado inicial, o único em que o corpo do
// contrato pode ser editado (ver ContractsService.update no backend).
export const CONTRACT_STATUS_LABELS: Record<string, string> = {
  rascunho: 'Rascunho',
  ativo: 'Ativo',
  encerrado: 'Encerrado',
  renovado: 'Renovado',
};

// Categoria livre de modelo de contrato (mesmo raciocínio de
// PROPOSAL_TEMPLATE_CATEGORY_LABELS) — só sugestões da UI, sem CHECK no
// backend.
export const CONTRACT_TEMPLATE_CATEGORY_LABELS: Record<string, string> = {
  prestacao_servico: 'Prestação de Serviço',
  fornecimento: 'Fornecimento',
  locacao: 'Locação',
  parceria: 'Parceria',
  outro: 'Outro',
};

/**
 * Tom do badge "vence em Nd" pela urgência real do prazo (não um único tom
 * fixo para todo `expiringSoon`): ≤7 dias é tratado como perigo iminente,
 * ≤30 como atenção — mesmo corte que o backend já usa para marcar
 * `expiringSoon` (`contracts.service.ts`: `daysUntilExpiration <= 30`).
 */
export function expiringSoonTone(daysUntilExpiration: number): BadgeTone {
  if (daysUntilExpiration <= 7) return 'danger';
  return 'warning';
}
