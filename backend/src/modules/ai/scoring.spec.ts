import {
  computeRenewalSignal,
  computeSatisfactionSignal,
  computeScoreIa,
  computeTenureSignal,
  computeVolumeTrendSignal,
  SCORE_IA_WEIGHTS,
} from './scoring';

describe('SCORE_IA_WEIGHTS', () => {
  it('soma exatamente 1.0 (nenhum sinal fica de fora do modelo)', () => {
    const total = Object.values(SCORE_IA_WEIGHTS).reduce((s, w) => s + w, 0);
    expect(total).toBeCloseTo(1, 10);
  });
});

describe('computeTenureSignal', () => {
  it('atinge o sinal máximo em 730 dias (2 anos)', () => {
    expect(computeTenureSignal(730)).toBe(1);
    expect(computeTenureSignal(1500)).toBe(1); // clampado, não passa de 1
  });

  it('é proporcional para clientes mais novos', () => {
    expect(computeTenureSignal(365)).toBeCloseTo(0.5, 5);
    expect(computeTenureSignal(0)).toBe(0);
  });
});

describe('computeVolumeTrendSignal', () => {
  it('é neutro (0.5) sem histórico anterior e sem recebimento recente', () => {
    expect(computeVolumeTrendSignal(0, 0)).toBe(0.5);
  });

  it('é máximo sem histórico anterior mas com recebimento recente (cliente novo pagando)', () => {
    expect(computeVolumeTrendSignal(1000, 0)).toBe(1);
  });

  it('é 0.5 quando o volume recebido se manteve igual', () => {
    expect(computeVolumeTrendSignal(1000, 1000)).toBe(0.5);
  });

  it('cresce até o máximo quando o volume dobra ou mais', () => {
    expect(computeVolumeTrendSignal(2000, 1000)).toBe(1);
    expect(computeVolumeTrendSignal(500, 1000)).toBeCloseTo(0.25, 5);
  });
});

describe('computeSatisfactionSignal', () => {
  it('é máximo sem nenhum chamado recente', () => {
    expect(computeSatisfactionSignal([])).toBe(1);
  });

  it('cai com chamados de prioridade alta/urgente', () => {
    const withUrgent = computeSatisfactionSignal([
      { priority: 'urgente' },
      { priority: 'urgente' },
    ]);
    const withBaixa = computeSatisfactionSignal([
      { priority: 'baixa' },
      { priority: 'baixa' },
    ]);
    expect(withUrgent).toBeLessThan(withBaixa);
  });

  it('zera com volume ponderado alto', () => {
    const manyUrgent = Array.from({ length: 5 }, () => ({
      priority: 'urgente',
    }));
    expect(computeSatisfactionSignal(manyUrgent)).toBe(0);
  });
});

describe('computeRenewalSignal', () => {
  it('é neutro sem nenhum contrato', () => {
    expect(computeRenewalSignal(0, 0)).toBe(0.5);
  });

  it('é máximo quando todos os contratos foram renovados', () => {
    expect(computeRenewalSignal(3, 3)).toBe(1);
  });

  it('é proporcional quando parte foi renovada', () => {
    expect(computeRenewalSignal(4, 1)).toBe(0.25);
  });
});

describe('computeScoreIa — perfis representativos', () => {
  it('cliente pontual, sem inadimplência e engajado → score alto (verde)', () => {
    const { score, classification } = computeScoreIa({
      punctuality: 1,
      overdueHealth: 1,
      volumeTrend: 0.8,
      tenure: 1,
      satisfaction: 1,
      renewal: 1,
    });
    expect(score).toBeGreaterThanOrEqual(75);
    expect(classification).toBe('verde');
  });

  it('cliente cronicamente atrasado e com alta inadimplência → score baixo (vermelho)', () => {
    const { score, classification } = computeScoreIa({
      punctuality: 0.1,
      overdueHealth: 0.1,
      volumeTrend: 0.2,
      tenure: 0.3,
      satisfaction: 0.2,
      renewal: 0,
    });
    expect(score).toBeLessThan(45);
    expect(classification).toBe('vermelho');
  });

  it('cliente misto (razoável, mas não excelente) → faixa amarela', () => {
    const { score, classification } = computeScoreIa({
      punctuality: 0.6,
      overdueHealth: 0.5,
      volumeTrend: 0.5,
      tenure: 0.5,
      satisfaction: 0.6,
      renewal: 0.5,
    });
    expect(score).toBeGreaterThanOrEqual(45);
    expect(score).toBeLessThan(75);
    expect(classification).toBe('amarelo');
  });

  it('score nunca sai do intervalo [0, 100] mesmo com sinais extremos', () => {
    const high = computeScoreIa({
      punctuality: 1,
      overdueHealth: 1,
      volumeTrend: 1,
      tenure: 1,
      satisfaction: 1,
      renewal: 1,
    });
    const low = computeScoreIa({
      punctuality: 0,
      overdueHealth: 0,
      volumeTrend: 0,
      tenure: 0,
      satisfaction: 0,
      renewal: 0,
    });
    expect(high.score).toBe(100);
    expect(low.score).toBe(0);
  });
});
