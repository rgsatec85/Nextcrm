import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaAdminService } from '../../prisma/prisma-admin.service';
import { PrismaService } from '../../prisma/prisma.service';
import { DEFAULT_ROLES, ADMIN_ROLE_SLUG } from './roles.constants';

export interface NewTenantAdmin {
  name: string;
  email: string;
  passwordHash: string;
}

@Injectable()
export class TenantsService {
  constructor(
    private readonly prismaAdmin: PrismaAdminService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Provisiona um novo tenant (cadastro self-service — spec §6): cria a
   * empresa, os perfis padrão e o usuário administrador em uma única
   * transação. Usa o client com BYPASSRLS porque, neste momento, ainda não
   * existe uma sessão de tenant para a RLS validar contra.
   */
  async createTenantWithAdmin(
    companyName: string,
    cnpj: string,
    admin: NewTenantAdmin,
  ) {
    const existing = await this.prismaAdmin.company.findUnique({
      where: { cnpj },
    });
    if (existing) {
      throw new ConflictException(
        'Já existe uma empresa cadastrada com este CNPJ',
      );
    }

    const existingUser = await this.prismaAdmin.user.findUnique({
      where: { email: admin.email },
    });
    if (existingUser) {
      throw new ConflictException(
        'Já existe um usuário cadastrado com este email',
      );
    }

    return this.prismaAdmin.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const company = await tx.company.create({
          data: { name: companyName, cnpj },
        });

        const roles = await Promise.all(
          DEFAULT_ROLES.map((role) =>
            tx.role.create({
              data: {
                tenantId: company.id,
                name: role.name,
                slug: role.slug,
                permissions: role.permissions,
              },
            }),
          ),
        );

        const adminRole = roles.find((r) => r.slug === ADMIN_ROLE_SLUG)!;

        const adminUser = await tx.user.create({
          data: {
            tenantId: company.id,
            roleId: adminRole.id,
            name: admin.name,
            email: admin.email,
            passwordHash: admin.passwordHash,
          },
        });

        await tx.auditLog.create({
          data: {
            tenantId: company.id,
            userId: adminUser.id,
            event: 'tenant.created',
            entity: 'companies',
            entityId: company.id,
          },
        });

        return { company, adminUser, adminRole };
      },
    );
  }

  /** Centro Administrativo do Tenant (spec §8) — dados básicos da própria empresa. */
  async findMine(tenantId: string) {
    const company = await this.prisma.runWithTenant(tenantId, (tx) =>
      tx.company.findUnique({ where: { id: tenantId } }),
    );
    if (!company) {
      throw new NotFoundException('Empresa não encontrada');
    }
    return company;
  }
}
