import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';

/**
 * Client com privilégio elevado (role app_service no banco, BYPASSRLS).
 *
 * Uso estritamente limitado a operações que, por natureza, não têm um
 * tenant_id de sessão ainda:
 *   - provisionamento de um novo tenant no cadastro self-service
 *   - lookup de usuário por email no login (antes de sabermos o tenant)
 *
 * NUNCA usar este client para servir dados de negócio de um tenant já
 * autenticado — isso pularia a Camada 3 (RLS) inteira. Qualquer novo uso
 * deste service deve ser justificado em code review.
 */
@Injectable()
export class PrismaAdminService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(config: ConfigService) {
    super({
      datasources: {
        db: {
          url: config.get<string>('DATABASE_SERVICE_URL'),
        },
      },
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
