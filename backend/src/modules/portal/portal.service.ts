import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { computeSlaDueAt } from '../tickets/sla';
import { CreatePortalTicketDto } from './dto/create-portal-ticket.dto';
import { CreateTicketCommentDto } from '../tickets/dto/create-ticket-comment.dto';

const DAY_MS = 24 * 60 * 60 * 1000;

// Mesma decoração de "vencido" da InvoicesService (Fase 2) — duplicada aqui
// de propósito em vez de importada: o Portal tem seu próprio caminho de
// acesso (hard lock), então não reusa o service interno para não herdar por
// engano nenhum comportamento de ABAC "opcional" pensado para vendedor.
function decorateInvoice<T extends { status: string; dueDate: Date }>(
  invoice: T,
) {
  const isOverdue =
    (invoice.status === 'aberto' || invoice.status === 'parcial') &&
    invoice.dueDate.getTime() < Date.now();
  return { ...invoice, isOverdue };
}

function decorateContract<T extends { endDate: Date; status: string }>(
  contract: T,
) {
  const daysUntilExpiration = Math.ceil(
    (contract.endDate.getTime() - Date.now()) / DAY_MS,
  );
  return {
    ...contract,
    daysUntilExpiration,
    expiringSoon: contract.status === 'ativo' && daysUntilExpiration <= 30,
  };
}

/**
 * Portal do Cliente (spec Fase 3). Isolamento "hard lock": toda leitura e
 * escrita é filtrada por `user.customerId` — o customerId do PRÓPRIO
 * usuário autenticado, nunca aceito como parâmetro vindo do cliente HTTP.
 * Isto é mais rígido que o ABAC de vendedor (`ownerScopeWhere`), que é
 * opcional por perfil — aqui não existe perfil que "veja tudo do tenant",
 * cliente_portal só enxerga o próprio Customer, ponto. Ver
 * docs/security-multitenancy.md.
 */
@Injectable()
export class PortalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly knowledgeService: KnowledgeService,
  ) {}

  private requireCustomerId(user: AuthenticatedUser): string {
    if (!user.customerId) {
      // Nunca deveria acontecer (JwtStrategy só emite este perfil com
      // customerId setado — ver PortalLoginsService), mas falha fechado em
      // vez de silenciosamente devolver dados de todo o tenant.
      throw new ForbiddenException('Usuário do portal sem cliente vinculado');
    }
    return user.customerId;
  }

  async me(user: AuthenticatedUser) {
    const customerId = this.requireCustomerId(user);

    const customer = await this.prisma.runWithTenant(
      user.tenantId,
      async (tx) =>
        tx.customer.findFirst({
          where: { id: customerId, tenantId: user.tenantId },
          select: {
            id: true,
            name: true,
            document: true,
            segment: true,
            email: true,
            phone: true,
            website: true,
            status: true,
            createdAt: true,
          },
        }),
    );

    if (!customer) {
      throw new NotFoundException('Cliente não encontrado');
    }
    return customer;
  }

  async orders(user: AuthenticatedUser) {
    const customerId = this.requireCustomerId(user);
    return this.prisma.runWithTenant(user.tenantId, async (tx) =>
      tx.order.findMany({
        where: { tenantId: user.tenantId, customerId },
        orderBy: { createdAt: 'desc' },
      }),
    );
  }

  async invoices(user: AuthenticatedUser) {
    const customerId = this.requireCustomerId(user);
    const invoices = await this.prisma.runWithTenant(
      user.tenantId,
      async (tx) =>
        tx.invoice.findMany({
          where: { tenantId: user.tenantId, customerId },
          orderBy: { dueDate: 'asc' },
        }),
    );
    return invoices.map(decorateInvoice);
  }

  async contracts(user: AuthenticatedUser) {
    const customerId = this.requireCustomerId(user);
    const contracts = await this.prisma.runWithTenant(
      user.tenantId,
      async (tx) =>
        tx.contract.findMany({
          // Fase 9 (RF013): 'rascunho' é um estado interno de elaboração —
          // o cliente só deve ver o contrato depois que ele for ativado.
          where: {
            tenantId: user.tenantId,
            customerId,
            status: { not: 'rascunho' },
          },
          orderBy: { endDate: 'asc' },
        }),
    );
    return contracts.map(decorateContract);
  }

  async tickets(user: AuthenticatedUser) {
    const customerId = this.requireCustomerId(user);
    return this.prisma.runWithTenant(user.tenantId, async (tx) =>
      tx.ticket.findMany({
        where: { tenantId: user.tenantId, customerId },
        include: { comments: { orderBy: { createdAt: 'asc' } } },
        orderBy: { createdAt: 'desc' },
      }),
    );
  }

  async createTicket(user: AuthenticatedUser, dto: CreatePortalTicketDto) {
    const customerId = this.requireCustomerId(user);
    const priority = dto.priority ?? 'media';

    return this.prisma.runWithTenant(user.tenantId, async (tx) =>
      tx.ticket.create({
        data: {
          tenantId: user.tenantId,
          customerId, // nunca vem do dto — sempre o do próprio usuário
          subject: dto.subject,
          description: dto.description,
          priority,
          slaDueAt: computeSlaDueAt(priority),
          createdBy: user.sub,
          updatedBy: user.sub,
        },
      }),
    );
  }

  async addComment(
    user: AuthenticatedUser,
    ticketId: string,
    dto: CreateTicketCommentDto,
  ) {
    const customerId = this.requireCustomerId(user);

    return this.prisma.runWithTenant(user.tenantId, async (tx) => {
      // Reconfirma customerId no próprio WHERE do chamado (não só na
      // criação) — mesmo que o usuário adivinhe um ticketId de outro
      // cliente, a query não encontra nada fora do próprio customerId.
      const ticket = await tx.ticket.findFirst({
        where: { id: ticketId, tenantId: user.tenantId, customerId },
      });
      if (!ticket) {
        throw new NotFoundException('Chamado não encontrado');
      }

      return tx.ticketComment.create({
        data: {
          tenantId: user.tenantId,
          ticketId,
          authorId: user.sub,
          authorType: 'cliente',
          body: dto.body,
        },
      });
    });
  }

  /** Delega para KnowledgeService.findPublished — nunca chama /knowledge diretamente. */
  async knowledge(user: AuthenticatedUser) {
    return this.knowledgeService.findPublished(user.tenantId);
  }
}
