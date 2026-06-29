import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import * as XLSX from 'xlsx'

function fmtBRL(v) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const STATUS_META = {
  pendente:   { label: 'Pendente',        color: '#F59E0B', bg: '#451A03' },
  aprovada:   { label: 'Aprovada',        color: '#10B981', bg: '#064E3B' },
  rejeitada:  { label: 'Rejeitada',       color: '#EF4444', bg: '#450A0A' },
  em_pedido:  { label: 'Pedido Realizado', color: '#8B5CF6', bg: '#2E1065' },
  recebido:   { label: 'Recebido',        color: '#06B6D4', bg: '#164E63' },
}

const URGENCIA_META = {
  critica: { label: 'Critica', color: '#EF4444' },
  alta:    { label: 'Alta',    color: '#F59E0B' },
  normal:  { label: 'Normal',  color: '#3B82F6' },
  baixa:   { label: 'Baixa',   color: '#64748B' },
}

export default function RelatorioCompras({ session }) {
  const [scs,     setScs]     = useState([])
  const [obras,   setObras]   = useState([])
  const [loading, setLoading] = useState(false)
  const [filtros, setFiltros] = useState({
    obra_id:    'all',
    status:     'all',
    gestao:     'all',
    data_ini:   '',
    data_fim:   '',
  })
  const printRef = useRef(null)

  useEffect(() => { loadObras() }, [])

  async function loadObras() {
    const { data } = await supabase.from('obras').select('id, nome').order('nome')
    setObras(data ?? [])
  }

  async function buscar() {
    setLoading(true)
    let q = supabase
      .from('solicitacoes_compra')
      .select(`
        id, titulo, status, urgencia, gestao,
        solicitante_nome, created_at, prazo_entrega,
        obra:obras(nome),
        itens:itens_solicitacao(id, descricao, unidade, quantidade, valor_unitario)
      `)
      .order('created_at', { ascending: false })

    if (filtros.obra_id !== 'all') q = q.eq('obra_id', filtros.obra_id)
    if (filtros.status   !== 'all') q = q.eq('status',   filtros.status)
    if (filtros.gestao   !== 'all') q = q.eq('gestao',   filtros.gestao)
    if (filtros.data_ini) q = q.gte('created_at', filtros.data_ini)
    if (filtros.data_fim) q = q.lte('created_at', filtros.data_fim + 'T23:59:59')

    const { data } = await q
    setScs(data ?? [])
    setLoading(false)
  }

  function totalSC(sc) {
    return (sc.itens ?? []).reduce((acc, it) =>
      acc + (parseFloat(it.valor_unitario) || 0) * (parseFloat(it.quantidade) || 0), 0)
  }

  const totalGeral = scs.reduce((acc, sc) => acc + totalSC(sc), 0)
  const totalItens = scs.reduce((acc, sc) => acc + (sc.itens?.length ?? 0), 0)

  // ── Exportar Excel ────────────────────────────────────────────────────────
  function exportarExcel() {
    const rows = []
    scs.forEach(sc => {
      if (sc.itens?.length) {
        sc.itens.forEach(it => {
          rows.push({
            'SC':             sc.titulo,
            'Obra':           sc.obra?.nome ?? '—',
            'Gestão':         sc.gestao === 'GA' ? 'Gestão Administrativa' : sc.gestao === 'GE' ? 'Gestão Executiva' : '—',
            'Status':         STATUS_META[sc.status]?.label ?? sc.status,
            'Urgência':       URGENCIA_META[sc.urgencia]?.label ?? sc.urgencia,
            'Solicitante':    sc.solicitante_nome,
            'Data':           fmtDate(sc.created_at),
            'Prazo':          fmtDate(sc.prazo_entrega),
            'Item':           it.descricao,
            'Unidade':        it.unidade,
            'Quantidade':     parseFloat(it.quantidade) || 0,
            'Valor Unit.':    parseFloat(it.valor_unitario) || 0,
            'Total Item':     (parseFloat(it.valor_unitario) || 0) * (parseFloat(it.quantidade) || 0),
          })
        })
      } else {
        rows.push({
          'SC':          sc.titulo,
          'Obra':        sc.obra?.nome ?? '—',
          'Gestão':      sc.gestao === 'GA' ? 'Gestão Administrativa' : sc.gestao === 'GE' ? 'Gestão Executiva' : '—',
          'Status':      STATUS_META[sc.status]?.label ?? sc.status,
          'Urgência':    URGENCIA_META[sc.urgencia]?.label ?? sc.urgencia,
          'Solicitante': sc.solicitante_nome,
          'Data':        fmtDate(sc.created_at),
          'Prazo':       fmtDate(sc.prazo_entrega),
          'Item': '—', 'Unidade': '—', 'Quantidade': 0, 'Valor Unit.': 0, 'Total Item': 0,
        })
      }
    })

    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Compras')
    XLSX.writeFile(wb, `Relatorio_Compras_${new Date().toISOString().slice(0,10)}.xlsx`)
  }

  // ── Imprimir / PDF ────────────────────────────────────────────────────────
  function imprimir() {
    const conteudo = printRef.current?.innerHTML
    if (!conteudo) return
    const win = window.open('', '_blank')
    win.document.write(`
      <html><head><title>Relatório de Compras</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 12px; color: #1a1a1a; padding: 20px; }
        h1 { font-size: 18px; margin-bottom: 4px; }
        .sub { color: #666; font-size: 11px; margin-bottom: 20px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        th { background: #1a1d2e; color: #fff; padding: 8px 10px; text-align: left; font-size: 11px; }
        td { padding: 7px 10px; border-bottom: 1px solid #e2e8f0; font-size: 11px; }
        tr:nth-child(even) { background: #f8fafc; }
        .badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 10px; font-weight: 600; }
        .total { background: #f1f5f9; padding: 12px 16px; border-radius: 8px; margin-top: 16px; font-weight: 600; }
        @media print { body { padding: 0 } }
      </style></head><body>${conteudo}</body></html>
    `)
    win.document.close()
    win.focus()
    setTimeout(() => win.print(), 300)
  }

  const selStyle = {
    padding: '7px 12px', borderRadius: 7, border: '1px solid #1E2235',
    background: '#0F1117', color: '#94A3B8', fontSize: 12, outline: 'none', cursor: 'pointer',
  }
  const inpStyle = {
    padding: '7px 12px', borderRadius: 7, border: '1px solid #1E2235',
    background: '#0F1117', color: '#F1F5F9', fontSize: 12, outline: 'none',
  }

  return (
    <div style={{ flex: 1, padding: '28px', overflowY: 'auto', color: '#E2E8F0', fontFamily: "'DM Sans', sans-serif" }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#F1F5F9', marginBottom: 4 }}>Relatório de Compras</h1>
          <p style={{ fontSize: 13, color: '#475569' }}>Filtre e exporte solicitações por período, obra e status.</p>
        </div>
        {scs.length > 0 && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={exportarExcel} style={{ padding: '8px 16px', borderRadius: 7, border: 'none', background: '#064E3B', color: '#6EE7B7', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
              ↓ Excel
            </button>
            <button onClick={imprimir} style={{ padding: '8px 16px', borderRadius: 7, border: 'none', background: '#1E3A5F', color: '#93C5FD', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
              🖨️ PDF/Imprimir
            </button>
          </div>
        )}
      </div>

      {/* Filtros */}
      <div style={{ background: '#1A1D2E', border: '1px solid #1E2235', borderRadius: 12, padding: '18px 20px', marginBottom: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#64748B', marginBottom: 12, textTransform: 'uppercase' }}>Filtros</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <div style={{ fontSize: 11, color: '#475569', marginBottom: 4 }}>Obra</div>
            <select style={selStyle} value={filtros.obra_id} onChange={e => setFiltros(f => ({ ...f, obra_id: e.target.value }))}>
              <option value="all">Todas as obras</option>
              {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#475569', marginBottom: 4 }}>Status</div>
            <select style={selStyle} value={filtros.status} onChange={e => setFiltros(f => ({ ...f, status: e.target.value }))}>
              <option value="all">Todos</option>
              {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#475569', marginBottom: 4 }}>Gestão</div>
            <select style={selStyle} value={filtros.gestao} onChange={e => setFiltros(f => ({ ...f, gestao: e.target.value }))}>
              <option value="all">Todas as gestões</option>
              <option value="GA">Gestão Administrativa</option>
              <option value="GE">Gestão Executiva</option>
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#475569', marginBottom: 4 }}>Data início</div>
            <input type="date" style={inpStyle} value={filtros.data_ini} onChange={e => setFiltros(f => ({ ...f, data_ini: e.target.value }))} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#475569', marginBottom: 4 }}>Data fim</div>
            <input type="date" style={inpStyle} value={filtros.data_fim} onChange={e => setFiltros(f => ({ ...f, data_fim: e.target.value }))} />
          </div>
          <button
            onClick={buscar}
            disabled={loading}
            style={{ padding: '8px 20px', borderRadius: 7, border: 'none', background: 'linear-gradient(135deg, #3B82F6, #6366F1)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', alignSelf: 'flex-end' }}
          >
            {loading ? 'Buscando...' : 'Buscar'}
          </button>
          {scs.length > 0 && (
            <button onClick={() => { setScs([]); setFiltros({ obra_id: 'all', status: 'all', gestao: 'all', data_ini: '', data_fim: '' }) }}
              style={{ padding: '8px 14px', borderRadius: 7, border: '1px solid #334155', background: 'transparent', color: '#64748B', fontSize: 12, cursor: 'pointer', alignSelf: 'flex-end' }}>
              Limpar
            </button>
          )}
        </div>
      </div>

      {/* Resultados */}
      {scs.length === 0 && !loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#334155' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📋</div>
          <p style={{ fontSize: 14, color: '#475569', fontWeight: 600 }}>Configure os filtros e clique em Buscar</p>
        </div>
      ) : (
        <>
          {/* Totalizadores */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 20 }}>
            {[
              { label: 'Solicitações', value: scs.length, color: '#3B82F6' },
              { label: 'Itens', value: totalItens, color: '#8B5CF6' },
              { label: 'Valor Total', value: fmtBRL(totalGeral), color: '#10B981' },
              { label: 'Aprovadas', value: scs.filter(s => s.status === 'aprovada').length, color: '#10B981' },
              { label: 'Pendentes', value: scs.filter(s => s.status === 'pendente').length, color: '#F59E0B' },
            ].map(s => (
              <div key={s.label} style={{ background: '#1A1D2E', border: '1px solid #1E2235', borderRadius: 10, padding: '12px 16px' }}>
                <div style={{ fontSize: 11, color: '#475569', marginBottom: 4 }}>{s.label}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Tabela — conteúdo para impressão */}
          <div ref={printRef}>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: '#F1F5F9', marginBottom: 4 }}>Relatório de Compras</h1>
            <div style={{ fontSize: 12, color: '#475569', marginBottom: 20 }}>
              Gerado em {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
              {filtros.obra_id !== 'all' && ` · ${obras.find(o => o.id === filtros.obra_id)?.nome}`}
              {filtros.data_ini && ` · A partir de ${fmtDate(filtros.data_ini)}`}
              {filtros.data_fim && ` até ${fmtDate(filtros.data_fim)}`}
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#0D1020' }}>
                    {['Solicitação', 'Obra', 'Gestão', 'Solicitante', 'Data', 'Prazo', 'Itens', 'Total', 'Status', 'Urgência'].map(h => (
                      <th key={h} style={{ padding: '10px 12px', textAlign: 'left', color: '#475569', fontWeight: 700, fontSize: 10, textTransform: 'uppercase', borderBottom: '1px solid #1E2235', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {scs.map((sc, i) => {
                    const smeta = STATUS_META[sc.status] ?? STATUS_META.pendente
                    const umeta = URGENCIA_META[sc.urgencia] ?? URGENCIA_META.normal
                    const total = totalSC(sc)
                    const itensFilt = (sc.itens ?? []).filter(it => it.descricao?.trim())
                    return (
                      <>
                        <tr key={sc.id} style={{ background: i % 2 === 0 ? '#0F1117' : '#0D1020' }}>
                          <td style={{ padding: '10px 12px', color: '#F1F5F9', fontWeight: 600 }}>{sc.titulo}</td>
                          <td style={{ padding: '10px 12px', color: '#94A3B8' }}>{sc.obra?.nome ?? '—'}</td>
                          <td style={{ padding: '10px 12px' }}>
                            {sc.gestao && (
                              <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, background: sc.gestao === 'GA' ? '#1E3A5F' : '#064E3B', color: sc.gestao === 'GA' ? '#93C5FD' : '#6EE7B7', whiteSpace: 'nowrap' }}>
                                {sc.gestao === 'GA' ? 'Gestão Administrativa' : 'Gestão Executiva'}
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '10px 12px', color: '#64748B' }}>{sc.solicitante_nome}</td>
                          <td style={{ padding: '10px 12px', color: '#64748B', whiteSpace: 'nowrap' }}>{fmtDate(sc.created_at)}</td>
                          <td style={{ padding: '10px 12px', color: '#64748B', whiteSpace: 'nowrap' }}>{fmtDate(sc.prazo_entrega)}</td>
                          <td style={{ padding: '10px 12px', color: '#94A3B8', textAlign: 'center' }}>{sc.itens?.length ?? 0}</td>
                          <td style={{ padding: '10px 12px', color: total > 0 ? '#F1F5F9' : '#334155', textAlign: 'right', whiteSpace: 'nowrap' }}>{total > 0 ? fmtBRL(total) : '—'}</td>
                          <td style={{ padding: '10px 12px' }}>
                            <span style={{ padding: '2px 10px', borderRadius: 20, fontSize: 10, fontWeight: 600, background: smeta.bg, color: smeta.color }}>{smeta.label}</span>
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            <span style={{ fontSize: 11, fontWeight: 600, color: umeta.color }}>{umeta.label}</span>
                          </td>
                        </tr>
                        {itensFilt.length > 0 && (
                          <tr key={sc.id + '_itens'} style={{ background: i % 2 === 0 ? '#080A10' : '#0A0C14' }}>
                            <td colSpan={10} style={{ padding: '0 12px 10px 28px' }}>
                              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                                <thead>
                                  <tr>
                                    {['#', 'Descrição', 'Un.', 'Qtde', 'Valor Unit.', 'Fornecedor sugerido'].map(h => (
                                      <th key={h} style={{ padding: '4px 8px', textAlign: 'left', color: '#334155', fontWeight: 700, fontSize: 9, textTransform: 'uppercase', borderBottom: '1px solid #1E2235' }}>{h}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {itensFilt.map((it, idx) => (
                                    <tr key={it.id}>
                                      <td style={{ padding: '4px 8px', color: '#334155' }}>{idx + 1}</td>
                                      <td style={{ padding: '4px 8px', color: '#94A3B8' }}>{it.descricao}</td>
                                      <td style={{ padding: '4px 8px', color: '#475569' }}>{it.unidade ?? 'un'}</td>
                                      <td style={{ padding: '4px 8px', color: '#64748B', fontWeight: 600 }}>{it.quantidade}</td>
                                      <td style={{ padding: '4px 8px', color: '#475569' }}>{it.valor_unitario ? fmtBRL(it.valor_unitario) : '—'}</td>
                                      <td style={{ padding: '4px 8px', color: '#334155' }}>{it.fornecedor_sugerido || '—'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </td>
                          </tr>
                        )}
                      </>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ background: '#1A1D2E', borderTop: '2px solid #1E2235' }}>
                    <td colSpan={6} style={{ padding: '10px 12px', color: '#F1F5F9', fontWeight: 700 }}>TOTAL</td>
                    <td style={{ padding: '10px 12px', color: '#94A3B8', textAlign: 'center', fontWeight: 700 }}>{totalItens}</td>
                    <td style={{ padding: '10px 12px', color: '#10B981', fontWeight: 700, textAlign: 'right' }}>{fmtBRL(totalGeral)}</td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
