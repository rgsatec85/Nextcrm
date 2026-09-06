import { cookies } from 'next/headers';
import { backend } from '@/lib/backend';
import { SESSION_COOKIE } from '@/lib/session';

function formatMoney(value: string | number) {
  return Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
}

export default async function PortalContratosPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)!.value;
  const contracts = await backend.portalContracts(token);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-slate-900">Contratos</h1>
      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="divide-y divide-slate-100">
          {contracts.map((c) => (
            <div key={c.id} className="flex items-center justify-between px-4 py-3 text-sm">
              <div>
                <p className="font-medium text-slate-900">{c.title}</p>
                <p className="text-slate-500">
                  até {new Date(c.endDate).toLocaleDateString('pt-BR')} · R${' '}
                  {formatMoney(c.value)}
                </p>
              </div>
              {c.expiringSoon && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
                  vence em {c.daysUntilExpiration}d
                </span>
              )}
            </div>
          ))}
          {contracts.length === 0 && (
            <p className="px-4 py-6 text-sm text-slate-500">Nenhum contrato ainda.</p>
          )}
        </div>
      </section>
    </div>
  );
}
