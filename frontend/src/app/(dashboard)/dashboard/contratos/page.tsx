import Link from 'next/link';
import { cookies } from 'next/headers';
import { backend } from '@/lib/backend';
import { SESSION_COOKIE } from '@/lib/session';
import { NewContractForm } from '@/components/crm/new-contract-form';
import { RenewContractButton } from '@/components/crm/renew-contract-button';

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

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-2xl font-semibold text-slate-900">Contratos</h1>
        <p className="text-sm text-slate-500">
          Vigência, renovação e alertas de vencimento (spec Fase 2).
        </p>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-4 font-medium text-slate-900">Novo contrato</h2>
        <NewContractForm customers={customers.map((c) => ({ id: c.id, name: c.name }))} />
      </section>

      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="font-medium text-slate-900">{contracts.length} contrato(s)</h2>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">Cliente</th>
              <th className="px-4 py-2 font-medium">Título</th>
              <th className="px-4 py-2 font-medium">Vigência</th>
              <th className="px-4 py-2 font-medium">Valor</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {contracts.map((c) => (
              <tr key={c.id} className="border-t border-slate-100">
                <td className="px-4 py-2">
                  {c.customer ? (
                    <Link
                      href={`/dashboard/clientes/${c.customer.id}`}
                      className="text-brand-600 hover:underline"
                    >
                      {c.customer.name}
                    </Link>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="px-4 py-2">{c.title}</td>
                <td className="px-4 py-2">
                  {new Date(c.startDate).toLocaleDateString('pt-BR')} –{' '}
                  {new Date(c.endDate).toLocaleDateString('pt-BR')}
                  {c.expiringSoon && (
                    <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
                      vence em {c.daysUntilExpiration}d
                    </span>
                  )}
                </td>
                <td className="px-4 py-2">R$ {formatMoney(c.value)}</td>
                <td className="px-4 py-2">{c.status}</td>
                <td className="px-4 py-2 text-right">
                  {c.status === 'ativo' && <RenewContractButton contractId={c.id} />}
                </td>
              </tr>
            ))}
            {contracts.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                  Nenhum contrato cadastrado ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
