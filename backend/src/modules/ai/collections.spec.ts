import { computeCollectionSuggestion } from './collections';

describe('computeCollectionSuggestion', () => {
  it('baixa prioridade e email para atraso leve (até 7 dias)', () => {
    expect(computeCollectionSuggestion(3)).toEqual({
      priority: 'baixa',
      channel: 'email',
    });
  });

  it('média prioridade e WhatsApp entre 8 e 30 dias', () => {
    expect(computeCollectionSuggestion(15)).toEqual({
      priority: 'media',
      channel: 'WhatsApp',
    });
  });

  it('alta prioridade e ligação entre 31 e 60 dias', () => {
    expect(computeCollectionSuggestion(45)).toEqual({
      priority: 'alta',
      channel: 'ligação telefônica',
    });
  });

  it('prioridade crítica e ligação acima de 60 dias', () => {
    expect(computeCollectionSuggestion(90)).toEqual({
      priority: 'critica',
      channel: 'ligação telefônica',
    });
  });
});
