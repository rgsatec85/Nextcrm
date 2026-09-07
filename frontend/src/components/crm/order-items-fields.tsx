'use client';

import { Plus, Trash2 } from 'lucide-react';

export interface OrderItemRow {
  description: string;
  quantity: string;
  unitPrice: string;
}

export const EMPTY_ORDER_ITEM_ROW: OrderItemRow = {
  description: '',
  quantity: '1',
  unitPrice: '0',
};

// Editor de itens compartilhado entre ConvertQuoteToOrderForm, NewOrderForm
// e EditOrderForm (Fase 7, spec v3.1, RF012) — mesmo layout de linhas já
// usado em NewQuoteForm (Fase 1/6), extraído aqui para não triplicar o JSX.
export function OrderItemsFields({
  items,
  onChange,
}: {
  items: OrderItemRow[];
  onChange: (items: OrderItemRow[]) => void;
}) {
  function updateItem(index: number, field: keyof OrderItemRow, value: string) {
    onChange(items.map((it, i) => (i === index ? { ...it, [field]: value } : it)));
  }

  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <div
          key={index}
          className="grid grid-cols-6 gap-2 rounded-lg border border-slate-200 p-3"
        >
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
            onClick={() => onChange(items.filter((_, i) => i !== index))}
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
        onClick={() => onChange([...items, { ...EMPTY_ORDER_ITEM_ROW }])}
        className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline"
      >
        <Plus className="h-3.5 w-3.5" /> Adicionar item
      </button>
    </div>
  );
}
