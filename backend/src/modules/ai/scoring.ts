/**
 * Score IA (spec Fase 4) — modelo de pontuação PONDERADO e DETERMINÍSTICO,
 * pronto para ser trocado por um modelo treinado de verdade no futuro
 * (rotulado honestamente como tal, não uma alegação de aprendizado de
 * máquina real). Supersede o "Score Financeiro" da Fase 2
 * (`FinanceService.customerScore`), que vira um dos seis sinais de entrada
 * aqui (punctuality/overdueHealth) em vez de ser a resposta final — ver
 * `AiService.scoreIa` e `docs/fase4-ia-corporativa.md`.
 *
 * Os pesos abaixo somam 1.0 e foram escolhidos por julgamento de produto,
 * não calibrados estatisticamente contra resultado real (não há dataset
 * rotulado neste projeto) — documentado explicitamente como heurística.
 */
export const SCORE_IA_WEIGHTS = {
  punctuality: 0.25, // pontualidade de pagamento (Fase 2)
  overdueHealth: 0.25, // inverso da inadimplência (Fase 2)
  volumeTrend: 0.15, // tendência de volume recebido (90d vs. 90d anteriores)
  tenure: 0.1, // tempo de relacionamento
  satisfaction: 0.15, // proxy de satisfação via volume/severidade de chamados
  renewal: 0.1, // histórico de renovação de contratos
} as const;

export interface ScoreIaSignals {
  punctuality: number; // 0..1 — 1 = sempre paga em dia
  overdueHealth: number; // 0..1 — 1 = nada vencido
  volumeTrend: number; // 0..1 — 1 = volume recebido crescendo forte
  tenure: number; // 0..1 — 1 = cliente há 2+ anos
  satisfaction: number; // 0..1 — 1 = poucos/nenhum chamado recente
  renewal: number; // 0..1 — 1 = sempre renova contrato
}

export type ScoreIaClassification = 'verde' | 'amarelo' | 'vermelho';

export interface ScoreIaResult {
  score: number; // 0..100
  classification: ScoreIaClassification;
}

export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** 2 anos (730 dias) de relacionamento já dá o sinal máximo. */
export function computeTenureSignal(relationshipDays: number): number {
  return clamp01(relationshipDays / 730);
}

/**
 * Compara o valor recebido numa janela recente com o valor recebido na
 * janela anterior de mesmo tamanho. Sem histórico anterior (cliente novo ou
 * sem pagamentos antes da janela), o sinal é neutro (0.5) se também não
 * recebeu nada agora, ou máximo (1) se já começou a pagar.
 */
export function computeVolumeTrendSignal(
  recentPaid: number,
  priorPaid: number,
): number {
  if (priorPaid <= 0) {
    return recentPaid > 0 ? 1 : 0.5;
  }
  return clamp01(recentPaid / (priorPaid * 2));
}

const TICKET_PRIORITY_WEIGHT: Record<string, number> = {
  urgente: 3,
  alta: 2,
  media: 1,
  baixa: 0.5,
};

/**
 * Proxy de satisfação: quanto mais chamados (e mais graves) um cliente abriu
 * recentemente, menor o sinal. 10 pontos ponderados (ex.: ~3 chamados
 * urgentes, ou 10 de baixa prioridade) já zera o sinal — limiar arbitrário,
 * documentado como tal.
 */
export function computeSatisfactionSignal(
  recentTickets: { priority: string }[],
): number {
  const weighted = recentTickets.reduce(
    (sum, t) => sum + (TICKET_PRIORITY_WEIGHT[t.priority] ?? 1),
    0,
  );
  return clamp01(1 - weighted / 10);
}

/** Sem nenhum contrato ainda, o sinal é neutro — não é nem bom nem ruim sinal. */
export function computeRenewalSignal(
  totalContracts: number,
  renewedContracts: number,
): number {
  if (totalContracts === 0) return 0.5;
  return clamp01(renewedContracts / totalContracts);
}

export function computeScoreIa(signals: ScoreIaSignals): ScoreIaResult {
  const weighted =
    signals.punctuality * SCORE_IA_WEIGHTS.punctuality +
    signals.overdueHealth * SCORE_IA_WEIGHTS.overdueHealth +
    signals.volumeTrend * SCORE_IA_WEIGHTS.volumeTrend +
    signals.tenure * SCORE_IA_WEIGHTS.tenure +
    signals.satisfaction * SCORE_IA_WEIGHTS.satisfaction +
    signals.renewal * SCORE_IA_WEIGHTS.renewal;

  const score = Math.round(clamp01(weighted) * 100);
  const classification: ScoreIaClassification =
    score >= 75 ? 'verde' : score >= 45 ? 'amarelo' : 'vermelho';

  return { score, classification };
}
