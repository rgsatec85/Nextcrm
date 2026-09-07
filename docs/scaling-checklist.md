# Checklist de escala — Supabase / Render / Vercel (Fase 5)

Este é um **checklist para o time executar em cada dashboard**, não algo já
ligado por este scaffold. Nada aqui foi ativado neste projeto — são os
passos concretos para quando o tráfego real justificar cada tier de
`docs/nfr-slo.md`. Nenhum destes 3 provedores tem uma API neste sandbox
alcançável para automatizar isso (e não seria apropriado automatizar
mudança de plano/billing sem uma decisão humana de qualquer forma).

## Supabase (banco)

### T1 (100 empresas / 5.000 usuários)

- [ ] Plano pago de entrada (não o free tier — ele pausa o projeto após
      inatividade, incompatível com qualquer SLA).
- [ ] Confirmar que o backup diário automático está ativo (Project
      Settings → Database → Backups).
- [ ] Trocar as senhas placeholder de `app_user`/`app_service` (já listado
      em `docs/deployment.md` — reforçando aqui porque é pré-requisito de
      qualquer plano de escala, não só de segurança).

### T2 (1.000 empresas / 50.000 usuários)

- [ ] Habilitar **Point-in-Time Recovery (PITR)** (Database → Backups →
      Point in Time Recovery) — reduz o RPO de ~24h para minutos (ver
      `docs/nfr-slo.md`).
- [ ] Revisar o **modo de connection pooling** (Database → Connection
      Pooling): usar modo **Transaction** para o `DATABASE_URL` do backend
      (o Render abre e fecha conexões por request; modo Session esgota o
      limite de conexões do Postgres muito mais rápido sob múltiplas
      instâncias). Confirmar que `DATABASE_SERVICE_URL` (role
      `app_service`, usado só para provisionamento/login/cron — ver
      `docs/architecture.md`) também passa pelo pooler.
- [ ] Avaliar 1 **read replica** (Database → Read Replicas, add-on pago)
      se relatórios pesados (dashboard financeiro, Score IA em lote) ou o
      `WebhooksService.notifyExpiringContracts` (cron que varre contratos
      de todos os tenants — `backend/src/modules/webhooks/webhooks.service.ts`)
      começarem a competir por I/O com tráfego de escrita comum. Isso exige
      uma mudança de código (rotear leituras específicas para a connection
      string da replica) que não existe neste scaffold ainda.

### T3 (10.000 empresas / 500.000 usuários)

- [ ] Migrar para um plano enterprise/dedicado (compute dedicado, não
      compartilhado).
- [ ] PITR com retenção maior + pelo menos 1 read replica em produção
      permanente (não só sob demanda).
- [ ] Revisar limites de conexão do pooler contra o número real de
      instâncias do Render × conexões por instância do Prisma — dimensionar
      o pool do Supabase para não ser o gargalo.
- [ ] Formalizar um runbook de failover (promover a read replica) com quem
      no time tem acesso para executar isso — ver RTO proposto em
      `docs/nfr-slo.md`.

## Render (backend)

### T1

- [ ] Plano pago de entrada (o free tier "dorme" após inatividade —
      incompatível com o SLA de qualquer tier).
- [ ] Confirmar o health check path como `/api/health` (liveness —
      **não** `/api/health/ready`, que verifica dependências externas e
      reiniciaria o processo por um problema no Supabase/Redis que não é
      culpa do processo — ver o doc-comment em
      `backend/src/health/health.controller.ts`).

### T2

- [ ] Subir para **2+ instâncias** (Render → Scaling) — pré-requisito para
      zero-downtime deploy de verdade (com 1 instância só, todo deploy tem
      uma janela de indisponibilidade).
- [ ] Habilitar **autoscaling** (Render → Scaling → Autoscaling), com
      métrica de CPU e/ou memória — definir min/max de instâncias conforme
      o throughput estimado em `docs/nfr-slo.md`.
- [ ] Provisionar Redis (Upstash, via o marketplace de add-ons do Render ou
      diretamente na Upstash) e configurar `REDIS_URL` no Environment do
      serviço — a partir daqui o rate limiting (Fase 5,
      `RedisThrottlerStorageService`) passa a ser consistente entre
      instâncias em vez de por-instância, e `GET /api/health/ready` passa a
      checar Redis de verdade.

### T3

- [ ] Revisar o plano por instância (mais CPU/memória cada) além de mais
      instâncias — throughput por instância importa tanto quanto contagem.
- [ ] Redis num plano de maior throughput/conexões, com alta disponibilidade
      (Upstash tem tiers para isso) — um Redis fora do ar sob T3 não derruba
      a API (fallback em memória continua funcionando, ver
      `backend/src/redis/redis.service.ts`), mas degrada o rate limiting
      para "por instância" bem no pico de tráfego que mais precisa dele.
- [ ] Formalizar alertas de saturação (CPU/memória/conexões de banco) —
      ligados ao Grafana Cloud ou ao próprio painel do Render, fora do
      escopo de código desta fase.

## Vercel (frontend)

Vercel já serve tudo via CDN/Edge por padrão em qualquer plano — não há um
"ligar CDN" para fazer aqui, diferente de Render/Supabase. O que de fato
muda por tier:

### T1 / T2

- [ ] Nada a configurar além do plano em si (Hobby/Pro conforme o volume de
      builds/banda contratual do time, não uma decisão técnica).
- [ ] Se alguma página vier a usar **ISR** (Incremental Static
      Regeneration) no futuro — hoje o frontend deste projeto é
      inteiramente client-rendered contra a API (`BACKEND_URL`), sem
      páginas estáticas com `revalidate` configurado — revisar a janela de
      revalidate contra a meta de latência de leitura de `docs/nfr-slo.md`
      antes de assumir que dados "sempre atualizados" continuam verdade.

### T3

- [ ] Avaliar um plano com SLA formal e suporte dedicado, se o negócio
      precisar repassar esse compromisso para clientes finais.
- [ ] Revisar regiões de Edge Functions/middleware (se algum vier a ser
      adicionado) contra a localização geográfica da base de usuários —
      hoje o frontend não usa Edge Functions, só páginas client-side
      consumindo a API REST do backend.

## Nota final

Nenhum item deste checklist é uma dependência de código — todos são
configuração de dashboard/billing dos 3 provedores. O código deste projeto
(rate limiting com fallback, health check de prontidão, OTel condicional)
foi desenhado para **não quebrar** em nenhum estágio deste checklist (antes
ou depois de qualquer item ser marcado) — é seguro escalar na ordem que o
tráfego real exigir, não necessariamente na ordem T1→T2→T3 escrita aqui.
