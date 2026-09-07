import type { LucideIcon } from 'lucide-react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { SEMANTIC_CHIP_CLASSES, SEMANTIC_HEX, type SemanticTone } from '@/lib/chart-colors';
import { cn } from '@/lib/cn';

export type KpiTone = SemanticTone;

interface KpiCardSecondary {
  label: string;
  value: string;
}

interface KpiCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  /**
   * Tom semântico do chip de ícone — escolhido pelo SIGNIFICADO da métrica,
   * não por posição/repetição: `info` (neutro/informativo), `danger`
   * (vencido/atrasado), `success` (recebido/ativo), `warning`
   * (pendente/aberto) e `accent` (métrica em destaque, ex.: previsão de IA).
   * Ver docs/fase-ui-modernizacao.md para a tabela completa por página.
   */
  tone?: KpiTone;
  /** Legenda curta abaixo do valor (ex.: "12 faturas"). */
  hint?: string;
  /** Variação percentual opcional — positivo mostra seta para cima em verde. */
  delta?: number;
  /**
   * Segundo par label+valor (linha inferior com um "dot" da mesma cor do
   * chip) — para KPIs de "dois valores" (total em R$ + contagem), estilo da
   * referência de Contratos. Só usar quando o segundo valor for um dado real
   * já calculado (ex.: contagem do mesmo conjunto do valor principal).
   */
  secondary?: KpiCardSecondary;
}

// Tile de KPI reutilizado em Dashboard, Pipeline, Financeiro, Contratos e
// Chamados — ícone num chip colorido semântico, rótulo, número grande e
// hint/variação/segundo valor opcionais.
export function KpiCard({ label, value, icon: Icon, tone = 'info', hint, delta, secondary }: KpiCardProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {label}
        </p>
        <span className={cn('flex h-10 w-10 flex-none items-center justify-center rounded-lg', SEMANTIC_CHIP_CLASSES[tone])}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-50">{value}</p>
      {(hint || delta !== undefined) && (
        <div className="mt-1 flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
          {delta !== undefined && (
            <span
              className={cn(
                'inline-flex items-center gap-0.5 font-medium',
                delta >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400',
              )}
            >
              {delta >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              {Math.abs(delta).toFixed(1)}%
            </span>
          )}
          {hint && <span>{hint}</span>}
        </div>
      )}
      {secondary && (
        <div className="mt-3 flex items-center gap-1.5 border-t border-slate-100 pt-2 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
          <span
            className="inline-block h-1.5 w-1.5 flex-none rounded-full"
            style={{ backgroundColor: SEMANTIC_HEX[tone] }}
          />
          <span>{secondary.label}</span>
          <span className="ml-auto font-semibold text-slate-700 dark:text-slate-200">{secondary.value}</span>
        </div>
      )}
    </div>
  );
}
