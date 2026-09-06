import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { PrismaAdminService } from '../../prisma/prisma-admin.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { signWebhookPayload } from './hmac';
import { CreateWebhookDto, WEBHOOK_EVENTS } from './dto/create-webhook.dto';

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

type WebhookTarget = { id: string; url: string; secret: string };

type ExpiringContractRow = {
  id: string;
  tenantId: string;
  title: string;
  endDate: Date;
  customerId: string;
};

/**
 * Nunca retorna o `secret` em texto puro depois da criação (spec Fase 3) —
 * findAll/toggle/remove sempre trabalham com `select` explícito sem o
 * campo, ou removem-no do objeto antes de devolver.
 */
function omitSecret<T extends { secret?: string }>(row: T): Omit<T, 'secret'> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- descartado de propósito
  const { secret: _secret, ...rest } = row;
  return rest;
}

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    private readonly prisma: PrismaService,
    // Justificativa do 3º uso sancionado de PrismaAdminService (BYPASSRLS),
    // documentado em docs/architecture.md: o cron abaixo roda sem contexto
    // de request HTTP, então não existe um tenantId de sessão para
    // runWithTenant setar via SET LOCAL antes de escanear contratos de
    // TODOS os tenants. Nunca serve esta leitura como resposta de request —
    // só usa o resultado para decidir para qual tenant despachar, e o
    // dispatch() em si sempre volta a passar pelo runWithTenant/RLS normal.
    private readonly prismaAdmin: PrismaAdminService,
  ) {}

  async create(user: AuthenticatedUser, dto: CreateWebhookDto) {
    const secret = randomBytes(32).toString('hex');

    const created = await this.prisma.runWithTenant(user.tenantId, async (tx) =>
      tx.webhookSubscription.create({
        data: {
          tenantId: user.tenantId,
          url: dto.url,
          secret,
          events: dto.events,
          isActive: dto.isActive ?? true,
          createdBy: user.sub,
          updatedBy: user.sub,
        },
      }),
    );

    // Única vez em que o secret é devolvido: é a chance do admin copiar e
    // configurar o endpoint remoto. Depois disso, nunca mais em texto puro.
    return created;
  }

  async findAll(user: AuthenticatedUser) {
    return this.prisma.runWithTenant(user.tenantId, async (tx) =>
      tx.webhookSubscription.findMany({
        where: { tenantId: user.tenantId },
        select: {
          id: true,
          url: true,
          events: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
    );
  }

  private async findAccessible(user: AuthenticatedUser, id: string) {
    const row = await this.prisma.runWithTenant(user.tenantId, async (tx) =>
      tx.webhookSubscription.findFirst({
        where: { id, tenantId: user.tenantId },
      }),
    );
    if (!row) {
      throw new NotFoundException('Webhook não encontrado');
    }
    return row;
  }

  async toggle(user: AuthenticatedUser, id: string, isActive: boolean) {
    await this.findAccessible(user, id);

    const updated = await this.prisma.runWithTenant(user.tenantId, async (tx) =>
      tx.webhookSubscription.update({
        where: { id },
        data: { isActive, updatedBy: user.sub },
      }),
    );
    return omitSecret(updated);
  }

  async remove(user: AuthenticatedUser, id: string) {
    await this.findAccessible(user, id);
    await this.prisma.runWithTenant(user.tenantId, async (tx) =>
      tx.webhookSubscription.delete({ where: { id } }),
    );
    return { id };
  }

  /**
   * Dispara (best-effort, fire-and-forget) o evento para todas as
   * assinaturas ativas do tenant que escutam `event`. Mesma filosofia de
   * confiabilidade do AuditLogInterceptor: uma falha aqui (endpoint fora do
   * ar, timeout, DNS) NUNCA deve derrubar o fluxo de negócio que chamou —
   * só loga. Não existe fila de retry nem histórico de entregas persistido
   * nesta fase (ver docs/fase3-portal-atendimento.md > simplificações).
   */
  async dispatch(
    tenantId: string,
    event: WebhookEvent,
    payload: Record<string, unknown>,
  ): Promise<void> {
    try {
      const subs: WebhookTarget[] = await this.prisma.runWithTenant(
        tenantId,
        async (tx) =>
          tx.webhookSubscription.findMany({
            where: { tenantId, isActive: true, events: { has: event } },
            select: { id: true, url: true, secret: true },
          }),
      );

      const body = JSON.stringify({
        event,
        payload,
        sentAt: new Date().toISOString(),
      });

      await Promise.all(
        subs.map((sub) =>
          this.send(sub.url, sub.secret, body).catch((err: unknown) => {
            this.logger.warn(
              `Falha ao entregar webhook "${event}" para ${sub.url} (subscription ${sub.id}): ${String(err)}`,
            );
          }),
        ),
      );
    } catch (err) {
      // Nunca deixa dispatch() propagar um erro para quem o chamou (ex.:
      // QuotesService.approve, InvoicesService.registerPayment).
      this.logger.error(`dispatch("${event}") falhou`, err as Error);
    }
  }

  private async send(url: string, secret: string, body: string): Promise<void> {
    const signature = signWebhookPayload(secret, body);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
      await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
        },
        body,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Job diário (spec Fase 3 — evento "contrato vencendo"): varre contratos
   * ATIVOS de TODOS os tenants vencendo nos próximos 7 dias e despacha
   * `contract.expiring` por tenant. Granularidade diária, não em tempo
   * real — ver justificativa de PrismaAdminService no construtor.
   */
  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async notifyExpiringContracts(): Promise<void> {
    try {
      const now = new Date();
      const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      const contracts: ExpiringContractRow[] =
        await this.prismaAdmin.contract.findMany({
          where: {
            status: 'ativo',
            endDate: { gte: now, lte: in7Days },
          },
          select: {
            id: true,
            tenantId: true,
            title: true,
            endDate: true,
            customerId: true,
          },
        });

      for (const contract of contracts) {
        await this.dispatch(contract.tenantId, 'contract.expiring', {
          contractId: contract.id,
          title: contract.title,
          endDate: contract.endDate,
          customerId: contract.customerId,
        });
      }
    } catch (err) {
      this.logger.error(
        'notifyExpiringContracts (cron diário) falhou',
        err as Error,
      );
    }
  }
}
