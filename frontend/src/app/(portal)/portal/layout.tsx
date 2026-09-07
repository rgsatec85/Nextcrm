import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { backend } from '@/lib/backend';
import { SESSION_COOKIE } from '@/lib/session';
import { LogoutButton } from '@/components/logout-button';

// Portal do Cliente (spec Fase 3) — layout próprio, separado do dashboard
// interno. O guard aqui é só UX (evita renderizar a área errada); o
// isolamento de dados de verdade é feito inteiramente no backend
// (PortalService hard-locka por user.customerId em toda query).
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) {
    redirect('/login');
  }

  const me = (await backend.me(token).catch(() => null)) as {
    role: { slug: string };
  } | null;
  if (!me) {
    redirect('/login');
  }

  // Mirror-image guard do dashboard: qualquer perfil que NÃO seja
  // cliente_portal não tem nenhuma rota /portal liberada no backend
  // (RolesGuard só aceita cliente_portal em PortalController).
  if (me.role.slug !== 'cliente_portal') {
    redirect('/dashboard');
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <span className="font-semibold text-brand-700">Portal do Cliente</span>
          <nav className="flex items-center gap-5 text-sm font-medium text-slate-600">
            <Link href="/portal" className="hover:text-brand-700">
              Início
            </Link>
            <Link href="/portal/pedidos" className="hover:text-brand-700">
              Pedidos
            </Link>
            <Link href="/portal/financeiro" className="hover:text-brand-700">
              Financeiro
            </Link>
            <Link href="/portal/contratos" className="hover:text-brand-700">
              Contratos
            </Link>
            <Link href="/portal/chamados" className="hover:text-brand-700">
              Chamados
            </Link>
            <Link href="/portal/base-de-conhecimento" className="hover:text-brand-700">
              Ajuda
            </Link>
          </nav>
          <LogoutButton />
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}
