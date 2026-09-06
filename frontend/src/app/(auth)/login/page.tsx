'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { FormField } from '@/components/form-field';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message ?? 'Credenciais inválidas');
      }

      // Fase 3 — Portal do Cliente: cliente_portal tem sua própria área,
      // separada do dashboard interno (o layout de cada lado também
      // redireciona o perfil errado, isto aqui só evita o pulo extra).
      const { user: loggedInUser } = await res.json().catch(() => ({ user: null }));
      router.push(loggedInUser?.role === 'cliente_portal' ? '/portal' : '/dashboard');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <h1 className="text-xl font-semibold text-slate-900">Entrar</h1>
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <FormField label="Email" name="email" type="email" value={email} onChange={setEmail} />
        <FormField
          label="Senha"
          name="password"
          type="password"
          value={password}
          onChange={setPassword}
        />

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {loading ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
      <p className="mt-4 text-sm text-slate-600">
        Ainda não tem uma conta?{' '}
        <Link href="/cadastro" className="font-medium text-brand-600 hover:underline">
          Cadastre sua empresa
        </Link>
      </p>
    </>
  );
}
