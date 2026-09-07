import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 text-center">
      <div>
        <h1 className="text-3xl font-bold text-brand-700">CRM Enterprise SaaS</h1>
        <p className="mt-2 max-w-md text-slate-600">
          CRM comercial, financeiro e portal do cliente em uma plataforma
          multi-tenant. Cada empresa tem seu ambiente isolado.
        </p>
      </div>
      <div className="flex gap-3">
        <Link
          href="/cadastro"
          className="rounded-md bg-brand-600 px-5 py-2.5 font-medium text-white hover:bg-brand-700"
        >
          Criar conta da empresa
        </Link>
        <Link
          href="/login"
          className="rounded-md border border-slate-300 px-5 py-2.5 font-medium text-slate-700 hover:bg-slate-100"
        >
          Entrar
        </Link>
      </div>
    </main>
  );
}
