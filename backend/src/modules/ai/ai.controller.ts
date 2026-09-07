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
import { AiService } from './ai.service';
import { AskQuestionDto } from './dto/ask-question.dto';

// cliente_portal nunca acessa /ai/* — o assistente e as previsões são
// ferramentas internas de trabalho (spec Fase 4), não algo exposto ao
// cliente final. `vendedor` acessa todas as rotas: cada método aplica o
// mesmo ABAC (dono do cliente/oportunidade) do restante do CRM Comercial —
// não há aqui um bloqueio de RBAC extra além do que já existe para os
// dados subjacentes (finance/opportunities/invoices).
@Controller('ai')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'gestor', 'vendedor', 'financeiro')
@UseInterceptors(AuditLogInterceptor)
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('ask')
  ask(@CurrentUser() user: AuthenticatedUser, @Body() dto: AskQuestionDto) {
    return this.aiService.ask(user, dto);
  }

  @Get('customers/:id/summary')
  customerSummary(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.aiService.customerSummary(user, id);
  }

  @Get('customers/:id/score-ia')
  scoreIa(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.aiService.scoreIa(user, id);
  }

  @Get('opportunities/:id/next-action')
  nextAction(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.aiService.nextAction(user, id);
  }

  @Post('opportunities/:id/draft-email')
  draftEmail(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.aiService.draftEmail(user, id);
  }

  // Mesmo espírito do relatório de comissões (Fase 2): vendedor acessa,
  // mas o ABAC de InvoicesService.findAll já restringe às faturas de
  // clientes que ele possui — não é uma visão de empresa inteira como o
  // dashboard financeiro (esse sim admin/gestor/financeiro apenas).
  @Get('finance/collections-suggestions')
  collectionsSuggestions(@CurrentUser() user: AuthenticatedUser) {
    return this.aiService.collectionsSuggestions(user);
  }

  @Get('predictions/pipeline')
  pipelineForecast(@CurrentUser() user: AuthenticatedUser) {
    return this.aiService.pipelineForecast(user);
  }
}
