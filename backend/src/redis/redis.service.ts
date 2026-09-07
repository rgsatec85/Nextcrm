import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * Cliente Redis opcional (Fase 5 — Hardening/Escala).
 *
 * `REDIS_URL` não é obrigatório: o deploy atual no Render não tem nenhum
 * Redis provisionado, e este projeto já foi mordido antes por assumir
 * infraestrutura opcional como garantida (ver histórico de incidentes de
 * peer-dependency das fases anteriores). Por isso este service nunca lança
 * na ausência da env var — ele só fica "desligado" (`isConfigured === false`),
 * e todo consumidor (rate limiting, health check de prontidão) precisa
 * checar isso e cair para um comportamento alternativo em vez de assumir
 * que o Redis está de pé.
 *
 * Mesmo com `REDIS_URL` configurado, uma falha de conexão em runtime (Redis
 * caiu, rede instável) NUNCA derruba o processo — `maxRetriesPerRequest: 1`
 * faz operações individuais falharem rápido em vez de enfileirar
 * indefinidamente, e os consumidores tratam esse erro como "Redis
 * indisponível agora", não como um crash.
 */
@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client?: Redis;
  private healthy = false;

  constructor(config: ConfigService) {
    const url = config.get<string>('REDIS_URL');
    if (!url) {
      this.logger.log(
        'REDIS_URL não definido — rate limiting fica em memória (por instância) e o health check de prontidão não verifica Redis.',
      );
      return;
    }

    this.client = new Redis(url, {
      maxRetriesPerRequest: 1,
      retryStrategy: (times) => Math.min(times * 200, 2000),
      lazyConnect: false,
      // Não deixa o processo do backend vivo só por causa de um handle de
      // socket do Redis pendente durante o shutdown.
      enableOfflineQueue: true,
    });

    this.client.on('error', (err: Error) => {
      if (this.healthy) {
        this.logger.warn(
          `Redis ficou indisponível, caindo para fallback em memória: ${err.message}`,
        );
      }
      this.healthy = false;
    });

    this.client.on('ready', () => {
      if (!this.healthy) {
        this.logger.log('Redis conectado/reconectado.');
      }
      this.healthy = true;
    });
  }

  /** Se `REDIS_URL` foi configurado (independente do Redis estar acessível agora). */
  get isConfigured(): boolean {
    return this.client !== undefined;
  }

  /** Cliente ioredis cru, para uso avançado (ex.: `RedisThrottlerStorageService`). `undefined` se não configurado. */
  getClient(): Redis | undefined {
    return this.client;
  }

  /** Usado pelo `/api/health/ready` — nunca lança, sempre resolve para true/false. */
  async ping(): Promise<boolean> {
    if (!this.client) {
      return false;
    }
    try {
      const reply = await this.client.ping();
      return reply === 'PONG';
    } catch {
      return false;
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.client) {
      return;
    }
    try {
      await this.client.quit();
    } catch {
      // Já estava desconectado ou não respondeu a tempo — força o fechamento
      // do socket em vez de deixar o processo pendurado no shutdown.
      this.client.disconnect();
    }
  }
}
