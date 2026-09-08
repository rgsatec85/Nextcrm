import Link from 'next/link';
import { cookies } from 'next/headers';
import { backend } from '@/lib/backend';
import { SESSION_COOKIE } from '@/lib/session';
import { NewContractTemplateForm } from '@/components/crm/new-contract-template-form';
import { EditContractTemplateForm } from '@/components/crm/edit-contract-template-form';
import { ToggleContractTemplateButton } from '@/components/crm/toggle-contract-template-button';
import { CreateDrawer, EditDrawer } from '@/components/ui/create-drawer';
import { Card, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { CONTRACT_TEMPLATE_CATEGORY_LABELS } from '@/lib/crm-constants';
import { ArrowLeft, LayoutTemplate } from 'lucide-react';

// Autoria de modelos é restrita a admin/gestor no backend
// (ContractTemplatesController) — leitura é aberta a todos os perfis
// internos (vendedor precisa da lista para escolher um modelo ao criar
// contrato, ver new-contract-form.tsx). Mesmo padrão de
// propostas/modelos/page.tsx.
const TEMPLATE_AUTHOR_ROLES = ['admin', 'gestor'];

export default async function ContractTemplatesPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)!.value;

  const [templates, me] = await Promise.all([
    backend.contractTemplates(token),
    backend.me(token) as Promise<{ role: { slug: string } }>,
  ]);

  const canAuthor = TEMPLATE_AUTHOR_ROLES.includes(me.role.slug);

  return (
    <div className="space-y-8">
      <section className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/dashboard/contratos"
            className="inline-flex items-center gap-1.5 text-sm text-brand-600 hover:underline"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Contratos
          </Link>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-50">
            Modelos de contrato
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Biblioteca reutilizável de modelos (Fase 9, RF013) — corpo em texto rico com campos
            dinâmicos ({'{{cliente.nome}}'}, {'{{valor}}'}, {'{{vigencia_inicio}}'},{' '}
            {'{{vigencia_fim}}'}, {'{{vendedor}}'}, {'{{data}}'}) copiados para dentro do contrato
            quando o modelo é aplicado — editar o modelo depois não muda contratos já criados a
            partir dele.
          </p>
        </div>
        {canAuthor && (
          <CreateDrawer triggerLabel="Novo modelo" title="Novo modelo de contrato">
            <NewContractTemplateForm />
          </CreateDrawer>
        )}
      </section>

      <Card>
        <CardHeader
          icon={<LayoutTemplate className="h-4 w-4" />}
          title={`${templates.length} modelo(s)`}
        />
        {templates.length === 0 ? (
          <EmptyState icon={LayoutTemplate} title="Nenhum modelo cadastrado ainda" />
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {templates.map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-3 px-5 py-3.5 text-sm">
                <div>
                  <span className="font-medium text-slate-900 dark:text-slate-100">{t.name}</span>
                  {t.category && (
                    <span className="text-slate-500 dark:text-slate-400">
                      {' '}
                      · {CONTRACT_TEMPLATE_CATEGORY_LABELS[t.category] ?? t.category}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <Badge tone={t.isActive ? 'success' : 'neutral'}>
                    {t.isActive ? 'Ativo' : 'Inativo'}
                  </Badge>
                  {canAuthor && (
                    <>
                      <EditDrawer triggerLabel="Editar" title="Editar modelo de contrato" size="sm" variant="ghost">
                        <EditContractTemplateForm template={t} />
                      </EditDrawer>
                      <ToggleContractTemplateButton templateId={t.id} isActive={t.isActive} />
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
