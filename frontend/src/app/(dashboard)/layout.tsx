import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { backend } from '@/lib/backend';
import { SESSION_COOKIE } from '@/lib/session';
import { LogoutButton } from '@/components/logout-button';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) {
    redirect('/login');
  }

  // Se o token for inválido/expirado, o backend responde 401 — tratamos como
  // sessão encerrada e mandamos de volta pro login (defesa em profundidade
  // além do middleware, que só checa a presença do cookie).
  const me = (await backend.me(token).catch(() => null)) as {
    role: { slug: string };
  } | null;
  if (!me) {
    redirect('/login');
  }

  // Fase 3 — Portal do Cliente: cliente_portal não tem nenhuma rota interna
  // liberada (RolesGuard já bloquearia cada endpoint), então nem chega a
  // renderizar o dashboard — vai direto para a própria área.
  if (me.role.slug === 'cliente_portal') {
    redirect('/portal');
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <span className="font-semibold text-brand-700">CRM Enterprise SaaS</span>
          <nav className="flex items-center gap-5 text-sm font-medium text-slate-600">
            <Link href="/dashboard" className="hover:text-brand-700">
              Dashboard
            </Link>
            <Link href="/dashboard/clientes" className="hover:text-brand-700">
              Clientes
            </Link>
            <Link href="/dashboard/pipeline" className="hover:text-brand-700">
              Pipeline
            </Link>
            <Link href="/dashboard/financeiro" className="hover:text-brand-700">
              Financeiro
            </Link>
            <Link href="/dashboard/contratos" className="hover:text-brand-700">
              Contratos
            </Link>
            <Link href="/dashboard/chamados" className="hover:text-brand-700">
              Chamados
            </Link>
            <Link href="/dashboard/base-de-conhecimento" className="hover:text-brand-700">
              Base de conhecimento
            </Link>
            <Link href="/dashboard/webhooks" className="hover:text-brand-700">
              Webhooks
            </Link>
            <Link href="/dashboard/assistente" className="hover:text-brand-700">
              Assistente
            </Link>
          </nav>
          <LogoutButton />
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}
