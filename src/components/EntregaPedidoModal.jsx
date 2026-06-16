import { useState } from 'react'
import { supabase } from '../lib/supabase'

const inp = {
  width: '100%', padding: '8px 12px', borderRadius: 7,
  background: '#0F1117', border: '1px solid #1E2235',
  color: '#F1F5F9', fontSize: 13, outline: 'none', fontFamily: 'inherit',
}
const lbl = { fontSize: 11, fontWeight: 600, color: '#64748B', marginBottom: 5, display: 'block' }

export default function EntregaPedidoModal({ pedido, session, onClose, onConfirmado }) {
  const [quantidades, setQuantidades] = useState(
    Object.fromEntries((pedido.itens ?? []).map(it => [it.id, String(it.quantidade)]))
  )
  const [nfNumero,  setNfNumero]  = useState('')
  const [nfArquivo, setNfArquivo] = useState(null)
  const [salvando,  setSalvando]  = useState(false)
  const [erro,      setErro]      = useState('')

  function setQtd(itemId, valor) {
    setQuantidades(q => ({ ...q, [itemId]: valor }))
  }

  async function confirmar() {
    setErro('')
    setSalvando(true)

    const userName = session?.user?.user_metadata?.nome ?? session?.user?.email

    // 1. Upload da NF (se houver)
    let nfUrl = null
    if (nfArquivo) {
      const ext = nfArquivo.name.split('.').pop()
      const path = `${pedido.obra_id}/${pedido.id}_${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage.from('notas-fiscais').upload(path, nfArquivo)
      if (uploadError) {
        setErro('Erro ao enviar NF: ' + uploadError.message)
        setSalvando(false)
        return
      }
      const { data: urlData } = supabase.storage.from('notas-fiscais').getPublicUrl(path)
      nfUrl = urlData?.publicUrl ?? null
    }

    // 2. Cria movimentações de entrada no estoque (uma por item, com a quantidade REAL recebida)
    for (const it of (pedido.itens ?? [])) {
      const qtdRecebida = parseFloat(quantidades[it.id])
      if (!qtdRecebida || qtdRecebida <= 0) continue

      const { error: movError } = await supabase.from('estoque_movimentacoes').insert({
        obra_id: pedido.obra_id,
        insumo_nome: it.descricao,
        unidade: it.unidade ?? 'un',
        tipo: 'entrada',
        quantidade: qtdRecebida,
        origem: 'sc',
        nf_numero: nfNumero || null,
        nf_arquivo_url: nfUrl,
        observacoes: `Pedido ${pedido.numero} — ${pedido.fornecedor_nome}`,
        responsavel_nome: userName,
        user_id: session.user.id,
      })
      if (movError) {
        setErro('Erro ao lançar no estoque: ' + movError.message)
        setSalvando(false)
        return
      }
    }

    // 3. Atualiza o pedido como entregue
    const { error: pedError } = await supabase.from('pedidos_compra').update({
      status: 'entregue',
      entregue_em: new Date().toISOString(),
    }).eq('id', pedido.id)

    if (pedError) {
      setErro('Erro ao atualizar pedido: ' + pedError.message)
      setSalvando(false)
      return
    }

    setSalvando(false)
    onConfirmado?.()
  }

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{ position: 'fixed', inset: 0, background: '#00000090', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 16 }}>
      <div style={{ background: '#1A1D2E', border: '1px solid #1E2235', borderRadius: 16, width: 640, maxWidth: '95vw', maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}>

        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #1E2235' }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#F1F5F9', marginBottom: 4 }}>📦 Confirmar Entrega — {pedido.numero}</div>
          <div style={{ fontSize: 12, color: '#475569' }}>{pedido.fornecedor_nome} — confira as quantidades recebidas e anexe a Nota Fiscal</div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 24px' }}>

          <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 8, textTransform: 'uppercase' }}>Itens recebidos</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            {(pedido.itens ?? []).map(it => (
              <div key={it.id} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 60px', gap: 10, alignItems: 'center', background: '#0F1117', borderRadius: 8, padding: '10px 12px' }}>
                <div>
                  <div style={{ fontSize: 13, color: '#F1F5F9', fontWeight: 600 }}>{it.descricao}</div>
                  <div style={{ fontSize: 11, color: '#475569' }}>Pedido: {it.quantidade} {it.unidade}</div>
                </div>
                <input
                  type="number" step="any"
                  style={inp}
                  value={quantidades[it.id]}
                  onChange={e => setQtd(it.id, e.target.value)}
                />
                <div style={{ fontSize: 12, color: '#64748B' }}>{it.unidade}</div>
              </div>
            ))}
          </div>

          <label style={lbl}>Número da Nota Fiscal</label>
          <input style={{ ...inp, marginBottom: 14 }} value={nfNumero} onChange={e => setNfNumero(e.target.value)} placeholder="Ex: 123456" />

          <label style={lbl}>Anexar Nota Fiscal (PDF ou foto)</label>
          <input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={e => setNfArquivo(e.target.files[0])}
            style={{ ...inp, padding: '7px' }}
          />
          {nfArquivo && (
            <div style={{ fontSize: 11, color: '#10B981', marginTop: 6 }}>✓ {nfArquivo.name}</div>
          )}

          {erro && (
            <div style={{ marginTop: 14, padding: '10px 14px', background: '#450A0A', border: '1px solid #7F1D1D', borderRadius: 8, color: '#FCA5A5', fontSize: 12 }}>{erro}</div>
          )}
        </div>

        <div style={{ padding: '14px 24px', borderTop: '1px solid #1E2235', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} disabled={salvando} style={{ padding: '8px 18px', borderRadius: 7, border: '1px solid #1E2235', background: 'transparent', color: '#64748B', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
          <button onClick={confirmar} disabled={salvando} style={{ padding: '8px 20px', borderRadius: 7, border: 'none', background: 'linear-gradient(135deg, #10B981, #059669)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: salvando ? 0.6 : 1 }}>
            {salvando ? 'Salvando...' : '✓ Confirmar entrega'}
          </button>
        </div>
      </div>
    </div>
  )
}
