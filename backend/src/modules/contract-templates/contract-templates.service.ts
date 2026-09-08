import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { sanitizeContractBody } from '../contracts/sanitize-contract-body';
import { CreateContractTemplateDto } from './dto/create-contract-template.dto';
import { UpdateContractTemplateDto } from './dto/update-contract-template.dto';

/**
 * Biblioteca de modelos reutilizáveis de contrato (Fase 9, RF013) — mesmo
 * desenho de ProposalTemplatesService. Criação/edição restrita a
 * admin/gestor no controller; leitura aberta a todos os perfis internos que
 * criam contrato (vendedor precisa poder escolher um modelo).
 */
@Injectable()
export class ContractTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(user: AuthenticatedUser, dto: CreateContractTemplateDto) {
    return this.prisma.runWithTenant(user.tenantId, async (tx) =>
      tx.contractTemplate.create({
        data: {
          tenantId: user.tenantId,
          name: dto.name,
          category: dto.category,
          body: dto.body ? sanitizeContractBody(dto.body) : undefined,
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
      tx.contractTemplate.findMany({
        where: { tenantId: user.tenantId },
        orderBy: { name: 'asc' },
      }),
    );
  }

  private async findAccessible(user: AuthenticatedUser, id: string) {
    const template = await this.prisma.runWithTenant(
      user.tenantId,
      async (tx) =>
        tx.contractTemplate.findFirst({
          where: { id, tenantId: user.tenantId },
        }),
    );
    if (!template) {
      throw new NotFoundException('Modelo de contrato não encontrado');
    }
    return template;
  }

  async findOne(user: AuthenticatedUser, id: string) {
    return this.findAccessible(user, id);
  }

  async update(
    user: AuthenticatedUser,
    id: string,
    dto: UpdateContractTemplateDto,
  ) {
    await this.findAccessible(user, id);

    const { body, ...rest } = dto;

    return this.prisma.runWithTenant(user.tenantId, async (tx) =>
      tx.contractTemplate.update({
        where: { id },
        data: {
          ...rest,
          ...(body !== undefined ? { body: sanitizeContractBody(body) } : {}),
          updatedBy: user.sub,
        },
      }),
    );
  }

  /**
   * "Desativar" em vez de excluir — um modelo desativado some do seletor de
   * novos contratos, mas contratos antigos continuam apontando pra ele
   * (template_id) para o histórico permanecer reproduzível.
   */
  async toggle(user: AuthenticatedUser, id: string, isActive: boolean) {
    await this.findAccessible(user, id);

    return this.prisma.runWithTenant(user.tenantId, async (tx) =>
      tx.contractTemplate.update({
        where: { id },
        data: { isActive, updatedBy: user.sub },
      }),
    );
  }
}
