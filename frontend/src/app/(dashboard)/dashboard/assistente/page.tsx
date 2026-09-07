import { AiChat } from '@/components/crm/ai-chat';
import { Bot } from 'lucide-react';

// Assistente de IA (spec Fase 4) — chat simples, sem memória entre
// perguntas. Fraseado pelo AiProvider (determinístico neste ambiente,
// pronto para Ollama — ver docs/fase4-ia-corporativa.md) a partir de
// números já calculados pelo backend a partir dos dados reais do tenant.
export default function AssistentePage() {
  return (
    <div className="space-y-6">
      <section className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
          <Bot className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">Assistente</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Pergunte em linguagem natural sobre clientes e faturas vencidas (spec Fase 4).
          </p>
        </div>
      </section>

      <AiChat />
    </div>
  );
}
