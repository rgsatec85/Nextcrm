import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import { backend, BackendError } from '@/lib/backend';
import { SESSION_COOKIE } from '@/lib/session';
import { TICKET_PRIORITY_LABELS, TICKET_STATUS_LABELS } from '@/lib/crm-constants';
import { TicketStatusForm } from '@/components/crm/ticket-status-form';
import { NewTicketCommentForm } from '@/components/crm/new-ticket-comment-form';

export default async function ChamadoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)!.value;

  const ticket = await backend.ticket(token, id).catch((err) => {
    if (err instanceof BackendError && (err.status === 404 || err.status === 403)) {
      return null;
    }
    throw err;
  });

  if (!ticket) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <Link href="/dashboard/chamados" className="text-sm text-brand-600 hover:underline">
        ← Chamados
      </Link>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">{ticket.subject}</h1>
            <p className="mt-1 text-sm text-slate-500">
              {ticket.customer?.name ?? '—'} · prioridade{' '}
              {TICKET_PRIORITY_LABELS[ticket.priority] ?? ticket.priority} · SLA até{' '}
              {new Date(ticket.slaDueAt).toLocaleString('pt-BR')}
            </p>
          </div>
          <TicketStatusForm ticketId={ticket.id} status={ticket.status} />
        </div>
        {ticket.description && (
          <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{ticket.description}</p>
        )}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="font-medium text-slate-900">
            Comentários ({ticket.comments?.length ?? 0})
          </h2>
        </div>
        <div className="divide-y divide-slate-100">
          {(ticket.comments ?? []).map((c) => (
            <div key={c.id} className="px-4 py-3 text-sm">
              <p className="text-xs font-medium uppercase text-slate-400">
                {c.authorType === 'cliente' ? 'Cliente' : 'Equipe'} ·{' '}
                {new Date(c.createdAt).toLocaleString('pt-BR')}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-slate-700">{c.body}</p>
            </div>
          ))}
          {(ticket.comments ?? []).length === 0 && (
            <p className="px-4 py-4 text-sm text-slate-500">Nenhum comentário ainda.</p>
          )}
        </div>
        <div className="border-t border-slate-200 px-4 py-4">
          <NewTicketCommentForm endpoint={`/api/crm/tickets/${ticket.id}/comments`} />
        </div>
      </section>

      <p className="text-xs text-slate-400">
        Status: {TICKET_STATUS_LABELS[ticket.status] ?? ticket.status}
      </p>
    </div>
  );
}
