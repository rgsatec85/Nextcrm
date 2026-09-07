import Link from 'next/link';
import { cookies } from 'next/headers';
import { backend } from '@/lib/backend';
import { SESSION_COOKIE } from '@/lib/session';
import { NewOrderForm } from '@/components/crm/new-order-form';
import { EditOrderForm } from '@/components/crm/edit-order-form';
import { OrderStatusSelect } from '@/components/crm/order-status-select';
import { CreateDrawer, EditDrawer } from '@/components/ui/create-drawer';
import { Card, CardHeader } from '@/components/ui/card';
import { KpiCard } from '@/components/ui/kpi-card';
import { InitialsAvatar } from '@/components/ui/avatar';
import { EmptyState } from '@/components/ui/empty-state';
import { CircleCheck, Package, Truck, Wallet } from 'lucide-react';

function formatMoney(value: string | number) {
  return Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
}

// Pedidos — lista global (spec v3.1, RF012): gestão ampliada além do que o
// Cliente 360° mostra por cliente. Um pedido chega aqui de dois jeitos: (1)
// conversão explícita de uma proposta aprovada (ConvertQuoteToOrderForm, no
// Cliente 360°) — o normal — ou (2) criação manual direto aqui, sem
// proposta associada ("Novo pedido" abaixo), para uma venda direta.
export default async function PedidosPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)!.value;

  const [orders, customers] = await Promise.all([
    backend.orders(token),
    backend.customers(token),
  ]);

  const totalValue = orders.reduce((sum, o) => sum + Number(o.totalValue), 0);
  const inProgressCount = orders.filter(
    (o) => o.status === 'confirmado' || o.status === 'em_andamento',
  ).length;
  const completedCount = orders.filter((o) => o.status === 'concluido').length;

  return (
    <div className="space-y-8">
      <section className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">Pedidos</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Todos os pedidos do tenant (spec v3.1) — a maioria vem da conversão de uma proposta
            aprovada no Cliente 360°; use “Novo pedido” só para uma venda direta, sem proposta.
          </p>
        </div>
        <CreateDrawer triggerLabel="Novo pedido" title="Novo pedido (manual)">
          <NewOrderForm customers={customers.map((c) => ({ id: c.id, name: c.name }))} />
        </CreateDrawer>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <KpiCard label="Em andamento" value={String(inProgressCount)} icon={Truck} tone="warning" />
        <KpiCard label="Concluídos" value={String(completedCount)} icon={CircleCheck} tone="success" />
        <KpiCard
          label="Valor total"
          value={`R$ ${formatMoney(totalValue)}`}
          icon={Wallet}
          tone="info"
          secondary={{ label: 'Pedidos', value: `${orders.length}` }}
        />
      </section>

      <Card>
        <CardHeader icon={<Package className="h-4 w-4" />} title={`${orders.length} pedido(s)`} />
        {orders.length === 0 ? (
          <EmptyState
            icon={Package}
            title="Nenhum pedido criado ainda"
            description="Converta uma proposta aprovada no Cliente 360° ou crie um pedido manual acima."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="px-5 py-2.5 font-medium">Cliente</th>
                  <th className="px-5 py-2.5 font-medium">Origem</th>
                  <th className="px-5 py-2.5 font-medium">Prazo de entrega</th>
                  <th className="px-5 py-2.5 font-medium">Condição de pagamento</th>
                  <th className="px-5 py-2.5 font-medium">Valor</th>
                  <th className="px-5 py-2.5 font-medium">Status</th>
                  <th className="px-5 py-2.5 font-medium" />
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr
                    key={o.id}
                    className="border-t border-slate-100 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50"
                  >
                    <td className="px-5 py-2.5">
                      <Link
                        href={`/dashboard/clientes/${o.customer.id}`}
                        className="flex items-center gap-2 text-brand-600 hover:underline"
                      >
                        <InitialsAvatar name={o.customer.name} shape="square" />
                        {o.customer.name}
                      </Link>
                    </td>
                    <td className="px-5 py-2.5 text-slate-600 dark:text-slate-400">
                      {o.quote?.number ?? (o.quote ? 'Proposta' : 'Manual')}
                    </td>
                    <td className="px-5 py-2.5 text-slate-600 dark:text-slate-400">
                      {o.deliveryDate ? new Date(o.deliveryDate).toLocaleDateString('pt-BR') : '—'}
                    </td>
                    <td className="px-5 py-2.5 text-slate-600 dark:text-slate-400">
                      {o.paymentTerms ?? '—'}
                    </td>
                    <td className="px-5 py-2.5 text-slate-700 dark:text-slate-300">
                      R$ {formatMoney(o.totalValue)}
                    </td>
                    <td className="px-5 py-2.5">
                      <OrderStatusSelect orderId={o.id} status={o.status} />
                    </td>
                    <td className="px-5 py-2.5 text-right">
                      <EditDrawer triggerLabel="Editar" title="Editar pedido" size="sm" variant="ghost">
                        <EditOrderForm order={o} />
                      </EditDrawer>
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
