import Link from 'next/link';
import { cookies } from 'next/headers';
import { backend } from '@/lib/backend';
import { SESSION_COOKIE } from '@/lib/session';

export default async function PortalHomePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)!.value;

  const [me, orders, invoices, tickets] = await Promise.all([
    backend.portalMe(token),
    backend.portalOrders(token),
    backend.portalInvoices(token),
    backend.portalTickets(token),
  ]);

  const overdueInvoices = invoices.filter((i) => i.isOverdue);
  const openTickets = tickets.filter((t) => t.status !== 'resolvido' && t.status !== 'fechado');

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-2xl font-semibold text-slate-900">Olá, {me.name}</h1>
        <p className="text-sm text-slate-500">Este é o resumo da sua conta.</p>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <SummaryCard
          label="Pedidos"
          value={orders.length}
          href="/portal/pedidos"
          linkLabel="Ver pedidos"
        />
        <SummaryCard
          label="Faturas vencidas"
          value={overdueInvoices.length}
          href="/portal/financeiro"
          linkLabel="Ver financeiro"
          tone={overdueInvoices.length > 0 ? 'red' : undefined}
        />
        <SummaryCard
          label="Chamados em aberto"
          value={openTickets.length}
          href="/portal/chamados"
          linkLabel="Ver chamados"
        />
      </section>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  href,
  linkLabel,
  tone,
}: {
  label: string;
  value: number;
  href: string;
  linkLabel: string;
  tone?: 'red';
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-xs font-medium uppercase text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${tone === 'red' ? 'text-red-700' : 'text-slate-900'}`}>
        {value}
      </p>
      <Link href={href} className="mt-2 inline-block text-sm text-brand-600 hover:underline">
        {linkLabel}
      </Link>
    </div>
  );
}
