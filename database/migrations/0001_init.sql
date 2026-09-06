-- =============================================================================
-- 0001_init.sql
-- Fase 0 — Fundação multi-tenant: companies (tenants), roles, users, audit_logs
--
-- Isolamento em 3 camadas (spec seção 18):
--   Camada 1 (JWT)      -> o token emitido no login carrega tenant_id
--   Camada 2 (Backend)  -> toda query do NestJS filtra por tenant_id
--   Camada 3 (Banco)    -> Row Level Security garante isolamento mesmo se a
--                          Camada 2 falhar
--
-- Adaptação da spec: a spec original referencia auth.jwt()->>'tenant_id',
-- que é específico do Supabase Auth (GoTrue) via PostgREST. Como o backend
-- é um NestJS com autenticação própria (JWT emitido por nós, senha com
-- Argon2id), a Camada 3 usa current_setting('app.tenant_id') — o backend
-- define essa variável de sessão a cada request (ver
-- backend/src/common/middleware/tenant-context.middleware.ts). O efeito de
-- defesa em profundidade é o mesmo: mesmo com um bug no filtro do backend,
-- o Postgres nunca retorna linhas de outro tenant. Isso está documentado em
-- docs/security-multitenancy.md.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------------------
-- Função auxiliar: tenant atual da sessão (setado pelo backend por request)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION current_tenant_id() RETURNS uuid AS $$
  SELECT NULLIF(current_setting('app.tenant_id', true), '')::uuid;
$$ LANGUAGE sql STABLE;

-- -----------------------------------------------------------------------------
-- companies  (cada linha é um Tenant)
-- -----------------------------------------------------------------------------
CREATE TABLE companies (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  cnpj         text NOT NULL UNIQUE,
  is_active    boolean NOT NULL DEFAULT true,
  onboarding_completed_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE companies IS 'Tenant raiz. Cada empresa cadastrada via self-service vira uma linha aqui.';

-- -----------------------------------------------------------------------------
-- roles  (RBAC por tenant — perfis: Admin Empresa, Financeiro, Vendedor, Gestor, Cliente Portal)
-- -----------------------------------------------------------------------------
CREATE TABLE roles (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name         text NOT NULL,
  slug         text NOT NULL,
  permissions  jsonb NOT NULL DEFAULT '{}'::jsonb, -- base para ABAC além do RBAC por slug
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  created_by   uuid,
  updated_by   uuid,
  UNIQUE (tenant_id, slug)
);

-- -----------------------------------------------------------------------------
-- users
-- -----------------------------------------------------------------------------
-- Decisão de arquitetura: email é único globalmente (não só por tenant) para
-- manter o login simples (usuário não precisa escolher a empresa antes de
-- entrar). Ver docs/architecture.md > "Pontos em aberto" para o trade-off
-- (uma mesma pessoa não pode ter conta em dois tenants com o mesmo email).
CREATE TABLE users (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  role_id        uuid NOT NULL REFERENCES roles(id),
  name           text NOT NULL,
  email          text NOT NULL UNIQUE,
  password_hash  text NOT NULL,
  is_active      boolean NOT NULL DEFAULT true,
  last_login_at  timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  created_by     uuid,
  updated_by     uuid
);

CREATE INDEX idx_users_tenant_id ON users(tenant_id);

-- -----------------------------------------------------------------------------
-- audit_logs  (spec seção 20)
-- -----------------------------------------------------------------------------
CREATE TABLE audit_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id     uuid REFERENCES users(id),
  event       text NOT NULL,       -- login, logout, create, update, delete, payment, ...
  entity      text,                -- nome da entidade afetada (ex: 'users', 'opportunities')
  entity_id   uuid,
  ip          inet,
  user_agent  text,
  before      jsonb,
  after       jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_logs_tenant_id ON audit_logs(tenant_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

-- -----------------------------------------------------------------------------
-- Row Level Security (Camada 3)
-- -----------------------------------------------------------------------------
ALTER TABLE companies  ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE users      ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- companies: uma sessão só enxerga a própria linha de tenant (usada para o
-- Centro Administrativo). Provisionamento de novos tenants (signup) roda
-- com o role app_service, que tem BYPASSRLS (ver abaixo).
CREATE POLICY tenant_isolation_companies ON companies
  USING (id = current_tenant_id());

CREATE POLICY tenant_isolation_roles ON roles
  USING (tenant_id = current_tenant_id());

CREATE POLICY tenant_isolation_users ON users
  USING (tenant_id = current_tenant_id());

CREATE POLICY tenant_isolation_audit_logs ON audit_logs
  USING (tenant_id = current_tenant_id());

-- -----------------------------------------------------------------------------
-- Roles de banco de dados
-- -----------------------------------------------------------------------------
-- app_user: usado por TODAS as queries normais do backend (request-scoped).
--           Sujeito a RLS -- nunca enxerga dados fora do tenant setado na sessão.
-- app_service: usado apenas para provisionamento de tenant (signup) e jobs
--              administrativos internos. BYPASSRLS. Nunca exposto a request
--              HTTP diretamente -- só usado dentro de transações controladas
--              pelo backend (ex: TenantsService.createTenant).
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user LOGIN PASSWORD 'app_user';
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_service') THEN
    CREATE ROLE app_service LOGIN PASSWORD 'app_service' BYPASSRLS;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO app_user, app_service;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user, app_service;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user, app_service;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user, app_service;
