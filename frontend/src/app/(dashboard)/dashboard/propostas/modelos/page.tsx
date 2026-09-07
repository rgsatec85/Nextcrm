import Link from 'next/link';
import { cookies } from 'next/headers';
import { backend } from '@/lib/backend';
import { SESSION_COOKIE } from '@/lib/session';
import { NewProposalTemplateForm } from '@/components/crm/new-proposal-template-form';
import { EditProposalTemplateForm } from '@/components/crm/edit-proposal-template-form';
import { ToggleProposalTemplateButton } from '@/components/crm/toggle-proposal-template-button';
import { CreateDrawer, EditDrawer } from '@/components/ui/create-drawer';
import { Card, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { PROPOSAL_TEMPLATE_CATEGORY_LABELS } from '@/lib/crm-constants';
import { ArrowLeft, LayoutTemplate } from 'lucide-react';

// Autoria de modelos é restrita a admin/gestor no backend
// (ProposalTemplatesController) — leitura é aberta a todos os perfis
// internos (vendedor precisa da lista para escolher um modelo ao criar
// proposta, ver new-quote-form.tsx). Aqui a página só mostra os controles de
// criar/editar/desativar para quem tem permissão de fato.
const TEMPLATE_AUTHOR_ROLES = ['admin', 'gestor'];

export default async function ProposalTemplatesPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)!.value;

  const [templates, me] = await Promise.all([
    backend.proposalTemplates(token),
    backend.me(token) as Promise<{ role: { slug: string } }>,
  ]);

  const canAuthor = TEMPLATE_AUTHOR_ROLES.includes(me.role.slug);

  return (
    <div className="space-y-8">
      <section className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/dashboard/propostas"
            className="inline-flex items-center gap-1.5 text-sm text-brand-600 hover:underline"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Propostas
          </Link>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-50">
            Modelos de proposta
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Biblioteca reutilizável de modelos (spec v3.1) — cabeçalho, cláusulas e rodapé com
            campos dinâmicos ({'{{cliente.nome}}'}, {'{{valor_total}}'}, {'{{vendedor}}'},{' '}
            {'{{data}}'}) usados na geração do PDF de cada proposta.
          </p>
        </div>
        {canAuthor && (
          <CreateDrawer triggerLabel="Novo modelo" title="Novo modelo de proposta">
            <NewProposalTemplateForm />
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
                <div className="flex items-center gap-3">
                  {t.primaryColor && (
                    <span
                      className="h-4 w-4 flex-none rounded-full border border-slate-200"
                      style={{ backgroundColor: t.primaryColor }}
                      title={t.primaryColor}
                    />
                  )}
                  <div>
                    <span className="font-medium text-slate-900 dark:text-slate-100">{t.name}</span>
                    {t.category && (
                      <span className="text-slate-500 dark:text-slate-400">
                        {' '}
                        · {PROPOSAL_TEMPLATE_CATEGORY_LABELS[t.category] ?? t.category}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge tone={t.isActive ? 'success' : 'neutral'}>
                    {t.isActive ? 'Ativo' : 'Inativo'}
                  </Badge>
                  {canAuthor && (
                    <>
                      <EditDrawer triggerLabel="Editar" title="Editar modelo de proposta" size="sm" variant="ghost">
                        <EditProposalTemplateForm template={t} />
                      </EditDrawer>
                      <ToggleProposalTemplateButton templateId={t.id} isActive={t.isActive} />
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
