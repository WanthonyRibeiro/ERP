-- Execute no SQL Editor do Supabase (depois do schema.sql original)

-- Obras / Canteiros
CREATE TABLE IF NOT EXISTS obras (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  nome         TEXT NOT NULL,
  endereco     TEXT,
  status       TEXT NOT NULL DEFAULT 'em_andamento'
                 CHECK (status IN ('em_andamento','concluida','pausada')),
  data_inicio  DATE,
  data_prevista DATE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Solicitações de compra
CREATE TABLE IF NOT EXISTS solicitacoes_compra (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  obra_id           UUID REFERENCES obras(id) ON DELETE CASCADE,
  solicitante_id    UUID REFERENCES auth.users(id),
  solicitante_nome  TEXT,
  titulo            TEXT NOT NULL,
  urgencia          TEXT NOT NULL DEFAULT 'normal'
                      CHECK (urgencia IN ('normal','urgente','critico')),
  status            TEXT NOT NULL DEFAULT 'pendente'
                      CHECK (status IN ('pendente','aprovada','rejeitada','em_pedido','recebido')),
  motivo_rejeicao   TEXT,
  observacoes       TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Itens de cada solicitação
CREATE TABLE IF NOT EXISTS itens_solicitacao (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  solicitacao_id      UUID REFERENCES solicitacoes_compra(id) ON DELETE CASCADE,
  descricao           TEXT NOT NULL,
  unidade             TEXT DEFAULT 'un',
  quantidade          DECIMAL(10,2) DEFAULT 1,
  valor_unitario      DECIMAL(10,2),
  fornecedor_sugerido TEXT,
  ordem               INT DEFAULT 0,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security
ALTER TABLE obras               ENABLE ROW LEVEL SECURITY;
ALTER TABLE solicitacoes_compra ENABLE ROW LEVEL SECURITY;
ALTER TABLE itens_solicitacao   ENABLE ROW LEVEL SECURITY;

CREATE POLICY "obras_owner" ON obras FOR ALL
  USING (owner_id = auth.uid());

CREATE POLICY "solicitacoes_owner" ON solicitacoes_compra FOR ALL
  USING (obra_id IN (SELECT id FROM obras WHERE owner_id = auth.uid()));

CREATE POLICY "itens_owner" ON itens_solicitacao FOR ALL
  USING (solicitacao_id IN (
    SELECT sc.id FROM solicitacoes_compra sc
    JOIN obras o ON o.id = sc.obra_id
    WHERE o.owner_id = auth.uid()
  ));

-- Trigger updated_at para solicitacoes
CREATE TRIGGER solicitacoes_updated_at
  BEFORE UPDATE ON solicitacoes_compra
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
