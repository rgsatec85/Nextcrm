import { SEMANTIC_HEX, type SemanticTone } from '@/lib/chart-colors';
import { cn } from '@/lib/cn';

interface AttainmentBarProps {
  label: string;
  /** 0–100. */
  percent: number;
  tone?: SemanticTone;
}

// Barra horizontal grossa de "atainment" (label + % nas pontas), estilo da
// referência de fluxo de caixa. Só usada onde já existe uma métrica de
// percentual real vinda do backend (ex.: taxa de pontualidade do Score
// Financeiro) — nunca como decoração de um número inventado.
export function AttainmentBar({ label, percent, tone = 'info' }: AttainmentBarProps) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-sm">
        <span className="font-medium text-slate-700 dark:text-slate-300">{label}</span>
        <span className="font-semibold text-slate-900 dark:text-slate-100">{clamped.toFixed(0)}%</span>
      </div>
      <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div
          className="h-full rounded-full transition-[width]"
          style={{ width: `${clamped}%`, backgroundColor: SEMANTIC_HEX[tone] }}
        />
      </div>
    </div>
  );
}

export interface BarSegment {
  tone: SemanticTone;
  /** 0–1 (fração do total). */
  fraction: number;
  label: string;
}

// Barra segmentada multi-cor fina, usada sob o cabeçalho de cada coluna do
// Kanban do Pipeline — cada segmento é uma fração real (soma ~1), nunca
// proporções fabricadas. Ver comentário em pipeline/page.tsx para a origem
// exata de cada segmento por coluna.
export function SegmentedBar({ segments }: { segments: BarSegment[] }) {
  const total = segments.reduce((sum, s) => sum + s.fraction, 0) || 1;
  return (
    <div
      className="flex h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"
      role="img"
      aria-label={segments.map((s) => `${s.label}: ${Math.round((s.fraction / total) * 100)}%`).join(', ')}
    >
      {segments
        .filter((s) => s.fraction > 0)
        .map((s, i) => (
          <span
            key={i}
            className={cn(i > 0 && 'border-l border-white/40 dark:border-slate-900/40')}
            style={{ width: `${(s.fraction / total) * 100}%`, backgroundColor: SEMANTIC_HEX[s.tone] }}
          />
        ))}
    </div>
  );
}
