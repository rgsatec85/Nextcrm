import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CustomersService } from '../customers/customers.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import {
  assertOwnership,
  ownerScopeWhere,
  resolveOwnerId,
} from '../../common/crm/ownership';
import { CreateOpportunityDto } from './dto/create-opportunity.dto';
import { UpdateOpportunityDto } from './dto/update-opportunity.dto';

@Injectable()
export class OpportunitiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly customersService: CustomersService,
  ) {}

  async create(user: AuthenticatedUser, dto: CreateOpportunityDto) {
    await this.customersService.assertAccessible(user, dto.customerId);
    const ownerId = resolveOwnerId(user, dto.ownerId);

    return this.prisma.runWithTenant(user.tenantId, (tx) =>
      tx.opportunity.create({
        data: {
          tenantId: user.tenantId,
          customerId: dto.customerId,
          ownerId,
          title: dto.title,
          stage: dto.stage ?? 'lead',
          value: dto.value ?? 0,
          expectedCloseDate: dto.expectedCloseDate
            ? new Date(dto.expectedCloseDate)
            : undefined,
          notes: dto.notes,
          createdBy: user.sub,
          updatedBy: user.sub,
        },
      }),
    );
  }

  /**
   * Lista para o pipeline Kanban (spec §9): todas as oportunidades
   * acessíveis pelo usuário, com o nome do cliente para exibir no card.
   * Opcionalmente filtra por customerId (usado no Cliente 360°, embora
   * CustomersService.findOne já traga isso via include).
   */
  async findAll(user: AuthenticatedUser, customerId?: string) {
    return this.prisma.runWithTenant(user.tenantId, (tx) =>
      tx.opportunity.findMany({
        where: {
          tenantId: user.tenantId,
          ...ownerScopeWhere(user),
          ...(customerId ? { customerId } : {}),
        },
        include: { customer: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
      }),
    );
  }

  async findOne(user: AuthenticatedUser, id: string) {
    const opportunity = await this.prisma.runWithTenant(user.tenantId, (tx) =>
      tx.opportunity.findFirst({
        where: { id, tenantId: user.tenantId },
        include: {
          customer: { select: { id: true, name: true } },
          quotes: { orderBy: { version: 'desc' } },
          activities: { orderBy: { scheduledAt: 'desc' } },
        },
      }),
    );

    if (!opportunity) {
      throw new NotFoundException('Oportunidade não encontrada');
    }
    assertOwnership(user, opportunity);

    return opportunity;
  }

  /** Checagem leve, usada por quotes/activities antes de operar sobre uma oportunidade. */
  async assertAccessible(user: AuthenticatedUser, id: string) {
    const opportunity = await this.prisma.runWithTenant(user.tenantId, (tx) =>
      tx.opportunity.findFirst({
        where: { id, tenantId: user.tenantId },
        select: { id: true, ownerId: true, customerId: true },
      }),
    );

    if (!opportunity) {
      throw new NotFoundException('Oportunidade não encontrada');
    }
    assertOwnership(user, opportunity);

    return opportunity;
  }

  async update(user: AuthenticatedUser, id: string, dto: UpdateOpportunityDto) {
    await this.findOne(user, id);

    const { ownerId, expectedCloseDate, ...rest } = dto;

    return this.prisma.runWithTenant(user.tenantId, (tx) =>
      tx.opportunity.update({
        where: { id },
        data: {
          ...rest,
          ...(ownerId ? { ownerId: resolveOwnerId(user, ownerId) } : {}),
          ...(expectedCloseDate
            ? { expectedCloseDate: new Date(expectedCloseDate) }
            : {}),
          updatedBy: user.sub,
        },
      }),
    );
  }

  /** Move o card no Kanban (mudança de estágio). */
  async changeStage(user: AuthenticatedUser, id: string, stage: string) {
    await this.findOne(user, id);

    return this.prisma.runWithTenant(user.tenantId, async (tx) =>
      tx.opportunity.update({
        where: { id },
        data: { stage, updatedBy: user.sub },
      }),
    );
  }
}
