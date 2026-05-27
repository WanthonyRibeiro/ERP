    import { useState } from 'react'

const URGENCIA_META = {
  normal:  { label: 'Normal',   color: '#64748B', bg: '#1E2235' },
  urgente: { label: 'Urgente',  color: '#F59E0B', bg: '#451A03' },
  critico: { label: 'Crítico',  color: '#EF4444', bg: '#450A0A' },
}
const STATUS_META = {
  pendente:  { label: 'Pendente',        color: '#F59E0B', bg: '#451A03' },
  aprovada:  { label: 'Aprovada',        color: '#3B82F6', bg: '#1E3A5F' },
  rejeitada: { label: 'Rejeitada',       color: '#EF4444', bg: '#450A0A' },
  em_pedido: { label: 'Pedido Realizado',color: '#8B5CF6', bg: '#2E1065' },
  recebido:  { label: 'Recebido',        color: '#10B981', bg: '#064E3B' },
}

const inp = {
  width: '100%', padding: '8px 12px', borderRadius: 7,
  background: '#0F1117', border: '1px solid #1E2235',
  color: '#F1F5F9', fontSize: 13, outline: 'none', fontFamily: 'inherit',
}
const lbl = { fontSize: 11, fontWeight: 600, color: '#64748B', marginBottom: 5, display: 'block' }

function newItem() { return { id: Date.now(), descricao: '', unidade: 'un', quantidade: 1, valor_unitario: '', fornecedor_sugerido: '' } }

function formatBRL(val) {
  const n = parseFloat(val)
  if (isNaN(n)) return '—'
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function SolicitacaoModal({ solicitacao, obras, onSave, onDelete, onClose, session }) {
  const isNew = !solicitacao?.id
  const [form, setForm] = useState({
    obra_id:          solicitacao?.obra_id          ?? obras[0]?.id ?? '',
    titulo:           solicitacao?.titulo           ?? '',
    urgencia:         solicitacao?.urgencia         ?? 'normal',
    solicitante_nome: solicitacao?.solicitante_nome ?? session?.user?.email ?? '',
    observacoes:      solicitacao?.observacoes      ?? '',
    prazo_entrega:    solicitacao?.prazo_entrega    ?? '',
    status:           solicitacao?.status           ?? 'pendente',
    motivo_rejeicao:  solicitacao?.motivo_rejeicao  ?? '',
  })
  const [items, setItems] = useState(
    solicitacao?.itens?.length ? solicitacao.itens : [newItem()]
  )
  const [showReject, setShowReject] = useState(false)
  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const total = items.reduce((acc, it) => {
    const val = parseFloat(it.valor_unitario) || 0
    const qty = parseFloat(it.quantidade)    || 0
    return acc + val * qty
  }, 0)

  function addItem()           { setItems(its => [...its, newItem()]) }
  function removeItem(id)      { setItems(its => its.filter(i => i.id !== id)) }
  function setItem(id, k, v)   { setItems(its => its.map(i => i.id === id ? { ...i, [k]: v } : i)) }

  function handleSave(statusOverride) {
    if (!form.titulo || !form.obra_id) return
    onSave({
      ...solicitacao,
      ...form,
      status: statusOverride ?? form.status,
      itens: items.filter(i => i.descricao.trim()),
    })
  }

  const smeta = STATUS_META[form.status]
  const umeta = URGENCIA_META[form.urgencia]

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{
      position: 'fixed', inset: 0, background: '#00000095',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: 16,
    }}>
      <div style={{
        background: '#1A1D2E', border: '1px solid #1E2235', borderRadius: 16,
        width: 680, maxWidth: '100%', maxHeight: '90vh',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px 16px', borderBottom: '1px solid #1E2235',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: '#F1F5F9' }}>
              {isNew ? 'Nova solicitação' : 'Solicitação de compra'}
            </span>
            <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: smeta.bg, color: smeta.color }}>
              {smeta.label}
            </span>
            <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: umeta.bg, color: umeta.color }}>
              {umeta.label}
            </span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#475569', fontSize: 22, cursor: 'pointer' }}>×</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

          {/* Row 1 */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
            <div style={{ flex: 2 }}>
              <label style={lbl}>Título da solicitação *</label>
              <input style={inp} value={form.titulo} onChange={e => setF('titulo', e.target.value)} placeholder="Ex: Materiais elétricos 2º pav." />
            </div>
            <div style={{ flex: 1 }}>
              <label style={lbl}>Obra *</label>
              <select style={inp} value={form.obra_id} onChange={e => setF('obra_id', e.target.value)}>
                {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
              </select>
            </div>
          </div>

          {/* Row 2 */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
            <div style={{ flex: 1 }}>
              <label style={lbl}>Urgência</label>
              <select style={inp} value={form.urgencia} onChange={e => setF('urgencia', e.target.value)}>
                <option value="normal">Normal</option>
                <option value="urgente">Urgente</option>
                <option value="critico">Crítico</option>
              </select>
            </div>
            <div style={{ flex: 2 }}>
              <label style={lbl}>Solicitante</label>
              <input style={inp} value={form.solicitante_nome} onChange={e => setF('solicitante_nome', e.target.value)} placeholder="Nome de quem está pedindo" />
            </div>
          </div>

          {/* Data de abertura — somente leitura */}
        <div style={{ marginBottom: 16 }}>
          <label style={lbl}>Data de abertura</label>
          <div style={{
            padding: '8px 12px', borderRadius: 7, fontSize: 13,
            background: '#0A0D14', border: '1px solid #1E2235',
            color: '#475569', fontFamily: 'inherit',
          }}>
            {solicitacao?.created_at
              ? new Date(solicitacao.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
              : 'Agora — ' + new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
            }
          </div>
        </div>

        {/* Prazo de entrega */}
        <div style={{ marginBottom: 20 }}>
          <label style={lbl}>Prazo de entrega</label>
          <input style={inp} type="date" value={form.prazo_entrega} min={new Date().toISOString().slice(0,10)}
                onChange={e => setF('prazo_entrega', e.target.value)}
                onBlur={e => {
                  const val = e.target.value
                  const today = new Date().toISOString().slice(0,10)
                  if (val && val < today) setF('prazo_entrega', today)
                }}
                style={{ ...inp, borderColor: form.prazo_entrega && form.prazo_entrega < new Date().toISOString().slice(0,10) ? '#EF4444' : '#1E2235' }} />
          {form.prazo_entrega && form.prazo_entrega < new Date().toISOString().slice(0,10) && (
            <div style={{ fontSize: 11, color: '#EF4444', marginTop: 5, display: 'flex', alignItems: 'center', gap: 4 }}>
              ⚠️ Não é possível criar pedidos com prazo de entrega retroativo.
            </div>
          ) />
        </div>

        {/* Itens */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <label style={{ ...lbl, marginBottom: 0 }}>Itens solicitados</label>
              <button onClick={addItem} style={{
                padding: '4px 10px', borderRadius: 6, border: '1px solid #1E3A5F',
                background: 'transparent', color: '#3B82F6', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}>+ Adicionar item</button>
            </div>

            {/* Table header */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 60px 70px 100px 1fr 28px', gap: 6, marginBottom: 6 }}>
              {['Descrição','Un.','Qtde','Valor unit.','Fornecedor sugerido',''].map((h, i) => (
                <div key={i} style={{ fontSize: 10, fontWeight: 700, color: '#334155', textTransform: 'uppercase' }}>{h}</div>
              ))}
            </div>

            {items.map(it => (
              <div key={it.id} style={{ display: 'grid', gridTemplateColumns: '2fr 60px 70px 100px 1fr 28px', gap: 6, marginBottom: 6 }}>
                <input style={{ ...inp, padding: '7px 10px' }} value={it.descricao} onChange={e => setItem(it.id, 'descricao', e.target.value)} placeholder="Material ou serviço" />
                <input style={{ ...inp, padding: '7px 8px' }} value={it.unidade} onChange={e => setItem(it.id, 'unidade', e.target.value)} placeholder="un" />
                <input style={{ ...inp, padding: '7px 8px' }} type="number" min="0" value={it.quantidade} onChange={e => setItem(it.id, 'quantidade', e.target.value)} />
                <input style={{ ...inp, padding: '7px 8px' }} type="number" min="0" step="0.01" value={it.valor_unitario} onChange={e => setItem(it.id, 'valor_unitario', e.target.value)} placeholder="0,00" />
                <input style={{ ...inp, padding: '7px 8px' }} value={it.fornecedor_sugerido} onChange={e => setItem(it.id, 'fornecedor_sugerido', e.target.value)} placeholder="Opcional" />
                <button onClick={() => removeItem(it.id)} style={{ background: 'none', border: 'none', color: '#475569', fontSize: 16, cursor: 'pointer', padding: 0, alignSelf: 'center' }}>×</button>
              </div>
            ))}

            {/* Total */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10, paddingTop: 10, borderTop: '1px solid #1E2235' }}>
              <div style={{ fontSize: 13, color: '#64748B' }}>
                Total estimado: <span style={{ fontWeight: 700, color: '#F1F5F9', marginLeft: 6 }}>{formatBRL(total)}</span>
              </div>
            </div>
          </div>

          {/* Observações */}
          <div style={{ marginBottom: 16 }}>
            <label style={lbl}>Observações</label>
            <textarea style={{ ...inp, resize: 'vertical', minHeight: 64 }} value={form.observacoes} onChange={e => setF('observacoes', e.target.value)} placeholder="Informações adicionais, local de entrega, etc." />
          </div>

          {/* Motivo rejeição (se rejeitada ou mostrando form de rejeição) */}
          {(form.status === 'rejeitada' || showReject) && (
            <div style={{ marginBottom: 16 }}>
              <label style={{ ...lbl, color: '#EF4444' }}>Motivo da rejeição</label>
              <textarea style={{ ...inp, borderColor: '#EF444440', resize: 'vertical', minHeight: 56 }} value={form.motivo_rejeicao} onChange={e => setF('motivo_rejeicao', e.target.value)} placeholder="Explique o motivo..." />
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 24px', borderTop: '1px solid #1E2235',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0,
          flexWrap: 'wrap', gap: 8,
        }}>
          {/* Excluir — só para solicitações existentes */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {!isNew && (
              <button onClick={() => onDelete(solicitacao.id)} style={{
                padding: '7px 14px', borderRadius: 7, border: '1px solid #7F1D1D',
                background: 'transparent', color: '#FCA5A5', fontWeight: 600, fontSize: 12, cursor: 'pointer',
              }}>🗑 Excluir</button>
            )}
          </div>

          {/* Status actions */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {form.status === 'pendente' && !isNew && (
              <>
                <button onClick={() => handleSave('aprovada')} style={{
                  padding: '7px 14px', borderRadius: 7, border: 'none',
                  background: '#1E3A5F', color: '#93C5FD', fontWeight: 600, fontSize: 12, cursor: 'pointer',
                }}>✓ Aprovar</button>
                <button onClick={() => setShowReject(r => !r)} style={{
                  padding: '7px 14px', borderRadius: 7, border: '1px solid #991B1B',
                  background: 'transparent', color: '#FCA5A5', fontWeight: 600, fontSize: 12, cursor: 'pointer',
                }}>✕ Rejeitar</button>
              </>
            )}
            {form.status === 'aprovada' && (
              <button onClick={() => handleSave('em_pedido')} style={{
                padding: '7px 14px', borderRadius: 7, border: 'none',
                background: '#2E1065', color: '#C4B5FD', fontWeight: 600, fontSize: 12, cursor: 'pointer',
              }}>📦 Marcar como pedido</button>
            )}
            {form.status === 'em_pedido' && (
              <button onClick={() => handleSave('recebido')} style={{
                padding: '7px 14px', borderRadius: 7, border: 'none',
                background: '#064E3B', color: '#6EE7B7', fontWeight: 600, fontSize: 12, cursor: 'pointer',
              }}>✓ Marcar como recebido</button>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={{
              padding: '8px 18px', borderRadius: 7, border: '1px solid #1E2235',
              background: 'transparent', color: '#64748B', fontWeight: 600, fontSize: 13, cursor: 'pointer',
            }}>Cancelar</button>
            <button onClick={() => showReject ? handleSave('rejeitada') : handleSave()} style={{
              padding: '8px 18px', borderRadius: 7, border: 'none',
              background: showReject ? '#7F1D1D' : 'linear-gradient(135deg, #3B82F6, #6366F1)',
              color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer',
            }}>{isNew ? 'Enviar solicitação' : showReject ? 'Confirmar rejeição' : 'Salvar'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

    
