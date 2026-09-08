-- Fase 9 — Contratos ampliados (RF013)
-- Modelos de contrato (mesmo mecanismo de campos dinâmicos {{cliente.nome}}
-- de proposal_templates/0007), corpo do contrato (rich text saneado no
-- backend antes de chegar aqui — ver sanitize-contract-body.ts) e um novo
-- estado 'rascunho' que trava/destrava a edição do corpo.

-- -----------------------------------------------------------------------------
-- Modelos de contrato — mesmo desenho de proposal_templates (0007), mas o
-- corpo aqui fica em `body` (rich text/HTML saneado) em vez de `clauses`
-- (texto simples), já que a Fase 9 usa um editor rico em vez de texto puro.
-- -----------------------------------------------------------------------------
CREATE TABLE contract_templates (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name          text NOT NULL,
  -- Categoria livre, mesmo raciocínio de proposal_templates.category —
  -- classificação de negócio, sem CHECK/enum.
  category      text,
  -- Corpo padrão do modelo, em HTML já saneado (allowlist restrita — ver
  -- sanitize-contract-body.ts), com campos dinâmicos {{cliente.nome}},
  -- {{valor}}, {{vigencia_inicio}}, {{vigencia_fim}}, {{vendedor}}, {{data}}
  -- substituídos apenas no momento em que o modelo é aplicado a um contrato
  -- (ContractsService.applyTemplate) — diferente de proposal_templates, onde
  -- a substituição acontece só na hora de gerar o PDF e o modelo permanece
  -- "vivo". Aqui o texto é copiado para dentro do contrato e editado depois
  -- de forma independente, para um contrato não mudar retroativamente se
  -- alguém editar o modelo depois (mais correto para um documento jurídico).
  body          text,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  created_by    uuid,
  updated_by    uuid
);

CREATE INDEX idx_contract_templates_tenant_id ON contract_templates(tenant_id);

ALTER TABLE contract_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_contract_templates ON contract_templates
  USING (tenant_id = current_tenant_id());

-- -----------------------------------------------------------------------------
-- Contratos — corpo (rich text saneado) + modelo de origem opcional, e novo
-- status 'rascunho'. Contratos existentes mantêm o status que já tinham
-- (nenhuma linha é alterada aqui) — só o default de novas linhas muda.
-- -----------------------------------------------------------------------------
ALTER TABLE contracts ADD COLUMN body text;
ALTER TABLE contracts ADD COLUMN template_id uuid REFERENCES contract_templates(id) ON DELETE SET NULL;

CREATE INDEX idx_contracts_template_id ON contracts(template_id);

ALTER TABLE contracts DROP CONSTRAINT IF EXISTS contracts_status_check;
ALTER TABLE contracts ADD CONSTRAINT contracts_status_check
  CHECK (status IN ('rascunho', 'ativo', 'encerrado', 'renovado'));

ALTER TABLE contracts ALTER COLUMN status SET DEFAULT 'rascunho';
