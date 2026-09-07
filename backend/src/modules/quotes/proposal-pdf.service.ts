import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { substituteTemplateFields } from './template-fields';

export interface ProposalPdfItem {
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface ProposalPdfTemplate {
  name: string;
  headerText: string | null;
  footerText: string | null;
  clauses: string | null;
  primaryColor: string | null;
}

export interface ProposalPdfData {
  number: string | null;
  version: number;
  status: string;
  totalValue: number;
  items: ProposalPdfItem[];
  validUntil: Date | null;
  createdAt: Date;
  customerName: string;
  opportunityTitle: string;
  ownerName: string | null;
  template: ProposalPdfTemplate | null;
}

const STATUS_LABELS: Record<string, string> = {
  rascunho: 'Rascunho',
  enviada: 'Enviada',
  aprovada: 'Aprovada',
  rejeitada: 'Rejeitada',
  expirada: 'Expirada',
};

const DEFAULT_ACCENT = '#4f46e5';
const TEXT_COLOR = '#111827';
const MUTED_COLOR = '#6b7280';

/**
 * Gera o PDF de uma proposta (spec v3.1, RF011/RF014 "Geração de PDF").
 * Usa `pdfkit` (biblioteca pura em JS, sem engine nativo/download em tempo
 * de build) em vez de renderizar HTML com um browser headless — Puppeteer/
 * Playwright exigiriam baixar um binário do Chromium, exatamente o tipo de
 * dependência que já travou este ambiente antes com o engine do Prisma (ver
 * docs/setup.md) e que também pode não instalar em todo ambiente de deploy.
 * Desenhar o documento programaticamente é menos "bonito" que um template
 * HTML livre, mas funciona de forma previsível em qualquer Node.js.
 */
@Injectable()
export class ProposalPdfService {
  generate(data: ProposalPdfData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const accent = data.template?.primaryColor || DEFAULT_ACCENT;
      const fields: Record<string, string> = {
        'cliente.nome': data.customerName,
        valor_total: `R$ ${data.totalValue.toFixed(2)}`,
        vendedor: data.ownerName ?? '—',
        data: data.createdAt.toLocaleDateString('pt-BR'),
      };

      const headerText = data.template?.headerText
        ? substituteTemplateFields(data.template.headerText, fields)
        : 'Proposta Comercial';

      doc.fillColor(accent).fontSize(20).text(headerText);
      doc.moveDown(0.4);

      doc
        .fillColor(TEXT_COLOR)
        .fontSize(10)
        .text(
          `Número: ${data.number ?? '—'}    Versão: ${data.version}    Status: ${STATUS_LABELS[data.status] ?? data.status}`,
        );
      if (data.validUntil) {
        doc.text(`Válida até: ${data.validUntil.toLocaleDateString('pt-BR')}`);
      }
      doc.text(`Emitida em: ${data.createdAt.toLocaleDateString('pt-BR')}`);
      doc.moveDown();

      doc
        .fontSize(12)
        .fillColor(TEXT_COLOR)
        .text(`Cliente: ${data.customerName}`);
      doc.text(`Oportunidade: ${data.opportunityTitle}`);
      if (data.ownerName) {
        doc.text(`Responsável: ${data.ownerName}`);
      }
      doc.moveDown();

      doc.fontSize(12).fillColor(accent).text('Itens', { underline: true });
      doc.moveDown(0.3);
      doc.fillColor(TEXT_COLOR).fontSize(10);
      for (const item of data.items) {
        const lineTotal = item.quantity * item.unitPrice;
        doc.text(
          `${item.description} — ${item.quantity} x R$ ${item.unitPrice.toFixed(2)} = R$ ${lineTotal.toFixed(2)}`,
        );
      }
      doc.moveDown(0.6);
      doc
        .fontSize(13)
        .fillColor(accent)
        .text(`Total: R$ ${data.totalValue.toFixed(2)}`, { align: 'right' });

      if (data.template?.clauses) {
        doc.moveDown(1.2);
        doc
          .fontSize(12)
          .fillColor(accent)
          .text('Termos e condições', { underline: true });
        doc.moveDown(0.3);
        doc
          .fontSize(9)
          .fillColor('#374151')
          .text(substituteTemplateFields(data.template.clauses, fields), {
            align: 'justify',
          });
      }

      if (data.template?.footerText) {
        doc.moveDown(1.5);
        doc
          .fontSize(8)
          .fillColor(MUTED_COLOR)
          .text(substituteTemplateFields(data.template.footerText, fields), {
            align: 'center',
          });
      }

      doc.end();
    });
  }
}
