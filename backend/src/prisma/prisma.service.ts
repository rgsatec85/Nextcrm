import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

const TENANT_ID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Client "request-scoped" (role app_user no banco, sujeito a Row Level
 * Security). TODA leitura/escrita que pertence a um tenant deve passar por
 * `runWithTenant`, nunca chamar this.<model> diretamente fora dele — isso
 * garantiria a Camada 2 (filtro no backend) mas pularia a Camada 3 (RLS),
 * que depende da variável de sessão estar setada.
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  /**
   * Executa `fn` dentro de uma transação com `app.tenant_id` setado via
   * `SET LOCAL` (escopo da transação, nunca vaza entre requests mesmo com
   * connection pooling). As policies de RLS leem essa variável através de
   * `current_tenant_id()` — ver database/migrations/0001_init.sql.
   */
  async runWithTenant<T>(
    tenantId: string,
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    if (!TENANT_ID_REGEX.test(tenantId)) {
      throw new Error(`tenantId inválido: ${tenantId}`);
    }

    return this.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
      return fn(tx);
    });
  }
}
