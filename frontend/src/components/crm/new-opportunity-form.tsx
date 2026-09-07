'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FormField } from '@/components/form-field';

interface NewOpportunityFormProps {
  // Uso no Cliente 360°: cliente fixo, sem seletor.
  customerId?: string;
  // Uso no Pipeline: precisa escolher a quem a oportunidade pertence.
  customers?: { id: string; name: string }[];
  onSuccess?: () => void;
}

export function NewOpportunityForm({ customerId, customers, onSuccess }: NewOpportunityFormProps) {
  const router = useRouter();
  const [selectedCustomerId, setSelectedCustomerId] = useState(
    customerId ?? customers?.[0]?.id ?? '',
  );
  const [title, setTitle] = useState('');
  const [value, setValue] = useState('');
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
      const res = await fetch('/api/crm/opportunities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: selectedCustomerId,
          title,
          value: value ? Number(value) : undefined,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const message = Array.isArray(body.message)
          ? body.message.join(', ')
          : (body.message ?? 'Não foi possível criar a oportunidade');
        throw new Error(message);
      }

      setTitle('');
      setValue('');
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

      <FormField label="Título" name="title" value={title} onChange={setTitle} />
      <FormField
        label="Valor (R$)"
        name="value"
        type="number"
        value={value}
        onChange={setValue}
        required={false}
      />

      {error && <p className="text-sm text-red-600 sm:col-span-3">{error}</p>}

      <div className="sm:col-span-3">
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {loading ? 'Salvando…' : 'Adicionar oportunidade'}
        </button>
      </div>
    </form>
  );
}
