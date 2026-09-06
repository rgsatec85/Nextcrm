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

export const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  reuniao: 'Reunião',
  ligacao: 'Ligação',
  follow_up: 'Follow-up',
  nota: 'Nota',
};

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
