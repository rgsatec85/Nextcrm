import { RedisThrottlerStorageService } from './redis-throttler-storage.service';

describe('RedisThrottlerStorageService', () => {
  // O fallback em memória (`ThrottlerStorageService` do próprio
  // @nestjs/throttler) agenda um `setTimeout` real de `ttl` ms por hit para
  // decrementar o contador depois. Com timers reais isso deixaria um
  // handle de 60s pendurado por teste (jest fica preso esperando o
  // processo encerrar). Fake timers eliminam isso sem mudar o
  // comportamento testado.
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('usa o fallback em memória quando RedisService não tem cliente (REDIS_URL não configurado)', async () => {
    const redisService = { getClient: jest.fn().mockReturnValue(undefined) };
    const storage = new RedisThrottlerStorageService(redisService as never);

    const result = await storage.increment(
      'ip-1',
      60_000,
      5,
      30_000,
      'default',
    );

    expect(result.totalHits).toBe(1);
    expect(result.isBlocked).toBe(false);
    // Nunca tenta falar com Redis se não há cliente.
  });

  it('conta hits corretamente via memória em chamadas sucessivas até bloquear no limite', async () => {
    const redisService = { getClient: jest.fn().mockReturnValue(undefined) };
    const storage = new RedisThrottlerStorageService(redisService as never);

    let last;
    for (let i = 0; i < 4; i += 1) {
      last = await storage.increment('ip-2', 60_000, 3, 30_000, 'default');
    }

    expect(last?.totalHits).toBe(4);
    expect(last?.isBlocked).toBe(true);
  });

  it('usa o Redis (script Lua atômico) quando o cliente está disponível e saudável', async () => {
    const evalMock = jest.fn().mockResolvedValue([1, 60_000, 0, 0]); // totalHits, ttlMs, isBlocked, blockMs
    const redisService = {
      getClient: jest.fn().mockReturnValue({ eval: evalMock }),
    };
    const storage = new RedisThrottlerStorageService(redisService as never);

    const result = await storage.increment(
      'ip-3',
      60_000,
      5,
      30_000,
      'default',
    );

    expect(evalMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      totalHits: 1,
      timeToExpire: 60,
      isBlocked: false,
      timeToBlockExpire: 0,
    });
  });

  it('reporta bloqueio quando o script Lua indica isBlocked = 1', async () => {
    const evalMock = jest.fn().mockResolvedValue([6, 45_000, 1, 30_000]);
    const redisService = {
      getClient: jest.fn().mockReturnValue({ eval: evalMock }),
    };
    const storage = new RedisThrottlerStorageService(redisService as never);

    const result = await storage.increment(
      'ip-4',
      60_000,
      5,
      30_000,
      'default',
    );

    expect(result.isBlocked).toBe(true);
    expect(result.timeToBlockExpire).toBe(30);
  });

  it('cai para o fallback em memória se o Redis lançar em runtime (ex.: conexão caiu)', async () => {
    const evalMock = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    const redisService = {
      getClient: jest.fn().mockReturnValue({ eval: evalMock }),
    };
    const storage = new RedisThrottlerStorageService(redisService as never);

    const result = await storage.increment(
      'ip-5',
      60_000,
      5,
      30_000,
      'default',
    );

    expect(evalMock).toHaveBeenCalledTimes(1);
    expect(result.totalHits).toBe(1);
    expect(result.isBlocked).toBe(false);
  });
});
