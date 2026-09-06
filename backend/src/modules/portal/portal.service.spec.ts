import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PortalService } from './portal.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';

function portalUser(customerId = 'customer-A'): AuthenticatedUser {
  return {
    sub: 'portal-user-1',
    tenantId: 'tenant-1',
    email: 'cliente@a.com',
    roleSlug: 'cliente_portal',
    customerId,
  };
}

describe('PortalService — hard lock por customerId', () => {
  const makeService = (tx: Record<string, unknown>) => {
    const prisma = {
      runWithTenant: jest.fn(
        (_tenantId: string, fn: (tx: unknown) => unknown) => fn(tx),
      ),
    };
    const knowledgeService = { findPublished: jest.fn().mockResolvedValue([]) };
    return {
      service: new PortalService(prisma as never, knowledgeService as never),
      knowledgeService,
    };
  };

  it('lança ForbiddenException se o token não tiver customerId (falha fechado)', async () => {
    const { service } = makeService({});
    const userWithoutCustomer: AuthenticatedUser = {
      sub: 'u1',
      tenantId: 'tenant-1',
      email: 'x@x.com',
      roleSlug: 'cliente_portal',
    };

    await expect(service.me(userWithoutCustomer)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('orders() sempre filtra pelo customerId do PRÓPRIO usuário, nunca por um vindo de fora', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const { service } = makeService({ order: { findMany } });

    await service.orders(portalUser('customer-A'));

    const where = findMany.mock.calls[0][0].where as Record<string, unknown>;
    expect(where).toEqual({ tenantId: 'tenant-1', customerId: 'customer-A' });
  });

  it('invoices() de um cliente nunca vazam para outro — o where muda com o customerId do token', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const { service } = makeService({ invoice: { findMany } });

    await service.invoices(portalUser('customer-B'));

    const where = findMany.mock.calls[0][0].where as Record<string, unknown>;
    expect(where.customerId).toBe('customer-B');
    expect(where.customerId).not.toBe('customer-A');
  });

  it('createTicket() ignora qualquer customerId que viesse no dto — usa sempre o do token', async () => {
    const create = jest
      .fn()
      .mockImplementation(
        ({ data }: { data: Record<string, unknown> }) => data,
      );
    const { service } = makeService({ ticket: { create } });

    const result = await service.createTicket(portalUser('customer-A'), {
      subject: 'Preciso de ajuda',
      // @ts-expect-error — CreatePortalTicketDto não tem customerId; simula
      // uma tentativa de forjar o campo mesmo assim.
      customerId: 'customer-B',
    });

    expect(result.customerId).toBe('customer-A');
  });

  it('addComment() em um chamado de OUTRO cliente (ID adivinhado) devolve NotFound, nunca o comentário', async () => {
    // findFirst com where customerId do próprio usuário não encontra o
    // ticket de outro cliente — simulamos exatamente esse "0 rows".
    const findFirst = jest.fn().mockResolvedValue(null);
    const create = jest.fn();
    const { service } = makeService({
      ticket: { findFirst },
      ticketComment: { create },
    });

    await expect(
      service.addComment(portalUser('customer-A'), 'ticket-do-customer-B', {
        body: 'oi',
      }),
    ).rejects.toThrow(NotFoundException);

    expect(create).not.toHaveBeenCalled();
    const where = findFirst.mock.calls[0][0].where as Record<string, unknown>;
    expect(where).toEqual({
      id: 'ticket-do-customer-B',
      tenantId: 'tenant-1',
      customerId: 'customer-A',
    });
  });

  it('knowledge() delega para KnowledgeService.findPublished (nunca acessa /knowledge diretamente)', async () => {
    const { service, knowledgeService } = makeService({});

    await service.knowledge(portalUser('customer-A'));

    expect(knowledgeService.findPublished).toHaveBeenCalledWith('tenant-1');
  });
});
