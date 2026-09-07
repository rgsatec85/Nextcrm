/**
 * "NLU" do assistente (`POST /ai/ask`) — deliberadamente NÃO é um
 * classificador de linguagem natural real, é casamento de padrões
 * (regex/keyword) sobre os dois formatos de pergunta citados no próprio
 * roadmap (spec Fase 4): "quais clientes possuem mais de R$X mil vencidos"
 * e "resuma a empresa/cliente X". Qualquer coisa fora desses dois formatos
 * cai em `unrecognized` — o `AiService` responde com uma mensagem honesta
 * em vez de tentar adivinhar. Extraído para um módulo puro (sem NestJS, sem
 * Prisma) para ser testado com dezenas de frases sem precisar montar o
 * resto do módulo.
 */

export interface OverdueThresholdIntent {
  type: 'overdue_threshold';
  thresholdReais: number;
}

export interface SummarizeCustomerIntent {
  type: 'summarize_customer';
  nameQuery: string;
}

export interface UnrecognizedIntent {
  type: 'unrecognized';
}

export type ParsedIntent =
  OverdueThresholdIntent | SummarizeCustomerIntent | UnrecognizedIntent;

function stripAccents(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

const SCALE_MULTIPLIERS: Record<string, number> = {
  mil: 1_000,
  milhao: 1_000_000,
  milhoes: 1_000_000,
};

/**
 * Reconhece "quais clientes possuem mais de R$100 mil vencidos" (e
 * variações: "vencido"/"vencidos"/"vencida", com ou sem "mil"/"milhão").
 * Limitação documentada: só entende separador decimal por vírgula (padrão
 * BR) — um número com ponto como separador de milhar ("100.000") é lido
 * como decimal (100.0), não como cem mil; escreva "100 mil" ou "100000"
 * sem pontuação para evitar ambiguidade.
 */
function parseOverdueThreshold(
  normalized: string,
): OverdueThresholdIntent | null {
  if (!/vencid/.test(normalized) || !/client/.test(normalized)) {
    return null;
  }

  // Alternativas mais longas primeiro ("milhoes"/"milhao" antes de "mil") —
  // senão o regex casa "mil" já nos 3 primeiros caracteres de "milhoes" e
  // nunca chega a tentar a alternativa mais específica.
  const match = normalized.match(/(\d+(?:,\d+)?)\s*(milhoes|milhao|mil)?/);
  if (!match) return null;

  const raw = Number(match[1].replace(',', '.'));
  if (Number.isNaN(raw) || raw <= 0) return null;

  const scaleWord = match[2];
  const multiplier = scaleWord ? (SCALE_MULTIPLIERS[scaleWord] ?? 1) : 1;

  return { type: 'overdue_threshold', thresholdReais: raw * multiplier };
}

/** Reconhece "resuma a empresa X" / "resuma o cliente X" / "resumo de X". */
function parseSummarizeCustomer(
  original: string,
): SummarizeCustomerIntent | null {
  const match = original.match(
    /\bresum\w*\s+(?:a\s+empresa|o\s+cliente|a\s+cliente|a|o|de)?\s*(.+)/i,
  );
  if (!match) return null;

  const nameQuery = match[1].replace(/[?.!]+$/, '').trim();
  if (!nameQuery) return null;

  return { type: 'summarize_customer', nameQuery };
}

export function parseQuestion(question: string): ParsedIntent {
  const normalized = stripAccents(question.toLowerCase());

  const overdue = parseOverdueThreshold(normalized);
  if (overdue) return overdue;

  const summarize = parseSummarizeCustomer(question);
  if (summarize) return summarize;

  return { type: 'unrecognized' };
}

/**
 * Fuzzy matching simples (sem biblioteca externa) para achar, entre os
 * clientes acessíveis ao usuário, o mais provável de ser "X" em "resuma X".
 * Tenta correspondência exata (normalizada) primeiro; senão, substring nos
 * dois sentidos, preferindo o nome de cliente mais longo (mais específico).
 */
export function fuzzyFindCustomer<T extends { name: string }>(
  customers: T[],
  query: string,
): T | null {
  const normalizedQuery = stripAccents(query.toLowerCase()).trim();
  if (!normalizedQuery) return null;

  const exact = customers.find(
    (c) => stripAccents(c.name.toLowerCase()) === normalizedQuery,
  );
  if (exact) return exact;

  const candidates = customers
    .map((c) => ({ customer: c, name: stripAccents(c.name.toLowerCase()) }))
    .filter(
      ({ name }) =>
        name.includes(normalizedQuery) || normalizedQuery.includes(name),
    )
    .sort((a, b) => b.name.length - a.name.length);

  return candidates[0]?.customer ?? null;
}
