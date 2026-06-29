import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const STATUS_META = {
  pendente:  { label: 'Pendente',        color: '#F59E0B', bg: '#451A03' },
  aprovada:  { label: 'Aprovada',        color: '#10B981', bg: '#064E3B' },
  rejeitada: { label: 'Rejeitada',       color: '#EF4444', bg: '#450A0A' },
  em_pedido: { label: 'Pedido Realizado',color: '#8B5CF6', bg: '#2E1065' },
  recebido:  { label: 'Recebido',        color: '#10B981', bg: '#064E3B' },
}
const URGENCIA_META = {
  normal:  { label: 'Normal',   color: '#64748B' },
  urgente: { label: 'Urgente',  color: '#F59E0B' },
  critico: { label: 'Crítico',  color: '#EF4444' },
}

function fmtData(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function MapaControle({ session }) {
  const [obras,    setObras]    = useState([])
  const [scs,      setScs]      = useState([])
  const [loading,  setLoading]  = useState(true)
  const [exportando, setExportando] = useState(false)

  const [filtro, setFiltro] = useState({
    obra:     'all',
    status:   'all',
    gestao:   'all',
    inicio:   '',
    fim:      '',
  })

  useEffect(() => { init() }, [])

  async function init() {
    setLoading(true)
    const [{ data: obrasData }, { data: scsData }] = await Promise.all([
      supabase.from('obras').select('id, nome').order('nome'),
      supabase.from('solicitacoes_compra')
        .select('*, obra:obras(nome), itens:itens_solicitacao(id, descricao, unidade, quantidade, valor_unitario, fornecedor_sugerido)')
        .order('created_at', { ascending: false }),
    ])
    setObras(obrasData ?? [])
    setScs(scsData ?? [])
    setLoading(false)
  }

  // Aplica filtros
  const scsFiltradas = scs.filter(sc => {
    if (filtro.obra !== 'all' && sc.obra_id !== filtro.obra) return false
    if (filtro.status !== 'all' && sc.status !== filtro.status) return false
    if (filtro.gestao !== 'all' && sc.gestao !== filtro.gestao) return false
    if (filtro.inicio && sc.created_at < filtro.inicio) return false
    if (filtro.fim && sc.created_at > filtro.fim + 'T23:59:59') return false
    return true
  })

  // Agrupa por obra
  const porObra = obras.reduce((acc, o) => {
    const lista = scsFiltradas.filter(sc => sc.obra_id === o.id)
    if (lista.length) acc.push({ obra: o, scs: lista })
    return acc
  }, [])

  // ── Impressão ──────────────────────────────────────────────────────────
  function imprimir() {
    const blocos = porObra.map(({ obra, scs: lista }) => {
      const scRows = lista.map(sc => {
        const smeta = STATUS_META[sc.status] ?? STATUS_META.pendente
        const umeta = URGENCIA_META[sc.urgencia] ?? URGENCIA_META.normal
        const itensRows = (sc.itens ?? []).filter(i => i.descricao?.trim()).map((it, idx) => `
          <tr style="background:${idx%2===0?'#f9fafb':'#fff'}">
            <td style="padding:4px 8px;color:#888;font-size:10px">${idx+1}</td>
            <td style="padding:4px 8px">${it.descricao}${it.descricao}</td>
            <td style="padding:4px 8px;text-align:center">${it.unidade ?? 'un'}</td>
            <td style="padding:4px 8px;text-align:center">${it.quantidade}</td>
            <td style="padding:4px 8px;color:#888">${it.fornecedor_sugerido || '—'}</td>
          </tr>`).join('')

        return `
          <div style="margin-bottom:20px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;page-break-inside:avoid">
            <div style="background:#1a1d2e;color:#fff;padding:8px 14px;display:flex;justify-content:space-between;align-items:center">
              <div>
                <span style="font-weight:700;font-size:13px">${sc.titulo}</span>
                <span style="margin-left:10px;font-size:10px;background:${smeta.bg};color:${smeta.color};padding:2px 8px;border-radius:20px">${smeta.label}</span>
                <span style="margin-left:6px;font-size:10px;color:${umeta.color}">${umeta.label}</span>
              </div>
              <div style="font-size:10px;color:#94a3b8">
                ${sc.gestao === 'GA' ? 'Gestão Administrativa' : 'Gestão Executiva'} &nbsp;|&nbsp;
                ${sc.solicitante_nome ?? '—'} &nbsp;|&nbsp;
                ${fmtData(sc.created_at)}
                ${sc.prazo_entrega ? ' &nbsp;|&nbsp; Prazo: ' + fmtData(sc.prazo_entrega) : ''}
              </div>
            </div>
            <table style="width:100%;border-collapse:collapse;font-size:11px">
              <thead>
                <tr style="background:#f1f5f9">
                  <th style="padding:5px 8px;text-align:left;font-size:9px;color:#64748b">#</th>
                  <th style="padding:5px 8px;text-align:left;font-size:9px;color:#64748b">DESCRIÇÃO</th>
                  <th style="padding:5px 8px;text-align:center;font-size:9px;color:#64748b">UN</th>
                  <th style="padding:5px 8px;text-align:center;font-size:9px;color:#64748b">QTDE</th>
                  <th style="padding:5px 8px;text-align:left;font-size:9px;color:#64748b">FORNECEDOR SUGERIDO</th>
                </tr>
              </thead>
              <tbody>${itensRows || '<tr><td colspan="5" style="padding:8px;color:#aaa;text-align:center">Nenhum item cadastrado</td></tr>'}</tbody>
            </table>
            ${sc.observacoes ? `<div style="padding:6px 14px;background:#fafafa;border-top:1px solid #e2e8f0;font-size:10px;color:#64748b"><strong>Obs:</strong> ${sc.observacoes}</div>` : ''}
          </div>`
      }).join('')

      return `
        <div style="margin-bottom:30px">
          <div style="font-size:15px;font-weight:700;color:#1a1d2e;border-bottom:2px solid #1a1d2e;padding-bottom:6px;margin-bottom:12px">
            🏗️ ${obra.nome} <span style="font-size:11px;font-weight:400;color:#64748b">(${lista.length} SC${lista.length !== 1 ? 's' : ''})</span>
          </div>
          ${scRows}
        </div>`
    }).join('')

    const win = window.open('', '_blank')
    win.document.write(`
      <html><head><title>Mapa de Controle de SCs</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 12px; color: #1a1a1a; padding: 24px; }
        .header { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:3px solid #1a1d2e; padding-bottom:14px; margin-bottom:22px; }
        .empresa { font-size:15px; font-weight:700; }
        .empresa-info { font-size:10px; color:#555; margin-top:3px; }
        .relatorio-titulo { font-size:18px; font-weight:700; text-align:right; }
        .filtros-aplicados { font-size:10px; color:#888; text-align:right; margin-top:4px; }
        .rodape { margin-top:30px; border-top:1px solid #e2e8f0; padding-top:10px; font-size:10px; color:#aaa; display:flex; justify-content:space-between; }
        @media print { body { padding: 10px } }
      </style></head><body>
      <div class="header">
        <div>
          <div class="empresa">S.A Pride Construtora e Incorporadora Ltda</div>
          <div class="empresa-info">CNPJ: 46.787.316/0001-76 &nbsp;|&nbsp; Av. Nereu Ramos, 5292 – Balneário Piçarras – SC</div>
        </div>
        <div>
          <div class="relatorio-titulo">MAPA DE CONTROLE DE SCs</div>
          <div class="filtros-aplicados">
            ${filtro.obra !== 'all' ? 'Obra: ' + (obras.find(o=>o.id===filtro.obra)?.nome??'') + ' &nbsp;|&nbsp; ' : ''}
            ${filtro.status !== 'all' ? 'Status: ' + (STATUS_META[filtro.status]?.label??'') + ' &nbsp;|&nbsp; ' : ''}
            ${filtro.gestao !== 'all' ? 'Gestão: ' + (filtro.gestao==='GA'?'Administrativa':'Executiva') + ' &nbsp;|&nbsp; ' : ''}
            ${filtro.inicio ? 'De: ' + fmtData(filtro.inicio) + ' ' : ''}
            ${filtro.fim ? 'Até: ' + fmtData(filtro.fim) + ' ' : ''}
            Total: ${scsFiltradas.length} SC${scsFiltradas.length!==1?'s':''}
          </div>
        </div>
      </div>
      ${blocos || '<p style="color:#aaa;text-align:center;padding:40px">Nenhuma SC encontrada com os filtros aplicados.</p>'}
      <div class="rodape">
        <span>S.A Pride ERP — Mapa de Controle de Solicitações</span>
        <span>Gerado em ${new Date().toLocaleString('pt-BR')}</span>
      </div>
      </body></html>
    `)
    win.document.close()
    win.focus()
    setTimeout(() => win.print(), 300)
  }

  // ── Exportar Excel ─────────────────────────────────────────────────────
  async function exportarExcel() {
    setExportando(true)
    try {
      const XLSX = await import('xlsx')
      const wb = XLSX.utils.book_new()

      // Aba 1: Resumo de SCs
      const resumoRows = scsFiltradas.map(sc => ({
        'Obra': sc.obra?.nome ?? '—',
        'Título': sc.titulo,
        'Status': STATUS_META[sc.status]?.label ?? sc.status,
        'Urgência': URGENCIA_META[sc.urgencia]?.label ?? sc.urgencia,
        'Gestão': sc.gestao === 'GA' ? 'Gestão Administrativa' : 'Gestão Executiva',
        'Solicitante': sc.solicitante_nome ?? '—',
        'Abertura': fmtData(sc.created_at),
        'Prazo': fmtData(sc.prazo_entrega),
        'Qtde Itens': (sc.itens ?? []).filter(i => i.descricao?.trim()).length,
        'Observações': sc.observacoes ?? '',
      }))
      const wsResumo = XLSX.utils.json_to_sheet(resumoRows)
      XLSX.utils.book_append_sheet(wb, wsResumo, 'SCs')

      // Aba 2: Todos os itens
      const itensRows = scsFiltradas.flatMap(sc =>
        (sc.itens ?? []).filter(i => i.descricao?.trim()).map(it => ({
          'Obra': sc.obra?.nome ?? '—',
          'SC': sc.titulo,
          'Status SC': STATUS_META[sc.status]?.label ?? sc.status,
          'Descrição': it.descricao,
          
          'Unidade': it.unidade ?? 'un',
          'Quantidade': it.quantidade,
          'Valor Unit.': it.valor_unitario ?? '',
          'Fornecedor Sugerido': it.fornecedor_sugerido ?? '',
        }))
      )
      const wsItens = XLSX.utils.json_to_sheet(itensRows)
      XLSX.utils.book_append_sheet(wb, wsItens, 'Itens')

      const nome = `MapaControle_SC_${new Date().toISOString().slice(0,10)}.xlsx`
      XLSX.writeFile(wb, nome)
    } catch (err) {
      console.error(err)
    }
    setExportando(false)
  }

  const selStyle = {
    padding: '7px 12px', borderRadius: 7, border: '1px solid #1E2235',
    background: '#0F1117', color: '#94A3B8', fontSize: 12, outline: 'none', cursor: 'pointer',
  }
  const inp = { ...selStyle, cursor: 'text' }

  return (
    <div style={{ flex: 1, padding: '28px', overflowY: 'auto', color: '#E2E8F0', fontFamily: "'DM Sans', sans-serif" }}>

      {/* Cabeçalho */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#F1F5F9', marginBottom: 4 }}>📋 Mapa de Controle de SCs</h1>
          <p style={{ fontSize: 13, color: '#475569' }}>Relação de solicitações agrupadas por obra, com todos os itens.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={exportarExcel} disabled={exportando || scsFiltradas.length === 0} style={{
            padding: '8px 16px', borderRadius: 7, border: '1px solid #1E2235', background: 'transparent',
            color: '#10B981', fontWeight: 600, fontSize: 13, cursor: 'pointer',
            opacity: scsFiltradas.length === 0 ? 0.4 : 1,
          }}>{exportando ? '⏳ Exportando...' : '📊 Exportar Excel'}</button>
          <button onClick={imprimir} disabled={scsFiltradas.length === 0} style={{
            padding: '8px 16px', borderRadius: 7, border: 'none',
            background: 'linear-gradient(135deg, #3B82F6, #6366F1)', color: '#fff',
            fontWeight: 700, fontSize: 13, cursor: 'pointer',
            opacity: scsFiltradas.length === 0 ? 0.4 : 1,
          }}>🖨️ Imprimir / PDF</button>
        </div>
      </div>

      {/* Filtros */}
      <div style={{ background: '#1A1D2E', border: '1px solid #1E2235', borderRadius: 10, padding: '14px 18px', marginBottom: 20, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <label style={{ fontSize: 11, color: '#475569', display: 'block', marginBottom: 4 }}>Obra</label>
          <select style={selStyle} value={filtro.obra} onChange={e => setFiltro(f => ({ ...f, obra: e.target.value }))}>
            <option value="all">Todas as obras</option>
            {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 11, color: '#475569', display: 'block', marginBottom: 4 }}>Status</label>
          <select style={selStyle} value={filtro.status} onChange={e => setFiltro(f => ({ ...f, status: e.target.value }))}>
            <option value="all">Todos</option>
            {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 11, color: '#475569', display: 'block', marginBottom: 4 }}>Gestão</label>
          <select style={selStyle} value={filtro.gestao} onChange={e => setFiltro(f => ({ ...f, gestao: e.target.value }))}>
            <option value="all">Todas</option>
            <option value="GA">Gestão Administrativa</option>
            <option value="GE">Gestão Executiva</option>
          </select>
        </div>
        <div>
          <label style={{ fontSize: 11, color: '#475569', display: 'block', marginBottom: 4 }}>De</label>
          <input type="date" style={inp} value={filtro.inicio} onChange={e => setFiltro(f => ({ ...f, inicio: e.target.value }))} />
        </div>
        <div>
          <label style={{ fontSize: 11, color: '#475569', display: 'block', marginBottom: 4 }}>Até</label>
          <input type="date" style={inp} value={filtro.fim} onChange={e => setFiltro(f => ({ ...f, fim: e.target.value }))} />
        </div>
        {(filtro.obra !== 'all' || filtro.status !== 'all' || filtro.gestao !== 'all' || filtro.inicio || filtro.fim) && (
          <button onClick={() => setFiltro({ obra: 'all', status: 'all', gestao: 'all', inicio: '', fim: '' })} style={{ ...selStyle, color: '#EF4444', cursor: 'pointer', alignSelf: 'flex-end' }}>
            ✕ Limpar
          </button>
        )}
        <div style={{ marginLeft: 'auto', alignSelf: 'flex-end', fontSize: 12, color: '#475569' }}>
          {scsFiltradas.length} SC{scsFiltradas.length !== 1 ? 's' : ''} encontrada{scsFiltradas.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Lista */}
      {loading ? (
        <div style={{ color: '#334155', fontSize: 14 }}>Carregando...</div>
      ) : porObra.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📋</div>
          <p style={{ fontSize: 14, color: '#475569', fontWeight: 600 }}>Nenhuma SC encontrada com os filtros aplicados</p>
        </div>
      ) : porObra.map(({ obra, scs: lista }) => (
        <div key={obra.id} style={{ marginBottom: 28 }}>
          {/* Cabeçalho da obra */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, borderBottom: '2px solid #1E2235', paddingBottom: 8 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#F1F5F9' }}>🏗️ {obra.nome}</span>
            <span style={{ fontSize: 11, color: '#475569' }}>{lista.length} SC{lista.length !== 1 ? 's' : ''}</span>
          </div>

          {/* SCs da obra */}
          {lista.map(sc => {
            const smeta = STATUS_META[sc.status] ?? STATUS_META.pendente
            const umeta = URGENCIA_META[sc.urgencia] ?? URGENCIA_META.normal
            const itensFilt = (sc.itens ?? []).filter(i => i.descricao?.trim())
            return (
              <div key={sc.id} style={{ background: '#1A1D2E', border: '1px solid #1E2235', borderRadius: 10, marginBottom: 10, overflow: 'hidden' }}>
                {/* Cabeçalho da SC */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', background: '#13151f', flexWrap: 'wrap', gap: 6 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#F1F5F9' }}>{sc.titulo}</span>
                    <span style={{ padding: '2px 10px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: smeta.bg, color: smeta.color }}>{smeta.label}</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: umeta.color }}>{umeta.label}</span>
                    <span style={{ fontSize: 11, color: '#475569' }}>{sc.gestao === 'GA' ? 'G.Administrativa' : 'G.Executiva'}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 12, fontSize: 11, color: '#475569' }}>
                    <span>{sc.solicitante_nome ?? '—'}</span>
                    <span>Abertura: {fmtData(sc.created_at)}</span>
                    {sc.prazo_entrega && <span>Prazo: {fmtData(sc.prazo_entrega)}</span>}
                    <span style={{ color: '#334155' }}>{itensFilt.length} item{itensFilt.length !== 1 ? 'ns' : ''}</span>
                  </div>
                </div>

                {/* Itens da SC */}
                {itensFilt.length > 0 && (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: '#0F1117' }}>
                          {['#', 'Descrição', 'Un.', 'Qtde', 'Fornecedor sugerido'].map(h => (
                            <th key={h} style={{ padding: '6px 12px', textAlign: 'left', color: '#475569', fontWeight: 700, fontSize: 10, textTransform: 'uppercase', borderBottom: '1px solid #1E2235' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {itensFilt.map((it, idx) => (
                          <tr key={it.id} style={{ background: idx % 2 === 0 ? '#0F1117' : '#0D1020' }}>
                            <td style={{ padding: '6px 12px', color: '#475569', fontSize: 11 }}>{idx + 1}</td>
                            <td style={{ padding: '6px 12px', color: '#E2E8F0' }}>
                              {it.descricao}
                              
                            </td>
                            <td style={{ padding: '6px 12px', color: '#64748B' }}>{it.unidade ?? 'un'}</td>
                            <td style={{ padding: '6px 12px', color: '#94A3B8', fontWeight: 600 }}>{it.quantidade}</td>
                            <td style={{ padding: '6px 12px', color: '#475569' }}>{it.fornecedor_sugerido || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {sc.observacoes && (
                  <div style={{ padding: '6px 14px', background: '#0D1020', borderTop: '1px solid #1E2235', fontSize: 11, color: '#475569' }}>
                    <strong style={{ color: '#64748B' }}>Obs:</strong> {sc.observacoes}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
