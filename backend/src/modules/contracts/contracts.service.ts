import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CustomersService } from '../customers/customers.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { assertOwnership } from '../../common/crm/ownership';
import { CreateContractDto } from './dto/create-contract.dto';
import { UpdateContractDto } from './dto/update-contract.dto';
import { RenewContractDto } from './dto/renew-contract.dto';

// Contratos não têm dono próprio — o ABAC olha para o dono do CLIENTE,
// mesmo padrão de OrdersService/InvoicesService.
const OWNER_SCOPED_ROLES = ['vendedor'];

const DAY_MS = 24 * 60 * 60 * 1000;

function decorateContract<T extends { endDate: Date; status: string }>(
  contract: T,
) {
  const daysUntilExpiration = Math.ceil(
    (contract.endDate.getTime() - Date.now()) / DAY_MS,
  );
  return {
    ...contract,
    daysUntilExpiration,
    // "Alerta" (spec Fase 2): contrato ativo vencendo em até 30 dias.
    expiringSoon: contract.status === 'ativo' && daysUntilExpiration <= 30,
  };
}

@Injectable()
export class ContractsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly customersService: CustomersService,
  ) {}

  async create(user: AuthenticatedUser, dto: CreateContractDto) {
    await this.customersService.assertAccessible(user, dto.customerId);

    if (new Date(dto.endDate) <= new Date(dto.startDate)) {
      throw new BadRequestException('endDate precisa ser depois de startDate');
    }

    return this.prisma.runWithTenant(user.tenantId, async (tx) =>
      tx.contract.create({
        data: {
          tenantId: user.tenantId,
          customerId: dto.customerId,
          title: dto.title,
          value: dto.value ?? 0,
          startDate: new Date(dto.startDate),
          endDate: new Date(dto.endDate),
          renewalPeriodMonths: dto.renewalPeriodMonths,
          notes: dto.notes,
          createdBy: user.sub,
          updatedBy: user.sub,
        },
      }),
    );
  }

  async findAll(user: AuthenticatedUser, customerId?: string) {
    if (customerId) {
      await this.customersService.assertAccessible(user, customerId);
    }

    const contracts = await this.prisma.runWithTenant(
      user.tenantId,
      async (tx) =>
        tx.contract.findMany({
          where: {
            tenantId: user.tenantId,
            ...(customerId ? { customerId } : {}),
            ...(OWNER_SCOPED_ROLES.includes(user.roleSlug)
              ? { customer: { ownerId: user.sub } }
              : {}),
          },
          include: { customer: { select: { id: true, name: true } } },
          orderBy: { endDate: 'asc' },
        }),
    );

    return contracts.map(decorateContract);
  }

  private async findAccessible(user: AuthenticatedUser, id: string) {
    const contract = await this.prisma.runWithTenant(
      user.tenantId,
      async (tx) =>
        tx.contract.findFirst({
          where: { id, tenantId: user.tenantId },
          include: {
            customer: { select: { id: true, name: true, ownerId: true } },
          },
        }),
    );

    if (!contract) {
      throw new NotFoundException('Contrato não encontrado');
    }
    assertOwnership(user, { ownerId: contract.customer.ownerId });

    return contract;
  }

  async findOne(user: AuthenticatedUser, id: string) {
    return decorateContract(await this.findAccessible(user, id));
  }

  async update(user: AuthenticatedUser, id: string, dto: UpdateContractDto) {
    await this.findAccessible(user, id);

    const { startDate, endDate, ...rest } = dto;

    return this.prisma.runWithTenant(user.tenantId, async (tx) =>
      tx.contract.update({
        where: { id },
        data: {
          ...rest,
          ...(startDate ? { startDate: new Date(startDate) } : {}),
          ...(endDate ? { endDate: new Date(endDate) } : {}),
          updatedBy: user.sub,
        },
      }),
    );
  }

  /** Renova o contrato: usa newEndDate se informado, senão soma renewalPeriodMonths ao endDate atual. */
  async renew(user: AuthenticatedUser, id: string, dto: RenewContractDto) {
    const contract = await this.findAccessible(user, id);

    let newEndDate: Date;
    if (dto.newEndDate) {
      newEndDate = new Date(dto.newEndDate);
    } else {
      if (!contract.renewalPeriodMonths) {
        throw new ConflictException(
          'Contrato sem renewalPeriodMonths definido — informe newEndDate explicitamente',
        );
      }
      newEndDate = new Date(contract.endDate);
      newEndDate.setMonth(newEndDate.getMonth() + contract.renewalPeriodMonths);
    }

    if (newEndDate <= contract.endDate) {
      throw new BadRequestException(
        'A nova data de fim precisa ser depois da atual',
      );
    }

    return this.prisma.runWithTenant(user.tenantId, async (tx) =>
      tx.contract.update({
        where: { id },
        data: { endDate: newEndDate, status: 'renovado', updatedBy: user.sub },
      }),
    );
  }
}
