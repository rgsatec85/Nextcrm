/**
 * Paleta neutra para gráficos e acentos de UI (decisão confirmada com o
 * cliente: indigo/slate, fácil de trocar por cores de marca depois — ver
 * docs/fase-ui-modernizacao.md). Cada função/tabela abaixo só lê deste
 * arquivo, então trocar a marca no futuro é uma edição em um único lugar.
 *
 * Formato inspirado na skill de dataviz: uma escala categórica curta (até
 * 6 séries, distinguível também em daltonismo comum) mais tons semânticos
 * fixos para estados de negócio (sucesso/atenção/risco) que NÃO devem virar
 * a cor de marca — vermelho continua vermelho mesmo se a marca virar verde.
 */

// Escala categórica (barras por estágio, séries de um gráfico, etc.).
export const CHART_CATEGORICAL = [
  '#4338ca', // indigo-700 — série primária
  '#6366f1', // indigo-500
  '#818cf8', // indigo-400
  '#94a3b8', // slate-400
  '#475569', // slate-600
  '#c7d2fe', // indigo-200
] as const;

// Sequencial (intensidade única, ex.: heatmap de atraso).
export const CHART_SEQUENTIAL = ['#e0e7ff', '#a5b4fc', '#6366f1', '#4338ca', '#312e81'] as const;

// Semântico — não trocar por marca: o significado (bom/atenção/ruim) tem
// que continuar reconhecível.
export const CHART_SEMANTIC = {
  positive: '#059669', // emerald-600
  warning: '#d97706', // amber-600
  negative: '#dc2626', // red-600
  neutral: '#64748b', // slate-500
} as const;

export const CHART_GRID = '#e2e8f0'; // slate-200
export const CHART_AXIS_TEXT = '#64748b'; // slate-500

export const CHART_TOOLTIP_STYLE = {
  backgroundColor: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: 8,
  boxShadow: '0 4px 12px rgba(15, 23, 42, 0.08)',
  fontSize: 12,
  padding: '8px 12px',
};

/**
 * --- Refinamento visual (rodada 2) -----------------------------------------
 * Sistema de cor semântica para elementos de UI (chip de ícone do KpiCard,
 * Badge de status, tags de categoria, avatares/"logo chips") — adicionado
 * para aproximar o dashboard interno das referências compartilhadas pelo
 * cliente (ver docs/fase-ui-modernizacao.md, seção "Refinamento visual").
 *
 * Não substitui `CHART_SEMANTIC` acima (usado dentro dos próprios gráficos
 * recharts, como `fill`/`stroke` em hex) — este bloco é a versão em classes
 * Tailwind (bg/text) para elementos de HTML comuns. As cores em si contam a
 * mesma história (azul=informativo, verde=sucesso/recebido, vermelho=risco/
 * vencido, âmbar=atenção/pendente, roxo=destaque/IA), só expressas no
 * formato que cada tipo de componente precisa.
 */

// As 5 "tonalidades" semânticas pedidas: info (azul), danger (vermelho),
// success (verde), warning (âmbar/laranja) e accent (roxo, para métricas em
// destaque — ex.: previsão de IA). `neutral` cobre o caso "nem bom nem ruim"
// (ex.: status "fechado"/"inativo").
export type SemanticTone = 'info' | 'danger' | 'success' | 'warning' | 'accent' | 'neutral';

// Chip de ícone ~40px usado no KpiCard: fundo pastel + ícone num tom mais
// escuro da mesma cor.
export const SEMANTIC_CHIP_CLASSES: Record<SemanticTone, string> = {
  info: 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400',
  danger: 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400',
  success: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400',
  warning: 'bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400',
  accent: 'bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400',
  neutral: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
};

// Pílula de status/badge: fundo pastel um pouco mais forte + texto na cor
// "700" correspondente (mesmo princípio das referências: pill pastel, texto
// combinando, nunca texto puro sem fundo).
export const SEMANTIC_BADGE_CLASSES: Record<SemanticTone, string> = {
  info: 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400',
  danger: 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400',
  success: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
  warning: 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
  accent: 'bg-purple-100 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400',
  neutral: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
};

// Cor "sólida" (fundo saturado + texto branco) usada nos avatares/"logo
// chips" — mesma tonalidade, versão forte.
export const SEMANTIC_SOLID_CLASSES: Record<SemanticTone, string> = {
  info: 'bg-blue-500 text-white',
  danger: 'bg-red-500 text-white',
  success: 'bg-emerald-500 text-white',
  warning: 'bg-orange-500 text-white',
  accent: 'bg-purple-500 text-white',
  neutral: 'bg-slate-400 text-white',
};

// Hex correspondente, para uso dentro de SVG/recharts (arco do gauge, barra
// segmentada do Kanban) — mesma paleta acima, só como valor de cor em vez de
// classe Tailwind.
export const SEMANTIC_HEX: Record<SemanticTone, string> = {
  info: '#2563eb', // blue-600
  danger: '#dc2626', // red-600
  success: '#059669', // emerald-600
  warning: '#d97706', // amber-600
  accent: '#7c3aed', // violet-600
  neutral: '#94a3b8', // slate-400
};

/**
 * Paleta fixa e rotativa (6 cores pastel bg+texto) para tags/categorias
 * "livres" — sem significado de negócio fixo (produto/categoria de
 * oportunidade, categoria de artigo da base de conhecimento, etc.). A cor é
 * escolhida por hash do próprio texto da tag, então a mesma tag sempre cai
 * na mesma cor (estável entre renders/usuários), sem precisar de uma tabela
 * de mapeamento mantida à mão.
 */
export const TAG_PALETTE = [
  'bg-sky-100 text-sky-700 dark:bg-sky-500/10 dark:text-sky-400',
  'bg-violet-100 text-violet-700 dark:bg-violet-500/10 dark:text-violet-400',
  'bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400',
  'bg-teal-100 text-teal-700 dark:bg-teal-500/10 dark:text-teal-400',
  'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
  'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400',
] as const;

// Paleta sólida (fundo saturado + texto branco) para avatares de iniciais e
// "logo chips" de cliente/empresa — mesma lógica de hash, paleta separada
// porque aqui o fundo precisa ser forte o bastante para texto branco em
// cima, não pastel.
export const AVATAR_PALETTE = [
  'bg-indigo-500',
  'bg-sky-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-violet-500',
  'bg-teal-500',
  'bg-orange-500',
] as const;

// Hash determinístico simples (djb2) — só precisa ser estável e distribuir
// razoavelmente bem entre um punhado de posições, não ser criptográfico.
function hashString(value: string): number {
  let hash = 5381;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 33) ^ value.charCodeAt(i);
  }
  return Math.abs(hash);
}

/** Classe pastel (bg+texto) estável para uma tag/categoria arbitrária. */
export function tagColorClasses(label: string): string {
  return TAG_PALETTE[hashString(label) % TAG_PALETTE.length];
}

/** Classe sólida (bg) estável para o avatar/logo chip de um nome. */
export function avatarColorClasses(name: string): string {
  return AVATAR_PALETTE[hashString(name) % AVATAR_PALETTE.length];
}

/** Iniciais (até 2 letras) a partir de um nome — usado no avatar/logo chip. */
export function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
