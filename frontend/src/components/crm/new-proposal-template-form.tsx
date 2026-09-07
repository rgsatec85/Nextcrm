'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useDrawerClose } from '@/components/ui/create-drawer';
import {
  ProposalTemplateFields,
  EMPTY_PROPOSAL_TEMPLATE_FORM_VALUES,
  type ProposalTemplateFormValues,
} from './proposal-template-fields';

// Biblioteca de modelos de proposta (spec v3.1) — restrita a admin/gestor no
// backend (ProposalTemplatesController); a página só renderiza este form
// para esses perfis (ver propostas/modelos/page.tsx).
export function NewProposalTemplateForm({ onSuccess }: { onSuccess?: () => void } = {}) {
  const router = useRouter();
  const closeDrawer = useDrawerClose();
  const [values, setValues] = useState<ProposalTemplateFormValues>(
    EMPTY_PROPOSAL_TEMPLATE_FORM_VALUES,
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/crm/proposal-templates', {
        method: 'POST',
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
          : (body.message ?? 'Não foi possível criar o modelo');
        throw new Error(message);
      }

      setValues(EMPTY_PROPOSAL_TEMPLATE_FORM_VALUES);
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
        {loading ? 'Salvando…' : 'Criar modelo'}
      </button>
    </form>
  );
}
