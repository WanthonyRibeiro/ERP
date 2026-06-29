import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import Login from './pages/Login'
import Obras from './pages/Obras'
import Compras from './pages/Compras'
import Cronograma from './pages/Cronograma'
import Financeiro from './pages/Financeiro'
import Configuracoes from './pages/Configuracoes'
import Fornecedores from './pages/Fornecedores'
import Cotacoes from './pages/Cotacoes'
import Insumos from './pages/Insumos'
import Dashboard from './pages/Dashboard'
import RelatorioCompras from './pages/RelatorioCompras'
import Feedbacks from './pages/Feedbacks'
import Estoque from './pages/Estoque'
import PedidosCompra from './pages/PedidosCompra'
import MapaControle from './pages/MapaControle'
import { usePermissoes } from './lib/usePermissoes'
import FeedbackButton from './components/FeedbackButton'
import Sidebar from './components/Sidebar'

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [module,  setModule]  = useState('dashboard')
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
        {module === 'dashboard'    && <Dashboard    session={session} permissoes={permissoes} onNavigate={setModule} />}
        {module === 'obras'         && <Obras         session={session} permissoes={permissoes} />}
        {module === 'cronograma'    && <Cronograma    session={session} permissoes={permissoes} />}
        {module === 'medicoes'      && <Financeiro    session={session} permissoes={permissoes} abaInicial="medicoes"  />}
        {module === 'contratos'     && <Financeiro    session={session} permissoes={permissoes} abaInicial="contratos" />}
        {module === 'compras'            && <Compras          session={session} permissoes={permissoes} />}
        {module === 'relatorio_compras'  && <RelatorioCompras  session={session} />}
        {module === 'mapa_controle'       && <MapaControle       session={session} />}
        {module === 'feedbacks'          && <Feedbacks         session={session} />}
        {module === 'estoque'            && <Estoque           session={session} permissoes={permissoes} />}
        {module === 'pedidos_compra'      && <PedidosCompra      session={session} />}
        {module === 'cotacoes'      && <Cotacoes      session={session} permissoes={permissoes} />}
        {module === 'insumos'       && <Insumos       session={session} />}
        {module === 'fornecedores'  && <Fornecedores  session={session} />}
        {module === 'financeiro'    && <Financeiro    session={session} permissoes={permissoes} />}
        {module === 'boletos'       && <Financeiro    session={session} permissoes={permissoes} abaInicial="boletos" />}
        {module === 'relatorios'    && <Financeiro    session={session} permissoes={permissoes} abaInicial="relatorios" />}
        {module === 'configuracoes' && <Configuracoes session={session} />}
        <FeedbackButton session={session} />
      </div>
    </div>
  )
}
