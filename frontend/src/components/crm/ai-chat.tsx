'use client';

import { useState } from 'react';

interface Exchange {
  question: string;
  answer: string;
  intent: string;
}

const EXAMPLE_QUESTIONS = [
  'quais clientes possuem mais de R$10 mil vencidos',
  'resuma o cliente <nome de um cliente seu>',
];

// Chat simples (spec Fase 4): sem memória entre perguntas (cada pergunta é
// avaliada isoladamente pelo backend, sem contexto de turnos anteriores) —
// documentado como simplificação em docs/fase4-ia-corporativa.md. As
// perguntas de exemplo abaixo existem para dar expectativa honesta: são
// exatamente os dois formatos que o assistente entende hoje, não uma
// amostra de um conjunto maior.
export function AiChat() {
  const [question, setQuestion] = useState('');
  const [history, setHistory] = useState<Exchange[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = question.trim();
    if (!trimmed) return;

    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/crm/ai/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: trimmed }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message = Array.isArray(body.message)
          ? body.message.join(', ')
          : (body.message ?? 'Não foi possível consultar o assistente');
        throw new Error(message);
      }
      setHistory((h) => [
        ...h,
        { question: trimmed, answer: body.answer as string, intent: body.intent as string },
      ]);
      setQuestion('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <p className="mb-2 text-xs font-medium uppercase text-slate-500">
          Perguntas que este assistente entende hoje
        </p>
        <ul className="list-inside list-disc text-sm text-slate-600">
          {EXAMPLE_QUESTIONS.map((q) => (
            <li key={q}>{q}</li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-slate-400">
          Qualquer outra pergunta recebe uma resposta honesta explicando isso,
          em vez de uma resposta inventada.
        </p>
      </div>

      <div className="space-y-3">
        {history.map((exchange, i) => (
          <div key={i} className="space-y-1">
            <div className="ml-auto max-w-[85%] rounded-lg bg-brand-600 px-3 py-2 text-sm text-white">
              {exchange.question}
            </div>
            <div className="max-w-[85%] whitespace-pre-line rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800">
              {exchange.answer}
            </div>
          </div>
        ))}
        {history.length === 0 && (
          <p className="text-sm text-slate-400">
            Faça uma pergunta abaixo para começar.
          </p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex items-start gap-2">
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          rows={2}
          placeholder='Ex.: "quais clientes possuem mais de R$50 mil vencidos"'
          className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
        <button
          type="submit"
          disabled={loading || !question.trim()}
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {loading ? 'Perguntando…' : 'Perguntar'}
        </button>
      </form>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
