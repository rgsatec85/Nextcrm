'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useDrawerClose } from '@/components/ui/create-drawer';
import type { Order } from '@/lib/backend';
import { OrderItemsFields, type OrderItemRow } from './order-items-fields';

function rowsFromOrder(order: Order): OrderItemRow[] {
  if (!order.items || order.items.length === 0) {
    return [{ description: '', quantity: '1', unitPrice: '0' }];
  }
  return order.items.map((it) => ({
    description: it.description,
    quantity: String(it.quantity),
    unitPrice: String(it.unitPrice),
  }));
}

// Edição de Pedido (spec v3.1, RF012 — "itens editáveis" + prazo de
// entrega/condição de pagamento/observações internas). Só envia `items` no
// PATCH se o usuário de fato mexeu neles — enviar sempre faria toda edição
// (mesmo só de uma observação) esbarrar na trava do backend que impede
// alterar itens depois que já existe fatura gerada (OrdersService.update).
export function EditOrderForm({
  order,
  onSuccess,
}: {
  order: Order;
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const closeDrawer = useDrawerClose();
  const initialItems = rowsFromOrder(order);
  const [initialItemsSnapshot] = useState(() => JSON.stringify(initialItems));
  const [items, setItems] = useState<OrderItemRow[]>(initialItems);
  const [deliveryDate, setDeliveryDate] = useState(order.deliveryDate?.slice(0, 10) ?? '');
  const [paymentTerms, setPaymentTerms] = useState(order.paymentTerms ?? '');
  const [internalNotes, setInternalNotes] = useState(order.internalNotes ?? '');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const itemsChanged = JSON.stringify(items) !== initialItemsSnapshot;

      const res = await fetch(`/api/crm/orders/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(itemsChanged
            ? {
                items: items.map((it) => ({
                  description: it.description,
                  quantity: Number(it.quantity),
                  unitPrice: Number(it.unitPrice),
                })),
              }
            : {}),
          deliveryDate: deliveryDate || undefined,
          paymentTerms: paymentTerms || undefined,
          internalNotes: internalNotes || undefined,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const message = Array.isArray(body.message)
          ? body.message.join(', ')
          : (body.message ?? 'Não foi possível salvar o pedido');
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

      <button
        type="submit"
        disabled={loading}
        className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
      >
        {loading ? 'Salvando…' : 'Salvar alterações'}
      </button>
    </form>
  );
}
