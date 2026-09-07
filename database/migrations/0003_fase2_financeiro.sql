-- =============================================================================
-- 0003_fase2_financeiro.sql
-- Fase 2 — Módulo Financeiro: contas a receber (invoices), contratos e a
-- taxa de comissão do vendedor (usada pelo relatório de comissões).
--
-- Reaproveita a mesma defesa em 3 camadas das fases anteriores — nada de
-- novo estruturalmente, só mais tabelas com o mesmo padrão de RLS.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- invoices  (contas a receber / parcelas — spec §Fase 2)
-- -----------------------------------------------------------------------------
-- Decisão: "vencido" não é um status persistido — é derivado
-- (status IN ('aberto','parcial') AND due_date < hoje), calculado pelo
-- backend na leitura. Evita depender de um job/cron rodando periodicamente
-- só para manter uma coluna de status em dia; a spec lista "Vencido" como
-- rótulo de exibição, não como estado que precisa de transição própria.
CREATE TABLE invoices (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  customer_id         uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  order_id            uuid REFERENCES orders(id) ON DELETE SET NULL,
  installment_number  int NOT NULL DEFAULT 1,
  total_installments  int NOT NULL DEFAULT 1,
  amount              numeric(14,2) NOT NULL,
  paid_amount         numeric(14,2) NOT NULL DEFAULT 0,
  due_date            date NOT NULL,
  paid_at             timestamptz,
  payment_method      text CHECK (payment_method IN ('pix', 'boleto', 'cartao')),
  status              text NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto', 'parcial', 'pago', 'cancelado')),
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  created_by          uuid,
  updated_by          uuid
);

CREATE INDEX idx_invoices_tenant_id ON invoices(tenant_id);
CREATE INDEX idx_invoices_customer_id ON invoices(customer_id);
CREATE INDEX idx_invoices_order_id ON invoices(order_id);
CREATE INDEX idx_invoices_due_date ON invoices(due_date);

-- -----------------------------------------------------------------------------
-- contracts  (vigência, reajuste, renovação, alertas — spec §Fase 2)
-- -----------------------------------------------------------------------------
CREATE TABLE contracts (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id              uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  customer_id            uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  title                  text NOT NULL,
  value                  numeric(14,2) NOT NULL DEFAULT 0,
  start_date             date NOT NULL,
  end_date               date NOT NULL,
  renewal_period_months  int,
  status                 text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'encerrado', 'renovado')),
  notes                  text,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  created_by             uuid,
  updated_by             uuid
);

CREATE INDEX idx_contracts_tenant_id ON contracts(tenant_id);
CREATE INDEX idx_contracts_customer_id ON contracts(customer_id);
CREATE INDEX idx_contracts_end_date ON contracts(end_date);

-- -----------------------------------------------------------------------------
-- users.commission_rate  (comissão por vendedor — spec §Fase 2 "Comissões")
-- -----------------------------------------------------------------------------
-- Percentual simples (0.05 = 5%) aplicado sobre o valor recebido (paid_amount)
-- das faturas de pedidos dos clientes que o usuário possui (ownerId). Ajuste
-- fino por produto/margem fica para quando o catálogo de produtos existir —
-- hoje o pedido não tem linha de produto, só valor total (ver Fase 1).
ALTER TABLE users ADD COLUMN commission_rate numeric(5,4) NOT NULL DEFAULT 0.05;

-- -----------------------------------------------------------------------------
-- Row Level Security (Camada 3 — mesma regra de sempre)
-- -----------------------------------------------------------------------------
ALTER TABLE invoices  ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_invoices ON invoices
  USING (tenant_id = current_tenant_id());

CREATE POLICY tenant_isolation_contracts ON contracts
  USING (tenant_id = current_tenant_id());

-- app_user e app_service já têm GRANT em "ALL TABLES IN SCHEMA public" via
-- ALTER DEFAULT PRIVILEGES (0001_init.sql) — tabelas novas já nascem com o
-- grant correto, nenhuma ação extra necessária aqui.
