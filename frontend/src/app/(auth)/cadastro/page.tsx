'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { FormField } from '@/components/form-field';

// Cadastro self-service de empresa (spec §6): Nome, CNPJ, Admin, Email, Senha
// → cria o tenant + usuário admin e já autentica.
export default function CadastroPage() {
  const router = useRouter();
  const [companyName, setCompanyName] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName,
          cnpj: cnpj.replace(/\D/g, ''),
          adminName,
          adminEmail,
          adminPassword,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const message = Array.isArray(body.message)
          ? body.message.join(', ')
          : (body.message ?? 'Não foi possível criar a conta');
        throw new Error(message);
      }

      router.push('/dashboard');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <h1 className="text-xl font-semibold text-slate-900">Criar conta da empresa</h1>
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <FormField
          label="Nome da empresa"
          name="companyName"
          value={companyName}
          onChange={setCompanyName}
        />
        <FormField
          label="CNPJ (somente números)"
          name="cnpj"
          value={cnpj}
          onChange={setCnpj}
          minLength={14}
          placeholder="00000000000000"
        />
        <FormField
          label="Seu nome"
          name="adminName"
          value={adminName}
          onChange={setAdminName}
        />
        <FormField
          label="Seu email"
          name="adminEmail"
          type="email"
          value={adminEmail}
          onChange={setAdminEmail}
        />
        <FormField
          label="Senha (mín. 12 caracteres)"
          name="adminPassword"
          type="password"
          value={adminPassword}
          onChange={setAdminPassword}
          minLength={12}
        />

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {loading ? 'Criando conta…' : 'Criar conta'}
        </button>
      </form>
      <p className="mt-4 text-sm text-slate-600">
        Já tem uma conta?{' '}
        <Link href="/login" className="font-medium text-brand-600 hover:underline">
          Entrar
        </Link>
      </p>
    </>
  );
}
