# Fase 5 — Hardening, Escala e Observabilidade

Referência: roadmap (`spec/roadmap.md`, seção Fase 5) e a seção
correspondente da master spec. Mesmo formato de
`docs/fase4-ia-corporativa.md`: o que foi construído, a decisão central, as
simplificações assumidas e como foi verificado.

## A decisão central desta fase: o que é código real vs. o que é runbook

Diferente das Fases 1-4 (todo o trabalho era código de aplicação
verificável neste sandbox), a Fase 5 mistura dois tipos de entrega:

1. **Código real, testável neste sandbox**: instrumentação OpenTelemetry,
   rate limiting com Redis (com fallback), graceful shutdown, health check
   de prontidão, cache headers, e o fechamento do gap de NFR/SLA/RPO/RTO
   (documentação, mas é a entrega em si, não um substituto de código).
2. **Trabalho de infraestrutura/operação** que não pode ser "construído"
   num sandbox sem provisionar serviços externos reais (Grafana/Prometheus/
   Loki geridos, read replica do Supabase, plano de autoscaling do Render,
   uma conta paga do SonarCloud, um scan ativo do OWASP ZAP contra uma URL
   de verdade). Para essa categoria, a entrega é documentação honesta —
   checklists, docker-compose local e runbooks — em vez de fingir que algo
   foi "ligado" quando não foi. Mesma filosofia de simplificação
   documentada já usada para o gateway de pagamento fake (Fase 2), o
   webhook fire-and-forget (Fase 3) e o `OllamaAiProvider` não testável
   (Fase 4).

## O que existe (código)

### 1. OpenTelemetry (`backend/src/observability/`)

- `tracing.ts`: inicialização condicional do Node SDK — se
  `OTEL_EXPORTER_OTLP_ENDPOINT` não estiver definido, a SDK **não inicia**
  (nenhum exporter no-op, nenhum log de spans) — zero custo de boot, zero
  latência adicional. Importada como a primeira linha de `main.ts`,
  **antes** de qualquer outro import (`@nestjs/core` incluso) — requisito
  do OTel Node SDK para a auto-instrumentação conseguir fazer o monkey-patch
  de `pg`/`http` antes desses módulos serem carregados.
- `tracer.ts`: expõe um `tracer` nomeado (`trace.getTracer('crm-backend')`)
  usado por spans manuais — seguro de chamar sempre, mesmo sem a SDK
  iniciada (vira um tracer no-op global da própria API do OTel).
- Span manual em `PrismaService.runWithTenant` (o ponto por onde passa
  toda query de negócio do projeto) com o atributo `tenant_id` — nunca
  dados de negócio, mesmo nível de exposição dos logs de auditoria já
  existentes.
- Pacotes instalados após checar `npm view <pkg> peerDependencies`/
  `engines` e um `npm install --dry-run` isolado antes de instalar de
  verdade (mesma disciplina que evitou o incidente de peer-dependency do
  `@nestjs/schedule` nas fases anteriores): `@opentelemetry/sdk-node@0.222.0`,
  `@opentelemetry/auto-instrumentations-node@0.80.0`,
  `@opentelemetry/exporter-trace-otlp-http@0.222.0`,
  `@opentelemetry/api@1.9.1`, `@opentelemetry/resources@2.11.0`,
  `@opentelemetry/semantic-conventions@1.29.0` — todos framework-agnósticos
  (não dependem do NestJS), versões que resolveram sem conflito de peer
  dependency contra o Node 22/NestJS 10 deste projeto.

### 2. Rate limiting com Redis (`backend/src/common/throttler/`, `backend/src/redis/`)

- `RedisService` (`backend/src/redis/redis.service.ts`): cliente `ioredis`
  opcional — sem `REDIS_URL`, nunca instancia um cliente e todo consumidor
  precisa checar `isConfigured` em vez de assumir. Implementa
  `OnModuleDestroy` (fecha a conexão no shutdown).
- `RedisThrottlerStorageService` (`backend/src/common/throttler/redis-throttler-storage.service.ts`):
  implementação de `ThrottlerStorage` (interface do `@nestjs/throttler`
  v6.5.0, lida direto de `node_modules` antes de implementar, não
  assumida) usando um **script Lua atômico** (`INCR` + checagem/gravação de
  bloqueio num único round-trip, evitando a race condition de fazer isso em
  comandos separados) — ver o comentário no arquivo para o script completo.
  Cai para o armazenamento em memória padrão do próprio `@nestjs/throttler`
  (`ThrottlerStorageService`, usado como fallback interno, não
  reimplementado) em dois cenários, ambos cobertos por teste:
  1. `REDIS_URL` não configurado — nunca tenta o Redis.
  2. Redis configurado mas indisponível em runtime — o erro é capturado
     por requisição, cai para memória só para aquela chamada.
  Trade-off documentado no próprio arquivo: sob múltiplas instâncias do
  Render com o Redis fora do ar, cada instância conta hits separadamente
  (limite efetivo vira `limite × instâncias` até o Redis voltar) —
  aceitável para rate limiting, preferível a derrubar a API.
- Ligado em `AppModule` via `ThrottlerModule.forRootAsync`, construindo o
  storage manualmente dentro do `useFactory` (injetando só `RedisService`)
  em vez de registrar como provider Nest — o `ThrottlerModule` ainda não
  existe no ponto em que o factory roda.

### 3. Graceful shutdown

- `app.enableShutdownHooks()` em `main.ts` — faz o Nest chamar
  `OnModuleDestroy` de todos os providers ao receber `SIGTERM`/`SIGINT`.
- `PrismaService` e `PrismaAdminService` já implementavam
  `OnModuleDestroy` desde a Fase 0 (checado antes de assumir que precisava
  adicionar) — `RedisService` (novo) também implementa.

### 4. Health checks (`backend/src/health/`)

- `GET /api/health` (liveness): **formato inalterado** desde a Fase 0 —
  mesmo path que o Render usa como health check, mesmo shape de resposta.
  Deliberadamente não verifica banco/Redis (uma instabilidade externa
  passageira não deveria derrubar/reiniciar um processo saudável).
- `GET /api/health/ready` (readiness, novo): checa banco (`SELECT 1` via
  `PrismaService`, fora de `runWithTenant` de propósito — não há tenant
  num health check) e Redis (só se `REDIS_URL` estiver configurado — a
  ausência de Redis é um estado válido deste projeto, reportado como
  `not_configured`, nunca como `error`). Devolve 503 se alguma dependência
  obrigatória estiver fora do ar.

### 5. CI/CD (`.github/workflows/`)

- **CodeQL** (`ci.yml`, novo job): SAST real, grátis, sem conta externa —
  escolhido no lugar de SonarQube/SonarCloud precisamente porque não exige
  nenhum secret/conta paga do usuário. Não-bloqueante nesta fase
  (`continue-on-error: true`), mesma filosofia do job `security` já
  existente.
- **Trivy + `npm audit`** (job `security`, já existente desde a Fase 0):
  confirmados presentes, sem alteração de comportamento.
- **OWASP ZAP baseline scan** (`zap-baseline.yml`, novo workflow): disparo
  manual (`workflow_dispatch`, pedindo a URL alvo como input) — não
  automático porque não existe ambiente de staging efêmero neste projeto
  para escanear com segurança a cada push.
- **SonarQube/SonarCloud**: deliberadamente **não** incluído como step —
  documentado em `docs/deployment.md` como passo manual opcional,
  explicando exatamente por quê (exige conta/token do usuário; um step que
  "passasse" sem isso configurado estaria fingindo cobertura que não
  existe).

### 6. Cache headers

- `GET /portal/knowledge` (base de conhecimento publicada, Portal do
  Cliente) e `GET /knowledge/:id` (leitura de um artigo, painel interno):
  `Cache-Control: private, max-age=60` e `private, max-age=30`
  respectivamente. `private` de propósito — a resposta já passou pelas 3
  camadas de isolamento de sempre (JWT → filtro por tenant/customerId →
  RLS) antes de chegar aqui; um cache **compartilhado** precisaria do
  tenant como parte da chave de cache para não vazar entre tenants, o que
  este projeto não configura — `private` restringe o cache ao navegador do
  próprio usuário, eliminando esse risco. Nenhum outro endpoint recebeu
  cache: listagens que mudam com frequência (rascunhos do editor,
  faturas, chamados) ficaram de fora de propósito.

### 7. NFR/SLA/RPO/RTO (fecha o ponto em aberto do roadmap)

`docs/nfr-slo.md` — metas propostas (não medições reais) de
disponibilidade, RPO, RTO, orçamento de latência (p95/p99) e throughput
estimado, para cada um dos 3 tiers de capacidade do roadmap, mapeadas para
planos concretos de Supabase/Render/Vercel. Ver o documento para os
números e as ressalvas.

## O que é runbook/documentação (não código ligado a nada real)

- **`infrastructure/docker-compose.observability.yml`** + configs em
  `infrastructure/observability/`: stack local self-hostable (OTel
  Collector + Prometheus + Loki + Promtail + Grafana, com datasources
  pré-provisionados). Sintaticamente validado (`docker compose config` sem
  erros, todos os YAMLs parseiam corretamente) mas **não verificado
  rodando de fato**: o Docker Engine está disponível neste sandbox, mas o
  `docker pull` das imagens é bloqueado pela política de rede de saída do
  ambiente (HTTP 403 em todo registry testado — Docker Hub e ghcr.io).
  Ver `docs/observability.md` para o que este stack cobre e o que não
  cobre mesmo depois de rodar de verdade.
- **`docs/scaling-checklist.md`**: checklist de dashboard (Supabase
  connection pooling/read replica/PITR, Render autoscaling/instâncias,
  Vercel) por tier de capacidade — nada disso está ativado neste projeto.
- **Grafana Cloud (produção)**: opção documentada em
  `docs/observability.md` como alternativa ao self-hosted — não há conta
  criada nem testada.

## Simplificações assumidas nesta fase

- OpenTelemetry só instrumenta **traces** — sem métricas de aplicação
  customizadas nem exporter de logs; o stack local deriva métricas só do
  volume de spans que o Collector recebe.
- O rate limiting em memória (fallback) conta hits **por instância**, não
  globalmente — sob múltiplas instâncias do Render sem Redis (ou com Redis
  fora do ar), o limite efetivo é `limite configurado × número de
  instâncias`. Documentado como trade-off aceitável para rate limiting
  (não é controle de acesso de segurança crítica).
- O stack de observabilidade local nunca rodou de ponta a ponta neste
  sandbox (bloqueio de rede para pull de imagens Docker) — configuração
  revisada e validada sintaticamente, não testada em execução.
- SonarQube/SonarCloud e o scan ativo do OWASP ZAP contra uma URL real
  ficaram de fora da automação (documentados como passo manual/opcional)
  por exigirem conta/infraestrutura externa que não existe neste sandbox.
- As metas de `docs/nfr-slo.md` são propostas de engenharia, não medições —
  este projeto nunca rodou com tráfego de produção real.

## Verificação feita

- Backend: `tsc --noEmit` (0 erros), `eslint --fix` (0 erros), `jest`
  (181 passed / 3 skipped — mesma causa documentada em `docs/setup.md`,
  dependente de `prisma generate`; os 13 testes novos desta fase cobrem
  `RedisThrottlerStorageService` — fallback em memória sem cliente, fallback
  em memória em runtime após erro do Redis, caminho feliz via script Lua,
  cenário de bloqueio —, `RedisService` — não lança sem `REDIS_URL`,
  `ping()` resolve `false` sem cliente, `onModuleDestroy()` seguro sem
  cliente — e `HealthController` — liveness nunca toca dependência nenhuma,
  readiness ok/erro para banco e Redis nas quatro combinações relevantes),
  `npm run build`.
- CI (`ci.yml`, `zap-baseline.yml`): YAML validado sintaticamente
  (`yaml.safe_load` de cada arquivo) — não executado de fato num runner do
  GitHub Actions real dentro deste sandbox (isso exigiria um push real ao
  GitHub, fora do escopo desta tarefa).
- `infrastructure/docker-compose.observability.yml` e todos os configs em
  `infrastructure/observability/`: sintaxe validada (`docker compose
  config` + `yaml.safe_load` em cada arquivo). Execução real bloqueada pela
  política de rede do sandbox (pull de imagem recusado com 403 em todo
  registry testado) — ver ressalva em `docs/observability.md`.
- Frontend: **não alterado nesta fase** — Fase 5 é inteiramente
  backend/infraestrutura/documentação; `npm run lint`/`npm run build` do
  frontend continuam válidos da Fase 4, sem necessidade de re-executar por
  não haver mudança de código no frontend.

## Próximo passo natural

Fase 6 — Integrações futuras (SAP S/4HANA, Microsoft Fabric), conforme
`spec/roadmap.md`, ou — mais provável no curto prazo — executar o
checklist de `docs/scaling-checklist.md` conforme o tráfego real justificar
cada tier, e revisitar `docs/nfr-slo.md` com dados reais assim que
existirem.
