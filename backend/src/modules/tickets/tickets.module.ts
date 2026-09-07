import { Module } from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { TicketsController } from './tickets.controller';
import { CustomersModule } from '../customers/customers.module';
import { WebhooksModule } from '../webhooks/webhooks.module';

@Module({
  imports: [CustomersModule, WebhooksModule],
  controllers: [TicketsController],
  providers: [TicketsService],
  // Exportado para o PortalModule reusar a checagem/computeSlaDueAt e para
  // outros módulos futuros que precisem abrir chamados programaticamente.
  exports: [TicketsService],
})
export class TicketsModule {}
