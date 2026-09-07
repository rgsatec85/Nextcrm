'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FormField } from '@/components/form-field';
import { TICKET_PRIORITY_LABELS } from '@/lib/crm-constants';

interface NewTicketFormProps {
  customerId?: string;
  customers?: { id: string; name: string }[];
  onSuccess?: () => void;
}

export function NewTicketForm({ customerId, customers, onSuccess }: NewTicketFormProps) {
  const router = useRouter();
  const [selectedCustomerId, setSelectedCustomerId] = useState(
    customerId ?? customers?.[0]?.id ?? '',
  );
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('media');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!selectedCustomerId) {
      setError('Selecione um cliente');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/crm/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: selectedCustomerId,
          subject,
          description: description || undefined,
          priority,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const message = Array.isArray(body.message)
          ? body.message.join(', ')
          : (body.message ?? 'Não foi possível abrir o chamado');
        throw new Error(message);
      }

      setSubject('');
      setDescription('');
      setPriority('media');
      router.refresh();
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-3">
      {!customerId && customers && (
        <label className="block text-sm font-medium text-slate-700">
          Cliente
          <select
            value={selectedCustomerId}
            onChange={(e) => setSelectedCustomerId(e.target.value)}
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            <option value="" disabled>
              Selecione…
            </option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      )}

      <FormField label="Assunto" name="ticketSubject" value={subject} onChange={setSubject} />

      <label className="block text-sm font-medium text-slate-700">
        Prioridade
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        >
          {Object.entries(TICKET_PRIORITY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-sm font-medium text-slate-700 sm:col-span-3">
        Descrição
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </label>

      {error && <p className="text-sm text-red-600 sm:col-span-3">{error}</p>}

      <div className="sm:col-span-3">
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {loading ? 'Abrindo…' : 'Abrir chamado'}
        </button>
      </div>
    </form>
  );
}
