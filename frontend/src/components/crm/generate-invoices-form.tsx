'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Receipt } from 'lucide-react';
import { Drawer } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';

const PAYMENT_METHODS = [
  { value: 'pix', label: 'Pix' },
  { value: 'boleto', label: 'Boleto' },
  { value: 'cartao', label: 'Cartão' },
];

// Gera as parcelas (contas a receber) de um Pedido — só pode ser feito uma
// vez (o backend rejeita a segunda tentativa com 409). Redesign de UI: o
// gatilho agora abre um Drawer em vez de expandir uma caixa inline.
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

  return (
    <>
      <Button type="button" variant="link" size="sm" onClick={() => setOpen(true)}>
        Gerar parcelas
      </Button>

      <Drawer open={open} onOpenChange={setOpen} title="Gerar parcelas" description="Cria as faturas (contas a receber) deste pedido.">
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block text-sm font-medium text-slate-700">
            Parcelas
            <input
              type="number"
              min="1"
              max="24"
              required
              value={installments}
              onChange={(e) => setInstallments(e.target.value)}
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            1º vencimento
            <input
              type="date"
              required
              value={firstDueDate}
              onChange={(e) => setFirstDueDate(e.target.value)}
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Meio de pagamento
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-3 border-t border-slate-200 pt-4">
            <Button type="submit" disabled={loading} icon={<Receipt className="h-4 w-4" />}>
              {loading ? 'Gerando…' : 'Confirmar'}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
          </div>
        </form>
      </Drawer>
    </>
  );
}
