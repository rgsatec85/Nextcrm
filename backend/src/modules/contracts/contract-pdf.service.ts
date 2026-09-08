import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { renderContractBody } from './contract-body-renderer';

export interface ContractPdfData {
  title: string;
  status: string;
  value: number;
  startDate: Date;
  endDate: Date;
  customerName: string;
  body: string | null;
}

const STATUS_LABELS: Record<string, string> = {
  rascunho: 'Rascunho',
  ativo: 'Ativo',
  encerrado: 'Encerrado',
  renovado: 'Renovado',
};

const ACCENT = '#4f46e5';
const TEXT_COLOR = '#111827';
const MUTED_COLOR = '#6b7280';

/**
 * Gera o PDF de um contrato (Fase 9, RF013) — mesmo `pdfkit`/mesmo padrão de
 * ProposalPdfService (buffer via Promise, sem browser headless). O corpo
 * rico (HTML já saneado) é renderizado pelo ContractBodyRenderer; um
 * contrato ainda sem corpo (nunca escreveu nada, ou nasceu sem modelo) exibe
 * um aviso honesto em vez de qualquer texto inventado.
 */
@Injectable()
export class ContractPdfService {
  generate(data: ContractPdfData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fillColor(ACCENT).fontSize(20).text(data.title);
      doc.moveDown(0.4);

      doc
        .fillColor(TEXT_COLOR)
        .fontSize(10)
        .text(`Status: ${STATUS_LABELS[data.status] ?? data.status}`);
      doc.text(
        `Vigência: ${data.startDate.toLocaleDateString('pt-BR')} a ${data.endDate.toLocaleDateString('pt-BR')}`,
      );
      doc.text(`Valor: R$ ${data.value.toFixed(2)}`);
      doc.moveDown();

      doc
        .fontSize(12)
        .fillColor(TEXT_COLOR)
        .text(`Cliente: ${data.customerName}`);
      doc.moveDown();

      doc
        .fontSize(12)
        .fillColor(ACCENT)
        .text('Conteúdo do contrato', { underline: true });
      doc.moveDown(0.4);

      if (data.body) {
        renderContractBody(doc, data.body);
      } else {
        doc
          .fontSize(10)
          .fillColor(MUTED_COLOR)
          .text('Nenhum conteúdo registrado para este contrato.');
      }

      doc.end();
    });
  }
}
