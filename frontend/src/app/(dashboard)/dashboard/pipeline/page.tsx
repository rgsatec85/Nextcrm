import { cookies } from 'next/headers';
import { backend } from '@/lib/backend';
import { SESSION_COOKIE } from '@/lib/session';
import { OPPORTUNITY_STAGES, STAGE_LABELS } from '@/lib/crm-constants';
import { NewOpportunityForm } from '@/components/crm/new-opportunity-form';
import { ChangeStageSelect } from '@/components/crm/change-stage-select';

function formatMoney(value: string | number) {
  return Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
}

// Pipeline Kanban (spec §9). Sem drag-and-drop nesta fase — troca de
// estágio é feita pelo seletor em cada card (documentado como simplificação).
export default async function PipelinePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)!.value;

  const [opportunities, customers] = await Promise.all([
    backend.opportunities(token),
    backend.customers(token),
  ]);

  const byStage = Object.fromEntries(
    OPPORTUNITY_STAGES.map((stage) => [
      stage,
      opportunities.filter((o) => o.stage === stage),
    ]),
  ) as Record<(typeof OPPORTUNITY_STAGES)[number], typeof opportunities>;

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-2xl font-semibold text-slate-900">Pipeline</h1>
        <p className="text-sm text-slate-500">
          Oportunidades por estágio. Vendedores só veem as próprias (ABAC) — demais
          perfis veem tudo do tenant.
        </p>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-4 font-medium text-slate-900">Nova oportunidade</h2>
        <NewOpportunityForm
          customers={customers.map((c) => ({ id: c.id, name: c.name }))}
        />
      </section>

      <section className="grid gap-4 overflow-x-auto pb-2 md:grid-cols-3 xl:grid-cols-6">
        {OPPORTUNITY_STAGES.map((stage) => (
          <div key={stage} className="min-w-[220px] rounded-lg border border-slate-200 bg-slate-50">
            <div className="border-b border-slate-200 px-3 py-2">
              <h3 className="text-sm font-medium text-slate-700">
                {STAGE_LABELS[stage]} ({byStage[stage].length})
              </h3>
            </div>
            <div className="space-y-2 p-2">
              {byStage[stage].map((o) => (
                <div
                  key={o.id}
                  className="rounded-md border border-slate-200 bg-white p-3 text-sm shadow-sm"
                >
                  <p className="font-medium text-slate-900">{o.title}</p>
                  <p className="text-slate-500">{o.customer.name}</p>
                  <p className="mt-1 text-slate-700">R$ {formatMoney(o.value)}</p>
                  <div className="mt-2">
                    <ChangeStageSelect opportunityId={o.id} currentStage={o.stage} />
                  </div>
                </div>
              ))}
              {byStage[stage].length === 0 && (
                <p className="px-1 py-2 text-xs text-slate-400">Vazio</p>
              )}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
