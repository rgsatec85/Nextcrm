# Fase 6 — Propostas como entidade própria (RF011, spec v3.1)

Primeira fase da atualização de especificação v3.1 (Quote-to-Cash), que
transforma o CRM num fluxo completo Lead → Oportunidade → Proposta →
Pedido → Contrato → Faturamento/Cobrança. Ver
`spec/crm-enterprise-master-spec-v3.md` (seção 26) e `spec/roadmap.md` no
projeto Claude para o contexto completo da atualização e o sequenciamento
das próximas fases (Pedido, Contratos, Financeiro AP).

## O que muda em relação à Fase 1

Na Fase 1, `quotes` já existia (versionamento simples por oportunidade,
máquina de estados rascunho → enviada → aprovada/rejeitada), mas era só um
registro de itens — sem numeração comercial, sem validade, sem PDF, sem
noção de "vencedora", sem modelos reutilizáveis. A Fase 6 adiciona tudo
isso sem alterar o fluxo já existente (uma proposta aprovada continua
gerando o Pedido automaticamente e fechando a oportunidade como ganha).

## Banco de dados (`database/migrations/0007_fase6_propostas.sql`)

- Tabela nova `proposal_templates`: `name`, `category` (texto livre — ver
  nota de "sem enum fechado" abaixo), `logo_url`, `primary_color`,
  `header_text`, `footer_text`, `clauses`, `is_active`, campos padrão
  (`tenant_id`, timestamps, RLS).
- `quotes` ganha: `number` (texto, único por tenant entre os não-nulos via
  índice parcial), `valid_until` (date), `template_id` (FK para
  `proposal_templates`, `ON DELETE SET NULL` — perder o modelo não deve
  quebrar a proposta), `is_winner` (boolean, default `false`).
- Novo valor `'expirada'` no `CHECK` de status de `quotes` (constraint
  recriada).
- Índice único parcial `idx_quotes_one_winner_per_opportunity` — garante
  no banco que só existe uma proposta vencedora por oportunidade, mesmo
  que um bug de aplicação tentasse marcar duas.

### Por que `category` é texto livre, não um enum

Mesma decisão já tomada para `company_size`/`lead_source` na expansão de
cadastro de cliente: categorias de proposta variam por negócio
(consultoria, locação, venda de produto...) e travar isso num `CHECK`
obrigaria uma migration toda vez que um tenant precisasse de uma categoria
nova. A UI sugere valores (`PROPOSAL_TEMPLATE_CATEGORY_LABELS`) via
`<datalist>`, mas qualquer texto é aceito e exibido como está.

## Backend

- `ProposalTemplatesModule` (`backend/src/modules/proposal-templates/`):
  CRUD + `PATCH :id/toggle` (desativação lógica — nunca exclui um modelo já
  referenciado por propostas existentes). Leitura aberta a
  admin/gestor/vendedor/financeiro; criar/editar/toggle restrito a
  admin/gestor (`@Roles` no controller, mesmo padrão de
  `KnowledgeController` na Fase 3).
- `QuotesService`:
  - `create()` agora calcula `number` (`PROP-{ano}-{sequência
    zero-padded}`) a partir de `tx.quote.count({ where: { tenantId } })`
    dentro da mesma transação — **não é perfeitamente à prova de corrida**
    sob concorrência extrema (duas criações simultâneas no mesmo tenant
    poderiam, em teoria, calcular o mesmo número); o índice único parcial
    do banco é a segunda camada que impede uma colisão de ser salva
    silenciosamente — a criação falharia e o usuário tentaria de novo. Um
    sequence dedicado do Postgres seria mais robusto se o volume de
    criações simultâneas um dia justificar a complexidade extra.
  - `findAll()` corrigido para aplicar `ownerScopeWhere(user)` (ABAC) via
    `opportunity.ownerId` — gap pré-existente da Fase 1 (não introduzido
    aqui, mas encontrado ao estender o método): `vendedor` podia ver
    propostas de oportunidades de outros donos.
  - `markWinner()`: transação que desmarca qualquer outra vencedora da
    mesma oportunidade antes de marcar esta — nunca duas vencedoras ao
    mesmo tempo, nem por um instante.
  - `pdf()` + `ProposalPdfService`: monta o PDF via `pdfkit` — cabeçalho/
    cláusulas/rodapé do modelo selecionado (se houver) com substituição de
    campos dinâmicos, itens, totais, dados de cliente/oportunidade/dono.
- `substituteTemplateFields()` (`quotes/template-fields.ts`): troca simples
  de `{{chave}}` por valor (regex), chave ausente vira string vazia — não é
  um motor de template completo (sem condicionais/loops), decisão
  deliberada para manter a geração de PDF sempre robusta a um campo
  digitado errado no modelo.

### Por que `pdfkit`, não Puppeteer/Playwright

`pdfkit` é puro JavaScript — não precisa baixar um binário de navegador
headless. Este sandbox já teve o download do engine do Prisma bloqueado
pela política de rede (`binaries.prisma.sh`, ver nota em todas as fases
anteriores) e pull de imagem Docker bloqueado na Fase 5 — `pdfkit` evita
deliberadamente repetir esse padrão de falha em produção (Render também
teria que baixar um Chromium para Puppeteer funcionar).

## Frontend

- `/dashboard/propostas`: lista global de propostas do tenant (fora do
  contexto de uma oportunidade específica) — número, cliente, oportunidade,
  validade, valor, status, badge de vencedora, KPIs de total/aguardando
  decisão/valor total/vencedoras. ABAC já filtra no backend (vendedor só
  vê o que é seu).
- `/dashboard/propostas/modelos`: biblioteca de modelos — leitura para
  todos os perfis internos, ações de criar/editar/desativar visíveis só
  para admin/gestor (espelha a restrição do backend, não é a única
  camada).
- `NewQuoteForm` ganhou campo de validade e seletor de modelo (só aparece
  se houver ao menos um modelo carregado).
- `QuoteActions` ganhou "Baixar PDF" (link para
  `/api/crm/quotes/:id/pdf`, funciona em qualquer status) e "Marcar como
  vencedora".
- Cliente 360° (`clientes/[id]`) mostra o número comercial da proposta em
  vez de só a versão, badge de vencedora e validade, quando presentes.
- Proxy autenticado (`app/api/crm/[...path]/route.ts`) ganhou um branch
  para `Content-Type: application/pdf` — repassa `res.arrayBuffer()` com
  os headers originais em vez de `res.json()`/`res.text()`, que
  corromperiam o binário do PDF.

## Simplificações assumidas (revisar quando fizer sentido)

- Sem job que marque automaticamente uma proposta como `expirada` quando
  `validUntil` passa (o status existe no enum e na UI, mas precisa ser
  definido manualmente por ora) — um cron similar ao já existente para
  `contract.expiring` (Fase 3) resolveria isso.
- `logoUrl` do modelo é só uma URL de texto armazenada — não é renderizada
  como imagem dentro do PDF nesta fase.
- Numeração de proposta por `count()` em vez de sequence dedicado (ver
  nota acima).

## Verificação feita

Backend: `tsc --noEmit` (0 erros), `eslint --fix` (0 erros), `jest` (185
passed / 3 skipped — 4 testes novos). Frontend: `eslint` (0 erros),
`next build` (compila todas as rotas, incluindo as duas novas).
