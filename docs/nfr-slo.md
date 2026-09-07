# NFR / SLO — metas propostas para validação com o time (Fase 5)

Este documento fecha o ponto em aberto listado em `spec/roadmap.md` desde a
Fase 0: *"Seção 25 (Requisitos Não Funcionais) veio incompleta no documento
original — faltam metas concretas de disponibilidade (SLA), tempo de
resposta, RPO/RTO de backup e throughput. Precisa ser definida antes da
Fase 5."*

**Importante sobre a natureza deste documento**: os números abaixo são
**metas propostas para validação com o time** (mesma linguagem do roadmap),
não garantias já demonstradas em produção. Nada aqui foi medido sob carga
real — este projeto nunca rodou com tráfego de produção. São alvos de
engenharia, derivados de práticas comuns de mercado para SaaS B2B nessa
faixa de escala, para orientar decisões de plano/infraestrutura nas Fases
seguintes. Revisitar com dados reais assim que houver tráfego de produção
é esperado e recomendado.

## As três metas de capacidade (do roadmap)

| Tier | Empresas | Usuários finais |
|---|---|---|
| T1 | 100 | 5.000 |
| T2 | 1.000 | 50.000 |
| T3 | 10.000 | 500.000 |

## 1. Disponibilidade (SLA)

| Tier | SLA mensal proposto | Downtime tolerado/mês |
|---|---|---|
| T1 | 99,5% | ~3h39min |
| T2 | 99,9% | ~43min |
| T3 | 99,95% | ~21min |

Justificativa do degrau: em T1 uma única instância Render + um único
Postgres Supabase (sem read replica) já atende a demanda — o teto de
disponibilidade é o de um serviço single-region sem redundância de
computação. T2/T3 exigem múltiplas instâncias do backend (zero-downtime
deploy do Render entra em jogo) e, em T3, redundância também na camada de
banco (read replica promovível) para justificar uma meta mais alta — ver
`docs/scaling-checklist.md` para os passos concretos de cada tier.

Nenhum destes números é hoje um SLA contratual com clientes finais — são
metas internas de engenharia até o negócio decidir formalizar um SLA
comercial (o que normalmente exige também um processo de suporte/on-call,
fora do escopo desta fase).

## 2. RPO (Recovery Point Objective — quanto dado se pode perder)

Amarrado diretamente aos tiers de backup do Supabase:

| Tier | Estratégia de backup | RPO proposto |
|---|---|---|
| T1 | Backup diário automático (retenção de alguns dias) — patamar de entrada do Supabase pago | ≤ 24h |
| T2 | Point-in-Time Recovery (PITR) via WAL contínuo — add-on pago do Supabase, retenção de ~7-14 dias | ≤ 5 min |
| T3 | PITR contínuo + réplica de leitura promovível em região separada, para failover mais rápido além do RPO do PITR | ≤ 1-5 min |

Nota honesta: os nomes/preços exatos dos planos e add-ons do Supabase (e o
que exatamente cada um inclui) mudam com o tempo — validar contra a página
de pricing vigente no momento da contratação, não contra este documento.
O ponto que não muda é o princípio: backup diário simples tem RPO de até
um dia inteiro; só WAL contínuo (PITR) reduz isso a minutos.

## 3. RTO (Recovery Time Objective — quanto tempo para voltar a operar)

| Tier | Cenário coberto | RTO proposto |
|---|---|---|
| T1 | Restaurar de um backup diário para uma nova instância Supabase, apontar `DATABASE_URL`/`DATABASE_SERVICE_URL` de novo | ≤ 4h (processo majoritariamente manual, ver runbook abaixo) |
| T2 | Restaurar via PITR para um ponto específico antes do incidente | ≤ 1h |
| T3 | Promover a réplica de leitura a primária (failover) + Render já com múltiplas instâncias saudáveis apontando para o novo primário | ≤ 15 min |

Runbook mínimo esperado (a escrever quando o time decidir formalizar isso
operacionalmente, fora do escopo desta fase): quem tem acesso ao painel do
Supabase para iniciar uma restauração, como trocar `DATABASE_URL`/
`DATABASE_SERVICE_URL` no Render sem reconstruir o serviço do zero, e como
validar que o RLS/roles (`app_user`/`app_service`) sobreviveram à
restauração antes de liberar tráfego real de novo.

## 4. Orçamento de latência da API (p95/p99)

Meta que **não muda por tier** — o que muda é o investimento de
infraestrutura necessário para sustentá-la sob carga crescente (mais
instâncias, cache, índices, eventualmente read replica para leitura
pesada):

| Métrica | Meta proposta |
|---|---|
| p95 — rotas de leitura (`GET`) | ≤ 300ms |
| p95 — rotas de escrita (`POST`/`PATCH`/`DELETE`) | ≤ 600ms |
| p99 — leitura | ≤ 800ms |
| p99 — escrita | ≤ 1.500ms |

Estes números incluem o tempo de rede Render↔Supabase, mas não incluem
latência de rede do cliente até a Vercel/Render (fora do controle do
backend). Uma vez que o OpenTelemetry desta fase estiver de fato apontado
para um collector real (ver `docs/observability.md`), esses números deixam
de ser uma meta no papel e passam a ser medíveis com spans reais por rota —
próximo passo natural depois desta fase.

## 5. Throughput (requisições/segundo, estimativa)

Estimativa grosseira, não uma medição — usada só para dimensionar
instâncias/planos, a refinar com métricas reais assim que existirem:

| Tier | Usuários finais | RPS médio estimado | RPS de pico estimado (3-5×) |
|---|---|---|---|
| T1 | 5.000 | ~5-10 | ~30-50 |
| T2 | 50.000 | ~50-100 | ~300-500 |
| T3 | 500.000 | ~500-1.000 | ~3.000-5.000 |

Premissa: uso B2B em horário comercial (não tráfego 24/7 uniforme como um
app de consumo), daí o fator de pico maior concentrado em janelas do dia —
ver `docs/scaling-checklist.md` para como o autoscaling do Render reage a
isso.

## 6. Mapeamento para planos concretos, por tier

Resumo executivo — detalhamento passo a passo (o que clicar em cada
dashboard) está em `docs/scaling-checklist.md`, não aqui.

| Camada | T1 (100/5k) | T2 (1.000/50k) | T3 (10.000/500k) |
|---|---|---|---|
| Render (backend) | 1 instância, plano de entrada pago (não free — free dorme e não sustenta SLA nenhum) | 2+ instâncias com autoscaling, plano intermediário | 3-4+ instâncias com autoscaling, plano com mais CPU/memória por instância |
| Redis | Opcional ainda (rate limiting em memória é aceitável) | Upstash (ou equivalente) provisionado — necessário para rate limiting consistente entre instâncias | Upstash em plano com mais throughput/conexões, alta disponibilidade |
| Supabase (banco) | Plano pago de entrada, backup diário | Plano com PITR habilitado; avaliar 1 read replica se relatórios/IA pesarem no primário | Plano enterprise/dedicado, PITR + read replica(s), connection pooling em modo transaction obrigatório |
| Vercel (frontend) | Plano de entrada (CDN/Edge já incluído por padrão) | Mesmo — Vercel já escala automaticamente; revisar limites de banda/build do plano | Plano com SLA formal e suporte, se o negócio exigir contrato de disponibilidade com o cliente final |

## Fontes e limitações

- Os thresholds de latência e os fatores de pico de RPS são julgamento de
  engenharia (prática comum de mercado para SaaS B2B), não uma medição
  deste projeto nem um benchmark de terceiros citado.
- Os tiers de backup/PITR do Supabase e os planos do Render/Vercel mudam de
  nome e preço ao longo do tempo — sempre confirmar contra a documentação
  oficial vigente antes de assinar um plano com base neste documento.
- Este documento não substitui uma análise de capacidade real (load
  testing) contra o próprio backend — recomendado antes de comprometer
  qualquer um destes números com um cliente como SLA contratual.
