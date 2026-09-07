/**
 * Tracer nomeado para spans manuais do domínio (ex.: `PrismaService.runWithTenant`).
 *
 * `trace.getTracer()` da API do OTel é seguro de chamar mesmo quando
 * `initTracing()` nunca rodou (endpoint não configurado) — nesse caso a API
 * devolve um tracer no-op global (custo desprezível, nenhuma rede). Isso
 * permite instrumentar o código de negócio uma única vez, sem `if
 * (otelEnabled)` espalhado pelo projeto: os spans só passam a ser
 * exportados de verdade quando alguém configura
 * `OTEL_EXPORTER_OTLP_ENDPOINT`.
 */
import { trace } from '@opentelemetry/api';

export const tracer = trace.getTracer('crm-backend');
