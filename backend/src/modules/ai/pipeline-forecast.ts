/**
 * Previsão de fechamento do pipeline (spec Fase 4) — soma do valor de cada
 * oportunidade ABERTA multiplicado por uma taxa histórica de conversão
 * ASSUMIDA por estágio (não calculada a partir de negócios fechados no
 * passado, porque não há volume suficiente neste projeto para uma taxa real
 * ser significativa). Documentado explicitamente como previsão heurística,
 * não um modelo preditivo treinado — ver docs/fase4-ia-corporativa.md.
 *
 * Estágios "fechado_ganho"/"fechado_perdido" ficam de fora: já são
 * resultado, não previsão.
 */
export const STAGE_WIN_RATES: Record<string, number> = {
  lead: 0.05,
  qualificacao: 0.15,
  proposta: 0.35,
  negociacao: 0.6,
};

export const OPEN_PIPELINE_STAGES = Object.keys(STAGE_WIN_RATES);

export function winRateForStage(stage: string): number {
  return STAGE_WIN_RATES[stage] ?? 0;
}
