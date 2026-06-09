import { useState, useEffect, useRef } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabase'

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

const ACAO_META = {
  criada:           { label: 'SC criada',          color: '#10B981', icon: '✦' },
  editada:          { label: 'SC editada',          color: '#64748B', icon: '✎' },
  aprovada:         { label: 'SC aprovada',         color: '#3B82F6', icon: '✓' },
  rejeitada:        { label: 'SC rejeitada',        color: '#EF4444', icon: '✕' },
  pedido_realizado: { label: 'Pedido realizado',    color: '#8B5CF6', icon: '📦' },
  recebida:         { label: 'Recebido',            color: '#10B981', icon: '✅' },
  duplicada:        { label: 'SC duplicada',        color: '#F59E0B', icon: '⎘' },
}

const inp = {
  width: '100%', padding: '8px 12px', borderRadius: 7,
  background: '#0F1117', border: '1px solid #1E2235',
  color: '#F1F5F9', fontSize: 13, outline: 'none', fontFamily: 'inherit',
}
const inpDisabled = {
  ...inp, background: '#0A0D14', color: '#475569', cursor: 'not-allowed',
}
const lbl = { fontSize: 11, fontWeight: 600, color: '#64748B', marginBottom: 5, display: 'block' }

function newItem() {
  return { id: Date.now(), descricao: '', unidade: 'un', quantidade: 1, valor_unitario: '', fornecedor_sugerido: '' }
}

export default function SolicitacaoModal({ solicitacao, obras, onSave, onDelete, onClose, onDuplicate, session }) {
  const isNew   = !solicitacao?.id
  const locked  = !isNew && solicitacao?.status !== 'pendente'
  const userName = session?.user?.user_metadata?.nome ?? session?.user?.email ?? ''
  const today   = new Date().toISOString().slice(0, 10)

  const [aba, setAba] = useState('dados')
  const [historico, setHistorico] = useState([])
  const [loadingHist, setLoadingHist] = useState(false)
  const [showReject, setShowReject] = useState(false)
  const [insumos, setInsumos] = useState([])
  const [showInsumoSearch, setShowInsumoSearch] = useState(null) // id do item sendo pesquisado
  const [insumoSearch, setInsumoSearch] = useState('')

  const [form, setForm] = useState({
    obra_id:          solicitacao?.obra_id          ?? obras[0]?.id ?? '',
    titulo:           solicitacao?.titulo           ?? '',
    urgencia:         solicitacao?.urgencia         ?? 'normal',
    status:           solicitacao?.status           ?? 'pendente',
    solicitante_nome: solicitacao?.solicitante_nome ?? userName,
    observacoes:      solicitacao?.observacoes      ?? '',
    motivo_rejeicao:  solicitacao?.motivo_rejeicao  ?? '',
    prazo_entrega:    solicitacao?.prazo_entrega    ?? (() => { const d = new Date(); d.setDate(d.getDate() + 14); return d.toISOString().slice(0,10) })(),
    gestao:           solicitacao?.gestao           ?? '',
  })
  const [items, setItems] = useState(
    solicitacao?.itens?.length ? solicitacao.itens : [newItem()]
  )

  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const prazoInvalido = form.prazo_entrega && form.prazo_entrega < today

  const total = items.reduce((acc, it) =>
    acc + (parseFloat(it.valor_unitario) || 0) * (parseFloat(it.quantidade) || 0), 0)

  // Carrega insumos filtrados pela gestão selecionada
  useEffect(() => {
    if (form.gestao) loadInsumos(form.gestao)
  }, [form.gestao])

  async function loadInsumos(gestao) {
    const categorias = gestao === 'GA'
      ? ['Administrativo', 'Projetos', 'Jurídico', 'Financeiro', 'RH', 'Geral']
      : ['Estrutura', 'Alvenaria', 'Hidráulica', 'Elétrica', 'Acabamento', 'Pintura', 'Cobertura', 'Impermeabilização', 'Instalações', 'Esquadrias', 'Externo', 'Logística', 'Locações']
    const { data } = await supabase.from('insumos')
      .select('id, codigo, nome, tipo, unidade_compra, unidade_uso, fator_conversao, comprimento_m, preco_referencia')
      .in('categoria', categorias)
      .eq('ativo', true)
      .order('nome')
    setInsumos(data ?? [])
  }

  function aplicarInsumo(itemId, insumo) {
    setItems(its => its.map(i => i.id === itemId ? {
      ...i,
      descricao: insumo.nome,
      unidade: insumo.unidade_compra ?? 'un',
      valor_unitario: insumo.preco_referencia ?? '',
      insumo_id: insumo.id,
    } : i))
    setShowInsumoSearch(null)
    setInsumoSearch('')
  }

  const insumosFiltrados = insumos.filter(i =>
    !insumoSearch || i.nome.toLowerCase().includes(insumoSearch.toLowerCase()) || i.codigo.includes(insumoSearch)
  )

  useEffect(() => {
    if (aba === 'historico' && solicitacao?.id) loadHistorico()
  }, [aba])

  async function loadHistorico() {
    setLoadingHist(true)
    const { data } = await supabase.from('sc_historico')
      .select('*').eq('solicitacao_id', solicitacao.id).order('created_at', { ascending: false })
    setHistorico(data ?? [])
    setLoadingHist(false)
  }


  const importFileRef = useRef()

  async function handleImportFile(e) {
    const file = e.target.files[0]; if (!file) return
    const ext = file.name.split('.').pop().toLowerCase()

    // CSV or XLSX
    if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') {
      const buf = await file.arrayBuffer()
      const wb  = XLSX.read(buf, { cellDates: true })
      const ws  = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(ws, { raw: false })
      const imported = rows
        .filter(r => r['Descrição'] || r['Descricao'] || r['descricao'] || r['Item'] || r['item'])
        .map(r => ({
          id: Date.now() + Math.random(),
          descricao:           r['Descrição'] || r['Descricao'] || r['descricao'] || r['Item'] || r['item'] || '',
          unidade:             r['Unidade']   || r['unidade']   || r['Un'] || 'un',
          quantidade:          r['Quantidade'] || r['quantidade'] || r['Qtde'] || r['qtde'] || 1,
          valor_unitario:      r['Valor Unit'] || r['Valor Unitário'] || r['valor_unit'] || r['Valor'] || '',
          fornecedor_sugerido: r['Fornecedor'] || r['fornecedor'] || '',
        }))
      if (imported.length) {
        setItems(its => [...its.filter(i => i.descricao?.trim()), ...imported])
        showImportToast(`${imported.length} itens importados!`)
      } else {
        showImportToast('Nenhum item encontrado. Verifique as colunas.')
      }
    }

    // Imagem — envia para Claude analisar (via API Anthropic)
    if (['jpg','jpeg','png','webp'].includes(ext)) {
      showImportToast('Analisando imagem...', 'loading')
      const reader = new FileReader()
      reader.onload = async (ev) => {
        const base64 = ev.target.result.split(',')[1]
        try {
          const res = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: 'claude-sonnet-4-20250514',
              max_tokens: 1000,
              messages: [{
                role: 'user',
                content: [
                  { type: 'image', source: { type: 'base64', media_type: `image/${ext==='jpg'?'jpeg':ext}`, data: base64 } },
                  { type: 'text', text: 'Extraia os itens desta lista de compras/materiais. Responda APENAS em JSON no formato: {"itens":[{"descricao":"...","unidade":"un","quantidade":1,"valor_unitario":"","fornecedor_sugerido":""}]}. Sem texto adicional.' }
                ]
              }]
            })
          })
          const data = await res.json()
          const text = data.content?.[0]?.text ?? ''
          const clean = text.replace(/```json|```/g,'').trim()
          const parsed = JSON.parse(clean)
          if (parsed.itens?.length) {
            setItems(its => [...its.filter(i=>i.descricao?.trim()), ...parsed.itens.map(it=>({...it,id:Date.now()+Math.random()}))])
            showImportToast(`${parsed.itens.length} itens extraídos da imagem!`)
          }
        } catch(err) {
          showImportToast('Erro ao analisar imagem.')
        }
      }
      reader.readAsDataURL(file)
    }
    e.target.value = ''
  }

  const [importToast, setImportToast] = useState(null)
  function showImportToast(msg, type='success') { setImportToast({msg,type}); if(type!=='loading') setTimeout(()=>setImportToast(null),3000) }

  function addItem()         { if (!locked) setItems(its => [...its, newItem()]) }
  function removeItem(id)    { setItems(its => its.filter(i => i.id !== id)) }
  function setItem(id, k, v) { if (!locked) setItems(its => its.map(i => i.id === id ? { ...i, [k]: v } : i)) }

  function handleSave(statusOverride) {
    if (!form.titulo || !form.obra_id || !form.gestao) return
    onSave({
      ...solicitacao,
      ...form,
      status: statusOverride ?? form.status,
      itens: items.filter(i => i.descricao?.trim()),
      _acao: statusOverride ?? (isNew ? 'criada' : 'editada'),
      _userName: userName,
    })
  }

  const smeta = STATUS_META[form.status]  ?? STATUS_META.pendente
  const umeta = URGENCIA_META[form.urgencia] ?? URGENCIA_META.normal

  const ABAS = [
    { id: 'dados',     label: 'Dados' },
    ...(!isNew ? [{ id: 'historico', label: 'Histórico' }] : []),
  ]

  return (
    <div
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{
        position: 'fixed', inset: 0, background: '#00000095',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: 16,
      }}
    >
      <div style={{
        background: '#1A1D2E', border: '1px solid #1E2235', borderRadius: 16,
        width: 700, maxWidth: '100%', maxHeight: '90vh', margin: '0 8px',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{
          padding: '18px 24px 0', borderBottom: '1px solid #1E2235', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: '#F1F5F9' }}>
                {isNew ? 'Nova solicitação' : 'Solicitação de compra'}
              </span>
              <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: smeta.bg, color: smeta.color }}>{smeta.label}</span>
              <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: umeta.bg, color: umeta.color }}>{umeta.label}</span>
              {locked && <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: '#1A1D2E', color: '#475569', border: '1px solid #1E2235' }}>🔒 Travado</span>}
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#475569', fontSize: 22, cursor: 'pointer' }}>×</button>
          </div>
          {/* Abas */}
          {!isNew && (
            <div style={{ display: 'flex', gap: 4 }}>
              {ABAS.map(a => (
                <button key={a.id} onClick={() => setAba(a.id)} style={{
                  padding: '6px 16px', borderRadius: '7px 7px 0 0', border: 'none',
                  background: aba === a.id ? '#0F1117' : 'transparent',
                  color: aba === a.id ? '#F1F5F9' : '#475569',
                  fontSize: 13, fontWeight: aba === a.id ? 600 : 400, cursor: 'pointer',
                  borderBottom: aba === a.id ? '2px solid #3B82F6' : '2px solid transparent',
                }}>{a.label}</button>
              ))}
            </div>
          )}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

          {/* ABA DADOS */}
          {aba === 'dados' && (
            <>
              {/* Aviso travado */}
              {locked && (
                <div style={{
                  background: '#1E3A5F20', border: '1px solid #1E3A5F',
                  borderRadius: 8, padding: '10px 14px', marginBottom: 16,
                  fontSize: 12, color: '#93C5FD',
                }}>
                  🔒 Esta SC está <strong>{smeta.label}</strong> e não pode ser editada.
                  {solicitacao?.status === 'rejeitada' && ' Você pode duplicá-la, corrigir e reenviar.'}
                </div>
              )}

              {/* Gestão */}
              {isNew && !form.gestao ? (
                <div style={{ marginBottom: 20 }}>
                  <label style={lbl}>Tipo de Gestão *</label>
                  <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                    <button onClick={() => setF('gestao', 'GA')} style={{
                      flex: 1, padding: '18px', borderRadius: 10,
                      border: '2px solid #1E2235', background: '#0F1117',
                      cursor: 'pointer', textAlign: 'center', transition: 'all 0.15s',
                    }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = '#3B82F6'}
                      onMouseLeave={e => e.currentTarget.style.borderColor = '#1E2235'}
                    >
                      <div style={{ fontSize: 28, marginBottom: 8 }}>📋</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#F1F5F9', marginBottom: 4 }}>Gestão Administrativa</div>
                      <div style={{ fontSize: 10, color: '#334155', marginTop: 6 }}>ART, projetos, honorários,<br/>colaboradores, taxas...</div>
                    </button>
                    <button onClick={() => setF('gestao', 'GE')} style={{
                      flex: 1, padding: '18px', borderRadius: 10,
                      border: '2px solid #1E2235', background: '#0F1117',
                      cursor: 'pointer', textAlign: 'center', transition: 'all 0.15s',
                    }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = '#10B981'}
                      onMouseLeave={e => e.currentTarget.style.borderColor = '#1E2235'}
                    >
                      <div style={{ fontSize: 28, marginBottom: 8 }}>🏗️</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#F1F5F9', marginBottom: 4 }}>Gestão Executiva</div>
                      <div style={{ fontSize: 10, color: '#334155', marginTop: 6 }}>Materiais, equipamentos,<br/>serviços de obra...</div>
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Badge da gestão + botão trocar */}
                  {form.gestao && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                      <span style={{
                        padding: '3px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                        background: form.gestao === 'GA' ? '#1E3A5F' : '#064E3B',
                        color: form.gestao === 'GA' ? '#93C5FD' : '#6EE7B7',
                      }}>{form.gestao === 'GA' ? '📋 Gestão Administrativa' : '🏗️ Gestão Executiva'}</span>
                      {isNew && (
                        <button onClick={() => setF('gestao', '')} style={{ background: 'none', border: 'none', color: '#475569', fontSize: 11, cursor: 'pointer', textDecoration: 'underline' }}>trocar</button>
                      )}
                    </div>
                  )}

              {/* Título + Obra */}
              <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
                <div style={{ flex: 2 }}>
                  <label style={lbl}>Título da solicitação *</label>
                  <input style={locked ? inpDisabled : inp} disabled={locked} value={form.titulo} onChange={e => setF('titulo', e.target.value)} placeholder="Ex: Materiais elétricos 2º pav." />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={lbl}>Obra *</label>
                  <select style={locked ? inpDisabled : inp} disabled={locked} value={form.obra_id} onChange={e => setF('obra_id', e.target.value)}>
                    {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
                  </select>
                </div>
              </div>

              {/* Urgência + Solicitante */}
              <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
                <div style={{ flex: 1 }}>
                  <label style={lbl}>Urgência</label>
                  <select style={locked ? inpDisabled : inp} disabled={locked} value={form.urgencia} onChange={e => setF('urgencia', e.target.value)}>
                    <option value="normal">Normal</option>
                    <option value="urgente">Urgente</option>
                    <option value="critico">Crítico</option>
                  </select>
                </div>
                <div style={{ flex: 2 }}>
                  <label style={lbl}>Solicitante</label>
                  <input style={locked ? inpDisabled : inp} disabled={locked} value={form.solicitante_nome} onChange={e => setF('solicitante_nome', e.target.value)} />
                </div>
              </div>

              {/* Data de abertura */}
              <div style={{ marginBottom: 14 }}>
                <label style={lbl}>Data de abertura</label>
                <div style={{ padding: '8px 12px', borderRadius: 7, fontSize: 13, background: '#0A0D14', border: '1px solid #1E2235', color: '#475569' }}>
                  {solicitacao?.created_at
                    ? new Date(solicitacao.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                    : 'Agora — ' + new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>

              {/* Prazo de entrega */}
              <div style={{ marginBottom: 20 }}>
                <label style={lbl}>Prazo de entrega</label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <div style={{ position: 'relative', width: 90 }}>
                    <input
                      type="number" min="0" max="999"
                      disabled={locked}
                      value={form.prazo_entrega && today ? Math.round((new Date(form.prazo_entrega) - new Date(today)) / 86400000) : 14}
                      onChange={e => {
                        const dias = parseInt(e.target.value) || 0
                        const d = new Date(today)
                        d.setDate(d.getDate() + dias)
                        setF('prazo_entrega', d.toISOString().slice(0,10))
                      }}
                      style={{ ...locked ? inpDisabled : inp, paddingRight: 30, textAlign: 'center', fontWeight: 700 }}
                    />
                    <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: '#475569', pointerEvents: 'none' }}>dias</span>
                  </div>
                  <span style={{ color: '#334155', fontSize: 13 }}>=</span>
                  <input
                    style={{ ...locked ? inpDisabled : { ...inp, borderColor: prazoInvalido ? '#EF4444' : '#1E2235' }, flex: 1 }}
                    type="date" min={today} disabled={locked}
                    value={form.prazo_entrega}
                    onChange={e => setF('prazo_entrega', e.target.value)}
                    onBlur={e => { if (e.target.value && e.target.value < today) setF('prazo_entrega', today) }}
                  />
                </div>
                {prazoInvalido && <div style={{ fontSize: 11, color: '#EF4444', marginTop: 5 }}>⚠️ Não é possível criar pedidos com prazo de entrega retroativo.</div>}
              </div>

              {/* Itens */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <label style={{ ...lbl, marginBottom: 0 }}>Itens solicitados</label>
                  {!locked && (
                    <div style={{display:'flex',gap:6}}>
                    <label style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #334155', background: 'transparent', color: '#64748B', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      ↑ Importar
                      <input ref={importFileRef} type="file" accept=".xlsx,.xls,.csv,.jpg,.jpeg,.png,.webp" style={{display:'none'}} onChange={handleImportFile} />
                    </label>
                    <button onClick={addItem} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #1E3A5F', background: 'transparent', color: '#3B82F6', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>+ Adicionar item</button>
                  </div>
                  )}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 60px 70px 100px 1fr 28px', gap: 6, marginBottom: 6 }}>
                  {['Descrição','Un.','Qtde','Valor unit.','Fornecedor sugerido',''].map((h, i) => (
                    <div key={i} style={{ fontSize: 10, fontWeight: 700, color: '#334155', textTransform: 'uppercase' }}>{h}</div>
                  ))}
                </div>
                {items.map(it => (
                  <div key={it.id} style={{ marginBottom: 10, background: '#0F1117', border: '1px solid #1E2235', borderRadius: 8, padding: '10px' }}>
                    {/* Linha 1: Descrição full width */}
                    <div style={{ position: 'relative', marginBottom: 8 }}>
                      <input
                        style={{ ...locked ? inpDisabled : inp, padding: '7px 10px', width: '100%' }}
                        disabled={locked}
                        value={it.descricao}
                        onChange={e => setItem(it.id, 'descricao', e.target.value)}
                        onFocus={() => form.gestao && !locked && setShowInsumoSearch(it.id)}
                        placeholder={form.gestao ? '🔍 Digite ou busque no catálogo...' : 'Material ou serviço'}
                      />
                      {/* Dropdown de insumos */}
                      {showInsumoSearch === it.id && insumos.length > 0 && (
                        <div style={{
                          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                          background: '#1A1D2E', border: '1px solid #1E2235', borderRadius: 8,
                          boxShadow: '0 8px 24px #00000080', maxHeight: 220, overflowY: 'auto',
                        }}>
                          <div style={{ padding: '8px 10px', borderBottom: '1px solid #1E2235' }}>
                            <input
                              style={{ ...inp, fontSize: 12, padding: '5px 8px' }}
                              placeholder="Buscar insumo..."
                              value={insumoSearch}
                              onChange={e => setInsumoSearch(e.target.value)}
                              autoFocus
                            />
                          </div>
                          {insumosFiltrados.length === 0 ? (
                            <div style={{ padding: '12px', fontSize: 12, color: '#334155', textAlign: 'center' }}>Nenhum insumo encontrado</div>
                          ) : insumosFiltrados.slice(0, 20).map(ins => (
                            <div
                              key={ins.id}
                              onClick={() => aplicarInsumo(it.id, ins)}
                              style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #161929' }}
                              onMouseEnter={e => e.currentTarget.style.background = '#0F1117'}
                              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                  <span style={{ fontSize: 10, color: '#3B82F6', fontFamily: 'monospace', marginRight: 8 }}>{ins.codigo}</span>
                                  <span style={{ fontSize: 12, color: '#F1F5F9' }}>{ins.nome}</span>
                                </div>
                                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                                  <span style={{ fontSize: 11, color: '#475569' }}>{ins.unidade_compra}</span>
                                  {ins.preco_referencia && <span style={{ fontSize: 11, color: '#10B981' }}>R$ {Number(ins.preco_referencia).toFixed(2)}</span>}
                                </div>
                              </div>
                            </div>
                          ))}
                          <div
                            onClick={() => { setShowInsumoSearch(null); setInsumoSearch('') }}
                            style={{ padding: '8px 12px', fontSize: 11, color: '#334155', cursor: 'pointer', textAlign: 'center' }}
                          >Digitar manualmente</div>
                        </div>
                      )}
                    </div>
                    {/* Linha 2: Un / Qtde / Valor / Fornecedor / Remover */}
                    <div style={{ display: 'grid', gridTemplateColumns: '100px 90px 1fr 1fr 28px', gap: 8, alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: 10, color: '#334155', fontWeight: 600, marginBottom: 3 }}>UN.</div>
                        {it.insumo_id && (() => {
                          const ins = insumos.find(i => i.id === it.insumo_id)
                          const isAco = ins && (ins.comprimento_m > 0) && (/aço|aco|ca-50|ca-60/i.test(ins.nome) || ins.tipo?.includes('Aço'))
                          if (ins?.unidade_uso && ins.unidade_uso !== ins.unidade_compra) {
                            const opts = [ins.unidade_compra]
                            if (ins.unidade_uso && !opts.includes(ins.unidade_uso)) opts.push(ins.unidade_uso)
                            if (isAco) opts.push(`br${ins.comprimento_m}m`)
                            return (
                              <select
                                style={{ ...locked ? inpDisabled : inp, padding: '6px 8px', fontSize: 12 }}
                                disabled={locked}
                                value={it.unidade}
                                onChange={e => setItem(it.id, 'unidade', e.target.value)}
                              >
                                {opts.map(o => <option key={o} value={o}>{o}</option>)}
                              </select>
                            )
                          }
                          return <input style={{ ...locked ? inpDisabled : inp, padding: '6px 8px', fontSize: 12 }} disabled={locked} value={it.unidade} onChange={e => setItem(it.id, 'unidade', e.target.value)} />
                        })()}
                        {!it.insumo_id && (
                          <input style={{ ...locked ? inpDisabled : inp, padding: '6px 8px', fontSize: 12 }} disabled={locked} value={it.unidade} onChange={e => setItem(it.id, 'unidade', e.target.value)} />
                        )}
                      </div>
                      <div>
                        <div style={{ fontSize: 10, color: '#334155', fontWeight: 600, marginBottom: 3 }}>QTDE.</div>
                        <input style={{ ...locked ? inpDisabled : inp, padding: '6px 8px', fontSize: 12 }} disabled={locked} type="number" min="0" value={it.quantidade} onChange={e => setItem(it.id, 'quantidade', e.target.value)} />
                      </div>
                      <div>
                        <div style={{ fontSize: 10, color: '#334155', fontWeight: 600, marginBottom: 3 }}>VALOR UNIT.</div>
                        <input style={{ ...locked ? inpDisabled : inp, padding: '6px 8px', fontSize: 12 }} disabled={locked} type="number" min="0" step="0.01" value={it.valor_unitario ?? ''} onChange={e => setItem(it.id, 'valor_unitario', e.target.value)} placeholder="0,00" />
                      </div>
                      <div>
                        <div style={{ fontSize: 10, color: '#334155', fontWeight: 600, marginBottom: 3 }}>FORNECEDOR SUGERIDO</div>
                        <input style={{ ...locked ? inpDisabled : inp, padding: '6px 8px', fontSize: 12 }} disabled={locked} value={it.fornecedor_sugerido ?? ''} onChange={e => setItem(it.id, 'fornecedor_sugerido', e.target.value)} placeholder="Opcional" />
                      </div>
                      <button onClick={() => removeItem(it.id)} style={{ background: 'none', border: 'none', color: '#475569', fontSize: 18, cursor: 'pointer', padding: 0, alignSelf: 'flex-end', marginBottom: 2 }}>×</button>
                    </div>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10, paddingTop: 10, borderTop: '1px solid #1E2235' }}>
                  <div style={{ fontSize: 13, color: '#64748B' }}>
                    Total estimado: <span style={{ fontWeight: 700, color: '#F1F5F9', marginLeft: 6 }}>
                      {total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Observações */}
              <div style={{ marginBottom: 16 }}>
                <label style={lbl}>Observações</label>
                <textarea style={{ ...(locked ? inpDisabled : inp), resize: 'vertical', minHeight: 72 }} disabled={locked} value={form.observacoes} onChange={e => setF('observacoes', e.target.value)} placeholder="Informações adicionais, local de entrega, etc." />
              </div>

              {/* Motivo rejeição */}
              {(form.status === 'rejeitada' || showReject) && (
                <div style={{ marginBottom: 16 }}>
                  <label style={{ ...lbl, color: '#EF4444' }}>Motivo da rejeição</label>
                  <textarea style={{ ...inp, borderColor: '#EF444440', resize: 'vertical', minHeight: 56 }} value={form.motivo_rejeicao} onChange={e => setF('motivo_rejeicao', e.target.value)} placeholder="Explique o motivo..." />
                </div>
              )}
                </>
              )}
            </>
          )}

          {/* ABA HISTÓRICO */}
          {aba === 'historico' && (
            <div>
              {loadingHist ? (
                <div style={{ color: '#334155', fontSize: 13, padding: '20px 0' }}>Carregando...</div>
              ) : historico.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#334155', fontSize: 13 }}>
                  Nenhum registro de alteração ainda.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {historico.map((h, i) => {
                    const meta = ACAO_META[h.acao] ?? { label: h.acao, color: '#64748B', icon: '•' }
                    return (
                      <div key={h.id} style={{ display: 'flex', gap: 14, paddingBottom: 16 }}>
                        {/* Timeline dot */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                          <div style={{
                            width: 28, height: 28, borderRadius: '50%',
                            background: meta.color + '22', border: `1.5px solid ${meta.color}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 12, color: meta.color,
                          }}>{meta.icon}</div>
                          {i < historico.length - 1 && (
                            <div style={{ width: 1, flex: 1, background: '#1E2235', marginTop: 4 }} />
                          )}
                        </div>
                        {/* Content */}
                        <div style={{ flex: 1, paddingTop: 4 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: meta.color }}>{meta.label}</span>
                            <span style={{ fontSize: 11, color: '#334155' }}>
                              {new Date(h.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <div style={{ fontSize: 12, color: '#64748B' }}>por <strong style={{ color: '#94A3B8' }}>{h.usuario_nome}</strong></div>
                          {h.descricao && <div style={{ fontSize: 12, color: '#475569', marginTop: 4, fontStyle: 'italic' }}>{h.descricao}</div>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {importToast && (
          <div style={{position:'fixed',bottom:80,right:24,background:importToast.type==='loading'?'#1E3A5F':'#064E3B',border:`1px solid ${importToast.type==='loading'?'#3B82F6':'#065F46'}`,color:importToast.type==='loading'?'#93C5FD':'#6EE7B7',padding:'10px 18px',borderRadius:10,fontSize:13,fontWeight:600,zIndex:2001}}>
            {importToast.type==='loading'?'⏳':''} {importToast.msg}
          </div>
        )}

        {/* Footer */}
        <div style={{
          padding: '14px 24px', borderTop: '1px solid #1E2235',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          flexShrink: 0, flexWrap: 'wrap', gap: 8,
        }}>
          <div style={{ display: 'flex', gap: 8 }}>
            {!isNew && (
              <button onClick={() => onDelete(solicitacao.id)} style={{ padding: '7px 14px', borderRadius: 7, border: '1px solid #7F1D1D', background: 'transparent', color: '#FCA5A5', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>
                🗑 Excluir
              </button>
            )}
            {solicitacao?.status === 'rejeitada' && (
              <button onClick={() => onDuplicate(solicitacao)} style={{ padding: '7px 14px', borderRadius: 7, border: '1px solid #1E3A5F', background: 'transparent', color: '#93C5FD', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>
                ⎘ Duplicar e corrigir
              </button>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {form.status === 'pendente' && !isNew && (
              <>
                <button onClick={() => handleSave('aprovada')} style={{ padding: '7px 14px', borderRadius: 7, border: 'none', background: '#1E3A5F', color: '#93C5FD', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>✓ Aprovar</button>
                <button onClick={() => setShowReject(r => !r)} style={{ padding: '7px 14px', borderRadius: 7, border: '1px solid #991B1B', background: 'transparent', color: '#FCA5A5', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>✕ Rejeitar</button>
              </>
            )}
            {form.status === 'aprovada' && (
              <button onClick={() => handleSave('em_pedido')} style={{ padding: '7px 14px', borderRadius: 7, border: 'none', background: '#2E1065', color: '#C4B5FD', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>📦 Marcar como pedido</button>
            )}
            {form.status === 'em_pedido' && (
              <button onClick={() => handleSave('recebido')} style={{ padding: '7px 14px', borderRadius: 7, border: 'none', background: '#064E3B', color: '#6EE7B7', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>✓ Marcar como recebido</button>
            )}
            <button onClick={onClose} style={{ padding: '8px 18px', borderRadius: 7, border: '1px solid #1E2235', background: 'transparent', color: '#64748B', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
            {!locked && (
              <button onClick={() => showReject ? handleSave('rejeitada') : handleSave()} style={{
                padding: '8px 18px', borderRadius: 7, border: 'none',
                background: showReject ? '#7F1D1D' : 'linear-gradient(135deg, #3B82F6, #6366F1)',
                color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer',
              }}>{isNew ? 'Enviar solicitação' : showReject ? 'Confirmar rejeição' : 'Salvar'}</button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
