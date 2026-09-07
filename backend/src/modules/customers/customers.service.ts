import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import {
  assertOwnership,
  ownerScopeWhere,
  resolveOwnerId,
} from '../../common/crm/ownership';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(user: AuthenticatedUser, dto: CreateCustomerDto) {
    const ownerId = resolveOwnerId(user, dto.ownerId);

    return this.prisma.runWithTenant(user.tenantId, (tx) =>
      tx.customer.create({
        data: {
          tenantId: user.tenantId,
          ownerId,
          name: dto.name,
          document: dto.document,
          segment: dto.segment,
          email: dto.email,
          phone: dto.phone,
          website: dto.website,
          notes: dto.notes,
          status: dto.status ?? 'ativo',
          tradeName: dto.tradeName,
          stateRegistration: dto.stateRegistration,
          municipalRegistration: dto.municipalRegistration,
          personType: dto.personType ?? 'juridica',
          subsegment: dto.subsegment,
          companySize: dto.companySize,
          leadSource: dto.leadSource,
          isStrategicAccount: dto.isStrategicAccount ?? false,
          createdBy: user.sub,
          updatedBy: user.sub,
        },
      }),
    );
  }

  async findAll(user: AuthenticatedUser) {
    return this.prisma.runWithTenant(user.tenantId, (tx) =>
      tx.customer.findMany({
        where: { tenantId: user.tenantId, ...ownerScopeWhere(user) },
        orderBy: { createdAt: 'desc' },
      }),
    );
  }

  /** Base do "Cliente 360°" (spec §10): cliente + contatos + oportunidades + pedidos + atividades. */
  async findOne(user: AuthenticatedUser, id: string) {
    const customer = await this.prisma.runWithTenant(user.tenantId, (tx) =>
      tx.customer.findFirst({
        where: { id, tenantId: user.tenantId },
        include: {
          contacts: { orderBy: { createdAt: 'asc' } },
          opportunities: {
            orderBy: { createdAt: 'desc' },
            include: {
              quotes: {
                orderBy: { version: 'desc' },
                // Fase 7 (RF012) — o Cliente 360° usa isso para decidir
                // entre "Converter em pedido" e um link para o pedido já
                // existente, sem precisar de uma segunda chamada.
                include: { orders: { select: { id: true, status: true } } },
              },
            },
          },
          orders: { orderBy: { createdAt: 'desc' } },
          activities: { orderBy: { scheduledAt: 'desc' } },
          // Fase 2: faturas e contratos entram no mesmo Cliente 360° em vez
          // de exigirem chamadas extras do frontend.
          invoices: { orderBy: { dueDate: 'asc' } },
          contracts: { orderBy: { endDate: 'asc' } },
        },
      }),
    );

    if (!customer) {
      throw new NotFoundException('Cliente não encontrado');
    }
    assertOwnership(user, customer);

    return customer;
  }

  /**
   * Checagem leve (sem includes) de que o cliente existe no tenant e é
   * acessível pelo usuário — usada por outros módulos (contacts,
   * opportunities, activities) antes de operar em algo pendurado num
   * customer_id, para não duplicar a query pesada de findOne().
   */
  async assertAccessible(user: AuthenticatedUser, customerId: string) {
    const customer = await this.prisma.runWithTenant(user.tenantId, (tx) =>
      tx.customer.findFirst({
        where: { id: customerId, tenantId: user.tenantId },
        select: { id: true, ownerId: true },
      }),
    );

    if (!customer) {
      throw new NotFoundException('Cliente não encontrado');
    }
    assertOwnership(user, customer);

    return customer;
  }

  async update(user: AuthenticatedUser, id: string, dto: UpdateCustomerDto) {
    // findOne já valida existência + ownership (ABAC) antes de deixar editar.
    await this.findOne(user, id);

    // Vendedor não pode reatribuir o dono do registro para outra pessoa.
    const { ownerId, ...rest } = dto;
    const data = {
      ...rest,
      ...(ownerId ? { ownerId: resolveOwnerId(user, ownerId) } : {}),
    };

    return this.prisma.runWithTenant(user.tenantId, (tx) =>
      tx.customer.update({
        where: { id },
        data: {
          ...data,
          updatedBy: user.sub,
        },
      }),
    );
  }
}
