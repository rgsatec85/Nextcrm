'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useDrawerClose } from '@/components/ui/create-drawer';
import type { ContractTemplate } from '@/lib/backend';
import {
  ContractTemplateFields,
  type ContractTemplateFormValues,
} from './contract-template-fields';

function valuesFromTemplate(t: ContractTemplate): ContractTemplateFormValues {
  return {
    name: t.name,
    category: t.category ?? '',
    body: t.body ?? '',
    isActive: t.isActive,
  };
}

export function EditContractTemplateForm({
  template,
  onSuccess,
}: {
  template: ContractTemplate;
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const closeDrawer = useDrawerClose();
  const [values, setValues] = useState<ContractTemplateFormValues>(
    valuesFromTemplate(template),
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/crm/contract-templates/${template.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: values.name,
          category: values.category || undefined,
          body: values.body || undefined,
          isActive: values.isActive,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const message = Array.isArray(body.message)
          ? body.message.join(', ')
          : (body.message ?? 'Não foi possível salvar o modelo');
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
      <ContractTemplateFields values={values} onChange={setValues} />

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
