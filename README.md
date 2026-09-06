# CRM Enterprise SaaS

CRM B2B multi-tenant (Fase 0 — Fundação). Especificação completa em `docs/` e no projeto Next CRM.

## Stack

- **Frontend:** Next.js (App Router, TypeScript, Tailwind) — deploy: Vercel
- **Backend:** NestJS (TypeScript) — deploy: Render.com
- **Banco:** PostgreSQL (Supabase) com Row Level Security obrigatório
- **Cache/sessão:** Redis
- **CI/CD:** GitHub Actions

## Estrutura do repositório

```
crm-enterprise/
  frontend/         # Next.js
  backend/          # NestJS
  database/         # migrations SQL + documentação do schema
  docs/             # arquitetura, setup, segurança, deployment
  infrastructure/   # docker-compose para desenvolvimento local
  .github/          # workflows de CI/CD
```

## Como rodar localmente

Ver `docs/setup.md` para o passo a passo completo. Resumo:

```bash
# 1. Suba Postgres + Redis locais
docker compose -f infrastructure/docker-compose.yml up -d

# 2. Backend
cd backend
cp .env.example .env
npm install
npm run prisma:migrate
npm run start:dev

# 3. Frontend (em outro terminal)
cd frontend
cp .env.example .env
npm install
npm run dev
```

## Status

Fase 0 (Fundação e Plataforma Multi-Tenant) em construção: cadastro self-service de empresa, autenticação JWT multi-tenant, isolamento por tenant em 3 camadas (JWT → filtro no backend → Row Level Security) e CI básico.

Próximas fases (CRM Comercial, Financeiro, Portal do Cliente, Atendimento, IA, Hardening/Escala) estão detalhadas em `docs/` e no roadmap do projeto.
