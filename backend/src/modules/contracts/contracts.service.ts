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
import { ApplyContractTemplateDto } from './dto/apply-contract-template.dto';
import { sanitizeContractBody } from './sanitize-contract-body';
import { substituteTemplateFields } from '../quotes/template-fields';
import { ContractPdfService } from './contract-pdf.service';

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

// Campos dinâmicos disponíveis em modelos de contrato — mesmo mecanismo de
// proposal_templates (ver template-fields.ts), com um conjunto de chaves
// próprio ao contexto de contrato (vigência, em vez de validade de proposta).
function buildContractFields(data: {
  customerName: string;
  value: number;
  startDate: Date;
  endDate: Date;
  ownerName: string | null;
}): Record<string, string> {
  return {
    'cliente.nome': data.customerName,
    valor: `R$ ${data.value.toFixed(2)}`,
    vigencia_inicio: data.startDate.toLocaleDateString('pt-BR'),
    vigencia_fim: data.endDate.toLocaleDateString('pt-BR'),
    vendedor: data.ownerName ?? '—',
    data: new Date().toLocaleDateString('pt-BR'),
  };
}

@Injectable()
export class ContractsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly customersService: CustomersService,
    private readonly contractPdfService: ContractPdfService,
  ) {}

  async create(user: AuthenticatedUser, dto: CreateContractDto) {
    await this.customersService.assertAccessible(user, dto.customerId);

    if (new Date(dto.endDate) <= new Date(dto.startDate)) {
      throw new BadRequestException('endDate precisa ser depois de startDate');
    }

    return this.prisma.runWithTenant(user.tenantId, async (tx) => {
      let body = dto.body ? sanitizeContractBody(dto.body) : undefined;

      // Modelo de origem: o corpo é copiado para dentro do contrato agora
      // (com os campos dinâmicos já substituídos) e passa a viver de forma
      // independente do modelo — editar o modelo depois não muda contratos
      // já criados a partir dele (diferente de Quote/ProposalTemplate).
      if (dto.templateId) {
        const template = await tx.contractTemplate.findFirst({
          where: { id: dto.templateId, tenantId: user.tenantId },
        });
        if (!template) {
          throw new NotFoundException('Modelo de contrato não encontrado');
        }
        if (template.body) {
          const customer = await tx.customer.findFirst({
            where: { id: dto.customerId, tenantId: user.tenantId },
            select: { name: true, owner: { select: { name: true } } },
          });
          const fields = buildContractFields({
            customerName: customer?.name ?? '—',
            value: dto.value ?? 0,
            startDate: new Date(dto.startDate),
            endDate: new Date(dto.endDate),
            ownerName: customer?.owner?.name ?? null,
          });
          body = substituteTemplateFields(template.body, fields);
        }
      }

      return tx.contract.create({
        data: {
          tenantId: user.tenantId,
          customerId: dto.customerId,
          title: dto.title,
          value: dto.value ?? 0,
          startDate: new Date(dto.startDate),
          endDate: new Date(dto.endDate),
          renewalPeriodMonths: dto.renewalPeriodMonths,
          notes: dto.notes,
          body,
          templateId: dto.templateId,
          createdBy: user.sub,
          updatedBy: user.sub,
        },
      });
    });
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
    const contract = await this.findAccessible(user, id);

    // Trava o corpo do contrato fora do estado 'rascunho' — mesmo padrão de
    // OrdersService.update travando itens quando já existe fatura: uma vez
    // ativado, o texto do contrato deixa de ser livremente editável (só via
    // um fluxo próprio, se algum dia existir; por ora, reverter para
    // rascunho não é suportado).
    if (dto.body !== undefined && contract.status !== 'rascunho') {
      throw new ConflictException(
        'O corpo do contrato só pode ser editado enquanto ele está em rascunho',
      );
    }

    const { startDate, endDate, body, ...rest } = dto;

    return this.prisma.runWithTenant(user.tenantId, async (tx) =>
      tx.contract.update({
        where: { id },
        data: {
          ...rest,
          ...(startDate ? { startDate: new Date(startDate) } : {}),
          ...(endDate ? { endDate: new Date(endDate) } : {}),
          ...(body !== undefined ? { body: sanitizeContractBody(body) } : {}),
          updatedBy: user.sub,
        },
      }),
    );
  }

  /** Ativa o contrato (rascunho -> ativo), travando o corpo a partir daqui. */
  async activate(user: AuthenticatedUser, id: string) {
    const contract = await this.findAccessible(user, id);

    if (contract.status !== 'rascunho') {
      throw new ConflictException(
        `Não é possível ativar um contrato em status "${contract.status}" (esperado "rascunho")`,
      );
    }

    return this.prisma.runWithTenant(user.tenantId, async (tx) =>
      tx.contract.update({
        where: { id },
        data: { status: 'ativo', updatedBy: user.sub },
      }),
    );
  }

  /**
   * Aplica um modelo a um contrato já existente (ainda em rascunho): copia
   * o corpo do modelo, com os campos dinâmicos já substituídos, para dentro
   * do contrato. A partir daí o corpo vive independente do modelo — editar
   * o modelo depois não muda este contrato.
   */
  async applyTemplate(
    user: AuthenticatedUser,
    id: string,
    dto: ApplyContractTemplateDto,
  ) {
    const contract = await this.findAccessible(user, id);

    if (contract.status !== 'rascunho') {
      throw new ConflictException(
        'Só é possível aplicar um modelo a um contrato em rascunho',
      );
    }

    return this.prisma.runWithTenant(user.tenantId, async (tx) => {
      const template = await tx.contractTemplate.findFirst({
        where: { id: dto.templateId, tenantId: user.tenantId },
      });
      if (!template) {
        throw new NotFoundException('Modelo de contrato não encontrado');
      }

      const customer = await tx.customer.findFirst({
        where: { id: contract.customerId, tenantId: user.tenantId },
        select: { name: true, owner: { select: { name: true } } },
      });
      const fields = buildContractFields({
        customerName: customer?.name ?? contract.customer.name,
        value: Number(contract.value),
        startDate: contract.startDate,
        endDate: contract.endDate,
        ownerName: customer?.owner?.name ?? null,
      });
      const body = template.body
        ? substituteTemplateFields(template.body, fields)
        : null;

      return tx.contract.update({
        where: { id },
        data: { body, templateId: template.id, updatedBy: user.sub },
      });
    });
  }

  /** Gera o PDF do contrato (Fase 9, RF013) — ver ContractPdfService. */
  async pdf(user: AuthenticatedUser, id: string): Promise<Buffer> {
    const contract = await this.findAccessible(user, id);

    return this.contractPdfService.generate({
      title: contract.title,
      status: contract.status,
      value: Number(contract.value),
      startDate: contract.startDate,
      endDate: contract.endDate,
      customerName: contract.customer.name,
      body: contract.body,
    });
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
