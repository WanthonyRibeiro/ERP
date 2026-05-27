import { useState } from 'react'
import { supabase } from '../lib/supabase'

const inp = {
  width: '100%', padding: '10px 14px', borderRadius: 8,
  background: '#0F1117', border: '1px solid #1E2235',
  color: '#F1F5F9', fontSize: 14, marginBottom: 16, outline: 'none',
  fontFamily: 'inherit',
}

export default function Login() {
  const [mode, setMode]         = useState('login')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState(null)
  const [loading, setLoading]   = useState(false)

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
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0F1117 0%, #1A1D2E 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'DM Sans', sans-serif",
    }}>
      <div style={{
        background: '#1A1D2E', border: '1px solid #1E2235',
        borderRadius: 20, padding: '44px 40px',
        width: 400, maxWidth: '95vw',
        boxShadow: '0 24px 64px #00000060',
      }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 16, margin: '0 auto 16px',
            background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 30,
          }}>⚙️</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#F1F5F9', letterSpacing: '-0.5px' }}>
            SA Pride
          </div>
          <div style={{ fontSize: 13, color: '#475569', marginTop: 4 }}>
            Gestão de Obras
          </div>
        </div>

        {/* Subtitle */}
        <div style={{ fontSize: 13, color: '#64748B', marginBottom: 20, textAlign: 'center' }}>
          {mode === 'login' ? 'Entre na sua conta' : 'Crie sua conta'}
        </div>

        {error && (
          <div style={{
            background: '#450A0A', border: '1px solid #991B1B',
            color: '#FCA5A5', borderRadius: 8, padding: '10px 14px',
            fontSize: 13, marginBottom: 16, textAlign: 'center',
          }}>{error}</div>
        )}

        <form onSubmit={handleSubmit}>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#64748B', marginBottom: 6, display: 'block' }}>E-mail</label>
          <input style={inp} type="email" required value={email}
            onChange={e => setEmail(e.target.value)} placeholder="voce@email.com" />

          <label style={{ fontSize: 12, fontWeight: 600, color: '#64748B', marginBottom: 6, display: 'block' }}>Senha</label>
          <input style={inp} type="password" required value={password}
            onChange={e => setPassword(e.target.value)} placeholder="••••••••" />

          <button type="submit" disabled={loading} style={{
            width: '100%', padding: '12px', borderRadius: 10, border: 'none',
            background: 'linear-gradient(135deg, #3B82F6, #6366F1)',
            color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer',
            marginTop: 4, letterSpacing: '0.2px',
          }}>
            {loading ? 'Aguarde...' : mode === 'login' ? 'Entrar' : 'Criar conta'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: '#475569' }}>
          {mode === 'login' ? 'Não tem conta? ' : 'Já tem conta? '}
          <button onClick={() => { setMode(m => m === 'login' ? 'signup' : 'login'); setError(null) }} style={{
            background: 'none', border: 'none', color: '#3B82F6',
            cursor: 'pointer', fontWeight: 600, fontSize: 13,
          }}>
            {mode === 'login' ? 'Cadastre-se' : 'Entrar'}
          </button>
        </div>
      </div>
    </div>
  )
}
