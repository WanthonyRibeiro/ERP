-- Perfis de usuário
CREATE TABLE IF NOT EXISTS user_profiles (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  admin_id   UUID REFERENCES auth.users(id), -- quem criou/gerencia
  role       TEXT NOT NULL DEFAULT 'usuario'
               CHECK (role IN ('admin','engenheiro','administrativo','mestre')),
  nome       TEXT,
  ativo      BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Permissões por obra e módulo
CREATE TABLE IF NOT EXISTS user_permissoes (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  obra_id    UUID REFERENCES obras(id) ON DELETE CASCADE,
  modulo     TEXT NOT NULL
               CHECK (modulo IN ('obras','compras','cronograma','financeiro','rdo')),
  pode_ver   BOOLEAN DEFAULT true,
  pode_editar BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, obra_id, modulo)
);

-- RLS
ALTER TABLE user_profiles   ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_permissoes ENABLE ROW LEVEL SECURITY;

-- Admin vê todos os perfis que criou
CREATE POLICY "admin_profiles" ON user_profiles FOR ALL
  USING (admin_id = auth.uid() OR user_id = auth.uid());

-- Admin gerencia permissões
CREATE POLICY "admin_permissoes" ON user_permissoes FOR ALL
  USING (
    user_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- Função para buscar usuário por email (necessário para adicionar usuários)
CREATE OR REPLACE FUNCTION get_user_by_email(email TEXT)
RETURNS TABLE(id UUID, email TEXT) 
SECURITY DEFINER
AS $$
  SELECT id, email::TEXT FROM auth.users WHERE auth.users.email = get_user_by_email.email LIMIT 1;
$$ LANGUAGE sql;
