import { ConflictException, NotFoundException } from '@nestjs/common';
import { KnowledgeService } from './knowledge.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';

function user(roleSlug = 'admin'): AuthenticatedUser {
  return { sub: 'user-1', tenantId: 'tenant-1', email: 'x@x.com', roleSlug };
}

describe('KnowledgeService', () => {
  const makeService = (tx: Record<string, unknown>) => {
    const prisma = {
      runWithTenant: jest.fn(
        (_tenantId: string, fn: (tx: unknown) => unknown) => fn(tx),
      ),
    };
    return { service: new KnowledgeService(prisma as never) };
  };

  it('create() deriva o slug do título quando slug não é informado', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const create = jest
      .fn()
      .mockImplementation(
        ({ data }: { data: Record<string, unknown> }) => data,
      );
    const { service } = makeService({
      knowledgeArticle: { findFirst, create },
    });

    const result = await service.create(user(), {
      title: 'Como emitir 2ª via de boleto?',
      body: 'Acesse o portal...',
    });

    expect(result.slug).toBe('como-emitir-2-via-de-boleto');
  });

  it('create() rejeita slug duplicado no mesmo tenant', async () => {
    const findFirst = jest.fn().mockResolvedValue({ id: 'a1' });
    const { service } = makeService({ knowledgeArticle: { findFirst } });

    await expect(
      service.create(user(), { title: 'Título', slug: 'ja-existe', body: 'x' }),
    ).rejects.toThrow(ConflictException);
  });

  it('findPublished() só filtra por isPublished=true, sem noção de ABAC/dono', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const { service } = makeService({ knowledgeArticle: { findMany } });

    await service.findPublished('tenant-1');

    const where = findMany.mock.calls[0][0].where as Record<string, unknown>;
    expect(where).toEqual({ tenantId: 'tenant-1', isPublished: true });
  });

  it('findOne() lança NotFoundException para artigo inexistente', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const { service } = makeService({ knowledgeArticle: { findFirst } });

    await expect(service.findOne(user(), 'a-inexistente')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('update() reslugifica quando um novo slug é informado', async () => {
    const findFirst = jest.fn().mockResolvedValue({ id: 'a1', slug: 'antigo' });
    const update = jest
      .fn()
      .mockImplementation(
        ({ data }: { data: Record<string, unknown> }) => data,
      );
    const { service } = makeService({
      knowledgeArticle: { findFirst, update },
    });

    const result = await service.update(user(), 'a1', { slug: 'Novo Slug!' });

    expect(result.slug).toBe('novo-slug');
  });
});
