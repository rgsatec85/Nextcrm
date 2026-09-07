import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/**
 * RBAC básico (spec §19 — modelo híbrido RBAC + ABAC). Marca uma rota como
 * exigindo um dos perfis informados. Ex.: `@Roles('admin')`.
 * O componente ABAC (regras por atributo, ex.: "vendedor só vê seus
 * próprios clientes") fica a cargo de cada service, filtrando por
 * `createdBy`/dono do registro — entra nas Fases 1+ junto com as entidades
 * de negócio.
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
