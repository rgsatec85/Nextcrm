import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CustomersService } from '../customers/customers.service';
import { OpportunitiesService } from '../opportunities/opportunities.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import {
  CreateActivityDto,
  CRM_LINKED_ACTIVITY_TYPES,
} from './dto/create-activity.dto';

@Injectable()
export class ActivitiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly customersService: CustomersService,
    private readonly opportunitiesService: OpportunitiesService,
  ) {}

  async create(user: AuthenticatedUser, dto: CreateActivityDto) {
    // Fase 8 (RF016): 'tarefa' e 'evento' são compromissos de propósito
    // geral (pessoal/interno) e não exigem cliente/oportunidade — os quatro
    // tipos originais (reunião/ligação/follow-up/nota) continuam sendo,
    // como sempre foram, um registro de CRM que precisa estar ligado a algo.
    if (
      (CRM_LINKED_ACTIVITY_TYPES as readonly string[]).includes(dto.type) &&
      !dto.customerId &&
      !dto.opportunityId
    ) {
      throw new BadRequestException(
        'Informe customerId e/ou opportunityId — uma atividade precisa estar ligada a algo',
      );
    }

    // Valida acesso (existência + ABAC) em qualquer entidade referenciada.
    if (dto.customerId) {
      await this.customersService.assertAccessible(user, dto.customerId);
    }
    if (dto.opportunityId) {
      await this.opportunitiesService.assertAccessible(user, dto.opportunityId);
    }

    const scheduledAt = dto.scheduledAt ? new Date(dto.scheduledAt) : undefined;
    const endAt = dto.endAt ? new Date(dto.endAt) : undefined;
    if (endAt && !scheduledAt) {
      throw new BadRequestException(
        'Informe a data/hora de início junto com o fim',
      );
    }
    if (scheduledAt && endAt && endAt <= scheduledAt) {
      throw new BadRequestException('O fim deve ser depois do início');
    }

    return this.prisma.runWithTenant(user.tenantId, async (tx) => {
      // Checagem de conflito de agenda (Fase 8, RF016) — só quando a
      // atividade tem início E fim definidos (um "slot" de calendário de
      // verdade). Compara contra: (1) outras atividades já agendadas da
      // mesma pessoa com início/fim definidos, e (2) bloqueios de agenda
      // dela (AgendaBlock). A agenda é sempre a de quem está CRIANDO o
      // registro (created_by) — não há hoje o conceito de "criar uma
      // atividade para a agenda de outra pessoa".
      if (scheduledAt && endAt) {
        const overlappingActivity = await tx.activity.findFirst({
          where: {
            tenantId: user.tenantId,
            createdBy: user.sub,
            scheduledAt: { lt: endAt },
            endAt: { gt: scheduledAt },
          },
        });
        if (overlappingActivity) {
          throw new ConflictException(
            'Conflito de agenda: você já tem um compromisso nesse horário',
          );
        }

        const overlappingBlock = await tx.agendaBlock.findFirst({
          where: {
            tenantId: user.tenantId,
            userId: user.sub,
            startsAt: { lt: endAt },
            endsAt: { gt: scheduledAt },
          },
        });
        if (overlappingBlock) {
          throw new ConflictException(
            overlappingBlock.reason
              ? `Conflito de agenda: esse horário está bloqueado (${overlappingBlock.reason})`
              : 'Conflito de agenda: esse horário está bloqueado',
          );
        }
      }

      return tx.activity.create({
        data: {
          tenantId: user.tenantId,
          customerId: dto.customerId,
          opportunityId: dto.opportunityId,
          type: dto.type,
          notes: dto.notes,
          scheduledAt,
          endAt,
          createdBy: user.sub,
          updatedBy: user.sub,
        },
      });
    });
  }

  async findAll(
    user: AuthenticatedUser,
    filters: {
      customerId?: string;
      opportunityId?: string;
      // Fase 8 — calendário pessoal: userId/from/to alimentam a tela
      // `/dashboard/agenda`. Sem eles, o comportamento é exatamente o de
      // antes (Cliente 360°/Oportunidade listando tudo, com owner-scope só
      // quando nenhum filtro é passado).
      userId?: string;
      from?: string;
      to?: string;
    },
  ) {
    // Filtrando por um cliente/oportunidade específico, valida ABAC contra
    // esse registro (mesma regra de sempre). Sem filtro nenhum, restringe
    // via join para quem só pode ver o que é seu — ver ownership.ts.
    if (filters.customerId) {
      await this.customersService.assertAccessible(user, filters.customerId);
    }
    if (filters.opportunityId) {
      await this.opportunitiesService.assertAccessible(
        user,
        filters.opportunityId,
      );
    }

    const isOwnerScoped =
      user.roleSlug === 'vendedor' &&
      !filters.customerId &&
      !filters.opportunityId &&
      !filters.userId;

    // userId explícito (calendário pessoal): vendedor só pode consultar a
    // própria agenda, mesmo que peça outro id — os demais perfis podem
    // consultar a de um colega. Sem userId, mantém o comportamento antigo
    // (nenhum filtro por criador).
    const effectiveUserId = filters.userId
      ? user.roleSlug === 'vendedor'
        ? user.sub
        : filters.userId
      : undefined;

    const scheduledAtFilter: { gte?: Date; lte?: Date } = {};
    if (filters.from) scheduledAtFilter.gte = new Date(filters.from);
    if (filters.to) scheduledAtFilter.lte = new Date(filters.to);

    return this.prisma.runWithTenant(user.tenantId, async (tx) =>
      tx.activity.findMany({
        where: {
          tenantId: user.tenantId,
          ...(filters.customerId ? { customerId: filters.customerId } : {}),
          ...(filters.opportunityId
            ? { opportunityId: filters.opportunityId }
            : {}),
          ...(effectiveUserId ? { createdBy: effectiveUserId } : {}),
          ...(Object.keys(scheduledAtFilter).length
            ? { scheduledAt: scheduledAtFilter }
            : {}),
          ...(isOwnerScoped
            ? {
                OR: [
                  { customer: { ownerId: user.sub } },
                  { opportunity: { ownerId: user.sub } },
                ],
              }
            : {}),
        },
        orderBy: { scheduledAt: 'desc' },
      }),
    );
  }

  async complete(user: AuthenticatedUser, id: string) {
    const activity = await this.prisma.runWithTenant(
      user.tenantId,
      async (tx) =>
        tx.activity.findFirst({ where: { id, tenantId: user.tenantId } }),
    );
    if (!activity) {
      throw new NotFoundException('Atividade não encontrada');
    }

    // Reusa a validação de ABAC de quem a atividade pertence (cliente e/ou
    // oportunidade) em vez de duplicar a regra aqui. Uma atividade sem
    // nenhum dos dois (tarefa/evento pessoal, Fase 8) só pode ser concluída
    // por quem a criou.
    if (activity.customerId) {
      await this.customersService.assertAccessible(user, activity.customerId);
    }
    if (activity.opportunityId) {
      await this.opportunitiesService.assertAccessible(
        user,
        activity.opportunityId,
      );
    }
    if (
      !activity.customerId &&
      !activity.opportunityId &&
      user.roleSlug === 'vendedor' &&
      activity.createdBy !== user.sub
    ) {
      throw new ForbiddenException('Você não tem acesso a este registro');
    }

    return this.prisma.runWithTenant(user.tenantId, async (tx) =>
      tx.activity.update({
        where: { id },
        data: { doneAt: new Date(), updatedBy: user.sub },
      }),
    );
  }
}
