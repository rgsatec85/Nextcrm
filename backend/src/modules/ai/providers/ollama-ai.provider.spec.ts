import { buildOllamaPrompt, OllamaAiProvider } from './ollama-ai.provider';

function configService(values: Record<string, string> = {}) {
  return { get: (key: string) => values[key] } as never;
}

describe('buildOllamaPrompt', () => {
  it('inclui a tarefa, os dados em JSON e a instrução anti-alucinação', () => {
    const prompt = buildOllamaPrompt('resuma o cliente', { kind: 'x', foo: 1 });
    expect(prompt).toContain('Tarefa: resuma o cliente');
    expect(prompt).toContain('"kind":"x"');
    expect(prompt).toMatch(/nunca\s+invente/i);
  });
});

describe('OllamaAiProvider', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('nunca lança quando o fetch falha (rede indisponível) — cai no determinístico', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    const provider = new OllamaAiProvider(configService());

    const text = await provider.generateText('', { kind: 'ask.fallback' });

    expect(text).toMatch(/ainda não sei responder/i);
  });

  it('nunca lança quando o servidor responde HTTP não-ok — cai no determinístico', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    const provider = new OllamaAiProvider(configService());

    const text = await provider.generateText('', { kind: 'ask.fallback' });

    expect(text).toMatch(/ainda não sei responder/i);
  });

  it('nunca lança quando o servidor devolve resposta vazia — cai no determinístico', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ response: '   ' }) });
    const provider = new OllamaAiProvider(configService());

    const text = await provider.generateText('', { kind: 'ask.fallback' });

    expect(text).toMatch(/ainda não sei responder/i);
  });

  it('usa a resposta do Ollama quando o servidor responde normalmente', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ response: 'Resposta fraseada pelo modelo.' }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    const provider = new OllamaAiProvider(
      configService({
        OLLAMA_BASE_URL: 'http://ollama.local:11434',
        OLLAMA_MODEL: 'meu-modelo',
      }),
    );

    const text = await provider.generateText('tarefa', {
      kind: 'ask.fallback',
    });

    expect(text).toBe('Resposta fraseada pelo modelo.');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://ollama.local:11434/api/generate');
    const body = JSON.parse(init.body as string) as {
      model: string;
      stream: boolean;
    };
    expect(body.model).toBe('meu-modelo');
    expect(body.stream).toBe(false);
  });

  it('usa defaults de base URL e modelo quando não configurados', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ response: 'ok' }) });
    global.fetch = fetchMock as unknown as typeof fetch;
    const provider = new OllamaAiProvider(configService());

    await provider.generateText('tarefa', { kind: 'ask.fallback' });

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:11434/api/generate');
  });
});
