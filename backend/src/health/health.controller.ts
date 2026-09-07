import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

type CheckStatus = 'ok' | 'error' | 'not_configured';

interface ReadinessBody {
  status: 'ok' | 'error';
  timestamp: string;
  checks: {
    database: { status: CheckStatus };
    redis: { status: CheckStatus };
  };
}

/**
 * Distinção liveness vs. readiness (Fase 5 — Hardening):
 *
 * - **Liveness** (`GET /api/health`, formato inalterado desde a Fase 0 —
 *   `docs/deployment.md` e o health check path configurado no Render
 *   apontam exatamente para este endpoint): "o processo Node está de pé e
 *   respondendo a HTTP". Deliberadamente NÃO verifica banco/Redis — se
 *   verificasse, uma instabilidade passageira do Postgres derrubaria o
 *   health check e o Render reiniciaria um processo saudável
 *   desnecessariamente (o pior tipo de auto scaling: reiniciar tudo quando
 *   o problema é externo).
 * - **Readiness** (`GET /api/health/ready`, novo nesta fase): "o processo
 *   está de pé E consegue de fato atender uma requisição de negócio agora"
 *   — banco alcançável (sempre checado, é uma dependência obrigatória) e
 *   Redis alcançável (só checado, e só considerado falha, quando
 *   `REDIS_URL` está configurado — a ausência de Redis é um estado válido
 *   deste projeto, não uma falha de prontidão). Devolve 503 se alguma
 *   dependência obrigatória estiver fora do ar.
 *
 * O Render hoje só suporta um único health check path (configurado como
 * liveness, `/api/health`); `/ready` fica disponível para um load balancer
 * ou orquestrador que faça essa distinção (ver `docs/observability.md`),
 * ou simplesmente para diagnóstico manual/monitoramento externo.
 */
@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  @Get()
  check() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get('ready')
  async ready(): Promise<ReadinessBody> {
    const [database, redis] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
    ]);

    const isReady = database.status !== 'error' && redis.status !== 'error';

    const body: ReadinessBody = {
      status: isReady ? 'ok' : 'error',
      timestamp: new Date().toISOString(),
      checks: { database, redis },
    };

    if (!isReady) {
      throw new HttpException(body, HttpStatus.SERVICE_UNAVAILABLE);
    }
    return body;
  }

  private async checkDatabase(): Promise<{ status: CheckStatus }> {
    try {
      // Query trivial, sem tabela de negócio nenhuma envolvida — não passa
      // por `runWithTenant` de propósito (não há tenant no contexto de um
      // health check, e não deveria precisar de um para provar que o
      // Postgres responde).
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok' };
    } catch (err) {
      this.logger.warn(`Readiness: banco indisponível: ${String(err)}`);
      return { status: 'error' };
    }
  }

  private async checkRedis(): Promise<{ status: CheckStatus }> {
    if (!this.redisService.isConfigured) {
      return { status: 'not_configured' };
    }
    const ok = await this.redisService.ping();
    if (!ok) {
      this.logger.warn('Readiness: Redis configurado mas inalcançável.');
    }
    return { status: ok ? 'ok' : 'error' };
  }
}
