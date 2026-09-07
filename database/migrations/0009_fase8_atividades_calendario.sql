-- =============================================================================
-- 0009_fase8_atividades_calendario.sql
-- Fase 8 — Atividades & Calendário (novo módulo, fora da numeração RF011-015
-- da v3.1 "Quote-to-Cash" — ver seção 26 do master spec, RF016).
--
-- Contexto: `activities` já existia desde 0002_fase1_crm.sql (reunião,
-- ligação, follow-up, nota — um log simples ligado a cliente/oportunidade,
-- com uma data agendada opcional, sem tela de calendário nem checagem de
-- conflito). A partir desta fase:
--   1. `activities` ganha dois tipos novos de propósito geral — 'tarefa' e
--      'evento' — que podem existir SEM cliente/oportunidade associados
--      (compromisso pessoal/interno, não um registro de CRM).
--   2. `activities` ganha `end_at`: quando uma atividade tem `scheduled_at`
--      E `end_at`, ela vira um "slot" de calendário com duração — é contra
--      esses slots que a checagem de conflito compara. Uma atividade com só
--      `scheduled_at` (sem fim) continua sendo só uma data-alvo (ex.: prazo
--      de um follow-up), sem participar da checagem de conflito.
--   3. Nova tabela `agenda_blocks` — bloqueio de período na agenda PESSOAL
--      de cada usuário (ex.: férias, horário reservado). Registrar uma nova
--      atividade/tarefa/evento com conflito de horário contra um bloqueio
--      (ou contra outra atividade já agendada da mesma pessoa) é rejeitado
--      pelo backend (ActivitiesService.create — ver comentário lá).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- activities: novos tipos + janela de tempo (fim)
-- -----------------------------------------------------------------------------
ALTER TABLE activities DROP CONSTRAINT IF EXISTS activities_type_check;
ALTER TABLE activities ADD CONSTRAINT activities_type_check
  CHECK (type IN ('reuniao', 'ligacao', 'follow_up', 'nota', 'tarefa', 'evento'));

ALTER TABLE activities ADD COLUMN end_at timestamptz;

-- Se as duas pontas existem, o fim tem que vir depois do início. Nula em
-- qualquer um dos dois lados (a maioria das atividades de hoje, criadas
-- antes desta coluna existir, ou uma tarefa só com prazo) não é validada
-- aqui — sem dado fabricado.
ALTER TABLE activities ADD CONSTRAINT activities_end_at_after_start_check
  CHECK (end_at IS NULL OR scheduled_at IS NULL OR end_at > scheduled_at);

-- Acelera a checagem de conflito (ActivitiesService.create): "existe alguma
-- atividade minha, com início e fim definidos, que cruza esse horário?".
CREATE INDEX idx_activities_conflict
  ON activities(tenant_id, created_by, scheduled_at, end_at);

-- -----------------------------------------------------------------------------
-- agenda_blocks (novo) — bloqueio pessoal de período na agenda
-- -----------------------------------------------------------------------------
CREATE TABLE agenda_blocks (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  -- Dono do bloqueio — sempre quem o criou (AgendaBlocksService.create), sem
  -- conceito de "bloquear a agenda de outra pessoa" nesta fase.
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  starts_at  timestamptz NOT NULL,
  ends_at    timestamptz NOT NULL,
  reason     text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  CHECK (ends_at > starts_at)
);

CREATE INDEX idx_agenda_blocks_tenant_id ON agenda_blocks(tenant_id);
-- Mesmo propósito do índice de activities acima: acelerar "esse período
-- cruza algum bloqueio existente desse usuário?".
CREATE INDEX idx_agenda_blocks_user_range ON agenda_blocks(user_id, starts_at, ends_at);

ALTER TABLE agenda_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_agenda_blocks ON agenda_blocks
  USING (tenant_id = current_tenant_id());

-- app_user/app_service já têm GRANT automático em tabelas novas via
-- ALTER DEFAULT PRIVILEGES (0001_init.sql) — nenhum GRANT explícito aqui,
-- mesmo raciocínio de 0007/0008.
