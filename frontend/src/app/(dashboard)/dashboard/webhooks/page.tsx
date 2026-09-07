import { cookies } from 'next/headers';
import { backend, BackendError } from '@/lib/backend';
import { SESSION_COOKIE } from '@/lib/session';
import { WEBHOOK_EVENT_LABELS } from '@/lib/crm-constants';
import { NewWebhookForm } from '@/components/crm/new-webhook-form';
import { WebhookActions } from '@/components/crm/webhook-actions';
import { CreateDrawer } from '@/components/ui/create-drawer';
import { Card, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Webhook as WebhookIcon } from 'lucide-react';

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
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">Webhooks</h1>
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
          Esta página é restrita a administradores.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">Webhooks</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Eventos disparados: pedido criado, fatura paga, chamado atualizado e contrato
            vencendo (varredura diária). Entregas são melhor-esforço — sem fila de retry
            nesta fase.
          </p>
        </div>
        {/* Sem onSuccess: o formulário mostra o secret gerado uma única vez
            após o POST, então o drawer fica aberto até o usuário fechar
            manualmente (copiar o secret antes de fechar). */}
        <CreateDrawer
          triggerLabel="Nova assinatura"
          description="Guarde o secret exibido após criar — ele não é mostrado de novo."
        >
          <NewWebhookForm />
        </CreateDrawer>
      </section>

      <Card>
        <CardHeader icon={<WebhookIcon className="h-4 w-4" />} title={`Assinaturas (${webhooks.length})`} />
        {webhooks.length === 0 ? (
          <EmptyState icon={WebhookIcon} title="Nenhum webhook cadastrado ainda" />
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {webhooks.map((w) => (
              <div key={w.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-900 dark:text-slate-100">{w.url}</p>
                  <p className="text-slate-500 dark:text-slate-400">
                    {w.events.map((e) => WEBHOOK_EVENT_LABELS[e] ?? e).join(', ')}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge tone={w.isActive ? 'success' : 'neutral'}>{w.isActive ? 'Ativo' : 'Inativo'}</Badge>
                  <WebhookActions webhookId={w.id} isActive={w.isActive} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
