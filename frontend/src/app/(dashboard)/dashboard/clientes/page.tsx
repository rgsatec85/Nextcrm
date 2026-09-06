import Link from 'next/link';
import { cookies } from 'next/headers';
import { backend } from '@/lib/backend';
import { SESSION_COOKIE } from '@/lib/session';
import { NewCustomerForm } from '@/components/crm/new-customer-form';

export default async function ClientesPage() {
  // O layout do grupo (dashboard) já garante cookie presente + token válido.
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)!.value;

  const customers = await backend.customers(token);

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-2xl font-semibold text-slate-900">Clientes</h1>
        <p className="text-sm text-slate-500">
          Empresas e clientes cadastrados. Abra o Cliente 360° para ver contatos,
          oportunidades, propostas, pedidos e agenda (spec §10).
        </p>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-4 font-medium text-slate-900">Novo cliente</h2>
        <NewCustomerForm />
      </section>

      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="font-medium text-slate-900">
            {customers.length} cliente(s)
          </h2>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">Nome</th>
              <th className="px-4 py-2 font-medium">Segmento</th>
              <th className="px-4 py-2 font-medium">Email</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => (
              <tr key={c.id} className="border-t border-slate-100">
                <td className="px-4 py-2 font-medium text-slate-900">{c.name}</td>
                <td className="px-4 py-2">{c.segment ?? '—'}</td>
                <td className="px-4 py-2">{c.email ?? '—'}</td>
                <td className="px-4 py-2">
                  <span
                    className={
                      c.status === 'ativo'
                        ? 'rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700'
                        : 'rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600'
                    }
                  >
                    {c.status}
                  </span>
                </td>
                <td className="px-4 py-2 text-right">
                  <Link
                    href={`/dashboard/clientes/${c.id}`}
                    className="font-medium text-brand-600 hover:underline"
                  >
                    Ver 360°
                  </Link>
                </td>
              </tr>
            ))}
            {customers.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                  Nenhum cliente cadastrado ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
