'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface ItemRow {
  description: string;
  quantity: string;
  unitPrice: string;
}

const EMPTY_ROW: ItemRow = { description: '', quantity: '1', unitPrice: '0' };

// Proposta versionada (spec §9/§11) — cada submit cria uma NOVA versão
// (o backend calcula o número), nunca edita uma já enviada/aprovada.
export function NewQuoteForm({ opportunityId }: { opportunityId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ItemRow[]>([{ ...EMPTY_ROW }]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function updateItem(index: number, field: keyof ItemRow, value: string) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, [field]: value } : it)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/crm/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          opportunityId,
          items: items.map((it) => ({
            description: it.description,
            quantity: Number(it.quantity),
            unitPrice: Number(it.unitPrice),
          })),
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const message = Array.isArray(body.message)
          ? body.message.join(', ')
          : (body.message ?? 'Não foi possível criar a proposta');
        throw new Error(message);
      }

      setItems([{ ...EMPTY_ROW }]);
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado');
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs font-medium text-brand-600 hover:underline"
      >
        + Nova proposta
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-2 space-y-2 rounded-md border border-slate-200 p-3">
      {items.map((item, index) => (
        <div key={index} className="grid grid-cols-6 gap-2">
          <input
            placeholder="Descrição"
            value={item.description}
            onChange={(e) => updateItem(index, 'description', e.target.value)}
            required
            className="col-span-3 rounded-md border border-slate-300 px-2 py-1 text-sm"
          />
          <input
            type="number"
            min="1"
            placeholder="Qtd"
            value={item.quantity}
            onChange={(e) => updateItem(index, 'quantity', e.target.value)}
            className="rounded-md border border-slate-300 px-2 py-1 text-sm"
          />
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="Preço unit."
            value={item.unitPrice}
            onChange={(e) => updateItem(index, 'unitPrice', e.target.value)}
            className="rounded-md border border-slate-300 px-2 py-1 text-sm"
          />
          <button
            type="button"
            onClick={() => setItems((prev) => prev.filter((_, i) => i !== index))}
            disabled={items.length === 1}
            className="text-xs text-slate-400 hover:text-red-600 disabled:opacity-30"
          >
            remover
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={() => setItems((prev) => [...prev, { ...EMPTY_ROW }])}
        className="text-xs text-brand-600 hover:underline"
      >
        + item
      </button>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {loading ? 'Salvando…' : 'Salvar proposta'}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-slate-500 hover:underline"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
