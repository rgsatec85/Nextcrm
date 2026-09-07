import { DeterministicAiProvider } from './deterministic-ai.provider';
import { splitEmailDraft } from './ai-templates';

describe('DeterministicAiProvider', () => {
  const provider = new DeterministicAiProvider();

  it('produz texto não vazio e estável para o mesmo contexto (ask.overdue-threshold)', async () => {
    const context = {
      kind: 'ask.overdue-threshold' as const,
      threshold: 100_000,
      customers: [{ customerId: 'c1', name: 'Acme', totalOverdue: 150_000 }],
    };
    const a = await provider.generateText('ignorado', context);
    const b = await provider.generateText('outro prompt qualquer', context);
    expect(a).toBe(b); // determinístico: ignora o prompt
    expect(a.length).toBeGreaterThan(0);
    expect(a).toContain('Acme');
    expect(a).toContain('100.000');
  });

  it('lista vazia de clientes ainda produz uma resposta honesta, não vazia', async () => {
    const text = await provider.generateText('', {
      kind: 'ask.overdue-threshold',
      threshold: 50_000,
      customers: [],
    });
    expect(text.length).toBeGreaterThan(0);
    expect(text).toMatch(/nenhum cliente/i);
  });

  it('ask.fallback nunca inventa uma resposta — descreve as capacidades suportadas', async () => {
    const text = await provider.generateText('', { kind: 'ask.fallback' });
    expect(text).toMatch(/ainda não sei responder/i);
    expect(text).toMatch(/vencidos/);
    expect(text).toMatch(/resuma/);
  });

  it('customer.summary interpola os números reais recebidos no contexto', async () => {
    const text = await provider.generateText('', {
      kind: 'customer.summary',
      name: 'Cliente Teste',
      status: 'ativo',
      segment: 'Varejo',
      totalInvoiced: 10000,
      totalPaid: 8000,
      overdueAmount: 500,
      openInvoicesCount: 2,
      activeContractsCount: 1,
      expiringSoonCount: 0,
      openOpportunitiesCount: 3,
      openOpportunitiesValue: 20000,
      openTicketsCount: 1,
      scoreIa: { score: 82, classification: 'verde' },
    });
    expect(text).toContain('Cliente Teste');
    expect(text).toContain('82/100');
    expect(text).toContain('verde');
  });

  it('opportunity.draft-email produz um texto no formato "Assunto: ..." parseável', async () => {
    const text = await provider.generateText('', {
      kind: 'opportunity.draft-email',
      customerName: 'Acme',
      contactName: 'Maria',
      opportunityTitle: 'Renovação anual',
      stage: 'negociacao',
      value: 30000,
    });
    const { subject, body } = splitEmailDraft(text);
    expect(subject.length).toBeGreaterThan(0);
    expect(body).toContain('Maria');
    expect(body).toContain('Renovação anual');
  });

  it('draft-email sem contato nomeado usa uma saudação genérica', async () => {
    const text = await provider.generateText('', {
      kind: 'opportunity.draft-email',
      customerName: 'Acme',
      contactName: null,
      opportunityTitle: 'Renovação anual',
      stage: 'negociacao',
      value: 30000,
    });
    const { body } = splitEmailDraft(text);
    expect(body.startsWith('Olá,')).toBe(true);
  });

  it('predictions.pipeline sem oportunidades abertas informa previsão zero', async () => {
    const text = await provider.generateText('', {
      kind: 'predictions.pipeline',
      forecastTotal: 0,
      openCount: 0,
      byStage: [],
    });
    expect(text).toMatch(/R\$ 0,00/);
  });
});
