import { Injectable, Logger } from '@nestjs/common';
import { ThrottlerStorage, ThrottlerStorageService } from '@nestjs/throttler';
import type { ThrottlerStorageRecord } from '@nestjs/throttler/dist/throttler-storage-record.interface';
import { RedisService } from '../../redis/redis.service';

/**
 * Script Lua para incrementar o contador e decidir bloqueio de forma
 * atômica num único round-trip ao Redis — evita a race condition de fazer
 * INCR e depois checar/gravar o bloqueio em comandos separados, que sob
 * concorrência real deixaria passar mais requisições que o limite
 * configurado.
 *
 * KEYS[1] = chave do contador, KEYS[2] = chave do bloqueio
 * ARGV[1] = ttl (ms), ARGV[2] = limit, ARGV[3] = blockDuration (ms)
 * Retorna: { totalHits, timeToExpireMs, isBlocked (0|1), timeToBlockExpireMs }
 */
const INCREMENT_SCRIPT = `
local blockTtl = redis.call('PTTL', KEYS[2])
if blockTtl > 0 then
  local totalHits = tonumber(redis.call('GET', KEYS[1]) or '0')
  local ttlRemaining = redis.call('PTTL', KEYS[1])
  if ttlRemaining < 0 then ttlRemaining = 0 end
  return {totalHits, ttlRemaining, 1, blockTtl}
end

local totalHits = redis.call('INCR', KEYS[1])
if totalHits == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end

local ttlRemaining = redis.call('PTTL', KEYS[1])
if ttlRemaining < 0 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
  ttlRemaining = tonumber(ARGV[1])
end

local isBlocked = 0
local timeToBlockExpire = 0
if totalHits > tonumber(ARGV[2]) then
  isBlocked = 1
  redis.call('SET', KEYS[2], '1', 'PX', ARGV[3])
  timeToBlockExpire = tonumber(ARGV[3])
end

return {totalHits, ttlRemaining, isBlocked, timeToBlockExpire}
`;

/**
 * `ThrottlerStorage` (interface do `@nestjs/throttler` v6, verificada em
 * `node_modules/@nestjs/throttler/dist/throttler-storage.interface.d.ts`
 * antes de implementar) apoiado em Redis, com fallback automático e
 * transparente para o armazenamento em memória do próprio pacote
 * (`ThrottlerStorageService`) quando:
 *
 * 1. `REDIS_URL` não está configurado (deploy atual no Render) — o
 *    fallback é usado sempre, sem sequer tentar o Redis; ou
 * 2. `REDIS_URL` está configurado mas o Redis está fora do ar no momento
 *    da requisição — o erro é capturado e a mesma requisição cai para a
 *    memória, em vez de quebrar (rate limiting é best-effort: melhor
 *    limitar por instância do que derrubar a API porque o Redis caiu).
 *
 * Trade-off explícito do fallback em memória: sob múltiplas instâncias do
 * backend (Render com mais de uma réplica), cada instância conta hits
 * separadamente enquanto o Redis estiver fora — o limite efetivo global
 * vira `limit × instâncias` até o Redis voltar. Aceitável para rate
 * limiting (não é um controle de acesso de segurança crítica) e infinitamente
 * melhor que a API cair porque o Redis caiu.
 */
@Injectable()
export class RedisThrottlerStorageService implements ThrottlerStorage {
  private readonly logger = new Logger(RedisThrottlerStorageService.name);
  private readonly memoryFallback = new ThrottlerStorageService();

  constructor(private readonly redisService: RedisService) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const client = this.redisService.getClient();
    if (!client) {
      return this.memoryFallback.increment(
        key,
        ttl,
        limit,
        blockDuration,
        throttlerName,
      );
    }

    try {
      const dataKey = `throttler:{${throttlerName}:${key}}:hits`;
      const blockKey = `throttler:{${throttlerName}:${key}}:blocked`;

      const result = (await client.eval(
        INCREMENT_SCRIPT,
        2,
        dataKey,
        blockKey,
        ttl,
        limit,
        blockDuration,
      )) as [number, number, number, number];

      const [totalHits, timeToExpireMs, isBlockedFlag, timeToBlockExpireMs] =
        result;

      return {
        totalHits,
        timeToExpire: Math.ceil(timeToExpireMs / 1000),
        isBlocked: isBlockedFlag === 1,
        timeToBlockExpire: Math.ceil(timeToBlockExpireMs / 1000),
      };
    } catch (err) {
      this.logger.warn(
        `Redis indisponível durante rate limiting ("${throttlerName}"), usando memória para esta requisição: ${String(err)}`,
      );
      return this.memoryFallback.increment(
        key,
        ttl,
        limit,
        blockDuration,
        throttlerName,
      );
    }
  }
}
