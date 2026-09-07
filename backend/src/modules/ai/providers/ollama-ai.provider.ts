import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiProvider } from './ai-provider.interface';
import { DeterministicAiProvider } from './deterministic-ai.provider';

interface OllamaGenerateResponse {
  response?: string;
}

/**
 * Monta o prompt final enviado ao Ollama: a instrução de negócio (`prompt`,
 * escrita pelo AiService) + os dados já computados (`context`, serializados
 * como JSON) + uma instrução explícita de segurança contra alucinação — o
 * modelo só pode FRASEAR os números fornecidos, nunca calcular ou inventar
 * novos. Exportado à parte para ser testável sem `fetch`.
 */
export function buildOllamaPrompt(
  prompt: string,
  context: Record<string, unknown>,
): string {
  return [
    'Você é o assistente de um CRM B2B. Responda em português do Brasil, de',
    'forma direta e profissional (poucas frases, sem markdown).',
    'REGRA ABSOLUTA: use exclusivamente os dados em "Dados" abaixo. Nunca',
    'invente, estime ou complete números, nomes ou datas que não estejam',
    'ali — se faltar algo, diga que a informação não está disponível.',
    '',
    `Tarefa: ${prompt}`,
    '',
    `Dados (JSON): ${JSON.stringify(context)}`,
  ].join('\n');
}

/**
 * Provider real (não mockado) que fala com um servidor Ollama HTTP
 * (`/api/generate`) — mas NUNCA é exercitado pelos testes automatizados
 * deste projeto porque este sandbox não tem rede para alcançar um Ollama de
 * verdade. É código funcional, não um stand-in: aponte `OLLAMA_BASE_URL`
 * para um servidor real (self-hosted, spec Fase 4) e `AI_PROVIDER=ollama`
 * para ativá-lo. Só é usado para FRASEAR — os números em `context` já foram
 * calculados pelo `AiService` a partir dos dados reais do tenant antes de
 * chegar aqui, então mesmo uma alucinação do modelo não teria como inventar
 * um valor financeiro que o backend não forneceu (na pior hipótese, o texto
 * fica estranho, não errado).
 *
 * Mesma filosofia de confiabilidade do `WebhooksService.dispatch()`: uma
 * falha aqui (Ollama fora do ar, timeout, resposta vazia/malformada) NUNCA
 * deve derrubar o request do usuário — cai de volta para o
 * `DeterministicAiProvider`, que sempre responde algo com os mesmos dados.
 */
@Injectable()
export class OllamaAiProvider implements AiProvider {
  private readonly logger = new Logger(OllamaAiProvider.name);
  private readonly fallback = new DeterministicAiProvider();

  constructor(private readonly config: ConfigService) {}

  async generateText(
    prompt: string,
    context: Record<string, unknown>,
  ): Promise<string> {
    try {
      return await this.callOllama(prompt, context);
    } catch (err) {
      this.logger.warn(
        `OllamaAiProvider falhou (${String(err)}) — respondendo com o ` +
          'DeterministicAiProvider (mesmos dados, template fixo). Esperado ' +
          'neste sandbox sem Ollama alcançável; em produção é a rede de ' +
          'segurança contra o servidor de IA ficar fora do ar.',
      );
      return this.fallback.generateText(prompt, context);
    }
  }

  private async callOllama(
    prompt: string,
    context: Record<string, unknown>,
  ): Promise<string> {
    const baseUrl =
      this.config.get<string>('OLLAMA_BASE_URL') ?? 'http://localhost:11434';
    const model = this.config.get<string>('OLLAMA_MODEL') ?? 'llama3';

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    let response: Response;
    try {
      response = await fetch(`${baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          prompt: buildOllamaPrompt(prompt, context),
          stream: false,
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      throw new Error(`Ollama respondeu HTTP ${response.status}`);
    }

    const body = (await response.json()) as OllamaGenerateResponse;
    const text = body.response?.trim();
    if (!text) {
      throw new Error('Ollama devolveu uma resposta vazia');
    }
    return text;
  }
}
