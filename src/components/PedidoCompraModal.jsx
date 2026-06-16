import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

function fmtBRL(v) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const inp = {
  width: '100%', padding: '8px 12px', borderRadius: 7,
  background: '#0F1117', border: '1px solid #1E2235',
  color: '#F1F5F9', fontSize: 13, outline: 'none', fontFamily: 'inherit',
}
const lbl = { fontSize: 11, fontWeight: 600, color: '#64748B', marginBottom: 5, display: 'block' }

// Modal para criar um Pedido de Compra a partir de uma cotação finalizada
export default function PedidoCompraModal({ cotacao, itens, fornecedores, precos, session, onClose, onCreated }) {
  const [fornecedorId, setFornecedorId] = useState(fornecedores[0]?.id ?? '')
  const [itensSelecionados, setItensSelecionados] = useState({})
  const [condicaoPagamento, setCondicaoPagamento] = useState('')
  const [prazoEntrega, setPrazoEntrega] = useState('')
  const [frete, setFrete] = useState(0)
  const [observacoes, setObservacoes] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  const fornecedorAtual = fornecedores.find(f => f.id === fornecedorId)

  useEffect(() => {
    if (fornecedorAtual) {
      setCondicaoPagamento(fornecedorAtual.condicao_pagamento ?? '')
      setPrazoEntrega(fornecedorAtual.prazo_entrega_dias ?? '')
      setFrete(fornecedorAtual.frete ?? 0)
    }
    // Por padrão, seleciona todos os itens que esse fornecedor cotou
    const sel = {}
    itens.forEach(it => {
      const p = precos.find(p => p.cotacao_item_id === it.id && p.cotacao_fornecedor_id === fornecedorId)
      if (p && parseFloat(p.preco_unitario) > 0) sel[it.id] = true
    })
    setItensSelecionados(sel)
  }, [fornecedorId])

  function toggleItem(itemId) {
    setItensSelecionados(s => ({ ...s, [itemId]: !s[itemId] }))
  }

  function precoItem(itemId) {
    const p = precos.find(p => p.cotacao_item_id === itemId && p.cotacao_fornecedor_id === fornecedorId)
    return p ? parseFloat(p.preco_unitario) || 0 : 0
  }
  function descontoItem(itemId) {
    const p = precos.find(p => p.cotacao_item_id === itemId && p.cotacao_fornecedor_id === fornecedorId)
    return p ? parseFloat(p.desconto_pct) || 0 : 0
  }

  const itensDoPedido = itens.filter(it => itensSelecionados[it.id])
  const valorTotal = itensDoPedido.reduce((acc, it) => {
    const preco = precoItem(it.id)
    const desc = descontoItem(it.id)
    const precoComDesc = preco * (1 - desc / 100)
    return acc + precoComDesc * (parseFloat(it.quantidade) || 0)
  }, 0) + (parseFloat(frete) || 0)

  async function criarPedido() {
    setErro('')
    if (!fornecedorId) { setErro('Selecione um fornecedor'); return }
    if (itensDoPedido.length === 0) { setErro('Selecione ao menos um item'); return }
    setSalvando(true)

    const userName = session?.user?.user_metadata?.nome ?? session?.user?.email

    const { data: pedido, error } = await supabase.from('pedidos_compra').insert({
      obra_id: cotacao.obra_id,
      cotacao_id: cotacao.id,
      sc_id: cotacao.sc_id ?? null,
      fornecedor_nome: fornecedorAtual?.fornecedor_nome ?? '',
      condicao_pagamento: condicaoPagamento,
      prazo_entrega_dias: prazoEntrega ? parseInt(prazoEntrega) : null,
      frete: parseFloat(frete) || 0,
      observacoes,
      valor_total: valorTotal,
      responsavel_nome: userName,
      user_id: session.user.id,
    }).select().single()

    if (error || !pedido) {
      setErro('Erro ao criar pedido: ' + (error?.message ?? ''))
      setSalvando(false)
      return
    }

    const itensPayload = itensDoPedido.map((it, idx) => ({
      pedido_id: pedido.id,
      descricao: it.descricao,
      unidade: it.unidade,
      quantidade: parseFloat(it.quantidade) || 1,
      preco_unitario: precoItem(it.id),
      desconto_pct: descontoItem(it.id),
      ordem: idx,
    }))

    const { error: errItens } = await supabase.from('pedido_compra_itens').insert(itensPayload)
    if (errItens) {
      setErro('Pedido criado, mas houve erro ao salvar itens: ' + errItens.message)
      setSalvando(false)
      return
    }

    setSalvando(false)
    onCreated?.(pedido)
  }

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{ position: 'fixed', inset: 0, background: '#00000090', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 16 }}>
      <div style={{ background: '#1A1D2E', border: '1px solid #1E2235', borderRadius: 16, width: 700, maxWidth: '95vw', maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}>

        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #1E2235' }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#F1F5F9', marginBottom: 4 }}>📄 Gerar Pedido de Compra</div>
          <div style={{ fontSize: 12, color: '#475569' }}>{cotacao.titulo}</div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 24px' }}>

          <label style={lbl}>Fornecedor</label>
          <select style={{ ...inp, marginBottom: 14 }} value={fornecedorId} onChange={e => setFornecedorId(e.target.value)}>
            {fornecedores.map(f => <option key={f.id} value={f.id}>{f.fornecedor_nome}</option>)}
          </select>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
            <div>
              <label style={lbl}>Condição pagamento</label>
              <input style={inp} value={condicaoPagamento} onChange={e => setCondicaoPagamento(e.target.value)} placeholder="Ex: 30/60 dias" />
            </div>
            <div>
              <label style={lbl}>Prazo entrega (dias)</label>
              <input style={inp} type="number" value={prazoEntrega} onChange={e => setPrazoEntrega(e.target.value)} />
            </div>
            <div>
              <label style={lbl}>Frete (R$)</label>
              <input style={inp} type="number" step="0.01" value={frete} onChange={e => setFrete(e.target.value)} />
            </div>
          </div>

          <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 8, textTransform: 'uppercase' }}>
            Selecione os itens deste pedido
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
            {itens.map(it => {
              const preco = precoItem(it.id)
              if (preco <= 0) return null // não cotado por esse fornecedor
              const selecionado = !!itensSelecionados[it.id]
              return (
                <div key={it.id} onClick={() => toggleItem(it.id)} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 8, cursor: 'pointer',
                  background: selecionado ? '#0F1117' : '#13151f',
                  border: `1px solid ${selecionado ? '#3B82F6' : '#1E2235'}`,
                }}>
                  <div style={{
                    width: 18, height: 18, borderRadius: 4, flexShrink: 0,
                    border: `1.5px solid ${selecionado ? '#3B82F6' : '#334155'}`,
                    background: selecionado ? '#3B82F6' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11,
                  }}>{selecionado ? '✓' : ''}</div>
                  <div style={{ flex: 1, fontSize: 12, color: '#F1F5F9' }}>{it.descricao}</div>
                  <div style={{ fontSize: 11, color: '#64748B' }}>{it.quantidade} {it.unidade}</div>
                  <div style={{ fontSize: 12, color: '#10B981', fontWeight: 600, minWidth: 80, textAlign: 'right' }}>{fmtBRL(preco)}</div>
                </div>
              )
            })}
          </div>

          <label style={lbl}>Observações</label>
          <textarea style={{ ...inp, minHeight: 60, resize: 'vertical', marginBottom: 14 }} value={observacoes} onChange={e => setObservacoes(e.target.value)} />

          <div style={{ background: '#0F1117', borderRadius: 8, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: '#94A3B8' }}>{itensDoPedido.length} item(ns) selecionado(s)</span>
            <span style={{ fontSize: 16, fontWeight: 700, color: '#10B981' }}>{fmtBRL(valorTotal)}</span>
          </div>

          {erro && (
            <div style={{ marginTop: 14, padding: '10px 14px', background: '#450A0A', border: '1px solid #7F1D1D', borderRadius: 8, color: '#FCA5A5', fontSize: 12 }}>{erro}</div>
          )}
        </div>

        <div style={{ padding: '14px 24px', borderTop: '1px solid #1E2235', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} disabled={salvando} style={{ padding: '8px 18px', borderRadius: 7, border: '1px solid #1E2235', background: 'transparent', color: '#64748B', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
          <button onClick={criarPedido} disabled={salvando} style={{ padding: '8px 20px', borderRadius: 7, border: 'none', background: 'linear-gradient(135deg, #3B82F6, #6366F1)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: salvando ? 0.6 : 1 }}>
            {salvando ? 'Criando...' : '✓ Criar Pedido de Compra'}
          </button>
        </div>
      </div>
    </div>
  )
}
