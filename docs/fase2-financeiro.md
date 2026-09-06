# Fase 2 — Módulo Financeiro

Referência: roadmap (`spec/roadmap.md`, seção Fase 2) e a seção correspondente
da master spec. Este documento cobre o que foi construído, as simplificações
assumidas e como foi verificado — mesmo formato de `docs/fase1-crm-comercial.md`.

## O que entra nesta fase

- **Contas a receber** (`invoices`): parcelas geradas automaticamente a
  partir de um Pedido (`POST /orders/:orderId/invoices`), com valor dividido
  igualmente entre as parcelas (a última absorve o arredondamento) e datas
  de vencimento espaçadas por um intervalo configurável (padrão 30 dias).
  Status: `aberto` → `parcial`/`pago` (via registro de pagamento) ou
  `cancelado` (só permitido em `aberto`, sem pagamento registrado).
  "Vencido" não é um status gravado — é calculado na leitura
  (`aberto`/`parcial` com `due_date` no passado); ver comentário na migration
  `0003_fase2_financeiro.sql`.
- **Pagamentos**: `PATCH /invoices/:id/pay` aceita pagamento total ou
  parcial, com meio de pagamento (`pix`, `boleto`, `cartao` — só o rótulo é
  armazenado, não há integração real de cobrança nesta fase).
- **Dashboard financeiro** (`GET /finance/dashboard`): a receber, recebido,
  atrasado e um fluxo de caixa simplificado agrupado por mês de vencimento.
  Restrito a `admin`/`gestor`/`financeiro`.
- **Contratos** (`contracts`): vigência (`startDate`/`endDate`), valor,
  período de renovação em meses, e um endpoint de renovação
  (`PATCH /contracts/:id/renew`) que estende `endDate` — usa
  `renewalPeriodMonths` se `newEndDate` não for informado explicitamente.
  `expiringSoon`/`daysUntilExpiration` são calculados na leitura (contrato
  `ativo` vencendo em até 30 dias), servindo de "alerta" (spec).
- **Comissões** (`GET /finance/commissions`): soma o valor **recebido** (não
  só faturado) das faturas de pedidos de clientes que cada vendedor possui,
  multiplicado por `users.commission_rate` (novo campo, default 5%).
  Vendedor só vê a própria linha; demais perfis veem o relatório completo.
- **Score Financeiro** (`GET /finance/customers/:id/score`): heurística
  determinística — pontualidade (% de faturas pagas em dia), inadimplência
  (valor vencido / valor total faturado) e volume recebido — classificando
  o cliente em verde/amarelo/vermelho. Exposto também no Cliente 360°.

## Por que "Score Financeiro" aqui não é o "Score IA" da Fase 4

A spec descreve um Score IA calculado por aprendizado de máquina sobre
histórico de pontualidade, volume, inadimplência e tempo de relacionamento —
isso é explicitamente Fase 4 (Inteligência Artificial Corporativa), que ainda
não foi construída. O que existe agora é uma heurística determinística e
transparente (thresholds fixos: inadimplência > 30% → vermelho; inadimplência
> 10% OU pontualidade < 70% → amarelo; caso contrário → verde) — dá ao
Cliente 360° algo útil e explicável desde já, e deixa claro no código
(`FinanceService.customerScore`, com comentário) que é um placeholder a ser
substituído quando a Fase 4 chegar, não uma tentativa de já entregar IA.

## Simplificações assumidas nesta fase

- **Sem integração real de pagamento**: `pix`/`boleto`/`cartao` são só
  rótulos gravados na fatura — não há geração de QR code Pix, boleto
  registrado em banco, nem gateway de cartão. Registrar um pagamento é uma
  ação manual (alguém confirma que o dinheiro entrou).
- **Sem régua de cobrança automática** (spec: "D-5 email, D0 WhatsApp, D+3
  nova cobrança, D+15 escalonar"): isso exige integração real de
  email/WhatsApp e um job agendado, nenhum dos dois existe ainda no
  scaffold. O que existe é o cálculo de "vencido" e a listagem de faturas
  vencidas no dashboard — a régua automática fica para quando houver
  necessidade real de disparar essas comunicações.
- **Comissão sem quebra por produto/margem**: o pedido ainda não tem linha
  de produto (só valor total agregado — ver Fase 1), então a comissão é
  calculada sobre o valor recebido do pedido como um todo, não por item.
- **Contratos sem reajuste automático**: o campo de valor é fixo; um
  reajuste por índice (IGP-M, IPCA etc.) exigiria um job periódico e não foi
  necessário para o mínimo desta fase — hoje é uma edição manual do `value`.

## Verificação feita

- Backend: `tsc --noEmit`, `eslint`, `jest` (55 passed / 3 skipped — mesma
  causa documentada em `docs/setup.md`, dependente de `prisma generate`),
  `npm run build`. Testes novos cobrem: divisão de parcelas com
  arredondamento, bloqueio de gerar parcelas duas vezes, transições de
  pagamento (parcial/total), bloqueio de cancelar fatura já paga, ABAC em
  faturas/contratos (vendedor só acessa o que é seu), renovação de
  contrato (com e sem `newEndDate` explícito), classificação do Score
  Financeiro, e o relatório de comissões (incluindo o vendedor só ver a
  própria linha).
- Frontend: `eslint` e `next build` limpos, incluindo as páginas novas
  (`/dashboard/financeiro`, `/dashboard/contratos`) e as extensões ao
  Cliente 360° (seções Financeiro e Contratos, badge de Score).
- RLS reconfirmada ao vivo num Postgres 16 real nas 2 tabelas novas
  (`invoices`, `contracts`), com dois tenants simulados nunca vendo os
  dados um do outro — mesmo teste de sempre, incluindo o caso "sem
  `app.tenant_id` setado → 0 linhas".

## Próximo passo natural

Fase 3 — Portal do Cliente e Atendimento, conforme `spec/roadmap.md`.
