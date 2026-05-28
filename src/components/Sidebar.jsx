import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const ALL_MODULES = [
  { id: 'obras',         icon: '🏗️',  label: 'Obras',         modulo: 'obras'      },
  { id: 'compras',       icon: '🛒',  label: 'Compras',       modulo: 'compras'    },
  { id: 'cronograma',    icon: '📅',  label: 'Cronograma',    modulo: 'cronograma' },
  { id: 'financeiro',    icon: '💰',  label: 'Financeiro',    modulo: 'financeiro' },
  { id: 'rdo',           icon: '📋',  label: 'RDO',           modulo: 'rdo',       soon: true },
  { id: 'configuracoes', icon: '⚙️',  label: 'Configurações', adminOnly: true },
]

export default function Sidebar({ active, onChange, userEmail, session }) {
  const [visibleModules, setVisibleModules] = useState(ALL_MODULES.filter(m => !m.soon && !m.adminOnly))
  const userName = session?.user?.user_metadata?.nome ?? userEmail

  useEffect(() => {
    if (!session?.user) return
    loadPerms()
  }, [session?.user?.id])

  async function loadPerms() {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('user_id', session.user.id)
      .maybeSingle()

    // Sem perfil = sem acesso
    if (!profile) {
      setVisibleModules(null) // null = sem acesso
      return
    }
    // Admin: mostra tudo exceto "em breve"
    if (profile.role === 'admin') {
      setVisibleModules(ALL_MODULES.filter(m => !m.soon))
      return
    }

    // Busca permissões do usuário
    const { data: perms } = await supabase
      .from('user_permissoes')
      .select('modulo, pode_ver')
      .eq('user_id', session.user.id)
      .eq('pode_ver', true)

    const modulosPermitidos = new Set((perms ?? []).map(p => p.modulo))
    setVisibleModules(ALL_MODULES.filter(m => {
      if (m.adminOnly || m.soon) return false
      return modulosPermitidos.has(m.modulo)
    }))
  }

  return (
    <div style={{
      width: 220, flexShrink: 0, background: '#0D1020',
      borderRight: '1px solid #1E2235',
      display: 'flex', flexDirection: 'column',
      height: '100vh', position: 'sticky', top: 0,
    }}>
      {/* Logo */}
      <div style={{ padding: '20px 16px 16px', borderBottom: '1px solid #1E2235' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 8, flexShrink: 0,
            background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18,
          }}>⚙️</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#F1F5F9' }}>SA Pride</div>
            <div style={{ fontSize: 10, color: '#334155' }}>Gestão de Obras</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {visibleModules.map(m => {
          const isActive = active === m.id
          return (
            <button
              key={m.id}
              onClick={() => onChange(m.id)}
              style={{
                width: '100%', padding: '9px 12px',
                borderRadius: 8, border: 'none', textAlign: 'left',
                display: 'flex', alignItems: 'center', gap: 10,
                background: isActive ? '#1E3A5F' : 'transparent',
                cursor: 'pointer', transition: 'background 0.15s',
              }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = '#1A1D2E' }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
            >
              <span style={{ fontSize: 15 }}>{m.icon}</span>
              <span style={{ fontSize: 13, fontWeight: isActive ? 600 : 400, color: isActive ? '#93C5FD' : '#64748B' }}>
                {m.label}
              </span>
            </button>
          )
        })}
        )}
      </nav>

      {/* User */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid #1E2235' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#94A3B8', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {userName}
        </div>
        <div style={{ fontSize: 10, color: '#334155', marginBottom: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {userEmail}
        </div>
        <button
          onClick={() => supabase.auth.signOut()}
          style={{
            width: '100%', padding: '7px', borderRadius: 7,
            border: '1px solid #1E2235', background: 'transparent',
            color: '#475569', fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}
        >Sair</button>
      </div>
    </div>
  )
}
