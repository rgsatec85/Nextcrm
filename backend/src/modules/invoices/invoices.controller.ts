import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
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
import { InvoicesService } from './invoices.service';
import { GenerateInvoicesDto } from './dto/generate-invoices.dto';
import { PayInvoiceDto } from './dto/pay-invoice.dto';

// Geração de parcelas fica pendurada na rota do pedido (RESTful, mesmo
// padrão de customers/:customerId/contacts) — só quem mexe com Pedido gera
// as faturas dele.
@Controller('orders/:orderId/invoices')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'gestor', 'financeiro')
@UseInterceptors(AuditLogInterceptor)
export class OrderInvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Post()
  generate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: GenerateInvoicesDto,
  ) {
    return this.invoicesService.generateForOrder(user, orderId, dto);
  }
}

// Vendedor pode CONSULTAR as faturas dos seus clientes (parte do Cliente
// 360°/spec §10), mas não registra pagamento nem cancela — isso é operação
// financeira, restrita a admin/gestor/financeiro (override por rota abaixo).
@Controller('invoices')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'gestor', 'vendedor', 'financeiro')
@UseInterceptors(AuditLogInterceptor)
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get()
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('customerId') customerId?: string,
    @Query('orderId') orderId?: string,
    @Query('status') status?: string,
    @Query('overdueOnly') overdueOnly?: string,
  ) {
    return this.invoicesService.findAll(user, {
      customerId,
      orderId,
      status,
      overdueOnly: overdueOnly === 'true',
    });
  }

  @Get(':id')
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.invoicesService.findOne(user, id);
  }

  @Patch(':id/pay')
  @Roles('admin', 'gestor', 'financeiro')
  pay(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PayInvoiceDto,
  ) {
    return this.invoicesService.registerPayment(user, id, dto);
  }

  @Patch(':id/cancel')
  @Roles('admin', 'gestor', 'financeiro')
  cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.invoicesService.cancel(user, id);
  }
}
