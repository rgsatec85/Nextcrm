import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { ContractsService } from './contracts.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';

function user(roleSlug: string, sub = 'user-1'): AuthenticatedUser {
  return { sub, tenantId: 'tenant-1', email: 'x@x.com', roleSlug };
}

describe('ContractsService', () => {
  const makeService = (tx: Record<string, unknown>) => {
    const prisma = {
      runWithTenant: jest.fn(
        (_tenantId: string, fn: (tx: unknown) => unknown) => fn(tx),
      ),
    };
    const customersService = {
      assertAccessible: jest
        .fn()
        .mockResolvedValue({ id: 'c1', ownerId: 'user-1' }),
    };
    const contractPdfService = {
      generate: jest.fn().mockResolvedValue(Buffer.from('pdf')),
    };
    return {
      service: new ContractsService(
        prisma as never,
        customersService as never,
        contractPdfService as never,
      ),
    };
  };

  it('create() rejeita endDate anterior ou igual a startDate', async () => {
    const { service } = makeService({ contract: {} });

    await expect(
      service.create(user('admin'), {
        customerId: 'c1',
        title: 'Contrato X',
        startDate: '2026-01-10',
        endDate: '2026-01-01',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('findOne() calcula daysUntilExpiration e expiringSoon', async () => {
    const inThirtyDays = new Date();
    inThirtyDays.setDate(inThirtyDays.getDate() + 10);

    const findFirst = jest.fn().mockResolvedValue({
      id: 'k1',
      status: 'ativo',
      endDate: inThirtyDays,
      customer: { id: 'c1', ownerId: 'user-1' },
    });
    const { service } = makeService({ contract: { findFirst } });

    const result = await service.findOne(user('admin'), 'k1');

    expect(result.expiringSoon).toBe(true);
    expect(result.daysUntilExpiration).toBeLessThanOrEqual(10);
  });

  it('findOne() bloqueia vendedor acessando contrato de cliente de outro dono', async () => {
    const findFirst = jest.fn().mockResolvedValue({
      id: 'k1',
      status: 'ativo',
      endDate: new Date(),
      customer: { id: 'c1', ownerId: 'outro-user' },
    });
    const { service } = makeService({ contract: { findFirst } });

    await expect(
      service.findOne(user('vendedor', 'user-1'), 'k1'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('renew() estende endDate por renewalPeriodMonths quando newEndDate não é informado', async () => {
    const findFirst = jest.fn().mockResolvedValue({
      id: 'k1',
      status: 'ativo',
      endDate: new Date('2026-01-01'),
      renewalPeriodMonths: 12,
      customer: { id: 'c1', ownerId: 'user-1' },
    });
    const update = jest.fn().mockImplementation(({ data }) => data);
    const { service } = makeService({ contract: { findFirst, update } });

    const result = await service.renew(user('admin'), 'k1', {});

    expect(result.status).toBe('renovado');
    expect((result.endDate as Date).getFullYear()).toBe(2027);
  });

  it('renew() rejeita quando não há renewalPeriodMonths nem newEndDate explícito', async () => {
    const findFirst = jest.fn().mockResolvedValue({
      id: 'k1',
      status: 'ativo',
      endDate: new Date('2026-01-01'),
      renewalPeriodMonths: null,
      customer: { id: 'c1', ownerId: 'user-1' },
    });
    const { service } = makeService({ contract: { findFirst } });

    await expect(service.renew(user('admin'), 'k1', {})).rejects.toThrow(
      ConflictException,
    );
  });

  it('create() com templateId copia o corpo do modelo já com os campos substituídos', async () => {
    const create = jest.fn().mockImplementation(({ data }) => data);
    const findFirstTemplate = jest.fn().mockResolvedValue({
      id: 't1',
      body: 'Contrato para {{cliente.nome}}, vigência {{vigencia_inicio}} a {{vigencia_fim}}.',
    });
    const findFirstCustomer = jest
      .fn()
      .mockResolvedValue({ name: 'Acme Ltda', owner: { name: 'Ana' } });
    const { service } = makeService({
      contract: { create },
      contractTemplate: { findFirst: findFirstTemplate },
      customer: { findFirst: findFirstCustomer },
    });

    const result = await service.create(user('admin'), {
      customerId: 'c1',
      title: 'Contrato X',
      startDate: '2026-01-10',
      endDate: '2026-06-10',
      templateId: 't1',
    });

    expect(result.templateId).toBe('t1');
    expect(result.body).toContain('Acme Ltda');
    expect(result.body).not.toContain('{{');
  });

  it('update() rejeita alterar body fora do status rascunho', async () => {
    const findFirst = jest.fn().mockResolvedValue({
      id: 'k1',
      status: 'ativo',
      endDate: new Date(),
      customer: { id: 'c1', ownerId: 'user-1' },
    });
    const { service } = makeService({ contract: { findFirst } });

    await expect(
      service.update(user('admin'), 'k1', { body: '<p>novo texto</p>' }),
    ).rejects.toThrow(ConflictException);
  });

  it('update() permite editar body enquanto o contrato está em rascunho, saneando o HTML', async () => {
    const findFirst = jest.fn().mockResolvedValue({
      id: 'k1',
      status: 'rascunho',
      endDate: new Date(),
      customer: { id: 'c1', ownerId: 'user-1' },
    });
    const update = jest.fn().mockImplementation(({ data }) => data);
    const { service } = makeService({ contract: { findFirst, update } });

    const result = await service.update(user('admin'), 'k1', {
      body: '<p>texto</p><script>alert(1)</script>',
    });

    expect(result.body).toContain('<p>texto</p>');
    expect(result.body).not.toContain('script');
  });

  it('activate() muda rascunho -> ativo', async () => {
    const findFirst = jest.fn().mockResolvedValue({
      id: 'k1',
      status: 'rascunho',
      endDate: new Date(),
      customer: { id: 'c1', ownerId: 'user-1' },
    });
    const update = jest.fn().mockImplementation(({ data }) => data);
    const { service } = makeService({ contract: { findFirst, update } });

    const result = await service.activate(user('admin'), 'k1');

    expect(result.status).toBe('ativo');
  });

  it('activate() rejeita um contrato que não está em rascunho', async () => {
    const findFirst = jest.fn().mockResolvedValue({
      id: 'k1',
      status: 'ativo',
      endDate: new Date(),
      customer: { id: 'c1', ownerId: 'user-1' },
    });
    const { service } = makeService({ contract: { findFirst } });

    await expect(service.activate(user('admin'), 'k1')).rejects.toThrow(
      ConflictException,
    );
  });

  it('applyTemplate() só funciona em contratos rascunho', async () => {
    const findFirst = jest.fn().mockResolvedValue({
      id: 'k1',
      status: 'ativo',
      endDate: new Date(),
      customer: { id: 'c1', ownerId: 'user-1', name: 'Acme' },
    });
    const { service } = makeService({ contract: { findFirst } });

    await expect(
      service.applyTemplate(user('admin'), 'k1', { templateId: 't1' }),
    ).rejects.toThrow(ConflictException);
  });

  it('applyTemplate() copia o corpo do modelo para o contrato em rascunho', async () => {
    const findFirst = jest.fn().mockResolvedValue({
      id: 'k1',
      status: 'rascunho',
      value: 1000,
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
      customerId: 'c1',
      customer: { id: 'c1', ownerId: 'user-1', name: 'Acme' },
    });
    const update = jest.fn().mockImplementation(({ data }) => data);
    const findFirstTemplate = jest
      .fn()
      .mockResolvedValue({ id: 't1', body: 'Valor: {{valor}}' });
    const findFirstCustomer = jest
      .fn()
      .mockResolvedValue({ name: 'Acme', owner: { name: 'Ana' } });
    const { service } = makeService({
      contract: { findFirst, update },
      contractTemplate: { findFirst: findFirstTemplate },
      customer: { findFirst: findFirstCustomer },
    });

    const result = await service.applyTemplate(user('admin'), 'k1', {
      templateId: 't1',
    });

    expect(result.templateId).toBe('t1');
    expect(result.body).toContain('R$ 1000.00');
  });
});
