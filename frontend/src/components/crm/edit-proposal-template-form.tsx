'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useDrawerClose } from '@/components/ui/create-drawer';
import type { ProposalTemplate } from '@/lib/backend';
import {
  ProposalTemplateFields,
  type ProposalTemplateFormValues,
} from './proposal-template-fields';

function valuesFromTemplate(t: ProposalTemplate): ProposalTemplateFormValues {
  return {
    name: t.name,
    category: t.category ?? '',
    logoUrl: t.logoUrl ?? '',
    primaryColor: t.primaryColor ?? '',
    headerText: t.headerText ?? '',
    footerText: t.footerText ?? '',
    clauses: t.clauses ?? '',
    isActive: t.isActive,
  };
}

export function EditProposalTemplateForm({
  template,
  onSuccess,
}: {
  template: ProposalTemplate;
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const closeDrawer = useDrawerClose();
  const [values, setValues] = useState<ProposalTemplateFormValues>(
    valuesFromTemplate(template),
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/crm/proposal-templates/${template.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: values.name,
          category: values.category || undefined,
          logoUrl: values.logoUrl || undefined,
          primaryColor: values.primaryColor || undefined,
          headerText: values.headerText || undefined,
          footerText: values.footerText || undefined,
          clauses: values.clauses || undefined,
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
      <ProposalTemplateFields values={values} onChange={setValues} />

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
