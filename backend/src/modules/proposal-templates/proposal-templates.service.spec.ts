import { NotFoundException } from '@nestjs/common';
import { ProposalTemplatesService } from './proposal-templates.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';

function user(roleSlug = 'admin'): AuthenticatedUser {
  return { sub: 'user-1', tenantId: 'tenant-1', email: 'x@x.com', roleSlug };
}

describe('ProposalTemplatesService', () => {
  const makeService = (tx: Record<string, unknown>) => {
    const prisma = {
      runWithTenant: jest.fn(
        (_tenantId: string, fn: (tx: unknown) => unknown) => fn(tx),
      ),
    };
    return { service: new ProposalTemplatesService(prisma as never) };
  };

  it('create() aplica isActive=true por padrão quando não informado', async () => {
    const create = jest
      .fn()
      .mockImplementation(
        ({ data }: { data: Record<string, unknown> }) => data,
      );
    const { service } = makeService({ proposalTemplate: { create } });

    const result = await service.create(user(), { name: 'Venda de Serviço' });

    expect(result.isActive).toBe(true);
    expect(result.name).toBe('Venda de Serviço');
  });

  it('findOne() lança NotFoundException para modelo inexistente', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const { service } = makeService({ proposalTemplate: { findFirst } });

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
      proposalTemplate: { findFirst, update },
    });

    const result = await service.toggle(user(), 't1', false);

    expect(result.isActive).toBe(false);
  });
});
