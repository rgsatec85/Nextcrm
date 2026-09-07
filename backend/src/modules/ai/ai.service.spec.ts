import { ForbiddenException } from '@nestjs/common';
import { AiService } from './ai.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { DeterministicAiProvider } from './providers/deterministic-ai.provider';

function user(roleSlug: string, sub = 'user-1'): AuthenticatedUser {
  return { sub, tenantId: 'tenant-1', email: 'x@x.com', roleSlug };
}

function makeService(tx: Record<string, unknown> = {}) {
  const prisma = {
    runWithTenant: jest.fn((_tenantId: string, fn: (tx: unknown) => unknown) =>
      fn(tx),
    ),
  };
  const customersService = {
    findAll: jest.fn().mockResolvedValue([]),
    findOne: jest.fn(),
    assertAccessible: jest
      .fn()
      .mockResolvedValue({ id: 'c1', ownerId: 'user-1' }),
  };
  const financeService = {
    customerScore: jest.fn().mockResolvedValue({
      customerId: 'c1',
      classification: 'verde',
      punctualityRate: 0.9,
      delinquencyRate: 0.05,
      totalPaid: 1000,
      totalInvoicedAmount: 1200,
      overdueAmount: 60,
      relationshipDays: 400,
    }),
  };
  const opportunitiesService = {
    findAll: jest.fn().mockResolvedValue([]),
    findOne: jest.fn(),
  };
  const contractsService = {
    findAll: jest.fn().mockResolvedValue([]),
  };
  const invoicesService = {
    findAll: jest.fn().mockResolvedValue([]),
  };
  const config = { get: jest.fn().mockReturnValue(undefined) };
  // Usa o DeterministicAiProvider DE VERDADE (não um stub) espionado com
  // jest.spyOn — assim os testes que checam o CONTEÚDO da resposta (ex.:
  // draftEmail, customerSummary) exercitam a integração real
  // AiService → templates, e os que só checam OS ARGUMENTOS passados
  // (kind/context) continuam funcionando normalmente.
  const aiProvider = new DeterministicAiProvider();
  jest.spyOn(aiProvider, 'generateText');

  const service = new AiService(
    prisma as never,
    customersService as never,
    financeService as never,
    opportunitiesService as never,
    contractsService as never,
    invoicesService as never,
    config as never,
    aiProvider as never,
  );

  return {
    service,
    prisma,
    customersService,
    financeService,
    opportunitiesService,
    contractsService,
    invoicesService,
    config,
    aiProvider,
  };
}

describe('AiService.ask', () => {
  it('reconhece o intent overdue_threshold, aplica ABAC de vendedor e fraseia via AiProvider', async () => {
    const findMany = jest.fn().mockResolvedValue([
      {
        customerId: 'c1',
        amount: 1000,
        paidAmount: 0,
        customer: { name: 'Acme' },
      },
    ]);
    const create = jest.fn().mockResolvedValue({});
    const { service, aiProvider } = makeService({
      invoice: { findMany },
      aiQueryLog: { create },
    });

    const result = await service.ask(user('vendedor'), {
      question: 'quais clientes possuem mais de R$500 vencidos',
    });

    expect(result.intent).toBe('overdue_threshold');
    const where = findMany.mock.calls[0][0].where as Record<string, unknown>;
    expect(where.customer).toEqual({ ownerId: 'user-1' });
    expect(aiProvider.generateText).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        kind: 'ask.overdue-threshold',
        threshold: 500,
      }),
    );
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ intent: 'overdue_threshold' }),
      }),
    );
  });

  it('não aplica filtro de dono para admin/gestor/financeiro', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const { service } = makeService({
      invoice: { findMany },
      aiQueryLog: { create: jest.fn() },
    });

    await service.ask(user('financeiro'), {
      question: 'quais clientes possuem mais de 100 mil vencidos',
    });

    const where = findMany.mock.calls[0][0].where as Record<string, unknown>;
    expect(where.customer).toBeUndefined();
  });

  it('reconhece "resuma o cliente X" e delega para o resumo quando o cliente é encontrado', async () => {
    const {
      service,
      customersService,
      financeService,
      contractsService,
      aiProvider,
    } = makeService({
      ticket: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
      },
      invoice: { findMany: jest.fn().mockResolvedValue([]) },
      customer: {
        findFirst: jest.fn().mockResolvedValue({ name: 'Acme Ltda' }),
      },
      aiQueryLog: { create: jest.fn() },
    });
    customersService.findAll.mockResolvedValue([
      { id: 'c1', name: 'Acme Ltda' },
    ]);
    customersService.findOne.mockResolvedValue({
      id: 'c1',
      name: 'Acme Ltda',
      status: 'ativo',
      segment: 'Varejo',
      invoices: [],
      contracts: [],
      opportunities: [],
    });

    const result = await service.ask(user('admin'), {
      question: 'resuma o cliente Acme Ltda',
    });

    expect(result.intent).toBe('customer_summary');
    expect(financeService.customerScore).toHaveBeenCalledWith(
      expect.anything(),
      'c1',
    );
    expect(contractsService.findAll).toHaveBeenCalledWith(
      expect.anything(),
      'c1',
    );
    expect(aiProvider.generateText).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ kind: 'customer.summary', name: 'Acme Ltda' }),
    );
  });

  it('devolve customer_not_found quando nenhum cliente corresponde ao nome', async () => {
    const { service, customersService, aiProvider } = makeService({
      aiQueryLog: { create: jest.fn() },
    });
    customersService.findAll.mockResolvedValue([
      { id: 'c1', name: 'Beta Corp' },
    ]);

    const result = await service.ask(user('admin'), {
      question: 'resuma a empresa Empresa Que Não Existe',
    });

    expect(result.intent).toBe('customer_not_found');
    expect(aiProvider.generateText).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ kind: 'ask.customer-not-found' }),
    );
  });

  it('devolve o fallback honesto para perguntas fora do escopo suportado', async () => {
    const { service, aiProvider } = makeService({
      aiQueryLog: { create: jest.fn() },
    });

    const result = await service.ask(user('admin'), {
      question: 'qual é a capital da França?',
    });

    expect(result.intent).toBe('unrecognized');
    expect(aiProvider.generateText).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ kind: 'ask.fallback' }),
    );
  });

  it('nunca lança mesmo se gravar o ai_query_log falhar', async () => {
    const create = jest.fn().mockRejectedValue(new Error('db indisponível'));
    const { service } = makeService({ aiQueryLog: { create } });

    await expect(
      service.ask(user('admin'), { question: 'pergunta qualquer' }),
    ).resolves.toBeDefined();
  });
});

describe('AiService.scoreIa', () => {
  it('combina os sinais (Score Financeiro + tickets + contratos) num score determinístico', async () => {
    const { service, contractsService } = makeService({
      invoice: { findMany: jest.fn().mockResolvedValue([]) },
      ticket: { findMany: jest.fn().mockResolvedValue([]) },
      customer: { findFirst: jest.fn().mockResolvedValue({ name: 'Acme' }) },
    });
    contractsService.findAll.mockResolvedValue([
      { status: 'renovado' },
      { status: 'ativo' },
    ]);

    const result = await service.scoreIa(user('admin'), 'c1');

    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(['verde', 'amarelo', 'vermelho']).toContain(result.classification);
    expect(result.signals.renewal).toBeCloseTo(0.5, 5);
  });

  it('propaga o bloqueio de ABAC quando o vendedor não é dono do cliente', async () => {
    const { service, customersService } = makeService();
    customersService.assertAccessible.mockRejectedValue(
      new ForbiddenException('Você não tem acesso a este registro'),
    );

    await expect(service.scoreIa(user('vendedor'), 'c1')).rejects.toThrow(
      ForbiddenException,
    );
  });
});

describe('AiService.nextAction', () => {
  it('sugere ação urgente quando não há atividade recente', async () => {
    const { service, opportunitiesService } = makeService();
    const longAgo = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000);
    opportunitiesService.findOne.mockResolvedValue({
      id: 'o1',
      title: 'Negócio X',
      stage: 'qualificacao',
      value: 1000,
      createdAt: longAgo,
      customer: { id: 'c1', name: 'Acme' },
      activities: [],
    });

    const result = await service.nextAction(user('admin'), 'o1');

    expect(result.priority).toBe('urgente');
    expect(result.daysSinceLastActivity).toBeGreaterThanOrEqual(19);
  });

  it('usa a atividade mais recente (scheduledAt/doneAt) em vez da criação da oportunidade', async () => {
    const { service, opportunitiesService } = makeService();
    const created = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    const recentActivity = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    opportunitiesService.findOne.mockResolvedValue({
      id: 'o1',
      title: 'Negócio X',
      stage: 'negociacao',
      value: 1000,
      createdAt: created,
      customer: { id: 'c1', name: 'Acme' },
      activities: [
        { scheduledAt: null, doneAt: recentActivity, createdAt: created },
      ],
    });

    const result = await service.nextAction(user('admin'), 'o1');

    expect(result.daysSinceLastActivity).toBeLessThanOrEqual(3);
  });

  it('propaga o bloqueio de ABAC do OpportunitiesService', async () => {
    const { service, opportunitiesService } = makeService();
    opportunitiesService.findOne.mockRejectedValue(new ForbiddenException());

    await expect(service.nextAction(user('vendedor'), 'o1')).rejects.toThrow(
      ForbiddenException,
    );
  });
});

describe('AiService.draftEmail', () => {
  it('monta assunto e corpo a partir dos dados da oportunidade e do contato principal', async () => {
    const contactFindFirst = jest.fn().mockResolvedValue({ name: 'Maria' });
    const { service, opportunitiesService } = makeService({
      contact: { findFirst: contactFindFirst },
    });
    opportunitiesService.findOne.mockResolvedValue({
      id: 'o1',
      title: 'Renovação anual',
      stage: 'negociacao',
      value: 30000,
      customer: { id: 'c1', name: 'Acme' },
    });

    const result = await service.draftEmail(user('admin'), 'o1');

    expect(result.subject.length).toBeGreaterThan(0);
    expect(result.body).toContain('Maria');
  });
});

describe('AiService.collectionsSuggestions', () => {
  it('ordena por risco (dias em atraso x saldo) e sugere canal/prioridade por fatura', async () => {
    const { service, invoicesService } = makeService({
      aiQueryLog: { create: jest.fn() },
    });
    const now = Date.now();
    invoicesService.findAll.mockResolvedValue([
      {
        id: 'i1',
        customerId: 'c1',
        amount: 1000,
        paidAmount: 0,
        dueDate: new Date(now - 5 * 24 * 60 * 60 * 1000),
        customer: { id: 'c1', name: 'Cliente Leve' },
      },
      {
        id: 'i2',
        customerId: 'c2',
        amount: 5000,
        paidAmount: 0,
        dueDate: new Date(now - 90 * 24 * 60 * 60 * 1000),
        customer: { id: 'c2', name: 'Cliente Crítico' },
      },
    ]);

    const result = await service.collectionsSuggestions(user('admin'));

    expect(result.count).toBe(2);
    expect(result.suggestions[0].customerName).toBe('Cliente Crítico');
    expect(result.suggestions[0].priority).toBe('critica');
    expect(result.suggestions[1].priority).toBe('baixa');
  });
});

describe('AiService.pipelineForecast', () => {
  it('calcula a previsão ponderada apenas sobre estágios abertos', async () => {
    const { service, opportunitiesService } = makeService();
    opportunitiesService.findAll.mockResolvedValue([
      { stage: 'proposta', value: 10000 },
      { stage: 'negociacao', value: 20000 },
      { stage: 'fechado_ganho', value: 99999 },
    ]);

    const result = await service.pipelineForecast(user('admin'));

    expect(result.openCount).toBe(2);
    // proposta: 10000*0.35=3500, negociacao: 20000*0.6=12000 → 15500
    expect(result.forecastTotal).toBeCloseTo(15500, 2);
  });
});
