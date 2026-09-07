import type { ReactNode } from 'react';
import { SEMANTIC_BADGE_CLASSES, tagColorClasses, type SemanticTone } from '@/lib/chart-colors';
import { cn } from '@/lib/cn';

// `orange` fica fora do conjunto semântico de 5 tons (info/danger/success/
// warning/accent) — é usado só como um degrau "mais forte que warning, mais
// fraco que danger" onde uma métrica já tinha 4 níveis distintos (ex.:
// prioridade baixa/média/alta/crítica em Cobranças Inteligentes).
export type BadgeTone = SemanticTone | 'orange';

const TONE_CLASSES: Record<BadgeTone, string> = {
  ...SEMANTIC_BADGE_CLASSES,
  orange: 'bg-orange-100 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400',
};

export function Badge({ tone = 'neutral', children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        TONE_CLASSES[tone],
      )}
    >
      {children}
    </span>
  );
}

// Pílula pastel para tags/categorias "livres" (sem tom semântico de negócio
// fixo — produto/categoria de oportunidade, categoria de artigo, etc.): a
// cor vem de um hash do próprio texto (`tagColorClasses`), então a mesma tag
// sempre aparece com a mesma cor, sem precisar de uma tabela de cores
// mantida à mão para cada valor possível.
export function TagBadge({ label }: { label: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        tagColorClasses(label),
      )}
    >
      {label}
    </span>
  );
}
