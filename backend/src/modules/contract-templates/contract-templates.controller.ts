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
import { ContractTemplatesService } from './contract-templates.service';
import { CreateContractTemplateDto } from './dto/create-contract-template.dto';
import { UpdateContractTemplateDto } from './dto/update-contract-template.dto';
import { ToggleContractTemplateDto } from './dto/toggle-contract-template.dto';

// Leitura aberta a todos os perfis internos (vendedor precisa escolher um
// modelo ao criar contrato); autoria restrita a admin/gestor — mesmo padrão
// de ProposalTemplatesController.
@Controller('contract-templates')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'gestor', 'vendedor', 'financeiro')
@UseInterceptors(AuditLogInterceptor)
export class ContractTemplatesController {
  constructor(
    private readonly contractTemplatesService: ContractTemplatesService,
  ) {}

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.contractTemplatesService.findAll(user);
  }

  @Get(':id')
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.contractTemplatesService.findOne(user, id);
  }

  @Post()
  @Roles('admin', 'gestor')
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateContractTemplateDto,
  ) {
    return this.contractTemplatesService.create(user, dto);
  }

  @Patch(':id')
  @Roles('admin', 'gestor')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateContractTemplateDto,
  ) {
    return this.contractTemplatesService.update(user, id, dto);
  }

  @Patch(':id/toggle')
  @Roles('admin', 'gestor')
  toggle(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ToggleContractTemplateDto,
  ) {
    return this.contractTemplatesService.toggle(user, id, dto.isActive);
  }
}
