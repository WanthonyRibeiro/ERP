    import { useState } from 'react'
import { supabase } from '../lib/supabase'

const S = {
  wrap: {
    minHeight: '100vh', background: '#0F1117',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  card: {
    background: '#1A1D2E', border: '1px solid #1E2235',
    borderRadius: 16, padding: '40px 36px', width: 380,
  },
  logo: {
    width: 44, height: 44, borderRadius: 10,
    background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 20,
  },
  title: { fontSize: 22, fontWeight: 700, color: '#F1F5F9', marginBottom: 4 },
  sub:   { fontSize: 13, color: '#475569', marginBottom: 28 },
  label: { fontSize: 12, fontWeight: 600, color: '#64748B', marginBottom: 6, display: 'block' },
  input: {
    width: '100%', padding: '10px 14px', borderRadius: 8,
    background: '#0F1117', border: '1px solid #1E2235',
    color: '#F1F5F9', fontSize: 14, marginBottom: 16, outline: 'none',
  },
  btn: {
    width: '100%', padding: '11px', borderRadius: 8, border: 'none',
    background: 'linear-gradient(135deg, #3B82F6, #6366F1)',
    color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer',
    marginTop: 4,
  },
  toggle: {
    textAlign: 'center', marginTop: 18, fontSize: 13, color: '#475569',
  },
  toggleBtn: {
    background: 'none', border: 'none', color: '#3B82F6',
    cursor: 'pointer', fontWeight: 600, fontSize: 13,
  },
  error: {
    background: '#450A0A', border: '1px solid #991B1B',
    color: '#FCA5A5', borderRadius: 8, padding: '10px 14px',
    fontSize: 13, marginBottom: 16,
  },
}

export default function Login() {
  const [mode, setMode]       = useState('login') // 'login' | 'signup'
  const [email, setEmail]     = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]     = useState(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error } = mode === 'login'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password })

    if (error) setError(error.message)
    setLoading(false)
  }

  return (
    <div style={S.wrap}>
      <div style={S.card}>
        <div style={S.logo}>G</div>
        <div style={S.title}>SA Pride</div>
        <div style={S.sub}>
          {mode === 'login' ? 'Entre na sua conta' : 'Crie sua conta'}
        </div>

        {error && <div style={S.error}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <label style={S.label}>E-mail</label>
          <input
            style={S.input} type="email" required
            value={email} onChange={e => setEmail(e.target.value)}
            placeholder="voce@email.com"
          />
          <label style={S.label}>Senha</label>
          <input
            style={S.input} type="password" required
            value={password} onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
          />
          <button style={S.btn} type="submit" disabled={loading}>
            {loading ? 'Aguarde...' : mode === 'login' ? 'Entrar' : 'Criar conta'}
          </button>
        </form>

        <div style={S.toggle}>
          {mode === 'login' ? 'Não tem conta? ' : 'Já tem conta? '}
          <button style={S.toggleBtn} onClick={() => { setMode(m => m === 'login' ? 'signup' : 'login'); setError(null) }}>
            {mode === 'login' ? 'Cadastre-se' : 'Entrar'}
          </button>
        </div>
      </div>
    </div>
  )
}

    
