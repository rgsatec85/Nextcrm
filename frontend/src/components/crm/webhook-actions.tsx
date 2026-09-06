'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function WebhookActions({ webhookId, isActive }: { webhookId: string; isActive: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/crm/webhooks/${webhookId}/toggle`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !isActive }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        setError(b.message ?? 'Não foi possível atualizar');
        return;
      }
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function remove() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/crm/webhooks/${webhookId}`, { method: 'DELETE' });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        setError(b.message ?? 'Não foi possível remover');
        return;
      }
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-3">
      <button
        type="button"
        onClick={toggle}
        disabled={loading}
        className="text-xs font-medium text-brand-600 hover:underline disabled:opacity-60"
      >
        {isActive ? 'Desativar' : 'Ativar'}
      </button>
      <button
        type="button"
        onClick={remove}
        disabled={loading}
        className="text-xs font-medium text-red-600 hover:underline disabled:opacity-60"
      >
        Remover
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </span>
  );
}
