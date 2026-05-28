CREATE TABLE IF NOT EXISTS feedbacks (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES auth.users(id),
  user_nome   TEXT,
  mensagem    TEXT NOT NULL,
  pagina      TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE feedbacks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "usuarios_enviam_feedback" ON feedbacks FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "admin_ve_feedbacks" ON feedbacks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'admin'
    )
    OR user_id = auth.uid()
  );
