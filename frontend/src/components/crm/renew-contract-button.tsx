'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function RenewContractButton({ contractId }: { contractId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/crm/contracts/${contractId}/renew`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.message ?? 'Não foi possível renovar');
        return;
      }
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="text-xs font-medium text-brand-600 hover:underline disabled:opacity-60"
      >
        {loading ? 'Renovando…' : 'Renovar'}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </span>
  );
}
