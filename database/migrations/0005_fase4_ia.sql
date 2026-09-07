-- =============================================================================
-- 0005_fase4_ia.sql
-- Fase 4 — Inteligência Artificial Corporativa: log de auditoria/rastreabilidade
-- das perguntas feitas ao assistente (`POST /ai/ask`).
--
-- Mesma defesa em 3 camadas das fases anteriores (tenant_id + RLS via
-- current_tenant_id()). Esta é a ÚNICA tabela nova da Fase 4 — o restante
-- (resumo de cliente, Score IA, próxima ação, rascunho de email, cobrança
-- inteligente, previsão de pipeline) é computado on-the-fly a partir de
-- tabelas que já existem (customers/invoices/contracts/opportunities/
-- tickets), sem persistência própria. Ver docs/fase4-ia-corporativa.md.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- ai_query_logs  (auditoria específica do assistente — spec Fase 4)
-- -----------------------------------------------------------------------------
-- O AuditLogInterceptor genérico (0001_init.sql, audit_logs) já registra que
-- um POST /ai/ask aconteceu (usuário, tenant, IP, resultado serializado), mas
-- não guarda a PERGUNTA em si nem qual intenção foi reconhecida — informação
-- só o AiService tem no momento em que resolve a pergunta. ai_query_logs
-- complementa isso especificamente para o assistente, permitindo auditar
-- depois "o que os usuários perguntaram", "quantas perguntas caíram no
-- fallback honesto (intent = 'unrecognized')" etc.
CREATE TABLE ai_query_logs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id    uuid REFERENCES users(id) ON DELETE SET NULL,
  question   text NOT NULL,
  -- 'overdue_threshold' | 'customer_summary' | 'customer_not_found' | 'unrecognized'
  -- (ver AiService.ask / intent-parser.ts) — não é um CHECK porque novas
  -- intenções devem poder ser adicionadas sem migration.
  intent     text NOT NULL,
  answer     text NOT NULL,
  -- 'deterministic' | 'ollama' — qual AiProvider efetivamente respondeu
  -- (o Ollama pode falhar e cair no fallback determinístico, ver AiModule).
  provider   text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_query_logs_tenant_id ON ai_query_logs(tenant_id);
CREATE INDEX idx_ai_query_logs_created_at ON ai_query_logs(created_at);

-- -----------------------------------------------------------------------------
-- Row Level Security (Camada 3 — mesma regra de sempre)
-- -----------------------------------------------------------------------------
ALTER TABLE ai_query_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_ai_query_logs ON ai_query_logs
  USING (tenant_id = current_tenant_id());

-- app_user e app_service já têm GRANT em "ALL TABLES IN SCHEMA public" via
-- ALTER DEFAULT PRIVILEGES (0001_init.sql) — tabela nova já nasce com o
-- grant correto, nenhuma ação extra necessária aqui.
