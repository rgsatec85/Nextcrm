'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

// Ativa um contrato em rascunho (Fase 9, RF013) — a partir daí o corpo fica
// travado (ver ContractsService.update/activate). Mesmo padrão de
// RenewContractButton.
export function ActivateContractButton({ contractId }: { contractId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/crm/contracts/${contractId}/activate`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.message ?? 'Não foi possível ativar');
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
        className="text-xs font-medium text-emerald-600 hover:underline disabled:opacity-60"
      >
        {loading ? 'Ativando…' : 'Ativar'}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </span>
  );
}
