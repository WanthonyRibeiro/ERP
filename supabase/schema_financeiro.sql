-- Execute no SQL Editor do Supabase (depois dos schemas anteriores)

-- Orçamento base da obra (serviços previstos)
CREATE TABLE IF NOT EXISTS orcamento_itens (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  obra_id     UUID REFERENCES obras(id) ON DELETE CASCADE,
  descricao   TEXT NOT NULL,
  categoria   TEXT NOT NULL DEFAULT 'Geral',
  unidade     TEXT DEFAULT 'un',
  quantidade  DECIMAL(10,2) DEFAULT 1,
  valor_unit  DECIMAL(12,2) DEFAULT 0,
  valor_total DECIMAL(12,2) GENERATED ALWAYS AS (quantidade * valor_unit) STORED,
  ordem       INT DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Medições mensais
CREATE TABLE IF NOT EXISTS medicoes (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  obra_id      UUID REFERENCES obras(id) ON DELETE CASCADE,
  numero       INT NOT NULL,
  mes_ref      DATE NOT NULL, -- primeiro dia do mês de referência
  status       TEXT NOT NULL DEFAULT 'rascunho'
                 CHECK (status IN ('rascunho','enviada','aprovada','rejeitada')),
  observacoes  TEXT,
  criado_por   UUID REFERENCES auth.users(id),
  aprovado_por UUID REFERENCES auth.users(id),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Itens de cada medição (vinculados ao orçamento)
CREATE TABLE IF NOT EXISTS medicao_itens (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  medicao_id       UUID REFERENCES medicoes(id) ON DELETE CASCADE,
  orcamento_item_id UUID REFERENCES orcamento_itens(id) ON DELETE SET NULL,
  descricao        TEXT NOT NULL,
  categoria        TEXT NOT NULL DEFAULT 'Geral',
  qtd_prevista     DECIMAL(10,2) DEFAULT 0,
  qtd_medida       DECIMAL(10,2) DEFAULT 0,
  valor_unit       DECIMAL(12,2) DEFAULT 0,
  valor_medido     DECIMAL(12,2) GENERATED ALWAYS AS (qtd_medida * valor_unit) STORED,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE orcamento_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE medicoes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE medicao_itens   ENABLE ROW LEVEL SECURITY;

CREATE POLICY "orcamento_by_obra" ON orcamento_itens FOR ALL
  USING (obra_id IN (SELECT id FROM obras WHERE owner_id = auth.uid()));

CREATE POLICY "medicoes_by_obra" ON medicoes FOR ALL
  USING (obra_id IN (SELECT id FROM obras WHERE owner_id = auth.uid()));

CREATE POLICY "medicao_itens_policy" ON medicao_itens FOR ALL
  USING (medicao_id IN (
    SELECT m.id FROM medicoes m
    JOIN obras o ON o.id = m.obra_id
    WHERE o.owner_id = auth.uid()
  ));

-- Trigger updated_at
CREATE TRIGGER medicoes_updated_at
  BEFORE UPDATE ON medicoes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
