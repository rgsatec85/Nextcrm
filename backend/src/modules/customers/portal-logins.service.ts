import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaService } from '../../prisma/prisma.service';
import { PrismaAdminService } from '../../prisma/prisma-admin.service';
import { CustomersService } from './customers.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { CreatePortalLoginDto } from './dto/create-portal-login.dto';

const PORTAL_ROLE_SLUG = 'cliente_portal';

/**
 * Gestão de acesso ao Portal do Cliente (spec Fase 3): cria/lista/ativa-
 * desativa usuários `cliente_portal` vinculados a UM customer. Restrito a
 * admin/gestor (RolesGuard no controller) — o próprio cliente nunca cria o
 * próprio login por autoatendimento nesta fase (ver
 * docs/fase3-portal-atendimento.md > simplificações).
 */
@Injectable()
export class PortalLoginsService {
  constructor(
    private readonly prisma: PrismaService,
    // Só para o lookup de email único GLOBAL antes de criar — mesmo motivo
    // do AuthService/TenantsService: email é único entre tenants (spec §6),
    // e neste ponto ainda não sabemos se o email já existe em outro tenant.
    private readonly prismaAdmin: PrismaAdminService,
    private readonly customersService: CustomersService,
  ) {}

  async create(
    user: AuthenticatedUser,
    customerId: string,
    dto: CreatePortalLoginDto,
  ) {
    await this.customersService.assertAccessible(user, customerId);

    const existing = await this.prismaAdmin.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException(
        'Já existe um usuário cadastrado com este email',
      );
    }

    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
    });

    return this.prisma.runWithTenant(user.tenantId, async (tx) => {
      const role = await tx.role.findFirst({
        where: { tenantId: user.tenantId, slug: PORTAL_ROLE_SLUG },
      });
      if (!role) {
        // Não deveria acontecer — DEFAULT_ROLES cria este perfil para todo
        // tenant no signup — mas falha de forma explícita em vez de um erro
        // de FK obscuro caso um tenant antigo não tenha o perfil.
        throw new NotFoundException(
          `Perfil "${PORTAL_ROLE_SLUG}" não encontrado para este tenant`,
        );
      }

      return tx.user.create({
        data: {
          tenantId: user.tenantId,
          roleId: role.id,
          customerId,
          name: dto.name,
          email: dto.email,
          passwordHash,
          createdBy: user.sub,
          updatedBy: user.sub,
        },
        select: {
          id: true,
          name: true,
          email: true,
          isActive: true,
          createdAt: true,
        },
      });
    });
  }

  async findAll(user: AuthenticatedUser, customerId: string) {
    await this.customersService.assertAccessible(user, customerId);

    return this.prisma.runWithTenant(user.tenantId, async (tx) =>
      tx.user.findMany({
        where: { tenantId: user.tenantId, customerId },
        select: {
          id: true,
          name: true,
          email: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'asc' },
      }),
    );
  }

  async toggle(
    user: AuthenticatedUser,
    customerId: string,
    loginId: string,
    isActive: boolean,
  ) {
    await this.customersService.assertAccessible(user, customerId);

    return this.prisma.runWithTenant(user.tenantId, async (tx) => {
      const existing = await tx.user.findFirst({
        where: { id: loginId, tenantId: user.tenantId, customerId },
      });
      if (!existing) {
        throw new NotFoundException(
          'Login de portal não encontrado para este cliente',
        );
      }

      return tx.user.update({
        where: { id: loginId },
        data: { isActive, updatedBy: user.sub },
        select: { id: true, name: true, email: true, isActive: true },
      });
    });
  }
}
