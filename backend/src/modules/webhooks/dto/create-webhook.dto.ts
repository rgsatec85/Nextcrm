import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsUrl,
} from 'class-validator';

// Eventos disparados pelo sistema (spec Fase 3 — "Webhooks/eventos"). Manter
// esta lista em sincronia com os dispatch() reais: QuotesService.approve
// (order.created), InvoicesService.registerPayment (invoice.paid),
// TicketsService.updateStatus (ticket.updated) e o cron de
// WebhooksService (contract.expiring).
export const WEBHOOK_EVENTS = [
  'order.created',
  'invoice.paid',
  'ticket.updated',
  'contract.expiring',
] as const;

export class CreateWebhookDto {
  // IsUrl sem require_tld: permite apontar para http://localhost:xxxx em
  // ambiente de desenvolvimento/teste, não só domínios públicos.
  @IsUrl({ require_tld: false })
  url: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsIn(WEBHOOK_EVENTS, { each: true })
  events: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
