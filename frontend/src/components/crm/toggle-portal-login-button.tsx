'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function TogglePortalLoginButton({
  customerId,
  loginId,
  isActive,
}: {
  customerId: string;
  loginId: string;
  isActive: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/crm/customers/${customerId}/portal-logins/${loginId}/toggle`, {
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

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="text-xs font-medium text-brand-600 hover:underline disabled:opacity-60"
      >
        {isActive ? 'Desativar' : 'Ativar'}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </span>
  );
}
