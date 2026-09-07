import { cookies } from 'next/headers';
import { backend, BackendError } from '@/lib/backend';
import { SESSION_COOKIE } from '@/lib/session';
import { WEBHOOK_EVENT_LABELS } from '@/lib/crm-constants';
import { NewWebhookForm } from '@/components/crm/new-webhook-form';
import { WebhookActions } from '@/components/crm/webhook-actions';

// Webhooks (spec Fase 3) — restrito a admin no backend (WebhooksController).
export default async function WebhooksPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)!.value;

  const webhooks = await backend.webhookSubscriptions(token).catch((err) => {
    if (err instanceof BackendError && err.status === 403) return null;
    throw err;
  });

  if (!webhooks) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-slate-900">Webhooks</h1>
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Esta página é restrita a administradores.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-2xl font-semibold text-slate-900">Webhooks</h1>
        <p className="text-sm text-slate-500">
          Eventos disparados: pedido criado, fatura paga, chamado atualizado e contrato
          vencendo (varredura diária). Entregas são melhor-esforço — sem fila de retry
          nesta fase.
        </p>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-3 font-medium text-slate-900">Nova assinatura</h2>
        <NewWebhookForm />
      </section>

      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="font-medium text-slate-900">Assinaturas ({webhooks.length})</h2>
        </div>
        <div className="divide-y divide-slate-100">
          {webhooks.map((w) => (
            <div key={w.id} className="flex items-center justify-between px-4 py-3 text-sm">
              <div>
                <p className="font-medium text-slate-900">{w.url}</p>
                <p className="text-slate-500">
                  {w.events.map((e) => WEBHOOK_EVENT_LABELS[e] ?? e).join(', ')}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={
                    w.isActive
                      ? 'rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700'
                      : 'rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600'
                  }
                >
                  {w.isActive ? 'Ativo' : 'Inativo'}
                </span>
                <WebhookActions webhookId={w.id} isActive={w.isActive} />
              </div>
            </div>
          ))}
          {webhooks.length === 0 && (
            <p className="px-4 py-6 text-sm text-slate-500">Nenhum webhook cadastrado ainda.</p>
          )}
        </div>
      </section>
    </div>
  );
}
