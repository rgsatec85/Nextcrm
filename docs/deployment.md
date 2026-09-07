# Deployment

Este documento assume que você já tem contas em GitHub, Supabase, Vercel e
Render (confirmado antes de começar a Fase 0).

## 1. Repositório GitHub

```bash
cd crm-enterprise
git init
git add .
git commit -m "chore: scaffold Fase 0 — fundação multi-tenant"
git branch -M main
git remote add origin git@github.com:<sua-org>/crm-enterprise.git
git push -u origin main
```

## 2. Supabase (banco de produção)

1. Crie um novo projeto no Supabase.
2. Pegue a connection string do usuário `postgres` (Project Settings →
   Database → Connection string → modo "Session" ou "Transaction pooling",
   conforme preferir) — é essa que você usa para **rodar as migrations**
   (precisa de `CREATEROLE`).
3. Aplique o schema, na ordem (cada arquivo é incremental sobre o anterior):
   ```bash
   psql "<connection-string-do-postgres>" -f database/migrations/0001_init.sql
   psql "<connection-string-do-postgres>" -f database/migrations/0002_fase1_crm.sql
   psql "<connection-string-do-postgres>" -f database/migrations/0003_fase2_financeiro.sql
   psql "<connection-string-do-postgres>" -f database/migrations/0004_fase3_portal_atendimento.sql
   psql "<connection-string-do-postgres>" -f database/migrations/0005_fase4_ia.sql
   ```
4. Depois de rodar a migration, você terá os roles `app_user` (senha
   `app_user` por padrão no script — **troque em produção**, ver nota
   abaixo) e `app_service`. Gere connection strings específicas para cada um
   apontando para o mesmo banco e use-as como `DATABASE_URL` e
   `DATABASE_SERVICE_URL` no backend.

> **Importante:** o `CREATE ROLE ... PASSWORD 'app_user'` na migration usa uma
> senha placeholder só para não travar o `docker compose up` local. Em
> produção, troque a senha logo após rodar a migration:
> ```sql
> ALTER ROLE app_user WITH PASSWORD '<senha-forte-gerada>';
> ALTER ROLE app_service WITH PASSWORD '<outra-senha-forte>';
> ```
> e atualize as connection strings nos secrets do Render antes de expor o
> serviço publicamente.

## 3. Render (backend)

1. New → Web Service → conecte o repositório GitHub, diretório raiz
   `backend/`.
2. Runtime: Docker (usa `backend/Dockerfile`).
3. Variáveis de ambiente (Render → Environment):
   - `DATABASE_URL` (role `app_user`)
   - `DATABASE_SERVICE_URL` (role `app_service`)
   - `JWT_SECRET` (gere um valor aleatório longo, nunca reutilize o do `.env.example`)
   - `JWT_EXPIRES_IN=8h`
   - `CORS_ORIGIN` = URL do frontend na Vercel (ex: `https://seu-app.vercel.app`)
   - `PORT=3001` (Render injeta a própria porta via `PORT`; o `main.ts` já lê `process.env.PORT`)
   - `AI_PROVIDER` (Fase 4) — deixe **sem definir** (ou `deterministic`
     explicitamente) para o assistente/Score IA continuarem funcionando sem
     nenhuma infraestrutura extra. Só defina como `ollama` se você
     provisionar um servidor Ollama real e alcançável a partir do Render, e
     nesse caso configure também `OLLAMA_BASE_URL` (URL desse servidor) e
     `OLLAMA_MODEL` (nome do modelo carregado nele).
   - `REDIS_URL` (Fase 5, opcional) — deixe **sem definir** até provisionar
     um Redis de verdade (ex.: Upstash, via marketplace de add-ons do
     Render ou direto na Upstash). Sem ele, o rate limiting cai
     automaticamente para memória (por instância) e `GET /api/health/ready`
     reporta Redis como `not_configured`, não como falha — nada quebra.
     Ver `docs/scaling-checklist.md` (quando provisionar) e
     `backend/src/redis/redis.service.ts` (como o fallback funciona).
   - `OTEL_EXPORTER_OTLP_ENDPOINT` / `OTEL_SERVICE_NAME` (Fase 5, opcional)
     — deixe **sem definir** até ter um collector real para apontar (local
     via `infrastructure/docker-compose.observability.yml`, ou um provedor
     gerenciado como Grafana Cloud). Sem isso, o OpenTelemetry SDK
     simplesmente não inicia — ver `docs/observability.md`.
4. Health check path: `/api/health` (liveness — **não** `/api/health/ready`,
   que checa banco/Redis e reiniciaria um processo saudável por causa de
   uma instabilidade externa; ver o doc-comment em
   `backend/src/health/health.controller.ts`).
5. Depois de criar o serviço, copie o **Deploy Hook** (Settings → Deploy
   Hook) e salve como secret `RENDER_DEPLOY_HOOK_URL` no GitHub
   (repositório → Settings → Secrets and variables → Actions).

## 4. Vercel (frontend)

1. New Project → importe o repositório, Root Directory: `frontend/`.
2. Framework preset: Next.js (detectado automaticamente).
3. Variável de ambiente: `BACKEND_URL` = URL pública do backend no Render +
   `/api` (ex: `https://crm-backend.onrender.com/api`).
4. Para o workflow `deploy.yml` conseguir publicar via CLI, gere um token em
   Vercel → Account Settings → Tokens e configure os secrets no GitHub:
   - `VERCEL_TOKEN`
   - `VERCEL_ORG_ID` e `VERCEL_PROJECT_ID` (rode `npx vercel link` localmente
     dentro de `frontend/` uma vez — isso cria `.vercel/project.json` com os
     dois IDs).

## 5. CI/CD

- `.github/workflows/ci.yml` roda em todo push/PR para `main`/`develop`:
  lint + testes + build do backend (com Postgres efêmero do próprio job
  aplicando as migrations) e lint + build do frontend, mais dois jobs de
  segurança não-bloqueantes (`continue-on-error: true` — visibilidade
  contínua, não gate ainda):
  - **`security`**: Trivy (scan de filesystem — dependências vulneráveis,
    segredos commitados) + `npm audit` (backend e frontend).
  - **`codeql`** (Fase 5): SAST real via GitHub CodeQL
    (`github/codeql-action`), analisando o código TypeScript do monorepo.
    Escolhido em vez de SonarQube para o SAST desta fase porque é **grátis
    e não exige nenhuma conta/secret externo** — roda com o `GITHUB_TOKEN`
    padrão do próprio Actions. SonarQube/SonarCloud ficou **deliberadamente
    fora** do pipeline: exigiria uma conta (paga ou o tier gratuito do
    SonarCloud, que também exige cadastro) e um token configurado pelo
    usuário — em vez de simular isso com um step que "passaria" sem checar
    nada de verdade, a decisão foi documentar como passo manual opcional:
    se o time quiser SonarCloud, crie a conta, gere o token, adicione como
    secret `SONAR_TOKEN` e um step com `SonarSource/sonarcloud-github-action`
    — não incluído aqui por não haver como testá-lo neste sandbox nem
    fingir que funciona sem a conta real.
- `.github/workflows/zap-baseline.yml` (Fase 5): scan DAST com **OWASP
  ZAP** (baseline scan), disparado **manualmente** (`workflow_dispatch`,
  aba Actions → "Run workflow"), pedindo a URL alvo como input. Não roda
  automaticamente porque este projeto não tem um ambiente de staging
  efêmero (nenhuma preview deployada por PR) — rodar um scanner ativo
  contra produção sem que o time saiba não é uma boa prática. Use isso
  manualmente contra uma URL de review/staging quando quiser um scan.
- `.github/workflows/deploy.yml` dispara automaticamente quando o CI termina
  com sucesso na `main`: chama o deploy hook do Render e publica o frontend
  na Vercel via CLI. Sem os secrets configurados, os jobs de deploy
  simplesmente logam "pulando" e terminam com sucesso — assim o pipeline
  nunca quebra por falta de credenciais antes de você configurá-las.

## 5.1 Webhooks e o cron de contratos vencendo (Fase 3)

`WebhooksService.dispatch()` faz um `fetch()` de saída para a URL de cada
assinatura ativa — o Render permite tráfego de saída por padrão, nenhuma
configuração extra é necessária. O `@Cron(CronExpression.EVERY_DAY_AT_6AM)`
que dispara `contract.expiring` só roda enquanto o processo do backend está
de pé (não é uma serverless function) — em um Web Service do Render isso é
automático; se um dia o backend for para um ambiente serverless/edge, esse
cron precisa virar um agendador externo (ex: um cron job do próprio Render,
ou GitHub Actions com `schedule`) chamando um endpoint interno.

## 6. Checklist de segurança antes de ir ao ar

- [ ] Trocar as senhas placeholder de `app_user`/`app_service`.
- [ ] Gerar um `JWT_SECRET` forte e único por ambiente.
- [ ] Configurar `CORS_ORIGIN` apenas com o domínio real do frontend.
- [ ] Confirmar que o RLS está habilitado em produção (rode a query de
      verificação em `docs/security-multitenancy.md`).
- [ ] Habilitar HTTPS obrigatório no Render e na Vercel (ambos fazem isso
      por padrão, mas confirme dominios customizados).

## 7. Hardening, escala e observabilidade (Fase 5)

Detalhes completos em `docs/fase5-hardening-observabilidade.md`. Referência
rápida:

- **Metas de NFR/SLA/RPO/RTO** propostas (não ainda medidas em produção):
  `docs/nfr-slo.md`.
- **Escalar Supabase/Render/Vercel por tier de capacidade**: checklist
  passo a passo em `docs/scaling-checklist.md` — nada disso está ativado
  hoje, é o guia para quando o tráfego justificar.
- **Observabilidade (OpenTelemetry)**: `docs/observability.md` — como
  apontar o backend para o stack local
  (`infrastructure/docker-compose.observability.yml`) ou para um provedor
  gerenciado. Inativo em produção até `OTEL_EXPORTER_OTLP_ENDPOINT` ser
  configurado.
- **Rate limiting com Redis**: opcional via `REDIS_URL`, com fallback
  automático em memória — nunca quebra o backend na ausência do Redis.
