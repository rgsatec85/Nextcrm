'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const PAYMENT_METHODS = [
  { value: 'pix', label: 'Pix' },
  { value: 'boleto', label: 'Boleto' },
  { value: 'cartao', label: 'Cartão' },
];

// Gera as parcelas (contas a receber) de um Pedido — só pode ser feito uma
// vez (o backend rejeita a segunda tentativa com 409).
export function GenerateInvoicesForm({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [installments, setInstallments] = useState('1');
  const [firstDueDate, setFirstDueDate] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('pix');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(`/api/crm/orders/${orderId}/invoices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          installments: Number(installments),
          firstDueDate,
          paymentMethod,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const message = Array.isArray(body.message)
          ? body.message.join(', ')
          : (body.message ?? 'Não foi possível gerar as parcelas');
        throw new Error(message);
      }

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
        Gerar parcelas
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-2 grid gap-2 rounded-md border border-slate-200 p-3 sm:grid-cols-4">
      <label className="block text-xs font-medium text-slate-700">
        Parcelas
        <input
          type="number"
          min="1"
          max="24"
          required
          value={installments}
          onChange={(e) => setInstallments(e.target.value)}
          className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
        />
      </label>
      <label className="block text-xs font-medium text-slate-700">
        1º vencimento
        <input
          type="date"
          required
          value={firstDueDate}
          onChange={(e) => setFirstDueDate(e.target.value)}
          className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
        />
      </label>
      <label className="block text-xs font-medium text-slate-700">
        Meio de pagamento
        <select
          value={paymentMethod}
          onChange={(e) => setPaymentMethod(e.target.value)}
          className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
        >
          {PAYMENT_METHODS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </label>
      <div className="flex items-end gap-2">
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {loading ? 'Gerando…' : 'Confirmar'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-slate-500 hover:underline">
          Cancelar
        </button>
      </div>
      {error && <p className="text-xs text-red-600 sm:col-span-4">{error}</p>}
    </form>
  );
}
