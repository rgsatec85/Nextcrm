import Link from 'next/link';
import { cookies } from 'next/headers';
import { backend, BackendError } from '@/lib/backend';
import { SESSION_COOKIE } from '@/lib/session';

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

  const [dashboard, overdueInvoices, commissions] = await Promise.all([
    backend.financeDashboard(token).catch((err) => {
      if (err instanceof BackendError && err.status === 403) return null;
      throw err;
    }),
    backend.invoicesOverdue(token).catch(() => []),
    backend.commissions(token).catch(() => []),
  ]);

  if (!dashboard) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-slate-900">Financeiro</h1>
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Este dashboard é restrito a admin, gestor e financeiro. Sua conta não
          tem acesso — mas você pode ver a{' '}
          <Link href="/dashboard/contratos" className="underline">
            página de contratos
          </Link>
          , ou seu próprio relatório de comissões abaixo.
        </p>
        {commissions.length > 0 && (
          <CommissionsTable commissions={commissions} />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-2xl font-semibold text-slate-900">Financeiro</h1>
        <p className="text-sm text-slate-500">
          Contas a receber, cobrança e comissões (spec Fase 2).
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-4">
        <KpiCard label="A receber" value={dashboard.totalReceivable} />
        <KpiCard label="Recebido" value={dashboard.totalReceived} tone="emerald" />
        <KpiCard label="Atrasado" value={dashboard.totalOverdue} tone="red" />
        <KpiCard label="Faturas vencidas" value={dashboard.overdueCount} isCount />
      </section>

      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="font-medium text-slate-900">Fluxo de caixa por mês</h2>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">Mês</th>
              <th className="px-4 py-2 font-medium">Esperado</th>
              <th className="px-4 py-2 font-medium">Recebido</th>
            </tr>
          </thead>
          <tbody>
            {dashboard.cashflow.map((c) => (
              <tr key={c.month} className="border-t border-slate-100">
                <td className="px-4 py-2">{c.month}</td>
                <td className="px-4 py-2">R$ {formatMoney(c.expected)}</td>
                <td className="px-4 py-2">R$ {formatMoney(c.received)}</td>
              </tr>
            ))}
            {dashboard.cashflow.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-slate-500">
                  Nenhuma fatura gerada ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="font-medium text-slate-900">
            Faturas vencidas ({overdueInvoices.length})
          </h2>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">Cliente</th>
              <th className="px-4 py-2 font-medium">Vencimento</th>
              <th className="px-4 py-2 font-medium">Saldo</th>
            </tr>
          </thead>
          <tbody>
            {overdueInvoices.map((inv) => (
              <tr key={inv.id} className="border-t border-slate-100">
                <td className="px-4 py-2">
                  {inv.customer ? (
                    <Link
                      href={`/dashboard/clientes/${inv.customer.id}`}
                      className="text-brand-600 hover:underline"
                    >
                      {inv.customer.name}
                    </Link>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="px-4 py-2">{new Date(inv.dueDate).toLocaleDateString('pt-BR')}</td>
                <td className="px-4 py-2">
                  R$ {formatMoney(Number(inv.amount) - Number(inv.paidAmount))}
                </td>
              </tr>
            ))}
            {overdueInvoices.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-slate-500">
                  Nenhuma fatura vencida. 🎉
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <CommissionsTable commissions={commissions} />
    </div>
  );
}

function KpiCard({
  label,
  value,
  tone,
  isCount,
}: {
  label: string;
  value: number;
  tone?: 'emerald' | 'red';
  isCount?: boolean;
}) {
  const color =
    tone === 'emerald' ? 'text-emerald-700' : tone === 'red' ? 'text-red-700' : 'text-slate-900';
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-xs font-medium uppercase text-slate-500">{label}</p>
      <p className={`mt-1 text-xl font-semibold ${color}`}>
        {isCount ? value : `R$ ${formatMoney(value)}`}
      </p>
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
    <section className="rounded-lg border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 className="font-medium text-slate-900">Comissões</h2>
      </div>
      <table className="w-full text-left text-sm">
        <thead className="text-slate-500">
          <tr>
            <th className="px-4 py-2 font-medium">Vendedor</th>
            <th className="px-4 py-2 font-medium">Recebido</th>
            <th className="px-4 py-2 font-medium">Taxa</th>
            <th className="px-4 py-2 font-medium">Comissão</th>
          </tr>
        </thead>
        <tbody>
          {commissions.map((c) => (
            <tr key={c.ownerId} className="border-t border-slate-100">
              <td className="px-4 py-2">{c.ownerName}</td>
              <td className="px-4 py-2">R$ {formatMoney(c.totalPaid)}</td>
              <td className="px-4 py-2">{(c.commissionRate * 100).toFixed(1)}%</td>
              <td className="px-4 py-2 font-medium text-slate-900">
                R$ {formatMoney(c.commissionAmount)}
              </td>
            </tr>
          ))}
          {commissions.length === 0 && (
            <tr>
              <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                Nenhuma fatura paga ainda.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}
