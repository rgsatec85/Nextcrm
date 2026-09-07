'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useDrawerClose } from '@/components/ui/create-drawer';
import {
  CustomerFormFields,
  type CustomerFormValues,
} from '@/components/crm/customer-form-fields';
import type { Customer } from '@/lib/backend';

function valuesFromCustomer(customer: Customer): CustomerFormValues {
  return {
    name: customer.name,
    tradeName: customer.tradeName ?? '',
    document: customer.document ?? '',
    stateRegistration: customer.stateRegistration ?? '',
    municipalRegistration: customer.municipalRegistration ?? '',
    personType: customer.personType || 'juridica',
    status: customer.status,
    segment: customer.segment ?? '',
    subsegment: customer.subsegment ?? '',
    companySize: customer.companySize ?? '',
    leadSource: customer.leadSource ?? '',
    ownerId: customer.ownerId ?? '',
    isStrategicAccount: customer.isStrategicAccount,
    email: customer.email ?? '',
    phone: customer.phone ?? '',
    website: customer.website ?? '',
    notes: customer.notes ?? '',
  };
}

// Edição de um cliente já cadastrado (PATCH /customers/:id — endpoint que já
// existia no backend desde a Fase 1, mas nunca teve UI). Mesmo padrão dos
// formulários de criação: client component dentro do drawer, passa pelo
// proxy autenticado em /api/crm/* (o JWT fica em cookie httpOnly, invisível
// ao JS do browser). Reaproveita os mesmos campos de `NewCustomerForm` via
// `CustomerFormFields`, pré-preenchidos com os dados atuais.
export function EditCustomerForm({
  customer,
  owners,
  onSuccess,
}: {
  customer: Customer;
  owners?: { id: string; name: string }[];
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const closeDrawer = useDrawerClose();
  const [values, setValues] = useState<CustomerFormValues>(() => valuesFromCustomer(customer));
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function handleChange<K extends keyof CustomerFormValues>(field: K, value: CustomerFormValues[K]) {
    setValues((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(`/api/crm/customers/${customer.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: values.name,
          tradeName: values.tradeName || undefined,
          document: values.document || undefined,
          stateRegistration: values.stateRegistration || undefined,
          municipalRegistration: values.municipalRegistration || undefined,
          personType: values.personType,
          segment: values.segment || undefined,
          subsegment: values.subsegment || undefined,
          companySize: values.companySize || undefined,
          leadSource: values.leadSource || undefined,
          isStrategicAccount: values.isStrategicAccount,
          email: values.email || undefined,
          phone: values.phone || undefined,
          website: values.website || undefined,
          notes: values.notes || undefined,
          status: values.status,
          ownerId: values.ownerId || undefined,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const message = Array.isArray(body.message)
          ? body.message.join(', ')
          : (body.message ?? 'Não foi possível salvar as alterações');
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
    <form onSubmit={handleSubmit} className="space-y-6">
      <CustomerFormFields
        values={values}
        onChange={handleChange}
        owners={owners}
        createdAt={customer.createdAt}
      />

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
