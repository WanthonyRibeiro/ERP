import React from 'react'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const ROLES = {
  admin:          { label: 'Admin',          color: '#3B82F6' },
  engenheiro:     { label: 'Engenheiro',     color: '#10B981' },
  administrativo: { label: 'Administrativo', color: '#F59E0B' },
  mestre:         { label: 'Mestre de Obra', color: '#8B5CF6' },
}

const MODULOS = [
  { id: 'obras',       label: '🏗️ Obras'       },
  { id: 'compras',     label: '🛒 Compras'     },
  { id: 'cronograma',  label: '📅 Cronograma'  },
  { id: 'financeiro',  label: '💰 Financeiro'  },
  { id: 'rdo',         label: '📋 RDO'         },
]

const inp = {
  width: '100%', padding: '8px 12px', borderRadius: 7,
  background: '#0F1117', border: '1px solid #1E2235',
  color: '#F1F5F9', fontSize: 13, outline: 'none', fontFamily: 'inherit',
}
const lbl = { fontSize: 11, fontWeight: 600, color: '#64748B', marginBottom: 5, display: 'block' }

export default function Configuracoes({ session }) {
  const [usuarios,   setUsuarios]   = useState([])
  const [obras,      setObras]      = useState([])
  const [selected,   setSelected]   = useState(null)
  const [permissoes, setPermissoes] = useState([])
  const [loading,    setLoading]    = useState(true)
  const [toast,      setToast]      = useState(null)
  const [novoEmail,  setNovoEmail]  = useState('')
  const [novoRole,   setNovoRole]   = useState('engenheiro')
  const [adding,     setAdding]     = useState(false)
  const [isAdmin,    setIsAdmin]    = useState(false)
  const [abaConfig,  setAbaConfig]  = useState('conta')

  // Minha conta
  const [nomeEdit,  setNomeEdit]  = useState(session?.user?.user_metadata?.nome ?? '')
  const [novaSenha, setNovaSenha] = useState('')
  const [confSenha, setConfSenha] = useState('')
  const [salvando,  setSalvando]  = useState(false)

  useEffect(() => { init() }, [])

  async function init() {
    try {
      const { data: profile } = await supabase
        .from('user_profiles').select('role')
        .eq('user_id', session.user.id).maybeSingle()

      const admin = !profile || profile.role === 'admin'
      setIsAdmin(admin)
      if (admin) setAbaConfig('usuarios')

      if (admin) {
        const { data: profs } = await supabase
          .from('user_profiles').select('id, user_id, admin_id, role, nome, ativo, created_at')
          .eq('admin_id', session.user.id)
        const { data: obrasData } = await supabase
          .from('obras').select('id, nome')
          .eq('owner_id', session.user.id).order('nome')
        setUsuarios(profs ?? [])
        setObras(obrasData ?? [])
      }
    } catch(err) {
      console.error('init error:', err)
    }
    setLoading(false)
  }

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(null), 3000) }

  async function salvarNome() {
    if (!nomeEdit.trim()) return
    setSalvando(true)
    const { error } = await supabase.auth.updateUser({ data: { nome: nomeEdit.trim() } })
    if (error) { showToast('Erro ao salvar nome.'); setSalvando(false); return }
    await supabase.from('user_profiles').update({ nome: nomeEdit.trim() }).eq('user_id', session.user.id)
    showToast('✅ Nome atualizado! Faça logout e login para ver.')
    setSalvando(false)
  }

  async function trocarSenha() {
    if (!novaSenha) return
    if (novaSenha !== confSenha) { showToast('⚠️ As senhas não coincidem.'); return }
    if (novaSenha.length < 6) { showToast('⚠️ Senha deve ter pelo menos 6 caracteres.'); return }
    setSalvando(true)
    const { error } = await supabase.auth.updateUser({ password: novaSenha })
    if (error) { showToast('Erro ao trocar senha: ' + error.message); setSalvando(false); return }
    setNovaSenha(''); setConfSenha('')
    showToast('✅ Senha alterada com sucesso!')
    setSalvando(false)
  }

  async function adicionarUsuario() {
    if (!novoEmail.trim()) return
    const { data: users } = await supabase.rpc('get_user_by_email', { email: novoEmail.trim() })
    const userId = users?.[0]?.id
    if (!userId) { showToast('Usuário não encontrado. Certifique-se que ele já criou uma conta.'); return }
    const { error } = await supabase.from('user_profiles').upsert({
      user_id: userId, admin_id: session.user.id, role: novoRole, nome: novoEmail.split('@')[0],
    })
    if (error) { showToast('Erro ao adicionar usuário.'); return }
    setNovoEmail(''); setAdding(false)
    await init()
    showToast('Usuário adicionado!')
  }

  async function selectUsuario(u) {
    setSelected(u)
    const { data } = await supabase.from('user_permissoes').select('*').eq('user_id', u.user_id)
    setPermissoes(data ?? [])
  }

  function getPerm(obraId, modulo) {
    return permissoes.find(p => p.obra_id === obraId && p.modulo === modulo)
  }

  async function togglePerm(obraId, modulo, tipo) {
    const existing = getPerm(obraId, modulo)
    if (existing) {
      const updated = { ...existing, [tipo]: !existing[tipo] }
      if (!updated.pode_ver && !updated.pode_editar) {
        await supabase.from('user_permissoes').delete().eq('id', existing.id)
        setPermissoes(ps => ps.filter(p => p.id !== existing.id))
      } else {
        await supabase.from('user_permissoes').update({ [tipo]: !existing[tipo] }).eq('id', existing.id)
        setPermissoes(ps => ps.map(p => p.id === existing.id ? { ...p, [tipo]: !existing[tipo] } : p))
      }
    } else {
      const payload = {
        user_id: selected.user_id, obra_id: obraId, modulo,
        pode_ver: tipo === 'pode_ver', pode_editar: tipo === 'pode_editar',
      }
      const { data } = await supabase.from('user_permissoes').upsert(payload, { onConflict: 'user_id,obra_id,modulo' }).select().single()
      if (data) setPermissoes(ps => [...ps, data])
    }
  }

  async function toggleRole(userId, role) {
    await supabase.from('user_profiles').update({ role }).eq('user_id', userId)
    setUsuarios(us => us.map(u => u.user_id === userId ? { ...u, role } : u))
    if (selected?.user_id === userId) setSelected(s => ({ ...s, role }))
  }

  async function removerUsuario(userId) {
    if (!confirm('Remover acesso deste usuário?')) return
    await supabase.from('user_permissoes').delete().eq('user_id', userId)
    await supabase.from('user_profiles').delete().eq('user_id', userId)
    setSelected(null)
    await init()
    showToast('Usuário removido.')
  }

  if (loading) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#334155' }}>
      Carregando...
    </div>
  )

  // ── Aba Minha Conta ──────────────────────────────────────────────────────
  const renderConta = (
    <div style={{ flex: 1, overflowY: 'auto', padding: '28px 24px', maxWidth: 480 }}>
      <div style={{ fontSize: 16, fontWeight: 700, color: '#F1F5F9', marginBottom: 4 }}>Minha Conta</div>
      <div style={{ fontSize: 12, color: '#475569', marginBottom: 24 }}>{session.user.email}</div>

      <div style={{ background: '#1A1D2E', border: '1px solid #1E2235', borderRadius: 12, padding: '20px', marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#F1F5F9', marginBottom: 16 }}>✏️ Nome de exibição</div>
        <label style={lbl}>Nome</label>
        <input style={{ ...inp, marginBottom: 16 }} value={nomeEdit} onChange={e => setNomeEdit(e.target.value)} placeholder="Seu nome completo" />
        <button onClick={salvarNome} disabled={salvando} style={{ padding: '8px 18px', borderRadius: 7, border: 'none', background: 'linear-gradient(135deg, #3B82F6, #6366F1)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
          {salvando ? 'Salvando...' : 'Salvar nome'}
        </button>
      </div>

      <div style={{ background: '#1A1D2E', border: '1px solid #1E2235', borderRadius: 12, padding: '20px' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#F1F5F9', marginBottom: 16 }}>🔒 Trocar senha</div>
        <label style={lbl}>Nova senha</label>
        <input style={{ ...inp, marginBottom: 12 }} type="password" value={novaSenha} onChange={e => setNovaSenha(e.target.value)} placeholder="Mínimo 6 caracteres" />
        <label style={lbl}>Confirmar nova senha</label>
        <input style={{ ...inp, marginBottom: 16 }} type="password" value={confSenha} onChange={e => setConfSenha(e.target.value)} placeholder="Repita a senha" />
        {novaSenha && confSenha && novaSenha !== confSenha && (
          <div style={{ fontSize: 12, color: '#EF4444', marginBottom: 10 }}>⚠️ As senhas não coincidem</div>
        )}
        <button onClick={trocarSenha} disabled={salvando || !novaSenha || novaSenha !== confSenha} style={{
          padding: '8px 18px', borderRadius: 7, border: 'none', fontWeight: 700, fontSize: 13, cursor: 'pointer',
          background: (novaSenha && novaSenha === confSenha) ? 'linear-gradient(135deg, #10B981, #059669)' : '#334155',
          color: '#fff',
        }}>
          {salvando ? 'Salvando...' : 'Trocar senha'}
        </button>
      </div>
    </div>
  )

  // ── Aba Usuários (admin only) ────────────────────────────────────────────
  const renderUsuarios = (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
      {/* Lista de usuários */}
      <div style={{ width: 280, flexShrink: 0, borderRight: '1px solid #1E2235', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px 20px 12px', borderBottom: '1px solid #1E2235' }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#F1F5F9', marginBottom: 4 }}>Usuários</div>
          <div style={{ fontSize: 12, color: '#475569' }}>Gerencie acessos e permissões</div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
          {/* Admin */}
          <div style={{ padding: '10px 12px', borderRadius: 8, marginBottom: 6, background: '#1E3A5F', border: '1px solid #1E3A5F' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#93C5FD' }}>
              {session.user.user_metadata?.nome ?? session.user.email}
            </div>
            <div style={{ fontSize: 11, color: '#3B82F6', marginTop: 2 }}>Admin • Você</div>
          </div>

          {usuarios.filter(u => u.user_id !== session.user.id).map(u => {
            const isSelected = selected?.user_id === u.user_id
            const role = ROLES[u.role] ?? ROLES.engenheiro
            return (
              <div key={u.user_id} onClick={() => selectUsuario(u)} style={{
                padding: '10px 12px', borderRadius: 8, marginBottom: 6,
                background: isSelected ? '#1A1D2E' : 'transparent',
                border: `1px solid ${isSelected ? '#334155' : 'transparent'}`,
                cursor: 'pointer', transition: 'all 0.15s',
              }}
              onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = '#1A1D2E' }}
              onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
              >
                <div style={{ fontSize: 13, fontWeight: 600, color: '#F1F5F9' }}>{u.nome}</div>
                <div style={{ fontSize: 11, color: role.color, marginTop: 2 }}>{role.label}</div>
              </div>
            )
          })}

          {adding ? (
            <div style={{ padding: '12px', background: '#1A1D2E', borderRadius: 8, border: '1px solid #1E2235' }}>
              <label style={lbl}>E-mail do usuário</label>
              <input style={{ ...inp, marginBottom: 8 }} value={novoEmail} onChange={e => setNovoEmail(e.target.value)} placeholder="email@exemplo.com" />
              <label style={lbl}>Perfil</label>
              <select style={{ ...inp, marginBottom: 10 }} value={novoRole} onChange={e => setNovoRole(e.target.value)}>
                {Object.entries(ROLES).filter(([k]) => k !== 'admin').map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={adicionarUsuario} style={{ flex: 1, padding: '7px', borderRadius: 6, border: 'none', background: '#3B82F6', color: '#fff', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>Adicionar</button>
                <button onClick={() => setAdding(false)} style={{ flex: 1, padding: '7px', borderRadius: 6, border: '1px solid #1E2235', background: 'transparent', color: '#64748B', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>Cancelar</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setAdding(true)} style={{
              width: '100%', padding: '8px', borderRadius: 8, border: '1px dashed #334155',
              background: 'transparent', color: '#475569', fontSize: 12, fontWeight: 600, cursor: 'pointer', marginTop: 4,
            }}>+ Adicionar usuário</button>
          )}
        </div>
      </div>

      {/* Painel de permissões */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
        {!selected ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#334155' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>👤</div>
            <p style={{ fontSize: 15, fontWeight: 600, color: '#475569' }}>Selecione um usuário</p>
            <p style={{ fontSize: 13, color: '#334155', marginTop: 4 }}>para gerenciar suas permissões</p>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#F1F5F9', marginBottom: 4 }}>{selected.nome}</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {Object.entries(ROLES).filter(([k]) => k !== 'admin').map(([k, v]) => (
                    <button key={k} onClick={() => toggleRole(selected.user_id, k)} style={{
                      padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                      border: `1.5px solid ${selected.role === k ? v.color : '#1E2235'}`,
                      background: selected.role === k ? v.color + '22' : 'transparent',
                      color: selected.role === k ? v.color : '#64748B',
                    }}>{v.label}</button>
                  ))}
                </div>
              </div>
              <button onClick={() => removerUsuario(selected.user_id)} style={{
                padding: '7px 14px', borderRadius: 7, border: '1px solid #7F1D1D',
                background: 'transparent', color: '#FCA5A5', fontWeight: 600, fontSize: 12, cursor: 'pointer',
              }}>Remover acesso</button>
            </div>

            <div style={{ fontSize: 13, fontWeight: 600, color: '#94A3B8', marginBottom: 12 }}>
              Permissões por obra e módulo
            </div>

            {obras.length === 0 ? (
              <p style={{ color: '#334155', fontSize: 13 }}>Nenhuma obra cadastrada.</p>
            ) : obras.map(obra => (
              <div key={obra.id} style={{ background: '#1A1D2E', border: '1px solid #1E2235', borderRadius: 12, padding: '16px', marginBottom: 12 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#F1F5F9', marginBottom: 12 }}>🏗️ {obra.nome}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px', gap: 8 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#334155', textTransform: 'uppercase' }}>Módulo</div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#334155', textTransform: 'uppercase', textAlign: 'center' }}>Ver</div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#334155', textTransform: 'uppercase', textAlign: 'center' }}>Editar</div>
                  {MODULOS.map(m => {
                    const perm = getPerm(obra.id, m.id)
                    return (
                      <React.Fragment key={m.id}>
                        <div style={{ fontSize: 13, color: '#94A3B8', display: 'flex', alignItems: 'center' }}>{m.label}</div>
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                          <button onClick={() => togglePerm(obra.id, m.id, 'pode_ver')} style={{
                            width: 28, height: 28, borderRadius: 6, border: 'none', cursor: 'pointer',
                            background: perm?.pode_ver ? '#1E3A5F' : '#0F1117',
                            color: perm?.pode_ver ? '#3B82F6' : '#334155',
                            fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>{perm?.pode_ver ? '✓' : '○'}</button>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                          <button onClick={() => togglePerm(obra.id, m.id, 'pode_editar')} style={{
                            width: 28, height: 28, borderRadius: 6, border: 'none', cursor: 'pointer',
                            background: perm?.pode_editar ? '#064E3B' : '#0F1117',
                            color: perm?.pode_editar ? '#10B981' : '#334155',
                            fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>{perm?.pode_editar ? '✓' : '○'}</button>
                        </div>
                      </React.Fragment>
                    )
                  })}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: "'DM Sans', sans-serif", color: '#E2E8F0' }}>

      {/* Tabs */}
      <div style={{ padding: '16px 24px 0', borderBottom: '1px solid #1E2235', display: 'flex', gap: 4, flexShrink: 0 }}>
        {[
          ...(isAdmin ? [{ id: 'usuarios', label: '👥 Usuários & Permissões' }] : []),
          { id: 'conta', label: '👤 Minha Conta' },
        ].map(a => (
          <button key={a.id} onClick={() => setAbaConfig(a.id)} style={{
            padding: '8px 16px', borderRadius: '7px 7px 0 0', border: 'none', cursor: 'pointer',
            background: abaConfig === a.id ? '#0F1117' : 'transparent',
            color: abaConfig === a.id ? '#F1F5F9' : '#475569',
            fontSize: 13, fontWeight: abaConfig === a.id ? 600 : 400,
            borderBottom: abaConfig === a.id ? '2px solid #3B82F6' : '2px solid transparent',
          }}>{a.label}</button>
        ))}
      </div>

      {abaConfig === 'conta'    && renderConta}
      {abaConfig === 'usuarios' && renderUsuarios}

      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24,
          background: '#064E3B', border: '1px solid #065F46',
          color: '#6EE7B7', padding: '10px 18px', borderRadius: 10,
          fontSize: 13, fontWeight: 600, zIndex: 2000,
        }}>{toast}</div>
      )}
    </div>
  )
}
