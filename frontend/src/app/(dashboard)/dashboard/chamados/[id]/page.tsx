import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import { backend, BackendError } from '@/lib/backend';
import { SESSION_COOKIE } from '@/lib/session';
import { TICKET_PRIORITY_LABELS, TICKET_STATUS_LABELS, TICKET_STATUS_TONE } from '@/lib/crm-constants';
import { TicketStatusForm } from '@/components/crm/ticket-status-form';
import { NewTicketCommentForm } from '@/components/crm/new-ticket-comment-form';
import { Card, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { ArrowLeft, MessageSquare } from 'lucide-react';

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
      <Link
        href="/dashboard/chamados"
        className="inline-flex items-center gap-1.5 text-sm text-brand-600 hover:underline"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Chamados
      </Link>

      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-50">{ticket.subject}</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {ticket.customer?.name ?? '—'} · prioridade{' '}
              {TICKET_PRIORITY_LABELS[ticket.priority] ?? ticket.priority} · SLA até{' '}
              {new Date(ticket.slaDueAt).toLocaleString('pt-BR')}
            </p>
          </div>
          <TicketStatusForm ticketId={ticket.id} status={ticket.status} />
        </div>
        {ticket.description && (
          <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300">
            {ticket.description}
          </p>
        )}
        <div className="mt-3">
          <Badge tone={TICKET_STATUS_TONE[ticket.status] ?? 'neutral'}>
            Status: {TICKET_STATUS_LABELS[ticket.status] ?? ticket.status}
          </Badge>
        </div>
      </Card>

      <Card>
        <CardHeader
          icon={<MessageSquare className="h-4 w-4" />}
          title={`Comentários (${ticket.comments?.length ?? 0})`}
        />
        {(ticket.comments ?? []).length === 0 ? (
          <EmptyState icon={MessageSquare} title="Nenhum comentário ainda" />
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {(ticket.comments ?? []).map((c) => (
              <div key={c.id} className="px-5 py-3 text-sm">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  {c.authorType === 'cliente' ? 'Cliente' : 'Equipe'} ·{' '}
                  {new Date(c.createdAt).toLocaleString('pt-BR')}
                </p>
                <p className="mt-1 whitespace-pre-wrap text-slate-700 dark:text-slate-300">{c.body}</p>
              </div>
            ))}
          </div>
        )}
        <div className="border-t border-slate-200 px-5 py-4 dark:border-slate-800">
          <NewTicketCommentForm endpoint={`/api/crm/tickets/${ticket.id}/comments`} />
        </div>
      </Card>
    </div>
  );
}
