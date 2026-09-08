import sanitizeHtml from 'sanitize-html';

/**
 * Sanitização do corpo do contrato (Fase 9, RF013) antes de persistir no
 * banco. O corpo vem de um editor rich text baseado em `contentEditable` no
 * frontend (decisão explícita: editor leve, sem lib pesada nova) — ou seja,
 * é HTML gerado no navegador do usuário. Como esse HTML é depois re-exibido
 * para outras pessoas do mesmo tenant (via `dangerouslySetInnerHTML`) e
 * também interpretado no backend para gerar o PDF, ele é um vetor de XSS
 * armazenado até ser saneado — por isso passa por uma allowlist restrita
 * aqui, sempre, tanto em `ContractsService` (corpo do contrato) quanto em
 * `ContractTemplatesService` (corpo do modelo), antes de qualquer
 * `create`/`update` no Prisma. Nunca confiar no HTML como está.
 */
const ALLOWED_TAGS = [
  'p',
  'br',
  'h1',
  'h2',
  'h3',
  'ul',
  'ol',
  'li',
  'b',
  'strong',
  'i',
  'em',
  'u',
  'a',
  'span',
];

export function sanitizeContractBody(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      a: ['href'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', {
        rel: 'noopener noreferrer',
        target: '_blank',
      }),
    },
  });
}
