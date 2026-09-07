import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { RedisService } from './redis/redis.service';
import { RedisThrottlerStorageService } from './common/throttler/redis-throttler-storage.service';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { HealthModule } from './health/health.module';
import { CustomersModule } from './modules/customers/customers.module';
import { ContactsModule } from './modules/contacts/contacts.module';
import { OpportunitiesModule } from './modules/opportunities/opportunities.module';
import { QuotesModule } from './modules/quotes/quotes.module';
import { ProposalTemplatesModule } from './modules/proposal-templates/proposal-templates.module';
import { OrdersModule } from './modules/orders/orders.module';
import { ActivitiesModule } from './modules/activities/activities.module';
import { AgendaBlocksModule } from './modules/agenda-blocks/agenda-blocks.module';
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
    RedisModule,
    ThrottlerModule.forRootAsync({
      imports: [RedisModule],
      inject: [RedisService],
      useFactory: (redisService: RedisService) => ({
        throttlers: [
          {
            // Rate limiting básico (spec seção 17). Ajuste por rota
            // conforme necessário com o decorator @Throttle().
            ttl: 60_000,
            limit: 100,
          },
        ],
        // Fase 5: armazenamento em Redis (com fallback automático em
        // memória quando REDIS_URL não está configurado ou o Redis está
        // fora do ar) — ver `RedisThrottlerStorageService`. Sem isso, cada
        // instância do backend no Render conta hits separadamente mesmo
        // com Redis disponível, o que já era uma limitação conhecida desta
        // fundação (ver docs/architecture.md, "Rate limiting por rota").
        // Construído diretamente (não via DI) porque o próprio
        // ThrottlerModule ainda não existe neste ponto do bootstrap — só
        // RedisService, que ele injeta, precisa vir do container.
        storage: new RedisThrottlerStorageService(redisService),
      }),
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    TenantsModule,
    HealthModule,
    CustomersModule,
    ContactsModule,
    OpportunitiesModule,
    QuotesModule,
    ProposalTemplatesModule,
    OrdersModule,
    ActivitiesModule,
    AgendaBlocksModule,
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
