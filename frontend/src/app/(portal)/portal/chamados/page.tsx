import { cookies } from 'next/headers';
import { backend } from '@/lib/backend';
import { SESSION_COOKIE } from '@/lib/session';
import { TICKET_PRIORITY_LABELS, TICKET_STATUS_LABELS } from '@/lib/crm-constants';
import { PortalNewTicketForm } from '@/components/portal/new-ticket-form';
import { NewTicketCommentForm } from '@/components/crm/new-ticket-comment-form';

const STATUS_BADGE: Record<string, string> = {
  aberto: 'bg-amber-100 text-amber-700',
  em_andamento: 'bg-brand-100 text-brand-700',
  resolvido: 'bg-emerald-100 text-emerald-700',
  fechado: 'bg-slate-100 text-slate-600',
};

// Chamados do Portal (spec Fase 3) — sem endpoint de detalhe dedicado: a
// lista já vem com os comentários de cada chamado (PortalService.tickets),
// então a "tela de detalhe" é só expandir o card na própria listagem.
export default async function PortalChamadosPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)!.value;
  const tickets = await backend.portalTickets(token);

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-2xl font-semibold text-slate-900">Chamados</h1>
        <p className="text-sm text-slate-500">Abra um chamado ou acompanhe os existentes.</p>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-3 font-medium text-slate-900">Abrir novo chamado</h2>
        <PortalNewTicketForm />
      </section>

      <section className="space-y-4">
        {tickets.map((t) => (
          <div key={t.id} className="rounded-lg border border-slate-200 bg-white">
            <div className="flex items-start justify-between px-4 py-3">
              <div>
                <p className="font-medium text-slate-900">{t.subject}</p>
                <p className="text-sm text-slate-500">
                  prioridade {TICKET_PRIORITY_LABELS[t.priority] ?? t.priority} · SLA até{' '}
                  {new Date(t.slaDueAt).toLocaleString('pt-BR')}
                </p>
                {t.description && (
                  <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
                    {t.description}
                  </p>
                )}
              </div>
              <span
                className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs ${STATUS_BADGE[t.status] ?? 'bg-slate-100 text-slate-600'}`}
              >
                {TICKET_STATUS_LABELS[t.status] ?? t.status}
              </span>
            </div>

            <div className="border-t border-slate-100 px-4 py-3">
              <p className="mb-2 text-xs font-medium uppercase text-slate-400">
                Comentários ({t.comments?.length ?? 0})
              </p>
              <div className="space-y-2">
                {(t.comments ?? []).map((c) => (
                  <div key={c.id} className="rounded-md bg-slate-50 px-3 py-2 text-sm">
                    <p className="text-xs text-slate-400">
                      {c.authorType === 'cliente' ? 'Você' : 'Equipe'} ·{' '}
                      {new Date(c.createdAt).toLocaleString('pt-BR')}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-slate-700">{c.body}</p>
                  </div>
                ))}
              </div>
              <div className="mt-3">
                <NewTicketCommentForm endpoint={`/api/portal/tickets/${t.id}/comments`} />
              </div>
            </div>
          </div>
        ))}
        {tickets.length === 0 && (
          <p className="rounded-lg border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">
            Nenhum chamado aberto ainda.
          </p>
        )}
      </section>
    </div>
  );
}
