import { useState, useEffect } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabase'

const CATEGORIAS = ['Geral','Porcelanato','Instalações','Vinílico','Esquadrias','Gesso','Pintura','Acabamento','Fundação','Estrutura','Alvenaria','Cobertura','Hidráulica','Elétrica','Ar Condicionado']

const STATUS_META = {
  rascunho:  { label: 'Rascunho',  color: '#64748B', bg: '#1E2235' },
  enviada:   { label: 'Enviada',   color: '#F59E0B', bg: '#451A03' },
  aprovada:  { label: 'Aprovada',  color: '#10B981', bg: '#064E3B' },
  rejeitada: { label: 'Rejeitada', color: '#EF4444', bg: '#450A0A' },
}

function fmtBRL(v) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function fmtMes(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}

const inp = {
  width: '100%', padding: '8px 12px', borderRadius: 7,
  background: '#0F1117', border: '1px solid #1E2235',
  color: '#F1F5F9', fontSize: 13, outline: 'none', fontFamily: 'inherit',
}
const lbl = { fontSize: 11, fontWeight: 600, color: '#64748B', marginBottom: 5, display: 'block' }

// ── Orçamento ─────────────────────────────────────────────────────────────
function Orcamento({ obra }) {
  const [itens,   setItens]   = useState([])
  const [loading, setLoading] = useState(true)
  const [toast,   setToast]   = useState(null)

  useEffect(() => { fetchItens() }, [obra.id])

  async function fetchItens() {
    const { data } = await supabase.from('orcamento_itens').select('*')
      .eq('obra_id', obra.id).order('ordem')
    setItens(data ?? [])
    setLoading(false)
  }

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(null), 3000) }

  function newRow() {
    return { _tmp: Date.now(), obra_id: obra.id, descricao: '', categoria: 'Geral', unidade: 'un', quantidade: 1, valor_unit: 0, isNew: true }
  }

  const [rows, setRows] = useState([])
  useEffect(() => { setRows(itens.map(i => ({ ...i, isNew: false }))) }, [itens])

  function setRow(idx, k, v) { setRows(rs => rs.map((r, i) => i === idx ? { ...r, [k]: v } : r)) }
  function addRow() { setRows(rs => [...rs, newRow()]) }
  async function removeRow(idx) {
    const r = rows[idx]
    if (!r.isNew) await supabase.from('orcamento_itens').delete().eq('id', r.id)
    setRows(rs => rs.filter((_, i) => i !== idx))
  }

  async function saveAll() {
    for (const r of rows) {
      const payload = { obra_id: obra.id, descricao: r.descricao, categoria: r.categoria, unidade: r.unidade, quantidade: Number(r.quantidade), valor_unit: Number(r.valor_unit), ordem: rows.indexOf(r) }
      if (r.isNew) {
        if (r.descricao.trim()) await supabase.from('orcamento_itens').insert(payload)
      } else {
        await supabase.from('orcamento_itens').update(payload).eq('id', r.id)
      }
    }
    await fetchItens()
    showToast('Orçamento salvo!')
  }

  async function handleImport(e) {
    const file = e.target.files[0]; if (!file) return
    const buf = await file.arrayBuffer()
    const wb  = XLSX.read(buf, { cellDates: true })
    const ws  = wb.Sheets[wb.SheetNames[0]]
    const data = XLSX.utils.sheet_to_json(ws, { raw: false, dateNF: 'yyyy-mm-dd' })
    const toInsert = data
      .filter(r => r['Descrição'] || r['Descricao'] || r['descricao'])
      .map((r, idx) => ({
        obra_id: obra.id,
        descricao:  r['Descrição'] || r['Descricao'] || r['descricao'] || '',
        categoria:  r['Categoria'] || r['categoria'] || 'Geral',
        unidade:    r['Unidade']   || r['unidade']   || 'un',
        quantidade: Number(r['Quantidade'] || r['quantidade'] || 1),
        valor_unit: Number(String(r['Valor Unit'] || r['Valor Unitário'] || r['valor_unit'] || 0).replace(/[^0-9.,]/g,'').replace(',','.')),
        ordem: idx,
      }))
    if (toInsert.length) {
      await supabase.from('orcamento_itens').insert(toInsert)
      await fetchItens()
      showToast(`${toInsert.length} itens importados!`)
    } else {
      showToast('Nenhum item encontrado.')
    }
    e.target.value = ''
  }

  function handleExport() {
    const data = rows.map(r => ({
      'Descrição': r.descricao, 'Categoria': r.categoria, 'Unidade': r.unidade,
      'Quantidade': r.quantidade, 'Valor Unit': r.valor_unit,
      'Total': (Number(r.quantidade) * Number(r.valor_unit)).toFixed(2),
    }))
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Orçamento')
    XLSX.writeFile(wb, `Orcamento_${obra.nome.replace(/\s+/g,'_')}.xlsx`)
  }

  const total = rows.reduce((acc, r) => acc + Number(r.quantidade || 0) * Number(r.valor_unit || 0), 0)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#F1F5F9' }}>Orçamento Base</div>
          <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>Serviços e valores previstos para a obra</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <label style={{ padding: '7px 14px', borderRadius: 7, border: '1px solid #1E2235', background: 'transparent', color: '#94A3B8', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            ↑ Importar Excel
            <input type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleImport} />
          </label>
          <button onClick={handleExport} style={{ padding: '7px 14px', borderRadius: 7, border: '1px solid #1E2235', background: 'transparent', color: '#94A3B8', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>↓ Exportar</button>
          <button onClick={addRow} style={{ padding: '7px 14px', borderRadius: 7, border: '1px solid #1E3A5F', background: 'transparent', color: '#3B82F6', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>+ Adicionar item</button>
          <button onClick={saveAll} style={{ padding: '7px 16px', borderRadius: 7, border: 'none', background: 'linear-gradient(135deg, #3B82F6, #6366F1)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Salvar tudo</button>
        </div>
      </div>

      {/* Total */}
      <div style={{ background: '#1E3A5F', borderRadius: 10, padding: '12px 18px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13, color: '#93C5FD' }}>Total orçado</span>
        <span style={{ fontSize: 20, fontWeight: 700, color: '#F1F5F9' }}>{fmtBRL(total)}</span>
      </div>

      {/* Table header */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 60px 80px 100px 80px 28px', gap: 8, padding: '0 4px', marginBottom: 6 }}>
        {['Descrição','Categoria','Un.','Qtde','Valor Unit.','Total',''].map((h,i) => (
          <div key={i} style={{ fontSize: 10, fontWeight: 700, color: '#334155', textTransform: 'uppercase' }}>{h}</div>
        ))}
      </div>

      {loading ? <div style={{ color: '#334155', fontSize: 13, padding: '20px 0' }}>Carregando...</div> : rows.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#334155', fontSize: 13 }}>
          Nenhum item. Adicione manualmente ou importe uma planilha.
        </div>
      ) : rows.map((r, idx) => (
        <div key={r.id || r._tmp} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 60px 80px 100px 80px 28px', gap: 8, marginBottom: 6 }}>
          <input style={{ ...inp, padding: '7px 10px' }} value={r.descricao} onChange={e => setRow(idx, 'descricao', e.target.value)} placeholder="Descrição do serviço" />
          <select style={{ ...inp, padding: '7px 8px' }} value={r.categoria} onChange={e => setRow(idx, 'categoria', e.target.value)}>
            {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <input style={{ ...inp, padding: '7px 6px' }} value={r.unidade} onChange={e => setRow(idx, 'unidade', e.target.value)} placeholder="un" />
          <input style={{ ...inp, padding: '7px 6px' }} type="number" min="0" value={r.quantidade} onChange={e => setRow(idx, 'quantidade', e.target.value)} />
          <input style={{ ...inp, padding: '7px 6px' }} type="number" min="0" step="0.01" value={r.valor_unit} onChange={e => setRow(idx, 'valor_unit', e.target.value)} placeholder="0,00" />
          <div style={{ display: 'flex', alignItems: 'center', fontSize: 12, fontWeight: 600, color: '#10B981' }}>
            {fmtBRL(Number(r.quantidade || 0) * Number(r.valor_unit || 0))}
          </div>
          <button onClick={() => removeRow(idx)} style={{ background: 'none', border: 'none', color: '#475569', fontSize: 16, cursor: 'pointer', alignSelf: 'center' }}>×</button>
        </div>
      ))}

      {toast && <div style={{ position: 'fixed', bottom: 24, right: 24, background: '#064E3B', border: '1px solid #065F46', color: '#6EE7B7', padding: '10px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600, zIndex: 2000 }}>{toast}</div>}
    </div>
  )
}

// ── Medições ──────────────────────────────────────────────────────────────
function Medicoes({ obra }) {
  const [medicoes,  setMedicoes]  = useState([])
  const [orcItens,  setOrcItens]  = useState([])
  const [selected,  setSelected]  = useState(null) // medição aberta
  const [medItens,  setMedItens]  = useState([])
  const [loading,   setLoading]   = useState(true)
  const [toast,     setToast]     = useState(null)
  const [novaMed,   setNovaMed]   = useState(false)
  const [novoMes,   setNovoMes]   = useState('')

  useEffect(() => { init() }, [obra.id])

  async function init() {
    const [{ data: meds }, { data: orc }] = await Promise.all([
      supabase.from('medicoes').select('*').eq('obra_id', obra.id).order('numero', { ascending: false }),
      supabase.from('orcamento_itens').select('*').eq('obra_id', obra.id).order('ordem'),
    ])
    setMedicoes(meds ?? [])
    setOrcItens(orc ?? [])
    setLoading(false)
  }

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(null), 3000) }

  async function criarMedicao() {
    if (!novoMes) return
    const num = (medicoes[0]?.numero ?? 0) + 1
    const { data } = await supabase.from('medicoes').insert({
      obra_id: obra.id, numero: num,
      mes_ref: novoMes + '-01', status: 'rascunho',
    }).select().single()
    // Pré-popula com itens do orçamento
    if (data && orcItens.length) {
      await supabase.from('medicao_itens').insert(
        orcItens.map(o => ({
          medicao_id: data.id, orcamento_item_id: o.id,
          descricao: o.descricao, categoria: o.categoria,
          qtd_prevista: o.quantidade, qtd_medida: 0, valor_unit: o.valor_unit,
        }))
      )
    }
    setNovaMed(false); setNovoMes('')
    await init()
    showToast(`Medição ${num} criada!`)
  }

  async function abrirMedicao(med) {
    const { data } = await supabase.from('medicao_itens').select('*').eq('medicao_id', med.id).order('created_at')
    setSelected(med)
    setMedItens(data ?? [])
  }

  function setMedItem(idx, k, v) { setMedItens(its => its.map((it, i) => i === idx ? { ...it, [k]: v } : it)) }

  async function saveMedicao() {
    for (const it of medItens) {
      await supabase.from('medicao_itens').update({ qtd_medida: Number(it.qtd_medida) }).eq('id', it.id)
    }
    showToast('Medição salva!')
  }

  async function enviarMedicao() {
    await saveMedicao()
    await supabase.from('medicoes').update({ status: 'enviada' }).eq('id', selected.id)
    setSelected(s => ({ ...s, status: 'enviada' }))
    setMedicoes(ms => ms.map(m => m.id === selected.id ? { ...m, status: 'enviada' } : m))
    showToast('Medição enviada para aprovação!')
  }

  async function aprovarMedicao(id) {
    await supabase.from('medicoes').update({ status: 'aprovada' }).eq('id', id)
    setMedicoes(ms => ms.map(m => m.id === id ? { ...m, status: 'aprovada' } : m))
    if (selected?.id === id) setSelected(s => ({ ...s, status: 'aprovada' }))
    showToast('Medição aprovada!')
  }

  async function rejeitarMedicao(id) {
    await supabase.from('medicoes').update({ status: 'rejeitada' }).eq('id', id)
    setMedicoes(ms => ms.map(m => m.id === id ? { ...m, status: 'rejeitada' } : m))
    if (selected?.id === id) setSelected(s => ({ ...s, status: 'rejeitada' }))
    showToast('Medição rejeitada.')
  }

  const totalMedido = medItens.reduce((acc, it) => acc + Number(it.qtd_medida || 0) * Number(it.valor_unit || 0), 0)
  const totalPrevisto = medItens.reduce((acc, it) => acc + Number(it.qtd_prevista || 0) * Number(it.valor_unit || 0), 0)

  if (selected) return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button onClick={() => setSelected(null)} style={{ background: 'none', border: '1px solid #1E2235', borderRadius: 7, color: '#64748B', fontSize: 13, cursor: 'pointer', padding: '5px 10px' }}>← Voltar</button>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: '#F1F5F9' }}>Medição {selected.numero} — {fmtMes(selected.mes_ref?.slice(0,7))}</span>
            <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: STATUS_META[selected.status]?.bg, color: STATUS_META[selected.status]?.color }}>{STATUS_META[selected.status]?.label}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {selected.status === 'rascunho' && <button onClick={enviarMedicao} style={{ padding: '7px 16px', borderRadius: 7, border: 'none', background: '#1E3A5F', color: '#93C5FD', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>Enviar para aprovação</button>}
          {selected.status === 'enviada'  && <button onClick={() => aprovarMedicao(selected.id)} style={{ padding: '7px 16px', borderRadius: 7, border: 'none', background: '#064E3B', color: '#6EE7B7', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>✓ Aprovar</button>}
          {selected.status === 'enviada'  && <button onClick={() => rejeitarMedicao(selected.id)} style={{ padding: '7px 16px', borderRadius: 7, border: '1px solid #991B1B', background: 'transparent', color: '#FCA5A5', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>✕ Rejeitar</button>}
          {selected.status === 'rascunho' && <button onClick={saveMedicao} style={{ padding: '7px 16px', borderRadius: 7, border: 'none', background: 'linear-gradient(135deg, #3B82F6, #6366F1)', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Salvar</button>}
        </div>
      </div>

      {/* Totais */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        {[
          { label: 'Previsto na medição', value: fmtBRL(totalPrevisto), color: '#3B82F6' },
          { label: 'Medido',              value: fmtBRL(totalMedido),   color: '#10B981' },
          { label: '% Execução',          value: totalPrevisto > 0 ? `${((totalMedido/totalPrevisto)*100).toFixed(1)}%` : '—', color: '#F59E0B' },
        ].map(s => (
          <div key={s.label} style={{ flex: 1, background: '#1A1D2E', border: '1px solid #1E2235', borderRadius: 10, padding: '12px 16px' }}>
            <div style={{ fontSize: 11, color: '#475569', marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Itens */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 80px 80px 100px 100px', gap: 8, padding: '0 4px', marginBottom: 6 }}>
        {['Descrição','Categoria','Qtde Prev.','Qtde Med.','Valor Unit.','Total Medido'].map((h,i) => (
          <div key={i} style={{ fontSize: 10, fontWeight: 700, color: '#334155', textTransform: 'uppercase' }}>{h}</div>
        ))}
      </div>
      {medItens.map((it, idx) => (
        <div key={it.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 80px 80px 100px 100px', gap: 8, marginBottom: 6 }}>
          <div style={{ padding: '7px 10px', fontSize: 13, color: '#94A3B8', background: '#0F1117', borderRadius: 7, border: '1px solid #1E2235' }}>{it.descricao}</div>
          <div style={{ padding: '7px 8px', fontSize: 12, color: '#64748B', background: '#0F1117', borderRadius: 7, border: '1px solid #1E2235' }}>{it.categoria}</div>
          <div style={{ padding: '7px 8px', fontSize: 13, color: '#64748B', background: '#0F1117', borderRadius: 7, border: '1px solid #1E2235', textAlign: 'right' }}>{it.qtd_prevista}</div>
          <input
            style={{ ...inp, padding: '7px 8px', textAlign: 'right', background: selected.status === 'rascunho' ? '#0F1117' : '#0A0D14' }}
            type="number" min="0" step="0.01"
            value={it.qtd_medida}
            disabled={selected.status !== 'rascunho'}
            onChange={e => setMedItem(idx, 'qtd_medida', e.target.value)}
          />
          <div style={{ padding: '7px 8px', fontSize: 13, color: '#64748B', background: '#0F1117', borderRadius: 7, border: '1px solid #1E2235', textAlign: 'right' }}>{fmtBRL(it.valor_unit)}</div>
          <div style={{ padding: '7px 8px', fontSize: 12, fontWeight: 700, color: '#10B981', background: '#0F1117', borderRadius: 7, border: '1px solid #1E2235', textAlign: 'right' }}>
            {fmtBRL(Number(it.qtd_medida || 0) * Number(it.valor_unit || 0))}
          </div>
        </div>
      ))}

      {toast && <div style={{ position: 'fixed', bottom: 24, right: 24, background: '#064E3B', border: '1px solid #065F46', color: '#6EE7B7', padding: '10px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600, zIndex: 2000 }}>{toast}</div>}
    </div>
  )

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#F1F5F9' }}>Medições</div>
          <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>Registro mensal de produção</div>
        </div>
        <button onClick={() => setNovaMed(true)} style={{ padding: '7px 16px', borderRadius: 7, border: 'none', background: 'linear-gradient(135deg, #3B82F6, #6366F1)', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>+ Nova Medição</button>
      </div>

      {/* Nova medição form */}
      {novaMed && (
        <div style={{ background: '#1A1D2E', border: '1px solid #1E3A5F', borderRadius: 10, padding: '16px', marginBottom: 16, display: 'flex', gap: 12, alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <label style={lbl}>Mês de referência</label>
            <input style={inp} type="month" value={novoMes} onChange={e => setNovoMes(e.target.value)} />
          </div>
          <button onClick={criarMedicao} style={{ padding: '8px 18px', borderRadius: 7, border: 'none', background: '#3B82F6', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Criar</button>
          <button onClick={() => setNovaMed(false)} style={{ padding: '8px 14px', borderRadius: 7, border: '1px solid #1E2235', background: 'transparent', color: '#64748B', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
        </div>
      )}

      {loading ? <div style={{ color: '#334155', fontSize: 13, padding: '20px 0' }}>Carregando...</div>
      : medicoes.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#334155', fontSize: 13 }}>
          Nenhuma medição ainda. Clique em "+ Nova Medição" para começar.
        </div>
      ) : medicoes.map(m => {
        const meta = STATUS_META[m.status]
        return (
          <div key={m.id} onClick={() => abrirMedicao(m)} style={{
            background: '#1A1D2E', border: '1px solid #1E2235', borderRadius: 10,
            padding: '14px 18px', marginBottom: 8, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 16,
            transition: 'border-color 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.borderColor = '#334155'}
          onMouseLeave={e => e.currentTarget.style.borderColor = '#1E2235'}
          >
            <div style={{ width: 40, height: 40, borderRadius: 8, background: '#1E3A5F', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#93C5FD', flexShrink: 0 }}>
              {m.numero}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#F1F5F9' }}>Medição {m.numero}</div>
              <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>{fmtMes(m.mes_ref?.slice(0,7))}</div>
            </div>
            <span style={{ padding: '3px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: meta.bg, color: meta.color }}>{meta.label}</span>
            {m.status === 'enviada' && (
              <div style={{ display: 'flex', gap: 6 }} onClick={e => e.stopPropagation()}>
                <button onClick={() => aprovarMedicao(m.id)} style={{ padding: '5px 12px', borderRadius: 6, border: 'none', background: '#064E3B', color: '#6EE7B7', fontWeight: 600, fontSize: 11, cursor: 'pointer' }}>✓ Aprovar</button>
                <button onClick={() => rejeitarMedicao(m.id)} style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid #991B1B', background: 'transparent', color: '#FCA5A5', fontWeight: 600, fontSize: 11, cursor: 'pointer' }}>✕ Rejeitar</button>
              </div>
            )}
            <div style={{ fontSize: 16, color: '#334155' }}>›</div>
          </div>
        )
      })}
      {toast && <div style={{ position: 'fixed', bottom: 24, right: 24, background: '#064E3B', border: '1px solid #065F46', color: '#6EE7B7', padding: '10px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600, zIndex: 2000 }}>{toast}</div>}
    </div>
  )
}

// ── Painel resumo ─────────────────────────────────────────────────────────
function Painel({ obra }) {
  const [orcTotal,  setOrcTotal]  = useState(0)
  const [medTotal,  setMedTotal]  = useState(0)
  const [medCount,  setMedCount]  = useState(0)
  const [loading,   setLoading]   = useState(true)

  useEffect(() => {
    async function load() {
      const [{ data: orc }, { data: meds }] = await Promise.all([
        supabase.from('orcamento_itens').select('quantidade,valor_unit').eq('obra_id', obra.id),
        supabase.from('medicoes').select('id,status').eq('obra_id', obra.id),
      ])
      const total = (orc ?? []).reduce((acc, r) => acc + Number(r.quantidade)*Number(r.valor_unit), 0)
      setOrcTotal(total)
      setMedCount((meds ?? []).length)
      // Soma medições aprovadas
      const aprovadas = (meds ?? []).filter(m => m.status === 'aprovada')
      if (aprovadas.length) {
        const ids = aprovadas.map(m => `"${m.id}"`).join(',')
        const { data: mitens } = await supabase.from('medicao_itens').select('qtd_medida,valor_unit').in('medicao_id', aprovadas.map(m => m.id))
        const medido = (mitens ?? []).reduce((acc, it) => acc + Number(it.qtd_medida)*Number(it.valor_unit), 0)
        setMedTotal(medido)
      }
      setLoading(false)
    }
    load()
  }, [obra.id])

  const pct = orcTotal > 0 ? Math.min(100, (medTotal / orcTotal) * 100) : 0

  if (loading) return <div style={{ color: '#334155', fontSize: 13 }}>Carregando...</div>

  return (
    <div>
      <div style={{ fontSize: 16, fontWeight: 700, color: '#F1F5F9', marginBottom: 16 }}>Painel Financeiro</div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        {[
          { label: 'Orçamento total',    value: fmtBRL(orcTotal),  color: '#3B82F6', icon: '📋' },
          { label: 'Medido (aprovado)',  value: fmtBRL(medTotal),  color: '#10B981', icon: '✅' },
          { label: 'Saldo restante',     value: fmtBRL(orcTotal - medTotal), color: '#F59E0B', icon: '💰' },
          { label: 'Total de medições',  value: medCount,           color: '#8B5CF6', icon: '📊' },
        ].map(s => (
          <div key={s.label} style={{ flex: 1, minWidth: 160, background: '#1A1D2E', border: '1px solid #1E2235', borderRadius: 12, padding: '16px' }}>
            <div style={{ fontSize: 20, marginBottom: 8 }}>{s.icon}</div>
            <div style={{ fontSize: 11, color: '#475569', marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Barra progresso financeiro */}
      <div style={{ background: '#1A1D2E', border: '1px solid #1E2235', borderRadius: 12, padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#94A3B8' }}>Execução financeira</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#10B981' }}>{pct.toFixed(1)}%</span>
        </div>
        <div style={{ height: 12, background: '#0F1117', borderRadius: 6, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg, #3B82F6, #10B981)', borderRadius: 6, transition: 'width 0.5s ease' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
          <span style={{ fontSize: 11, color: '#334155' }}>R$ 0</span>
          <span style={{ fontSize: 11, color: '#334155' }}>{fmtBRL(orcTotal)}</span>
        </div>
      </div>
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────
const STATUS_OBRA = {
  em_andamento: { label: 'Em andamento', color: '#10B981', bg: '#064E3B' },
  pausada:      { label: 'Pausada',      color: '#F59E0B', bg: '#451A03' },
  concluida:    { label: 'Concluída',    color: '#6366F1', bg: '#1E1B4B' },
}

export default function Financeiro({ session }) {
  const [obras,  setObras]  = useState([])
  const [obra,   setObra]   = useState(null)
  const [aba,    setAba]    = useState('painel')
  const [loading,setLoading]= useState(true)

  useEffect(() => {
    supabase.from('obras').select('*').eq('owner_id', session.user.id).order('created_at', { ascending: false })
      .then(({ data }) => { setObras(data ?? []); setLoading(false) })
  }, [])

  if (!obra) return (
    <div style={{ flex: 1, padding: '28px', overflowY: 'auto', color: '#E2E8F0', fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#F1F5F9', marginBottom: 4 }}>Financeiro</h1>
        <p style={{ fontSize: 13, color: '#475569' }}>Selecione uma obra para gerenciar o financeiro.</p>
      </div>
      {loading ? <div style={{ color: '#334155' }}>Carregando...</div>
      : obras.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>💰</div>
          <p style={{ fontSize: 15, fontWeight: 600, color: '#475569' }}>Nenhuma obra cadastrada</p>
        </div>
      ) : obras.map(o => {
        const meta = STATUS_OBRA[o.status] ?? STATUS_OBRA.em_andamento
        return (
          <div key={o.id} onClick={() => setObra(o)} style={{
            background: '#1A1D2E', border: '1px solid #1E2235', borderRadius: 12,
            padding: '18px 22px', cursor: 'pointer', marginBottom: 10,
            display: 'flex', alignItems: 'center', gap: 16, transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#3B82F640'; e.currentTarget.style.background = '#1E2235' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = '#1E2235';   e.currentTarget.style.background = '#1A1D2E' }}
          >
            <div style={{ width: 48, height: 48, borderRadius: 12, background: 'linear-gradient(135deg, #064E3B, #1E3A5F)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>💰</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#F1F5F9', marginBottom: 3 }}>{o.nome}</div>
              {o.endereco && <div style={{ fontSize: 12, color: '#475569' }}>{o.endereco}</div>}
            </div>
            <span style={{ padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: meta.bg, color: meta.color }}>{meta.label}</span>
            <div style={{ fontSize: 20, color: '#334155' }}>›</div>
          </div>
        )
      })}
    </div>
  )

  const ABAS = [
    { id: 'painel',   label: '📊 Painel'    },
    { id: 'orcamento',label: '📋 Orçamento' },
    { id: 'medicoes', label: '📐 Medições'  },
  ]

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: "'DM Sans', sans-serif" }}>
      {/* Header */}
      <div style={{ background: '#1A1D2E', borderBottom: '1px solid #1E2235', padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <button onClick={() => setObra(null)} style={{ background: 'none', border: '1px solid #1E2235', borderRadius: 7, color: '#64748B', fontSize: 13, cursor: 'pointer', padding: '5px 10px' }}>← Voltar</button>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#F1F5F9' }}>{obra.nome}</div>
        <div style={{ fontSize: 12, color: '#475569' }}>Financeiro</div>
      </div>

      {/* Abas */}
      <div style={{ display: 'flex', gap: 4, padding: '12px 24px', borderBottom: '1px solid #1E2235', flexShrink: 0 }}>
        {ABAS.map(a => (
          <button key={a.id} onClick={() => setAba(a.id)} style={{
            padding: '7px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
            background: aba === a.id ? '#1E3A5F' : 'transparent',
            color: aba === a.id ? '#93C5FD' : '#475569',
          }}>{a.label}</button>
        ))}
      </div>

      {/* Conteúdo */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
        {aba === 'painel'    && <Painel    obra={obra} />}
        {aba === 'orcamento' && <Orcamento obra={obra} />}
        {aba === 'medicoes'  && <Medicoes  obra={obra} />}
      </div>
    </div>
  )
}
