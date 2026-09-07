# Redesign de UI — Dashboard interno (UI-only)

> Este documento não é uma "Fase" numerada do roadmap (`spec/roadmap.md` não
> foi alterado): é uma redesign puramente visual/de interação sobre o
> dashboard interno já completo (Fases 0-5), sem nenhuma mudança de regra de
> negócio, endpoint de backend ou schema de banco.

## Pedido original

> "o sistema está com visual muito básico e antigo, precisamos modernizar,
> com gráficos, KPI, menus clean. O menu principal pode ficar na lateral e
> com a opção de esconder e expandir. os cadastros podem ser acionados
> apenas quando clicar no botão de novo cadastro. Sendo assim, os dados para
> cadastro não devem ficar expostos na tela do grid. nos menus, utilize a
> icones para deixar a aparência mais moderna."

Decisões confirmadas antes de começar:

1. Formulários de novo cadastro abrem num **painel lateral (drawer) da
   direita**, não num modal centralizado.
2. Escopo restrito a `frontend/src/app/(dashboard)/...` — Portal do Cliente
   (`(portal)`) e autenticação (`(auth)`) ficam fora desta rodada.
3. Paleta **neutra indigo/slate**, documentada para troca fácil por cores de
   marca reais depois.

## Decisões de design

### Paleta de cores

A cor de marca (`brand.*`, definida em `tailwind.config.ts`) já era um
indigo (`#2f4bc4`/`#3b5bdb`) — mantida como está e reaproveitada como o
acento principal de UI (botões primários, ícones ativos, links). Os gráficos
usam uma paleta separada em `frontend/src/lib/chart-colors.ts`:

- `CHART_CATEGORICAL` — escala de até 6 tons de indigo/slate para séries e
  barras por categoria.
- `CHART_SEMANTIC` — verde/âmbar/vermelho/slate fixos para estados de
  negócio (recebido/atrasado/etc.) — **não** trocar por marca: o significado
  precisa continuar reconhecível mesmo que a marca mude de cor.
- `CHART_GRID`, `CHART_AXIS_TEXT`, `CHART_TOOLTIP_STYLE` — estilo consistente
  de grid/eixo/tooltip em todos os gráficos.

Para trocar por cores de marca reais no futuro: editar só
`chart-colors.ts` (paleta dos gráficos) e os tokens `brand.*` em
`tailwind.config.ts` (acentos de UI) — nenhum componente de página precisa
mudar.

### Bibliotecas escolhidas (com verificação de compatibilidade React 19)

O projeto já estava em Next.js 16.3.4 + React 19.2.0. Antes de instalar
qualquer coisa, `npm view <pacote> peerDependencies` foi conferido para
cada candidato — todos declaram suporte a React 19 na versão instalada, e a
instalação (`npm install`, sem `--legacy-peer-deps`/`--force`) não
apresentou nenhum conflito de peer dependency:

| Pacote | Versão instalada | peerDependencies (React) |
|---|---|---|
| `lucide-react` | 1.42.0 | `^16.5.1 \|\| ^17 \|\| ^18 \|\| ^19` |
| `recharts` | 3.10.1 | `^16.8 \|\| ^17 \|\| ^18 \|\| ^19` |
| `@radix-ui/react-dialog` | 1.1.23 | `^16.8 \|\| ^17 \|\| ^18 \|\| ^19 \|\| ^19.0.0-rc` |

- **`lucide-react`** — ícones em todo o menu, cabeçalhos de seção, KPIs e
  botões.
- **`recharts`** — gráfico de barras (pipeline por estágio, fluxo de caixa).
- **`@radix-ui/react-dialog`** — primitivo acessível (foco preso, Esc fecha,
  overlay) usado para construir o `Drawer` (estilo próprio em Tailwind, sem
  nenhum CSS de biblioteca de componentes de terceiros).

### Padrão de Drawer

`frontend/src/components/ui/drawer.tsx` — painel lateral genérico (Radix
Dialog + Tailwind, animação de slide via `@keyframes` em `globals.css`).

`frontend/src/components/ui/create-drawer.tsx` — combina o botão "Novo X"
com o Drawer, via render-prop: `{(close) => <MeuForm onSuccess={close} />}`.
Cada formulário existente (`new-customer-form.tsx`, `new-contact-form.tsx`,
etc.) ganhou um prop opcional `onSuccess?: () => void`, chamado depois do
`router.refresh()` já existente — **nenhuma lógica de validação, payload ou
chamada de API foi reescrita**, só a adição desse callback e (nos 3 casos
que já tinham um toggle interno "abrir caixinha inline" — `new-quote-form`,
`generate-invoices-form`, `register-payment-form`) a troca da caixa inline
pelo mesmo `Drawer` compartilhado.

Exceção deliberada: `new-webhook-form.tsx` **não** recebeu `onSuccess`
automático — o formulário mostra o `secret` gerado uma única vez após criar
o webhook, então o drawer correspondente fica aberto até o usuário fechar
manualmente (dar tempo de copiar o secret) em vez de fechar sozinho e
esconder a informação.

Ações que não são "novo cadastro" (trocar estágio, marcar atividade
concluída, aprovar/rejeitar proposta, ativar/desativar webhook, renovar
contrato, etc.) permanecem como estavam — botões/selects inline na própria
linha, sem drawer, porque não expõem campos de formulário na grid.

### Sidebar

`frontend/src/components/layout/sidebar.tsx` (client component) +
`frontend/src/components/layout/nav-items.ts` (lista de rotas/ícones).
Mesmos 9 itens do header antigo, um ícone Lucide por item. Colapsa para
72px (só ícone, com `title` nativo como tooltip) ou expande para 256px
(ícone + rótulo); preferência salva em `localStorage`
(`crm.sidebar.collapsed`) — é conveniência de UI por navegador, não
sincroniza com o backend. Rota ativa destacada comparando `usePathname()`.
Nenhuma lógica de visibilidade por role existia no header antigo (cada
página trata seu próprio 403), então a sidebar preserva esse comportamento
— não foi inventada nenhuma restrição nova.

`frontend/src/app/(dashboard)/layout.tsx` foi reescrito para um layout de
duas colunas (sidebar fixa + conteúdo), mantendo os redirects existentes
(`sem cookie → /login`, `token inválido → /login`, `cliente_portal →
/portal`).

### KPIs e gráficos

`frontend/src/components/ui/kpi-card.tsx` — tile reutilizado em Dashboard,
Pipeline, Financeiro, Contratos e Chamados (ícone + rótulo + número grande +
variação/legenda opcional).

`frontend/src/components/charts/stage-value-chart.tsx` (barras — valor de
oportunidades abertas por estágio, usado no Dashboard e no Pipeline) e
`cashflow-chart.tsx` (barras agrupadas — esperado vs. recebido por mês, no
Financeiro). Todos os dados vêm de endpoints que já existiam
(`backend.opportunities`, `backend.financeDashboard`,
`backend.aiPipelineForecast`) — **nenhum endpoint novo foi criado no
backend** para esta redesign.

O KPI "SLA estourado" em Chamados é calculado no frontend (client dos dados
já retornados por `GET /tickets`: `status` + `slaDueAt` comparado a
`Date.now()`), porque o backend ainda não expõe esse breakdown pronto —
documentado no próprio código (`frontend/.../chamados/page.tsx`) como uma
lacuna conhecida, não um endpoint novo criado às pressas.

### Outros componentes de UI

`Card`/`CardHeader`, `Badge`, `Button`, `EmptyState` — em
`frontend/src/components/ui/`, consolidam estilos que antes eram repetidos
(e levemente inconsistentes) em cada `page.tsx`: cantos arredondados,
borda/sombra sutis, espaçamento e tipografia consistentes, e um estado
vazio padrão (ícone + mensagem curta + CTA "Novo X") em vez da antiga linha
de texto solto "Nenhum X cadastrado ainda" dentro da tabela.

## Páginas redesenhadas

Todas em `frontend/src/app/(dashboard)/dashboard/`:

- `page.tsx` (Dashboard) — vira uma visão geral de verdade: KPIs (clientes,
  oportunidades abertas + valor, a receber, chamados em aberto) + gráfico de
  pipeline por estágio + tabela de usuários restilizada.
- `clientes/page.tsx` — botão "Novo cliente" (drawer), tabela só com dados,
  estado vazio.
- `clientes/[id]/page.tsx` (Cliente 360°) — a página com mais formulários
  inline antes (8 ao todo). Cada seção (Contatos, Oportunidades, Contratos,
  Agenda, Portal do Cliente) ganhou um botão "Novo X" no cabeçalho do card
  que abre o drawer; os cadastros aninhados por linha (nova proposta por
  oportunidade, gerar parcelas por pedido, registrar pagamento por fatura)
  usam o mesmo Drawer compartilhado a partir de um gatilho pequeno na
  própria linha.
- `pipeline/page.tsx` — botão "Nova oportunidade" (drawer), KPIs (abertas,
  valor em aberto, previsão de fechamento), gráfico de valor por estágio.
- `financeiro/page.tsx` — KPIs restilizados (a receber/recebido/atrasado/
  faturas vencidas), gráfico de fluxo de caixa, Cobranças Inteligentes e
  Comissões mantidas e restilizadas.
- `contratos/page.tsx` — botão "Novo contrato" (drawer), KPIs (ativos,
  vencendo em 30 dias, valor total).
- `chamados/page.tsx` — botão "Abrir chamado" (drawer), KPIs (abertos, em
  andamento, SLA estourado).
- `chamados/[id]/page.tsx` — visual restilizado; o formulário de comentário
  continua inline (é uma caixa de resposta de conversa, não um cadastro de
  registro — não faz sentido como drawer).
- `base-de-conhecimento/page.tsx` — botão "Novo artigo" (drawer, só para
  quem já podia ver o formulário antes: admin/gestor).
- `webhooks/page.tsx` — botão "Nova assinatura" (drawer que não fecha
  sozinho, ver acima).
- `assistente/page.tsx` — cabeçalho com ícone; o chat em si não mudou.

## Fora do escopo (deliberado)

- `frontend/src/app/(portal)/**` (Portal do Cliente) — decisão confirmada
  com o usuário antes de começar.
- `frontend/src/app/(auth)/**` (login/cadastro) — idem.
- Qualquer mudança de regra de negócio, endpoint de backend ou schema de
  banco — esta é uma redesign de UI, não uma Fase nova.
- Drag-and-drop no Kanban do Pipeline — segue como estava (seletor de
  estágio por card), fora do pedido original.
- Um breakdown de SLA estourado pronto no backend — calculado no frontend
  por enquanto (ver acima).

## Verificação

- `cd frontend && npm run lint` — limpo (0 problemas).
- `cd frontend && npm run build` — build de produção limpo (Turbopack,
  TypeScript e geração de página estática/dinâmica sem erros).
- **Screenshots via Playwright: não foram produzidos.** O backend NestJS
  usa Prisma com engine nativo baixado de `binaries.prisma.sh` em tempo de
  `prisma generate` — esse host está fora do allowlist de rede deste
  sandbox (confirmado via `curl "$HTTPS_PROXY/__agentproxy/status"`: `403`
  / "policy denial" em toda tentativa de CONNECT a `binaries.prisma.sh`), e
  não havia um engine já gerado em cache neste ambiente (diferente do
  `node_modules/@prisma/client` em si, que estava presente mas não
  inicializa sem o binário nativo). Sem o backend de pé, não havia como
  logar e navegar as páginas reais para capturar telas. Esta é a mesma
  limitação de ambiente já documentada em `docs/setup.md` desde a Fase 0 —
  em qualquer máquina/CI com acesso normal a `binaries.prisma.sh` (ou já com
  o client gerado previamente), `npm run start:dev` no backend e as
  screenshots funcionariam sem nenhuma ação extra.
- Nenhum arquivo em `(portal)` ou `(auth)` foi tocado — conferido por
  inspeção dos diffs antes de finalizar.

## Refinamento visual (rodada 2) — aproximação das referências

Depois da rodada acima, o cliente compartilhou 6 telas de referência
(portal de cliente, contas a receber, Kanban estilo Odoo, Customer 360 estilo
Gainsight com gauge de saúde, previsão de fluxo de caixa com barras de
"attainment" e uma lista de contratos) e pediu para o CRM se aproximar
visualmente delas. Esta seção é só a camada visual/de componente sobre o que
a rodada 1 já tinha construído — nenhum dado novo, endpoint novo ou mudança
de regra de negócio.

### Sistema de cor semântica

`frontend/src/lib/chart-colors.ts` ganhou uma seção nova (a paleta de
gráficos `CHART_*` da rodada 1 continua intacta e é usada como está):

- `SemanticTone` — 5 tons com significado fixo: `info` (azul, neutro/
  informativo), `danger` (vermelho, vencido/atrasado/cancelado), `success`
  (verde, recebido/ativo/resolvido), `warning` (âmbar/laranja, pendente/
  aberto) e `accent` (roxo, métrica em destaque — previsão de IA). Mais
  `neutral` para o caso "nem bom nem ruim".
- `SEMANTIC_CHIP_CLASSES` / `SEMANTIC_BADGE_CLASSES` / `SEMANTIC_SOLID_CLASSES`
  — a mesma paleta em 3 "forças" (chip pastel claro do KPI, pílula pastel do
  Badge, sólida para avatares), e `SEMANTIC_HEX` — a versão em hex para uso
  dentro de SVG/recharts (gauge, barra segmentada).
- `TAG_PALETTE` (6 cores pastel) e `AVATAR_PALETTE` (8 cores sólidas) — para
  tags de categoria e avatares/"logo chips" sem um tom de negócio fixo. A cor
  de cada rótulo/nome é escolhida por hash determinístico do próprio texto
  (`hashString` — djb2 simples), então a mesma tag ou o mesmo cliente sempre
  cai na mesma cor, em qualquer render, sem tabela mantida à mão.

### Componentes novos/alterados

- **`KpiCard`** (`components/ui/kpi-card.tsx`) — chip de ícone maior (40px,
  antes 32px) com a cor semântica; `tone` agora usa os 5 nomes acima (era
  `brand`/`emerald`/`amber`/`red`/`slate`). Novo prop `secondary` (label +
  valor com um "dot" da cor do tone) para KPIs de dois valores (total em R$ +
  contagem), usado em Contratos.
- **`Badge`** (`components/ui/badge.tsx`) — mesmos 5 tons + `orange` (um
  degrau extra só para prioridade de 4 níveis em Cobranças Inteligentes).
  Novo componente `TagBadge` — pílula pastel colorida por hash, para
  categoria/tag livre (usado na categoria de artigos da Base de
  Conhecimento).
- **`InitialsAvatar`** (novo, `components/ui/avatar.tsx`) — avatar de
  iniciais gerado no cliente a partir de um nome real (responsável da
  oportunidade, cliente do contrato); `shape="circle"` para pessoa,
  `shape="square"` para "logo chip" de empresa. Cor por hash do nome.
- **`AttainmentBar` / `SegmentedBar`** (novo, `components/ui/progress-bar.tsx`)
  — barra horizontal grossa de "% atingido" (referência de fluxo de caixa) e
  barra fina segmentada multi-cor (cabeçalho de coluna do Kanban).
- **`ScoreGauge`** (novo, `components/charts/score-gauge.tsx`) — gauge
  circular via `RadialBarChart` (recharts, já instalado — `RadialBarChart`/
  `RadialBar`/`PolarAngleAxis` confirmados disponíveis na v3.10.1 antes de
  usar) com arco vermelho/amarelo/verde pelos mesmos cortes de
  classificação do Score IA (`≥70` verde, `≥40` amarelo, resto vermelho — os
  mesmos cortes do backend). Ao lado, uma faixa de barras finas com a
  decomposição real por sinal (`signals`, já retornado por
  `GET /ai/customers/:id/score-ia`).
- `StageValueChart` — uma cor distinta por barra/estágio (`Cell` do
  recharts) em vez de uma cor única.
- `CashflowChart` — "Esperado" em azul (`info`) e "Recebido" em verde
  (`success`) em vez de dois tons de indigo, reforçando o significado.

### Onde cada tom foi aplicado (mapa completo)

| Página | KPI/Badge | Tom | Por quê |
|---|---|---|---|
| Dashboard | Clientes, Oportunidades abertas, A receber | `info` | informativo/neutro |
| Dashboard | Chamados em aberto | `warning` | pendente |
| Financeiro | A receber | `info` · Recebido | `success` · Atrasado/Faturas vencidas | `danger` | vencido = perigo, recebido = sucesso |
| Pipeline | Oportunidades abertas, Valor em aberto | `info` · Previsão de fechamento (IA) | `accent` | previsão de IA é a métrica "em destaque" |
| Contratos | Contratos ativos | `success` (+ secundário: valor ativo) · Vencendo em 30 dias | `warning` · Valor total | `info` (+ secundário: contagem) | dois-valores conforme referência |
| Chamados | Abertos | `warning` · Em andamento | `info` · SLA estourado | `danger` | |
| Status (ticket/fatura/pedido/proposta/contrato) | mapas novos em `lib/crm-constants.ts` (`TICKET_STATUS_TONE`, `INVOICE_STATUS_TONE`, `ORDER_STATUS_TONE`, `QUOTE_STATUS_TONE`, `CONTRACT_STATUS_TONE`) | aberto/pendente→`warning`, pago/resolvido/ativo/concluído→`success`, cancelado/rejeitado→`danger`, em_andamento/enviada→`info`, rascunho/fechado→`neutral` | um único lugar por entidade, reaproveitado em toda lista/detalhe |
| "vence em Nd" (contrato) | `expiringSoonTone()` | `danger` se ≤7 dias, senão `warning` | urgência real, não um tom fixo para todo `expiringSoon` |

Pedidos e propostas (Cliente 360°) mostravam o status como texto solto antes
desta rodada — agora usam `Badge` com os mapas acima.

### Pipeline Kanban — o que foi adicionado e o que foi deliberadamente omitido

Adicionado: valor total por coluna, barra segmentada sob o cabeçalho de cada
coluna e avatar de iniciais do responsável no card. A barra segmentada usa a
`winRate` por estágio que a IA da Fase 4 já calcula
(`GET /ai/predictions/pipeline`) como proporção real (verde = chance de
fechamento, cinza = restante); para as colunas "fechado (ganho)"/"fechado
(perdido)" não existe previsão — é fato consumado — então a barra ali é
100% verde ou 100% vermelha. O avatar do responsável usa `ownerId` já
existente na oportunidade, resolvido para nome via `GET /users` (endpoint já
usado no Dashboard, não é uma chamada nova).

**Omitido de propósito** (documentado também como comentário em
`pipeline/page.tsx`):

- **Tags/pílulas de produto ou categoria por card** — `OpportunityWithCustomer`
  (`lib/backend.ts`) não tem nenhum campo taggable (só
  `id/customerId/title/stage/value/ownerId/createdAt/customer`). Inventar
  categorias fixas teria sido dado fabricado — não foi feito.
- **Estrelas de prioridade por card** — não existe campo de prioridade na
  entidade `Opportunity`. Prioridade só existe em `Ticket` (outra entidade)
  e em `AiNextAction` (calculado sob demanda por oportunidade individual, via
  `POST/GET` separado — trazer isso para a listagem inteira seria N chamadas
  extras por render, fora do padrão "sem endpoint novo" desta rodada).
- **Ícone de "próxima ação" (telefone/email/agenda) por card** — exigiria a
  atividade mais recente por oportunidade, que só vem embutida no Cliente
  360° (`customer.activities`), não na listagem de oportunidades usada no
  Kanban. Buscar isso por card seria N chamadas extras — não foi feito.

### Financeiro — o que foi adicionado e o que foi deliberadamente omitido

Adicionado: cores semânticas no gráfico de fluxo de caixa (Esperado=azul,
Recebido=verde) e KPIs recoloridos pela tabela acima.

**Omitido**: gráfico de área para "aging"/inadimplência por faixa de atraso,
e gráfico de barras laranja para previsão. `FinanceDashboard`
(`lib/backend.ts`) só expõe `totalReceivable/totalReceived/totalOverdue/
overdueCount/cashflow` (mês → esperado/recebido) — não existe nenhuma
métrica de aging por faixa nem uma previsão financeira pronta (a única
previsão que existe no sistema é `aiPipelineForecast`, que é sobre pipeline
comercial, não sobre financeiro — usá-la aqui seria uma métrica fora de
contexto, não uma previsão financeira real). Sem um número real por trás,
essas duas peças da referência não foram construídas.

### Cliente 360° — gauge de saúde e barra de atainment

O Score IA (badge de texto simples antes) virou o indicador PRIMÁRIO via
`ScoreGauge` — um gauge circular com o score/100 e arco colorido pela mesma
faixa de classificação do backend. Ao lado do gauge, em vez do "sparkline de
histórico" da referência (que pressupõe uma série temporal de score que este
backend não tem — não existe endpoint de histórico de score), mostramos a
decomposição real por sinal (`signals`: pontualidade, saúde de
inadimplência, tendência de volume, tempo de relacionamento, satisfação,
renovação de contrato) — dado genuíno já retornado pela Fase 4, só nunca
antes exibido na tela. O Score Financeiro (heurística mais simples da Fase 2)
continua como badge de texto ao lado, sem virar gauge — ele já é superseded
pelo Score IA no restante da doc.

Novo, abaixo do gauge: uma `AttainmentBar` para a taxa de pontualidade
(`CustomerScore.punctualityRate`, 0–1, já calculada pelo backend mas nunca
exibida antes — só a classificação agregada aparecia). É a peça que cobre o
pedido de barras de "attainment" da referência de fluxo de caixa, usando um
percentual real em vez de inventar uma métrica de SLA/atainment que não
existe no sistema.

### Verificação (rodada 2)

- `cd frontend && npm run lint` — limpo (0 problemas).
- `cd frontend && npm run build` — build de produção limpo (Turbopack,
  TypeScript e geração de página estática/dinâmica sem erros).
- **Screenshots: novamente não foi possível.** Nova tentativa de
  `npx prisma generate` no backend confirmou a mesma restrição de rede já
  documentada acima: `curl "$HTTPS_PROXY/__agentproxy/status"` lista
  `connect_rejected` / 403 para `binaries.prisma.sh` neste sandbox, e a
  tentativa de `prisma generate` falha com
  `Failed to fetch sha256 checksum at https://binaries.prisma.sh/... 403
  Forbidden`. Sem o engine nativo do Prisma, o backend não sobe, então não
  há como logar e navegar as páginas reais para capturar telas — mesma
  limitação de ambiente da rodada 1, não uma tentativa nova sem sucesso por
  falta de esforço.
