import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const MENU = [
  {
    id: 'dashboard',
    icon: '📊',
    label: 'Dashboard',
    modulo: 'dashboard',
  },
  {
    id: 'obras',
    icon: '🏗️',
    label: 'Obras',
    modulo: 'obras',
  },
  {
    id: 'engenharia',
    icon: '📐',
    label: 'Engenharia',
    children: [
      { id: 'cronograma', icon: '📅', label: 'Cronograma', modulo: 'cronograma' },
      { id: 'medicoes',   icon: '📏', label: 'Medições',   modulo: 'medicoes'   },
      { id: 'contratos',  icon: '📃', label: 'Contratos',  modulo: 'contratos' },
      { id: 'rdo',        icon: '📋', label: 'RDO',        modulo: 'rdo',       soon: true },
    ],
  },
  {
    id: 'suprimentos',
    icon: '🛒',
    label: 'Suprimentos',
    children: [
      { id: 'compras',        icon: '🛒', label: 'Compras (SC)',      modulo: 'compras'        },
      { id: 'relatorio_compras', icon: '📋', label: 'Relatório Compras', modulo: 'relatorio_compras' },
      { id: 'cotacoes',       icon: '📊', label: 'Cotações',          modulo: 'cotacoes'       },
      { id: 'insumos',        icon: '📦', label: 'Insumos',           modulo: 'insumos'        },
      { id: 'fornecedores',   icon: '🏢', label: 'Fornecedores',      modulo: 'fornecedores'   },
      { id: 'estoque',        icon: '🗃️', label: 'Estoque',           modulo: 'estoque', soon: true },
    ],
  },
  {
    id: 'financeiro',
    icon: '💰',
    label: 'Financeiro',
    children: [
      { id: 'financeiro',  icon: '💰', label: 'Orçamento & Medições', modulo: 'financeiro'  },
      { id: 'boletos',     icon: '📄', label: 'Boletos',              modulo: 'boletos'     },
      { id: 'relatorios',  icon: '📊', label: 'Relatórios',           modulo: 'relatorios', soon: true },
    ],
  },
  {
    id: 'configuracoes',
    icon: '⚙️',
    label: 'Configurações',
    modulo: 'configuracoes',
  },
]

// Módulos permitidos por permissão
const ALL_MODULOS = MENU.flatMap(m => m.children ? m.children.map(c => c.modulo) : [m.modulo]).filter(Boolean)

export default function Sidebar({ active, onChange, userEmail, session }) {
  const [perms,      setPerms]      = useState(null) // null = carregando
  const [isAdmin,    setIsAdmin]    = useState(false)
  const [openGroups, setOpenGroups] = useState({ engenharia: true, suprimentos: true, financeiro: true })
  const [mobileOpen, setMobileOpen] = useState(false)
  const userName = session?.user?.user_metadata?.nome ?? userEmail

  useEffect(() => { if (session?.user) loadPerms() }, [session?.user?.id])
  useEffect(() => { setMobileOpen(false) }, [active])

  async function loadPerms() {
    const { data: profile } = await supabase
      .from('user_profiles').select('role')
      .eq('user_id', session.user.id).maybeSingle()

    if (!profile) { setPerms(new Set(['configuracoes'])); return }
    if (profile.role === 'admin') {
      setIsAdmin(true)
      setPerms(new Set([...ALL_MODULOS, 'configuracoes']))
      return
    }
    const { data: p } = await supabase
      .from('user_permissoes').select('modulo')
      .eq('user_id', session.user.id).eq('pode_ver', true)
    // sempre inclui configuracoes para todos os usuários autenticados
    setPerms(new Set([...(p ?? []).map(x => x.modulo), 'configuracoes']))
  }

  function canSee(item) {
    if (item.id === 'configuracoes') return true
    if (item.id === 'dashboard') return true  // sempre visível
    if (item.adminOnly) return isAdmin
    if (item.soon) return false
    if (!perms) return false
    if (item.children) return item.children.some(c => !c.soon && perms.has(c.modulo))
    return perms.has(item.modulo)
  }

  function toggleGroup(id) {
    setOpenGroups(g => ({ ...g, [id]: !g[id] }))
  }

  // Auto-open group that contains active module
  useEffect(() => {
    MENU.forEach(m => {
      if (m.children?.some(c => c.id === active)) {
        setOpenGroups(g => ({ ...g, [m.id]: true }))
      }
    })
  }, [active])

  const sidebarContent = (
    <>
      {/* Logo */}
      <div style={{ padding: '20px 16px 16px', borderBottom: '1px solid #1E2235', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 8, flexShrink: 0, background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>⚙️</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#F1F5F9' }}>SA Pride</div>
            <div style={{ fontSize: 10, color: '#334155' }}>Gestão de Obras</div>
          </div>
        </div>
        <button onClick={() => setMobileOpen(false)} className="mobile-close-btn" style={{ display: 'none', background: 'none', border: 'none', color: '#475569', fontSize: 20, cursor: 'pointer' }}>×</button>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto' }}>
        {perms === null ? (
          <div style={{ padding: '16px 8px', color: '#334155', fontSize: 12, textAlign: 'center' }}>Carregando...</div>
        ) : perms.size === 0 && !isAdmin ? (
          <div style={{ margin: '16px 8px', padding: '16px', borderRadius: 10, background: '#1A1D2E', border: '1px solid #1E2235', textAlign: 'center' }}>
            <div style={{ fontSize: 24, marginBottom: 10 }}>🔒</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#94A3B8', marginBottom: 8 }}>Acesso pendente</div>
            <div style={{ fontSize: 11, color: '#475569', lineHeight: 1.5 }}>Entre em contato com o administrador para liberar seu acesso.</div>
          </div>
        ) : MENU.filter(canSee).map(item => {
          // Item simples (sem filhos)
          if (!item.children) {
            const isActive = active === item.id
            return (
              <button key={item.id} onClick={() => onChange(item.id)} style={{
                width: '100%', padding: '10px 12px', borderRadius: 8, border: 'none',
                textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10,
                background: isActive ? '#1E3A5F' : 'transparent',
                cursor: 'pointer', transition: 'background 0.15s',
              }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = '#1A1D2E' }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
              >
                <span style={{ fontSize: 16 }}>{item.icon}</span>
                <span style={{ fontSize: 13, fontWeight: isActive ? 600 : 400, color: isActive ? '#93C5FD' : '#64748B' }}>{item.label}</span>
              </button>
            )
          }

          // Grupo com filhos
          const isOpen = openGroups[item.id]
          const hasActive = item.children.some(c => c.id === active)
          return (
            <div key={item.id}>
              {/* Group header */}
              <button onClick={() => toggleGroup(item.id)} style={{
                width: '100%', padding: '8px 12px', borderRadius: 8, border: 'none',
                textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10,
                background: hasActive && !isOpen ? '#1A1D2E' : 'transparent',
                cursor: 'pointer', transition: 'background 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#1A1D2E'}
              onMouseLeave={e => e.currentTarget.style.background = hasActive && !isOpen ? '#1A1D2E' : 'transparent'}
              >
                <span style={{ fontSize: 15 }}>{item.icon}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: hasActive ? '#94A3B8' : '#475569', flex: 1, textTransform: 'uppercase', letterSpacing: 0.5 }}>{item.label}</span>
                <span style={{ fontSize: 10, color: '#334155', transition: 'transform 0.2s', transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>›</span>
              </button>

              {/* Children */}
              {isOpen && (
                <div style={{ marginLeft: 8, marginBottom: 4 }}>
                  {item.children.filter(c => !c.soon || isAdmin).map(child => {
                    const isActive = active === child.id
                    return (
                      <button key={child.id} onClick={() => !child.soon && onChange(child.id)} style={{
                        width: '100%', padding: '8px 12px 8px 28px', borderRadius: 7, border: 'none',
                        textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8,
                        background: isActive ? '#1E3A5F' : 'transparent',
                        cursor: child.soon ? 'default' : 'pointer',
                        opacity: child.soon ? 0.45 : 1,
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={e => { if (!isActive && !child.soon) e.currentTarget.style.background = '#1A1D2E' }}
                      onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
                      >
                        <span style={{ fontSize: 13 }}>{child.icon}</span>
                        <span style={{ fontSize: 12, fontWeight: isActive ? 600 : 400, color: isActive ? '#93C5FD' : '#64748B', flex: 1 }}>{child.label}</span>
                        {child.soon && <span style={{ fontSize: 9, color: '#334155', background: '#1A1D2E', padding: '1px 5px', borderRadius: 4, fontWeight: 600 }}>SOON</span>}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      {/* User */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid #1E2235' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#94A3B8', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userName}</div>
        <div style={{ fontSize: 10, color: '#334155', marginBottom: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userEmail}</div>
        <button onClick={() => supabase.auth.signOut()} style={{ width: '100%', padding: '7px', borderRadius: 7, border: '1px solid #1E2235', background: 'transparent', color: '#475569', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Sair</button>
      </div>
    </>
  )

  return (
    <>
      <style>{`
        @media (max-width: 768px) {
          .sa-sidebar-desktop { display: none !important; }
          .sa-topbar { display: flex !important; }
          .sa-sidebar-drawer { position: fixed !important; top: 0; left: 0; bottom: 0; width: 260px !important; z-index: 1000; transform: translateX(-100%); transition: transform 0.25s ease; }
          .sa-sidebar-drawer.open { transform: translateX(0) !important; }
          .sa-overlay { display: block !important; }
          .mobile-close-btn { display: flex !important; }
        }
        @media (min-width: 769px) {
          .sa-topbar { display: none !important; }
          .sa-sidebar-drawer { display: none !important; }
          .sa-overlay { display: none !important; }
        }
      `}</style>

      {/* Desktop */}
      <div className="sa-sidebar-desktop" style={{ width: 220, flexShrink: 0, background: '#0D1020', borderRight: '1px solid #1E2235', display: 'flex', flexDirection: 'column', height: '100vh', position: 'sticky', top: 0 }}>
        {sidebarContent}
      </div>

      {/* Mobile topbar */}
      <div className="sa-topbar" style={{ display: 'none', position: 'fixed', top: 0, left: 0, right: 0, zIndex: 500, background: '#0D1020', borderBottom: '1px solid #1E2235', padding: '10px 16px', alignItems: 'center', justifyContent: 'space-between', height: 56 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 30, height: 30, borderRadius: 7, background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>⚙️</div>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#F1F5F9' }}>SA Pride</span>
        </div>
        <button onClick={() => setMobileOpen(true)} style={{ background: 'none', border: 'none', color: '#94A3B8', fontSize: 22, cursor: 'pointer', padding: '4px 8px', display: 'flex', alignItems: 'center' }}>☰</button>
      </div>

      {/* Mobile overlay */}
      <div className="sa-overlay" onClick={() => setMobileOpen(false)} style={{ display: 'none', position: 'fixed', inset: 0, background: '#00000070', zIndex: 999, opacity: mobileOpen ? 1 : 0, pointerEvents: mobileOpen ? 'auto' : 'none', transition: 'opacity 0.25s' }} />

      {/* Mobile drawer */}
      <div className={`sa-sidebar-drawer${mobileOpen ? ' open' : ''}`} style={{ background: '#0D1020', borderRight: '1px solid #1E2235', display: 'flex', flexDirection: 'column', height: '100vh' }}>
        {sidebarContent}
      </div>
    </>
  )
}
