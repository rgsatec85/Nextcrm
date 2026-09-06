import { cookies } from 'next/headers';
import { backend } from '@/lib/backend';
import { SESSION_COOKIE } from '@/lib/session';

export default async function PortalBaseDeConhecimentoPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)!.value;
  const articles = await backend.portalKnowledge(token);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-slate-900">Ajuda</h1>
      <section className="space-y-3">
        {articles.map((a) => (
          <div key={a.id} className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="font-medium text-slate-900">{a.title}</h2>
            {a.category && <p className="text-xs text-slate-400">{a.category}</p>}
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{a.body}</p>
          </div>
        ))}
        {articles.length === 0 && (
          <p className="rounded-lg border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">
            Nenhum artigo publicado ainda.
          </p>
        )}
      </section>
    </div>
  );
}
