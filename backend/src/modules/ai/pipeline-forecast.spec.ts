import {
  OPEN_PIPELINE_STAGES,
  STAGE_WIN_RATES,
  winRateForStage,
} from './pipeline-forecast';

describe('pipeline-forecast', () => {
  it('não inclui os estágios fechados na lista de estágios abertos', () => {
    expect(OPEN_PIPELINE_STAGES).not.toContain('fechado_ganho');
    expect(OPEN_PIPELINE_STAGES).not.toContain('fechado_perdido');
  });

  it('toda taxa de conversão assumida fica entre 0 e 1', () => {
    for (const rate of Object.values(STAGE_WIN_RATES)) {
      expect(rate).toBeGreaterThan(0);
      expect(rate).toBeLessThanOrEqual(1);
    }
  });

  it('a taxa cresce à medida que o estágio avança no funil', () => {
    expect(winRateForStage('lead')).toBeLessThan(
      winRateForStage('qualificacao'),
    );
    expect(winRateForStage('qualificacao')).toBeLessThan(
      winRateForStage('proposta'),
    );
    expect(winRateForStage('proposta')).toBeLessThan(
      winRateForStage('negociacao'),
    );
  });

  it('devolve 0 para um estágio desconhecido em vez de lançar', () => {
    expect(winRateForStage('estagio-inexistente')).toBe(0);
  });
});
