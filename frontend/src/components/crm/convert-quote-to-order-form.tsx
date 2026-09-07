'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRightLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDrawerClose } from '@/components/ui/create-drawer';
import { OrderItemsFields, type OrderItemRow } from './order-items-fields';

interface ConvertQuoteToOrderFormProps {
  quoteId: string;
  items: Array<{ description: string; quantity: number; unitPrice: number }>;
  onSuccess?: () => void;
}

// Fase 7 (spec v3.1, RF012) — conversão explícita de proposta aprovada em
// Pedido, substituindo a criação automática das Fases 1-6. Itens vêm
// pré-preenchidos a partir da própria proposta e são revisáveis (quantidade,
// preço, adicionar/remover) antes de confirmar — junto com prazo de entrega
// e condição de pagamento, que a proposta não tinha.
export function ConvertQuoteToOrderForm({
  quoteId,
  items: initialItems,
  onSuccess,
}: ConvertQuoteToOrderFormProps) {
  const router = useRouter();
  const closeDrawer = useDrawerClose();
  const [items, setItems] = useState<OrderItemRow[]>(
    initialItems.length > 0
      ? initialItems.map((it) => ({
          description: it.description,
          quantity: String(it.quantity),
          unitPrice: String(it.unitPrice),
        }))
      : [{ description: '', quantity: '1', unitPrice: '0' }],
  );
  const [deliveryDate, setDeliveryDate] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/crm/quotes/${quoteId}/convert-to-order`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
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
          : (body.message ?? 'Não foi possível converter em pedido');
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
            placeholder="Ex.: 30/60/90"
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
          placeholder="Visível só internamente — não aparece no Portal do Cliente"
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Button type="submit" disabled={loading} icon={<ArrowRightLeft className="h-4 w-4" />}>
        {loading ? 'Convertendo…' : 'Confirmar pedido'}
      </Button>
    </form>
  );
}
