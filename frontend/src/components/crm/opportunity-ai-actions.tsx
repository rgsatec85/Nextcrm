'use client';

import { useState } from 'react';

const PRIORITY_BADGE: Record<string, string> = {
  baixa: 'bg-slate-100 text-slate-600',
  media: 'bg-amber-100 text-amber-700',
  alta: 'bg-orange-100 text-orange-700',
  urgente: 'bg-red-100 text-red-700',
};

interface NextActionData {
  suggestedAction: string;
  priority: string;
  daysSinceLastActivity: number;
}

interface DraftEmailData {
  subject: string;
  body: string;
}

/**
 * Ações de IA por oportunidade (spec Fase 4 — próxima ação sugerida e
 * rascunho de email). Sob demanda (só busca ao clicar), em vez de pré-
 * carregar para todo o pipeline de uma vez — evita N chamadas de IA numa
 * tela que pode ter muitos cards.
 */
export function OpportunityAiActions({ opportunityId }: { opportunityId: string }) {
  const [nextAction, setNextAction] = useState<NextActionData | null>(null);
  const [draftEmail, setDraftEmail] = useState<DraftEmailData | null>(null);
  const [loading, setLoading] = useState<'next-action' | 'draft-email' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadNextAction() {
    setError(null);
    setLoading('next-action');
    try {
      const res = await fetch(`/api/crm/ai/opportunities/${opportunityId}/next-action`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message ?? 'Falha ao consultar sugestão');
      setNextAction(body as NextActionData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado');
    } finally {
      setLoading(null);
    }
  }

  async function loadDraftEmail() {
    setError(null);
    setLoading('draft-email');
    try {
      const res = await fetch(`/api/crm/ai/opportunities/${opportunityId}/draft-email`, {
        method: 'POST',
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message ?? 'Falha ao gerar rascunho');
      setDraftEmail(body as DraftEmailData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado');
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="mt-2 space-y-2 border-t border-slate-100 pt-2">
      <div className="flex gap-3 text-xs">
        <button
          type="button"
          onClick={loadNextAction}
          disabled={loading !== null}
          className="text-brand-600 hover:underline disabled:opacity-60"
        >
          {loading === 'next-action' ? 'Consultando…' : 'Sugestão de IA'}
        </button>
        <button
          type="button"
          onClick={loadDraftEmail}
          disabled={loading !== null}
          className="text-brand-600 hover:underline disabled:opacity-60"
        >
          {loading === 'draft-email' ? 'Gerando…' : 'Rascunho de email'}
        </button>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      {nextAction && (
        <div className="rounded-md bg-slate-50 p-2 text-xs">
          <span
            className={`mr-2 rounded-full px-2 py-0.5 font-medium ${PRIORITY_BADGE[nextAction.priority] ?? 'bg-slate-100 text-slate-600'}`}
          >
            {nextAction.priority}
          </span>
          {nextAction.suggestedAction}
        </div>
      )}

      {draftEmail && (
        <div className="rounded-md bg-slate-50 p-2 text-xs">
          <p className="font-medium text-slate-800">{draftEmail.subject}</p>
          <p className="mt-1 whitespace-pre-line text-slate-600">{draftEmail.body}</p>
        </div>
      )}
    </div>
  );
}
