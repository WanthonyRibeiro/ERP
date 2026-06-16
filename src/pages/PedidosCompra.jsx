import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import EntregaPedidoModal from '../components/EntregaPedidoModal'

function fmtBRL(v) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function fmtData(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const STATUS_META = {
  aberto:    { label: 'Aberto',    color: '#F59E0B', bg: '#451A03' },
  entregue:  { label: 'Entregue',  color: '#10B981', bg: '#064E3B' },
  cancelado: { label: 'Cancelado', color: '#EF4444', bg: '#450A0A' },
}

export default function PedidosCompra({ session }) {
  const [pedidos,  setPedidos]  = useState([])
  const [obras,    setObras]    = useState([])
  const [empresa,  setEmpresa]  = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [filtro,   setFiltro]   = useState({ obra: 'all', status: 'all' })
  const [detalhe,  setDetalhe]  = useState(null)
  const [entregaModal, setEntregaModal] = useState(null)
  const [toast,    setToast]    = useState(null)
  const printRef = useRef(null)

  useEffect(() => { init() }, [])

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(null), 3000) }

  async function init() {
    setLoading(true)
    const [{ data: pedData }, { data: obrasData }, { data: empData }] = await Promise.all([
      supabase.from('pedidos_compra').select('*, obra:obras(nome), itens:pedido_compra_itens(*)').order('created_at', { ascending: false }),
      supabase.from('obras').select('id, nome').order('nome'),
      supabase.from('empresa_dados').select('*').limit(1).maybeSingle(),
    ])
    setPedidos(pedData ?? [])
    setObras(obrasData ?? [])
    setEmpresa(empData ?? null)
    setLoading(false)
  }

  async function cancelarPedido(id) {
    if (!confirm('Cancelar este pedido?')) return
    await supabase.from('pedidos_compra').update({ status: 'cancelado' }).eq('id', id)
    showToast('Pedido cancelado.')
    init()
    if (detalhe?.id === id) setDetalhe(d => ({ ...d, status: 'cancelado' }))
  }

  function imprimirPedido(pedido) {
    const itensRows = (pedido.itens ?? []).map(it => {
      const precoComDesc = (parseFloat(it.preco_unitario) || 0) * (1 - (parseFloat(it.desconto_pct) || 0) / 100)
      const total = precoComDesc * (parseFloat(it.quantidade) || 0)
      return `<tr>
        <td>${it.descricao}</td>
        <td style="text-align:center">${it.unidade}</td>
        <td style="text-align:right">${parseFloat(it.quantidade)}</td>
        <td style="text-align:right">${fmtBRL(it.preco_unitario)}</td>
        <td style="text-align:right">${it.desconto_pct ? Math.round(parseFloat(it.desconto_pct) * 100) / 100 + '%' : '—'}</td>
        <td style="text-align:right">${fmtBRL(total)}</td>
      </tr>`
    }).join('')

    const subtotal = (pedido.itens ?? []).reduce((acc, it) => {
      const precoComDesc = (parseFloat(it.preco_unitario) || 0) * (1 - (parseFloat(it.desconto_pct) || 0) / 100)
      return acc + precoComDesc * (parseFloat(it.quantidade) || 0)
    }, 0)

    const win = window.open('', '_blank')
    win.document.write(`
      <html><head><title>${pedido.numero}</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 12px; color: #1a1a1a; padding: 30px; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #1a1d2e; padding-bottom: 16px; margin-bottom: 20px; }
        .empresa { font-size: 16px; font-weight: 700; }
        .empresa-info { font-size: 11px; color: #555; margin-top: 4px; line-height: 1.5; }
        .pedido-numero { font-size: 20px; font-weight: 700; text-align: right; }
        .pedido-data { font-size: 11px; color: #555; text-align: right; margin-top: 4px; }
        .secao { margin-bottom: 20px; }
        .secao-titulo { font-size: 11px; font-weight: 700; color: #888; text-transform: uppercase; margin-bottom: 6px; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; font-size: 12px; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th { background: #1a1d2e; color: #fff; padding: 8px 10px; text-align: left; font-size: 10px; text-transform: uppercase; }
        td { padding: 7px 10px; border-bottom: 1px solid #e2e8f0; font-size: 11px; }
        tfoot td { font-weight: 700; border-top: 2px solid #1a1d2e; }
        .assinaturas { display: flex; justify-content: space-between; margin-top: 60px; }
        .assinatura-linha { width: 250px; border-top: 1px solid #333; text-align: center; padding-top: 6px; font-size: 11px; }
        @media print { body { padding: 10px } }
      </style></head><body>

        <div class="header">
          <div>
            <div class="empresa">${empresa?.razao_social ?? 'S.A Pride Construtora e Incorporadora Ltda'}</div>
            <div class="empresa-info">
              CNPJ: ${empresa?.cnpj ?? '46.787.316/0001-76'}<br/>
              ${empresa?.endereco ?? 'Av. Nereu Ramos, 5292 – Salas 04 e 05 – Itacolomi, Balneário Piçarras – SC, 88380-000'}
              ${empresa?.telefone ? '<br/>Tel: ' + empresa.telefone : ''}
            </div>
          </div>
          <div>
            <div class="pedido-numero">PEDIDO DE COMPRA<br/>${pedido.numero}</div>
            <div class="pedido-data">Emitido em ${fmtData(pedido.created_at)}</div>
          </div>
        </div>

        <div class="secao">
          <div class="secao-titulo">Dados do Pedido</div>
          <div class="info-grid">
            <div><b>Obra:</b><br/>${pedido.obra?.nome ?? '—'}</div>
            <div><b>Fornecedor:</b><br/>${pedido.fornecedor_nome}</div>
            <div><b>Condição de Pagamento:</b><br/>${pedido.condicao_pagamento || '—'}</div>
            <div><b>Prazo de Entrega:</b><br/>${pedido.prazo_entrega_dias ? pedido.prazo_entrega_dias + ' dias' : '—'}</div>
            <div><b>Frete:</b><br/>${fmtBRL(pedido.frete)}</div>
            <div><b>Responsável:</b><br/>${pedido.responsavel_nome ?? '—'}</div>
          </div>
        </div>

        <div class="secao">
          <div class="secao-titulo">Itens</div>
          <table>
            <thead><tr><th>Descrição</th><th>Un.</th><th>Qtde</th><th>Preço Unit.</th><th>Desc.</th><th>Total</th></tr></thead>
            <tbody>${itensRows}</tbody>
            <tfoot>
              <tr><td colspan="5">Subtotal</td><td style="text-align:right">${fmtBRL(subtotal)}</td></tr>
              <tr><td colspan="5">Frete</td><td style="text-align:right">${fmtBRL(pedido.frete)}</td></tr>
              <tr><td colspan="5">TOTAL</td><td style="text-align:right">${fmtBRL(pedido.valor_total)}</td></tr>
            </tfoot>
          </table>
        </div>

        ${pedido.observacoes ? `<div class="secao"><div class="secao-titulo">Observações</div><div>${pedido.observacoes}</div></div>` : ''}

        <div class="assinaturas">
          <div class="assinatura-linha">${empresa?.razao_social ?? 'S.A Pride Construtora'}</div>
          <div class="assinatura-linha">${pedido.fornecedor_nome}</div>
        </div>

      </body></html>
    `)
    win.document.close()
    win.focus()
    setTimeout(() => win.print(), 300)
  }

  const filtered = pedidos.filter(p => {
    if (filtro.obra !== 'all' && p.obra_id !== filtro.obra) return false
    if (filtro.status !== 'all' && p.status !== filtro.status) return false
    return true
  })

  const totalAberto = pedidos.filter(p => p.status === 'aberto').reduce((acc, p) => acc + (parseFloat(p.valor_total) || 0), 0)

  const selStyle = {
    padding: '7px 14px', borderRadius: 7, border: '1px solid #1E2235',
    background: '#0F1117', color: '#94A3B8', fontSize: 12, outline: 'none', cursor: 'pointer',
  }

  if (detalhe) {
    const smeta = STATUS_META[detalhe.status] ?? STATUS_META.aberto
    return (
      <div style={{ flex: 1, padding: '28px', overflowY: 'auto', color: '#E2E8F0', fontFamily: "'DM Sans', sans-serif" }}>
        <button onClick={() => setDetalhe(null)} style={{ background: 'none', border: '1px solid #1E2235', borderRadius: 7, color: '#64748B', fontSize: 13, cursor: 'pointer', padding: '5px 10px', marginBottom: 16 }}>← Voltar</button>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 4 }}>
              <h1 style={{ fontSize: 20, fontWeight: 700, color: '#F1F5F9' }}>{detalhe.numero}</h1>
              <span style={{ padding: '3px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: smeta.bg, color: smeta.color }}>{smeta.label}</span>
            </div>
            <div style={{ fontSize: 13, color: '#475569' }}>{detalhe.fornecedor_nome} · {detalhe.obra?.nome}</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => imprimirPedido(detalhe)} style={{ padding: '8px 16px', borderRadius: 7, border: 'none', background: '#1E3A5F', color: '#93C5FD', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>🖨️ Imprimir / PDF</button>
            {detalhe.status === 'aberto' && (
              <>
                <button onClick={() => setEntregaModal(detalhe)} style={{ padding: '8px 16px', borderRadius: 7, border: 'none', background: '#064E3B', color: '#6EE7B7', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>✓ Marcar entregue</button>
                <button onClick={() => cancelarPedido(detalhe.id)} style={{ padding: '8px 16px', borderRadius: 7, border: '1px solid #7F1D1D', background: 'transparent', color: '#FCA5A5', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
              </>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 20 }}>
          {[
            { label: 'Condição Pagto.', value: detalhe.condicao_pagamento || '—' },
            { label: 'Prazo Entrega', value: detalhe.prazo_entrega_dias ? detalhe.prazo_entrega_dias + ' dias' : '—' },
            { label: 'Frete', value: fmtBRL(detalhe.frete) },
            { label: 'Valor Total', value: fmtBRL(detalhe.valor_total) },
          ].map(s => (
            <div key={s.label} style={{ background: '#1A1D2E', border: '1px solid #1E2235', borderRadius: 10, padding: '12px 16px' }}>
              <div style={{ fontSize: 11, color: '#475569', marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#F1F5F9' }}>{s.value}</div>
            </div>
          ))}
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#1A1D2E' }}>
                {['Descrição', 'Un.', 'Qtde', 'Preço Unit.', 'Desc%', 'Total'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: '#475569', fontWeight: 700, fontSize: 10, textTransform: 'uppercase', borderBottom: '1px solid #1E2235' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(detalhe.itens ?? []).map((it, i) => {
                const precoComDesc = (parseFloat(it.preco_unitario) || 0) * (1 - (parseFloat(it.desconto_pct) || 0) / 100)
                const total = precoComDesc * (parseFloat(it.quantidade) || 0)
                return (
                  <tr key={it.id} style={{ background: i % 2 === 0 ? '#0F1117' : '#0D1020' }}>
                    <td style={{ padding: '10px 14px', color: '#F1F5F9' }}>{it.descricao}</td>
                    <td style={{ padding: '10px 14px', color: '#64748B' }}>{it.unidade}</td>
                    <td style={{ padding: '10px 14px', color: '#94A3B8' }}>{it.quantidade}</td>
                    <td style={{ padding: '10px 14px', color: '#94A3B8' }}>{fmtBRL(it.preco_unitario)}</td>
                    <td style={{ padding: '10px 14px', color: '#64748B' }}>{it.desconto_pct ? Math.round(parseFloat(it.desconto_pct) * 100) / 100 + '%' : '—'}</td>
                    <td style={{ padding: '10px 14px', color: '#10B981', fontWeight: 600 }}>{fmtBRL(total)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {detalhe.observacoes && (
          <div style={{ marginTop: 20, background: '#1A1D2E', borderRadius: 10, padding: '14px 18px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 6, textTransform: 'uppercase' }}>Observações</div>
            <div style={{ fontSize: 13, color: '#94A3B8' }}>{detalhe.observacoes}</div>
          </div>
        )}

        {toast && (
          <div style={{ position: 'fixed', bottom: 24, right: 24, background: '#064E3B', border: '1px solid #065F46', color: '#6EE7B7', padding: '10px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600, zIndex: 2000 }}>{toast}</div>
        )}

        {entregaModal && (
          <EntregaPedidoModal
            pedido={entregaModal}
            session={session}
            onClose={() => setEntregaModal(null)}
            onConfirmado={() => {
              setEntregaModal(null)
              showToast('✅ Entrega confirmada e estoque atualizado!')
              init()
              setDetalhe(d => d ? { ...d, status: 'entregue' } : d)
            }}
          />
        )}
      </div>
    )
  }

  return (
    <div style={{ flex: 1, padding: '28px', overflowY: 'auto', color: '#E2E8F0', fontFamily: "'DM Sans', sans-serif" }}>

      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#F1F5F9', marginBottom: 4 }}>📄 Pedidos de Compra</h1>
        <p style={{ fontSize: 13, color: '#475569' }}>Pedidos gerados a partir de cotações finalizadas. Para criar um novo, acesse a Cotação e clique em "Gerar Pedido".</p>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { label: 'Total de pedidos', value: pedidos.length, color: '#3B82F6' },
          { label: 'Abertos',  value: pedidos.filter(p => p.status === 'aberto').length, color: '#F59E0B' },
          { label: 'Entregues', value: pedidos.filter(p => p.status === 'entregue').length, color: '#10B981' },
          { label: 'Valor em aberto', value: fmtBRL(totalAberto), color: '#8B5CF6' },
        ].map(s => (
          <div key={s.label} style={{ background: '#1A1D2E', border: '1px solid #1E2235', borderRadius: 10, padding: '12px 18px' }}>
            <div style={{ fontSize: 11, color: '#475569', marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <select style={selStyle} value={filtro.obra} onChange={e => setFiltro(f => ({ ...f, obra: e.target.value }))}>
          <option value="all">Todas as obras</option>
          {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
        </select>
        <select style={selStyle} value={filtro.status} onChange={e => setFiltro(f => ({ ...f, status: e.target.value }))}>
          <option value="all">Todos os status</option>
          {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {loading ? (
        <p style={{ color: '#334155', fontSize: 14 }}>Carregando...</p>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#334155' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📄</div>
          <p style={{ fontSize: 14, color: '#475569', fontWeight: 600 }}>Nenhum pedido de compra ainda</p>
          <p style={{ fontSize: 12, color: '#334155', marginTop: 4 }}>Crie um a partir de uma cotação finalizada.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(p => {
            const smeta = STATUS_META[p.status] ?? STATUS_META.aberto
            return (
              <div key={p.id} onClick={() => setDetalhe(p)} style={{
                display: 'flex', alignItems: 'center', gap: 14, background: '#1A1D2E', border: '1px solid #1E2235',
                borderRadius: 10, padding: '14px 18px', cursor: 'pointer',
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#F1F5F9' }}>{p.numero}</span>
                    <span style={{ padding: '2px 10px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: smeta.bg, color: smeta.color }}>{smeta.label}</span>
                  </div>
                  <div style={{ fontSize: 12, color: '#475569' }}>{p.fornecedor_nome} · {p.obra?.nome} · {fmtData(p.created_at)}</div>
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#10B981' }}>{fmtBRL(p.valor_total)}</div>
                {p.status === 'aberto' && (
                  <button onClick={e => { e.stopPropagation(); setEntregaModal(p) }} style={{ padding: '6px 12px', borderRadius: 7, border: 'none', background: '#064E3B', color: '#6EE7B7', fontWeight: 600, fontSize: 12, cursor: 'pointer', flexShrink: 0 }}>
                    ✓ Marcar entregue
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, background: '#064E3B', border: '1px solid #065F46', color: '#6EE7B7', padding: '10px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600, zIndex: 2000 }}>{toast}</div>
      )}

      {entregaModal && (
        <EntregaPedidoModal
          pedido={entregaModal}
          session={session}
          onClose={() => setEntregaModal(null)}
          onConfirmado={() => {
            setEntregaModal(null)
            showToast('✅ Entrega confirmada e estoque atualizado!')
            init()
          }}
        />
      )}
    </div>
  )
}
