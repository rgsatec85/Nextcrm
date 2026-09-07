'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FormField } from '@/components/form-field';
import { useDrawerClose } from '@/components/ui/create-drawer';

export function NewContactForm({
  customerId,
  onSuccess,
}: {
  customerId: string;
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const closeDrawer = useDrawerClose();
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(`/api/crm/customers/${customerId}/contacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          role: role || undefined,
          email: email || undefined,
          phone: phone || undefined,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const message = Array.isArray(body.message)
          ? body.message.join(', ')
          : (body.message ?? 'Não foi possível adicionar o contato');
        throw new Error(message);
      }

      setName('');
      setRole('');
      setEmail('');
      setPhone('');
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
    <form onSubmit={handleSubmit} className="grid gap-3 sm:grid-cols-4">
      <FormField label="Nome" name="contactName" value={name} onChange={setName} />
      <FormField
        label="Cargo"
        name="contactRole"
        value={role}
        onChange={setRole}
        required={false}
      />
      <FormField
        label="Email"
        name="contactEmail"
        type="email"
        value={email}
        onChange={setEmail}
        required={false}
      />
      <FormField
        label="Telefone"
        name="contactPhone"
        value={phone}
        onChange={setPhone}
        required={false}
      />

      {error && <p className="text-sm text-red-600 sm:col-span-4">{error}</p>}

      <div className="sm:col-span-4">
        <button
          type="submit"
          disabled={loading}
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          {loading ? 'Salvando…' : 'Adicionar contato'}
        </button>
      </div>
    </form>
  );
}
