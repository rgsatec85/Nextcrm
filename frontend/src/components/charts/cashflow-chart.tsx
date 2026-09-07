'use client';

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CHART_AXIS_TEXT, CHART_GRID, CHART_TOOLTIP_STYLE, SEMANTIC_HEX } from '@/lib/chart-colors';

export interface CashflowPoint {
  month: string;
  expected: number;
  received: number;
}

function formatMoneyShort(value: number) {
  if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `R$ ${(value / 1_000).toFixed(0)}k`;
  return `R$ ${value.toFixed(0)}`;
}

function TooltipContent({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; name: string; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div style={CHART_TOOLTIP_STYLE}>
      <p className="font-medium text-slate-900">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-1.5 text-slate-600">
          <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
          {p.name}: R$ {p.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        </p>
      ))}
    </div>
  );
}

// Fluxo de caixa mensal (esperado vs. recebido) — Financeiro (spec Fase 2).
// Cores semânticas em vez de dois tons de indigo: "esperado" em azul
// informativo, "recebido" em verde de sucesso — mesmo par de cores usado nos
// KPIs "A receber"/"Recebido" acima, para reforçar o significado.
export function CashflowChart({ data, height = 260 }: { data: CashflowPoint[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }} barGap={4}>
        <CartesianGrid vertical={false} stroke={CHART_GRID} />
        <XAxis
          dataKey="month"
          tick={{ fill: CHART_AXIS_TEXT, fontSize: 12 }}
          axisLine={{ stroke: CHART_GRID }}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: CHART_AXIS_TEXT, fontSize: 12 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={formatMoneyShort}
          width={56}
        />
        <Tooltip content={<TooltipContent />} cursor={{ fill: 'rgba(99, 102, 241, 0.06)' }} />
        <Legend
          formatter={(value) => <span className="text-xs text-slate-600">{value}</span>}
          iconType="circle"
          iconSize={8}
        />
        <Bar dataKey="expected" name="Esperado" radius={[6, 6, 0, 0]} fill={SEMANTIC_HEX.info} maxBarSize={36} />
        <Bar dataKey="received" name="Recebido" radius={[6, 6, 0, 0]} fill={SEMANTIC_HEX.success} maxBarSize={36} />
      </BarChart>
    </ResponsiveContainer>
  );
}
