import { HttpException, HttpStatus } from '@nestjs/common';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('check() (liveness) sempre responde ok, sem checar dependência nenhuma', () => {
    const prisma = { $queryRaw: jest.fn() };
    const redis = { isConfigured: false, ping: jest.fn() };
    const controller = new HealthController(prisma as never, redis as never);

    const result = controller.check();

    expect(result.status).toBe('ok');
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
    expect(redis.ping).not.toHaveBeenCalled();
  });

  describe('ready() (readiness)', () => {
    it('responde ok quando o banco está acessível e Redis não está configurado', async () => {
      const prisma = {
        $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
      };
      const redis = { isConfigured: false, ping: jest.fn() };
      const controller = new HealthController(prisma as never, redis as never);

      const result = await controller.ready();

      expect(result.status).toBe('ok');
      expect(result.checks.database.status).toBe('ok');
      expect(result.checks.redis.status).toBe('not_configured');
      expect(redis.ping).not.toHaveBeenCalled();
    });

    it('responde ok quando o banco e o Redis (configurado) estão acessíveis', async () => {
      const prisma = {
        $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
      };
      const redis = {
        isConfigured: true,
        ping: jest.fn().mockResolvedValue(true),
      };
      const controller = new HealthController(prisma as never, redis as never);

      const result = await controller.ready();

      expect(result.status).toBe('ok');
      expect(result.checks.redis.status).toBe('ok');
    });

    it('lança 503 quando o banco está indisponível', async () => {
      const prisma = {
        $queryRaw: jest.fn().mockRejectedValue(new Error('connection refused')),
      };
      const redis = { isConfigured: false, ping: jest.fn() };
      const controller = new HealthController(prisma as never, redis as never);

      let error: HttpException | undefined;
      try {
        await controller.ready();
      } catch (err) {
        error = err as HttpException;
      }

      expect(error).toBeInstanceOf(HttpException);
      expect(error?.getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
      const body = error?.getResponse() as {
        status: string;
        checks: Record<string, { status: string }>;
      };
      expect(body.status).toBe('error');
      expect(body.checks.database.status).toBe('error');
    });

    it('lança 503 quando o Redis está configurado mas inalcançável, mesmo com o banco ok', async () => {
      const prisma = {
        $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
      };
      const redis = {
        isConfigured: true,
        ping: jest.fn().mockResolvedValue(false),
      };
      const controller = new HealthController(prisma as never, redis as never);

      let error: HttpException | undefined;
      try {
        await controller.ready();
      } catch (err) {
        error = err as HttpException;
      }

      expect(error).toBeInstanceOf(HttpException);
      const body = error?.getResponse() as {
        checks: Record<string, { status: string }>;
      };
      expect(body.checks.redis.status).toBe('error');
      expect(body.checks.database.status).toBe('ok');
    });
  });
});
