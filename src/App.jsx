    import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import Login from './pages/Login'
import Obras from './pages/Obras'
import Compras from './pages/Compras'
import Cronograma from './pages/Cronograma'
import Financeiro from './pages/Financeiro'
import Configuracoes from './pages/Configuracoes'
import Sidebar from './components/Sidebar'

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [module,  setModule]  = useState('financeiro')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session); setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => setSession(session))
    return () => subscription.unsubscribe()
  }, [])

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0F1117', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#334155', fontSize: 14 }}>Carregando...</div>
    </div>
  )

  if (!session) return <Login />

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0F1117', fontFamily: "'DM Sans', sans-serif" }}>
      <Sidebar active={module} onChange={setModule} userEmail={session.user.email} session={session} />
      {module === 'obras'      && <Obras      session={session} />}
      {module === 'compras'    && <Compras    session={session} />}
      {module === 'cronograma' && <Cronograma session={session} />}
      {module === 'financeiro'    && <Financeiro    session={session} />}
      {module === 'configuracoes' && <Configuracoes session={session} />}
    </div>
  )
}

    
