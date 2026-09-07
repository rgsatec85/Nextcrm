import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
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
import { KnowledgeService } from './knowledge.service';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';

// cliente_portal nunca acessa /knowledge diretamente — usa GET /portal/knowledge
// (PortalController delega para KnowledgeService.findPublished). Manter essa
// separação explícita evita ter que ensinar o RolesGuard aqui a diferenciar
// "leitura completa" (interno) de "só publicados" (portal).
@Controller('knowledge')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'gestor', 'vendedor', 'financeiro')
@UseInterceptors(AuditLogInterceptor)
export class KnowledgeController {
  constructor(private readonly knowledgeService: KnowledgeService) {}

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.knowledgeService.findAll(user);
  }

  // Cache headers (Fase 5): leitura de UM artigo por id muda pouco no
  // curto prazo mesmo no painel interno; `private` + janela curta (30s)
  // para não atrasar demais a percepção de uma edição recente por quem
  // está editando. `findAll` (lista, inclui rascunhos) e os endpoints de
  // escrita abaixo NÃO recebem cache — são a própria superfície de edição.
  @Get(':id')
  @Header('Cache-Control', 'private, max-age=30')
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.knowledgeService.findOne(user, id);
  }

  @Post()
  @Roles('admin', 'gestor')
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateArticleDto,
  ) {
    return this.knowledgeService.create(user, dto);
  }

  @Patch(':id')
  @Roles('admin', 'gestor')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateArticleDto,
  ) {
    return this.knowledgeService.update(user, id, dto);
  }

  @Delete(':id')
  @Roles('admin', 'gestor')
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.knowledgeService.remove(user, id);
  }
}
