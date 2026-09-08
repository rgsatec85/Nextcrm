# Fase 9 — Contratos ampliados (RF013)

Continuação da numeração RF011-RF016 da v3.1 "Quote-to-Cash" (ver
`spec/crm-enterprise-master-spec-v3.md`, seção 26, e `spec/roadmap.md` no
projeto Claude) — Contratos passou de um cadastro simples (título, valor,
vigência, renovação) para um documento de verdade: corpo em texto rico,
modelos reutilizáveis com campos dinâmicos e geração de PDF, no mesmo
espírito do que a Fase 6 (RF011) fez para Propostas.

## O que já existia (Fases 0-8) vs. o que muda

Contratos existia desde a Fase 2 como um registro de vigência/renovação
(RF alerta de vencimento em 30 dias, cron de webhook `contract.expiring`).
Não havia corpo de texto, modelo, nem PDF. A partir da Fase 9:

1. Novo estado **'rascunho'** — status inicial de todo contrato novo (era
   `'ativo'` por padrão antes). Um contrato em rascunho pode ter seu corpo
   editado livremente; os demais campos (título, valor, vigência, renovação)
   continuam editáveis em qualquer status, como sempre.
2. `contracts.body` — corpo do contrato em HTML (rich text), **travado**
   assim que o contrato sai de 'rascunho' (`PATCH /:id/activate` ou qualquer
   caminho que mude o status) — mesmo padrão de `OrdersService` travando
   itens quando já existe fatura. Reverter para rascunho não é suportado
   nesta fase.
3. Nova biblioteca de **modelos de contrato** (`contract_templates`/
   `ContractTemplatesService`, mesmo desenho de `ProposalTemplatesService`)
   com campos dinâmicos `{{cliente.nome}}`, `{{valor}}`,
   `{{vigencia_inicio}}`, `{{vigencia_fim}}`, `{{vendedor}}`, `{{data}}`.
   **Diferença deliberada** do padrão de Propostas: o corpo do modelo é
   **copiado** para dentro do contrato no momento em que é aplicado (na
   criação, via `templateId`, ou depois via `PATCH /:id/apply-template`),
   com os campos já substituídos — e passa a viver de forma independente.
   Editar o modelo depois **não** muda contratos já criados a partir dele.
   Isso é o oposto do que Quote/ProposalTemplate fazem (onde o modelo fica
   "vivo" e só é substituído na hora de gerar o PDF) — decisão intencional:
   um contrato é um documento jurídico, não deveria mudar retroativamente
   porque alguém editou o modelo de origem depois.
4. Geração de **PDF do contrato** (`GET /contracts/:id/pdf`), mesmo padrão
   `pdfkit`/`StreamableFile` de `ProposalPdfService` — com um renderizador
   próprio de HTML para pdfkit (ver abaixo), já que pdfkit não tem parser de
   HTML embutido.

## Segurança: por que o corpo passa por sanitização

O corpo do contrato é produzido por um editor rich text baseado em
`contentEditable` no frontend (decisão do usuário: "editor leve, sem
biblioteca pesada nova" — nada de TipTap ou similar). Isso significa que o
HTML persistido vem direto do navegador de quem está editando, e é depois
**re-exibido para outras pessoas do mesmo tenant** (`dangerouslySetInnerHTML`
no modo somente-leitura) e também **interpretado no backend** para montar o
PDF. Sem tratamento, isso é um vetor clássico de XSS armazenado.

Por isso, todo corpo de contrato ou de modelo passa por
`sanitizeContractBody()` (`backend/src/modules/contracts/
sanitize-contract-body.ts`, usando `sanitize-html`) **antes** de qualquer
`create`/`update` no Prisma — tanto em `ContractsService` quanto em
`ContractTemplatesService`. A allowlist é restrita: `p, br, h1-h3, ul, ol,
li, b, strong, i, em, u, a, span`; o único atributo aceito é `a[href]`, só
com esquemas `http`, `https` e `mailto` — qualquer outra tag, atributo ou
esquema (incluindo `<script>`, `onerror=`, `javascript:`) é removido. Links
também ganham `rel="noopener noreferrer" target="_blank"` automaticamente.

## Banco de dados (`database/migrations/0010_fase9_contratos.sql`)

- Nova tabela `contract_templates` (mesmo desenho de `proposal_templates` da
  0007, mas com `body` em vez de `clauses`) — categoria livre, sem CHECK
  (mesmo raciocínio de `proposal_templates.category`).
- `contracts` ganha `body text` e `template_id uuid` (FK para
  `contract_templates`, `ON DELETE SET NULL` — apagar um modelo não apaga
  nem trava contratos que já o usaram).
- `contracts_status_check` (a CHECK original de `0003_fase2_financeiro.sql`)
  expandida de `('ativo', 'encerrado', 'renovado')` para incluir
  `'rascunho'` — mesmo padrão `DROP CONSTRAINT IF EXISTS` + `ADD CONSTRAINT`
  já usado em `0007_fase6_propostas.sql` para o status de `quotes`.
- Default de `contracts.status` muda de `'ativo'` para `'rascunho'` —
  **só afeta inserções novas**; contratos já existentes mantêm o status que
  já tinham, nenhuma linha é alterada pela migration.

## Backend

- `ContractsService.create()`: se `dto.templateId` for informado, busca o
  modelo, monta os campos dinâmicos (cliente, valor, vigência, dono do
  cliente) e grava o corpo já substituído; senão usa `dto.body` (saneado)
  ou nasce sem corpo.
- `ContractsService.update()`: agora recusa (`409 Conflict`) qualquer
  tentativa de mudar `body` quando `status !== 'rascunho'`.
- `ContractsService.activate()` (novo, `PATCH /:id/activate`): rascunho ->
  ativo. Rejeita se o contrato não estiver em rascunho.
- `ContractsService.applyTemplate()` (novo, `PATCH /:id/apply-template`):
  substitui o corpo do contrato pelo corpo do modelo (campos já
  substituídos) — só permitido em rascunho.
- `ContractsService.pdf()` / `GET /contracts/:id/pdf`: gera o PDF via
  `ContractPdfService`.
- `ContractPdfService` (`contract-pdf.service.ts`): cabeçalho (título,
  status, vigência, valor, cliente) + corpo — renderizado por
  `renderContractBody()` (`contract-body-renderer.ts`) quando existe, ou um
  aviso honesto ("Nenhum conteúdo registrado para este contrato.") quando o
  contrato ainda não tem corpo. Nunca inventa texto.
- `ContractTemplatesModule` (novo, mirror exato de `ProposalTemplatesModule`
  com sanitização do `body` em `create`/`update`): leitura aberta a todos os
  perfis internos (vendedor precisa escolher um modelo), autoria restrita a
  admin/gestor.
- `PortalService.contracts()`: passou a **excluir contratos em rascunho** da
  visão do cliente no portal — um contrato em elaboração é um estado
  interno, não algo que o cliente deveria ver como "seu contrato" ainda.
  (Achado durante esta fase: antes de adicionar `sanitizeContractBody`/
  `status`, não havia esse filtro porque `'rascunho'` simplesmente não
  existia como status possível.)

### Renderizador HTML -> PDF (`contract-body-renderer.ts`)

pdfkit não tem parser de HTML embutido, então este módulo faz o trabalho
manualmente com `htmlparser2`: percorre a árvore já saneada reconhecendo
blocos (`h1`/`h2`/`h3`/`p`/`ul>li`/`ol>li`, com contador para listas
numeradas) e, dentro de cada bloco, "runs" de texto alternando
negrito/itálico/sublinhado/link conforme encontra `b`/`strong`, `i`/`em`,
`u`, `a` (e convertendo `<br>` em quebra de linha literal). Cada bloco é
desenhado trocando a fonte do pdfkit entre Helvetica/Helvetica-Bold/
Helvetica-Oblique/Helvetica-BoldOblique e usando `continued: true` entre
runs do mesmo bloco. **Simplificação assumida**: formatação inline é
"melhor esforço" — uma quebra de linha no meio de um run contínuo pode não
quebrar visualmente de forma perfeita, e uma mistura muito profunda de
formatações aninhadas não tem garantia de resultado pixel-perfect. Para o
conteúdo que o editor do frontend realmente produz (parágrafos, títulos,
listas, negrito/itálico/sublinhado/link simples) o resultado é fiel —
verificado manualmente gerando um PDF de teste com todos os elementos
suportados.

### Nota sobre versão do `sanitize-html`/`htmlparser2`

O backend fixa `sanitize-html` em `2.17.0` (sem `^`, versão exata) e
`htmlparser2` em `^8.0.2`. Isso é deliberado: a partir da versão `2.17.1`,
`sanitize-html` passou a depender de `htmlparser2@^12`, que — junto com suas
próprias dependências (`domhandler`, `domutils`, `domelementtype`,
`entities`) — virou ESM-only (`"type": "module"`, sem build CJS). O Node.js
de produção consegue rodar isso (Node 22+ tem suporte nativo a
`require(esm)`), mas o Jest deste projeto (via `ts-jest`, sem pipeline
Babel) não consegue carregar um pacote ESM-only vindo de dentro de
`node_modules` — todo teste que importasse `sanitize-html` (direta ou
indiretamente, como `contracts.service.spec.ts` e
`contract-templates.service.spec.ts`) quebrava com `SyntaxError: Cannot use
import statement outside a module`. Em vez de montar uma configuração de
transform Babel só para acomodar pacotes de terceiros ESM (frágil e fora do
espírito deste projeto — o mesmo raciocínio que já levou a preferir
`pdfkit` a um browser headless), a solução foi fixar as duas dependências
na última combinação de versões 100% CommonJS. `htmlparser2@^8.0.2` cobre
exatamente o que `contract-body-renderer.ts` precisa (`parseDocument`).

## Frontend

- `ContractRichTextEditor` (`components/crm/contract-rich-text-editor.tsx`):
  editor leve baseado em `contentEditable` + `document.execCommand` (negrito,
  itálico, sublinhado, título, lista, lista numerada, link) — sem biblioteca
  nova, conforme decisão do usuário. Em modo `readOnly` (contrato fora de
  'rascunho') renderiza o HTML salvo via `dangerouslySetInnerHTML` sem
  toolbar; o HTML já chega saneado do backend, então não há filtragem
  adicional no cliente.
- `NewContractForm`: ganhou seleção opcional de modelo (só modelos ativos) —
  com modelo selecionado, o corpo é preenchido pelo backend na criação; sem
  modelo, mostra o editor rich text para digitar direto.
- `EditContractForm` (novo): título/valor/vigência/renovação editáveis
  sempre; corpo do contrato editável só quando `status === 'rascunho'`
  (mostra aviso e o editor em modo somente-leitura fora disso); "Aplicar
  modelo" disponível em rascunho, chamando `PATCH /:id/apply-template` e
  atualizando o editor com o resultado sem precisar recarregar a página.
- `ActivateContractButton` (novo): `PATCH /:id/activate`, mostrado só em
  contratos 'rascunho'.
- `contratos/modelos` (nova página): biblioteca de modelos, mirror exato de
  `propostas/modelos` — criar/editar restrito a admin/gestor, leitura aberta
  a todos.
- `contratos/page.tsx`: link "Baixar PDF" por contrato, badge de status com
  rótulo em português (incluindo 'rascunho'/'encerrado', que antes não
  tinham tom definido), botão "Ativar" quando rascunho, drawer de edição.
- Cliente 360° (`clientes/[id]`): a lista de contratos ganhou o badge de
  status e o botão "Ativar"; edição de corpo/geração de PDF fica na tela
  `/dashboard/contratos` (link "Ver / editar corpo") para não sobrecarregar
  a visão compacta do cliente.

## Simplificações assumidas (revisar quando fizer sentido)

- Sem reversão de 'ativo' para 'rascunho' — uma vez ativado, o corpo fica
  travado permanentemente nesta fase (mesma limitação que Pedidos têm com
  itens travados após faturar).
- O editor rich text usa `document.execCommand`, uma API formalmente
  descontinuada (mas ainda funcional em todos os browsers relevantes para os
  comandos simples usados aqui). Se algum dia for preciso um editor mais
  robusto (colar de Word preservando formatação complexa, tabelas, etc.),
  trocar por uma lib como TipTap é o caminho — decisão explícita do usuário
  de não fazer isso agora.
- Formatação inline no PDF é "melhor esforço" (ver seção do renderizador
  acima) — não pixel-perfect para todo HTML imaginável, fiel para o que o
  editor do frontend realmente produz.
- Sem histórico de versões do corpo do contrato (diferente de Quote, que
  versiona cada revisão como uma linha nova) — o corpo é editado in-place
  enquanto em rascunho, sem guardar rascunhos anteriores.

## Verificação feita

Backend: `tsc --noEmit` (0 erros), `eslint` (0 erros), `jest` (223 passed /
3 skipped, acima dos 211 da Fase 8 — 12 testes novos em
`ContractsService` + 4 em `ContractTemplatesService` + 1 em `PortalService`,
cobrindo criação com modelo, trava de corpo fora de rascunho, sanitização de
HTML malicioso, `activate()`, `applyTemplate()`, e a exclusão de rascunhos
do portal do cliente). PDF gerado manualmente via script (título, status,
vigência, valor, cliente, corpo com h1/parágrafo/negrito/itálico/link/lista
com marcador/lista numerada) e verificado como PDF válido de 1 página.
Frontend: `eslint` (0 erros), `tsc --noEmit` (0 erros), `next build` (compila
todas as rotas, incluindo a nova `/dashboard/contratos/modelos`).
