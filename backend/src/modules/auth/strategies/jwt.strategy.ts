import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthenticatedUser } from '../../../common/decorators/current-user.decorator';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET'),
    });
  }

  // O retorno vira `request.user` — é daqui que tenantId chega em todo o
  // resto da aplicação (Camada 1 do isolamento multi-tenant). Repassa o
  // payload inteiro, então `customerId` (Fase 3 — presente só para
  // cliente_portal) chega em request.user sem nenhum código extra aqui.
  validate(payload: AuthenticatedUser): AuthenticatedUser {
    return payload;
  }
}
