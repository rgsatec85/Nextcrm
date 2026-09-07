import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CustomersService } from '../customers/customers.service';
import { OpportunitiesService } from '../opportunities/opportunities.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { CreateActivityDto } from './dto/create-activity.dto';

@Injectable()
export class ActivitiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly customersService: CustomersService,
    private readonly opportunitiesService: OpportunitiesService,
  ) {}

  async create(user: AuthenticatedUser, dto: CreateActivityDto) {
    if (!dto.customerId && !dto.opportunityId) {
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

    return this.prisma.runWithTenant(user.tenantId, (tx) =>
      tx.activity.create({
        data: {
          tenantId: user.tenantId,
          customerId: dto.customerId,
          opportunityId: dto.opportunityId,
          type: dto.type,
          notes: dto.notes,
          scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
          createdBy: user.sub,
          updatedBy: user.sub,
        },
      }),
    );
  }

  async findAll(
    user: AuthenticatedUser,
    filters: { customerId?: string; opportunityId?: string },
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
      !filters.opportunityId;

    return this.prisma.runWithTenant(user.tenantId, (tx) =>
      tx.activity.findMany({
        where: {
          tenantId: user.tenantId,
          ...(filters.customerId ? { customerId: filters.customerId } : {}),
          ...(filters.opportunityId
            ? { opportunityId: filters.opportunityId }
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
    // oportunidade) em vez de duplicar a regra aqui.
    if (activity.customerId) {
      await this.customersService.assertAccessible(user, activity.customerId);
    }
    if (activity.opportunityId) {
      await this.opportunitiesService.assertAccessible(
        user,
        activity.opportunityId,
      );
    }

    return this.prisma.runWithTenant(user.tenantId, (tx) =>
      tx.activity.update({
        where: { id },
        data: { doneAt: new Date(), updatedBy: user.sub },
      }),
    );
  }
}
