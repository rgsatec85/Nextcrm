'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FormField } from '@/components/form-field';
import { useDrawerClose } from '@/components/ui/create-drawer';
import { ContractRichTextEditor } from '@/components/crm/contract-rich-text-editor';
import type { ContractTemplate } from '@/lib/backend';

interface NewContractFormProps {
  customerId?: string;
  customers?: { id: string; name: string }[];
  // Fase 9 (RF013) — modelos ativos disponíveis para pré-preencher o corpo.
  // Sem lista (ou vazia) o contrato simplesmente nasce sem modelo — o corpo
  // pode ser digitado direto no editor abaixo.
  templates?: ContractTemplate[];
  onSuccess?: () => void;
}

export function NewContractForm({ customerId, customers, templates, onSuccess }: NewContractFormProps) {
  const router = useRouter();
  const closeDrawer = useDrawerClose();
  const [selectedCustomerId, setSelectedCustomerId] = useState(
    customerId ?? customers?.[0]?.id ?? '',
  );
  const [title, setTitle] = useState('');
  const [value, setValue] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [renewalPeriodMonths, setRenewalPeriodMonths] = useState('12');
  const [templateId, setTemplateId] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const activeTemplates = (templates ?? []).filter((t) => t.isActive);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!selectedCustomerId) {
      setError('Selecione um cliente');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/crm/contracts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: selectedCustomerId,
          title,
          value: value ? Number(value) : undefined,
          startDate,
          endDate,
          renewalPeriodMonths: renewalPeriodMonths ? Number(renewalPeriodMonths) : undefined,
          templateId: templateId || undefined,
          // Se um modelo foi selecionado, o backend copia o corpo dele (com
          // os campos dinâmicos já substituídos) e ignora este `body` — só
          // é usado quando não há modelo.
          body: !templateId && body ? body : undefined,
        }),
      });

      if (!res.ok) {
        const responseBody = await res.json().catch(() => ({}));
        const message = Array.isArray(responseBody.message)
          ? responseBody.message.join(', ')
          : (responseBody.message ?? 'Não foi possível criar o contrato');
        throw new Error(message);
      }

      setTitle('');
      setValue('');
      setStartDate('');
      setEndDate('');
      setTemplateId('');
      setBody('');
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
    <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-3">
      {!customerId && customers && (
        <label className="block text-sm font-medium text-slate-700">
          Cliente
          <select
            value={selectedCustomerId}
            onChange={(e) => setSelectedCustomerId(e.target.value)}
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
      )}

      <FormField label="Título" name="contractTitle" value={title} onChange={setTitle} />
      <FormField
        label="Valor (R$)"
        name="contractValue"
        type="number"
        value={value}
        onChange={setValue}
        required={false}
      />
      <FormField
        label="Início"
        name="contractStart"
        type="date"
        value={startDate}
        onChange={setStartDate}
      />
      <FormField label="Fim" name="contractEnd" type="date" value={endDate} onChange={setEndDate} />
      <FormField
        label="Renovação (meses)"
        name="contractRenewal"
        type="number"
        value={renewalPeriodMonths}
        onChange={setRenewalPeriodMonths}
        required={false}
      />

      {activeTemplates.length > 0 && (
        <label className="block text-sm font-medium text-slate-700">
          Modelo (opcional)
          <select
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            <option value="">Sem modelo — escrever direto</option>
            {activeTemplates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="sm:col-span-3">
        <span className="block text-sm font-medium text-slate-700">
          Corpo do contrato {templateId && '(preenchido pelo modelo ao salvar)'}
        </span>
        {templateId ? (
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            O corpo será copiado do modelo selecionado, com os campos dinâmicos já substituídos.
            Depois de criado, o contrato continua em rascunho e pode ser editado livremente.
          </p>
        ) : (
          <div className="mt-1">
            <ContractRichTextEditor value={body} onChange={setBody} />
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-600 sm:col-span-3">{error}</p>}

      <div className="sm:col-span-3">
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {loading ? 'Salvando…' : 'Adicionar contrato'}
        </button>
      </div>
    </form>
  );
}
