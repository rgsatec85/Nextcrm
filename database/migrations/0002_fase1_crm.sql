-- =============================================================================
-- 0002_fase1_crm.sql
-- Fase 1 — CRM Comercial: customers, contacts, opportunities, quotes, orders,
-- activities. Mesmo padrão de isolamento da 0001_init.sql (tenant_id + RLS
-- via current_tenant_id()).
--
-- ABAC (spec §19): customers e opportunities têm owner_id — o
-- CustomersService/OpportunitiesService filtra por owner_id quando o
-- usuário tem o perfil "vendedor" (escopo "clientes_proprios"). Isso é
-- reforçado na Camada 2 (backend), não na RLS — a RLS aqui continua
-- garantindo só o isolamento por TENANT, não por dono do registro dentro do
-- tenant. Ver docs/security-multitenancy.md.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- customers  (spec §9 "Empresas" dentro do CRM Comercial)
-- -----------------------------------------------------------------------------
CREATE TABLE customers (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  owner_id    uuid REFERENCES users(id),
  name        text NOT NULL,
  document    text,                -- CNPJ/CPF do cliente, formato livre
  segment     text,
  email       text,
  phone       text,
  website     text,
  notes       text,
  status      text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  created_by  uuid,
  updated_by  uuid
);

CREATE INDEX idx_customers_tenant_id ON customers(tenant_id);
CREATE INDEX idx_customers_owner_id ON customers(owner_id);

-- -----------------------------------------------------------------------------
-- contacts  (múltiplos contatos por cliente)
-- -----------------------------------------------------------------------------
CREATE TABLE contacts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  name        text NOT NULL,
  role        text,                -- cargo
  email       text,
  phone       text,
  whatsapp    text,
  is_primary  boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  created_by  uuid,
  updated_by  uuid
);

CREATE INDEX idx_contacts_tenant_id ON contacts(tenant_id);
CREATE INDEX idx_contacts_customer_id ON contacts(customer_id);

-- -----------------------------------------------------------------------------
-- opportunities  (pipeline Kanban — Lead → Qualificação → Proposta →
-- Negociação → Fechado, com fechado desdobrado em ganho/perdido)
-- -----------------------------------------------------------------------------
CREATE TABLE opportunities (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  customer_id         uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  owner_id            uuid REFERENCES users(id),
  title               text NOT NULL,
  stage               text NOT NULL DEFAULT 'lead' CHECK (
    stage IN ('lead', 'qualificacao', 'proposta', 'negociacao', 'fechado_ganho', 'fechado_perdido')
  ),
  value               numeric(14, 2) NOT NULL DEFAULT 0,
  expected_close_date date,
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  created_by          uuid,
  updated_by          uuid
);

CREATE INDEX idx_opportunities_tenant_id ON opportunities(tenant_id);
CREATE INDEX idx_opportunities_customer_id ON opportunities(customer_id);
CREATE INDEX idx_opportunities_owner_id ON opportunities(owner_id);
CREATE INDEX idx_opportunities_stage ON opportunities(stage);

-- -----------------------------------------------------------------------------
-- quotes  (propostas — versionamento simples: cada nova versão é uma nova
-- linha com o mesmo opportunity_id e version incremental)
-- -----------------------------------------------------------------------------
CREATE TABLE quotes (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  opportunity_id uuid NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  version        integer NOT NULL DEFAULT 1,
  status         text NOT NULL DEFAULT 'rascunho' CHECK (
    status IN ('rascunho', 'enviada', 'aprovada', 'rejeitada')
  ),
  total_value    numeric(14, 2) NOT NULL DEFAULT 0,
  items          jsonb NOT NULL DEFAULT '[]'::jsonb, -- [{description, quantity, unitPrice}]
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  created_by     uuid,
  updated_by     uuid,
  UNIQUE (opportunity_id, version)
);

CREATE INDEX idx_quotes_tenant_id ON quotes(tenant_id);
CREATE INDEX idx_quotes_opportunity_id ON quotes(opportunity_id);

-- -----------------------------------------------------------------------------
-- orders  (pedidos — criados automaticamente quando uma proposta é aprovada)
-- -----------------------------------------------------------------------------
CREATE TABLE orders (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  quote_id    uuid REFERENCES quotes(id),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  status      text NOT NULL DEFAULT 'confirmado' CHECK (
    status IN ('confirmado', 'em_andamento', 'concluido', 'cancelado')
  ),
  total_value numeric(14, 2) NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  created_by  uuid,
  updated_by  uuid
);

CREATE INDEX idx_orders_tenant_id ON orders(tenant_id);
CREATE INDEX idx_orders_customer_id ON orders(customer_id);
CREATE INDEX idx_orders_quote_id ON orders(quote_id);

-- -----------------------------------------------------------------------------
-- activities  (agenda — reuniões, ligações, follow-up, notas)
-- -----------------------------------------------------------------------------
CREATE TABLE activities (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  customer_id    uuid REFERENCES customers(id) ON DELETE CASCADE,
  opportunity_id uuid REFERENCES opportunities(id) ON DELETE CASCADE,
  type           text NOT NULL CHECK (type IN ('reuniao', 'ligacao', 'follow_up', 'nota')),
  notes          text,
  scheduled_at   timestamptz,
  done_at        timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  created_by     uuid,
  updated_by     uuid
);

CREATE INDEX idx_activities_tenant_id ON activities(tenant_id);
CREATE INDEX idx_activities_customer_id ON activities(customer_id);
CREATE INDEX idx_activities_opportunity_id ON activities(opportunity_id);

-- -----------------------------------------------------------------------------
-- Row Level Security (Camada 3 — mesma regra em todas: tenant_id = current_tenant_id())
-- -----------------------------------------------------------------------------
ALTER TABLE customers     ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts      ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders        ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities    ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_customers ON customers
  USING (tenant_id = current_tenant_id());

CREATE POLICY tenant_isolation_contacts ON contacts
  USING (tenant_id = current_tenant_id());

CREATE POLICY tenant_isolation_opportunities ON opportunities
  USING (tenant_id = current_tenant_id());

CREATE POLICY tenant_isolation_quotes ON quotes
  USING (tenant_id = current_tenant_id());

CREATE POLICY tenant_isolation_orders ON orders
  USING (tenant_id = current_tenant_id());

CREATE POLICY tenant_isolation_activities ON activities
  USING (tenant_id = current_tenant_id());

-- app_user e app_service já têm GRANT em "ALL TABLES IN SCHEMA public" com
-- ALTER DEFAULT PRIVILEGES configurado na 0001_init.sql, então as tabelas
-- novas já nascem com o grant correto — nenhuma ação extra necessária aqui.
