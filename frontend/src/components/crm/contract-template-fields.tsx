'use client';

import { FormField } from '@/components/form-field';
import { ContractRichTextEditor } from '@/components/crm/contract-rich-text-editor';
import { CONTRACT_TEMPLATE_CATEGORY_LABELS } from '@/lib/crm-constants';

export interface ContractTemplateFormValues {
  name: string;
  category: string;
  body: string;
  isActive: boolean;
}

export const EMPTY_CONTRACT_TEMPLATE_FORM_VALUES: ContractTemplateFormValues = {
  name: '',
  category: '',
  body: '',
  isActive: true,
};

// Campos compartilhados entre criar/editar modelo de contrato — mesmo
// padrão de ProposalTemplateFields, mas o corpo usa o editor rich text
// (ContractRichTextEditor) em vez de um <textarea> de texto puro.
export function ContractTemplateFields({
  values,
  onChange,
}: {
  values: ContractTemplateFormValues;
  onChange: (values: ContractTemplateFormValues) => void;
}) {
  function set<K extends keyof ContractTemplateFormValues>(
    key: K,
    value: ContractTemplateFormValues[K],
  ) {
    onChange({ ...values, [key]: value });
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <FormField
        label="Nome do modelo"
        name="contractTemplateName"
        value={values.name}
        onChange={(v) => set('name', v)}
      />

      <label className="block text-sm font-medium text-slate-700">
        Categoria
        <input
          list="contract-template-categories"
          value={values.category}
          onChange={(e) => set('category', e.target.value)}
          placeholder="Ex.: Prestação de Serviço"
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
        {/* Sugestões, não um enum fechado — o backend aceita qualquer texto
            (ver comentário em create-contract-template.dto.ts). */}
        <datalist id="contract-template-categories">
          {Object.entries(CONTRACT_TEMPLATE_CATEGORY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </datalist>
      </label>

      <div className="sm:col-span-2">
        <span className="block text-sm font-medium text-slate-700">Corpo do modelo</span>
        <p className="mb-1 text-xs text-slate-500 dark:text-slate-400">
          Aceita campos dinâmicos: {'{{cliente.nome}}'}, {'{{valor}}'}, {'{{vigencia_inicio}}'},{' '}
          {'{{vigencia_fim}}'}, {'{{vendedor}}'}, {'{{data}}'} — substituídos quando o modelo é
          aplicado a um contrato.
        </p>
        <ContractRichTextEditor value={values.body} onChange={(html) => set('body', html)} />
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2">
        <input
          type="checkbox"
          checked={values.isActive}
          onChange={(e) => set('isActive', e.target.checked)}
        />
        Ativo (disponível para seleção ao criar contratos)
      </label>
    </div>
  );
}
