import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';

function makeContext(roleSlug: string): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user: { roleSlug } }),
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  it('permite acesso quando a rota não exige nenhum perfil', () => {
    const reflector = {
      getAllAndOverride: () => undefined,
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(makeContext('vendedor'))).toBe(true);
  });

  it('permite acesso quando o perfil do usuário está na lista exigida', () => {
    const reflector = {
      getAllAndOverride: () => ['admin', 'financeiro'],
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(makeContext('financeiro'))).toBe(true);
  });

  it('bloqueia acesso quando o perfil do usuário não está na lista exigida', () => {
    const reflector = {
      getAllAndOverride: () => ['admin'],
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(makeContext('vendedor'))).toBe(false);
  });
});
