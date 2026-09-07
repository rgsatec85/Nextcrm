import { cookies } from 'next/headers';
import { backend } from '@/lib/backend';
import { SESSION_COOKIE } from '@/lib/session';
import { NewKnowledgeArticleForm } from '@/components/crm/new-knowledge-article-form';
import { CreateDrawer } from '@/components/ui/create-drawer';
import { Card, CardHeader } from '@/components/ui/card';
import { Badge, TagBadge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { BookOpen } from 'lucide-react';

// Base de conhecimento (spec Fase 3 — "Atendimento interno"). Autoria
// restrita a admin/gestor no backend — quem não tem permissão simplesmente
// não vê o botão de criação (RolesGuard bloquearia o POST de qualquer
// forma, isto aqui é só não mostrar um formulário que ia dar 403).
export default async function BaseDeConhecimentoPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)!.value;
  const me = (await backend.me(token)) as { role: { slug: string } };

  const articles = await backend.knowledgeArticles(token);
  const canAuthor = me.role.slug === 'admin' || me.role.slug === 'gestor';

  return (
    <div className="space-y-8">
      <section className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">Base de conhecimento</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Artigos publicados aparecem também no Portal do Cliente.
          </p>
        </div>
        {canAuthor && (
          <CreateDrawer triggerLabel="Novo artigo" title="Novo artigo">
            <NewKnowledgeArticleForm />
          </CreateDrawer>
        )}
      </section>

      <Card>
        <CardHeader icon={<BookOpen className="h-4 w-4" />} title={`Artigos (${articles.length})`} />
        {articles.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="Nenhum artigo cadastrado ainda"
            description={
              canAuthor
                ? 'Publique o primeiro artigo para alimentar a base de conhecimento.'
                : undefined
            }
          />
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {articles.map((a) => (
              <div key={a.id} className="px-5 py-3.5 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-slate-900 dark:text-slate-100">{a.title}</span>
                  <Badge tone={a.isPublished ? 'success' : 'neutral'}>
                    {a.isPublished ? 'Publicado' : 'Rascunho'}
                  </Badge>
                </div>
                {a.category && (
                  <p className="mt-1">
                    <TagBadge label={a.category} />
                  </p>
                )}
                <p className="mt-1 whitespace-pre-wrap text-slate-600 dark:text-slate-400">{a.body}</p>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
