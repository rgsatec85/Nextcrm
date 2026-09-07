import { ForbiddenException } from '@nestjs/common';
import { AuthenticatedUser } from '../decorators/current-user.decorator';

/**
 * ABAC (spec §19) para os módulos de CRM Comercial: o perfil "vendedor" só
 * enxerga registros dos quais é dono (`ownerId`) — os demais perfis
 * (admin, gestor, financeiro) enxergam todo o tenant. "Gestor" hoje é
 * tratado como "vê tudo" porque ainda não existe conceito de
 * equipe/departamento no modelo de dados (ver docs/architecture.md).
 *
 * A Camada 3 (RLS) continua garantindo o isolamento por TENANT; isto aqui é
 * uma camada adicional, só na aplicação, para o isolamento por DONO dentro
 * do mesmo tenant.
 */
const OWNER_SCOPED_ROLES = ['vendedor'];

export function ownerScopeWhere(user: AuthenticatedUser): { ownerId?: string } {
  if (OWNER_SCOPED_ROLES.includes(user.roleSlug)) {
    return { ownerId: user.sub };
  }
  return {};
}

/** Garante que um vendedor não acesse por ID um registro que não é seu. */
export function assertOwnership(
  user: AuthenticatedUser,
  record: { ownerId?: string | null } | null,
): void {
  if (!record) return;
  if (
    OWNER_SCOPED_ROLES.includes(user.roleSlug) &&
    record.ownerId !== user.sub
  ) {
    throw new ForbiddenException('Você não tem acesso a este registro');
  }
}

/** Resolve o owner efetivo na criação: vendedor sempre cria para si mesmo. */
export function resolveOwnerId(
  user: AuthenticatedUser,
  requestedOwnerId: string | undefined,
): string {
  if (OWNER_SCOPED_ROLES.includes(user.roleSlug)) {
    return user.sub;
  }
  return requestedOwnerId ?? user.sub;
}
