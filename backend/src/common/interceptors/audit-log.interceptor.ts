import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../decorators/current-user.decorator';

/**
 * Registra em audit_logs toda mutação (POST/PATCH/PUT/DELETE) feita por um
 * usuário autenticado, com IP, user agent e o resultado da operação (spec
 * §20). Aplicado globalmente nos controllers que usam @UseInterceptors.
 *
 * Best-effort: uma falha ao gravar o log de auditoria nunca deve derrubar a
 * request original — apenas loga o erro.
 */
@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<{
      method: string;
      ip: string;
      headers: Record<string, string>;
      user?: AuthenticatedUser;
      route?: { path: string };
    }>();

    const mutating = ['POST', 'PATCH', 'PUT', 'DELETE'].includes(
      request.method,
    );

    return next.handle().pipe(
      tap((result) => {
        if (!mutating || !request.user) return;

        const { tenantId, sub: userId } = request.user;
        this.prisma
          .runWithTenant(tenantId, (tx) =>
            tx.auditLog.create({
              data: {
                tenantId,
                userId,
                event: request.method.toLowerCase(),
                entity: request.route?.path,
                ip: request.ip,
                userAgent: request.headers['user-agent'],
                after: result ? JSON.parse(JSON.stringify(result)) : undefined,
              },
            }),
          )
          .catch((err) => {
            // eslint-disable-next-line no-console
            console.error('Falha ao gravar audit log', err);
          });
      }),
    );
  }
}
