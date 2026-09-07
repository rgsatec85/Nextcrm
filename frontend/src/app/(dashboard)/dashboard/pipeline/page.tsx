import { cookies } from 'next/headers';
import { backend, type AiPipelineForecastStage } from '@/lib/backend';
import { SESSION_COOKIE } from '@/lib/session';
import { OPPORTUNITY_STAGES, STAGE_LABELS } from '@/lib/crm-constants';
import { NewOpportunityForm } from '@/components/crm/new-opportunity-form';
import { ChangeStageSelect } from '@/components/crm/change-stage-select';
import { OpportunityAiActions } from '@/components/crm/opportunity-ai-actions';
import { CreateDrawer } from '@/components/ui/create-drawer';
import { KpiCard } from '@/components/ui/kpi-card';
import { Card, CardHeader } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { InitialsAvatar } from '@/components/ui/avatar';
import { SegmentedBar, type BarSegment } from '@/components/ui/progress-bar';
import { StageValueChart, type StageValuePoint } from '@/components/charts/stage-value-chart';
import { BarChart3, Sparkles, Target, Workflow } from 'lucide-react';

function formatMoney(value: string | number) {
  return Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
}

function formatMoneyShort(value: number) {
  if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `R$ ${(value / 1_000).toFixed(0)}k`;
  return `R$ ${value.toFixed(0)}`;
}

/**
 * Barra segmentada sob o cabeçalho de cada coluna do Kanban — estilo da
 * referência de pipeline Odoo. Não existe um campo de "distribuição" pronto
 * no backend, então usamos a taxa de fechamento (`winRate`) que a IA da Fase
 * 4 já calcula por estágio (`GET /ai/predictions/pipeline`, heurística
 * documentada em backend/src/modules/ai/), lida como uma proporção real:
 * verde = fração estimada de conversão do estágio, cinza = o restante. Para
 * os estágios já fechados (ganho/perdido) não existe "previsão" — o
 * resultado já é um fato — então a barra ali é 100% verde ou 100% vermelha,
 * refletindo o desfecho real, não uma estimativa.
 */
function segmentsForStage(
  stage: (typeof OPPORTUNITY_STAGES)[number],
  forecastStage: AiPipelineForecastStage | undefined,
): BarSegment[] {
  if (stage === 'fechado_ganho') {
    return [{ tone: 'success', fraction: 1, label: 'Ganho' }];
  }
  if (stage === 'fechado_perdido') {
    return [{ tone: 'danger', fraction: 1, label: 'Perdido' }];
  }
  if (!forecastStage) return [];
  const winRate = Math.max(0, Math.min(1, forecastStage.winRate));
  return [
    { tone: 'success', fraction: winRate, label: 'Chance de fechamento (IA)' },
    { tone: 'neutral', fraction: 1 - winRate, label: 'Restante' },
  ];
}

interface CompanyUser {
  id: string;
  name: string;
}

// Pipeline Kanban (spec §9). Sem drag-and-drop nesta fase — troca de
// estágio é feita pelo seletor em cada card (documentado como simplificação).
export default async function PipelinePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)!.value;

  const [opportunities, customers, forecast, users] = await Promise.all([
    backend.opportunities(token),
    backend.customers(token),
    backend.aiPipelineForecast(token).catch(() => null),
    // Só para resolver ownerId → nome (avatar de responsável no card) — não
    // é um endpoint novo, já usado pelo Dashboard (`GET /users`).
    backend.users(token).catch(() => []) as Promise<CompanyUser[]>,
  ]);

  const ownerNameById = new Map(users.map((u) => [u.id, u.name]));

  const forecastByStage = new Map(forecast?.byStage.map((s) => [s.stage, s]) ?? []);

  const byStage = Object.fromEntries(
    OPPORTUNITY_STAGES.map((stage) => [
      stage,
      opportunities.filter((o) => o.stage === stage),
    ]),
  ) as Record<(typeof OPPORTUNITY_STAGES)[number], typeof opportunities>;

  const openOpportunities = opportunities.filter(
    (o) => o.stage !== 'fechado_ganho' && o.stage !== 'fechado_perdido',
  );
  const openValue = openOpportunities.reduce((sum, o) => sum + Number(o.value), 0);

  const stageData: StageValuePoint[] = OPPORTUNITY_STAGES.filter(
    (s) => s !== 'fechado_ganho' && s !== 'fechado_perdido',
  ).map((stage) => ({
    stage,
    label: STAGE_LABELS[stage],
    value: byStage[stage].reduce((sum, o) => sum + Number(o.value), 0),
    count: byStage[stage].length,
  }));

  return (
    <div className="space-y-8">
      <section className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">Pipeline</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Oportunidades por estágio. Vendedores só veem as próprias (ABAC) — demais
            perfis veem tudo do tenant.
          </p>
        </div>
        <CreateDrawer
          triggerLabel="Nova oportunidade"
          description="Vincule a um cliente já cadastrado."
        >
          {(close) => (
            <NewOpportunityForm
              customers={customers.map((c) => ({ id: c.id, name: c.name }))}
              onSuccess={close}
            />
          )}
        </CreateDrawer>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <KpiCard label="Oportunidades abertas" value={String(openOpportunities.length)} icon={Workflow} tone="info" />
        <KpiCard label="Valor em aberto" value={`R$ ${formatMoney(openValue)}`} icon={Target} tone="info" />
        <KpiCard
          label="Previsão de fechamento"
          value={forecast ? `R$ ${formatMoney(forecast.forecastTotal)}` : '—'}
          icon={Sparkles}
          tone="accent"
          hint={forecast ? 'heurística Fase 4' : 'indisponível'}
        />
      </section>

      {forecast && (
        <Card>
          <CardHeader icon={<Sparkles className="h-4 w-4" />} title="Previsão de fechamento (IA)" />
          <p className="px-5 py-4 text-sm text-slate-600 dark:text-slate-400">{forecast.narrative}</p>
        </Card>
      )}

      <Card>
        <CardHeader icon={<BarChart3 className="h-4 w-4" />} title="Valor por estágio" />
        <div className="px-5 py-4">
          <StageValueChart data={stageData} />
        </div>
      </Card>

      {/*
        Cards do Kanban (estilo Odoo da referência): título, valor, cliente,
        seletor de estágio e ações de IA já existiam. Nesta rodada de
        refinamento visual foram adicionados:
        - Avatar de iniciais do responsável (`ownerId` → nome via `GET
          /users`, já buscado acima) no canto do card — dado real, sem campo
          novo no backend.
        Dois elementos da referência foram DELIBERADAMENTE OMITIDOS por não
        haver dado real para sustentá-los (ver docs/fase-ui-modernizacao.md):
        - Tags/pílulas de produto/categoria — `Opportunity` não tem nenhum
          campo taggable (só id/customerId/title/stage/value/ownerId/
          createdAt/customer); inventar tags fixas seria dado fabricado.
        - Estrelas de prioridade — não existe campo de prioridade na
          Oportunidade (só em Ticket e em `AiNextAction`, que é por-
          oportunidade sob demanda, não vem na listagem); sem um campo real
          de prioridade na entidade, não há o que mapear em estrelas.
      */}
      <section className="grid gap-4 overflow-x-auto pb-2 md:grid-cols-3 xl:grid-cols-6">
        {OPPORTUNITY_STAGES.map((stage) => {
          const stageOpportunities = byStage[stage];
          const stageTotal = stageOpportunities.reduce((sum, o) => sum + Number(o.value), 0);
          const segments = segmentsForStage(stage, forecastByStage.get(stage));
          return (
            <div
              key={stage}
              className="min-w-[220px] rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/60"
            >
              <div className="space-y-2 border-b border-slate-200 px-3 py-2.5 dark:border-slate-800">
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    {STAGE_LABELS[stage]} ({stageOpportunities.length})
                  </h3>
                  {stageTotal > 0 && (
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      {formatMoneyShort(stageTotal)}
                    </span>
                  )}
                </div>
                {segments.length > 0 && <SegmentedBar segments={segments} />}
              </div>
              <div className="space-y-2 p-2">
                {stageOpportunities.map((o) => {
                  const ownerName = o.ownerId ? ownerNameById.get(o.ownerId) : undefined;
                  return (
                    <div
                      key={o.id}
                      className="relative rounded-lg border border-slate-200 bg-white p-3 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-900"
                    >
                      {ownerName && (
                        <div className="absolute right-2.5 top-2.5">
                          <InitialsAvatar name={ownerName} title={`Responsável: ${ownerName}`} />
                        </div>
                      )}
                      <p className="pr-7 font-medium text-slate-900 dark:text-slate-100">{o.title}</p>
                      <p className="text-slate-500 dark:text-slate-400">{o.customer.name}</p>
                      <p className="mt-1 text-slate-700 dark:text-slate-300">R$ {formatMoney(o.value)}</p>
                      <div className="mt-2">
                        <ChangeStageSelect opportunityId={o.id} currentStage={o.stage} />
                      </div>
                      <OpportunityAiActions opportunityId={o.id} />
                    </div>
                  );
                })}
                {stageOpportunities.length === 0 && (
                  <p className="px-1 py-2 text-xs text-slate-400">Vazio</p>
                )}
              </div>
            </div>
          );
        })}
      </section>

      {opportunities.length === 0 && (
        <EmptyState
          icon={Workflow}
          title="Nenhuma oportunidade ainda"
          description="Crie a primeira oportunidade para começar a acompanhar o funil."
        />
      )}
    </div>
  );
}
