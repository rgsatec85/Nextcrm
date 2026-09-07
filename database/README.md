# Database — migrations e padrão multi-tenant

## Por que SQL puro em vez de `prisma migrate`

O Prisma modela tabelas e relacionamentos muito bem, mas não expressa nativamente
Row Level Security, políticas, roles de banco (`app_user` / `app_service`) nem
funções auxiliares (`current_tenant_id()`). Para manter esse conjunto de
segurança como fonte única da verdade, o schema é versionado como SQL puro em
`database/migrations/`, aplicado com uma ferramenta de migration simples
(`node-pg-migrate`-like via script, ou `psql` diretamente). O `backend/prisma/schema.prisma`
espelha essas tabelas manualmente e é usado **apenas como query builder**
(`prisma generate`), nunca como dono do schema (não rodamos `prisma migrate
deploy` em produção).

Sempre que uma migration adicionar/alterar uma tabela, atualize
`backend/prisma/schema.prisma` no mesmo commit.

## Como aplicar as migrations

**Localmente (docker-compose):** os arquivos em `database/migrations/*.sql`
são montados em `/docker-entrypoint-initdb.d` e rodam automaticamente na
primeira vez que o container do Postgres sobe (`docker compose up`, volume
vazio). Para reaplicar do zero: `docker compose down -v && docker compose up -d`.

**Contra um Supabase real** (ou qualquer Postgres já existente):

```bash
for f in database/migrations/*.sql; do psql "$DATABASE_URL" -f "$f"; done
```

Ou, se preferir o Supabase CLI: copie o conteúdo para
`supabase/migrations/<timestamp>_init.sql` no projeto Supabase e rode
`supabase db push`.

> Nota sobre privilégios: `0001_init.sql` cria os roles `app_user` (sujeito a
> RLS) e `app_service` (BYPASSRLS, só para provisionamento de tenant). Isso
> requer `CREATEROLE` na conexão usada para migrar — no Supabase, use a
> connection string do usuário `postgres` (owner do projeto), não a
> `service_role`/`anon` do PostgREST. Se sua conta não permitir criar roles,
> uma alternativa é rodar tudo com o usuário padrão do Supabase e aplicar o
> `SET LOCAL app.tenant_id` normalmente — a RLS continua funcionando, você só
> perde a separação extra entre `app_user`/`app_service`.

## O padrão de isolamento (3 camadas)

1. **JWT** — o token emitido no login carrega `tenant_id`.
2. **Backend** — todo repositório/serviço do NestJS filtra explicitamente por
   `tenant_id` (nunca um `findMany` sem filtro).
3. **Row Level Security** — cada tabela multi-tenant tem uma policy
   `USING (tenant_id = current_tenant_id())`. `current_tenant_id()` lê a
   variável de sessão `app.tenant_id`, setada pelo backend em
   `TenantContextMiddleware` a cada request, dentro de uma transação Prisma
   (`SET LOCAL`, então nunca vaza entre requests/conexões do pool).

Detalhes de implementação em `docs/security-multitenancy.md`.

## Migrations aplicadas até agora

- `0001_init.sql` — Fase 0: companies, roles, users, audit_logs.
- `0002_fase1_crm.sql` — Fase 1: customers, contacts, opportunities, quotes,
  orders, activities.
- `0003_fase2_financeiro.sql` — Fase 2: invoices, contracts,
  `users.commission_rate`.
- `0004_fase3_portal_atendimento.sql` — Fase 3: `users.customer_id`,
  tickets, ticket_comments, knowledge_articles, webhook_subscriptions.
- `0005_fase4_ia.sql` — Fase 4: `ai_query_logs` (auditoria das perguntas
  feitas ao assistente de IA, `POST /ai/ask`). É a única tabela nova da
  Fase 4 — o resto (resumo de cliente, Score IA, próxima ação, rascunho de
  email, cobrança inteligente, previsão de pipeline) é computado on-the-fly
  a partir de tabelas já existentes, sem persistência própria. Ver
  `docs/fase4-ia-corporativa.md`.

## Próximas migrations (fora do escopo atual)

O que a Fase 5 (Hardening, Escala e Observabilidade) exigir — mesmo padrão
(`tenant_id` + RLS) para qualquer tabela nova.
