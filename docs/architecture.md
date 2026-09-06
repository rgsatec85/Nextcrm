# Arquitetura — Fase 0 a Fase 3

Referência: especificação completa em `spec/crm-enterprise-master-spec-v3.md`
(projeto Next CRM) e roadmap em `spec/roadmap.md`. As decisões abaixo cobrem a
fundação (Fase 0); o CRM Comercial (Fase 1), o Módulo Financeiro (Fase 2) e o
Portal do Cliente/Atendimento (Fase 3) reaproveitam tudo isso sem mudanças
estruturais — detalhes específicos em `docs/fase1-crm-comercial.md`,
`docs/fase2-financeiro.md` e `docs/fase3-portal-atendimento.md`.

## Stack implementada nesta fase

| Camada | Tecnologia | Onde |
|---|---|---|
| Frontend | Next.js 16 (App Router) + React 19 + TypeScript + Tailwind | `frontend/` |
| Backend | NestJS 10 + TypeScript | `backend/` |
| Acesso a dados | Prisma Client (query builder) sobre PostgreSQL | `backend/prisma/` |
| Schema/RLS | SQL puro, versionado à mão | `database/migrations/` |
| Autenticação | JWT (`@nestjs/jwt` + `passport-jwt`), senha com Argon2id | `backend/src/modules/auth/` |
| CI | GitHub Actions | `.github/workflows/` |

## Decisões de arquitetura e por que

### 1. SQL puro para o schema, Prisma só como client

Row Level Security, policies, roles de banco (`app_user`/`app_service`) e a
função `current_tenant_id()` não são bem representados pelo Prisma Migrate.
Por isso o schema vive em `database/migrations/*.sql` (fonte da verdade) e
`backend/prisma/schema.prisma` é mantido manualmente em sincronia, usado
apenas para gerar o client TypeScript (`prisma generate`). Detalhes e
trade-offs em `database/README.md`.

### 2. Isolamento multi-tenant em 3 camadas — adaptado da spec

A spec original (seção 18) descreve a Camada 3 usando
`auth.jwt()->>'tenant_id'`, que é específico do Supabase Auth (GoTrue) via
PostgREST. Como o backend é um NestJS com autenticação própria (JWT emitido
por nós), a Camada 3 usa `current_setting('app.tenant_id')`, setado pelo
backend a cada request dentro de uma transação (`SET LOCAL`, via
`PrismaService.runWithTenant`). O efeito de defesa em profundidade é
idêntico — ver `docs/security-multitenancy.md` para a prova.

Isso significa que o Supabase é usado aqui só como **Postgres gerenciado**,
não como Supabase Auth/PostgREST. Se no futuro vocês quiserem usar
Supabase Auth para OAuth social (Google, Microsoft), dá para migrar a
Camada 1 mantendo as Camadas 2 e 3 praticamente iguais.

### 3. Dois roles de banco: `app_user` e `app_service`

- `app_user`: sujeito a RLS. Usado em toda query request-scoped.
- `app_service`: `BYPASSRLS`. Usado só para provisionar um tenant novo no
  signup (não existe tenant_id de sessão ainda) e para o lookup de usuário
  por email no login (precisa achar o tenant antes de poder setar o
  contexto). Nunca deve ser usado para servir dados de negócio de um tenant
  já autenticado.

### 4. Email de usuário é único globalmente (não por tenant)

Decisão para manter o login simples: o usuário informa email + senha sem
precisar escolher a empresa antes. Trade-off: uma mesma pessoa não pode ter
conta em dois tenants diferentes com o mesmo email. Se isso vier a ser um
requisito real (ex: consultor que atende duas empresas clientes), o ajuste é
trocar a constraint `UNIQUE(email)` por `UNIQUE(tenant_id, email)` e mudar o
login para pedir a empresa (ou fazer lookup por email retornando lista de
tenants).

### 5. Perfis padrão criados automaticamente no signup

Todo tenant novo já nasce com os 5 perfis da spec (Admin Empresa,
Financeiro, Vendedor, Gestor, Cliente Portal) — `backend/src/modules/tenants/roles.constants.ts`.
O campo `permissions` (jsonb) em `roles` é o ponto de extensão para as
regras ABAC finas que entram junto com as entidades de negócio nas
próximas fases (ex: "vendedor só vê clientes onde `created_by = self`").

### 6. ABAC sobre RBAC para o perfil `vendedor` (Fase 1)

RBAC (`@Roles()` + `RolesGuard`) decide **quais rotas** um perfil acessa.
Isso não basta para o CRM Comercial: um `vendedor` acessa `/customers`, mas
só deve enxergar os clientes que são seus (spec — regra de ABAC citada na
decisão #5 acima). Essa segunda camada de checagem por atributo do registro
(`ownerId === user.sub`) vive em `backend/src/common/crm/ownership.ts` e é
aplicada em todo módulo do CRM Comercial — ver `docs/fase1-crm-comercial.md`
para os detalhes e como estender o padrão em módulos futuros.

### 7. Score Financeiro é uma heurística, não o Score IA da Fase 4

A Fase 2 introduz um "Score Financeiro" (verde/amarelo/vermelho) exposto no
Cliente 360°, calculado por uma regra determinística e transparente
(thresholds fixos sobre pontualidade/inadimplência). Isso é deliberadamente
diferente do "Score IA" da spec (Fase 4, ainda não construída), que usaria
aprendizado de máquina de verdade. Ver `docs/fase2-financeiro.md` para os
thresholds exatos e por que essa distinção importa.

### 8. Portal do Cliente: hard lock por `customerId`, não ABAC opcional (Fase 3)

O ABAC de `vendedor` (decisão #6) é um filtro que **algumas** roles recebem
e outras não — a mesma função (`ownerScopeWhere`) devolve "sem filtro" para
admin/gestor/financeiro. O perfil `cliente_portal` é estruturalmente
diferente: não existe uma variação desse perfil que "vê tudo do tenant". Por
isso o `PortalService` (`backend/src/modules/portal/portal.service.ts`) não
reusa `common/crm/ownership.ts` — implementa seu próprio
`requireCustomerId(user)`, que lança `ForbiddenException` se o JWT não
carregar `customerId` (falha fechado) e usa esse valor como **o único**
filtro em toda query, inclusive reconfirmando-o dentro do próprio `WHERE` em
operações sobre um recurso já existente (ex.: comentar um chamado), não só
na criação. Ver `docs/security-multitenancy.md` para o detalhamento e os
testes que provam que um cliente nunca alcança dado de outro mesmo
adivinhando IDs.

### 9. Terceiro uso sancionado de `PrismaAdminService`: cron de contratos vencendo (Fase 3)

A decisão #3 lista os dois usos originais de `PrismaAdminService`
(BYPASSRLS): provisionamento de tenant e lookup de login por email. A Fase 3
adiciona um terceiro, exatamente como o comentário de `0001_init.sql` já
previa ("jobs administrativos internos"): `WebhooksService.notifyExpiringContracts`,
um `@Cron` diário que precisa varrer contratos `ativo` vencendo em 7 dias em
**todos os tenants** para disparar o webhook `contract.expiring` de cada um.
Um cron não tem uma request HTTP por trás — não existe um `tenantId` de
sessão para `runWithTenant` setar via `SET LOCAL` antes de rodar essa
varredura global. A leitura via `PrismaAdminService` nunca serve como
resposta de request (só decide para qual tenant despachar), e o
`dispatch()` que ela alimenta volta a usar `runWithTenant`/RLS normalmente
para cada tenant individual. Qualquer uso futuro de `PrismaAdminService`
continua exigindo a mesma justificativa explícita em code review.

## Pontos em aberto (herdados do roadmap, específicos de arquitetura)

- **Requisitos não funcionais (spec §25)**: sem metas de SLA/RPO/RTO
  definidas. Precisa ser fechado antes da Fase 5 (Hardening/Escala).
- **Multi-tenancy de email**: ver decisão #4 acima — validar com o time se o
  trade-off é aceitável.
- **Rotação de JWT / refresh tokens**: a Fase 0 implementa um único
  `accessToken` de vida longa (8h). Um fluxo de refresh token (ou sessões
  revogáveis via Redis) é recomendado antes de produção real com muitos
  usuários simultâneos.
- **Rate limiting por rota**: hoje é global (100 req/min por IP via
  `@nestjs/throttler`). Rotas sensíveis (`/auth/login`, `/auth/signup`)
  merecem um limite mais agressivo e específico — ajuste simples com
  `@Throttle()` quando o tráfego real justificar.
