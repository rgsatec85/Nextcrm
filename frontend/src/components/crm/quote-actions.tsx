'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download } from 'lucide-react';

// Espelha a máquina de estados de QuotesService no backend:
// rascunho -> enviada -> aprovada | rejeitada. Aprovar dispara, no backend,
// a criação automática do Pedido e o fechamento da oportunidade como ganha.
// Fase 6 (spec v3.1): "Baixar PDF" funciona em qualquer status (usa o
// endpoint GET /quotes/:id/pdf via o proxy) e "Marcar como vencedora" fica
// disponível para qualquer proposta que ainda não seja a vencedora — o
// backend garante que só uma proposta por oportunidade fica marcada.
export function QuoteActions({
  quoteId,
  status,
  isWinner,
}: {
  quoteId: string;
  status: string;
  isWinner?: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function transition(action: 'send' | 'approve' | 'reject' | 'mark-winner') {
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
      {!isWinner && (
        <button
          type="button"
          onClick={() => transition('mark-winner')}
          disabled={loading}
          className="text-xs font-medium text-brand-600 hover:underline disabled:opacity-60"
        >
          Marcar como vencedora
        </button>
      )}
      <a
        href={`/api/crm/quotes/${quoteId}/pdf`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:underline dark:text-slate-300"
      >
        <Download className="h-3 w-3" /> PDF
      </a>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </span>
  );
}
