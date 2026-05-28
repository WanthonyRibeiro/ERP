import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import SolicitacaoModal from '../components/SolicitacaoModal'

const URGENCIA_META = {
  normal:  { label: 'Normal',  color: '#64748B', bg: '#1E2235' },
  urgente: { label: 'Urgente', color: '#F59E0B', bg: '#451A03' },
  critico: { label: 'Crítico', color: '#EF4444', bg: '#450A0A' },
}
const STATUS_META = {
  pendente:  { label: 'Pendente',         color: '#F59E0B', bg: '#451A03' },
  aprovada:  { label: 'Aprovada',         color: '#3B82F6', bg: '#1E3A5F' },
  rejeitada: { label: 'Rejeitada',        color: '#EF4444', bg: '#450A0A' },
  em_pedido: { label: 'Pedido Realizado', color: '#8B5CF6', bg: '#2E1065' },
  recebido:  { label: 'Recebido',         color: '#10B981', bg: '#064E3B' },
}

function fmtDate(d) {
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

function Badge({ meta }) {
  return (
    <span style={{
      padding: '3px 9px', borderRadius: 20,
      fontSize: 11, fontWeight: 700,
      background: meta.bg, color: meta.color,
    }}>{meta.label}</span>
  )
}

export default function Compras({ session, permissoes }) {
  const [solicitacoes, setSolicitacoes] = useState([])
  const [obras,        setObras]        = useState([])
  const [modal,        setModal]        = useState(null)
  const [loading,      setLoading]      = useState(true)
  const [toast,        setToast]        = useState(null)
  const [expanded,     setExpanded]     = useState(null) // id da SC expandida
  const [filter, setFilter] = useState({ obra: 'all', status: 'all', urgencia: 'all' })

  useEffect(() => { init() }, [])

  async function init() {
    const [{ data: obrasData }, { data: solData }] = await Promise.all([
      (() => {
        const isAdmin = permissoes?.isAdmin ?? true
        let q = supabase.from('obras').select('id, nome').order('nome')
        if (isAdmin) return q.eq('owner_id', session.user.id)
        const ids = permissoes?.obrasIds ?? []
        if (!ids.length) return q.eq('id', 'none')
        return q.in('id', ids)
      })(),
      fetchSolicitacoes(true),
    ])
    setObras(obrasData ?? [])
    setSolicitacoes(solData ?? [])
    setLoading(false)
  }

  async function fetchSolicitacoes(returnData = false) {
    const { data } = await supabase
      .from('solicitacoes_compra')
      .select(`*, obra:obras(nome), itens:itens_solicitacao(*)`)
      .order('created_at', { ascending: false })
    if (returnData) return { data }
    setSolicitacoes(data ?? [])
  }

  function showToast(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  async function registrarHistorico(solId, acao, userName, descricao = null) {
    try {
      await supabase.from('sc_historico').insert({
        solicitacao_id: solId,
        usuario_id:     session.user.id,
        usuario_nome:   userName,
        acao,
        descricao,
      })
    } catch(e) { console.error('historico error:', e) }
  }

  async function handleSave(form) {
    const payload = {
      obra_id:          form.obra_id,
      titulo:           form.titulo,
      urgencia:         form.urgencia,
      status:           form.status,
      solicitante_nome: form.solicitante_nome,
      solicitante_id:   session.user.id,
      observacoes:      form.observacoes,
      motivo_rejeicao:  form.motivo_rejeicao,
      prazo_entrega:    form.prazo_entrega || null,
    }

    const solId = form.id
    if (solId) {
      const { error } = await supabase.from('solicitacoes_compra').update(payload).eq('id', solId)
      if (error) { console.error('Erro update:', error); return }
    } else {
      const { data, error } = await supabase.from('solicitacoes_compra').insert(payload).select('id').single()
      if (error) { console.error('Erro insert:', error); return }
      const newId = data?.id
      var newSolId = newId
      if (newId && form.itens?.length) {
        await supabase.from('itens_solicitacao').insert(
          form.itens.filter(it => it.descricao?.trim()).map((it, idx) => ({
            solicitacao_id:      newId,
            descricao:           it.descricao,
            unidade:             it.unidade,
            quantidade:          parseFloat(it.quantidade) || 1,
            valor_unitario:      parseFloat(it.valor_unitario) || null,
            fornecedor_sugerido: it.fornecedor_sugerido || null,
            ordem:               idx,
          }))
        )
      }
    }

    // Registra histórico
    const acao = form._acao ?? (solId ? 'editada' : 'criada')
    const userName = form._userName ?? session.user.email
    if (acao === 'aprovada') await registrarHistorico(solId, 'aprovada', userName)
    else if (acao === 'rejeitada') await registrarHistorico(solId, 'rejeitada', userName, form.motivo_rejeicao)
    else if (acao === 'em_pedido') await registrarHistorico(solId, 'pedido_realizado', userName)
    else if (acao === 'recebido') await registrarHistorico(solId, 'recebida', userName)
    else if (!solId) await registrarHistorico(newSolId, 'criada', userName)
    else await registrarHistorico(solId, 'editada', userName)

    setModal(null)
    fetchSolicitacoes()
    showToast(solId ? 'Solicitação atualizada!' : 'Solicitação criada!')
  }

  async function handleDuplicate(sol) {
    const { itens, obra, id: oldId, status, created_at, updated_at, solicitante_id, ...payload } = sol
    payload.status = 'pendente'
    payload.motivo_rejeicao = null
    const { data } = await supabase.from('solicitacoes_compra').insert(payload).select('id').single()
    if (data?.id && itens?.length) {
      await supabase.from('itens_solicitacao').insert(
        itens.map((it, idx) => ({
          solicitacao_id: data.id, descricao: it.descricao, unidade: it.unidade,
          quantidade: it.quantidade, valor_unitario: it.valor_unitario,
          fornecedor_sugerido: it.fornecedor_sugerido, ordem: idx,
        }))
      )
      await registrarHistorico(data.id, 'duplicada', session?.user?.user_metadata?.nome ?? session.user.email)
    }
    setModal(null)
    fetchSolicitacoes()
    showToast('SC duplicada! Edite e reenvie.')
  }

  async function handleDelete(id) {
    await supabase.from('itens_solicitacao').delete().eq('solicitacao_id', id)
    await supabase.from('solicitacoes_compra').delete().eq('id', id)
    setModal(null)
    fetchSolicitacoes()
    showToast('Solicitação excluída.')
  }

  // Filtered
  const filtered = solicitacoes.filter(s => {
    if (filter.obra     !== 'all' && s.obra_id  !== filter.obra)     return false
    if (filter.status   !== 'all' && s.status   !== filter.status)   return false
    if (filter.urgencia !== 'all' && s.urgencia !== filter.urgencia) return false
    return true
  })

  const stats = {
    pendente:  solicitacoes.filter(s => s.status === 'pendente').length,
    aprovada:  solicitacoes.filter(s => s.status === 'aprovada').length,
    em_pedido: solicitacoes.filter(s => s.status === 'em_pedido').length,
    recebido:  solicitacoes.filter(s => s.status === 'recebido').length,
  }

  const selStyle = {
    padding: '6px 12px', borderRadius: 7, border: '1px solid #1E2235',
    background: '#0F1117', color: '#94A3B8', fontSize: 12, outline: 'none', cursor: 'pointer',
  }

  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768

  return (
    <div style={{ flex: 1, padding: '20px', overflowY: 'auto', color: '#E2E8F0', fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @media (max-width: 768px) {
          .sa-table-header { display: none !important; }
          .sa-sc-desktop   { display: none !important; }
          .sa-sc-mobile    { display: flex !important; }
        }
        @media (min-width: 769px) {
          .sa-sc-mobile { display: none !important; }
          .sa-sc-desktop { display: grid !important; }
        }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#F1F5F9', marginBottom: 4 }}>Compras</h1>
          <p style={{ fontSize: 13, color: '#475569' }}>Solicitações de material e serviços por obra.</p>
        </div>
        <button onClick={() => obras.length ? setModal({}) : alert('Cadastre ao menos uma obra primeiro.')} style={{
          padding: '9px 18px', borderRadius: 8, border: 'none',
          background: 'linear-gradient(135deg, #3B82F6, #6366F1)',
          color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer',
        }}>+ Nova Solicitação</button>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { key: 'pendente',  label: 'Aguardando aprovação', icon: '⏳' },
          { key: 'aprovada',  label: 'Aprovadas',            icon: '✓'  },
          { key: 'em_pedido', label: 'Pedido realizado',     icon: '📦' },
          { key: 'recebido',  label: 'Recebidos',            icon: '✅' },
        ].map(s => {
          const meta = STATUS_META[s.key]
          return (
            <div
              key={s.key}
              onClick={() => setFilter(f => ({ ...f, status: f.status === s.key ? 'all' : s.key }))}
              style={{
                background: filter.status === s.key ? meta.bg : '#1A1D2E',
                border: `1px solid ${filter.status === s.key ? meta.color + '40' : '#1E2235'}`,
                borderRadius: 10, padding: '12px 16px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 140,
              }}
            >
              <span style={{ fontSize: 20 }}>{s.icon}</span>
              <div>
                <div style={{ fontSize: 20, fontWeight: 700, color: meta.color }}>{stats[s.key]}</div>
                <div style={{ fontSize: 11, color: '#475569' }}>{s.label}</div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <select style={selStyle} value={filter.obra} onChange={e => setFilter(f => ({ ...f, obra: e.target.value }))}>
          <option value="all">Todas as obras</option>
          {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
        </select>
        <select style={selStyle} value={filter.status} onChange={e => setFilter(f => ({ ...f, status: e.target.value }))}>
          <option value="all">Todos os status</option>
          {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select style={selStyle} value={filter.urgencia} onChange={e => setFilter(f => ({ ...f, urgencia: e.target.value }))}>
          <option value="all">Todas as urgências</option>
          {Object.entries(URGENCIA_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        {(filter.obra !== 'all' || filter.status !== 'all' || filter.urgencia !== 'all') && (
          <button onClick={() => setFilter({ obra: 'all', status: 'all', urgencia: 'all' })} style={{
            padding: '6px 12px', borderRadius: 7, border: '1px solid #334155',
            background: 'transparent', color: '#64748B', fontSize: 12, cursor: 'pointer',
          }}>Limpar filtros</button>
        )}
        <span style={{ fontSize: 12, color: '#334155', alignSelf: 'center', marginLeft: 4 }}>
          {filtered.length} resultado{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* List */}
      {loading ? (
        <p style={{ color: '#334155', fontSize: 14 }}>Carregando...</p>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#334155' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🛒</div>
          <p style={{ fontSize: 15, fontWeight: 600, color: '#475569' }}>Nenhuma solicitação encontrada</p>
          <p style={{ fontSize: 13, color: '#334155', marginTop: 4 }}>
            {solicitacoes.length === 0 ? 'Clique em "+ Nova Solicitação" para começar.' : 'Tente ajustar os filtros.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Table header — desktop only */}
          <div className="sa-table-header" style={{
            display: 'grid', gridTemplateColumns: '24px 2fr 70px 1fr 110px 100px 110px 100px 36px',
            padding: '0 16px', gap: 12,
          }}>
            {['', 'Solicitação', 'Qtde Itens', 'Obra', 'Prazo Entrega', 'Urgência', 'Status', 'Data do Pedido', ''].map(h => (
              <div key={h} style={{ fontSize: 10, fontWeight: 700, color: '#334155', textTransform: 'uppercase' }}>{h}</div>
            ))}
          </div>

          {filtered.map(sol => {
            const smeta = STATUS_META[sol.status]  ?? STATUS_META.pendente
            const umeta = URGENCIA_META[sol.urgencia] ?? URGENCIA_META.normal
            const isExpanded = expanded === sol.id
            return (
              <div key={sol.id} style={{ marginBottom: 6 }}>

              {/* ── DESKTOP ROW ── */}
              <div
                className="sa-sc-desktop"
                style={{
                  gridTemplateColumns: '24px 2fr 70px 1fr 110px 100px 110px 100px 36px',
                  background: '#1A1D2E', border: `1px solid ${isExpanded ? '#334155' : '#1E2235'}`,
                  borderRadius: isExpanded ? '10px 10px 0 0' : 10,
                  padding: '13px 16px', gap: 12, cursor: 'pointer', alignItems: 'center',
                  transition: 'border-color 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = '#334155'}
                onMouseLeave={e => { if (!isExpanded) e.currentTarget.style.borderColor = '#1E2235' }}
              >
                <div onClick={() => setExpanded(isExpanded ? null : sol.id)} style={{ fontSize: 12, color: '#475569', userSelect: 'none', textAlign: 'center' }}>
                  {isExpanded ? '▾' : '▸'}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#F1F5F9', marginBottom: 2 }}>{sol.titulo}</div>
                  {sol.solicitante_nome && <div style={{ fontSize: 11, color: '#475569' }}>por {sol.solicitante_nome}</div>}
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#94A3B8', textAlign: 'center' }}>{sol.itens?.length ?? 0}</div>
                <div style={{ fontSize: 12, color: '#64748B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sol.obra?.nome ?? '—'}</div>
                <div style={{ fontSize: 12, color: sol.prazo_entrega ? '#94A3B8' : '#334155' }}>
                  {sol.prazo_entrega ? new Date(sol.prazo_entrega + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}
                </div>
                <div onClick={() => setModal(sol)}><Badge meta={umeta} /></div>
                <div onClick={() => setModal(sol)}><Badge meta={smeta} /></div>
                <div style={{ fontSize: 11, color: '#475569' }} onClick={() => setModal(sol)}>{fmtDate(sol.created_at)}</div>
                <button
                  onClick={e => { e.stopPropagation(); setModal(sol) }}
                  style={{ background: 'none', border: '1px solid #1E2235', borderRadius: 6, color: '#475569', fontSize: 13, cursor: 'pointer', padding: '4px 6px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#3B82F6'; e.currentTarget.style.color = '#3B82F6' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#1E2235'; e.currentTarget.style.color = '#475569' }}
                >✏️</button>
              </div>

              {/* ── MOBILE CARD ── */}
              <div
                className="sa-sc-mobile"
                onClick={() => setExpanded(isExpanded ? null : sol.id)}
                style={{
                  flexDirection: 'column',
                  background: '#1A1D2E', border: `1px solid ${isExpanded ? '#334155' : '#1E2235'}`,
                  borderRadius: isExpanded ? '10px 10px 0 0' : 10,
                  padding: '12px 14px', cursor: 'pointer', transition: 'border-color 0.15s',
                }}
              >
                {/* Linha 1: título + botão editar */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#F1F5F9', lineHeight: 1.3 }}>{sol.titulo}</div>
                    {sol.solicitante_nome && <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>por {sol.solicitante_nome}</div>}
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); setModal(sol) }}
                    style={{ background: 'none', border: '1px solid #1E2235', borderRadius: 6, color: '#475569', fontSize: 13, cursor: 'pointer', padding: '4px 8px', flexShrink: 0 }}
                  >✏️</button>
                </div>
                {/* Linha 2: badges */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                  <Badge meta={umeta} />
                  <Badge meta={smeta} />
                </div>
                {/* Linha 3: metadados em linha */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, fontSize: 11, color: '#64748B' }}>
                  <span>🏗️ {sol.obra?.nome ?? '—'}</span>
                  <span>📦 {sol.itens?.length ?? 0} iten{sol.itens?.length !== 1 ? 's' : ''}</span>
                  {sol.prazo_entrega && <span>📅 {new Date(sol.prazo_entrega + 'T00:00:00').toLocaleDateString('pt-BR')}</span>}
                </div>
              </div>
              {/* Linha expandida com itens */}
              {isExpanded && (
                <div style={{
                  background: '#0F1117', border: '1px solid #334155', borderTop: 'none',
                  borderRadius: '0 0 10px 10px', padding: '12px 16px',
                }}>
                  {sol.itens?.length === 0 ? (
                    <div style={{ fontSize: 12, color: '#334155' }}>Nenhum item.</div>
                  ) : (
                    <>
                      <div style={{ display: 'grid', gridTemplateColumns: '2fr 60px 70px 100px 1fr', gap: 8, marginBottom: 6 }}>
                        {['Descrição','Un.','Qtde','Valor unit.','Fornecedor'].map((h,i) => (
                          <div key={i} style={{ fontSize: 10, fontWeight: 700, color: '#334155', textTransform: 'uppercase' }}>{h}</div>
                        ))}
                      </div>
                      {sol.itens.map(it => (
                        <div key={it.id ?? it.descricao} style={{ display: 'grid', gridTemplateColumns: '2fr 60px 70px 100px 1fr', gap: 8, marginBottom: 6 }}>
                          <div style={{ fontSize: 12, color: '#94A3B8' }}>{it.descricao}</div>
                          <div style={{ fontSize: 12, color: '#64748B' }}>{it.unidade}</div>
                          <div style={{ fontSize: 12, color: '#64748B' }}>{it.quantidade}</div>
                          <div style={{ fontSize: 12, color: '#64748B' }}>
                            {it.valor_unitario ? Number(it.valor_unitario).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'}
                          </div>
                          <div style={{ fontSize: 12, color: '#475569' }}>{it.fornecedor_sugerido || '—'}</div>
                        </div>
                      ))}
                      <div style={{ borderTop: '1px solid #1E2235', paddingTop: 8, marginTop: 4, textAlign: 'right', fontSize: 12, color: '#64748B' }}>
                        Total estimado: <strong style={{ color: '#F1F5F9' }}>
                          {sol.itens.reduce((acc, it) => acc + (parseFloat(it.valor_unitario)||0)*(parseFloat(it.quantidade)||0), 0)
                            .toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </strong>
                      </div>
                    </>
                  )}
                </div>
              )}
              </div>
            )
          })}
        </div>
      )}

      {modal !== null && (
        <SolicitacaoModal
          solicitacao={modal.id ? modal : null}
          obras={obras}
          onSave={handleSave}
          onDelete={handleDelete}
          onDuplicate={handleDuplicate}
          session={session}
          onClose={() => setModal(null)}
        />
      )}

      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24,
          background: '#064E3B', border: '1px solid #065F46',
          color: '#6EE7B7', padding: '10px 18px', borderRadius: 10,
          fontSize: 13, fontWeight: 600, zIndex: 2000,
          boxShadow: '0 8px 24px #00000060',
        }}>{toast.msg}</div>
      )}
    </div>
  )
}
