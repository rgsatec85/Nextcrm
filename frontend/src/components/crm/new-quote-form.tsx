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

interface ProposalTemplateOption {
  id: string;
  name: string;
}

// Proposta versionada (spec §9/§11) — cada submit cria uma NOVA versão
// (o backend calcula o número e o `PROP-{ano}-{seq}`), nunca edita uma já
// enviada/aprovada. Redesign de UI: o botão "+ Nova proposta" agora abre um
// Drawer em vez de expandir uma caixa inline — mesma lógica de
// validação/envio de antes.
// Fase 6 (spec v3.1) — ganhou "Validade" e seleção de modelo (usado para
// gerar o PDF com cabeçalho/rodapé/cláusulas do modelo).
export function NewQuoteForm({
  opportunityId,
  templates,
}: {
  opportunityId: string;
  templates?: ProposalTemplateOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ItemRow[]>([{ ...EMPTY_ROW }]);
  const [validUntil, setValidUntil] = useState('');
  const [templateId, setTemplateId] = useState('');
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
          validUntil: validUntil || undefined,
          templateId: templateId || undefined,
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
      setValidUntil('');
      setTemplateId('');
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

          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm font-medium text-slate-700">
              Validade
              <input
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </label>
            {templates && templates.length > 0 && (
              <label className="block text-sm font-medium text-slate-700">
                Modelo
                <select
                  value={templateId}
                  onChange={(e) => setTemplateId(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                >
                  <option value="">Sem modelo</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
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
