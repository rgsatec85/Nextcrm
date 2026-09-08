import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  StreamableFile,
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
import { ContractsService } from './contracts.service';
import { CreateContractDto } from './dto/create-contract.dto';
import { UpdateContractDto } from './dto/update-contract.dto';
import { RenewContractDto } from './dto/renew-contract.dto';
import { ApplyContractTemplateDto } from './dto/apply-contract-template.dto';

@Controller('contracts')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'gestor', 'vendedor', 'financeiro')
@UseInterceptors(AuditLogInterceptor)
export class ContractsController {
  constructor(private readonly contractsService: ContractsService) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateContractDto,
  ) {
    return this.contractsService.create(user, dto);
  }

  @Get()
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('customerId') customerId?: string,
  ) {
    return this.contractsService.findAll(user, customerId);
  }

  @Get(':id')
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.contractsService.findOne(user, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateContractDto,
  ) {
    return this.contractsService.update(user, id, dto);
  }

  @Patch(':id/renew')
  renew(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RenewContractDto,
  ) {
    return this.contractsService.renew(user, id, dto);
  }

  @Patch(':id/activate')
  activate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.contractsService.activate(user, id);
  }

  @Patch(':id/apply-template')
  applyTemplate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApplyContractTemplateDto,
  ) {
    return this.contractsService.applyTemplate(user, id, dto);
  }

  @Get(':id/pdf')
  @Header('Content-Type', 'application/pdf')
  @Header('Content-Disposition', 'inline; filename="contrato.pdf"')
  async pdf(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const buffer = await this.contractsService.pdf(user, id);
    return new StreamableFile(buffer);
  }
}
