CREATE TABLE IF NOT EXISTS obra_documentos (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  obra_id       UUID REFERENCES obras(id) ON DELETE CASCADE,
  tipo          TEXT NOT NULL,
  numero        TEXT,
  responsavel   TEXT,
  data_emissao  DATE,
  data_validade DATE,
  arquivo_url   TEXT,
  observacoes   TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE obra_documentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "docs_by_obra" ON obra_documentos FOR ALL
USING (
  obra_id IN (SELECT id FROM obras WHERE owner_id = auth.uid())
  OR
  obra_id IN (SELECT obra_id FROM user_permissoes WHERE user_id = auth.uid() AND pode_ver = true)
);

CREATE TRIGGER obra_documentos_updated_at
  BEFORE UPDATE ON obra_documentos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
