import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { backend } from '@/lib/backend';
import { SESSION_COOKIE } from '@/lib/session';
import { LogoutButton } from '@/components/logout-button';
import { Sidebar } from '@/components/layout/sidebar';

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
    name: string;
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

  // Nome da empresa no topo da sidebar — não crítico: se a chamada falhar
  // por qualquer motivo, cai para um rótulo genérico em vez de quebrar todo
  // o layout do dashboard.
  const company = await backend
    .myCompany(token)
    .catch(() => null) as { name: string } | null;

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950">
      <Sidebar companyName={company?.name ?? 'CRM Enterprise'} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6 dark:border-slate-800 dark:bg-slate-900">
          <div>
            <p className="text-xs text-slate-400">Bem-vindo(a)</p>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{me.name}</p>
          </div>
          <LogoutButton />
        </header>
        <main className="flex-1 overflow-x-hidden px-6 py-8">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
