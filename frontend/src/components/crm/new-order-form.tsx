'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDrawerClose } from '@/components/ui/create-drawer';
import { OrderItemsFields, type OrderItemRow } from './order-items-fields';

// Pedido manual (spec v3.1, RF012) — sem proposta associada. Até esta fase,
// o único jeito de um Pedido existir era via conversão de uma proposta
// aprovada; isso continua sendo o caminho normal (ver
// ConvertQuoteToOrderForm no Cliente 360°) — este formulário cobre o caso
// de uma venda direta, sem passar pelo fluxo de proposta.
export function NewOrderForm({
  customers,
  onSuccess,
}: {
  customers: { id: string; name: string }[];
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const closeDrawer = useDrawerClose();
  const [customerId, setCustomerId] = useState(customers[0]?.id ?? '');
  const [items, setItems] = useState<OrderItemRow[]>([
    { description: '', quantity: '1', unitPrice: '0' },
  ]);
  const [deliveryDate, setDeliveryDate] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!customerId) {
      setError('Selecione um cliente');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/crm/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId,
          items: items.map((it) => ({
            description: it.description,
            quantity: Number(it.quantity),
            unitPrice: Number(it.unitPrice),
          })),
          deliveryDate: deliveryDate || undefined,
          paymentTerms: paymentTerms || undefined,
          internalNotes: internalNotes || undefined,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const message = Array.isArray(body.message)
          ? body.message.join(', ')
          : (body.message ?? 'Não foi possível criar o pedido');
        throw new Error(message);
      }

      router.refresh();
      closeDrawer();
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <label className="block text-sm font-medium text-slate-700">
        Cliente
        <select
          value={customerId}
          onChange={(e) => setCustomerId(e.target.value)}
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

      <OrderItemsFields items={items} onChange={setItems} />

      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm font-medium text-slate-700">
          Prazo de entrega
          <input
            type="date"
            value={deliveryDate}
            onChange={(e) => setDeliveryDate(e.target.value)}
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Condição de pagamento
          <input
            value={paymentTerms}
            onChange={(e) => setPaymentTerms(e.target.value)}
            placeholder="Ex.: à vista"
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </label>
      </div>

      <label className="block text-sm font-medium text-slate-700">
        Observações internas
        <textarea
          value={internalNotes}
          onChange={(e) => setInternalNotes(e.target.value)}
          rows={2}
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Button type="submit" disabled={loading} icon={<Package className="h-4 w-4" />}>
        {loading ? 'Salvando…' : 'Criar pedido'}
      </Button>
    </form>
  );
}
