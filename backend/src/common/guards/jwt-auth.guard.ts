import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Protege rotas exigindo um JWT válido. Depois deste guard passar,
 * `request.user` contém { sub, tenantId, email, roleSlug } — ver
 * JwtStrategy.validate(). Camada 1 do isolamento multi-tenant (spec §18):
 * é daqui que todo `tenantId` usado no restante da request se origina.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
