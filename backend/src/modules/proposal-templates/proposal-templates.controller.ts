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
import { ProposalTemplatesService } from './proposal-templates.service';
import { CreateProposalTemplateDto } from './dto/create-proposal-template.dto';
import { UpdateProposalTemplateDto } from './dto/update-proposal-template.dto';
import { ToggleProposalTemplateDto } from './dto/toggle-proposal-template.dto';

// Leitura aberta a todos os perfis internos (vendedor precisa escolher um
// modelo ao criar proposta); autoria restrita a admin/gestor — mesmo padrão
// de KnowledgeController.
@Controller('proposal-templates')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'gestor', 'vendedor', 'financeiro')
@UseInterceptors(AuditLogInterceptor)
export class ProposalTemplatesController {
  constructor(
    private readonly proposalTemplatesService: ProposalTemplatesService,
  ) {}

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.proposalTemplatesService.findAll(user);
  }

  @Get(':id')
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.proposalTemplatesService.findOne(user, id);
  }

  @Post()
  @Roles('admin', 'gestor')
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateProposalTemplateDto,
  ) {
    return this.proposalTemplatesService.create(user, dto);
  }

  @Patch(':id')
  @Roles('admin', 'gestor')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProposalTemplateDto,
  ) {
    return this.proposalTemplatesService.update(user, id, dto);
  }

  @Patch(':id/toggle')
  @Roles('admin', 'gestor')
  toggle(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ToggleProposalTemplateDto,
  ) {
    return this.proposalTemplatesService.toggle(user, id, dto.isActive);
  }
}
