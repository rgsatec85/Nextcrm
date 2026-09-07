'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ACTIVITY_TYPE_LABELS } from '@/lib/crm-constants';

export function NewActivityForm({
  customerId,
  opportunityId,
  onSuccess,
}: {
  customerId?: string;
  opportunityId?: string;
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const [type, setType] = useState('reuniao');
  const [notes, setNotes] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/crm/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId,
          opportunityId,
          type,
          notes: notes || undefined,
          scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const message = Array.isArray(body.message)
          ? body.message.join(', ')
          : (body.message ?? 'Não foi possível registrar a atividade');
        throw new Error(message);
      }

      setNotes('');
      setScheduledAt('');
      router.refresh();
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-3 sm:grid-cols-4">
      <label className="block text-sm font-medium text-slate-700">
        Tipo
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        >
          {Object.entries(ACTIVITY_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-sm font-medium text-slate-700 sm:col-span-2">
        Notas
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </label>

      <label className="block text-sm font-medium text-slate-700">
        Data/hora
        <input
          type="datetime-local"
          value={scheduledAt}
          onChange={(e) => setScheduledAt(e.target.value)}
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </label>

      {error && <p className="text-sm text-red-600 sm:col-span-4">{error}</p>}

      <div className="sm:col-span-4">
        <button
          type="submit"
          disabled={loading}
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          {loading ? 'Salvando…' : 'Registrar atividade'}
        </button>
      </div>
    </form>
  );
}
