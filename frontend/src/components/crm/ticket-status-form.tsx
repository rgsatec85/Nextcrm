'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { TICKET_STATUS_LABELS } from '@/lib/crm-constants';

export function TicketStatusForm({ ticketId, status }: { ticketId: string; status: string }) {
  const router = useRouter();
  const [value, setValue] = useState(status);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleChange(newStatus: string) {
    setValue(newStatus);
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/crm/tickets/${ticketId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.message ?? 'Não foi possível atualizar o status');
        setValue(status);
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
        value={value}
        disabled={loading}
        onChange={(e) => handleChange(e.target.value)}
        className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
      >
        {Object.entries(TICKET_STATUS_LABELS).map(([v, label]) => (
          <option key={v} value={v}>
            {label}
          </option>
        ))}
      </select>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </span>
  );
}
