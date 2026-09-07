import { computeNextAction, HIGH_VALUE_THRESHOLD } from './next-action';

describe('computeNextAction', () => {
  it('marca urgente quando não há contato há mais de 14 dias, qualquer estágio', () => {
    const result = computeNextAction('qualificacao', 20, 1000);
    expect(result.priority).toBe('urgente');
    expect(result.suggestedAction).toMatch(/20 dias/);
  });

  it('cobra retorno de proposta parada há mais de 7 dias', () => {
    const result = computeNextAction('proposta', 10, 1000);
    expect(result.priority).toBe('alta');
    expect(result.suggestedAction).toMatch(/proposta/i);
  });

  it('eleva a prioridade da proposta parada quando o valor é alto', () => {
    const result = computeNextAction('proposta', 10, HIGH_VALUE_THRESHOLD + 1);
    expect(result.priority).toBe('urgente');
  });

  it('sugere reunião de fechamento para negociação recente', () => {
    const result = computeNextAction('negociacao', 2, 1000);
    expect(result.priority).toBe('media');
    expect(result.suggestedAction).toMatch(/fechamento/i);
  });

  it('sugere enviar proposta para qualificação recente', () => {
    const result = computeNextAction('qualificacao', 1, 1000);
    expect(result.suggestedAction).toMatch(/proposta/i);
  });

  it('sugere contato inicial para lead novo', () => {
    const result = computeNextAction('lead', 0, 1000);
    expect(result.suggestedAction).toMatch(/inicial/i);
  });

  it('negócio ganho sugere onboarding, prioridade baixa', () => {
    const result = computeNextAction('fechado_ganho', 100, 1000);
    expect(result.priority).toBe('baixa');
    expect(result.suggestedAction).toMatch(/onboarding/i);
  });

  it('negócio perdido sugere reengajamento futuro, prioridade baixa', () => {
    const result = computeNextAction('fechado_perdido', 100, 1000);
    expect(result.priority).toBe('baixa');
    expect(result.suggestedAction).toMatch(/perdid/i);
  });
});
