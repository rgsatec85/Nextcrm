import Link from 'next/link';
import { cookies } from 'next/headers';
import { backend } from '@/lib/backend';
import { SESSION_COOKIE } from '@/lib/session';
import { NewCustomerForm } from '@/components/crm/new-customer-form';
import { EditCustomerForm } from '@/components/crm/edit-customer-form';
import { CreateDrawer, EditDrawer } from '@/components/ui/create-drawer';
import { Card, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Building2, ChevronRight } from 'lucide-react';

// Perfis que podem reatribuir o dono (`ownerId`) de um cliente — vendedor
// sempre vira dono do que cria/edita no backend (ownership.ts), então o
// seletor de "Vendedor Responsável" nem aparece pra ele.
const OWNER_REASSIGN_ROLES = ['admin', 'gestor', 'financeiro'];

export default async function ClientesPage() {
  // O layout do grupo (dashboard) já garante cookie presente + token válido.
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)!.value;

  const [customers, me, users] = await Promise.all([
    backend.customers(token),
    backend.me(token) as Promise<{ role: { slug: string } }>,
    // Só para popular o seletor de "Vendedor Responsável" — mesmo endpoint
    // já usado no Pipeline para resolver nome do responsável por avatar.
    backend.users(token).catch(() => []) as Promise<{ id: string; name: string }[]>,
  ]);

  const canReassignOwner = OWNER_REASSIGN_ROLES.includes(me.role.slug);
  const owners = canReassignOwner ? users : undefined;

  return (
    <div className="space-y-8">
      <section className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">Clientes</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Empresas e clientes cadastrados. Abra o Cliente 360° para ver contatos,
            oportunidades, propostas, pedidos e agenda (spec §10).
          </p>
        </div>
        <CreateDrawer
          triggerLabel="Novo cliente"
          description="Cadastre uma nova empresa cliente. Contatos e oportunidades são adicionados depois, no Cliente 360°."
        >
          <NewCustomerForm owners={owners} />
        </CreateDrawer>
      </section>

      <Card>
        <CardHeader icon={<Building2 className="h-4 w-4" />} title={`${customers.length} cliente(s)`} />
        {customers.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="Nenhum cliente cadastrado ainda"
            description="Comece cadastrando o primeiro cliente da sua carteira."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="px-5 py-2.5 font-medium">Nome</th>
                  <th className="px-5 py-2.5 font-medium">Segmento</th>
                  <th className="px-5 py-2.5 font-medium">Email</th>
                  <th className="px-5 py-2.5 font-medium">Status</th>
                  <th className="px-5 py-2.5 font-medium" />
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr
                    key={c.id}
                    className="border-t border-slate-100 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50"
                  >
                    <td className="px-5 py-2.5 font-medium text-slate-900 dark:text-slate-100">{c.name}</td>
                    <td className="px-5 py-2.5 text-slate-600 dark:text-slate-400">{c.segment ?? '—'}</td>
                    <td className="px-5 py-2.5 text-slate-600 dark:text-slate-400">{c.email ?? '—'}</td>
                    <td className="px-5 py-2.5">
                      <Badge tone={c.status === 'ativo' ? 'success' : 'neutral'}>{c.status}</Badge>
                    </td>
                    <td className="px-5 py-2.5">
                      <div className="flex items-center justify-end gap-3">
                        <EditDrawer triggerLabel="Editar" title="Editar cliente" size="sm" variant="ghost">
                          <EditCustomerForm customer={c} owners={owners} />
                        </EditDrawer>
                        <Link
                          href={`/dashboard/clientes/${c.id}`}
                          className="inline-flex items-center gap-1 font-medium text-brand-600 hover:underline"
                        >
                          Ver 360° <ChevronRight className="h-3.5 w-3.5" />
                        </Link>
                      </div>
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
