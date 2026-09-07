import { RedisService } from './redis.service';

function configWithout(): { get: jest.Mock } {
  return { get: jest.fn().mockReturnValue(undefined) };
}

describe('RedisService', () => {
  it('fica não-configurado quando REDIS_URL não está definido, sem lançar', () => {
    const service = new RedisService(configWithout() as never);

    expect(service.isConfigured).toBe(false);
    expect(service.getClient()).toBeUndefined();
  });

  it('ping() resolve para false (nunca lança) quando não está configurado', async () => {
    const service = new RedisService(configWithout() as never);

    await expect(service.ping()).resolves.toBe(false);
  });

  it('onModuleDestroy() não lança quando nunca houve cliente', async () => {
    const service = new RedisService(configWithout() as never);

    await expect(service.onModuleDestroy()).resolves.toBeUndefined();
  });
});
