/**
 * Abstração central da Fase 4 (Inteligência Artificial Corporativa).
 *
 * Este sandbox não tem GPU nem um servidor Ollama alcançável, e não existe
 * pipeline de treinamento nem dataset de verdade neste projeto. Em vez de
 * fingir uma integração real de LLM/ML, a Fase 4 isola toda "geração de
 * texto" atrás desta interface — a mesma filosofia de "simplificação
 * documentada" já usada para o gateway de pagamento fake (Fase 2) e para o
 * webhook fire-and-forget sem fila de retry (Fase 3).
 *
 * Contrato deliberadamente mínimo: quem chama `generateText` já computou
 * TODOS os números/fatos reais a partir dos dados do tenant (nunca inventados)
 * e passa isso em `context`. O provider só decide COMO fraseá-los em
 * português natural — nunca decide QUAIS números aparecem. Isso vale tanto
 * para o `DeterministicAiProvider` (que ignora `prompt` e monta um texto por
 * template a partir de `context.kind`) quanto para o `OllamaAiProvider` (que
 * manda `prompt` + `context` para um modelo real, mas com instrução explícita
 * de nunca inventar números fora do que foi fornecido).
 */
export interface AiProvider {
  /**
   * @param prompt  instrução em linguagem natural do que fazer com os dados
   *                de `context` (usada de verdade só pelo OllamaAiProvider —
   *                o determinístico ignora e usa `context.kind` para
   *                escolher o template).
   * @param context dados já computados pelo backend (nunca inventados pelo
   *                provider) — sempre inclui uma chave `kind` identificando
   *                o tipo de resposta esperada (ver `ai-templates.ts`).
   */
  generateText(
    prompt: string,
    context: Record<string, unknown>,
  ): Promise<string>;
}

export const AI_PROVIDER = Symbol('AI_PROVIDER');
