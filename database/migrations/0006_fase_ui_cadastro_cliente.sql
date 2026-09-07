-- =============================================================================
-- 0006_fase_ui_cadastro_cliente.sql
-- Expande o cadastro de clientes (tabela `customers`, já existente desde
-- 0002_fase1_crm.sql) com os campos de identificação e classificação
-- comercial pedidos no refinamento de UI: Nome Fantasia, Inscrição Estadual/
-- Municipal, Tipo de Pessoa, Subsegmento, Porte, Origem do Lead e Conta
-- Estratégica. Não cria tabela nova — só ALTER TABLE — então não precisa de
-- policy de RLS nova (a tabela `customers` já tem `tenant_isolation_customers`
-- desde 0002_fase1_crm.sql, que cobre a linha inteira, colunas novas
-- incluídas).
-- =============================================================================

ALTER TABLE customers
  ADD COLUMN trade_name            text,
  ADD COLUMN state_registration    text,  -- Inscrição Estadual
  ADD COLUMN municipal_registration text, -- Inscrição Municipal
  -- 'juridica' | 'fisica' — decide se `document` é CNPJ ou CPF (formato
  -- livre em ambos os casos, ver comentário original da coluna).
  ADD COLUMN person_type           text NOT NULL DEFAULT 'juridica'
    CHECK (person_type IN ('juridica', 'fisica')),
  ADD COLUMN subsegment            text,
  -- Porte da empresa. Sem CHECK fixo de propósito: é uma classificação de
  -- negócio que pode ganhar valores novos sem migration (mesmo raciocínio
  -- de `ai_query_logs.intent` em 0005_fase4_ia.sql) — a UI hoje oferece
  -- micro/pequena/media/grande como sugestão, não como enum rígido no banco.
  ADD COLUMN company_size          text,
  ADD COLUMN lead_source           text,
  ADD COLUMN is_strategic_account  boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN customers.person_type IS
  'Define se customers.document é CNPJ (juridica) ou CPF (fisica).';
