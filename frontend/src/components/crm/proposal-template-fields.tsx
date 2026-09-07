'use client';

import { FormField } from '@/components/form-field';
import { PROPOSAL_TEMPLATE_CATEGORY_LABELS } from '@/lib/crm-constants';

export interface ProposalTemplateFormValues {
  name: string;
  category: string;
  logoUrl: string;
  primaryColor: string;
  headerText: string;
  footerText: string;
  clauses: string;
  isActive: boolean;
}

export const EMPTY_PROPOSAL_TEMPLATE_FORM_VALUES: ProposalTemplateFormValues = {
  name: '',
  category: '',
  logoUrl: '',
  primaryColor: '',
  headerText: '',
  footerText: '',
  clauses: '',
  isActive: true,
};

// Campos compartilhados entre criar/editar modelo de proposta (mesmo padrão
// de CustomerFormFields em customer-form-fields.tsx) — evita duplicar o JSX
// entre NewProposalTemplateForm e EditProposalTemplateForm.
export function ProposalTemplateFields({
  values,
  onChange,
}: {
  values: ProposalTemplateFormValues;
  onChange: (values: ProposalTemplateFormValues) => void;
}) {
  function set<K extends keyof ProposalTemplateFormValues>(
    key: K,
    value: ProposalTemplateFormValues[K],
  ) {
    onChange({ ...values, [key]: value });
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <FormField
        label="Nome do modelo"
        name="templateName"
        value={values.name}
        onChange={(v) => set('name', v)}
      />

      <label className="block text-sm font-medium text-slate-700">
        Categoria
        <input
          list="proposal-template-categories"
          value={values.category}
          onChange={(e) => set('category', e.target.value)}
          placeholder="Ex.: Venda de Serviço"
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
        {/* Sugestões, não um enum fechado — o backend aceita qualquer texto
            (ver comentário em create-proposal-template.dto.ts). */}
        <datalist id="proposal-template-categories">
          {Object.entries(PROPOSAL_TEMPLATE_CATEGORY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </datalist>
      </label>

      <FormField
        label="URL do logo"
        name="templateLogoUrl"
        value={values.logoUrl}
        onChange={(v) => set('logoUrl', v)}
        required={false}
        placeholder="https://…"
      />

      <label className="block text-sm font-medium text-slate-700">
        Cor primária
        <input
          type="color"
          value={values.primaryColor || '#2563eb'}
          onChange={(e) => set('primaryColor', e.target.value)}
          className="mt-1 block h-9 w-16 rounded-md border border-slate-300"
        />
      </label>

      <label className="block text-sm font-medium text-slate-700 sm:col-span-2">
        Texto de cabeçalho
        <textarea
          value={values.headerText}
          onChange={(e) => set('headerText', e.target.value)}
          rows={2}
          placeholder="Aceita campos dinâmicos: {{cliente.nome}}, {{valor_total}}, {{vendedor}}, {{data}}"
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </label>

      <label className="block text-sm font-medium text-slate-700 sm:col-span-2">
        Cláusulas / termos e condições
        <textarea
          value={values.clauses}
          onChange={(e) => set('clauses', e.target.value)}
          rows={4}
          placeholder="Aceita os mesmos campos dinâmicos do cabeçalho"
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </label>

      <label className="block text-sm font-medium text-slate-700 sm:col-span-2">
        Texto de rodapé
        <textarea
          value={values.footerText}
          onChange={(e) => set('footerText', e.target.value)}
          rows={2}
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </label>

      <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2">
        <input
          type="checkbox"
          checked={values.isActive}
          onChange={(e) => set('isActive', e.target.checked)}
        />
        Ativo (disponível para seleção ao criar propostas)
      </label>
    </div>
  );
}
