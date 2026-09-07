import Link from 'next/link';
import { cookies } from 'next/headers';
import { backend } from '@/lib/backend';
import { SESSION_COOKIE } from '@/lib/session';
import { QuoteActions } from '@/components/crm/quote-actions';
import { Card, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { InitialsAvatar } from '@/components/ui/avatar';
import { EmptyState } from '@/components/ui/empty-state';
import { KpiCard } from '@/components/ui/kpi-card';
import { QUOTE_STATUS_LABELS, QUOTE_STATUS_TONE } from '@/lib/crm-constants';
import { FileText, Send, Trophy, Wallet } from 'lucide-react';

function formatMoney(value: string | number) {
  return Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
}

// Propostas — lista global (spec v3.1, RF011): visão de todas as propostas
// do tenant fora do contexto de uma oportunidade específica. O Cliente 360°
// (clientes/[id]) continua mostrando as propostas agrupadas por
// oportunidade — esta tela é a visão gerencial "todas as propostas de
// todos os clientes". ABAC (ownerScopeWhere) já filtra no backend: vendedor
// só vê propostas de oportunidades das quais é dono.
export default async function PropostasPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)!.value;

  const quotes = await backend.quotes(token);

  const totalValue = quotes.reduce((sum, q) => sum + Number(q.totalValue), 0);
  const sentCount = quotes.filter((q) => q.status === 'enviada').length;
  const winnerCount = quotes.filter((q) => q.isWinner).length;

  return (
    <div className="space-y-8">
      <section className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">Propostas</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Todas as propostas comerciais do tenant (spec v3.1). Novas propostas são criadas a
            partir do Cliente 360° de cada oportunidade.
          </p>
        </div>
        <Link
          href="/dashboard/propostas/modelos"
          className="text-sm font-medium text-brand-600 hover:underline"
        >
          Modelos de proposta
        </Link>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <KpiCard label="Total de propostas" value={String(quotes.length)} icon={FileText} tone="info" />
        <KpiCard label="Aguardando decisão" value={String(sentCount)} icon={Send} tone="warning" />
        <KpiCard
          label="Valor total"
          value={`R$ ${formatMoney(totalValue)}`}
          icon={Wallet}
          tone="success"
          secondary={{ label: 'Vencedoras', value: `${winnerCount}` }}
        />
      </section>

      <Card>
        <CardHeader icon={<FileText className="h-4 w-4" />} title={`${quotes.length} proposta(s)`} />
        {quotes.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="Nenhuma proposta criada ainda"
            description="Abra uma oportunidade no Cliente 360° e use “Nova proposta”."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="px-5 py-2.5 font-medium">Número</th>
                  <th className="px-5 py-2.5 font-medium">Cliente</th>
                  <th className="px-5 py-2.5 font-medium">Oportunidade</th>
                  <th className="px-5 py-2.5 font-medium">Validade</th>
                  <th className="px-5 py-2.5 font-medium">Valor</th>
                  <th className="px-5 py-2.5 font-medium">Status</th>
                  <th className="px-5 py-2.5 font-medium" />
                </tr>
              </thead>
              <tbody>
                {quotes.map((q) => (
                  <tr
                    key={q.id}
                    className="border-t border-slate-100 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50"
                  >
                    <td className="px-5 py-2.5 text-slate-700 dark:text-slate-300">
                      {q.number ?? `v${q.version}`}
                      {q.isWinner && (
                        <span className="ml-1.5 inline-block" title="Proposta vencedora">
                          <Trophy className="inline h-3.5 w-3.5 text-amber-500" />
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-2.5">
                      <Link
                        href={`/dashboard/clientes/${q.opportunity.customer.id}`}
                        className="flex items-center gap-2 text-brand-600 hover:underline"
                      >
                        <InitialsAvatar name={q.opportunity.customer.name} shape="square" />
                        {q.opportunity.customer.name}
                      </Link>
                    </td>
                    <td className="px-5 py-2.5 text-slate-600 dark:text-slate-400">
                      {q.opportunity.title}
                    </td>
                    <td className="px-5 py-2.5 text-slate-600 dark:text-slate-400">
                      {q.validUntil ? new Date(q.validUntil).toLocaleDateString('pt-BR') : '—'}
                    </td>
                    <td className="px-5 py-2.5 text-slate-700 dark:text-slate-300">
                      R$ {formatMoney(q.totalValue)}
                    </td>
                    <td className="px-5 py-2.5">
                      <Badge tone={QUOTE_STATUS_TONE[q.status] ?? 'neutral'}>
                        {QUOTE_STATUS_LABELS[q.status] ?? q.status}
                      </Badge>
                    </td>
                    <td className="px-5 py-2.5 text-right">
                      <QuoteActions quoteId={q.id} status={q.status} isWinner={q.isWinner} />
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
