import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';

// Marcas de acento combinantes (faixa Unicode U+0300-U+036F), deixadas
// isoladas por normalize('NFD') — removê-las é o que transforma "ç"/"ã" em
// "c"/"a". Escrito com \u escape (em vez do caractere literal) para não
// depender de como o editor/terminal trata combining marks no source file.
const DIACRITICS_REGEX = new RegExp('[\\u0300-\\u036f]', 'g');

function slugify(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(DIACRITICS_REGEX, '') // remove marcas de acento (pós-NFD)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-+|-+$)/g, '');
}

/**
 * Base de conhecimento (spec Fase 3 — "Atendimento interno"). Autoria
 * restrita a admin/gestor (RolesGuard no controller); leitura aberta a
 * todos os perfis internos. O Portal do Cliente NUNCA chama este service
 * diretamente por HTTP — PortalController delega para
 * KnowledgeService.findPublished (ver docs/security-multitenancy.md,
 * "separação rígida do portal").
 */
@Injectable()
export class KnowledgeService {
  constructor(private readonly prisma: PrismaService) {}

  async create(user: AuthenticatedUser, dto: CreateArticleDto) {
    const slug = dto.slug ? slugify(dto.slug) : slugify(dto.title);

    const existing = await this.prisma.runWithTenant(
      user.tenantId,
      async (tx) =>
        tx.knowledgeArticle.findFirst({
          where: { tenantId: user.tenantId, slug },
        }),
    );
    if (existing) {
      throw new ConflictException(`Já existe um artigo com o slug "${slug}"`);
    }

    return this.prisma.runWithTenant(user.tenantId, async (tx) =>
      tx.knowledgeArticle.create({
        data: {
          tenantId: user.tenantId,
          title: dto.title,
          slug,
          body: dto.body,
          category: dto.category,
          isPublished: dto.isPublished ?? true,
          createdBy: user.sub,
          updatedBy: user.sub,
        },
      }),
    );
  }

  /** Todos os perfis internos veem tudo, publicado ou não (é o painel de edição). */
  async findAll(user: AuthenticatedUser) {
    return this.prisma.runWithTenant(user.tenantId, async (tx) =>
      tx.knowledgeArticle.findMany({
        where: { tenantId: user.tenantId },
        orderBy: { createdAt: 'desc' },
      }),
    );
  }

  /** Usado pelo PortalController — só artigos publicados, sem noção de ABAC/dono. */
  async findPublished(tenantId: string) {
    return this.prisma.runWithTenant(tenantId, async (tx) =>
      tx.knowledgeArticle.findMany({
        where: { tenantId, isPublished: true },
        orderBy: { createdAt: 'desc' },
      }),
    );
  }

  private async findAccessible(user: AuthenticatedUser, id: string) {
    const article = await this.prisma.runWithTenant(user.tenantId, async (tx) =>
      tx.knowledgeArticle.findFirst({ where: { id, tenantId: user.tenantId } }),
    );
    if (!article) {
      throw new NotFoundException('Artigo não encontrado');
    }
    return article;
  }

  async findOne(user: AuthenticatedUser, id: string) {
    return this.findAccessible(user, id);
  }

  async update(user: AuthenticatedUser, id: string, dto: UpdateArticleDto) {
    await this.findAccessible(user, id);

    const slug = dto.slug ? slugify(dto.slug) : undefined;

    return this.prisma.runWithTenant(user.tenantId, async (tx) =>
      tx.knowledgeArticle.update({
        where: { id },
        data: {
          ...dto,
          ...(slug ? { slug } : {}),
          updatedBy: user.sub,
        },
      }),
    );
  }

  async remove(user: AuthenticatedUser, id: string) {
    await this.findAccessible(user, id);
    await this.prisma.runWithTenant(user.tenantId, async (tx) =>
      tx.knowledgeArticle.delete({ where: { id } }),
    );
    return { id };
  }
}
