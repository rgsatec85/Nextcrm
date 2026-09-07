# Observabilidade (Fase 5 — Hardening)

Cobre o que a Fase 5 realmente ligou no código (OpenTelemetry no backend,
condicional) e como usar isso — tanto localmente contra o stack em
`infrastructure/docker-compose.observability.yml` quanto contra um provedor
gerenciado (Grafana Cloud) em produção. Nada disto está ligado a um destino
real hoje: o Render em produção não tem `OTEL_EXPORTER_OTLP_ENDPOINT`
configurado, então a SDK simplesmente não inicia (ver
`backend/src/observability/tracing.ts`) — este documento é o guia para
quando alguém decidir configurá-lo.

## O que foi instrumentado

- **`@opentelemetry/sdk-node` + `@opentelemetry/auto-instrumentations-node`**:
  instrumentação automática de HTTP de entrada/saída, do driver `pg`
  (usado por baixo do Prisma) e de outras libs comuns do Node — sem
  nenhuma mudança manual nos módulos de negócio. Inicializada em
  `backend/src/observability/tracing.ts`, importada como a **primeira
  linha** de `backend/src/main.ts` (precisa rodar antes de `pg`/`express`
  serem carregados para o monkey-patch pegar).
- **Span manual**: `PrismaService.runWithTenant` (`backend/src/prisma/prisma.service.ts`)
  abre um span `prisma.runWithTenant` com o atributo `tenant_id` — é o
  ponto por onde passa toda query de negócio deste projeto, então é o
  lugar mais barato de instrumentar manualmente para já sair com
  visibilidade por tenant sem instrumentar dezenas de services um por um.
  **Cuidado de PII**: só `tenant_id` (um UUID) vira atributo — nunca dados
  de negócio (nome de cliente, valores, etc.), mesmo nível de exposição já
  aceito para os logs de auditoria existentes.
- **Exporter**: `@opentelemetry/exporter-trace-otlp-http`, mandando para
  `${OTEL_EXPORTER_OTLP_ENDPOINT}/v1/traces`. Só traces por enquanto — não
  há exporter de métricas customizadas de aplicação nem de logs
  configurado no backend (ver "O que falta" abaixo).

## Comportamento quando não configurado (produção hoje)

`OTEL_EXPORTER_OTLP_ENDPOINT` não definido → `initTracing()` retorna
imediatamente, a SDK nunca é instanciada. Os spans manuais
(`tracer.startActiveSpan` em `PrismaService`) continuam existindo no código,
mas usam o tracer no-op global da API do OTel — custo desprezível, nenhuma
rede, nenhum dado gravado em lugar nenhum. Isso é o que garante que ligar
observabilidade nunca vira um risco de quebrar produção por uma env var
esquecida.

## Rodando localmente (stack self-hosted)

```bash
docker compose -f infrastructure/docker-compose.observability.yml up -d
```

Sobe OTel Collector (recebe OTLP na porta 4318), Prometheus, Loki, Promtail
(lê os logs de containers Docker do host e empurra pro Loki) e Grafana
(`http://localhost:3300`, login `admin`/`admin` no primeiro acesso —
Prometheus e Loki já vêm provisionados como datasource).

No `backend/.env`:

```
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
OTEL_SERVICE_NAME=crm-backend
```

Reinicie o backend (`npm run start:dev`) e gere algumas requisições
(`curl http://localhost:3001/api/health`, login, etc.) — os spans aparecem
no log do container `otel-collector` (`docker compose -f
infrastructure/docker-compose.observability.yml logs -f otel-collector`).

**O que este stack local NÃO cobre ainda** (para não vender mais do que
existe):

- Não há um backend de tracing navegável no Grafana (tipo Tempo/Jaeger) —
  os traces chegam no Collector e ficam só no log dele. Adicionar Tempo é o
  próximo passo natural se isso vier a ser necessário.
- Não há métricas de aplicação (latência por rota, taxa de erro por
  endpoint) — só as métricas que o próprio Collector deriva sobre o volume
  de spans recebidos. Instrumentar métricas customizadas (`@opentelemetry/sdk-metrics`)
  é trabalho futuro, fora do escopo desta fase.
- O Promtail lê logs de containers Docker do host — cobre o backend rodando
  como container; não cobre `npm run start:dev` direto no host, fora de
  container.
- **Este stack nunca rodou de ponta a ponta neste sandbox de
  desenvolvimento**: o Docker daemon está disponível aqui, e
  `docker compose config` valida a sintaxe de todos os arquivos sem erro,
  mas o `docker pull` das imagens (Docker Hub, ghcr.io) é bloqueado pela
  política de rede de saída deste ambiente (HTTP 403 em qualquer registry
  testado). Configuração revisada e sintaticamente válida, mas **não
  verificada rodando de fato** — validar isso é o primeiro passo recomendado
  antes de confiar neste stack.

## Produção: opção gerenciada (Grafana Cloud) em vez de self-hosted

O Render não roda facilmente um segundo serviço stateful (Prometheus/Loki
precisam de disco persistente) ao lado da API sem custo/complexidade
adicional. Para produção, a rota mais simples é um provedor gerenciado:

1. Crie uma conta no Grafana Cloud (tem tier gratuito com limites de
   retenção/volume — confirmar o que está vigente antes de depender disso
   para produção real).
2. O Grafana Cloud expõe um endpoint OTLP próprio (Grafana Alloy ou
   OTLP direto, dependendo de como a conta for configurada) — normalmente
   algo como `https://otlp-gateway-<região>.grafana.net/otlp`, com
   autenticação via header (instance ID + API key do Grafana Cloud).
3. Configure no Render (Environment do serviço backend):
   ```
   OTEL_EXPORTER_OTLP_ENDPOINT=<endpoint fornecido pelo Grafana Cloud>
   OTEL_SERVICE_NAME=crm-backend
   ```
   Se o endpoint do Grafana Cloud exigir um header de autenticação
   (comum — Basic Auth com instance ID/API key), isso exige uma pequena
   extensão em `tracing.ts` para passar `headers` no
   `OTLPTraceExporter` — não implementado nesta fase por não haver conta
   real para testar contra; documentado aqui como o próximo passo exato.
4. Dashboards/alertas ficam por conta do Grafana Cloud (interface web,
   fora do código deste repositório).

## Variáveis de ambiente (backend)

| Variável | Default | Efeito |
|---|---|---|
| `OTEL_EXPORTER_OTLP_ENDPOINT` | (não definido) | Se ausente, OTel não inicia. Se definido, aponta o exporter de traces para `<valor>/v1/traces`. |
| `OTEL_SERVICE_NAME` | `crm-backend` | Nome do serviço nos spans exportados (`service.name`). |
| `REDIS_URL` | (não definido) | Ver `docs/deployment.md`/`docs/setup.md` — usado pelo rate limiting (Fase 5) e pelo `GET /api/health/ready`, não pela observabilidade em si. |

## O que falta (honestamente, para não fingir mais do que existe)

- Nenhum dado de observabilidade flui para um destino real em produção
  hoje — zero custo, zero risco, mas também zero visibilidade até alguém
  configurar `OTEL_EXPORTER_OTLP_ENDPOINT` de verdade.
- Sem métricas de aplicação customizadas (só traces).
- Sem backend de tracing navegável no stack local (só o log do Collector).
- Sem alertas configurados em lugar nenhum (Grafana Cloud ou self-hosted) —
  isso é configuração de dashboard, fora do escopo de código desta fase.
