# Fase 7 — Pedido: conversão e gestão ampliada (RF012, spec v3.1)

Segunda fase da atualização de especificação v3.1 (Quote-to-Cash), depois
da Fase 6 (Propostas). Ver `spec/crm-enterprise-master-spec-v3.md` (seção
26) e `spec/roadmap.md` no projeto Claude para o contexto completo.

## O que muda em relação às Fases 1-6

Até a Fase 6, aprovar uma proposta (`PATCH /quotes/:id/approve`) fazia duas
coisas na mesma transação: fechar a oportunidade como ganha **e** criar o
Pedido automaticamente, herdando só o `totalValue` da proposta — sem
revisão, sem itens próprios, sem prazo de entrega ou condição de pagamento.
A partir da Fase 7:

1. `approve()` só fecha a oportunidade como ganha. Não cria mais nada em
   `orders`.
2. Um novo passo explícito e revisável, `PATCH
   /quotes/:id/convert-to-order`, cria o Pedido — com itens, prazo de
   entrega, condição de pagamento e observações internas, todos opcionais
   (sem nada informado, herda os itens/valor da própria proposta).
3. Pedido também pode ser criado **manualmente**, sem proposta associada
   (`POST /orders`) — para uma venda direta.
4. Pedido ganhou edição (`PATCH /orders/:id`: itens, prazo de entrega,
   condição de pagamento, observações internas) e uma tela própria de
   gestão (`/dashboard/pedidos`), além de mudança de status pela primeira
   vez na UI (o endpoint `PATCH /orders/:id/status` já existia desde a
   Fase 1, mas nenhuma tela usava — pedidos ficavam presos em
   "confirmado" para sempre).

## Banco de dados (`database/migrations/0008_fase7_pedidos.sql`)

- `orders` ganha 4 colunas: `delivery_date`, `payment_terms`,
  `internal_notes`, `items` (jsonb — nulo em pedidos criados antes desta
  coluna existir, sem itens retroativos fabricados).
- Índice único parcial `idx_orders_quote_id_unique` — uma proposta só pode
  virar pedido uma vez, garantido no banco (segunda camada, além da
  checagem em `QuotesService.convertToOrder`).
- `quote_id` já era opcional desde `0002_fase1_crm.sql` — a Fase 7 é a
  primeira a de fato criar um pedido sem ele (pedido manual).

## Backend

- `QuotesService.approve()`: simplificado — só `quote.status = 'aprovada'`
  + `opportunity.stage = 'fechado_ganho'`, na mesma transação. Não dispara
  mais `order.created` (não há mais pedido criado aqui).
- `QuotesService.convertToOrder()` (novo): valida que a proposta está
  `aprovada`, valida que ainda não foi convertida (`tx.order.findFirst`
  por `quoteId` — janela de corrida teórica coberta pelo índice único
  parcial), cria o pedido com itens/valor da proposta ou os informados no
  DTO, dispara `order.created`.
- `OrdersService.create()` (novo): pedido manual — `customerId` validado
  via `CustomersService.assertAccessible` (ABAC: vendedor só cria pedido
  para cliente que é seu), dispara `order.created`.
- `OrdersService.update()` (novo): edição de itens/prazo/condição/
  observações — **recusa alterar itens se o pedido já tem fatura gerada**
  (`ConflictException`), para não dessincronizar o financeiro do que já
  foi cobrado; os demais campos continuam editáveis livremente.
- ABAC pré-existente reaproveitado sem alteração: `OrdersService` já olhava
  para o dono do cliente (não tem `ownerId` próprio), `CustomersService`
  para o dono do próprio cliente.

## Frontend

- `/dashboard/pedidos` (novo): lista global de pedidos — cliente, origem
  (número da proposta ou "Manual"), prazo de entrega, condição de
  pagamento, valor, status (editável via `<select>` na própria linha),
  botão de editar. "Novo pedido" no topo para criação manual.
- Cliente 360° (`clientes/[id]`): cada proposta aprovada sem pedido ainda
  ganhou o botão "Converter em Pedido" (abre `ConvertQuoteToOrderForm`,
  itens pré-preenchidos e editáveis); uma vez convertida, mostra um badge
  com o status do pedido em vez do botão. A seção "Pedidos" ganhou seletor
  de status, prazo de entrega/condição de pagamento (quando informados) e
  um botão de editar.
- `ConvertQuoteToOrderForm`, `NewOrderForm` e `EditOrderForm`
  compartilham `OrderItemsFields` (mesmo editor de linhas de item já usado
  em `NewQuoteForm` desde a Fase 1/6, extraído para não triplicar o JSX).
- `EditOrderForm` só envia `items` no PATCH se o usuário de fato mexeu
  neles (comparação com um snapshot capturado na primeira renderização) —
  enviar sempre faria toda edição (mesmo só de uma observação) esbarrar na
  trava do backend contra alterar itens com fatura já gerada.

## Simplificações assumidas (revisar quando fizer sentido)

- Sem tela de detalhe por pedido (`/dashboard/pedidos/:id`) — mesma
  decisão de escopo já tomada para propostas na Fase 6 (sem
  `/dashboard/propostas/:id`); a lista global + os drawers de editar já
  cobrem o necessário por ora.
- `EditOrderForm`/`ConvertQuoteToOrderForm` não suportam "limpar" um campo
  opcional já preenchido (prazo de entrega, condição de pagamento,
  observações) — um campo deixado em branco no formulário simplesmente não
  é enviado no PATCH, então o valor anterior permanece. Editar para outro
  valore funciona normalmente; só a remoção explícita não tem um caminho
  dedicado ainda.
- Pedido manual não passa por nenhuma oportunidade/pipeline — é
  deliberadamente um atalho para venda direta, não um substituto do fluxo
  Lead → Oportunidade → Proposta.

## Verificação feita

Backend: `tsc --noEmit` (0 erros), `eslint --fix` (0 erros), `jest` (194
passed / 3 skipped, acima dos 185 da Fase 6 — 9 testes novos: 5 de
`OrdersService` + 4 de `QuotesService.convertToOrder`/`approve`
reescritos). Frontend: `eslint` (0 erros), `next build` (compila todas as
rotas, incluindo a nova `/dashboard/pedidos`).
