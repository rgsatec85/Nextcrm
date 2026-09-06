import { ForbiddenException } from '@nestjs/common';
import { assertOwnership, ownerScopeWhere, resolveOwnerId } from './ownership';
import { AuthenticatedUser } from '../decorators/current-user.decorator';

function user(roleSlug: string, sub = 'user-1'): AuthenticatedUser {
  return { sub, tenantId: 'tenant-1', email: 'x@x.com', roleSlug };
}

describe('ownerScopeWhere', () => {
  it('restringe vendedor ao próprio ownerId', () => {
    expect(ownerScopeWhere(user('vendedor', 'user-1'))).toEqual({
      ownerId: 'user-1',
    });
  });

  it('não restringe admin, gestor ou financeiro', () => {
    expect(ownerScopeWhere(user('admin'))).toEqual({});
    expect(ownerScopeWhere(user('gestor'))).toEqual({});
    expect(ownerScopeWhere(user('financeiro'))).toEqual({});
  });
});

describe('assertOwnership', () => {
  it('permite vendedor acessar registro próprio', () => {
    expect(() =>
      assertOwnership(user('vendedor', 'user-1'), { ownerId: 'user-1' }),
    ).not.toThrow();
  });

  it('bloqueia vendedor acessando registro de outro dono', () => {
    expect(() =>
      assertOwnership(user('vendedor', 'user-1'), { ownerId: 'user-2' }),
    ).toThrow(ForbiddenException);
  });

  it('não bloqueia admin mesmo sem ser o dono', () => {
    expect(() =>
      assertOwnership(user('admin', 'user-1'), { ownerId: 'user-2' }),
    ).not.toThrow();
  });

  it('não faz nada quando o registro é null (404 é tratado antes)', () => {
    expect(() => assertOwnership(user('vendedor'), null)).not.toThrow();
  });
});

describe('resolveOwnerId', () => {
  it('vendedor sempre vira dono de algo que cria, ignorando ownerId pedido', () => {
    expect(resolveOwnerId(user('vendedor', 'user-1'), 'user-2')).toBe('user-1');
  });

  it('admin pode atribuir a outro usuário', () => {
    expect(resolveOwnerId(user('admin', 'user-1'), 'user-2')).toBe('user-2');
  });

  it('sem ownerId pedido, cai no próprio usuário', () => {
    expect(resolveOwnerId(user('admin', 'user-1'), undefined)).toBe('user-1');
  });
});
