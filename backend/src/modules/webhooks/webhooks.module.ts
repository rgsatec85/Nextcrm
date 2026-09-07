import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { WebhooksService } from './webhooks.service';
import { WebhooksController } from './webhooks.controller';

@Module({
  // ScheduleModule.forRoot() registra o mecanismo de @Cron do Nest
  // (SchedulerRegistry) — só precisa ser chamado uma vez na aplicação;
  // fica aqui porque é este módulo que tem o único cron job da Fase 3
  // (WebhooksService.notifyExpiringContracts).
  imports: [ScheduleModule.forRoot()],
  controllers: [WebhooksController],
  providers: [WebhooksService],
  // Exportado para QuotesService/InvoicesService/TicketsService disparar
  // eventos (order.created, invoice.paid, ticket.updated) sem duplicar a
  // lógica de entrega/assinatura HMAC.
  exports: [WebhooksService],
})
export class WebhooksModule {}
