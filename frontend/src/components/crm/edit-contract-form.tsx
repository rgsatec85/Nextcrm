'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FormField } from '@/components/form-field';
import { useDrawerClose } from '@/components/ui/create-drawer';
import { ContractRichTextEditor } from '@/components/crm/contract-rich-text-editor';
import type { Contract, ContractTemplate } from '@/lib/backend';

function toDateInput(value: string) {
  // startDate/endDate vêm do backend como ISO completo (ou já como
  // yyyy-mm-dd, dependendo do driver) — <input type="date"> só aceita
  // yyyy-mm-dd.
  return value.slice(0, 10);
}

export function EditContractForm({
  contract,
  templates,
  onSuccess,
}: {
  contract: Contract;
  templates?: ContractTemplate[];
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const closeDrawer = useDrawerClose();
  const isDraft = contract.status === 'rascunho';

  const [title, setTitle] = useState(contract.title);
  const [value, setValue] = useState(String(contract.value ?? ''));
  const [startDate, setStartDate] = useState(toDateInput(contract.startDate));
  const [endDate, setEndDate] = useState(toDateInput(contract.endDate));
  const [renewalPeriodMonths, setRenewalPeriodMonths] = useState(
    contract.renewalPeriodMonths ? String(contract.renewalPeriodMonths) : '',
  );
  const [body, setBody] = useState(contract.body ?? '');
  const [templateId, setTemplateId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [applyingTemplate, setApplyingTemplate] = useState(false);

  const activeTemplates = (templates ?? []).filter((t) => t.isActive);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/crm/contracts/${contract.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          value: value ? Number(value) : undefined,
          startDate,
          endDate,
          renewalPeriodMonths: renewalPeriodMonths ? Number(renewalPeriodMonths) : undefined,
          // O corpo só é enviado quando o contrato está em rascunho — fora
          // disso o backend rejeita a alteração (409), então nem tentamos.
          ...(isDraft ? { body } : {}),
        }),
      });

      if (!res.ok) {
        const responseBody = await res.json().catch(() => ({}));
        const message = Array.isArray(responseBody.message)
          ? responseBody.message.join(', ')
          : (responseBody.message ?? 'Não foi possível salvar o contrato');
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

  async function handleApplyTemplate() {
    if (!templateId) return;
    setError(null);
    setApplyingTemplate(true);
    try {
      const res = await fetch(`/api/crm/contracts/${contract.id}/apply-template`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId }),
      });
      if (!res.ok) {
        const responseBody = await res.json().catch(() => ({}));
        setError(responseBody.message ?? 'Não foi possível aplicar o modelo');
        return;
      }
      const updated: Contract = await res.json();
      setBody(updated.body ?? '');
    } finally {
      setApplyingTemplate(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-3">
      <FormField label="Título" name="editContractTitle" value={title} onChange={setTitle} />
      <FormField
        label="Valor (R$)"
        name="editContractValue"
        type="number"
        value={value}
        onChange={setValue}
        required={false}
      />
      <FormField
        label="Início"
        name="editContractStart"
        type="date"
        value={startDate}
        onChange={setStartDate}
      />
      <FormField
        label="Fim"
        name="editContractEnd"
        type="date"
        value={endDate}
        onChange={setEndDate}
      />
      <FormField
        label="Renovação (meses)"
        name="editContractRenewal"
        type="number"
        value={renewalPeriodMonths}
        onChange={setRenewalPeriodMonths}
        required={false}
      />

      <div className="sm:col-span-3">
        <span className="block text-sm font-medium text-slate-700">Corpo do contrato</span>
        {!isDraft && (
          <p className="mb-1 text-xs text-amber-600 dark:text-amber-500">
            Contrato {contract.status} — o corpo está travado. Só é editável enquanto em rascunho.
          </p>
        )}
        {isDraft && activeTemplates.length > 0 && (
          <div className="mb-2 flex flex-wrap items-end gap-2">
            <label className="block text-sm font-medium text-slate-700">
              Aplicar modelo
              <select
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
                className="mt-1 block w-56 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                <option value="">Selecione…</option>
                {activeTemplates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={handleApplyTemplate}
              disabled={!templateId || applyingTemplate}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              {applyingTemplate ? 'Aplicando…' : 'Aplicar (substitui o corpo atual)'}
            </button>
          </div>
        )}
        <ContractRichTextEditor value={body} onChange={setBody} readOnly={!isDraft} />
      </div>

      {error && <p className="text-sm text-red-600 sm:col-span-3">{error}</p>}

      <div className="sm:col-span-3">
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {loading ? 'Salvando…' : 'Salvar alterações'}
        </button>
      </div>
    </form>
  );
}
