import { cookies } from 'next/headers';
import { backend, BackendError } from '@/lib/backend';
import { SESSION_COOKIE } from '@/lib/session';
import { OPPORTUNITY_STAGES, STAGE_LABELS } from '@/lib/crm-constants';
import { KpiCard } from '@/components/ui/kpi-card';
import { Card, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StageValueChart, type StageValuePoint } from '@/components/charts/stage-value-chart';
import { Building2, LifeBuoy, TrendingUp, Users, Wallet, Workflow } from 'lucide-react';

interface CompanyUser {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  role: { name: string; slug: string };
}

interface Company {
  id: string;
  name: string;
  cnpj: string;
  createdAt: string;
}

function formatMoney(value: number) {
  return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
}

// Visão geral do tenant (redesign de UI): KPIs consolidados a partir dos
// mesmos endpoints já usados pelas páginas Clientes/Pipeline/Financeiro/
// Chamados, sem nenhuma chamada nova ao backend — só reorganiza o que já
// existe (spec §0 + Fases 1-4).
export default async function DashboardPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)!.value;

  const [company, users, customers, opportunities, tickets, financeDashboard] = await Promise.all([
    backend.myCompany(token) as Promise<Company>,
    backend.users(token) as Promise<CompanyUser[]>,
    backend.customers(token),
    backend.opportunities(token),
    backend.tickets(token).catch(() => []),
    backend.financeDashboard(token).catch((err) => {
      if (err instanceof BackendError && err.status === 403) return null;
      return null;
    }),
  ]);

  const openOpportunities = opportunities.filter(
    (o) => o.stage !== 'fechado_ganho' && o.stage !== 'fechado_perdido',
  );
  const openValue = openOpportunities.reduce((sum, o) => sum + Number(o.value), 0);
  const openTickets = tickets.filter((t) => t.status === 'aberto' || t.status === 'em_andamento').length;

  const stageData: StageValuePoint[] = OPPORTUNITY_STAGES.filter(
    (s) => s !== 'fechado_ganho' && s !== 'fechado_perdido',
  ).map((stage) => {
    const inStage = opportunities.filter((o) => o.stage === stage);
    return {
      stage,
      label: STAGE_LABELS[stage],
      value: inStage.reduce((sum, o) => sum + Number(o.value), 0),
      count: inStage.length,
    };
  });

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">{company.name}</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">CNPJ {company.cnpj}</p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Clientes" value={String(customers.length)} icon={Building2} tone="info" />
        <KpiCard
          label="Oportunidades abertas"
          value={String(openOpportunities.length)}
          icon={Workflow}
          tone="info"
          hint={formatMoney(openValue)}
        />
        <KpiCard
          label="A receber"
          value={financeDashboard ? formatMoney(financeDashboard.totalReceivable) : '—'}
          icon={Wallet}
          tone="info"
          hint={financeDashboard ? `${financeDashboard.overdueCount} fatura(s) vencida(s)` : 'restrito ao seu perfil'}
        />
        <KpiCard label="Chamados em aberto" value={String(openTickets)} icon={LifeBuoy} tone="warning" />
      </section>

      {stageData.some((s) => s.count > 0) && (
        <Card>
          <CardHeader
            icon={<TrendingUp className="h-4 w-4" />}
            title="Pipeline por estágio"
            description="Valor total de oportunidades abertas em cada estágio"
          />
          <div className="px-5 py-4">
            <StageValueChart data={stageData} height={220} />
          </div>
        </Card>
      )}

      <Card>
        <CardHeader
          icon={<Users className="h-4 w-4" />}
          title={`Usuários da empresa (${users.length})`}
        />
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-slate-500 dark:text-slate-400">
              <tr>
                <th className="px-5 py-2.5 font-medium">Nome</th>
                <th className="px-5 py-2.5 font-medium">Email</th>
                <th className="px-5 py-2.5 font-medium">Perfil</th>
                <th className="px-5 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr
                  key={u.id}
                  className="border-t border-slate-100 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50"
                >
                  <td className="px-5 py-2.5 font-medium text-slate-900 dark:text-slate-100">{u.name}</td>
                  <td className="px-5 py-2.5 text-slate-600 dark:text-slate-400">{u.email}</td>
                  <td className="px-5 py-2.5 text-slate-600 dark:text-slate-400">{u.role.name}</td>
                  <td className="px-5 py-2.5">
                    <Badge tone={u.isActive ? 'success' : 'neutral'}>{u.isActive ? 'Ativo' : 'Inativo'}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
