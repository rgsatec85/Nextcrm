import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
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
import { PortalLoginsService } from './portal-logins.service';
import { CreatePortalLoginDto } from './dto/create-portal-login.dto';
import { TogglePortalLoginDto } from './dto/toggle-portal-login.dto';

// Gestão de acesso ao Portal do Cliente — restrita a admin/gestor, igual ao
// resto do Centro Administrativo do Tenant (spec §8). Pendurada na rota do
// cliente (RESTful, mesmo padrão de customers/:customerId/contacts).
@Controller('customers/:customerId/portal-logins')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'gestor')
@UseInterceptors(AuditLogInterceptor)
export class PortalLoginsController {
  constructor(private readonly portalLoginsService: PortalLoginsService) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Body() dto: CreatePortalLoginDto,
  ) {
    return this.portalLoginsService.create(user, customerId, dto);
  }

  @Get()
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Param('customerId', ParseUUIDPipe) customerId: string,
  ) {
    return this.portalLoginsService.findAll(user, customerId);
  }

  @Patch(':loginId/toggle')
  toggle(
    @CurrentUser() user: AuthenticatedUser,
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Param('loginId', ParseUUIDPipe) loginId: string,
    @Body() dto: TogglePortalLoginDto,
  ) {
    return this.portalLoginsService.toggle(
      user,
      customerId,
      loginId,
      dto.isActive,
    );
  }
}
