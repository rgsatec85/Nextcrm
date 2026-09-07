'use client';

import { PolarAngleAxis, RadialBar, RadialBarChart } from 'recharts';
import { SEMANTIC_HEX } from '@/lib/chart-colors';

const SIGNAL_LABELS: Record<string, string> = {
  punctuality: 'Pontualidade',
  overdueHealth: 'Saúde de inadimplência',
  volumeTrend: 'Tendência de volume',
  tenure: 'Tempo de relacionamento',
  satisfaction: 'Satisfação (chamados)',
  renewal: 'Renovação de contrato',
};

// Mesmo critério de corte usado pelo backend para `classification`
// (verde/amarelo/vermelho) do Score IA — só espelhado aqui para escolher a
// cor do arco (ver backend/src/modules/ai/scoring.ts `computeScoreIa`).
function toneForScore(score: number) {
  if (score >= 70) return SEMANTIC_HEX.success;
  if (score >= 40) return SEMANTIC_HEX.warning;
  return SEMANTIC_HEX.danger;
}

// Gauge circular (donut) do Score IA — score/100 com arco colorido
// vermelho→amarelo→verde conforme a faixa (mesmos cortes do backend).
// Substitui o badge de texto simples como indicador PRIMÁRIO do Cliente
// 360°; o Score Financeiro (heurística mais simples da Fase 2) continua como
// badge de texto ao lado, por ser um dos sinais de entrada do Score IA, não
// o indicador principal.
//
// Ao lado do gauge, uma faixa de barras mostra a decomposição real por sinal
// (`signals`, já retornado por `GET /ai/customers/:id/score-ia`) em vez de um
// sparkline de histórico — não existe endpoint de série temporal de score
// neste backend, então em vez de inventar uma tendência ao longo do tempo,
// mostramos os sinais reais que compõem o número de hoje (ver
// docs/fase-ui-modernizacao.md).
export function ScoreGauge({
  score,
  signals,
}: {
  score: number;
  signals: Record<string, number>;
}) {
  const color = toneForScore(score);
  const data = [{ value: score, fill: color }];

  return (
    <div className="flex flex-wrap items-center gap-6">
      <div className="relative h-28 w-28 flex-none">
        <RadialBarChart
          width={112}
          height={112}
          data={data}
          innerRadius="72%"
          outerRadius="100%"
          startAngle={90}
          endAngle={-270}
          barSize={10}
        >
          <PolarAngleAxis type="number" domain={[0, 100]} tick={false} axisLine={false} />
          <RadialBar dataKey="value" cornerRadius={8} background={{ fill: '#e2e8f0' }} isAnimationActive={false} />
        </RadialBarChart>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-semibold text-slate-900 dark:text-slate-50">{score}</span>
          <span className="text-[10px] uppercase tracking-wide text-slate-400">/100</span>
        </div>
      </div>

      <div className="min-w-[220px] flex-1 space-y-1.5">
        {Object.entries(signals).map(([key, value]) => (
          <div key={key} className="flex items-center gap-2 text-xs">
            <span className="w-40 flex-none truncate text-slate-500 dark:text-slate-400">
              {SIGNAL_LABELS[key] ?? key}
            </span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.max(0, Math.min(1, value)) * 100}%`,
                  backgroundColor: color,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
