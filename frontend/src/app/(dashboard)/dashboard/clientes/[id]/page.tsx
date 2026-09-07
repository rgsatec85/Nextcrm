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
import { ConvertQuoteToOrderForm } from '@/components/crm/convert-quote-to-order-form';
import { EditOrderForm } from '@/components/crm/edit-order-form';
import { OrderStatusSelect } from '@/components/crm/order-status-select';
import { GenerateInvoicesForm } from '@/components/crm/generate-invoices-form';
import { RegisterPaymentForm } from '@/components/crm/register-payment-form';
import { CancelInvoiceButton } from '@/components/crm/cancel-invoice-button';
import { NewContractForm } from '@/components/crm/new-contract-form';
import { RenewContractButton } from '@/components/crm/renew-contract-button';
import { NewPortalLoginForm } from '@/components/crm/new-portal-login-form';
import { TogglePortalLoginButton } from '@/components/crm/toggle-portal-login-button';
import { EditCustomerForm } from '@/components/crm/edit-customer-form';
import { CreateDrawer, EditDrawer } from '@/components/ui/create-drawer';
import { Card, CardHeader } from '@/components/ui/card';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { AttainmentBar } from '@/components/ui/progress-bar';
import { ScoreGauge } from '@/components/charts/score-gauge';
import {
  COMPANY_SIZE_LABELS,
  INVOICE_STATUS_TONE,
  LEAD_SOURCE_LABELS,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_TONE,
  PERSON_TYPE_LABELS,
  QUOTE_STATUS_TONE,
  expiringSoonTone,
} from '@/lib/crm-constants';
import {
  ArrowLeft,
  Briefcase,
  BadgeCheck,
  CalendarClock,
  Contact2,
  FileSignature,
  IdCard,
  KeyRound,
  Package,
  Sparkles,
  Wallet,
} from 'lucide-react';

// Perfis que podem reatribuir o dono (`ownerId`) de um cliente — vendedor
// sempre vira dono do que cria/edita no backend (ownership.ts).
const OWNER_REASSIGN_ROLES = ['admin', 'gestor', 'financeiro'];

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

  const [customer, me, users] = await Promise.all([
    backend.customer(token, id).catch((err) => {
      if (err instanceof BackendError && (err.status === 404 || err.status === 403)) {
        return null;
      }
      throw err;
    }),
    backend.me(token) as Promise<{ role: { slug: string } }>,
    backend.users(token).catch(() => []) as Promise<{ id: string; name: string }[]>,
  ]);

  if (!customer) {
    notFound();
  }

  const canReassignOwner = OWNER_REASSIGN_ROLES.includes(me.role.slug);
  const owners = canReassignOwner ? users : undefined;

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

  // Fase 6 (spec v3.1) — modelos de proposta alimentam o seletor no
  // formulário de nova proposta; falha aqui não deve derrubar o Cliente 360°.
  const proposalTemplates = await backend.proposalTemplates(token).catch(() => []);

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
          <h1 className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-50">
            {customer.name}
            {customer.tradeName && (
              <span className="ml-2 text-base font-normal text-slate-500 dark:text-slate-400">
                ({customer.tradeName})
              </span>
            )}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {customer.segment ?? 'Sem segmento'} · {customer.email ?? 'sem email'} ·{' '}
            {customer.phone ?? 'sem telefone'}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            {customer.isStrategicAccount && (
              <span title="Conta estratégica">
                <Badge tone="accent">
                  <BadgeCheck className="mr-1 inline h-3 w-3" /> Estratégica
                </Badge>
              </span>
            )}
            <Badge tone={customer.status === 'ativo' ? 'success' : 'neutral'}>{customer.status}</Badge>
          </div>
          <EditDrawer triggerLabel="Editar cadastro" title="Editar cliente" size="sm" variant="secondary">
            <EditCustomerForm customer={customer} owners={owners} />
          </EditDrawer>
        </div>
      </section>

      <Card>
        <CardHeader icon={<IdCard className="h-4 w-4" />} title="Dados cadastrais" />
        <dl className="grid gap-x-6 gap-y-3 px-5 py-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-slate-500 dark:text-slate-400">
              {customer.personType === 'fisica' ? 'CPF' : 'CNPJ'}
            </dt>
            <dd className="font-medium text-slate-900 dark:text-slate-100">{customer.document ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-slate-500 dark:text-slate-400">Tipo de Pessoa</dt>
            <dd className="font-medium text-slate-900 dark:text-slate-100">
              {PERSON_TYPE_LABELS[customer.personType] ?? customer.personType}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500 dark:text-slate-400">Inscrição Estadual</dt>
            <dd className="font-medium text-slate-900 dark:text-slate-100">
              {customer.stateRegistration ?? '—'}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500 dark:text-slate-400">Inscrição Municipal</dt>
            <dd className="font-medium text-slate-900 dark:text-slate-100">
              {customer.municipalRegistration ?? '—'}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500 dark:text-slate-400">Subsegmento</dt>
            <dd className="font-medium text-slate-900 dark:text-slate-100">{customer.subsegment ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-slate-500 dark:text-slate-400">Porte</dt>
            <dd className="font-medium text-slate-900 dark:text-slate-100">
              {customer.companySize ? (COMPANY_SIZE_LABELS[customer.companySize] ?? customer.companySize) : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500 dark:text-slate-400">Origem do Lead</dt>
            <dd className="font-medium text-slate-900 dark:text-slate-100">
              {customer.leadSource ? (LEAD_SOURCE_LABELS[customer.leadSource] ?? customer.leadSource) : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500 dark:text-slate-400">Website</dt>
            <dd className="font-medium text-slate-900 dark:text-slate-100">{customer.website ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-slate-500 dark:text-slate-400">Data de Cadastro</dt>
            <dd className="font-medium text-slate-900 dark:text-slate-100">
              {new Date(customer.createdAt).toLocaleDateString('pt-BR')}
            </dd>
          </div>
        </dl>
        {customer.notes && (
          <p className="border-t border-slate-100 px-5 py-3 text-sm text-slate-600 dark:border-slate-800 dark:text-slate-400">
            <span className="font-medium text-slate-700 dark:text-slate-300">Notas: </span>
            {customer.notes}
          </p>
        )}
      </Card>

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
                      <div key={q.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                        <span className="flex flex-wrap items-center gap-2 text-slate-700 dark:text-slate-300">
                          {q.number ?? `v${q.version}`} · R$ {formatMoney(q.totalValue)}
                          <Badge tone={QUOTE_STATUS_TONE[q.status] ?? 'neutral'}>{q.status}</Badge>
                          {q.isWinner && <Badge tone="accent">vencedora</Badge>}
                          {q.validUntil && (
                            <span className="text-xs text-slate-400">
                              válida até {new Date(q.validUntil).toLocaleDateString('pt-BR')}
                            </span>
                          )}
                          {/* Fase 7 (RF012) — no máximo um pedido por proposta
                              (índice único parcial em orders.quote_id, 0008):
                              mostra o status dele em vez do botão de converter. */}
                          {q.orders.length > 0 && (
                            <Badge tone={ORDER_STATUS_TONE[q.orders[0].status] ?? 'neutral'}>
                              Pedido: {ORDER_STATUS_LABELS[q.orders[0].status] ?? q.orders[0].status}
                            </Badge>
                          )}
                        </span>
                        <span className="flex items-center gap-2">
                          <QuoteActions quoteId={q.id} status={q.status} isWinner={q.isWinner} />
                          {q.status === 'aprovada' && q.orders.length === 0 && (
                            <CreateDrawer
                              triggerLabel="Converter em Pedido"
                              title="Converter proposta em pedido"
                              description="Itens, prazo de entrega e condição de pagamento podem ser revisados antes de confirmar."
                              size="sm"
                              variant="secondary"
                            >
                              <ConvertQuoteToOrderForm quoteId={q.id} items={q.items} />
                            </CreateDrawer>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-3">
                  <NewQuoteForm
                    opportunityId={o.id}
                    templates={proposalTemplates.map((t) => ({ id: t.id, name: t.name }))}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <CardHeader
          icon={<Package className="h-4 w-4" />}
          title={`Pedidos (${customer.orders.length})`}
          description="Criados a partir da conversão de uma proposta aprovada (ou manualmente em /dashboard/pedidos)."
        />
        {customer.orders.length === 0 ? (
          <EmptyState
            icon={Package}
            title="Nenhum pedido ainda"
            description="Converta uma proposta aprovada acima, em “Propostas”."
          />
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {customer.orders.map((o) => {
              const hasInvoices = customer.invoices.some((inv) => inv.orderId === o.id);
              return (
                <div key={o.id} className="px-5 py-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <OrderStatusSelect orderId={o.id} status={o.status} />
                    <span className="font-medium text-slate-900 dark:text-slate-100">
                      R$ {formatMoney(o.totalValue)}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                    {o.deliveryDate && (
                      <span>Entrega: {new Date(o.deliveryDate).toLocaleDateString('pt-BR')}</span>
                    )}
                    {o.paymentTerms && <span>Pagamento: {o.paymentTerms}</span>}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    {!hasInvoices && <GenerateInvoicesForm orderId={o.id} />}
                    <EditDrawer triggerLabel="Editar" title="Editar pedido" size="sm" variant="ghost">
                      <EditOrderForm order={o} />
                    </EditDrawer>
                  </div>
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
