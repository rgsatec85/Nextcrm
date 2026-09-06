import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';

@Module({
  controllers: [OrdersController],
  providers: [OrdersService],
  // Exportado para o InvoicesService (Fase 2) reusar a validação de
  // existência + ABAC de um pedido antes de gerar as parcelas dele.
  exports: [OrdersService],
})
export class OrdersModule {}
