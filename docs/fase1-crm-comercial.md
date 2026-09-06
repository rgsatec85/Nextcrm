# Fase 1 — CRM Comercial

Referência: spec §9 (Pipeline/Oportunidades), §10 (Cliente 360°), §11
(Propostas), roadmap (`spec/roadmap.md`, seção Fase 1). Este documento cobre
o que foi construído, as simplificações assumidas e como foi verificado.

## O que entra nesta fase

- **Clientes** (`customers`) e **Contatos** (`contacts`): cadastro de
  empresas/pessoas clientes e seus pontos de contato.
- **Oportunidades** (`opportunities`): pipeline com 6 estágios (`lead` →
  `qualificacao` → `proposta` → `negociacao` → `fechado_ganho` /
  `fechado_perdido`), exibido como Kanban.
- **Propostas** (`quotes`): versionadas por oportunidade
  (`UNIQUE(opportunity_id, version)`), com máquina de estados `rascunho` →
  `enviada` → `aprovada` | `rejeitada`.
- **Pedidos** (`orders`): criados **automaticamente** quando uma proposta é
  aprovada — nunca existe um pedido "solto" sem proposta de origem, e a
  aprovação também fecha a oportunidade como `fechado_ganho`, tudo numa única
  transação (`QuotesService.approve`).
- **Atividades/Agenda** (`activities`): reuniões, ligações, follow-ups e
  notas, ligadas a um cliente e/ou a uma oportunidade, com um campo
  `doneAt` para marcar conclusão.

## ABAC: vendedor só vê o que é seu

Além do isolamento por tenant (RLS, ver `docs/security-multitenancy.md`), o
perfil `vendedor` tem uma segunda restrição: só acessa registros onde é o
`ownerId`. Implementado uma única vez em
`backend/src/common/crm/ownership.ts` e reusado por todos os 6 módulos —
nenhum service reimplementa essa regra. `admin`, `gestor` e `financeiro` não
são afetados.

## Simplificações assumidas nesta fase (documentadas para revisão)

- **Kanban sem drag-and-drop**: a troca de estágio de uma oportunidade é
  feita por um `<select>` no card (`ChangeStageSelect`), não por
  arrastar-e-soltar. Drag-and-drop é puramente uma melhoria de UI — o
  endpoint (`PATCH /opportunities/:id/stage`) já é o mesmo que uma
  implementação com drag-and-drop chamaria.
- **Sem geração de PDF de proposta**: `quotes.items` guarda os itens como
  `jsonb`, e a proposta é editável enquanto `rascunho`. Exportar como PDF
  para enviar ao cliente é um passo natural para a Fase 1.1 ou junto da Fase
  2, mas não estava no critério mínimo desta fase.
- **Sem notificação por email** ao mudar status de proposta ou criar
  atividade — a spec não detalha isso na seção 25 (que ficou em aberto, ver
  roadmap), então não foi assumido.
- **Formulário de proposta sem cálculo de impostos/descontos por item** —
  `totalValue` é a soma simples de `quantity * unitPrice`; regras fiscais
  ficam para o Módulo Financeiro (Fase 2), quando o "Score Financeiro" e
  integrações fiscais entram no escopo.

## Frontend

Três páginas novas em `frontend/src/app/(dashboard)/dashboard/`:

- `clientes/page.tsx` — lista de clientes + formulário de criação.
- `clientes/[id]/page.tsx` — Cliente 360°: uma tela só, reunindo contatos,
  oportunidades (com suas propostas e ações de enviar/aprovar/rejeitar
  embutidas), pedidos e agenda.
- `pipeline/page.tsx` — Kanban por estágio + criação de oportunidade com
  seletor de cliente.

Todas as mutações client-side passam pelo proxy autenticado
`frontend/src/app/api/crm/[...path]/route.ts`, que injeta o JWT do cookie
httpOnly como header antes de repassar ao backend — nenhum componente client
tem acesso direto ao token (mesma lógica de segurança da Fase 0, spec §17).

## Verificação feita

- Backend: `tsc --noEmit`, `eslint`, `jest` (38 passed / 3 skipped — os 3
  seguem dependentes de `prisma generate`, ver `docs/setup.md`), `npm run
  build`.
- Frontend: `eslint` e `next build` (Next.js 16, Turbopack) limpos, incluindo
  as 3 páginas novas e a rota de proxy dinâmica.
- RLS reconfirmada ao vivo num Postgres 16 real: dois tenants simulados,
  cada um só enxergando seus próprios `customers` mesmo com as duas linhas
  fisicamente na mesma tabela (mesmo teste de defesa em profundidade da Fase
  0, repetido nas 6 tabelas novas).

## Próximo passo natural

Fase 2 — Módulo Financeiro (Score Financeiro, contas a pagar/receber,
inadimplência), conforme `spec/roadmap.md`.
