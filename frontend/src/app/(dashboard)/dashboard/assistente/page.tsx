import { AiChat } from '@/components/crm/ai-chat';

// Assistente de IA (spec Fase 4) — chat simples, sem memória entre
// perguntas. Fraseado pelo AiProvider (determinístico neste ambiente,
// pronto para Ollama — ver docs/fase4-ia-corporativa.md) a partir de
// números já calculados pelo backend a partir dos dados reais do tenant.
export default function AssistentePage() {
  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-2xl font-semibold text-slate-900">Assistente</h1>
        <p className="text-sm text-slate-500">
          Pergunte em linguagem natural sobre clientes e faturas vencidas
          (spec Fase 4). O assistente responde apenas com dados reais do seu
          tenant — quando não entende a pergunta, diz isso claramente em vez
          de inventar uma resposta.
        </p>
      </section>

      <AiChat />
    </div>
  );
}
