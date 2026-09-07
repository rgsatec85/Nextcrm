# Setup local

## Pré-requisitos

- Node.js 22+
- Docker (para Postgres + Redis locais) — ou um Postgres 15+ já instalado, se preferir
- npm 10+

## 1. Banco de dados local

**Com Docker (recomendado):**

```bash
docker compose -f infrastructure/docker-compose.yml up -d
```

Isso sobe Postgres na porta 5432 (já aplicando `database/migrations/*.sql`
automaticamente na primeira subida) e Redis na porta 6379.

**Sem Docker** (Postgres já instalado na máquina):

```bash
createdb crm_enterprise
psql crm_enterprise -f database/migrations/0001_init.sql
```

## 2. Backend

```bash
cd backend
cp .env.example .env
npm install
npm run prisma:generate
npm run start:dev
```

A API sobe em `http://localhost:3001/api`. Teste rapidamente:

```bash
curl http://localhost:3001/api/health
# {"status":"ok","timestamp":"..."}

curl -X POST http://localhost:3001/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "companyName": "Empresa Teste",
    "cnpj": "11111111000191",
    "adminName": "Admin",
    "adminEmail": "admin@teste.com",
    "adminPassword": "senha-com-doze-chars"
  }'
```

## 3. Frontend

Em outro terminal:

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Acesse `http://localhost:3000`. O fluxo completo: `/cadastro` → cria a
empresa e já loga → `/dashboard` (lista os usuários da empresa, puxados do
backend). `/login` para empresas já cadastradas.

A partir da Fase 1, o menu do dashboard também tem:

- `/dashboard/clientes` — lista de clientes + cadastro rápido.
- `/dashboard/clientes/[id]` — Cliente 360°: contatos, oportunidades,
  propostas versionadas (com fluxo enviar → aprovar/rejeitar — aprovar gera
  Pedido automaticamente), pedidos e agenda de atividades.
- `/dashboard/pipeline` — Kanban de oportunidades por estágio, com criação de
  nova oportunidade e troca de estágio por card.

A partir da Fase 2 (Módulo Financeiro), também tem:

- `/dashboard/financeiro` — dashboard financeiro (a receber, recebido,
  atrasado, fluxo de caixa por mês, faturas vencidas) e o relatório de
  comissões. Restrito a admin/gestor/financeiro (vendedor vê só a própria
  comissão).
- `/dashboard/contratos` — lista de contratos com alerta de vencimento
  (`expiringSoon`) e renovação.
- O Cliente 360° (`/dashboard/clientes/[id]`) ganhou seções de Financeiro
  (faturas do cliente, com registrar pagamento/cancelar) e Contratos, além
  de um badge de Score Financeiro ao lado do status do cliente.

A partir da Fase 3 (Portal do Cliente e Atendimento), também tem:

- `/dashboard/chamados` — lista de chamados + abrir novo; `/dashboard/chamados/[id]`
  — detalhe com troca de status e comentários.
- `/dashboard/base-de-conhecimento` — lista de artigos; formulário de criação
  só aparece para admin/gestor.
- `/dashboard/webhooks` — CRUD de assinaturas (admin-only); o secret gerado
  no `POST` é mostrado uma única vez, na hora da criação.
- O Cliente 360° ganhou a seção "Portal do Cliente — Acesso" (criar/listar/
  ativar-desativar logins de portal para aquele cliente, admin/gestor).
- Um novo route group `/portal`, para o perfil `cliente_portal` — dashboard
  resumo, `/portal/pedidos`, `/portal/financeiro`, `/portal/contratos`,
  `/portal/chamados` (lista + abrir + comentar) e `/portal/base-de-conhecimento`
  (só artigos publicados). O login redireciona automaticamente para `/portal`
  quando a conta é `cliente_portal`, e para `/dashboard` nos demais casos —
  cada layout também redireciona o perfil errado para o lado certo se ele
  tentar acessar a URL diretamente.

A partir da Fase 4 (Inteligência Artificial Corporativa), também tem:

- `/dashboard/assistente` — chat simples ("quais clientes possuem mais de
  R$X mil vencidos", "resuma o cliente X"), com as perguntas suportadas
  exibidas explicitamente na tela.
- O Cliente 360° ganhou a seção "Resumo IA" e o badge "Score IA" (o Score
  Financeiro da Fase 2 continua visível ao lado, rotulado como superseded).
- O Pipeline ganhou a previsão heurística de fechamento no topo e, por
  card, os botões sob demanda "Sugestão de IA" (próxima ação) e "Rascunho
  de email".
- O Financeiro ganhou a seção "Cobranças Inteligentes" (faturas vencidas
  com prioridade/canal sugeridos).
- Novas variáveis de ambiente do backend: `AI_PROVIDER` (`deterministic`
  por padrão, `ollama` para usar um servidor Ollama self-hosted real),
  `OLLAMA_BASE_URL` (default `http://localhost:11434`) e `OLLAMA_MODEL`
  (default `llama3`) — só relevantes quando `AI_PROVIDER=ollama`. Ver
  `docs/fase4-ia-corporativa.md`.

A partir da Fase 5 (Hardening, Escala e Observabilidade), também tem:

- `GET /api/health/ready` — health check de prontidão (banco + Redis se
  configurado), separado do `GET /api/health` de sempre (liveness, usado
  pelo Render). Ver `docs/fase5-hardening-observabilidade.md`.
- Rate limiting passa a usar Redis quando `REDIS_URL` está configurado
  (opcional — sem ele, continua em memória como sempre foi).
- Novas variáveis de ambiente do backend, todas opcionais: `REDIS_URL` (já
  existia no `.env.example` desde a Fase 0, mas só passou a ser usada
  nesta fase), `OTEL_EXPORTER_OTLP_ENDPOINT` e `OTEL_SERVICE_NAME`
  (observabilidade — sem a primeira definida, o OpenTelemetry SDK não
  inicia). Ver `docs/observability.md`.
- Stack de observabilidade local opcional:
  ```bash
  docker compose -f infrastructure/docker-compose.observability.yml up -d
  ```
  Sobe OTel Collector + Prometheus + Loki + Promtail + Grafana
  (`http://localhost:3300`). Ver `docs/observability.md`.
- Novos docs: `docs/nfr-slo.md` (metas de SLA/RPO/RTO/latência propostas
  por tier de capacidade), `docs/scaling-checklist.md` (checklist de
  dashboard para escalar Supabase/Render/Vercel) e
  `docs/fase5-hardening-observabilidade.md` (visão geral da fase).

## Redesign visual do dashboard interno (UI-only, sem numeração de Fase)

O dashboard interno (`/dashboard/**`) passou por uma modernização puramente
visual/interação — nenhuma regra de negócio mudou. O que é diferente ao usar:

- O menu principal virou uma **sidebar lateral com ícones**, colapsável (o
  botão no rodapé da sidebar recolhe para só ícones — a preferência fica
  salva no navegador). O antigo header horizontal foi removido.
- **Todo cadastro (Novo cliente, Nova oportunidade, Novo contrato, Novo
  contato, Nova atividade, Abrir chamado, Novo artigo, Nova assinatura de
  webhook, Novo acesso ao portal, Nova proposta, Gerar parcelas, Registrar
  pagamento) agora abre num painel lateral (drawer) a partir de um botão
  "Novo X"** — a grid/lista em si só mostra dados, nunca um formulário
  exposto. A lógica de validação/envio de cada formulário não mudou, só
  onde e como ele é acionado.
- Dashboard, Pipeline, Financeiro, Contratos e Chamados ganharam **KPIs e
  gráficos** (biblioteca `recharts`), reaproveitando dados que os próprios
  endpoints já retornavam (nenhum endpoint novo no backend).
- Ícones em todo o menu e nos cabeçalhos de seção vêm de `lucide-react`.
- Portal do Cliente (`/portal/**`) e as páginas de autenticação
  (`/login`, `/cadastro`) **não foram tocados** nesta rodada.

Detalhes de decisões de design (paleta, como trocar de marca depois,
padrão de drawer, o que ficou de fora) em `docs/fase-ui-modernizacao.md`.

## 4. Rodando testes e verificações

```bash
# Backend
cd backend
npm run lint
npm test
npm run build

# Frontend
cd frontend
npm run lint
npm run build
```

## Nota sobre o ambiente onde este scaffold foi gerado

Este projeto foi construído e verificado em um sandbox com acesso de rede
restrito (só o registry do npm é alcançável). Isso impediu rodar
`prisma generate` de verdade nesse ambiente específico, porque o Prisma
baixa o "query engine" nativo de `binaries.prisma.sh`, um host fora do
allowlist — em qualquer máquina/CI com internet normal (sua máquina, GitHub
Actions, Render) isso funciona sem nenhuma ação extra.

O que foi validado mesmo com essa restrição:

- A migration SQL (`database/migrations/0001_init.sql`) foi aplicada de
  verdade em um Postgres 16 local, e o isolamento por Row Level Security foi
  testado manualmente com dois tenants simulados — inclusive o cenário de
  "bug no filtro do backend" (`WHERE tenant_id = tenant errado`, que ainda
  assim retornou zero linhas). Detalhes em `docs/security-multitenancy.md`.
- `tsc --noEmit`, `eslint` e os testes unitários (`jest`) do backend passam
  100% (os 3 testes que exigem uma instância real do Prisma Client
  detectam a ausência do client gerado e pulam com uma mensagem clara, em
  vez de falhar sem explicação).
- O frontend (Next.js 16 + React 19) builda, linta e roda sem erros.

Assim que você rodar `npm run prisma:generate` com internet disponível, os 3
testes que hoje aparecem como "skipped" passam a rodar normalmente.

A Fase 1 (CRM Comercial) foi verificada com a mesma abordagem: RLS reconferida
ao vivo nas 6 tabelas novas (`customers`, `contacts`, `opportunities`,
`quotes`, `orders`, `activities`) com dois tenants simulados, `tsc`/`eslint`/
`jest` 100% no backend, e `eslint`/`next build` 100% no frontend — incluindo
as três páginas novas (`/dashboard/clientes`, `/dashboard/clientes/[id]`,
`/dashboard/pipeline`).

A Fase 2 (Módulo Financeiro) seguiu o mesmo processo, nas 2 tabelas novas
(`invoices`, `contracts`) e nas duas páginas novas (`/dashboard/financeiro`,
`/dashboard/contratos`) — detalhes em `docs/fase2-financeiro.md`.

A Fase 3 (Portal do Cliente e Atendimento) seguiu o mesmo processo, nas 4
tabelas novas (`tickets`, `ticket_comments`, `knowledge_articles`,
`webhook_subscriptions`) e na coluna `users.customer_id`, mais todas as
páginas novas do dashboard interno e o route group `/portal` inteiro —
detalhes em `docs/fase3-portal-atendimento.md`.

A Fase 4 (Inteligência Artificial Corporativa) seguiu o mesmo processo, na
1 tabela nova (`ai_query_logs`) e na página nova
(`/dashboard/assistente`) mais as extensões ao Cliente 360°, Pipeline e
Financeiro — com a ressalva adicional de que o `OllamaAiProvider` é código
real e funcional, mas não exercitado pelos testes automatizados por falta
de rede alcançando um servidor Ollama neste sandbox (o `DeterministicAiProvider`,
usado por padrão e por todos os testes, não depende de rede nenhuma).
Detalhes em `docs/fase4-ia-corporativa.md`.

A Fase 5 (Hardening, Escala e Observabilidade) seguiu o mesmo processo para
a parte de código (`tsc`/`eslint`/`jest`/`build` 100% no backend, 13 testes
novos — `RedisThrottlerStorageService`, `RedisService`, `HealthController`
— nenhuma tabela nova, nenhuma mudança no frontend). A parte de
infraestrutura/observabilidade teve uma limitação adicional deste sandbox,
diferente das anteriores: o Docker Engine está disponível aqui (diferente
do "sem acesso a `binaries.prisma.sh`" citado acima), e
`infrastructure/docker-compose.observability.yml` foi validado
sintaticamente (`docker compose config`, `yaml.safe_load` em cada arquivo)
sem erros — mas o `docker pull` das imagens (Prometheus, Grafana, Loki,
OTel Collector, Promtail) é bloqueado pela política de rede de saída deste
ambiente (HTTP 403 em qualquer registry testado, Docker Hub e ghcr.io
inclusive), então o stack nunca chegou a rodar de ponta a ponta aqui. Em
qualquer máquina/CI com acesso normal a registries de containers, isso
deve funcionar sem nenhuma ação extra — mas vale confirmar na primeira vez.
Detalhes em `docs/fase5-hardening-observabilidade.md` e
`docs/observability.md`.
