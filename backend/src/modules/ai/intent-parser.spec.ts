import { fuzzyFindCustomer, parseQuestion } from './intent-parser';

describe('parseQuestion', () => {
  it('reconhece "quais clientes possuem mais de R$100 mil vencidos" (exemplo do roadmap)', () => {
    const intent = parseQuestion(
      'Quais clientes possuem mais de R$100 mil vencidos?',
    );
    expect(intent).toEqual({
      type: 'overdue_threshold',
      thresholdReais: 100_000,
    });
  });

  it('reconhece variações de "vencido" (vencida/vencidos) e caixa', () => {
    expect(parseQuestion('clientes com mais de 50 mil vencidas')).toEqual({
      type: 'overdue_threshold',
      thresholdReais: 50_000,
    });
    expect(
      parseQuestion('QUAIS CLIENTES TEM MAIS DE 2 MILHOES VENCIDO'),
    ).toEqual({ type: 'overdue_threshold', thresholdReais: 2_000_000 });
  });

  it('aceita valor sem multiplicador (reais diretos)', () => {
    expect(parseQuestion('clientes com mais de 15000 vencido')).toEqual({
      type: 'overdue_threshold',
      thresholdReais: 15_000,
    });
  });

  it('aceita decimal com vírgula', () => {
    expect(parseQuestion('clientes com mais de 1,5 mil vencidos')).toEqual({
      type: 'overdue_threshold',
      thresholdReais: 1_500,
    });
  });

  it('reconhece "resuma a empresa X"', () => {
    expect(parseQuestion('Resuma a empresa Acme Ltda')).toEqual({
      type: 'summarize_customer',
      nameQuery: 'Acme Ltda',
    });
  });

  it('reconhece "resuma o cliente X" com pontuação final', () => {
    expect(parseQuestion('resuma o cliente Beta Corp?')).toEqual({
      type: 'summarize_customer',
      nameQuery: 'Beta Corp',
    });
  });

  it('reconhece "resumo de X"', () => {
    expect(parseQuestion('resumo de Gama Comércio')).toEqual({
      type: 'summarize_customer',
      nameQuery: 'Gama Comércio',
    });
  });

  it('cai em unrecognized para perguntas fora do escopo suportado', () => {
    expect(parseQuestion('qual o clima hoje?')).toEqual({
      type: 'unrecognized',
    });
    expect(parseQuestion('quantos usuários temos no sistema?')).toEqual({
      type: 'unrecognized',
    });
  });

  it('não confunde "vencido" sem menção a cliente com o intent de threshold', () => {
    expect(parseQuestion('o que está vencido no meu contrato?')).toEqual({
      type: 'unrecognized',
    });
  });
});

describe('fuzzyFindCustomer', () => {
  const customers = [
    { id: '1', name: 'Acme Ltda' },
    { id: '2', name: 'Beta Corporação' },
    { id: '3', name: 'Café Central' },
  ];

  it('encontra por correspondência exata (case/acento-insensível)', () => {
    expect(fuzzyFindCustomer(customers, 'acme ltda')?.id).toBe('1');
    expect(fuzzyFindCustomer(customers, 'CAFE CENTRAL')?.id).toBe('3');
  });

  it('encontra por substring parcial', () => {
    expect(fuzzyFindCustomer(customers, 'Beta')?.id).toBe('2');
    expect(fuzzyFindCustomer(customers, 'Acme')?.id).toBe('1');
  });

  it('devolve null quando nada corresponde', () => {
    expect(fuzzyFindCustomer(customers, 'Empresa Inexistente')).toBeNull();
  });

  it('devolve null para query vazia', () => {
    expect(fuzzyFindCustomer(customers, '   ')).toBeNull();
  });
});
