import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { CreateAgendaBlockDto } from './dto/create-agenda-block.dto';

// Fase 8 (RF016) — bloqueio de agenda é sempre PESSOAL: cada usuário só
// bloqueia (e remove) a própria agenda. "Vendedor" não é um caso especial
// aqui como é em ownership.ts — todo mundo só mexe no que é seu; admin/
// gestor/financeiro só ganham a permissão extra de CONSULTAR (GET) a agenda
// de um colega informando ?userId=, para fins de agendamento em equipe.
const SELF_ONLY_ROLES = ['vendedor'];

@Injectable()
export class AgendaBlocksService {
  constructor(private readonly prisma: PrismaService) {}

  async create(user: AuthenticatedUser, dto: CreateAgendaBlockDto) {
    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);
    if (endsAt <= startsAt) {
      throw new BadRequestException(
        'O fim do bloqueio deve ser depois do início',
      );
    }

    return this.prisma.runWithTenant(user.tenantId, async (tx) => {
      const overlapping = await tx.agendaBlock.findFirst({
        where: {
          tenantId: user.tenantId,
          userId: user.sub,
          startsAt: { lt: endsAt },
          endsAt: { gt: startsAt },
        },
      });
      if (overlapping) {
        throw new ConflictException('Já existe um bloqueio seu nesse período');
      }

      return tx.agendaBlock.create({
        data: {
          tenantId: user.tenantId,
          userId: user.sub,
          startsAt,
          endsAt,
          reason: dto.reason,
          createdBy: user.sub,
          updatedBy: user.sub,
        },
      });
    });
  }

  async findAll(
    user: AuthenticatedUser,
    filters: { from?: string; to?: string; userId?: string },
  ) {
    // Vendedor só enxerga a própria agenda; os demais perfis podem consultar
    // a de um colega (ex.: para agendar algo em conjunto) informando
    // userId — sem informar, veem a própria também (mesmo default de todo
    // mundo: "minha agenda").
    const targetUserId = SELF_ONLY_ROLES.includes(user.roleSlug)
      ? user.sub
      : (filters.userId ?? user.sub);

    // Um bloqueio "aparece" no período consultado se ele termina depois do
    // início da janela e começa antes do fim dela — não basta comparar só
    // startsAt, ou um bloqueio que começou antes do mês mas ainda vale
    // dentro dele desapareceria da consulta.
    return this.prisma.runWithTenant(user.tenantId, async (tx) =>
      tx.agendaBlock.findMany({
        where: {
          tenantId: user.tenantId,
          userId: targetUserId,
          ...(filters.to ? { startsAt: { lte: new Date(filters.to) } } : {}),
          ...(filters.from ? { endsAt: { gte: new Date(filters.from) } } : {}),
        },
        orderBy: { startsAt: 'asc' },
      }),
    );
  }

  async remove(user: AuthenticatedUser, id: string) {
    const block = await this.prisma.runWithTenant(user.tenantId, async (tx) =>
      tx.agendaBlock.findFirst({ where: { id, tenantId: user.tenantId } }),
    );
    if (!block) {
      throw new NotFoundException('Bloqueio não encontrado');
    }
    // Sempre pessoal, para qualquer perfil — a permissão extra que
    // admin/gestor/financeiro têm é só de LEITURA da agenda de um colega
    // (ver findAll), nunca de apagar o bloqueio de outra pessoa.
    if (block.userId !== user.sub) {
      throw new ForbiddenException(
        'Você não pode remover o bloqueio de outra pessoa',
      );
    }

    await this.prisma.runWithTenant(user.tenantId, async (tx) =>
      tx.agendaBlock.delete({ where: { id } }),
    );
    return { success: true };
  }
}
