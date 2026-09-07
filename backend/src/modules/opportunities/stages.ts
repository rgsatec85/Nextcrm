// Pipeline Kanban (spec §9): Lead → Qualificação → Proposta → Negociação →
// Fechado. "Fechado" é desdobrado em ganho/perdido para refletir o
// resultado real do negócio — necessário para o Score Financeiro e para
// saber quando converter em Pedido.
export const OPPORTUNITY_STAGES = [
  'lead',
  'qualificacao',
  'proposta',
  'negociacao',
  'fechado_ganho',
  'fechado_perdido',
] as const;

export type OpportunityStage = (typeof OPPORTUNITY_STAGES)[number];
