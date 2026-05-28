import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import Login from './pages/Login'
import Obras from './pages/Obras'
import Compras from './pages/Compras'
import Cronograma from './pages/Cronograma'
import Financeiro from './pages/Financeiro'
import Configuracoes from './pages/Configuracoes'
import { usePermissoes } from './lib/usePermissoes'
import FeedbackButton from './components/FeedbackButton'
import Sidebar from './components/Sidebar'

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [module,  setModule]  = useState('compras')
  const permissoes = usePermissoes(session)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session); setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => setSession(session))
    return () => subscription.unsubscribe()
  }, [])

  if (loading || (session && permissoes.loading)) return (
    <div style={{ minHeight: '100vh', background: '#0F1117', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#334155', fontSize: 14 }}>Carregando...</div>
    </div>
  )

  if (!session) return <Login />

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0F1117', fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @media (max-width: 768px) {
          .sa-main-content { padding-top: 56px !important; }
        }
      `}</style>
      <Sidebar active={module} onChange={setModule} userEmail={session.user.email} session={session} />
      <div className="sa-main-content" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {module === 'obras'         && <Obras         session={session} permissoes={permissoes} />}
      {module === 'compras'       && <Compras       session={session} permissoes={permissoes} />}
      {module === 'cronograma'    && <Cronograma    session={session} permissoes={permissoes} />}
      {module === 'financeiro'    && <Financeiro    session={session} permissoes={permissoes} />}
      {module === 'configuracoes' && <Configuracoes session={session} />}
      <FeedbackButton session={session} />
    </div>
  )
}
