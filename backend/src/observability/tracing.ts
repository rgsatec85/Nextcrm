/**
 * OpenTelemetry — inicialização condicional (Fase 5 — Hardening/Observabilidade).
 *
 * Importante: este arquivo precisa ser importado ANTES de qualquer outro
 * módulo em `main.ts` (inclusive antes de `@nestjs/core`). O Node SDK do
 * OTel instrumenta módulos via monkey-patch do `require()` — se `pg`,
 * `express`/`http` etc. já tiverem sido carregados antes de `sdk.start()`,
 * a auto-instrumentação desses módulos não pega.
 *
 * Comportamento quando `OTEL_EXPORTER_OTLP_ENDPOINT` não está definido
 * (ex.: o deploy atual no Render, que não tem nenhum collector real
 * provisionado): a SDK simplesmente NÃO inicia. Nenhum exporter no-op,
 * nenhum console.log de spans — zero custo de boot e zero overhead em
 * runtime além do tracer global no-op que a API do OTel já expõe por
 * padrão (ver `backend/src/observability/tracer.ts`, usado pelos spans
 * manuais em `PrismaService.runWithTenant`). Isso é o que garante que
 * ligar/desligar observabilidade nunca é um risco de quebrar o boot em
 * produção.
 *
 * Ver `docs/observability.md` para como apontar isso para um collector
 * local (docker-compose) ou para o Grafana Cloud.
 */
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions';

let sdk: NodeSDK | undefined;

export function initTracing(): void {
  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  if (!endpoint) {
    return;
  }

  const serviceName = process.env.OTEL_SERVICE_NAME ?? 'crm-backend';

  try {
    sdk = new NodeSDK({
      resource: resourceFromAttributes({
        [ATTR_SERVICE_NAME]: serviceName,
        [ATTR_SERVICE_VERSION]: process.env.npm_package_version ?? '0.1.0',
      }),
      traceExporter: new OTLPTraceExporter({ url: `${endpoint}/v1/traces` }),
      instrumentations: [
        getNodeAutoInstrumentations({
          // Extremamente verboso e raramente útil para um CRM; desligado por
          // padrão para não afogar o exporter com spans de leitura de
          // arquivo interna do runtime.
          '@opentelemetry/instrumentation-fs': { enabled: false },
        }),
      ],
    });

    sdk.start();
    // eslint-disable-next-line no-console
    console.log(
      `OpenTelemetry ativo (service.name=${serviceName}, endpoint=${endpoint})`,
    );
  } catch (err) {
    // Nunca derruba o boot por causa de observabilidade — mesma filosofia
    // de graceful degradation do WebhooksService.dispatch().
    // eslint-disable-next-line no-console
    console.warn(
      `Falha ao iniciar OpenTelemetry, seguindo sem tracing: ${String(err)}`,
    );
    sdk = undefined;
  }

  const shutdown = () => {
    if (!sdk) return;
    sdk.shutdown().catch((err: unknown) =>
      // eslint-disable-next-line no-console
      console.warn(`Falha ao encerrar OpenTelemetry: ${String(err)}`),
    );
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}
