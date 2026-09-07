'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FormField } from '@/components/form-field';

// Formulário de criação de cliente (spec §10). Passa pelo proxy autenticado
// em /api/crm/* em vez de chamar o backend direto — client components não
// têm acesso ao cookie httpOnly com o JWT.
export function NewCustomerForm() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [segment, setSegment] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/crm/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          segment: segment || undefined,
          email: email || undefined,
          phone: phone || undefined,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const message = Array.isArray(body.message)
          ? body.message.join(', ')
          : (body.message ?? 'Não foi possível criar o cliente');
        throw new Error(message);
      }

      setName('');
      setSegment('');
      setEmail('');
      setPhone('');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
      <FormField label="Nome" name="name" value={name} onChange={setName} />
      <FormField
        label="Segmento"
        name="segment"
        value={segment}
        onChange={setSegment}
        required={false}
      />
      <FormField
        label="Email"
        name="email"
        type="email"
        value={email}
        onChange={setEmail}
        required={false}
      />
      <FormField
        label="Telefone"
        name="phone"
        value={phone}
        onChange={setPhone}
        required={false}
      />

      {error && <p className="text-sm text-red-600 sm:col-span-2">{error}</p>}

      <div className="sm:col-span-2">
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {loading ? 'Salvando…' : 'Adicionar cliente'}
        </button>
      </div>
    </form>
  );
}
