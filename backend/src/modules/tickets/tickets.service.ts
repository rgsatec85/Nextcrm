import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CustomersService } from '../customers/customers.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { assertOwnership } from '../../common/crm/ownership';
import { computeSlaDueAt } from './sla';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketStatusDto } from './dto/update-ticket-status.dto';
import { CreateTicketCommentDto } from './dto/create-ticket-comment.dto';

// Chamados não têm dono próprio — igual a orders/invoices/contracts, o ABAC
// de vendedor olha para o dono do CLIENTE via join (mesmo padrão da Fase 1/2,
// ver common/crm/ownership.ts e docs/security-multitenancy.md).
const OWNER_SCOPED_ROLES = ['vendedor'];

@Injectable()
export class TicketsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly customersService: CustomersService,
    private readonly webhooksService: WebhooksService,
  ) {}

  async create(user: AuthenticatedUser, dto: CreateTicketDto) {
    await this.customersService.assertAccessible(user, dto.customerId);

    const priority = dto.priority ?? 'media';

    return this.prisma.runWithTenant(user.tenantId, async (tx) =>
      tx.ticket.create({
        data: {
          tenantId: user.tenantId,
          customerId: dto.customerId,
          subject: dto.subject,
          description: dto.description,
          priority,
          slaDueAt: computeSlaDueAt(priority),
          assignedTo: dto.assignedTo,
          createdBy: user.sub,
          updatedBy: user.sub,
        },
      }),
    );
  }

  async findAll(
    user: AuthenticatedUser,
    filters: { customerId?: string; status?: string },
  ) {
    if (filters.customerId) {
      await this.customersService.assertAccessible(user, filters.customerId);
    }

    return this.prisma.runWithTenant(user.tenantId, async (tx) =>
      tx.ticket.findMany({
        where: {
          tenantId: user.tenantId,
          ...(filters.customerId ? { customerId: filters.customerId } : {}),
          ...(filters.status ? { status: filters.status } : {}),
          ...(OWNER_SCOPED_ROLES.includes(user.roleSlug)
            ? { customer: { ownerId: user.sub } }
            : {}),
        },
        include: { customer: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
      }),
    );
  }

  private async findAccessible(user: AuthenticatedUser, id: string) {
    const ticket = await this.prisma.runWithTenant(user.tenantId, async (tx) =>
      tx.ticket.findFirst({
        where: { id, tenantId: user.tenantId },
        include: {
          customer: { select: { id: true, name: true, ownerId: true } },
          comments: { orderBy: { createdAt: 'asc' } },
        },
      }),
    );

    if (!ticket) {
      throw new NotFoundException('Chamado não encontrado');
    }
    assertOwnership(user, { ownerId: ticket.customer.ownerId });

    return ticket;
  }

  async findOne(user: AuthenticatedUser, id: string) {
    return this.findAccessible(user, id);
  }

  /** Dispara `ticket.updated` (spec Fase 3 — webhooks) após a mudança de status. */
  async updateStatus(
    user: AuthenticatedUser,
    id: string,
    dto: UpdateTicketStatusDto,
  ) {
    await this.findAccessible(user, id);

    const updated = await this.prisma.runWithTenant(user.tenantId, async (tx) =>
      tx.ticket.update({
        where: { id },
        data: { status: dto.status, updatedBy: user.sub },
      }),
    );

    await this.webhooksService.dispatch(user.tenantId, 'ticket.updated', {
      ticketId: id,
      status: dto.status,
    });

    return updated;
  }

  /** Comentário de um usuário INTERNO (admin/gestor/vendedor/financeiro). */
  async addComment(
    user: AuthenticatedUser,
    id: string,
    dto: CreateTicketCommentDto,
  ) {
    await this.findAccessible(user, id);

    return this.prisma.runWithTenant(user.tenantId, async (tx) =>
      tx.ticketComment.create({
        data: {
          tenantId: user.tenantId,
          ticketId: id,
          authorId: user.sub,
          authorType: 'interno',
          body: dto.body,
        },
      }),
    );
  }
}
