-- Histórico de alterações nas SCs
CREATE TABLE IF NOT EXISTS sc_historico (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  solicitacao_id   UUID REFERENCES solicitacoes_compra(id) ON DELETE CASCADE,
  usuario_id       UUID REFERENCES auth.users(id),
  usuario_nome     TEXT,
  acao             TEXT NOT NULL, -- 'criada', 'editada', 'aprovada', 'rejeitada', 'pedido_realizado', 'recebida'
  descricao        TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE sc_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "historico_by_obra" ON sc_historico FOR ALL
USING (
  solicitacao_id IN (
    SELECT sc.id FROM solicitacoes_compra sc
    JOIN obras o ON o.id = sc.obra_id
    WHERE o.owner_id = auth.uid()
  )
);
