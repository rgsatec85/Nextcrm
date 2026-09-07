import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { CustomersModule } from '../customers/customers.module';
import { WebhooksModule } from '../webhooks/webhooks.module';

@Module({
  // CustomersModule: valida existência + ABAC do cliente num pedido manual
  // (Fase 7). WebhooksModule: dispara `order.created` também na criação
  // manual, mesmo evento já usado na conversão de proposta.
  imports: [CustomersModule, WebhooksModule],
  controllers: [OrdersController],
  providers: [OrdersService],
  // Exportado para o InvoicesService (Fase 2) reusar a validação de
  // existência + ABAC de um pedido antes de gerar as parcelas dele.
  exports: [OrdersService],
})
export class OrdersModule {}
