# Fase 4 — Inteligência Artificial Corporativa

Referência: roadmap (`spec/roadmap.md`, seção Fase 4) e a seção correspondente
da master spec. Este documento cobre o que foi construído, a decisão central
de arquitetura (`AiProvider`), as simplificações assumidas e como foi
verificado — mesmo formato de `docs/fase3-portal-atendimento.md`.

## A decisão central: a abstração `AiProvider`

Este sandbox não tem GPU nem um servidor Ollama alcançável, e não existe
pipeline de treinamento nem dataset rotulado neste projeto. Em vez de fingir
uma integração real de LLM/ML, a Fase 4 isola toda "geração de texto" atrás
de uma interface mínima — a mesma filosofia de "simplificação documentada"
já usada para o gateway de pagamento fake (Fase 2) e para o webhook
fire-and-forget sem fila de retry (Fase 3):

```ts
interface AiProvider {
  generateText(prompt: string, context: Record<string, unknown>): Promise<string>;
}
```

Contrato deliberado: quem chama `generateText` (sempre o `AiService`) já
computou **todos** os números/fatos a partir dos dados reais do tenant —
nunca inventados — e passa isso em `context` (sempre com uma chave `kind`
identificando o tipo de resposta). O provider só decide **como** fraseá-los
em português; nunca decide **quais** números aparecem.

Duas implementações (`backend/src/modules/ai/providers/`):

- **`DeterministicAiProvider`** (default, `AI_PROVIDER=deterministic`) —
  ignora `prompt`, usa `context.kind` para escolher um template fixo
  (`ai-templates.ts`) e interpola os números recebidos. Não depende de rede,
  GPU nem de nenhum serviço externo — é o único caminho exercitado pelos
  testes automatizados deste projeto.
- **`OllamaAiProvider`** (`AI_PROVIDER=ollama`) — código real e funcional
  (não um stand-in) que faz `fetch` para `${OLLAMA_BASE_URL}/api/generate`
  com o modelo `OLLAMA_MODEL`, mandando `prompt` + `context` serializado em
  JSON com uma instrução explícita de nunca inventar números fora do
  fornecido. **Não é exercitado pelos testes automatizados** porque este
  sandbox não tem rede para alcançar um Ollama de verdade — mesma classe de
  limitação documentada do "sem integração real de pagamento" da Fase 2.
  Qualquer falha (timeout, HTTP não-ok, resposta vazia, servidor fora do ar)
  nunca é lançada para quem chamou — cai de volta para o
  `DeterministicAiProvider` automaticamente (mesma filosofia de
  confiabilidade do `WebhooksService.dispatch()`), então o assistente nunca
  fica sem resposta por causa de infraestrutura de IA indisponível.

A seleção acontece via `AiModule` (factory provider injetada por
`ConfigService`), lendo o env var `AI_PROVIDER` (default `deterministic`).
Nenhum consumidor (`AiService`) sabe qual implementação concreta está por
trás do token `AI_PROVIDER` — só conhece a interface.

## O que existe

- **1 tabela nova** (RLS + isolamento por tenant, mesmo padrão das fases
  anteriores): `ai_query_logs` — auditoria específica das perguntas feitas
  ao assistente (`POST /ai/ask`), guardando pergunta, intenção reconhecida,
  resposta final e o provider configurado. É a única tabela nova da Fase 4:
  todo o resto (resumo, Score IA, próxima ação, rascunho de email, cobrança
  inteligente, previsão de pipeline) é computado on-the-fly a partir de
  tabelas que já existem (`customers`/`invoices`/`contracts`/
  `opportunities`/`tickets`), sem persistência própria.
- **`AiModule`** (`/ai`, interno — admin/gestor/vendedor/financeiro, nunca
  `cliente_portal`):
  - `POST /ai/ask` — `{ question: string }`. Intent detection por
    casamento de padrões (regex/keyword, `intent-parser.ts`) — **não é um
    classificador de linguagem natural real**, é um rótulo honesto para o
    que de fato existe: reconhece "quais clientes possuem mais de R$X mil
    vencidos" (extrai o valor, soma faturas vencidas por cliente, ABAC-scoped
    para vendedor) e "resuma a empresa X"/"resuma o cliente X" (fuzzy match
    pelo nome, delega para o resumo abaixo). Qualquer outra pergunta recebe
    uma mensagem honesta explicando os dois formatos suportados — nunca uma
    resposta inventada. Cada pergunta é gravada em `ai_query_logs`
    (best-effort, nunca derruba a resposta se a gravação falhar).
  - `GET /ai/customers/:id/summary` — resumo textual do Cliente 360°
    (score IA, financeiro, contratos, comercial, atendimento), ABAC-scoped
    via `CustomersService.findOne`.
  - `GET /ai/customers/:id/score-ia` — o **Score IA real da Fase 4**, que
    supersede o Score Financeiro da Fase 2 como o que o Cliente 360° exibe
    como principal (ver seção própria abaixo).
  - `GET /ai/opportunities/:id/next-action` — sugestão de próxima ação
    (regra fixa sobre estágio/dias sem atividade/valor —
    `next-action.ts`), ABAC-scoped via `OpportunitiesService.findOne`.
  - `POST /ai/opportunities/:id/draft-email` — rascunho de email
    (assunto + corpo) a partir dos dados da oportunidade/cliente/contato
    principal.
  - `GET /ai/finance/collections-suggestions` — estende a listagem de
    faturas vencidas da Fase 2 com prioridade/canal sugeridos por fatura
    (regra fixa por dias de atraso — `collections.ts`). RBAC igual ao
    relatório de comissões da Fase 2: `admin`/`gestor`/`financeiro` veem
    tudo, `vendedor` só as próprias (ABAC via `InvoicesService.findAll`).
  - `GET /ai/predictions/pipeline` — previsão heurística de fechamento
    (soma do valor de oportunidades abertas × taxa de conversão assumida
    por estágio — `pipeline-forecast.ts`), ABAC-scoped via
    `OpportunitiesService.findAll`.
- **Frontend**: `/dashboard/assistente` (chat simples, com as perguntas de
  exemplo suportadas exibidas explicitamente — mesma honestidade do
  fallback do backend), seção "Resumo IA" + badge "Score IA" no Cliente
  360° (mantendo o badge "Score Financeiro (Fase 2)" ao lado, rotulado como
  superseded), sugestão de próxima ação + rascunho de email sob demanda por
  card no Pipeline (mais o total da previsão heurística no topo), e a seção
  "Cobranças Inteligentes" no Financeiro.

## O Score IA — o que muda em relação ao Score Financeiro (Fase 2)

O Score Financeiro (`FinanceService.customerScore`, Fase 2) é uma heurística
simples: pontualidade + inadimplência, classificando em verde/amarelo/
vermelho por thresholds fixos. O Score IA (`AiService.scoreIa`,
`backend/src/modules/ai/scoring.ts`) é um **modelo ponderado sobre mais
sinais**, ainda determinístico e transparente — não há dataset rotulado nem
infraestrutura de treino neste projeto, então "aprendizado de máquina de
verdade" (texto do roadmap) seria uma alegação falsa. É honestamente rotulado
como "modelo determinístico pronto para ser trocado por um modelo treinado
depois", não uma alegação de ML real:

| Sinal | Peso | Fonte |
|---|---|---|
| Pontualidade de pagamento | 25% | `FinanceService.customerScore` (Fase 2, reusado) |
| Saúde de inadimplência (inverso) | 25% | `FinanceService.customerScore` (Fase 2, reusado) |
| Tendência de volume recebido (90d vs. 90d anteriores) | 15% | Consulta direta a `invoices.paid_at`/`paid_amount` |
| Tempo de relacionamento (tenure) | 10% | `relationshipDays` (Fase 2, reusado) |
| Satisfação (proxy via volume/severidade de chamados, 180d) | 15% | `tickets.priority` |
| Histórico de renovação de contratos | 10% | `ContractsService.findAll` (`status = 'renovado'`) |

Os pesos somam 1.0 e foram escolhidos por julgamento de produto, não
calibrados estatisticamente (documentado explicitamente como heurística, não
uma calibração). Score final 0–100, classificação verde (≥75) / amarelo
(≥45) / vermelho (<45).

**Decisão sobre o Score Financeiro (Fase 2)**: não foi removido. O Score IA
o chama internamente e reusa `punctualityRate`/`delinquencyRate`/
`relationshipDays` como três dos seis sinais — em vez de duplicar essa
conta. O endpoint `GET /finance/customers/:id/score` continua respondendo
(não quebra nenhum consumidor existente), mas o Cliente 360° agora mostra o
Score IA como badge principal, com o Score Financeiro ao lado, rotulado
como "Fase 2, superseded". Ver o doc-comment de
`FinanceService.customerScore` para a mesma explicação em código.

## Simplificações assumidas nesta fase

- **Assistente sem memória entre perguntas**: cada pergunta em
  `POST /ai/ask` é avaliada isoladamente — não há contexto de conversa
  (multi-turn), sessão de chat persistida nem "lembrar" o que foi perguntado
  antes. O frontend guarda o histórico só na tela (estado local do
  componente), não no backend.
- **NLU é casamento de padrões, não um classificador real**: `intent-parser.ts`
  reconhece exatamente dois formatos de pergunta (mais variações de
  singular/plural/acentuação) via regex — não generaliza para paráfrases
  fora desses formatos, nem faz nenhum tipo de embedding/busca semântica.
  Documentado no próprio código como "rule-based NLU stand-in".
- **Score IA é um modelo determinístico ponderado, não ML treinado**: sem
  dataset rotulado nem pipeline de treino — os pesos são heurísticos,
  documentados como tal, prontos para serem substituídos por um modelo
  treinado no futuro sem mudar o contrato do endpoint.
- **Previsão de pipeline é heurística, não um modelo preditivo treinado**:
  taxa de conversão por estágio é uma suposição fixa
  (`pipeline-forecast.ts`), não calculada a partir de negócios fechados no
  passado (não há volume suficiente neste projeto para isso ser
  significativo).
- **Sem RAG/busca vetorial**: os resumos e respostas usam só os dados
  estruturados já existentes nas tabelas do CRM — não há indexação de
  documentos livres, embeddings nem busca semântica sobre texto não
  estruturado (ex.: corpo de emails, anexos).
- **Sugestão de cobrança é agregada, não uma frase de IA por fatura**: a
  frase-resumo (`finance.collections-summary`) passa pelo `AiProvider` uma
  única vez por chamada; prioridade/canal por fatura são regra fixa, não
  uma chamada de "IA" por linha — decisão de custo/latência para listas que
  podem ter dezenas de itens.
- **`OllamaAiProvider` é código real, não testável neste sandbox**: sem
  rede para alcançar um servidor Ollama — mesma classe de limitação do "sem
  integração real de pagamento" da Fase 2. Funciona de verdade assim que
  `OLLAMA_BASE_URL` apontar para um servidor self-hosted alcançável.

## Verificação feita

- Backend: `tsc --noEmit`, `eslint --fix` (0 erros), `jest`
  (168 passed / 3 skipped — mesma causa documentada em `docs/setup.md`,
  dependente de `prisma generate`), `npm run build`. Testes novos cobrem:
  parsing de intenção para os dois formatos suportados + o caso de
  fallback honesto (`intent-parser.spec.ts`), fuzzy matching de nome de
  cliente, o modelo de pesos do Score IA em perfis representativos
  (pontual/baixo-atraso → score alto; cronicamente atrasado/alta
  inadimplência → score baixo; perfil misto → faixa intermediária —
  `scoring.spec.ts`), a regra de próxima ação e de sugestão de cobrança
  (`next-action.spec.ts`, `collections.spec.ts`), a previsão de pipeline
  (`pipeline-forecast.spec.ts`), o `DeterministicAiProvider` produzindo
  saída estável e não vazia para cada tipo de contexto
  (`deterministic-ai.provider.spec.ts`), e o `OllamaAiProvider` nunca
  lançando em nenhum cenário de falha (rede indisponível, HTTP não-ok,
  resposta vazia) — sempre caindo no determinístico
  (`ollama-ai.provider.spec.ts`). `ai.service.spec.ts` cobre a integração
  entre o service e os sub-services (ABAC propagado de
  `CustomersService`/`OpportunitiesService`/`InvoicesService`, roteamento
  de intenção ponta a ponta usando o `DeterministicAiProvider` de verdade
  via `jest.spyOn`).
- Frontend: `eslint` e `next build` limpos, incluindo a página nova
  (`/dashboard/assistente`) e as extensões ao Cliente 360°, Pipeline e
  Financeiro.
- RLS reconfirmada ao vivo num Postgres 16 real na tabela nova
  (`ai_query_logs`), com dois tenants simulados nunca vendo os dados um do
  outro — mesmo teste de sempre: sem `app.tenant_id` setado → 0 linhas;
  contexto = Tenant A → só dados do Tenant A aparecem; contexto = Tenant A
  com `WHERE` pedindo Tenant B (simula bug na Camada 2) → 0 linhas mesmo
  assim; contexto = Tenant B → só dados do Tenant B aparecem.

## Próximo passo natural

Fase 5 — Hardening, Escala e Observabilidade, conforme `spec/roadmap.md`.
