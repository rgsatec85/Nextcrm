import { cookies } from 'next/headers';
import { backend } from '@/lib/backend';
import { SESSION_COOKIE } from '@/lib/session';

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

export default async function DashboardPage() {
  // O layout já garante que o cookie existe e o token é válido.
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)!.value;

  const [company, users] = await Promise.all([
    backend.myCompany(token) as Promise<Company>,
    backend.users(token) as Promise<CompanyUser[]>,
  ]);

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-2xl font-semibold text-slate-900">{company.name}</h1>
        <p className="text-sm text-slate-500">CNPJ {company.cnpj}</p>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="font-medium text-slate-900">
            Usuários da empresa ({users.length})
          </h2>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">Nome</th>
              <th className="px-4 py-2 font-medium">Email</th>
              <th className="px-4 py-2 font-medium">Perfil</th>
              <th className="px-4 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-slate-100">
                <td className="px-4 py-2">{u.name}</td>
                <td className="px-4 py-2">{u.email}</td>
                <td className="px-4 py-2">{u.role.name}</td>
                <td className="px-4 py-2">
                  <span
                    className={
                      u.isActive
                        ? 'rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700'
                        : 'rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600'
                    }
                  >
                    {u.isActive ? 'Ativo' : 'Inativo'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <p className="text-sm text-slate-500">
        Este é o esqueleto do Centro Administrativo (Fase 0). CRM Comercial,
        Financeiro, Portal do Cliente e demais módulos entram nas próximas
        fases do roadmap.
      </p>
    </div>
  );
}
