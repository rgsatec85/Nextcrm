import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { assertOwnership } from '../../common/crm/ownership';

const OWNER_SCOPED_ROLES = ['vendedor'];

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  // Pedidos não têm dono próprio (spec não pede isso) — o ABAC aqui olha
  // para o dono do CLIENTE ao qual o pedido pertence, via join.
  async findAll(user: AuthenticatedUser, customerId?: string) {
    return this.prisma.runWithTenant(user.tenantId, (tx) =>
      tx.order.findMany({
        where: {
          tenantId: user.tenantId,
          ...(customerId ? { customerId } : {}),
          ...(OWNER_SCOPED_ROLES.includes(user.roleSlug)
            ? { customer: { ownerId: user.sub } }
            : {}),
        },
        include: { customer: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
      }),
    );
  }

  async findOne(user: AuthenticatedUser, id: string) {
    const order = await this.prisma.runWithTenant(user.tenantId, async (tx) =>
      tx.order.findFirst({
        where: { id, tenantId: user.tenantId },
        include: {
          customer: { select: { id: true, name: true, ownerId: true } },
          quote: true,
        },
      }),
    );

    if (!order) {
      throw new NotFoundException('Pedido não encontrado');
    }
    assertOwnership(user, { ownerId: order.customer.ownerId });

    return order;
  }

  async updateStatus(user: AuthenticatedUser, id: string, status: string) {
    await this.findOne(user, id);

    return this.prisma.runWithTenant(user.tenantId, (tx) =>
      tx.order.update({
        where: { id },
        data: { status, updatedBy: user.sub },
      }),
    );
  }
}
