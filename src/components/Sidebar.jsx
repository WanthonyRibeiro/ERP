import { supabase } from '../lib/supabase'

const MODULES = [
  { id: 'obras',      icon: '🏗️',  label: 'Obras'      },
  { id: 'compras',    icon: '🛒',  label: 'Compras'    },
  { id: 'cronograma', icon: '📅',  label: 'Cronograma' },
  { id: 'financeiro', icon: '💰',  label: 'Financeiro' },
  { id: 'rdo',        icon: '📋',  label: 'RDO',        soon: true },
  { id: 'configuracoes', icon: '⚙️',  label: 'Configurações' },
]

export default function Sidebar({ active, onChange, userEmail, session, permissoes }) {
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
            fontSize: 16, fontWeight: 800, color: '#fff',
          }}>⚙️</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#F1F5F9' }}>SA Pride</div>
            <div style={{ fontSize: 10, color: '#334155' }}>Gestão de Obras</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {ALL_MODULES.filter(m => {
          if (m.adminOnly) return permissoes?.isAdmin ?? true
          if (permissoes?.isAdmin) return true
          if (m.soon) return false
          return permissoes?.podeVerModulo(m.modulo) ?? true
        }).map(m => {
          const isActive = active === m.id
          return (
            <button
              key={m.id}
              onClick={() => !m.soon && onChange(m.id)}
              style={{
                width: '100%', padding: '9px 12px',
                borderRadius: 8, border: 'none', textAlign: 'left',
                display: 'flex', alignItems: 'center', gap: 10,
                background: isActive ? '#1E3A5F' : 'transparent',
                cursor: m.soon ? 'default' : 'pointer',
                opacity: m.soon ? 0.4 : 1,
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => { if (!m.soon && !isActive) e.currentTarget.style.background = '#1A1D2E' }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
            >
              <span style={{ fontSize: 15 }}>{m.icon}</span>
              <span style={{ fontSize: 13, fontWeight: isActive ? 600 : 400, color: isActive ? '#93C5FD' : '#64748B', flex: 1 }}>
                {m.label}
              </span>
              {m.soon && (
                <span style={{ fontSize: 9, fontWeight: 700, color: '#334155', background: '#1A1D2E', borderRadius: 4, padding: '2px 5px' }}>
                  EM BREVE
                </span>
              )}
            </button>
          )
        })}
      </nav>

      {/* User */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid #1E2235' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#94A3B8', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {session?.user?.user_metadata?.nome ?? userEmail}
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
        >
          Sair
        </button>
      </div>
    </div>
  )
}
