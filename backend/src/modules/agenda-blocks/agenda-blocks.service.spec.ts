import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { AgendaBlocksService } from './agenda-blocks.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';

function user(roleSlug: string, sub = 'user-1'): AuthenticatedUser {
  return { sub, tenantId: 'tenant-1', email: 'x@x.com', roleSlug };
}

describe('AgendaBlocksService', () => {
  const makeService = (tx: Record<string, unknown>) => {
    const prisma = {
      runWithTenant: jest.fn(
        (_tenantId: string, fn: (tx: unknown) => unknown) => fn(tx),
      ),
    };
    return { service: new AgendaBlocksService(prisma as never) };
  };

  it('create() rejeita quando o fim não é depois do início', async () => {
    const { service } = makeService({});

    await expect(
      service.create(user('vendedor'), {
        startsAt: '2026-01-01T10:00:00.000Z',
        endsAt: '2026-01-01T09:00:00.000Z',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('create() rejeita quando já existe um bloqueio seu no período', async () => {
    const findFirst = jest.fn().mockResolvedValue({ id: 'existing' });
    const create = jest.fn();
    const { service } = makeService({ agendaBlock: { findFirst, create } });

    await expect(
      service.create(user('vendedor'), {
        startsAt: '2026-01-01T10:00:00.000Z',
        endsAt: '2026-01-01T11:00:00.000Z',
      }),
    ).rejects.toThrow(ConflictException);
    expect(create).not.toHaveBeenCalled();
  });

  it('create() cria o bloqueio sempre para o próprio usuário (userId = user.sub)', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const create = jest.fn().mockResolvedValue({ id: 'b1' });
    const { service } = makeService({ agendaBlock: { findFirst, create } });

    await service.create(user('vendedor', 'user-1'), {
      startsAt: '2026-01-01T10:00:00.000Z',
      endsAt: '2026-01-01T11:00:00.000Z',
      reason: 'Dentista',
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: 'user-1', reason: 'Dentista' }),
      }),
    );
  });

  it('findAll() força o próprio id para vendedor mesmo pedindo outro userId', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const { service } = makeService({ agendaBlock: { findMany } });

    await service.findAll(user('vendedor', 'user-1'), { userId: 'user-2' });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: 'user-1' }),
      }),
    );
  });

  it('findAll() permite admin consultar a agenda de outra pessoa via userId', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const { service } = makeService({ agendaBlock: { findMany } });

    await service.findAll(user('admin'), { userId: 'user-2' });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: 'user-2' }),
      }),
    );
  });

  it('findAll() sem userId usa o próprio id como padrão para qualquer perfil', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const { service } = makeService({ agendaBlock: { findMany } });

    await service.findAll(user('admin', 'user-9'), {});

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: 'user-9' }),
      }),
    );
  });

  it('remove() rejeita remover bloqueio de outra pessoa', async () => {
    const findFirst = jest
      .fn()
      .mockResolvedValue({ id: 'b1', userId: 'user-2' });
    const { service } = makeService({ agendaBlock: { findFirst } });

    await expect(service.remove(user('admin', 'user-1'), 'b1')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('remove() lança NotFoundException quando o bloqueio não existe', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const { service } = makeService({ agendaBlock: { findFirst } });

    await expect(service.remove(user('admin'), 'missing')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('remove() apaga o próprio bloqueio', async () => {
    const findFirst = jest
      .fn()
      .mockResolvedValue({ id: 'b1', userId: 'user-1' });
    const del = jest.fn().mockResolvedValue({ id: 'b1' });
    const { service } = makeService({
      agendaBlock: { findFirst, delete: del },
    });

    await expect(
      service.remove(user('admin', 'user-1'), 'b1'),
    ).resolves.toEqual({
      success: true,
    });
    expect(del).toHaveBeenCalledWith({ where: { id: 'b1' } });
  });
});
