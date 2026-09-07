import Link from 'next/link';
import { cookies } from 'next/headers';
import { backend } from '@/lib/backend';
import { SESSION_COOKIE } from '@/lib/session';
import { TICKET_PRIORITY_LABELS, TICKET_STATUS_LABELS, TICKET_STATUS_TONE } from '@/lib/crm-constants';
import { NewTicketForm } from '@/components/crm/new-ticket-form';
import { CreateDrawer } from '@/components/ui/create-drawer';
import { KpiCard } from '@/components/ui/kpi-card';
import { Card, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { AlertOctagon, CircleDot, LifeBuoy, Timer } from 'lucide-react';

// Fora do componente de propósito: `Date.now()` é impuro e o linter do
// React Compiler não permite chamada direta impura dentro do corpo de um
// componente — isolar num helper de módulo resolve isso sem mudar o
// resultado (é uma página server-side, recalculada a cada request de
// qualquer forma).
function isSlaBreached(ticket: { status: string; slaDueAt: string }) {
  return (
    (ticket.status === 'aberto' || ticket.status === 'em_andamento') &&
    new Date(ticket.slaDueAt).getTime() < Date.now()
  );
}

// Atendimento interno (spec Fase 3): chamados de todos os clientes visíveis
// ao usuário (ABAC de vendedor aplicado no backend — TicketsService).
export default async function ChamadosPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)!.value;

  const [tickets, customers] = await Promise.all([
    backend.tickets(token),
    backend.customers(token),
  ]);

  const openCount = tickets.filter((t) => t.status === 'aberto').length;
  const inProgressCount = tickets.filter((t) => t.status === 'em_andamento').length;
  // Backend ainda não expõe um breakdown pronto de SLA estourado — calculado
  // aqui a partir de slaDueAt (já retornado por GET /tickets) comparado a
  // agora, só para chamados ainda não resolvidos/fechados.
  const slaBreached = tickets.filter(isSlaBreached).length;

  return (
    <div className="space-y-8">
      <section className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">Chamados</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Atendimento interno — SLA calculado pela prioridade no momento da abertura.
          </p>
        </div>
        <CreateDrawer triggerLabel="Abrir chamado">
          {(close) => (
            <NewTicketForm
              customers={customers.map((c) => ({ id: c.id, name: c.name }))}
              onSuccess={close}
            />
          )}
        </CreateDrawer>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <KpiCard label="Abertos" value={String(openCount)} icon={CircleDot} tone="warning" />
        <KpiCard label="Em andamento" value={String(inProgressCount)} icon={Timer} tone="info" />
        <KpiCard label="SLA estourado" value={String(slaBreached)} icon={AlertOctagon} tone="danger" />
      </section>

      <Card>
        <CardHeader icon={<LifeBuoy className="h-4 w-4" />} title={`Todos os chamados (${tickets.length})`} />
        {tickets.length === 0 ? (
          <EmptyState
            icon={LifeBuoy}
            title="Nenhum chamado aberto ainda"
            description="Quando um cliente (ou sua equipe) abrir um chamado, ele aparece aqui."
          />
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {tickets.map((t) => (
              <Link
                key={t.id}
                href={`/dashboard/chamados/${t.id}`}
                className="flex items-center justify-between gap-4 px-5 py-3 text-sm transition hover:bg-slate-50 dark:hover:bg-slate-800/50"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-900 dark:text-slate-100">{t.subject}</p>
                  <p className="truncate text-slate-500 dark:text-slate-400">
                    {t.customer?.name ?? '—'} · prioridade{' '}
                    {TICKET_PRIORITY_LABELS[t.priority] ?? t.priority} · SLA até{' '}
                    {new Date(t.slaDueAt).toLocaleString('pt-BR')}
                  </p>
                </div>
                <Badge tone={TICKET_STATUS_TONE[t.status] ?? 'neutral'}>
                  {TICKET_STATUS_LABELS[t.status] ?? t.status}
                </Badge>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
