/**
 * Camada de recomendação sobre a listagem de faturas vencidas que já existe
 * desde a Fase 2 (`InvoicesService.findAll({ overdueOnly: true })`) — spec
 * Fase 4 "cobrança inteligente". Regra fixa por dias de atraso, não um
 * modelo treinado; extraída para função pura para ser testável isoladamente
 * e para não fazer N chamadas de IA (uma por fatura) sem necessidade real —
 * ver docs/fase4-ia-corporativa.md.
 */

export type CollectionPriority = 'baixa' | 'media' | 'alta' | 'critica';

export interface CollectionSuggestion {
  priority: CollectionPriority;
  channel: string;
}

export function computeCollectionSuggestion(
  daysOverdue: number,
): CollectionSuggestion {
  if (daysOverdue > 60) {
    return { priority: 'critica', channel: 'ligação telefônica' };
  }
  if (daysOverdue > 30) {
    return { priority: 'alta', channel: 'ligação telefônica' };
  }
  if (daysOverdue > 7) {
    return { priority: 'media', channel: 'WhatsApp' };
  }
  return { priority: 'baixa', channel: 'email' };
}
