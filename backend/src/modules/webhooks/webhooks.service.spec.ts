import { NotFoundException } from '@nestjs/common';
import { WebhooksService } from './webhooks.service';
import { signWebhookPayload } from './hmac';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';

function user(roleSlug = 'admin'): AuthenticatedUser {
  return { sub: 'user-1', tenantId: 'tenant-1', email: 'x@x.com', roleSlug };
}

describe('signWebhookPayload (HMAC)', () => {
  it('gera a mesma assinatura para o mesmo secret+corpo', () => {
    const a = signWebhookPayload('s3cret', '{"a":1}');
    const b = signWebhookPayload('s3cret', '{"a":1}');
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/); // hex de 32 bytes (SHA-256)
  });

  it('gera assinaturas diferentes para secrets diferentes', () => {
    const a = signWebhookPayload('secret-a', '{"a":1}');
    const b = signWebhookPayload('secret-b', '{"a":1}');
    expect(a).not.toBe(b);
  });

  it('gera assinaturas diferentes para corpos diferentes', () => {
    const a = signWebhookPayload('s3cret', '{"a":1}');
    const b = signWebhookPayload('s3cret', '{"a":2}');
    expect(a).not.toBe(b);
  });
});

describe('WebhooksService', () => {
  const makeService = (
    tx: Record<string, unknown>,
    adminModel: Record<string, unknown> = {},
  ) => {
    const prisma = {
      runWithTenant: jest.fn(
        (_tenantId: string, fn: (tx: unknown) => unknown) => fn(tx),
      ),
    };
    const prismaAdmin = {
      contract: { findMany: jest.fn().mockResolvedValue([]) },
      ...adminModel,
    };
    return {
      service: new WebhooksService(prisma as never, prismaAdmin as never),
      prisma,
    };
  };

  it('create() gera um secret e nunca reaproveita um enviado pelo cliente', async () => {
    const create = jest
      .fn()
      .mockImplementation(({ data }: { data: Record<string, unknown> }) => ({
        id: 'w1',
        ...data,
      }));
    const { service } = makeService({ webhookSubscription: { create } });

    const result = await service.create(user(), {
      url: 'https://example.com/hook',
      events: ['order.created'],
    });

    expect(create.mock.calls[0][0].data.secret).toMatch(/^[0-9a-f]{64}$/);
    expect(result.secret).toBe(create.mock.calls[0][0].data.secret);
  });

  it('findAll() nunca seleciona o campo secret', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const { service } = makeService({ webhookSubscription: { findMany } });

    await service.findAll(user());

    const args = findMany.mock.calls[0][0] as {
      select: Record<string, unknown>;
    };
    expect(args.select.secret).toBeUndefined();
  });

  it('toggle() remove o secret da resposta mesmo que o update devolva a linha inteira', async () => {
    const findFirst = jest.fn().mockResolvedValue({ id: 'w1' });
    const update = jest.fn().mockResolvedValue({
      id: 'w1',
      url: 'https://example.com/hook',
      secret: 'super-secret-value',
      isActive: false,
    });
    const { service } = makeService({
      webhookSubscription: { findFirst, update },
    });

    const result = await service.toggle(user(), 'w1', false);

    expect(result).not.toHaveProperty('secret');
    expect(result.isActive).toBe(false);
  });

  it('toggle() lança NotFoundException para webhook de outro tenant/inexistente', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const { service } = makeService({ webhookSubscription: { findFirst } });

    await expect(service.toggle(user(), 'w-inexistente', true)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('dispatch() nunca lança mesmo se a busca de assinaturas falhar', async () => {
    const findMany = jest.fn().mockRejectedValue(new Error('db indisponível'));
    const { service } = makeService({ webhookSubscription: { findMany } });

    await expect(
      service.dispatch('tenant-1', 'order.created', { orderId: 'o1' }),
    ).resolves.toBeUndefined();
  });

  it('dispatch() nunca lança mesmo se o fetch para o endpoint falhar', async () => {
    const findMany = jest
      .fn()
      .mockResolvedValue([
        { id: 'w1', url: 'https://example.com/hook', secret: 's3cret' },
      ]);
    const { service } = makeService({ webhookSubscription: { findMany } });

    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockRejectedValue(new Error('network error'));

    await expect(
      service.dispatch('tenant-1', 'order.created', { orderId: 'o1' }),
    ).resolves.toBeUndefined();

    global.fetch = originalFetch;
  });

  it('dispatch() assina o corpo com o secret da assinatura e envia no header', async () => {
    const findMany = jest
      .fn()
      .mockResolvedValue([
        { id: 'w1', url: 'https://example.com/hook', secret: 's3cret' },
      ]);
    const { service } = makeService({ webhookSubscription: { findMany } });

    const originalFetch = global.fetch;
    const fetchMock = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchMock as unknown as typeof fetch;

    await service.dispatch('tenant-1', 'order.created', { orderId: 'o1' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://example.com/hook');
    const headers = init.headers as Record<string, string>;
    expect(headers['X-Webhook-Signature']).toBe(
      signWebhookPayload('s3cret', init.body as string),
    );

    global.fetch = originalFetch;
  });

  it('notifyExpiringContracts() nunca lança mesmo se a leitura via PrismaAdminService falhar', async () => {
    const { service } = makeService(
      {},
      {
        contract: { findMany: jest.fn().mockRejectedValue(new Error('boom')) },
      },
    );

    await expect(service.notifyExpiringContracts()).resolves.toBeUndefined();
  });
});
