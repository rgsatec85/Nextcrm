import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuditLogInterceptor } from '../../common/interceptors/audit-log.interceptor';
import {
  CurrentUser,
  AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { PortalService } from './portal.service';
import { CreatePortalTicketDto } from './dto/create-portal-ticket.dto';
import { CreateTicketCommentDto } from '../tickets/dto/create-ticket-comment.dto';

// Único perfil admitido aqui é cliente_portal — todo o resto (admin, gestor,
// vendedor, financeiro) usa as rotas internas (/customers, /tickets,
// /knowledge, etc). Isolamento reforçado dentro do PortalService (hard
// lock por user.customerId), não só pelo RBAC desta guarda.
@Controller('portal')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('cliente_portal')
@UseInterceptors(AuditLogInterceptor)
export class PortalController {
  constructor(private readonly portalService: PortalService) {}

  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.portalService.me(user);
  }

  @Get('orders')
  orders(@CurrentUser() user: AuthenticatedUser) {
    return this.portalService.orders(user);
  }

  @Get('invoices')
  invoices(@CurrentUser() user: AuthenticatedUser) {
    return this.portalService.invoices(user);
  }

  @Get('contracts')
  contracts(@CurrentUser() user: AuthenticatedUser) {
    return this.portalService.contracts(user);
  }

  @Get('tickets')
  tickets(@CurrentUser() user: AuthenticatedUser) {
    return this.portalService.tickets(user);
  }

  @Post('tickets')
  createTicket(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePortalTicketDto,
  ) {
    return this.portalService.createTicket(user, dto);
  }

  @Post('tickets/:id/comments')
  addComment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateTicketCommentDto,
  ) {
    return this.portalService.addComment(user, id, dto);
  }

  @Get('knowledge')
  knowledge(@CurrentUser() user: AuthenticatedUser) {
    return this.portalService.knowledge(user);
  }
}
