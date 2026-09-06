'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

// Espelha a máquina de estados de QuotesService no backend:
// rascunho -> enviada -> aprovada | rejeitada. Aprovar dispara, no backend,
// a criação automática do Pedido e o fechamento da oportunidade como ganha.
export function QuoteActions({ quoteId, status }: { quoteId: string; status: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function transition(action: 'send' | 'approve' | 'reject') {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/crm/quotes/${quoteId}/${action}`, { method: 'PATCH' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.message ?? 'Não foi possível atualizar a proposta');
        return;
      }
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <span className="flex items-center gap-2">
      {status === 'rascunho' && (
        <button
          type="button"
          onClick={() => transition('send')}
          disabled={loading}
          className="text-xs font-medium text-brand-600 hover:underline disabled:opacity-60"
        >
          Enviar
        </button>
      )}
      {status === 'enviada' && (
        <>
          <button
            type="button"
            onClick={() => transition('approve')}
            disabled={loading}
            className="text-xs font-medium text-emerald-600 hover:underline disabled:opacity-60"
          >
            Aprovar
          </button>
          <button
            type="button"
            onClick={() => transition('reject')}
            disabled={loading}
            className="text-xs font-medium text-red-600 hover:underline disabled:opacity-60"
          >
            Rejeitar
          </button>
        </>
      )}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </span>
  );
}
