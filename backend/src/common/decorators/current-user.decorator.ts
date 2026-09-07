import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface AuthenticatedUser {
  sub: string; // user id
  tenantId: string;
  email: string;
  roleSlug: string;
  // Presente somente quando roleSlug === 'cliente_portal' (Fase 3 — Portal
  // do Cliente). PortalService usa isto como "hard lock": todo acesso do
  // portal é filtrado por este customerId, nunca opcionalmente como o ABAC
  // de vendedor (ver docs/security-multitenancy.md).
  customerId?: string;
}

/**
 * Extrai o usuário autenticado (payload do JWT) do request.
 * Uso: `findAll(@CurrentUser() user: AuthenticatedUser)`
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
