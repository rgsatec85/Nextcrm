'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function CompleteActivityButton({ activityId }: { activityId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      await fetch(`/api/crm/activities/${activityId}/complete`, { method: 'PATCH' });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="text-xs font-medium text-brand-600 hover:underline disabled:opacity-60"
    >
      {loading ? 'Concluindo…' : 'Marcar concluída'}
    </button>
  );
}
