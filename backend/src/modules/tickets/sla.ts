// SLA (spec Fase 3 — "Atendimento"): prazo de resposta calculado a partir da
// priority NO MOMENTO DA CRIAÇÃO do chamado. Fica gravado em sla_due_at (não
// é recalculado depois se a priority mudar) — ver migration 0004.
export const SLA_HOURS_BY_PRIORITY: Record<string, number> = {
  urgente: 4,
  alta: 8,
  media: 24,
  baixa: 72,
};

export function computeSlaDueAt(
  priority: string,
  from: Date = new Date(),
): Date {
  const hours = SLA_HOURS_BY_PRIORITY[priority] ?? SLA_HOURS_BY_PRIORITY.media;
  return new Date(from.getTime() + hours * 60 * 60 * 1000);
}
