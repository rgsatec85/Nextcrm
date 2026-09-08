import { NotFoundException } from '@nestjs/common';
import { ContractTemplatesService } from './contract-templates.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';

function user(roleSlug = 'admin'): AuthenticatedUser {
  return { sub: 'user-1', tenantId: 'tenant-1', email: 'x@x.com', roleSlug };
}

describe('ContractTemplatesService', () => {
  const makeService = (tx: Record<string, unknown>) => {
    const prisma = {
      runWithTenant: jest.fn(
        (_tenantId: string, fn: (tx: unknown) => unknown) => fn(tx),
      ),
    };
    return { service: new ContractTemplatesService(prisma as never) };
  };

  it('create() aplica isActive=true por padrão quando não informado', async () => {
    const create = jest
      .fn()
      .mockImplementation(
        ({ data }: { data: Record<string, unknown> }) => data,
      );
    const { service } = makeService({ contractTemplate: { create } });

    const result = await service.create(user(), { name: 'Padrão de Serviço' });

    expect(result.isActive).toBe(true);
    expect(result.name).toBe('Padrão de Serviço');
  });

  it('create() saneia o body removendo tags fora da allowlist', async () => {
    const create = jest
      .fn()
      .mockImplementation(
        ({ data }: { data: Record<string, unknown> }) => data,
      );
    const { service } = makeService({ contractTemplate: { create } });

    const result = await service.create(user(), {
      name: 'Modelo',
      body: '<p>Cláusula 1</p><script>alert(1)</script>',
    });

    expect(result.body).toContain('<p>Cláusula 1</p>');
    expect(result.body).not.toContain('script');
  });

  it('findOne() lança NotFoundException para modelo inexistente', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const { service } = makeService({ contractTemplate: { findFirst } });

    await expect(service.findOne(user(), 't-inexistente')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('toggle() desativa um modelo sem excluí-lo', async () => {
    const findFirst = jest.fn().mockResolvedValue({ id: 't1', isActive: true });
    const update = jest
      .fn()
      .mockImplementation(
        ({ data }: { data: Record<string, unknown> }) => data,
      );
    const { service } = makeService({
      contractTemplate: { findFirst, update },
    });

    const result = await service.toggle(user(), 't1', false);

    expect(result.isActive).toBe(false);
  });
});
