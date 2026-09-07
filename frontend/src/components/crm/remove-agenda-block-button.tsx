'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function RemoveAgendaBlockButton({ blockId }: { blockId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      await fetch(`/api/crm/agenda-blocks/${blockId}`, { method: 'DELETE' });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="text-xs font-medium text-red-600 hover:underline disabled:opacity-60"
    >
      {loading ? 'Removendo…' : 'Remover'}
    </button>
  );
}
