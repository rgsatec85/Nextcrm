-- =============================================================================
-- 0004_fase3_portal_atendimento.sql
-- Fase 3 — Portal do Cliente e Atendimento: vínculo de usuário de portal com
-- um Customer, chamados (tickets) + comentários, base de conhecimento e
-- assinaturas de webhook.
--
-- Mesma defesa em 3 camadas das fases anteriores (tenant_id + RLS via
-- current_tenant_id()). A novidade de isolamento nesta fase não é no banco —
-- é na Camada 2: o perfil `cliente_portal` tem um "hard lock" no
-- PortalService (todo acesso é forçado a customer_id = users.customer_id do
-- próprio usuário, nunca um filtro opcional como o ABAC de vendedor). Ver
-- docs/security-multitenancy.md.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- users.customer_id  (vincula um usuário cliente_portal a UM Customer)
-- -----------------------------------------------------------------------------
-- Só é preenchido para usuários com role cliente_portal — os demais perfis
-- (admin/gestor/vendedor/financeiro) nunca têm customer_id. ON DELETE CASCADE:
-- se o Customer for removido, o(s) login(s) de portal vinculados a ele somem
-- junto (não faz sentido um login de portal órfão).
ALTER TABLE users ADD COLUMN customer_id uuid REFERENCES customers(id) ON DELETE CASCADE;

CREATE INDEX idx_users_customer_id ON users(customer_id);

-- -----------------------------------------------------------------------------
-- tickets  (chamados de atendimento — spec Fase 3 "Atendimento")
-- -----------------------------------------------------------------------------
-- sla_due_at é calculado pela aplicação NO MOMENTO DA CRIAÇÃO a partir da
-- priority (urgente=4h, alta=8h, media=24h, baixa=72h a partir de now()) —
-- ver TicketsService/PortalService (computeSlaDueAt). Fica gravado (não
-- derivado na leitura, ao contrário do "vencido" das invoices) porque o SLA
-- é fixado no momento da abertura do chamado e não deve se mover se a
-- priority for alterada depois.
CREATE TABLE tickets (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  subject     text NOT NULL,
  description text,
  status      text NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto', 'em_andamento', 'resolvido', 'fechado')),
  priority    text NOT NULL DEFAULT 'media' CHECK (priority IN ('baixa', 'media', 'alta', 'urgente')),
  sla_due_at  timestamptz NOT NULL,
  assigned_to uuid REFERENCES users(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  created_by  uuid,
  updated_by  uuid
);

CREATE INDEX idx_tickets_tenant_id ON tickets(tenant_id);
CREATE INDEX idx_tickets_customer_id ON tickets(customer_id);
CREATE INDEX idx_tickets_status ON tickets(status);

-- -----------------------------------------------------------------------------
-- ticket_comments  (thread de comentários de um chamado — interno ou cliente)
-- -----------------------------------------------------------------------------
CREATE TABLE ticket_comments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  ticket_id   uuid NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  author_id   uuid,
  author_type text NOT NULL CHECK (author_type IN ('interno', 'cliente')),
  body        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ticket_comments_tenant_id ON ticket_comments(tenant_id);
CREATE INDEX idx_ticket_comments_ticket_id ON ticket_comments(ticket_id);

-- -----------------------------------------------------------------------------
-- knowledge_articles  (base de conhecimento — spec Fase 3 "Atendimento interno")
-- -----------------------------------------------------------------------------
CREATE TABLE knowledge_articles (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  title        text NOT NULL,
  slug         text NOT NULL,
  body         text NOT NULL,
  category     text,
  is_published boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  created_by   uuid,
  updated_by   uuid,
  UNIQUE (tenant_id, slug)
);

CREATE INDEX idx_knowledge_articles_tenant_id ON knowledge_articles(tenant_id);

-- -----------------------------------------------------------------------------
-- webhook_subscriptions  (spec Fase 3 "Webhooks/eventos")
-- -----------------------------------------------------------------------------
-- secret é gerado pelo backend (nunca escolhido pelo cliente) e usado para
-- assinar o corpo de cada entrega via HMAC-SHA256 (header
-- X-Webhook-Signature). Fica gravado em texto puro no banco (é preciso lê-lo
-- de volta para assinar cada entrega), mas o backend nunca o devolve de novo
-- em nenhuma resposta HTTP depois da criação — ver WebhooksService.
CREATE TABLE webhook_subscriptions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  url        text NOT NULL,
  secret     text NOT NULL,
  events     text[] NOT NULL DEFAULT '{}',
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid
);

CREATE INDEX idx_webhook_subscriptions_tenant_id ON webhook_subscriptions(tenant_id);

-- -----------------------------------------------------------------------------
-- Row Level Security (Camada 3 — mesma regra de sempre)
-- -----------------------------------------------------------------------------
ALTER TABLE tickets               ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_comments       ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_articles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_tickets ON tickets
  USING (tenant_id = current_tenant_id());

CREATE POLICY tenant_isolation_ticket_comments ON ticket_comments
  USING (tenant_id = current_tenant_id());

CREATE POLICY tenant_isolation_knowledge_articles ON knowledge_articles
  USING (tenant_id = current_tenant_id());

CREATE POLICY tenant_isolation_webhook_subscriptions ON webhook_subscriptions
  USING (tenant_id = current_tenant_id());

-- app_user e app_service já têm GRANT em "ALL TABLES IN SCHEMA public" via
-- ALTER DEFAULT PRIVILEGES (0001_init.sql) — tabelas novas já nascem com o
-- grant correto, nenhuma ação extra necessária aqui.
