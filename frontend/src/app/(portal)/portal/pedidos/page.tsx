import { cookies } from 'next/headers';
import { backend } from '@/lib/backend';
import { SESSION_COOKIE } from '@/lib/session';

function formatMoney(value: string | number) {
  return Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
}

export default async function PortalPedidosPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)!.value;
  const orders = await backend.portalOrders(token);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-slate-900">Pedidos</h1>
      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="divide-y divide-slate-100">
          {orders.map((o) => (
            <div key={o.id} className="flex items-center justify-between px-4 py-3 text-sm">
              <div>
                <p className="font-medium text-slate-900">Pedido {o.id.slice(0, 8)}</p>
                <p className="text-slate-500">
                  {new Date(o.createdAt).toLocaleDateString('pt-BR')} · {o.status}
                </p>
              </div>
              <span className="font-medium text-slate-900">R$ {formatMoney(o.totalValue)}</span>
            </div>
          ))}
          {orders.length === 0 && (
            <p className="px-4 py-6 text-sm text-slate-500">Nenhum pedido ainda.</p>
          )}
        </div>
      </section>
    </div>
  );
}
