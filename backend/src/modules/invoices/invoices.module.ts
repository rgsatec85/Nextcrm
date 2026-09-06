import { Module } from '@nestjs/common';
import { InvoicesService } from './invoices.service';
import {
  InvoicesController,
  OrderInvoicesController,
} from './invoices.controller';
import { OrdersModule } from '../orders/orders.module';
import { CustomersModule } from '../customers/customers.module';
import { WebhooksModule } from '../webhooks/webhooks.module';

@Module({
  imports: [OrdersModule, CustomersModule, WebhooksModule],
  controllers: [InvoicesController, OrderInvoicesController],
  providers: [InvoicesService],
  exports: [InvoicesService],
})
export class InvoicesModule {}
