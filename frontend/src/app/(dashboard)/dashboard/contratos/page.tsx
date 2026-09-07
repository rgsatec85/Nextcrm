import Link from 'next/link';
import { cookies } from 'next/headers';
import { backend } from '@/lib/backend';
import { SESSION_COOKIE } from '@/lib/session';
import { NewContractForm } from '@/components/crm/new-contract-form';
import { RenewContractButton } from '@/components/crm/renew-contract-button';
import { CreateDrawer } from '@/components/ui/create-drawer';
import { KpiCard } from '@/components/ui/kpi-card';
import { Card, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { InitialsAvatar } from '@/components/ui/avatar';
import { EmptyState } from '@/components/ui/empty-state';
import { CONTRACT_STATUS_TONE, expiringSoonTone } from '@/lib/crm-constants';
import { AlarmClock, CircleCheck, FileSignature, Wallet } from 'lucide-react';

function formatMoney(value: string | number) {
  return Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
}

export default async function ContratosPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)!.value;

  const [contracts, customers] = await Promise.all([
    backend.contracts(token),
    backend.customers(token),
  ]);

  const activeContracts = contracts.filter((c) => c.status === 'ativo');
  const expiringSoon = contracts.filter((c) => c.expiringSoon);
  const totalValue = contracts.reduce((sum, c) => sum + Number(c.value), 0);

  return (
    <div className="space-y-8">
      <section className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">Contratos</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Vigência, renovação e alertas de vencimento (spec Fase 2).
          </p>
        </div>
        <CreateDrawer triggerLabel="Novo contrato">
          <NewContractForm customers={customers.map((c) => ({ id: c.id, name: c.name }))} />
        </CreateDrawer>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <KpiCard
          label="Contratos ativos"
          value={String(activeContracts.length)}
          icon={CircleCheck}
          tone="success"
          secondary={{
            label: 'Valor ativo',
            value: `R$ ${formatMoney(activeContracts.reduce((sum, c) => sum + Number(c.value), 0))}`,
          }}
        />
        <KpiCard label="Vencendo em 30 dias" value={String(expiringSoon.length)} icon={AlarmClock} tone="warning" />
        <KpiCard
          label="Valor total"
          value={`R$ ${formatMoney(totalValue)}`}
          icon={Wallet}
          tone="info"
          secondary={{ label: 'Contratos', value: `${contracts.length}` }}
        />
      </section>

      <Card>
        <CardHeader icon={<FileSignature className="h-4 w-4" />} title={`${contracts.length} contrato(s)`} />
        {contracts.length === 0 ? (
          <EmptyState
            icon={FileSignature}
            title="Nenhum contrato cadastrado ainda"
            description="Crie o primeiro contrato para acompanhar vigência e renovação."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="px-5 py-2.5 font-medium">Cliente</th>
                  <th className="px-5 py-2.5 font-medium">Título</th>
                  <th className="px-5 py-2.5 font-medium">Vigência</th>
                  <th className="px-5 py-2.5 font-medium">Valor</th>
                  <th className="px-5 py-2.5 font-medium">Status</th>
                  <th className="px-5 py-2.5 font-medium" />
                </tr>
              </thead>
              <tbody>
                {contracts.map((c) => (
                  <tr
                    key={c.id}
                    className="border-t border-slate-100 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50"
                  >
                    <td className="px-5 py-2.5">
                      {c.customer ? (
                        <Link
                          href={`/dashboard/clientes/${c.customer.id}`}
                          className="flex items-center gap-2 text-brand-600 hover:underline"
                        >
                          <InitialsAvatar name={c.customer.name} shape="square" />
                          {c.customer.name}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-5 py-2.5 text-slate-700 dark:text-slate-300">{c.title}</td>
                    <td className="px-5 py-2.5 text-slate-600 dark:text-slate-400">
                      {new Date(c.startDate).toLocaleDateString('pt-BR')} –{' '}
                      {new Date(c.endDate).toLocaleDateString('pt-BR')}
                      {c.expiringSoon && (
                        <span className="ml-2 inline-block">
                          <Badge tone={expiringSoonTone(c.daysUntilExpiration)}>
                            vence em {c.daysUntilExpiration}d
                          </Badge>
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-2.5 text-slate-700 dark:text-slate-300">R$ {formatMoney(c.value)}</td>
                    <td className="px-5 py-2.5">
                      <Badge tone={CONTRACT_STATUS_TONE[c.status] ?? 'neutral'}>{c.status}</Badge>
                    </td>
                    <td className="px-5 py-2.5 text-right">
                      {c.status === 'ativo' && <RenewContractButton contractId={c.id} />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
