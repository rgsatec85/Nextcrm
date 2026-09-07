import Link from 'next/link';
import { cookies } from 'next/headers';
import { backend } from '@/lib/backend';
import { SESSION_COOKIE } from '@/lib/session';
import { TICKET_PRIORITY_LABELS, TICKET_STATUS_LABELS } from '@/lib/crm-constants';
import { NewTicketForm } from '@/components/crm/new-ticket-form';

const STATUS_BADGE: Record<string, string> = {
  aberto: 'bg-amber-100 text-amber-700',
  em_andamento: 'bg-brand-100 text-brand-700',
  resolvido: 'bg-emerald-100 text-emerald-700',
  fechado: 'bg-slate-100 text-slate-600',
};

// Atendimento interno (spec Fase 3): chamados de todos os clientes visíveis
// ao usuário (ABAC de vendedor aplicado no backend — TicketsService).
export default async function ChamadosPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)!.value;

  const [tickets, customers] = await Promise.all([
    backend.tickets(token),
    backend.customers(token),
  ]);

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-2xl font-semibold text-slate-900">Chamados</h1>
        <p className="text-sm text-slate-500">
          Atendimento interno — SLA calculado pela prioridade no momento da abertura.
        </p>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-3 font-medium text-slate-900">Abrir novo chamado</h2>
        <NewTicketForm customers={customers.map((c) => ({ id: c.id, name: c.name }))} />
      </section>

      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="font-medium text-slate-900">Todos os chamados ({tickets.length})</h2>
        </div>
        <div className="divide-y divide-slate-100">
          {tickets.map((t) => (
            <Link
              key={t.id}
              href={`/dashboard/chamados/${t.id}`}
              className="flex items-center justify-between px-4 py-3 text-sm hover:bg-slate-50"
            >
              <div>
                <p className="font-medium text-slate-900">{t.subject}</p>
                <p className="text-slate-500">
                  {t.customer?.name ?? '—'} · prioridade{' '}
                  {TICKET_PRIORITY_LABELS[t.priority] ?? t.priority} · SLA até{' '}
                  {new Date(t.slaDueAt).toLocaleString('pt-BR')}
                </p>
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${STATUS_BADGE[t.status] ?? 'bg-slate-100 text-slate-600'}`}
              >
                {TICKET_STATUS_LABELS[t.status] ?? t.status}
              </span>
            </Link>
          ))}
          {tickets.length === 0 && (
            <p className="px-4 py-6 text-sm text-slate-500">Nenhum chamado aberto ainda.</p>
          )}
        </div>
      </section>
    </div>
  );
}
