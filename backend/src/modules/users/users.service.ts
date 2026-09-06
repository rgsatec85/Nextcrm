import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lista os usuários do tenant do chamador. Note que o filtro por
   * tenant_id acontece duas vezes: aqui explicitamente (Camada 2) e de
   * novo, de forma independente, pela RLS dentro de runWithTenant
   * (Camada 3) — mesmo que este `where` fosse removido por engano, a
   * query não retornaria linhas de outro tenant.
   */
  async findAllForTenant(tenantId: string) {
    return this.prisma.runWithTenant(tenantId, (tx) =>
      tx.user.findMany({
        where: { tenantId },
        select: {
          id: true,
          name: true,
          email: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
          role: { select: { slug: true, name: true } },
        },
        orderBy: { createdAt: 'asc' },
      }),
    );
  }
}
