import { parseDocument } from 'htmlparser2';

/**
 * Renderizador mínimo de HTML -> pdfkit para o corpo rico do contrato
 * (Fase 9, RF013). O pdfkit não tem parser de HTML embutido, então este
 * módulo faz o trabalho manualmente: percorre a árvore já saneada (ver
 * sanitize-contract-body.ts — só chega aqui HTML de uma allowlist restrita)
 * reconhecendo blocos (h1/h2/h3/p/ul>li/ol>li) e, dentro de cada bloco,
 * "runs" de texto (negrito/itálico/sublinhado/link) alternados por
 * b/strong, i/em, u e a.
 *
 * Definimos nosso próprio tipo (`RawNode`) em vez de importar os tipos do
 * `domhandler` (dependência transitiva do htmlparser2, não uma dependência
 * direta deste projeto) — duck typing simples sobre o formato real que
 * `parseDocument` devolve.
 *
 * Simplificação assumida: formatação inline é "melhor esforço" — uma quebra
 * de linha (`<br>`) no meio de um run com `continued: true` do pdfkit pode
 * não quebrar a linha visualmente de forma perfeita, e uma mistura profunda
 * de formatações aninhadas não tem garantia de resultado pixel-perfect. Para
 * o conteúdo que o editor do frontend realmente produz (parágrafos, títulos,
 * listas, negrito/itálico/sublinhado/link simples) o resultado é fiel.
 */

interface RawNode {
  type: string;
  name?: string;
  data?: string;
  attribs?: Record<string, string>;
  children?: RawNode[];
}

interface TextRun {
  text: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  link: string | null;
}

type BlockKind = 'h1' | 'h2' | 'h3' | 'p' | 'li-ul' | 'li-ol';

interface Block {
  kind: BlockKind;
  runs: TextRun[];
  ordinal?: number;
}

const BLOCK_FONT_SIZE: Record<BlockKind, number> = {
  h1: 18,
  h2: 15,
  h3: 13,
  p: 10,
  'li-ul': 10,
  'li-ol': 10,
};

function collectRuns(
  nodes: RawNode[],
  context: {
    bold: boolean;
    italic: boolean;
    underline: boolean;
    link: string | null;
  },
): TextRun[] {
  const runs: TextRun[] = [];
  for (const node of nodes) {
    if (node.type === 'text') {
      if (node.data) {
        runs.push({ text: node.data, ...context });
      }
      continue;
    }
    if (node.type !== 'tag') continue;

    if (node.name === 'br') {
      runs.push({ text: '\n', ...context });
      continue;
    }

    const nextContext = { ...context };
    if (node.name === 'b' || node.name === 'strong') nextContext.bold = true;
    if (node.name === 'i' || node.name === 'em') nextContext.italic = true;
    if (node.name === 'u') nextContext.underline = true;
    if (node.name === 'a') nextContext.link = node.attribs?.href ?? null;

    runs.push(...collectRuns(node.children ?? [], nextContext));
  }
  return runs;
}

function collectBlocks(nodes: RawNode[]): Block[] {
  const blocks: Block[] = [];
  let olCounter = 0;

  for (const node of nodes) {
    if (node.type !== 'tag') continue;

    const emptyContext = {
      bold: false,
      italic: false,
      underline: false,
      link: null,
    };

    if (node.name === 'h1' || node.name === 'h2' || node.name === 'h3') {
      blocks.push({
        kind: node.name,
        runs: collectRuns(node.children ?? [], emptyContext),
      });
    } else if (node.name === 'p') {
      blocks.push({
        kind: 'p',
        runs: collectRuns(node.children ?? [], emptyContext),
      });
    } else if (node.name === 'ul') {
      for (const li of (node.children ?? []).filter((c) => c.name === 'li')) {
        blocks.push({
          kind: 'li-ul',
          runs: collectRuns(li.children ?? [], emptyContext),
        });
      }
    } else if (node.name === 'ol') {
      for (const li of (node.children ?? []).filter((c) => c.name === 'li')) {
        olCounter += 1;
        blocks.push({
          kind: 'li-ol',
          runs: collectRuns(li.children ?? [], emptyContext),
          ordinal: olCounter,
        });
      }
    }
  }

  return blocks;
}

function fontFor(run: TextRun): string {
  if (run.bold && run.italic) return 'Helvetica-BoldOblique';
  if (run.bold) return 'Helvetica-Bold';
  if (run.italic) return 'Helvetica-Oblique';
  return 'Helvetica';
}

/**
 * Renderiza o HTML (já saneado) do corpo do contrato dentro de um
 * documento pdfkit já em andamento (assume que a fonte/posição atual do
 * `doc` já está posicionada onde o corpo deve começar).
 */
export function renderContractBody(
  doc: PDFKit.PDFDocument,
  html: string,
): void {
  const parsed = parseDocument(html) as unknown as { children: RawNode[] };
  const blocks = collectBlocks(parsed.children ?? []);

  for (const block of blocks) {
    const fontSize = BLOCK_FONT_SIZE[block.kind];
    doc.fontSize(fontSize).fillColor('#111827');

    const runs = [...block.runs];
    if (block.kind === 'li-ul') {
      runs.unshift({
        text: '•  ',
        bold: false,
        italic: false,
        underline: false,
        link: null,
      });
    } else if (block.kind === 'li-ol') {
      runs.unshift({
        text: `${block.ordinal}.  `,
        bold: false,
        italic: false,
        underline: false,
        link: null,
      });
    }

    if (runs.length === 0) {
      doc.text(' ');
    } else {
      runs.forEach((run, index) => {
        const isLast = index === runs.length - 1;
        doc.font(fontFor(run)).text(run.text, {
          continued: !isLast,
          underline: run.underline || !!run.link,
          link: run.link ?? undefined,
        });
      });
    }

    doc.moveDown(block.kind.startsWith('h') ? 0.5 : 0.3);
  }

  doc.font('Helvetica');
}
