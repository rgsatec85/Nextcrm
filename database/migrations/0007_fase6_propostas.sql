-- =============================================================================
-- 0007_fase6_propostas.sql
-- Fase 6 — Propostas como entidade própria (RF011, spec v3.1 "Quote-to-Cash").
--
-- Não substitui a tabela `quotes` (0002_fase1_crm.sql) por uma tabela nova
-- `proposals` — "proposta" já é o termo usado em todo o produto para o que o
-- banco chama de `quotes` (ver Cliente 360°, seção "Propostas"), e a máquina
-- de estados/versionamento (QuotesService) já é exatamente o pedido de
-- "Propostas (Orçamentos)... versionamento... aprovação". Trocar de tabela
-- seria reescrever histórico de produção por uma diferença só de nome.
-- Em vez disso, esta migration:
--   1. Cria `proposal_templates` (biblioteca de modelos reutilizáveis).
--   2. Expande `quotes` com número, validade, modelo usado e "vencedora".
-- =============================================================================

-- -----------------------------------------------------------------------------
-- proposal_templates (biblioteca de modelos reutilizáveis — spec "Modelos
-- reutilizáveis de propostas")
-- -----------------------------------------------------------------------------
CREATE TABLE proposal_templates (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name          text NOT NULL,
  -- Categoria livre (ex.: 'venda_servico', 'venda_produto', 'locacao',
  -- 'consultoria') — sem CHECK de propósito, mesmo raciocínio de
  -- `ai_query_logs.intent` (0005) e `customers.company_size` (0006): é uma
  -- classificação de negócio, não um estado do sistema, e não deve exigir
  -- migration a cada categoria nova que uma empresa queira usar.
  category      text,
  logo_url      text,
  primary_color text,
  header_text   text,
  footer_text   text,
  -- Cláusulas padrão do modelo — texto livre com campos dinâmicos
  -- {{cliente.nome}}, {{valor_total}}, {{vendedor}}, {{data}} substituídos na
  -- geração do PDF (ver ProposalPdfService no backend).
  clauses       text,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  created_by    uuid,
  updated_by    uuid
);

CREATE INDEX idx_proposal_templates_tenant_id ON proposal_templates(tenant_id);

ALTER TABLE proposal_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_proposal_templates ON proposal_templates
  USING (tenant_id = current_tenant_id());

-- -----------------------------------------------------------------------------
-- quotes — campos novos
-- -----------------------------------------------------------------------------
ALTER TABLE quotes
  -- Número comercial (ex.: "PROP-2026-0001"), gerado pelo backend na criação
  -- (QuotesService.create) — NULLABLE de propósito: propostas já existentes
  -- em produção não ganham um número retroativo fabricado, só as novas.
  ADD COLUMN number      text,
  ADD COLUMN valid_until date,
  ADD COLUMN template_id uuid REFERENCES proposal_templates(id) ON DELETE SET NULL,
  -- "Apenas uma proposta pode ser marcada como vencedora" (spec) — a
  -- constraint abaixo garante isso no banco, não só na aplicação.
  ADD COLUMN is_winner   boolean NOT NULL DEFAULT false;

-- Novo status do ciclo de vida: 'expirada' (proposta cuja `valid_until`
-- passou sem decisão do cliente). O nome da constraint segue a convenção
-- padrão do Postgres para CHECK inline sem nome explícito
-- (<tabela>_<coluna>_check), a mesma gerada por 0002_fase1_crm.sql.
ALTER TABLE quotes DROP CONSTRAINT IF EXISTS quotes_status_check;
ALTER TABLE quotes ADD CONSTRAINT quotes_status_check
  CHECK (status IN ('rascunho', 'enviada', 'aprovada', 'rejeitada', 'expirada'));

-- Único número por tenant (entre as que já têm número — as antigas, sem
-- número, não entram nesse índice parcial).
CREATE UNIQUE INDEX idx_quotes_number_per_tenant
  ON quotes(tenant_id, number) WHERE number IS NOT NULL;

-- Uma única proposta vencedora por oportunidade, garantido no banco.
CREATE UNIQUE INDEX idx_quotes_one_winner_per_opportunity
  ON quotes(opportunity_id) WHERE is_winner = true;

CREATE INDEX idx_quotes_template_id ON quotes(template_id);

-- RLS de `quotes` já existe desde 0002_fase1_crm.sql e cobre a linha
-- inteira — colunas novas incluídas, nenhuma policy nova necessária aqui.
