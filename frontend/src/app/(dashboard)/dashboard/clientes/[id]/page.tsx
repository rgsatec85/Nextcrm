import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import { backend, BackendError } from '@/lib/backend';
import { SESSION_COOKIE } from '@/lib/session';
import { STAGE_LABELS } from '@/lib/crm-constants';
import { NewContactForm } from '@/components/crm/new-contact-form';
import { NewOpportunityForm } from '@/components/crm/new-opportunity-form';
import { NewActivityForm } from '@/components/crm/new-activity-form';
import { CompleteActivityButton } from '@/components/crm/complete-activity-button';
import { NewQuoteForm } from '@/components/crm/new-quote-form';
import { QuoteActions } from '@/components/crm/quote-actions';
import { GenerateInvoicesForm } from '@/components/crm/generate-invoices-form';
import { RegisterPaymentForm } from '@/components/crm/register-payment-form';
import { CancelInvoiceButton } from '@/components/crm/cancel-invoice-button';
import { NewContractForm } from '@/components/crm/new-contract-form';
import { RenewContractButton } from '@/components/crm/renew-contract-button';
import { NewPortalLoginForm } from '@/components/crm/new-portal-login-form';
import { TogglePortalLoginButton } from '@/components/crm/toggle-portal-login-button';

function formatMoney(value: string | number) {
  return Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
}

const SCORE_BADGE: Record<string, string> = {
  verde: 'bg-emerald-100 text-emerald-700',
  amarelo: 'bg-amber-100 text-amber-700',
  vermelho: 'bg-red-100 text-red-700',
};

const INVOICE_STATUS_LABELS: Record<string, string> = {
  aberto: 'Aberto',
  parcial: 'Parcial',
  pago: 'Pago',
  cancelado: 'Cancelado',
};

// Cliente 360° (spec §10): uma única tela reunindo cliente, contatos,
// oportunidades + propostas versionadas, pedidos (gerados automaticamente na
// aprovação de proposta) e a agenda de atividades.
export default async function ClienteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)!.value;

  const customer = await backend.customer(token, id).catch((err) => {
    if (err instanceof BackendError && (err.status === 404 || err.status === 403)) {
      return null;
    }
    throw err;
  });

  if (!customer) {
    notFound();
  }

  // Score Financeiro (Fase 2) é uma heurística, não crítica para a tela —
  // se a chamada falhar por qualquer motivo, a página segue sem o badge em
  // vez de quebrar o Cliente 360° inteiro.
  const score = await backend.customerScore(token, id).catch(() => null);

  // Score IA (Fase 4) supersede o Score Financeiro como o badge principal —
  // mantemos os dois visíveis (rotulados) em vez de remover o antigo, ver
  // docs/fase4-ia-corporativa.md. Mesma tolerância a falha do Score
  // Financeiro: uma falha aqui não derruba a página.
  const scoreIa = await backend.aiScoreIa(token, id).catch(() => null);
  const aiSummary = await backend.aiCustomerSummary(token, id).catch(() => null);

  // Portal do Cliente (Fase 3) — gestão de acesso é admin/gestor apenas
  // (backend responde 403 para vendedor/financeiro); tratamos como "seção
  // não disponível" em vez de deixar a exceção estourar a página inteira.
  const portalLogins = await backend.portalLogins(token, id).catch((err) => {
    if (err instanceof BackendError && err.status === 403) return null;
    throw err;
  });

  return (
    <div className="space-y-8">
      <section className="flex items-start justify-between">
        <div>
          <Link href="/dashboard/clientes" className="text-sm text-brand-600 hover:underline">
            ← Clientes
          </Link>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">{customer.name}</h1>
          <p className="text-sm text-slate-500">
            {customer.segment ?? 'Sem segmento'} · {customer.email ?? 'sem email'} ·{' '}
            {customer.phone ?? 'sem telefone'}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span
            className={
              customer.status === 'ativo'
                ? 'rounded-full bg-emerald-100 px-3 py-1 text-xs text-emerald-700'
                : 'rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600'
            }
          >
            {customer.status}
          </span>
          {scoreIa && (
            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${SCORE_BADGE[scoreIa.classification]}`}
              title="Score IA (Fase 4) — modelo ponderado determinístico sobre pontualidade, inadimplência, tendência de volume, tempo de relacionamento, chamados e renovação de contrato"
            >
              Score IA: {scoreIa.score}/100 ({scoreIa.classification})
            </span>
          )}
          {score && (
            <span
              className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500"
              title="Score Financeiro — heurística mais simples da Fase 2, superseded pelo Score IA acima (mantido como um dos sinais de entrada dele)"
            >
              Score Financeiro (Fase 2): {score.classification}
            </span>
          )}
        </div>
      </section>

      {aiSummary && (
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="font-medium text-slate-900">Resumo IA</h2>
          <p className="mt-2 whitespace-pre-line text-sm text-slate-600">
            {aiSummary.summary}
          </p>
        </section>
      )}

      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="font-medium text-slate-900">
            Contatos ({customer.contacts.length})
          </h2>
        </div>
        <div className="divide-y divide-slate-100">
          {customer.contacts.map((c) => (
            <div key={c.id} className="flex items-center justify-between px-4 py-2 text-sm">
              <div>
                <span className="font-medium text-slate-900">{c.name}</span>
                {c.role && <span className="text-slate-500"> · {c.role}</span>}
                {c.isPrimary && (
                  <span className="ml-2 rounded-full bg-brand-100 px-2 py-0.5 text-xs text-brand-700">
                    principal
                  </span>
                )}
              </div>
              <div className="text-slate-500">{c.email ?? c.phone ?? '—'}</div>
            </div>
          ))}
          {customer.contacts.length === 0 && (
            <p className="px-4 py-4 text-sm text-slate-500">Nenhum contato cadastrado.</p>
          )}
        </div>
        <div className="border-t border-slate-200 px-4 py-4">
          <NewContactForm customerId={customer.id} />
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="font-medium text-slate-900">
            Oportunidades ({customer.opportunities.length})
          </h2>
        </div>
        <div className="divide-y divide-slate-100">
          {customer.opportunities.map((o) => (
            <div key={o.id} className="px-4 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-900">{o.title}</p>
                  <p className="text-sm text-slate-500">
                    {STAGE_LABELS[o.stage as keyof typeof STAGE_LABELS] ?? o.stage} · R${' '}
                    {formatMoney(o.value)}
                  </p>
                </div>
                <Link href="/dashboard/pipeline" className="text-sm text-brand-600 hover:underline">
                  Ver no pipeline
                </Link>
              </div>

              {o.quotes.length > 0 && (
                <div className="mt-3 space-y-2 rounded-md bg-slate-50 p-3">
                  <p className="text-xs font-medium uppercase text-slate-500">Propostas</p>
                  {o.quotes.map((q) => (
                    <div key={q.id} className="flex items-center justify-between text-sm">
                      <span>
                        v{q.version} · {q.status} · R$ {formatMoney(q.totalValue)}
                      </span>
                      <QuoteActions quoteId={q.id} status={q.status} />
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-3">
                <NewQuoteForm opportunityId={o.id} />
              </div>
            </div>
          ))}
          {customer.opportunities.length === 0 && (
            <p className="px-4 py-4 text-sm text-slate-500">Nenhuma oportunidade ainda.</p>
          )}
        </div>
        <div className="border-t border-slate-200 px-4 py-4">
          <NewOpportunityForm customerId={customer.id} />
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="font-medium text-slate-900">Pedidos ({customer.orders.length})</h2>
        </div>
        <div className="divide-y divide-slate-100">
          {customer.orders.map((o) => {
            const hasInvoices = customer.invoices.some((inv) => inv.orderId === o.id);
            return (
              <div key={o.id} className="px-4 py-2 text-sm">
                <div className="flex items-center justify-between">
                  <span>{o.status}</span>
                  <span>R$ {formatMoney(o.totalValue)}</span>
                </div>
                {!hasInvoices && (
                  <div className="mt-1">
                    <GenerateInvoicesForm orderId={o.id} />
                  </div>
                )}
              </div>
            );
          })}
          {customer.orders.length === 0 && (
            <p className="px-4 py-4 text-sm text-slate-500">
              Pedidos são criados automaticamente quando uma proposta é aprovada.
            </p>
          )}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="font-medium text-slate-900">
            Financeiro — faturas ({customer.invoices.length})
          </h2>
        </div>
        <div className="divide-y divide-slate-100">
          {customer.invoices.map((inv) => {
            const remaining = Number(inv.amount) - Number(inv.paidAmount);
            return (
              <div key={inv.id} className="px-4 py-2 text-sm">
                <div className="flex items-center justify-between">
                  <span>
                    {inv.installmentNumber}/{inv.totalInstallments} · vence em{' '}
                    {new Date(inv.dueDate).toLocaleDateString('pt-BR')} · R${' '}
                    {formatMoney(inv.amount)}
                  </span>
                  <span
                    className={
                      inv.isOverdue
                        ? 'rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700'
                        : 'rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600'
                    }
                  >
                    {inv.isOverdue ? 'Vencido' : (INVOICE_STATUS_LABELS[inv.status] ?? inv.status)}
                  </span>
                </div>
                {(inv.status === 'aberto' || inv.status === 'parcial') && (
                  <div className="mt-1 flex items-center gap-3">
                    <RegisterPaymentForm invoiceId={inv.id} remaining={remaining} />
                    {inv.status === 'aberto' && <CancelInvoiceButton invoiceId={inv.id} />}
                  </div>
                )}
              </div>
            );
          })}
          {customer.invoices.length === 0 && (
            <p className="px-4 py-4 text-sm text-slate-500">
              Nenhuma fatura ainda — gere as parcelas a partir de um pedido acima.
            </p>
          )}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="font-medium text-slate-900">
            Contratos ({customer.contracts.length})
          </h2>
        </div>
        <div className="divide-y divide-slate-100">
          {customer.contracts.map((c) => (
            <div key={c.id} className="flex items-center justify-between px-4 py-2 text-sm">
              <div>
                <span className="font-medium text-slate-900">{c.title}</span>
                <span className="text-slate-500">
                  {' '}
                  · até {new Date(c.endDate).toLocaleDateString('pt-BR')} · R${' '}
                  {formatMoney(c.value)}
                </span>
                {c.expiringSoon && (
                  <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
                    vence em {c.daysUntilExpiration}d
                  </span>
                )}
              </div>
              {c.status === 'ativo' && <RenewContractButton contractId={c.id} />}
            </div>
          ))}
          {customer.contracts.length === 0 && (
            <p className="px-4 py-4 text-sm text-slate-500">Nenhum contrato cadastrado.</p>
          )}
        </div>
        <div className="border-t border-slate-200 px-4 py-4">
          <NewContractForm customerId={customer.id} />
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="font-medium text-slate-900">
            Agenda ({customer.activities.length})
          </h2>
        </div>
        <div className="divide-y divide-slate-100">
          {customer.activities.map((a) => (
            <div key={a.id} className="flex items-center justify-between px-4 py-2 text-sm">
              <div>
                <span className="font-medium text-slate-900">{a.type}</span>
                {a.notes && <span className="text-slate-500"> · {a.notes}</span>}
                {a.scheduledAt && (
                  <span className="text-slate-400">
                    {' '}
                    · {new Date(a.scheduledAt).toLocaleString('pt-BR')}
                  </span>
                )}
              </div>
              {a.doneAt ? (
                <span className="text-xs text-emerald-700">concluída</span>
              ) : (
                <CompleteActivityButton activityId={a.id} />
              )}
            </div>
          ))}
          {customer.activities.length === 0 && (
            <p className="px-4 py-4 text-sm text-slate-500">Nenhuma atividade registrada.</p>
          )}
        </div>
        <div className="border-t border-slate-200 px-4 py-4">
          <NewActivityForm customerId={customer.id} />
        </div>
      </section>

      {portalLogins !== null && (
        <section className="rounded-lg border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-4 py-3">
            <h2 className="font-medium text-slate-900">
              Portal do Cliente — Acesso ({portalLogins.length})
            </h2>
          </div>
          <div className="divide-y divide-slate-100">
            {portalLogins.map((login) => (
              <div key={login.id} className="flex items-center justify-between px-4 py-2 text-sm">
                <div>
                  <span className="font-medium text-slate-900">{login.name}</span>
                  <span className="text-slate-500"> · {login.email}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={
                      login.isActive
                        ? 'rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700'
                        : 'rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600'
                    }
                  >
                    {login.isActive ? 'Ativo' : 'Inativo'}
                  </span>
                  <TogglePortalLoginButton
                    customerId={customer.id}
                    loginId={login.id}
                    isActive={login.isActive}
                  />
                </div>
              </div>
            ))}
            {portalLogins.length === 0 && (
              <p className="px-4 py-4 text-sm text-slate-500">
                Nenhum login de portal criado para este cliente ainda.
              </p>
            )}
          </div>
          <div className="border-t border-slate-200 px-4 py-4">
            <NewPortalLoginForm customerId={customer.id} />
          </div>
        </section>
      )}
    </div>
  );
}
