# Fase 8 — Atividades & Calendário (RF016)

Novo módulo, fora da numeração RF011-RF015 da v3.1 "Quote-to-Cash" (ver
`spec/crm-enterprise-master-spec-v3.md`, seção 26, e `spec/roadmap.md` no
projeto Claude). Pedido do usuário: um registro de atividades que gera
compromissos no calendário, uma tela de calendário mostrando eventos/
registros/atividades, e bloqueio de datas com aviso de conflito ao registrar
algo novo.

## O que já existia (Fases 1-7) vs. o que muda

`activities` já existia desde a Fase 1 — um log simples (reunião, ligação,
follow-up, nota) ligado a um cliente e/ou oportunidade, com uma data
agendada opcional, sem tela de calendário nem checagem de conflito
nenhuma. A partir da Fase 8:

1. Dois tipos novos, de propósito geral — **'tarefa'** e **'evento'** —
   podem existir **sem** cliente/oportunidade associados (um compromisso
   pessoal/interno, não um registro de CRM). Os quatro tipos originais
   continuam exigindo pelo menos um dos dois, como sempre.
2. `activities` ganha `end_at` (fim do compromisso). Só quando uma
   atividade tem `scheduled_at` **e** `end_at` ela vira um "slot" de
   calendário com duração — é contra esses slots que a checagem de
   conflito compara. Uma atividade só com `scheduled_at` (sem fim)
   continua sendo apenas uma data-alvo (ex.: prazo de um follow-up), sem
   participar da checagem.
3. Nova tabela/módulo `agenda_blocks` — bloqueio de período na agenda
   **pessoal** de cada usuário (ex.: férias, horário reservado).
4. Registrar uma atividade/tarefa/evento com conflito de horário — contra
   outro compromisso já agendado da mesma pessoa, ou contra um bloqueio
   dela — é rejeitado pelo backend com `409 Conflict` e uma mensagem
   explicando o motivo.
5. Nova tela `/dashboard/agenda`: calendário mensal com tudo isso, mais
   duas listas (compromissos do mês e bloqueios do mês).

## Banco de dados (`database/migrations/0009_fase8_atividades_calendario.sql`)

- `activities.type` ganha os valores `'tarefa'` e `'evento'` na constraint
  CHECK (mesmo padrão de `0007_fase6_propostas.sql` para o status de
  `quotes`: `DROP CONSTRAINT IF EXISTS` + `ADD CONSTRAINT` com a lista
  completa).
- `activities` ganha `end_at timestamptz` — com uma CHECK garantindo que,
  quando as duas pontas existem, o fim vem depois do início.
- `agenda_blocks` (nova): `tenant_id`, `user_id` (dono do bloqueio, sempre
  quem criou), `starts_at`, `ends_at`, `reason`, campos padrão de
  auditoria. RLS habilitado com a mesma policy de isolamento por tenant de
  todas as outras tabelas.
- Dois índices compostos (`activities(tenant_id, created_by, scheduled_at,
  end_at)` e `agenda_blocks(user_id, starts_at, ends_at)`) para acelerar a
  pergunta que a checagem de conflito faz o tempo todo: "esse horário cruza
  algum compromisso/bloqueio já existente dessa pessoa?".

## Backend

- `ActivitiesService.create()`: exige cliente/oportunidade só para os
  quatro tipos originais (`CRM_LINKED_ACTIVITY_TYPES`); valida que o fim
  (se informado) vem depois do início; e, quando início **e** fim estão
  presentes, roda a checagem de conflito contra (a) outras atividades da
  mesma pessoa com início/fim definidos e (b) bloqueios de agenda dela —
  lança `ConflictException` no primeiro caso encontrado, com a razão do
  bloqueio na mensagem quando existir.
- `ActivitiesService.findAll()`: ganhou `userId`/`from`/`to` — usados pela
  tela de calendário. Um `userId` explícito faz um vendedor sempre cair no
  próprio id (não pode espiar a agenda de outra pessoa), enquanto os demais
  perfis podem consultar a de um colega. Sem `userId`, o comportamento é
  exatamente o de antes (Cliente 360°/Oportunidade, com owner-scope só
  quando nenhum filtro é passado) — nenhuma regressão para o uso existente.
- `AgendaBlocksService` (novo módulo, `agenda-blocks`): bloqueio é sempre
  pessoal — `create()` sempre grava para `user.sub`, sem campo de "para
  quem"; rejeita sobreposição com outro bloqueio seu já existente;
  `findAll()` deixa admin/gestor/financeiro consultarem a agenda de um
  colega via `?userId=`, mas `remove()` só apaga o próprio bloqueio, para
  qualquer perfil.
- Bloqueios **não** verificam conflito com atividades já existentes no
  momento em que são criados — a checagem acontece só na direção
  "atividade nova encontra bloqueio existente", não na volta (simplificação
  deliberada, ver abaixo).

## Frontend

- `/dashboard/agenda` (novo): calendário mensal (grade domingo-sábado,
  calculada em JS puro, sem lib de datas nova), navegação por mês via
  querystring (`?month=YYYY-MM`), seletor "Agenda de" para admin/gestor/
  financeiro consultarem a de um colega (`AgendaUserFilter`, um vendedor
  nunca vê esse seletor — o backend também recusaria). Cada dia mostra os
  compromissos daquele dia (cor por tipo, reaproveitando `tagColorClasses`
  já usado em tags livres do resto do sistema) e um indicador de bloqueio.
  Duas listas abaixo da grade: compromissos do mês (com o mesmo botão de
  concluir já usado no Cliente 360°) e bloqueios do mês (com botão de
  remover).
- `NewActivityForm`: ganhou o campo "Fim" (só habilitado com "Início"
  preenchido); quando usado sem `customerId`/`opportunityId` (a partir da
  Agenda), o seletor de tipo só oferece 'tarefa'/'evento' — os quatro tipos
  ligados a CRM exigiriam um cliente/oportunidade que esse contexto não
  tem.
- `NewAgendaBlockForm`/`RemoveAgendaBlockButton` (novos): criar/remover um
  bloqueio pessoal.
- Cliente 360° (`clientes/[id]`): a "Agenda" do cliente ganhou um link
  "Ver calendário" para a tela nova, e o tipo da atividade passou a
  mostrar o rótulo em português (`ACTIVITY_TYPE_LABELS`) em vez do valor
  cru salvo no banco.

## Sobre o item "proposta aprovada não vira pedido"

Investigado junto com esta fase: **não é um bug**. Desde a Fase 7 (RF012),
aprovar uma proposta só fecha a oportunidade como ganha — o Pedido passou a
exigir o passo explícito "Converter em Pedido" no Cliente 360°, decisão
tomada deliberadamente para permitir revisar itens/prazo/condição de
pagamento antes de confirmar. O código e as rotas estavam corretos; o único
problema real era de descoberta — o botão não se destacava o suficiente.
Corrigido nesta fase: o botão passou de `variant="secondary"` para
`variant="primary"` (destaque visual) assim que uma proposta vira
`aprovada` sem pedido ainda, e o comentário desatualizado em
`quote-actions.tsx` (que ainda descrevia o comportamento automático das
Fases 1-6) foi corrigido.

## Simplificações assumidas (revisar quando fizer sentido)

- Sem tela de detalhe por dia (`/dashboard/agenda/2026-09-15`) — mesma
  decisão de escopo das Fases 6/7 (sem `/dashboard/propostas/:id` nem
  `/dashboard/pedidos/:id`); a grade mensal + as duas listas já cobrem o
  necessário por ora.
- Bloqueio de agenda é só pessoal — não existe hoje um bloqueio
  "compartilhado do tenant" (ex.: feriado), decisão explícita do usuário
  para esta fase.
- Um bloqueio criado não verifica conflito com atividades **já
  existentes** no mesmo período — só atividades **novas** são checadas
  contra bloqueios já existentes. Bloquear um período em que você já tinha
  algo marcado não avisa retroativamente.
- Sem reatribuição de atividade — o "dono" do compromisso, para fins de
  conflito, é sempre quem criou o registro (`created_by`); não existe
  "criar uma atividade para a agenda de outra pessoa" nesta fase.
- Sem edição/reagendamento de uma atividade já criada (só criar e marcar
  como concluída, como já era desde a Fase 1) — mover o horário de um
  compromisso existente ainda não tem uma tela dedicada.

## Verificação feita

Backend: `tsc --noEmit` (0 erros), `eslint --fix` (0 erros), `jest` (211
passed / 3 skipped, acima dos 194 da Fase 7 — 17 testes novos: 8 em
`ActivitiesService` + 9 em `AgendaBlocksService`, cobrindo os tipos novos
sem cliente/oportunidade, validação de início/fim, os dois caminhos de
conflito, e o ABAC de "própria agenda vs. consultar a de um colega").
Frontend: `eslint` (0 erros), `next build` (compila todas as rotas,
incluindo a nova `/dashboard/agenda`).
