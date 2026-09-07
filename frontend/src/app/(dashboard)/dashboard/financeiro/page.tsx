import Link from 'next/link';
import { cookies } from 'next/headers';
import { backend, BackendError, type AiCollectionsSuggestions as AiCollectionsSuggestionsData } from '@/lib/backend';
import { SESSION_COOKIE } from '@/lib/session';
import { KpiCard } from '@/components/ui/kpi-card';
import { Card, CardHeader } from '@/components/ui/card';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { CashflowChart } from '@/components/charts/cashflow-chart';
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  PartyPopper,
  Percent,
  ShieldAlert,
  Sparkles,
  Wallet,
} from 'lucide-react';

function formatMoney(value: number) {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
}

// Dashboard financeiro (spec Fase 2): a receber, recebido, atrasado, fluxo
// de caixa por mês e o relatório de comissões. Dashboard/commissions são
// restritos por role no backend — vendedor cai no bloco de "acesso
// restrito" abaixo em vez de ver uma tela quebrada.
export default async function FinanceiroPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)!.value;

  const [dashboard, overdueInvoices, commissions, collections] = await Promise.all([
    backend.financeDashboard(token).catch((err) => {
      if (err instanceof BackendError && err.status === 403) return null;
      throw err;
    }),
    backend.invoicesOverdue(token).catch(() => []),
    backend.commissions(token).catch(() => []),
    // Cobranças Inteligentes (spec Fase 4) — vendedor também acessa (vê só
    // as próprias, via ABAC no backend), então não tratamos 403 aqui como
    // "sem acesso": qualquer erro só omite a seção sem quebrar a página.
    backend.aiCollectionsSuggestions(token).catch(() => null),
  ]);

  if (!dashboard) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">Financeiro</h1>
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
          Este dashboard é restrito a admin, gestor e financeiro. Sua conta não
          tem acesso — mas você pode ver a{' '}
          <Link href="/dashboard/contratos" className="underline">
            página de contratos
          </Link>
          , ou seu próprio relatório de comissões abaixo.
        </p>
        {commissions.length > 0 && <CommissionsTable commissions={commissions} />}
        {collections && <CollectionsSuggestions collections={collections} />}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">Financeiro</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Contas a receber, cobrança e comissões (spec Fase 2).
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="A receber" value={`R$ ${formatMoney(dashboard.totalReceivable)}`} icon={Wallet} tone="info" />
        <KpiCard
          label="Recebido"
          value={`R$ ${formatMoney(dashboard.totalReceived)}`}
          icon={CheckCircle2}
          tone="success"
        />
        <KpiCard label="Atrasado" value={`R$ ${formatMoney(dashboard.totalOverdue)}`} icon={AlertTriangle} tone="danger" />
        <KpiCard label="Faturas vencidas" value={String(dashboard.overdueCount)} icon={ShieldAlert} tone="danger" />
      </section>

      <Card>
        <CardHeader icon={<BarChart3 className="h-4 w-4" />} title="Fluxo de caixa por mês" />
        {dashboard.cashflow.length === 0 ? (
          <EmptyState icon={BarChart3} title="Nenhuma fatura gerada ainda" />
        ) : (
          <div className="px-5 py-4">
            <CashflowChart data={dashboard.cashflow} />
          </div>
        )}
      </Card>

      <Card>
        <CardHeader icon={<AlertTriangle className="h-4 w-4" />} title={`Faturas vencidas (${overdueInvoices.length})`} />
        {overdueInvoices.length === 0 ? (
          <EmptyState icon={PartyPopper} title="Nenhuma fatura vencida" description="Tudo em dia por aqui." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="px-5 py-2.5 font-medium">Cliente</th>
                  <th className="px-5 py-2.5 font-medium">Vencimento</th>
                  <th className="px-5 py-2.5 font-medium">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {overdueInvoices.map((inv) => (
                  <tr
                    key={inv.id}
                    className="border-t border-slate-100 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50"
                  >
                    <td className="px-5 py-2.5">
                      {inv.customer ? (
                        <Link href={`/dashboard/clientes/${inv.customer.id}`} className="text-brand-600 hover:underline">
                          {inv.customer.name}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-5 py-2.5 text-slate-600 dark:text-slate-400">
                      {new Date(inv.dueDate).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-5 py-2.5 font-medium text-red-600 dark:text-red-400">
                      R$ {formatMoney(Number(inv.amount) - Number(inv.paidAmount))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {collections && <CollectionsSuggestions collections={collections} />}

      <CommissionsTable commissions={commissions} />
    </div>
  );
}

function CommissionsTable({
  commissions,
}: {
  commissions: Array<{
    ownerId: string;
    ownerName: string;
    totalPaid: number;
    commissionRate: number;
    commissionAmount: number;
  }>;
}) {
  return (
    <Card>
      <CardHeader icon={<Percent className="h-4 w-4" />} title="Comissões" />
      {commissions.length === 0 ? (
        <EmptyState icon={Percent} title="Nenhuma fatura paga ainda" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-slate-500 dark:text-slate-400">
              <tr>
                <th className="px-5 py-2.5 font-medium">Vendedor</th>
                <th className="px-5 py-2.5 font-medium">Recebido</th>
                <th className="px-5 py-2.5 font-medium">Taxa</th>
                <th className="px-5 py-2.5 font-medium">Comissão</th>
              </tr>
            </thead>
            <tbody>
              {commissions.map((c) => (
                <tr
                  key={c.ownerId}
                  className="border-t border-slate-100 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50"
                >
                  <td className="px-5 py-2.5 text-slate-700 dark:text-slate-300">{c.ownerName}</td>
                  <td className="px-5 py-2.5 text-slate-600 dark:text-slate-400">R$ {formatMoney(c.totalPaid)}</td>
                  <td className="px-5 py-2.5 text-slate-600 dark:text-slate-400">
                    {(c.commissionRate * 100).toFixed(1)}%
                  </td>
                  <td className="px-5 py-2.5 font-medium text-slate-900 dark:text-slate-100">
                    R$ {formatMoney(c.commissionAmount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

const PRIORITY_TONE: Record<string, BadgeTone> = {
  baixa: 'neutral',
  media: 'warning',
  alta: 'orange',
  critica: 'danger',
};

// Cobranças Inteligentes (spec Fase 4): estende a listagem de faturas
// vencidas da Fase 2 com prioridade/canal/ação sugeridos por fatura — regra
// fixa por dias de atraso (ver backend/src/modules/ai/collections.ts), não
// um modelo treinado.
function CollectionsSuggestions({ collections }: { collections: AiCollectionsSuggestionsData }) {
  return (
    <Card>
      <CardHeader
        icon={<Sparkles className="h-4 w-4" />}
        title={`Cobranças Inteligentes (${collections.count})`}
        description={collections.narrative}
      />
      {collections.suggestions.length === 0 ? (
        <EmptyState icon={Sparkles} title="Nenhuma sugestão de cobrança no momento" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-slate-500 dark:text-slate-400">
              <tr>
                <th className="px-5 py-2.5 font-medium">Cliente</th>
                <th className="px-5 py-2.5 font-medium">Saldo</th>
                <th className="px-5 py-2.5 font-medium">Atraso</th>
                <th className="px-5 py-2.5 font-medium">Prioridade</th>
                <th className="px-5 py-2.5 font-medium">Canal sugerido</th>
              </tr>
            </thead>
            <tbody>
              {collections.suggestions.map((s) => (
                <tr
                  key={s.invoiceId}
                  className="border-t border-slate-100 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50"
                >
                  <td className="px-5 py-2.5 text-slate-700 dark:text-slate-300">{s.customerName}</td>
                  <td className="px-5 py-2.5 text-slate-600 dark:text-slate-400">R$ {formatMoney(s.remaining)}</td>
                  <td className="px-5 py-2.5 text-slate-600 dark:text-slate-400">{s.daysOverdue}d</td>
                  <td className="px-5 py-2.5">
                    <Badge tone={PRIORITY_TONE[s.priority] ?? 'slate'}>{s.priority}</Badge>
                  </td>
                  <td className="px-5 py-2.5 text-slate-600 dark:text-slate-400">{s.channel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
