'use client';

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CHART_AXIS_TEXT, CHART_CATEGORICAL, CHART_GRID, CHART_TOOLTIP_STYLE } from '@/lib/chart-colors';

export interface StageValuePoint {
  stage: string;
  label: string;
  value: number;
  count: number;
}

function formatMoneyShort(value: number) {
  if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `R$ ${(value / 1_000).toFixed(0)}k`;
  return `R$ ${value.toFixed(0)}`;
}

function TooltipContent({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: StageValuePoint }>;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div style={CHART_TOOLTIP_STYLE}>
      <p className="font-medium text-slate-900">{p.label}</p>
      <p className="text-slate-600">
        {p.count} oportunidade{p.count === 1 ? '' : 's'} · R${' '}
        {p.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
      </p>
    </div>
  );
}

// Valor total de oportunidades abertas por estágio do pipeline — usado no
// Dashboard (resumo) e na página Pipeline (detalhado). Uma cor distinta por
// barra/estágio (em vez de uma cor única para todas) — refinamento visual
// para aproximar da referência "Revenue by X" compartilhada pelo cliente.
export function StageValueChart({ data, height = 240 }: { data: StageValuePoint[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }} barCategoryGap="24%">
        <CartesianGrid vertical={false} stroke={CHART_GRID} />
        <XAxis
          dataKey="label"
          tick={{ fill: CHART_AXIS_TEXT, fontSize: 12 }}
          axisLine={{ stroke: CHART_GRID }}
          tickLine={false}
          interval={0}
          angle={-15}
          textAnchor="end"
          height={50}
        />
        <YAxis
          tick={{ fill: CHART_AXIS_TEXT, fontSize: 12 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={formatMoneyShort}
          width={56}
        />
        <Tooltip content={<TooltipContent />} cursor={{ fill: 'rgba(99, 102, 241, 0.06)' }} />
        <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={48}>
          {data.map((entry, index) => (
            <Cell key={entry.stage} fill={CHART_CATEGORICAL[index % CHART_CATEGORICAL.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
