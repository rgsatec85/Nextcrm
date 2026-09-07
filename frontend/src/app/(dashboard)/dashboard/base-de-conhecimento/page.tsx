import { cookies } from 'next/headers';
import { backend } from '@/lib/backend';
import { SESSION_COOKIE } from '@/lib/session';
import { NewKnowledgeArticleForm } from '@/components/crm/new-knowledge-article-form';

// Base de conhecimento (spec Fase 3 — "Atendimento interno"). Autoria
// restrita a admin/gestor no backend — quem não tem permissão simplesmente
// não vê o formulário de criação (RolesGuard bloquearia o POST de qualquer
// forma, isto aqui é só não mostrar um formulário que ia dar 403).
export default async function BaseDeConhecimentoPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)!.value;
  const me = await backend.me(token) as { role: { slug: string } };

  const articles = await backend.knowledgeArticles(token);
  const canAuthor = me.role.slug === 'admin' || me.role.slug === 'gestor';

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-2xl font-semibold text-slate-900">Base de conhecimento</h1>
        <p className="text-sm text-slate-500">
          Artigos publicados aparecem também no Portal do Cliente.
        </p>
      </section>

      {canAuthor && (
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-3 font-medium text-slate-900">Novo artigo</h2>
          <NewKnowledgeArticleForm />
        </section>
      )}

      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="font-medium text-slate-900">Artigos ({articles.length})</h2>
        </div>
        <div className="divide-y divide-slate-100">
          {articles.map((a) => (
            <div key={a.id} className="px-4 py-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-900">{a.title}</span>
                <span
                  className={
                    a.isPublished
                      ? 'rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700'
                      : 'rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600'
                  }
                >
                  {a.isPublished ? 'Publicado' : 'Rascunho'}
                </span>
              </div>
              {a.category && <p className="text-xs text-slate-400">{a.category}</p>}
              <p className="mt-1 whitespace-pre-wrap text-slate-600">{a.body}</p>
            </div>
          ))}
          {articles.length === 0 && (
            <p className="px-4 py-6 text-sm text-slate-500">Nenhum artigo cadastrado ainda.</p>
          )}
        </div>
      </section>
    </div>
  );
}
