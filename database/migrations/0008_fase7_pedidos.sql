-- =============================================================================
-- 0008_fase7_pedidos.sql
-- Fase 7 — Pedido: conversão explícita e gestão ampliada (RF012, spec v3.1
-- "Quote-to-Cash").
--
-- Antes desta fase, aprovar uma proposta criava o Pedido automaticamente,
-- sem revisão nem itens próprios (só herdava `totalValue`). A partir daqui:
--   1. Aprovar a proposta só marca ela como aprovada e fecha a oportunidade
--      como ganha — não cria mais o Pedido sozinho (QuotesService.approve).
--   2. Um novo passo explícito de conversão (QuotesService.convertToOrder)
--      cria o Pedido, com itens/valor/prazo de entrega/condição de
--      pagamento revisáveis antes de confirmar.
--   3. Pedido também passa a poder ser criado manualmente, sem proposta
--      associada (OrdersService.create) — por isso `quote_id` continua
--      opcional (já era, desde 0002_fase1_crm.sql).
-- =============================================================================

ALTER TABLE orders
  ADD COLUMN delivery_date  date,
  ADD COLUMN payment_terms  text,
  ADD COLUMN internal_notes text,
  -- Itens do pedido — copiados da proposta na conversão (editáveis depois,
  -- respeitando a mesma trava de "não altera valor com fatura já gerada"
  -- aplicada em OrdersService.update) ou informados diretamente num pedido
  -- manual. NULLABLE de propósito: pedidos criados antes desta coluna
  -- existir (conversão automática das Fases 1-6) não ganham itens
  -- retroativos fabricados.
  ADD COLUMN items jsonb;

-- Uma proposta só pode ser convertida em pedido uma vez — reforçado no
-- banco (não só na checagem de OrdersService/QuotesService.convertToOrder),
-- mesmo raciocínio do índice único parcial de "vencedora" em 0007.
CREATE UNIQUE INDEX idx_orders_quote_id_unique
  ON orders(quote_id) WHERE quote_id IS NOT NULL;

-- RLS de `orders` já existe desde 0002_fase1_crm.sql e cobre a linha
-- inteira — colunas novas incluídas, nenhuma policy nova necessária aqui.
