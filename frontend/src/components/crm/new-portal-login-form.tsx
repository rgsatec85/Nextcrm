'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FormField } from '@/components/form-field';
import { useDrawerClose } from '@/components/ui/create-drawer';

export function NewPortalLoginForm({
  customerId,
  onSuccess,
}: {
  customerId: string;
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const closeDrawer = useDrawerClose();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/crm/customers/${customerId}/portal-logins`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        const message = Array.isArray(b.message) ? b.message.join(', ') : (b.message ?? 'Não foi possível criar o acesso');
        throw new Error(message);
      }
      setName('');
      setEmail('');
      setPassword('');
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
      <FormField label="Nome" name="portalLoginName" value={name} onChange={setName} />
      <FormField
        label="Email"
        name="portalLoginEmail"
        type="email"
        value={email}
        onChange={setEmail}
      />
      <FormField
        label="Senha"
        name="portalLoginPassword"
        type="password"
        value={password}
        onChange={setPassword}
        minLength={12}
      />

      {error && <p className="text-sm text-red-600 sm:col-span-3">{error}</p>}

      <div className="sm:col-span-3">
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {loading ? 'Criando…' : 'Criar acesso ao portal'}
        </button>
      </div>
    </form>
  );
}
