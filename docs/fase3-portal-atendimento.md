# Fase 3 — Portal do Cliente e Atendimento

Referência: roadmap (`spec/roadmap.md`, seção Fase 3) e a seção correspondente
da master spec. Este documento cobre o que foi construído, as simplificações
assumidas e como foi verificado — mesmo formato de `docs/fase2-financeiro.md`.

## O que entra nesta fase

- **`users.customer_id`**: novo campo que vincula um usuário com perfil
  `cliente_portal` a UM `Customer`. É o que permite ao `PortalService`
  descobrir "de qual cliente é este login" sem depender de nada vindo do
  corpo da requisição.
- **Gestão de acesso ao Portal** (`customers/:customerId/portal-logins`,
  admin/gestor): criar um login (`name`/`email`/`password`, hash Argon2id —
  mesmo helper do signup/login), listar os logins de um cliente, e
  ativar/desativar um login. Autoatendimento (o próprio cliente criar sua
  conta) fica fora do escopo desta fase — é sempre a empresa que provisiona.
- **`PortalModule`** (prefixo `/portal`, `@Roles('cliente_portal')` — nenhum
  outro perfil acessa): `GET /portal/me`, `GET /portal/orders`,
  `GET /portal/invoices`, `GET /portal/contracts`, `GET /portal/tickets`,
  `POST /portal/tickets`, `POST /portal/tickets/:id/comments`,
  `GET /portal/knowledge`. Todo endpoint é **hard-locked** por
  `user.customerId` — não é um filtro opcional como o ABAC de vendedor, é o
  único filtro que existe: não há noção de "cliente_portal vê tudo".
- **`TicketsModule`** (`/tickets`, atendimento interno): abrir, listar,
  detalhar, mudar status e comentar um chamado. ABAC igual a
  orders/invoices/contracts — vendedor só vê chamados de clientes que possui
  (join `customer: { ownerId: user.sub }`); admin/gestor/financeiro veem
  tudo do tenant.
- **SLA**: calculado no momento da criação a partir da `priority`
  (`urgente`=4h, `alta`=8h, `media`=24h, `baixa`=72h a partir de agora) e
  gravado em `sla_due_at` — não se move se a prioridade for alterada depois
  da abertura.
- **`KnowledgeModule`** (`/knowledge`): autoria (criar/editar/excluir)
  restrita a admin/gestor; leitura aberta a todos os perfis internos. O
  Portal nunca chama `/knowledge` diretamente — `PortalController.knowledge()`
  delega para `KnowledgeService.findPublished()`, que só devolve artigos
  `isPublished = true`. Essa separação é deliberada: manter o RolesGuard de
  `/knowledge` simples (só perfis internos) em vez de ensiná-lo a diferenciar
  "leitura completa" de "só publicados".
- **`WebhooksModule`** (`/webhooks`, admin-only CRUD): cada assinatura tem
  uma `url`, uma lista de `events` e um `secret` gerado pelo servidor
  (nunca escolhido pelo cliente, nunca devolvido em texto puro depois da
  criação — só uma vez, na resposta do `POST`). `WebhooksService.dispatch()`
  é best-effort/fire-and-forget: assina o corpo com HMAC-SHA256 usando o
  `secret` da assinatura (header `X-Webhook-Signature`) e nunca deixa uma
  falha de entrega (timeout, DNS, 500 do destino) propagar para quem chamou.
  Eventos disparados: `order.created` (`QuotesService.approve`),
  `invoice.paid` (`InvoicesService.registerPayment`, só quando a fatura
  chega a 100% paga), `ticket.updated` (`TicketsService.updateStatus`), e
  `contract.expiring` — este último via um `@Cron` diário
  (`EVERY_DAY_AT_6AM`) que varre contratos `ativo` de **todos os tenants**
  vencendo em até 7 dias usando `PrismaAdminService` (3º uso sancionado de
  BYPASSRLS — ver `docs/architecture.md`).
- **Frontend interno**: `/dashboard/chamados` (lista + abrir chamado) e
  `/dashboard/chamados/[id]` (detalhe + trocar status + comentar),
  `/dashboard/base-de-conhecimento` (lista + criar, formulário só visível a
  admin/gestor), `/dashboard/webhooks` (CRUD, admin-only — mostra o secret
  uma única vez ao criar). Cliente 360° ganhou a seção "Portal do Cliente —
  Acesso" (criar/listar/ativar-desativar logins).
- **Frontend do Portal** (`/portal`, route group próprio): dashboard
  resumo, pedidos, financeiro (faturas), contratos, chamados (lista + abrir
  + comentar — sem tela de detalhe separada, o card já expande com a
  thread de comentários) e uma página de ajuda (artigos publicados). Login
  redireciona para `/portal` quando `role === 'cliente_portal'` e para
  `/dashboard` nos demais casos; cada layout tem o guard espelhado (um
  `cliente_portal` que tentar abrir `/dashboard` é redirecionado para
  `/portal`, e vice-versa).

## Isolamento — por que o Portal é mais rígido que o ABAC de vendedor

O ABAC de `vendedor` (`ownerScopeWhere`/`assertOwnership`/`resolveOwnerId` em
`common/crm/ownership.ts`) é um filtro **opcional por perfil**: a mesma
função devolve "sem filtro extra" para admin/gestor/financeiro e "só o que é
meu" para vendedor. O Portal não tem essa variação — não existe perfil
`cliente_portal` que "veja tudo do tenant". Por isso o `PortalService` nunca
reusa `ownership.ts`: ele implementa um `requireCustomerId(user)` que lança
`ForbiddenException` se o token não tiver `customerId` (nunca deveria
acontecer, mas falha fechado em vez de arriscar devolver dados de todo o
tenant) e usa esse valor, e só ele, em todo `where` — inclusive
"reconfirmando" o `customerId` dentro do próprio `WHERE` ao comentar um
chamado (`addComment`), não só na criação, então um `ticketId` de outro
cliente adivinhado por tentativa e erro nunca é encontrado. Ver
`docs/security-multitenancy.md` para o detalhamento completo, incluindo o
testes de "cliente A nunca vê dados do cliente B mesmo adivinhando IDs".

## Simplificações assumidas nesta fase

- **Sem anexos em chamados**: comentários são só texto — upload de arquivo
  (print de erro, comprovante) fica fora do escopo mínimo.
- **Sem chat em tempo real/WebSockets**: a "conversa" de um chamado é uma
  lista de comentários recarregada a cada ação (mesmo padrão request/response
  do resto do sistema) — não há push nem indicador de "digitando".
- **Sem histórico de entregas de webhook**: `dispatch()` é fire-and-forget
  puro — não existe tabela de log de entregas, não há retry automático nem
  botão de "reenviar". Se o endpoint do cliente estiver fora do ar no
  momento do evento, a notificação se perde (só fica o log de erro do
  backend). Uma fila de retry com backoff é a evolução natural quando isso
  virar necessidade real.
- **`contract.expiring` é diário, não em tempo real**: o cron roda uma vez
  por dia (`EVERY_DAY_AT_6AM`); um contrato que passa a vencer em ≤7 dias
  entre duas execuções só dispara na próxima varredura, nunca no instante
  exato em que passa a se qualificar.
- **Autoatendimento do login do Portal não existe**: é sempre a empresa
  (admin/gestor) que cria o acesso do cliente — não há fluxo de "esqueci
  minha senha" nem de o próprio cliente se cadastrar sozinho.
- **Extrato/2ª via de boleto não implementados**: o Financeiro do Portal
  mostra a lista de faturas com status/vencimento — geração de boleto/Pix de
  verdade continua fora do escopo (mesma simplificação de pagamento da
  Fase 2, sem gateway real).

## Verificação feita

- Backend: `tsc --noEmit`, `eslint --fix` (0 erros), `jest`
  (95 passed / 3 skipped — mesma causa documentada em `docs/setup.md`,
  dependente de `prisma generate`), `npm run build`. Testes novos cobrem:
  cálculo de SLA por prioridade, ABAC de chamados (vendedor vs.
  admin/gestor/financeiro), hard-lock do Portal (cliente A nunca vê pedido/
  fatura/chamado de cliente B mesmo adivinhando IDs, e falha fechado sem
  `customerId` no token), geração/verificação de assinatura HMAC,
  `dispatch()` nunca lançando mesmo com falha de rede ou de banco,
  disparo condicional de `invoice.paid` só quando a fatura fica 100% paga,
  criação/toggle de login de portal (nunca devolve `passwordHash`), e
  `WebhooksService.findAll`/`toggle` nunca expondo o `secret` de novo.
- Frontend: `eslint` e `next build` limpos, incluindo as páginas novas
  (`/dashboard/chamados[+detalhe]`, `/dashboard/base-de-conhecimento`,
  `/dashboard/webhooks`, todo o route group `/portal`) e a extensão ao
  Cliente 360° (seção de acesso ao Portal).
- RLS reconfirmada ao vivo num Postgres 16 real nas 4 tabelas novas
  (`tickets`, `ticket_comments`, `knowledge_articles`,
  `webhook_subscriptions`) e na coluna `users.customer_id`, com dois
  tenants simulados nunca vendo os dados um do outro — mesmo teste de
  sempre: sem `app.tenant_id` setado → 0 linhas; contexto = Tenant A →
  só dados do Tenant A aparecem; contexto = Tenant A com `WHERE`
  pedindo Tenant B (simula bug na Camada 2) → 0 linhas mesmo assim.

## Próximo passo natural

Fase 4 — Inteligência Artificial Corporativa, conforme `spec/roadmap.md`.
