'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Plus, Trash2 } from 'lucide-react';
import { Drawer } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';

interface ItemRow {
  description: string;
  quantity: string;
  unitPrice: string;
}

const EMPTY_ROW: ItemRow = { description: '', quantity: '1', unitPrice: '0' };

// Proposta versionada (spec §9/§11) — cada submit cria uma NOVA versão
// (o backend calcula o número), nunca edita uma já enviada/aprovada.
// Redesign de UI: o botão "+ Nova proposta" agora abre um Drawer em vez de
// expandir uma caixa inline — mesma lógica de validação/envio de antes.
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

  return (
    <>
      <Button
        type="button"
        variant="link"
        size="sm"
        icon={<Plus className="h-3.5 w-3.5" />}
        onClick={() => setOpen(true)}
      >
        Nova proposta
      </Button>

      <Drawer
        open={open}
        onOpenChange={setOpen}
        title="Nova proposta"
        description="Cada envio cria uma nova versão da proposta para esta oportunidade."
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-3">
            {items.map((item, index) => (
              <div key={index} className="grid grid-cols-6 gap-2 rounded-lg border border-slate-200 p-3">
                <input
                  placeholder="Descrição"
                  value={item.description}
                  onChange={(e) => updateItem(index, 'description', e.target.value)}
                  required
                  className="col-span-6 rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 sm:col-span-3"
                />
                <input
                  type="number"
                  min="1"
                  placeholder="Qtd"
                  value={item.quantity}
                  onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                  className="col-span-2 rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 sm:col-span-1"
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Preço unit."
                  value={item.unitPrice}
                  onChange={(e) => updateItem(index, 'unitPrice', e.target.value)}
                  className="col-span-3 rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 sm:col-span-1"
                />
                <button
                  type="button"
                  onClick={() => setItems((prev) => prev.filter((_, i) => i !== index))}
                  disabled={items.length === 1}
                  className="col-span-1 flex items-center justify-center rounded-md text-slate-400 hover:text-red-600 disabled:opacity-30"
                  aria-label="Remover item"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}

            <button
              type="button"
              onClick={() => setItems((prev) => [...prev, { ...EMPTY_ROW }])}
              className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline"
            >
              <Plus className="h-3.5 w-3.5" /> Adicionar item
            </button>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-3 border-t border-slate-200 pt-4">
            <Button type="submit" disabled={loading} icon={<FileText className="h-4 w-4" />}>
              {loading ? 'Salvando…' : 'Salvar proposta'}
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
