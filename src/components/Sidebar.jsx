import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const ALL_MODULES = [
  { id: 'obras',         icon: '🏗️',  label: 'Obras',         modulo: 'obras'      },
  { id: 'compras',       icon: '🛒',  label: 'Compras',       modulo: 'compras'    },
  { id: 'cronograma',    icon: '📅',  label: 'Cronograma',    modulo: 'cronograma' },
  { id: 'financeiro',    icon: '💰',  label: 'Financeiro',    modulo: 'financeiro' },
  { id: 'rdo',           icon: '📋',  label: 'RDO',           modulo: 'rdo',       soon: true },
  { id: 'fornecedores',   icon: '🏢',  label: 'Fornecedores',  modulo: 'fornecedores' },
  { id: 'configuracoes', icon: '⚙️',  label: 'Configurações', adminOnly: true },
]

export default function Sidebar({ active, onChange, userEmail, session }) {
  const [visibleModules, setVisibleModules] = useState(ALL_MODULES.filter(m => !m.soon && !m.adminOnly))
  const [mobileOpen, setMobileOpen] = useState(false)
  const userName = session?.user?.user_metadata?.nome ?? userEmail

  useEffect(() => {
    if (!session?.user) return
    loadPerms()
  }, [session?.user?.id])

  // Close mobile menu on module change
  useEffect(() => { setMobileOpen(false) }, [active])

  async function loadPerms() {
    const { data: profile } = await supabase
      .from('user_profiles').select('role')
      .eq('user_id', session.user.id).maybeSingle()

    if (!profile) { setVisibleModules(null); return }
    if (profile.role === 'admin') {
      setVisibleModules(ALL_MODULES.filter(m => !m.soon))
      return
    }
    const { data: perms } = await supabase
      .from('user_permissoes').select('modulo, pode_ver')
      .eq('user_id', session.user.id).eq('pode_ver', true)
    const allowed = new Set((perms ?? []).map(p => p.modulo))
    setVisibleModules(ALL_MODULES.filter(m => !m.adminOnly && !m.soon && allowed.has(m.modulo)))
  }

  const sidebarContent = (
    <>
      {/* Logo */}
      <div style={{ padding: '20px 16px 16px', borderBottom: '1px solid #1E2235', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 8, flexShrink: 0,
            background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
          }}>⚙️</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#F1F5F9' }}>SA Pride</div>
            <div style={{ fontSize: 10, color: '#334155' }}>Gestão de Obras</div>
          </div>
        </div>
        {/* Close button (mobile only) */}
        <button onClick={() => setMobileOpen(false)} style={{
          display: 'none', background: 'none', border: 'none',
          color: '#475569', fontSize: 20, cursor: 'pointer',
          className: 'mobile-close-btn',
        }} className="mobile-close-btn">×</button>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto' }}>
        {visibleModules === null ? (
          <div style={{ margin: '16px 8px', padding: '16px', borderRadius: 10, background: '#1A1D2E', border: '1px solid #1E2235', textAlign: 'center' }}>
            <div style={{ fontSize: 24, marginBottom: 10 }}>🔒</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#94A3B8', marginBottom: 8 }}>Acesso pendente</div>
            <div style={{ fontSize: 11, color: '#475569', lineHeight: 1.5 }}>Entre em contato com o administrador para liberar seu acesso.</div>
          </div>
        ) : visibleModules.map(m => {
          const isActive = active === m.id
          return (
            <button key={m.id} onClick={() => onChange(m.id)} style={{
              width: '100%', padding: '10px 12px', borderRadius: 8, border: 'none',
              textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10,
              background: isActive ? '#1E3A5F' : 'transparent',
              cursor: 'pointer', transition: 'background 0.15s',
            }}
            onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = '#1A1D2E' }}
            onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
            >
              <span style={{ fontSize: 16 }}>{m.icon}</span>
              <span style={{ fontSize: 13, fontWeight: isActive ? 600 : 400, color: isActive ? '#93C5FD' : '#64748B' }}>
                {m.label}
              </span>
            </button>
          )
        })}
      </nav>

      {/* User */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid #1E2235' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#94A3B8', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userName}</div>
        <div style={{ fontSize: 10, color: '#334155', marginBottom: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userEmail}</div>
        <button onClick={() => supabase.auth.signOut()} style={{
          width: '100%', padding: '7px', borderRadius: 7,
          border: '1px solid #1E2235', background: 'transparent',
          color: '#475569', fontSize: 12, fontWeight: 600, cursor: 'pointer',
        }}>Sair</button>
      </div>
    </>
  )

  return (
    <>
      <style>{`
        @media (max-width: 768px) {
          .sa-sidebar-desktop { display: none !important; }
          .sa-topbar { display: flex !important; }
          .sa-sidebar-drawer {
            position: fixed !important;
            top: 0; left: 0; bottom: 0;
            width: 280px !important;
            z-index: 1000;
            transform: translateX(-100%);
            transition: transform 0.25s ease;
          }
          .sa-sidebar-drawer.open {
            transform: translateX(0) !important;
          }
          .sa-overlay {
            display: block !important;
          }
          .mobile-close-btn {
            display: flex !important;
          }
        }
        @media (min-width: 769px) {
          .sa-topbar { display: none !important; }
          .sa-sidebar-drawer { display: none !important; }
          .sa-overlay { display: none !important; }
        }
      `}</style>

      {/* Desktop sidebar */}
      <div className="sa-sidebar-desktop" style={{
        width: 220, flexShrink: 0, background: '#0D1020',
        borderRight: '1px solid #1E2235',
        display: 'flex', flexDirection: 'column',
        height: '100vh', position: 'sticky', top: 0,
      }}>
        {sidebarContent}
      </div>

      {/* Mobile top bar */}
      <div className="sa-topbar" style={{
        display: 'none',
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 500,
        background: '#0D1020', borderBottom: '1px solid #1E2235',
        padding: '10px 16px', alignItems: 'center', justifyContent: 'space-between',
        height: 56,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 7,
            background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15,
          }}>⚙️</div>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#F1F5F9' }}>SA Pride</span>
        </div>
        <button onClick={() => setMobileOpen(true)} style={{
          background: 'none', border: 'none', color: '#94A3B8',
          fontSize: 22, cursor: 'pointer', padding: '4px 8px',
          display: 'flex', alignItems: 'center',
        }}>☰</button>
      </div>

      {/* Mobile overlay */}
      <div
        className="sa-overlay"
        onClick={() => setMobileOpen(false)}
        style={{
          display: 'none', position: 'fixed', inset: 0,
          background: '#00000070', zIndex: 999,
          opacity: mobileOpen ? 1 : 0,
          pointerEvents: mobileOpen ? 'auto' : 'none',
          transition: 'opacity 0.25s',
        }}
      />

      {/* Mobile drawer */}
      <div className={`sa-sidebar-drawer${mobileOpen ? ' open' : ''}`} style={{
        background: '#0D1020', borderRight: '1px solid #1E2235',
        display: 'flex', flexDirection: 'column',
        height: '100vh',
      }}>
        {sidebarContent}
      </div>
    </>
  )
}
