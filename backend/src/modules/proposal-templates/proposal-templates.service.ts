import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { CreateProposalTemplateDto } from './dto/create-proposal-template.dto';
import { UpdateProposalTemplateDto } from './dto/update-proposal-template.dto';

/**
 * Biblioteca de modelos reutilizáveis de proposta (spec v3.1, RF011).
 * Criação/edição restrita a admin/gestor no controller (mesmo padrão de
 * `KnowledgeController`); leitura aberta a todos os perfis internos que
 * criam propostas (vendedor precisa poder escolher um modelo).
 */
@Injectable()
export class ProposalTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(user: AuthenticatedUser, dto: CreateProposalTemplateDto) {
    return this.prisma.runWithTenant(user.tenantId, async (tx) =>
      tx.proposalTemplate.create({
        data: {
          tenantId: user.tenantId,
          name: dto.name,
          category: dto.category,
          logoUrl: dto.logoUrl,
          primaryColor: dto.primaryColor,
          headerText: dto.headerText,
          footerText: dto.footerText,
          clauses: dto.clauses,
          isActive: dto.isActive ?? true,
          createdBy: user.sub,
          updatedBy: user.sub,
        },
      }),
    );
  }

  /** Todos os perfis internos veem todos os modelos, ativos ou não (é o painel de gestão). */
  async findAll(user: AuthenticatedUser) {
    return this.prisma.runWithTenant(user.tenantId, async (tx) =>
      tx.proposalTemplate.findMany({
        where: { tenantId: user.tenantId },
        orderBy: { name: 'asc' },
      }),
    );
  }

  private async findAccessible(user: AuthenticatedUser, id: string) {
    const template = await this.prisma.runWithTenant(
      user.tenantId,
      async (tx) =>
        tx.proposalTemplate.findFirst({
          where: { id, tenantId: user.tenantId },
        }),
    );
    if (!template) {
      throw new NotFoundException('Modelo de proposta não encontrado');
    }
    return template;
  }

  async findOne(user: AuthenticatedUser, id: string) {
    return this.findAccessible(user, id);
  }

  async update(
    user: AuthenticatedUser,
    id: string,
    dto: UpdateProposalTemplateDto,
  ) {
    await this.findAccessible(user, id);

    return this.prisma.runWithTenant(user.tenantId, async (tx) =>
      tx.proposalTemplate.update({
        where: { id },
        data: { ...dto, updatedBy: user.sub },
      }),
    );
  }

  /**
   * "Desativar" (spec) em vez de excluir — um modelo desativado some do
   * seletor de novas propostas, mas propostas antigas continuam apontando
   * pra ele (template_id) para o histórico/PDF permanecer reproduzível.
   */
  async toggle(user: AuthenticatedUser, id: string, isActive: boolean) {
    await this.findAccessible(user, id);

    return this.prisma.runWithTenant(user.tenantId, async (tx) =>
      tx.proposalTemplate.update({
        where: { id },
        data: { isActive, updatedBy: user.sub },
      }),
    );
  }
}
