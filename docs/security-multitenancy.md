# Isolamento multi-tenant — como funciona e como foi verificado

Spec de referência: seção 18 (`Isolamento entre Clientes`) da master spec.
Este documento descreve a implementação real do backend e a verificação que
foi feita antes de considerar a Fase 0 pronta.

## As 3 camadas

```
Request HTTP
   │
   ├─ Camada 1 — JWT
   │    O token emitido em /auth/login e /auth/signup carrega tenantId.
   │    JwtStrategy.validate() põe isso em request.user.
   │
   ├─ Camada 2 — Backend
   │    Todo service usa request.user.tenantId explicitamente
   │    (ex: UsersService.findAllForTenant(tenantId)). Nunca um
   │    findMany()/findFirst() sem filtro de tenant.
   │
   └─ Camada 3 — PostgreSQL Row Level Security
        Toda query roda dentro de PrismaService.runWithTenant(tenantId, fn),
        que abre uma transação e faz:
          SELECT set_config('app.tenant_id', '<tenantId>', true)  -- SET LOCAL
        Cada tabela tem uma policy:
          USING (tenant_id = current_tenant_id())
        Então mesmo que a Camada 2 tivesse um bug (esquecer o WHERE, ou um
        WHERE com o tenant errado), o Postgres não devolve linhas de outro
        tenant.
```

`SET LOCAL`/`set_config(..., true)` vale só para a transação atual — nunca
vaza para a próxima query de outro request que reuse a mesma conexão do
pool.

## Regra para qualquer novo módulo (Fases 1+)

Ao criar um novo service que lida com dados de um tenant:

```ts
// ✅ Correto
async findAll(tenantId: string) {
  return this.prisma.runWithTenant(tenantId, (tx) =>
    tx.opportunity.findMany({ where: { tenantId } }),
  );
}

// ❌ Nunca fazer isso — pula a Camada 3 inteira
async findAll(tenantId: string) {
  return this.prisma.opportunity.findMany({ where: { tenantId } });
}
```

O único lugar onde é correto usar `PrismaAdminService` (BYPASSRLS) é
provisionamento de tenant e o lookup de login por email — qualquer outro uso
novo deve ser justificado explicitamente em code review.

## Verificação feita nesta fase

A migration `database/migrations/0001_init.sql` foi aplicada em um Postgres
16 real e testada com dois tenants simulados diretamente via SQL (sem passar
pelo Nest, para isolar a garantia no nível do banco):

```sql
-- Sem app.tenant_id setado: 0 linhas (mesmo existindo usuários no banco)
SET ROLE app_user;
SELECT count(*) FROM users;
-- count: 0

-- Contexto = Tenant A: só o usuário do Tenant A aparece
SELECT set_config('app.tenant_id', '<tenant-A>', false);
SELECT email, tenant_id FROM users;
-- admin@empresaA.com | <tenant-A>

-- Contexto = Tenant A, mas WHERE pedindo Tenant B (simula bug na Camada 2)
SELECT set_config('app.tenant_id', '<tenant-A>', false);
SELECT email, tenant_id FROM users WHERE tenant_id = '<tenant-B>';
-- 0 rows  ← RLS bloqueia mesmo com o filtro "errado" pedindo outro tenant
```

O terceiro caso é o mais importante: prova que a Camada 3 protege os dados
mesmo quando a Camada 2 explicitamente tenta buscar outro tenant. É
exatamente o que a spec pede: *"Mesmo em caso de falha na API, o banco
continuará protegendo os dados."*

Também há um teste unitário (`backend/src/prisma/prisma.service.spec.ts`)
garantindo que `runWithTenant` rejeita qualquer `tenantId` que não seja um
UUID válido antes de chegar perto de montar SQL — defesa extra contra
injection via essa variável de sessão.

## Auditoria

Toda mutação (`POST`/`PATCH`/`PUT`/`DELETE`) feita através de um controller
com `@UseInterceptors(AuditLogInterceptor)` grava uma linha em `audit_logs`
com tenant, usuário, IP, user agent e o resultado da operação — spec §20.

## ABAC dentro do tenant (Fase 1)

As 3 camadas acima isolam **entre** tenants. Dentro de um mesmo tenant, o
perfil `vendedor` tem uma regra adicional: só pode ver/editar clientes,
oportunidades, propostas, pedidos e atividades das quais é dono
(`ownerId`/via join). Isso é ABAC (Attribute-Based Access Control) — decide
acesso por um atributo do registro, não só pela rota — e é aplicado **acima**
da RLS, no service, com três funções puras em
`backend/src/common/crm/ownership.ts`:

```ts
ownerScopeWhere(user)      // where extra a adicionar num findMany
assertOwnership(user, rec) // lança ForbiddenException se não for dono
resolveOwnerId(user, req)  // vendedor sempre vira dono do que cria
```

`admin`, `gestor` e `financeiro` não são afetados (`OWNER_SCOPED_ROLES =
['vendedor']`) — veem tudo do tenant, como antes. Qualquer módulo novo que
tenha uma noção de "dono do registro" deve reusar essas três funções em vez
de reimplementar a checagem.

`invoices`/`contracts` (Fase 2) não têm dono próprio — igual a `orders` na
Fase 1 — então o ABAC olha para o dono do CLIENTE via join
(`customer: { ownerId: user.sub }`), não para um `ownerId` na própria
tabela. `OWNER_SCOPED_ROLES` é redeclarado localmente em cada service
(`orders.service.ts`, `invoices.service.ts`, `contracts.service.ts`) em vez
de importado de `ownership.ts`, seguindo o padrão já estabelecido na Fase 1
— seria uma boa limpeza futura extrair isso para uma constante compartilhada
se mais módulos precisarem do mesmo padrão de join.

Além disso, o dashboard financeiro e o registro/cancelamento de pagamento
são restritos por **RBAC** a `admin`/`gestor`/`financeiro` (vendedor não
acessa, mesmo sendo dono do cliente) — a sobreposição de `@Roles()` a nível
de método (`RolesGuard` usa `getAllAndOverride`, então uma anotação no
handler vence a do controller) é o que permite, por exemplo,
`InvoicesController` deixar `GET` aberto a vendedor mas restringir
`PATCH .../pay` e `PATCH .../cancel` aos três perfis financeiros.

## Portal do Cliente: hard lock por `customerId` (Fase 3)

O Portal do Cliente introduz um perfil (`cliente_portal`) que precisa de uma
regra de acesso **mais rígida** que o ABAC de vendedor acima, não mais uma
variação dele:

| | ABAC de vendedor | Hard lock do Portal |
|---|---|---|
| Quem tem a regra | só `vendedor` (`OWNER_SCOPED_ROLES`) | todo `cliente_portal`, sem exceção |
| Existe uma role que "vê tudo"? | sim (admin/gestor/financeiro) | não — não existe `cliente_portal` que veja mais de um cliente |
| Onde vive o filtro | `ownerScopeWhere`/`assertOwnership` (opcional, composto no `where`) | `PortalService.requireCustomerId` (obrigatório, é o único filtro) |
| O que acontece sem o atributo | não se aplica (role sem ABAC não filtra) | `ForbiddenException` — falha fechado |

Cada usuário `cliente_portal` tem exatamente um `customers.id` associado via
`users.customer_id` (migration `0004_fase3_portal_atendimento.sql`), colocado
no JWT no login (`AuthService.login`, só quando `user.customerId` existe) e
lido de volta em `request.user.customerId` (`AuthenticatedUser.customerId`).
`PortalController` só aceita `@Roles('cliente_portal')` — nenhum outro
perfil chega perto dessas rotas — e todo método de `PortalService`:

1. chama `requireCustomerId(user)` primeiro, que lança `ForbiddenException`
   se `customerId` não estiver no token (não deveria acontecer, mas nunca
   assume que aconteceu certo);
2. usa esse valor, e só ele, como filtro `customerId` em toda query —
   nunca um valor vindo do corpo/query da requisição;
3. em operações sobre um recurso já existente (ex.: `POST
   /portal/tickets/:id/comments`), reconfirma `customerId` no próprio
   `WHERE` da busca do recurso (não só no momento em que ele foi criado) —
   um `ticketId` de outro cliente, mesmo adivinhado corretamente, resulta em
   "não encontrado", nunca em um vazamento.

`PortalController.knowledge()` é a mesma lógica aplicada à base de
conhecimento: em vez de ensinar `KnowledgeController`/`RolesGuard` a aceitar
`cliente_portal` só para leituras "filtradas", o Portal nunca toca
`/knowledge` — chama `KnowledgeService.findPublished(tenantId)` diretamente,
que é a única forma de um artigo chegar ao cliente (só os publicados, sem
qualquer noção de dono).

`backend/src/modules/portal/portal.service.spec.ts` testa exatamente o
cenário que importa: com o token do cliente A, os `where` de
orders/invoices/tickets nunca contêm o `customerId` do cliente B, e um
`ticketId` do cliente B devolve `NotFoundException` em vez do comentário.
