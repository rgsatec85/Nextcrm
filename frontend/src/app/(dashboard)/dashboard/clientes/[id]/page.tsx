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
import { CreateDrawer } from '@/components/ui/create-drawer';
import { Card, CardHeader } from '@/components/ui/card';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { AttainmentBar } from '@/components/ui/progress-bar';
import { ScoreGauge } from '@/components/charts/score-gauge';
import { INVOICE_STATUS_TONE, ORDER_STATUS_TONE, QUOTE_STATUS_TONE, expiringSoonTone } from '@/lib/crm-constants';
import {
  ArrowLeft,
  Briefcase,
  CalendarClock,
  Contact2,
  FileSignature,
  KeyRound,
  Package,
  Sparkles,
  Wallet,
} from 'lucide-react';

function formatMoney(value: string | number) {
  return Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
}

const SCORE_TONE: Record<string, BadgeTone> = {
  verde: 'success',
  amarelo: 'warning',
  vermelho: 'danger',
};

const INVOICE_STATUS_LABELS: Record<string, string> = {
  aberto: 'Aberto',
  parcial: 'Parcial',
  pago: 'Pago',
  cancelado: 'Cancelado',
};

// Cliente 360° (spec §10): uma única tela reunindo cliente, contatos,
// oportunidades + propostas versionadas, pedidos (gerados automaticamente na
// aprovação de proposta) e a agenda de atividades. Redesign de UI: todo
// cadastro (contato, oportunidade, contrato, atividade, acesso ao portal)
// agora só aparece dentro de um Drawer acionado pelo botão "Novo X" de cada
// seção — a grid/lista mostra só os dados.
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
      <section className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/dashboard/clientes"
            className="inline-flex items-center gap-1.5 text-sm text-brand-600 hover:underline"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Clientes
          </Link>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-50">{customer.name}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {customer.segment ?? 'Sem segmento'} · {customer.email ?? 'sem email'} ·{' '}
            {customer.phone ?? 'sem telefone'}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Badge tone={customer.status === 'ativo' ? 'success' : 'neutral'}>{customer.status}</Badge>
        </div>
      </section>

      {(scoreIa || score) && (
        <Card>
          <CardHeader
            icon={<Sparkles className="h-4 w-4" />}
            title="Score do cliente"
            description={scoreIa ? 'Score IA (Fase 4) — modelo ponderado determinístico' : undefined}
          />
          <div className="flex flex-wrap items-start gap-6 px-5 py-4">
            {scoreIa && (
              <div
                title="Score IA — modelo ponderado determinístico sobre pontualidade, inadimplência, tendência de volume, tempo de relacionamento, chamados e renovação de contrato"
              >
                <ScoreGauge score={scoreIa.score} signals={scoreIa.signals} />
              </div>
            )}
            <div className="flex flex-1 flex-col gap-3">
              {score && (
                <div className="flex flex-wrap items-center gap-3">
                  <span
                    title="Score Financeiro — heurística mais simples da Fase 2, superseded pelo Score IA (mantido como um dos sinais de entrada dele)"
                  >
                    <Badge tone={SCORE_TONE[score.classification]}>
                      Score Financeiro: {score.classification}
                    </Badge>
                  </span>
                </div>
              )}
              {score?.punctualityRate != null && (
                <div className="max-w-xs">
                  <AttainmentBar
                    label="Taxa de pontualidade"
                    percent={score.punctualityRate * 100}
                    tone={score.punctualityRate >= 0.8 ? 'success' : score.punctualityRate >= 0.5 ? 'warning' : 'danger'}
                  />
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      {aiSummary && (
        <Card>
          <CardHeader icon={<Sparkles className="h-4 w-4" />} title="Resumo IA" />
          <p className="whitespace-pre-line px-5 py-4 text-sm text-slate-600 dark:text-slate-400">
            {aiSummary.summary}
          </p>
        </Card>
      )}

      <Card>
        <CardHeader
          icon={<Contact2 className="h-4 w-4" />}
          title={`Contatos (${customer.contacts.length})`}
          action={
            <CreateDrawer triggerLabel="Novo contato" size="sm" variant="secondary">
              <NewContactForm customerId={customer.id} />
            </CreateDrawer>
          }
        />
        {customer.contacts.length === 0 ? (
          <EmptyState icon={Contact2} title="Nenhum contato cadastrado" />
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {customer.contacts.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                <div>
                  <span className="font-medium text-slate-900 dark:text-slate-100">{c.name}</span>
                  {c.role && <span className="text-slate-500 dark:text-slate-400"> · {c.role}</span>}
                  {c.isPrimary && (
                    <span className="ml-2">
                      <Badge tone="accent">principal</Badge>
                    </span>
                  )}
                </div>
                <div className="text-slate-500 dark:text-slate-400">{c.email ?? c.phone ?? '—'}</div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <CardHeader
          icon={<Briefcase className="h-4 w-4" />}
          title={`Oportunidades (${customer.opportunities.length})`}
          action={
            <CreateDrawer triggerLabel="Nova oportunidade" size="sm" variant="secondary">
              <NewOpportunityForm customerId={customer.id} />
            </CreateDrawer>
          }
        />
        {customer.opportunities.length === 0 ? (
          <EmptyState icon={Briefcase} title="Nenhuma oportunidade ainda" />
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {customer.opportunities.map((o) => (
              <div key={o.id} className="px-5 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-900 dark:text-slate-100">{o.title}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {STAGE_LABELS[o.stage as keyof typeof STAGE_LABELS] ?? o.stage} · R${' '}
                      {formatMoney(o.value)}
                    </p>
                  </div>
                  <Link href="/dashboard/pipeline" className="text-sm text-brand-600 hover:underline">
                    Ver no pipeline
                  </Link>
                </div>

                {o.quotes.length > 0 && (
                  <div className="mt-3 space-y-2 rounded-lg bg-slate-50 p-3 dark:bg-slate-800/50">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Propostas
                    </p>
                    {o.quotes.map((q) => (
                      <div key={q.id} className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                          v{q.version} · R$ {formatMoney(q.totalValue)}
                          <Badge tone={QUOTE_STATUS_TONE[q.status] ?? 'neutral'}>{q.status}</Badge>
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
          </div>
        )}
      </Card>

      <Card>
        <CardHeader icon={<Package className="h-4 w-4" />} title={`Pedidos (${customer.orders.length})`} />
        {customer.orders.length === 0 ? (
          <EmptyState
            icon={Package}
            title="Nenhum pedido ainda"
            description="Pedidos são criados automaticamente quando uma proposta é aprovada."
          />
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {customer.orders.map((o) => {
              const hasInvoices = customer.invoices.some((inv) => inv.orderId === o.id);
              return (
                <div key={o.id} className="px-5 py-3 text-sm">
                  <div className="flex items-center justify-between">
                    <Badge tone={ORDER_STATUS_TONE[o.status] ?? 'neutral'}>{o.status}</Badge>
                    <span className="font-medium text-slate-900 dark:text-slate-100">
                      R$ {formatMoney(o.totalValue)}
                    </span>
                  </div>
                  {!hasInvoices && (
                    <div className="mt-1">
                      <GenerateInvoicesForm orderId={o.id} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card>
        <CardHeader
          icon={<Wallet className="h-4 w-4" />}
          title={`Financeiro — faturas (${customer.invoices.length})`}
        />
        {customer.invoices.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title="Nenhuma fatura ainda"
            description="Gere as parcelas a partir de um pedido acima."
          />
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {customer.invoices.map((inv) => {
              const remaining = Number(inv.amount) - Number(inv.paidAmount);
              return (
                <div key={inv.id} className="px-5 py-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-700 dark:text-slate-300">
                      {inv.installmentNumber}/{inv.totalInstallments} · vence em{' '}
                      {new Date(inv.dueDate).toLocaleDateString('pt-BR')} · R${' '}
                      {formatMoney(inv.amount)}
                    </span>
                    <Badge tone={inv.isOverdue ? 'danger' : (INVOICE_STATUS_TONE[inv.status] ?? 'neutral')}>
                      {inv.isOverdue ? 'Vencido' : (INVOICE_STATUS_LABELS[inv.status] ?? inv.status)}
                    </Badge>
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
          </div>
        )}
      </Card>

      <Card>
        <CardHeader
          icon={<FileSignature className="h-4 w-4" />}
          title={`Contratos (${customer.contracts.length})`}
          action={
            <CreateDrawer triggerLabel="Novo contrato" size="sm" variant="secondary">
              <NewContractForm customerId={customer.id} />
            </CreateDrawer>
          }
        />
        {customer.contracts.length === 0 ? (
          <EmptyState icon={FileSignature} title="Nenhum contrato cadastrado" />
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {customer.contracts.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                <div>
                  <span className="font-medium text-slate-900 dark:text-slate-100">{c.title}</span>
                  <span className="text-slate-500 dark:text-slate-400">
                    {' '}
                    · até {new Date(c.endDate).toLocaleDateString('pt-BR')} · R${' '}
                    {formatMoney(c.value)}
                  </span>
                  {c.expiringSoon && (
                    <span className="ml-2">
                      <Badge tone={expiringSoonTone(c.daysUntilExpiration)}>
                        vence em {c.daysUntilExpiration}d
                      </Badge>
                    </span>
                  )}
                </div>
                {c.status === 'ativo' && <RenewContractButton contractId={c.id} />}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <CardHeader
          icon={<CalendarClock className="h-4 w-4" />}
          title={`Agenda (${customer.activities.length})`}
          action={
            <CreateDrawer triggerLabel="Nova atividade" size="sm" variant="secondary">
              <NewActivityForm customerId={customer.id} />
            </CreateDrawer>
          }
        />
        {customer.activities.length === 0 ? (
          <EmptyState icon={CalendarClock} title="Nenhuma atividade registrada" />
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {customer.activities.map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                <div>
                  <span className="font-medium text-slate-900 dark:text-slate-100">{a.type}</span>
                  {a.notes && <span className="text-slate-500 dark:text-slate-400"> · {a.notes}</span>}
                  {a.scheduledAt && (
                    <span className="text-slate-400">
                      {' '}
                      · {new Date(a.scheduledAt).toLocaleString('pt-BR')}
                    </span>
                  )}
                </div>
                {a.doneAt ? (
                  <Badge tone="success">concluída</Badge>
                ) : (
                  <CompleteActivityButton activityId={a.id} />
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {portalLogins !== null && (
        <Card>
          <CardHeader
            icon={<KeyRound className="h-4 w-4" />}
            title={`Portal do Cliente — Acesso (${portalLogins.length})`}
            action={
              <CreateDrawer triggerLabel="Novo acesso" size="sm" variant="secondary">
                <NewPortalLoginForm customerId={customer.id} />
              </CreateDrawer>
            }
          />
          {portalLogins.length === 0 ? (
            <EmptyState icon={KeyRound} title="Nenhum login de portal criado para este cliente ainda" />
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {portalLogins.map((login) => (
                <div key={login.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                  <div>
                    <span className="font-medium text-slate-900 dark:text-slate-100">{login.name}</span>
                    <span className="text-slate-500 dark:text-slate-400"> · {login.email}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge tone={login.isActive ? 'success' : 'neutral'}>
                      {login.isActive ? 'Ativo' : 'Inativo'}
                    </Badge>
                    <TogglePortalLoginButton
                      customerId={customer.id}
                      loginId={login.id}
                      isActive={login.isActive}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
