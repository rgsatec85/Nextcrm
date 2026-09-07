'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ORDER_STATUSES, ORDER_STATUS_LABELS } from '@/lib/crm-constants';

// Mudança de status do Pedido (spec v3.1, RF012 — "gestão ampliada"). O
// endpoint PATCH /orders/:id/status já existia desde a Fase 1, mas nenhuma
// tela usava — pedidos ficavam presos em "confirmado" para sempre, salvo
// edição direta no banco.
export function OrderStatusSelect({
  orderId,
  status,
}: {
  orderId: string;
  status: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleChange(newStatus: string) {
    if (newStatus === status) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/crm/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.message ?? 'Não foi possível atualizar o status');
        return;
      }
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <select
        value={status}
        disabled={loading}
        onChange={(e) => handleChange(e.target.value)}
        className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
      >
        {ORDER_STATUSES.map((s) => (
          <option key={s} value={s}>
            {ORDER_STATUS_LABELS[s]}
          </option>
        ))}
      </select>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </span>
  );
}
