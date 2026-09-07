import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { HealthModule } from './health/health.module';
import { CustomersModule } from './modules/customers/customers.module';
import { ContactsModule } from './modules/contacts/contacts.module';
import { OpportunitiesModule } from './modules/opportunities/opportunities.module';
import { QuotesModule } from './modules/quotes/quotes.module';
import { OrdersModule } from './modules/orders/orders.module';
import { ActivitiesModule } from './modules/activities/activities.module';
import { InvoicesModule } from './modules/invoices/invoices.module';
import { ContractsModule } from './modules/contracts/contracts.module';
import { FinanceModule } from './modules/finance/finance.module';
import { TicketsModule } from './modules/tickets/tickets.module';
import { KnowledgeModule } from './modules/knowledge/knowledge.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { PortalModule } from './modules/portal/portal.module';
import { AiModule } from './modules/ai/ai.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([
      {
        // Rate limiting básico (spec seção 17). Ajuste por rota conforme
        // necessário com o decorator @Throttle().
        ttl: 60_000,
        limit: 100,
      },
    ]),
    PrismaModule,
    AuthModule,
    UsersModule,
    TenantsModule,
    HealthModule,
    CustomersModule,
    ContactsModule,
    OpportunitiesModule,
    QuotesModule,
    OrdersModule,
    ActivitiesModule,
    InvoicesModule,
    ContractsModule,
    FinanceModule,
    WebhooksModule,
    TicketsModule,
    KnowledgeModule,
    PortalModule,
    AiModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
