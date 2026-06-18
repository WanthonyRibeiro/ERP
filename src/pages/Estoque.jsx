import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

function fmtData(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
function fmtDataHora(d) {
  if (!d) return '—'
  return new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function Estoque({ session, permissoes }) {
  const [obras,   setObras]   = useState([])
  const [obraId,  setObraId]  = useState('')
  const [saldo,   setSaldo]   = useState([])
  const [movs,    setMovs]    = useState([])
  const [aba,     setAba]     = useState('saldo')
  const [loading, setLoading] = useState(true)
  const [busca,   setBusca]   = useState('')
  const [toast,   setToast]   = useState(null)

  const [saidaModal, setSaidaModal] = useState(null)
  const [ajusteModal, setAjusteModal] = useState(null)
  const [novoItemModal, setNovoItemModal] = useState(false)
  const [editarModal, setEditarModal] = useState(null)
  const [exportando, setExportando] = useState(false)
  const [filtroHist, setFiltroHist] = useState({ inicio: '', fim: '', responsavel: '' })

  useEffect(() => { loadObras() }, [])
  useEffect(() => { if (obraId) loadDados() }, [obraId])

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(null), 3000) }

  async function loadObras() {
    const { data } = await supabase.from('obras').select('id, nome').order('nome')
    setObras(data ?? [])
    if (data?.length) setObraId(data[0].id)
    else setLoading(false)
  }

  async function loadDados() {
    setLoading(true)
    const [r1, r2] = await Promise.all([
      supabase.from('estoque_saldo').select('*').eq('obra_id', obraId).order('insumo_nome'),
      supabase.from('estoque_movimentacoes').select('*').eq('obra_id', obraId).order('created_at', { ascending: false }).limit(100),
    ])
    setSaldo(r1.data ?? [])
    setMovs(r2.data ?? [])
    setLoading(false)
  }

  async function renomearInsumo(insumoAntigo, nomeNovo, unidadeNova) {
    if (!nomeNovo?.trim()) { showToast('Informe o nome do insumo'); return }
    const jaExiste = saldo.find(s => s.id !== insumoAntigo.id && s.insumo_nome.toLowerCase() === nomeNovo.trim().toLowerCase())
    if (jaExiste) { showToast('Já existe outro item com esse nome — não é possível duplicar.'); return }

    const { error } = await supabase.rpc('renomear_insumo_estoque', {
      p_obra_id: obraId,
      p_nome_antigo: insumoAntigo.insumo_nome,
      p_nome_novo: nomeNovo.trim(),
      p_unidade_nova: unidadeNova || insumoAntigo.unidade,
    })
    if (error) { showToast('Erro ao renomear: ' + error.message); return }
    setEditarModal(null)
    showToast('✅ Item atualizado!')
    loadDados()
  }

  async function exportarExcel() {
    setExportando(true)
    try {
      const XLSX = await import('xlsx')
      const obraNome = obras.find(o => o.id === obraId)?.nome ?? 'Obra'

      const saldoRows = saldo.map(s => ({
        'Insumo': s.insumo_nome,
        'Saldo': s.quantidade,
        'Unidade': s.unidade,
        'Atualizado em': s.updated_at ? new Date(s.updated_at).toLocaleDateString('pt-BR') : '',
      }))

      const movsRows = movs.map(m => ({
        'Data': m.created_at ? new Date(m.created_at).toLocaleString('pt-BR') : '',
        'Insumo': m.insumo_nome,
        'Tipo': m.tipo === 'entrada' ? 'Entrada' : m.tipo === 'saida' ? 'Saída' : 'Ajuste',
        'Quantidade': m.quantidade,
        'Unidade': m.unidade,
        'Responsável': m.responsavel_nome ?? '',
        'NF': m.nf_numero ?? '',
        'Observações': m.observacoes ?? '',
      }))

      const wb = XLSX.utils.book_new()
      const wsSaldo = XLSX.utils.json_to_sheet(saldoRows)
      const wsMovs = XLSX.utils.json_to_sheet(movsRows)
      XLSX.utils.book_append_sheet(wb, wsSaldo, 'Saldo Atual')
      XLSX.utils.book_append_sheet(wb, wsMovs, 'Movimentações')
      XLSX.writeFile(wb, `Estoque_${obraNome.replace(/[^a-zA-Z0-9]/g,'_')}_${new Date().toISOString().slice(0,10)}.xlsx`)
      showToast('✅ Excel exportado!')
    } catch (err) {
      showToast('Erro ao exportar: ' + err.message)
    }
    setExportando(false)
  }

  const movsFiltrados = movs.filter(m => {
    if (filtroHist.inicio && m.created_at < filtroHist.inicio) return false
    if (filtroHist.fim && m.created_at > filtroHist.fim + 'T23:59:59') return false
    if (filtroHist.responsavel && !m.responsavel_nome?.toLowerCase().includes(filtroHist.responsavel.toLowerCase())) return false
    return true
  })

  async function registrarNovoItem(nome, quantidade, unidade, observacoes) {
    const qtd = parseFloat(quantidade)
    if (!nome?.trim()) { showToast('Informe o nome do insumo'); return }
    if (!qtd || qtd < 0) { showToast('Quantidade inválida'); return }

    // Verifica se já existe esse insumo no estoque dessa obra
    const jaExiste = saldo.find(s => s.insumo_nome.toLowerCase() === nome.trim().toLowerCase())
    if (jaExiste) {
      showToast('Esse insumo já existe no estoque — use "Ajustar" para alterar a quantidade.')
      return
    }

    const userName = session?.user?.user_metadata?.nome ?? session?.user?.email
    const { error } = await supabase.from('estoque_movimentacoes').insert({
      obra_id: obraId,
      insumo_nome: nome.trim(),
      unidade: unidade || 'un',
      tipo: 'entrada',
      quantidade: qtd,
      origem: 'manual',
      observacoes: observacoes || 'Cadastro inicial de item no estoque',
      responsavel_nome: userName,
      user_id: session.user.id,
    })
    if (error) { showToast('Erro ao cadastrar item'); return }
    setNovoItemModal(false)
    showToast('✅ Item cadastrado no estoque!')
    loadDados()
  }

  async function registrarSaida(insumo, quantidade, observacoes) {
    const qtd = parseFloat(quantidade)
    if (!qtd || qtd <= 0) { showToast('Quantidade inválida'); return }
    if (qtd > insumo.quantidade) { showToast('Quantidade maior que o saldo disponível!'); return }

    const userName = session?.user?.user_metadata?.nome ?? session?.user?.email
    const { error } = await supabase.from('estoque_movimentacoes').insert({
      obra_id: obraId,
      insumo_nome: insumo.insumo_nome,
      unidade: insumo.unidade,
      tipo: 'saida',
      quantidade: qtd,
      origem: 'manual',
      observacoes,
      responsavel_nome: userName,
      user_id: session.user.id,
    })
    if (error) { showToast('Erro ao registrar saída'); return }
    setSaidaModal(null)
    showToast('✅ Saída registrada!')
    loadDados()
  }

  async function registrarAjuste(insumo, novaQtd, observacoes) {
    const qtd = parseFloat(novaQtd)
    if (qtd == null || isNaN(qtd) || qtd < 0) { showToast('Quantidade inválida'); return }
    const diferenca = qtd - insumo.quantidade

    const userName = session?.user?.user_metadata?.nome ?? session?.user?.email
    const { error } = await supabase.from('estoque_movimentacoes').insert({
      obra_id: obraId,
      insumo_nome: insumo.insumo_nome,
      unidade: insumo.unidade,
      tipo: diferenca >= 0 ? 'entrada' : 'saida',
      quantidade: Math.abs(diferenca),
      origem: 'ajuste',
      observacoes: observacoes || `Ajuste manual: ${insumo.quantidade} → ${qtd}`,
      responsavel_nome: userName,
      user_id: session.user.id,
    })
    if (error) { showToast('Erro ao registrar ajuste'); return }
    setAjusteModal(null)
    showToast('✅ Ajuste registrado!')
    loadDados()
  }

  const saldoFiltrado = saldo.filter(s => s.insumo_nome.toLowerCase().includes(busca.toLowerCase()))
  const totalItens = saldo.length
  const itensZerados = saldo.filter(s => s.quantidade <= 0).length

  const selStyle = {
    padding: '7px 14px', borderRadius: 7, border: '1px solid #1E2235',
    background: '#0F1117', color: '#94A3B8', fontSize: 12, outline: 'none', cursor: 'pointer',
  }
  const inp = {
    width: '100%', padding: '8px 12px', borderRadius: 7,
    background: '#0F1117', border: '1px solid #1E2235',
    color: '#F1F5F9', fontSize: 13, outline: 'none', fontFamily: 'inherit',
  }

  return (
    <div style={{ flex: 1, padding: '28px', overflowY: 'auto', color: '#E2E8F0', fontFamily: "'DM Sans', sans-serif" }}>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#F1F5F9', marginBottom: 4 }}>🗃️ Estoque</h1>
          <p style={{ fontSize: 13, color: '#475569' }}>Saldo de insumos por obra e histórico de movimentações.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={exportarExcel} disabled={exportando || !saldo.length} style={{
            padding: '7px 14px', borderRadius: 7, border: '1px solid #1E2235', background: 'transparent',
            color: exportando ? '#334155' : '#10B981', fontSize: 12, fontWeight: 600, cursor: exportando ? 'default' : 'pointer',
            opacity: !saldo.length ? 0.5 : 1,
          }}>
            {exportando ? '⏳ Exportando...' : '📊 Exportar Excel'}
          </button>
          <select style={selStyle} value={obraId} onChange={e => setObraId(e.target.value)}>
            {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
          </select>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { label: 'Itens em estoque', value: totalItens, color: '#3B82F6' },
          { label: 'Itens zerados',    value: itensZerados, color: itensZerados > 0 ? '#EF4444' : '#10B981' },
          { label: 'Movimentações (100 últimas)', value: movs.length, color: '#8B5CF6' },
        ].map(s => (
          <div key={s.label} style={{ background: '#1A1D2E', border: '1px solid #1E2235', borderRadius: 10, padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</span>
            <span style={{ fontSize: 11, color: '#475569' }}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #1E2235', marginBottom: 16 }}>
        {[
          { id: 'saldo', label: 'Saldo Atual' },
          { id: 'historico', label: 'Histórico de Movimentações' },
        ].map(t => (
          <button key={t.id} onClick={() => setAba(t.id)} style={{
            padding: '8px 16px', border: 'none', cursor: 'pointer',
            background: 'transparent',
            color: aba === t.id ? '#F1F5F9' : '#475569',
            fontSize: 13, fontWeight: aba === t.id ? 600 : 400,
            borderBottom: aba === t.id ? '2px solid #3B82F6' : '2px solid transparent',
          }}>{t.label}</button>
        ))}
      </div>

      {loading ? (
        <p style={{ color: '#334155', fontSize: 14 }}>Carregando...</p>
      ) : aba === 'saldo' ? (
        <>
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              style={{ ...inp, maxWidth: 320 }}
              placeholder="🔍 Buscar insumo..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
            />
            <button onClick={() => setNovoItemModal(true)} style={{ padding: '8px 16px', borderRadius: 7, border: 'none', background: 'linear-gradient(135deg, #3B82F6, #6366F1)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              + Novo Item
            </button>
          </div>

          {saldoFiltrado.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#334155' }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>📦</div>
              <p style={{ fontSize: 14, color: '#475569', fontWeight: 600 }}>
                {saldo.length === 0 ? 'Nenhum item em estoque ainda' : 'Nenhum item encontrado'}
              </p>
              {saldo.length === 0 && (
                <p style={{ fontSize: 12, color: '#334155', marginTop: 4 }}>
                  Use "+ Novo Item" para cadastrar manualmente, ou o estoque é abastecido automaticamente quando uma SC é marcada como "Recebido".
                </p>
              )}
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#1A1D2E' }}>
                    {['Insumo', 'Saldo', 'Unidade', 'Atualizado em', ''].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: '#475569', fontWeight: 700, fontSize: 10, textTransform: 'uppercase', borderBottom: '1px solid #1E2235' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {saldoFiltrado.map((s, i) => (
                    <tr key={s.id} style={{ background: i % 2 === 0 ? '#0F1117' : '#0D1020' }}>
                      <td style={{ padding: '10px 14px', color: '#F1F5F9', fontWeight: 600 }}>{s.insumo_nome}</td>
                      <td style={{ padding: '10px 14px', color: s.quantidade <= 0 ? '#EF4444' : '#10B981', fontWeight: 700 }}>{s.quantidade}</td>
                      <td style={{ padding: '10px 14px', color: '#64748B' }}>{s.unidade}</td>
                      <td style={{ padding: '10px 14px', color: '#64748B', whiteSpace: 'nowrap' }}>{fmtData(s.updated_at)}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          <button onClick={() => setEditarModal(s)} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #1E2235', background: 'transparent', color: '#3B82F6', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>✎ Editar</button>
                          <button onClick={() => setSaidaModal(s)} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #450A0A', background: 'transparent', color: '#EF4444', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>− Saída</button>
                          <button onClick={() => setAjusteModal(s)} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #1E2235', background: 'transparent', color: '#64748B', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>⚙ Ajustar</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        // Histórico
        <>
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div>
              <label style={{ fontSize: 11, color: '#475569', display: 'block', marginBottom: 4 }}>De</label>
              <input type="date" style={selStyle} value={filtroHist.inicio} onChange={e => setFiltroHist(f => ({ ...f, inicio: e.target.value }))} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: '#475569', display: 'block', marginBottom: 4 }}>Até</label>
              <input type="date" style={selStyle} value={filtroHist.fim} onChange={e => setFiltroHist(f => ({ ...f, fim: e.target.value }))} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: '#475569', display: 'block', marginBottom: 4 }}>Responsável</label>
              <input style={{ ...selStyle, minWidth: 160 }} placeholder="Buscar por nome..." value={filtroHist.responsavel} onChange={e => setFiltroHist(f => ({ ...f, responsavel: e.target.value }))} />
            </div>
            {(filtroHist.inicio || filtroHist.fim || filtroHist.responsavel) && (
              <button onClick={() => setFiltroHist({ inicio: '', fim: '', responsavel: '' })} style={{ ...selStyle, color: '#EF4444', cursor: 'pointer' }}>✕ Limpar filtros</button>
            )}
          </div>

          {movsFiltrados.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#334155' }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>📜</div>
              <p style={{ fontSize: 14, color: '#475569', fontWeight: 600 }}>
                {movs.length === 0 ? 'Nenhuma movimentação registrada' : 'Nenhuma movimentação encontrada com esses filtros'}
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {movsFiltrados.map(m => {
                const isEntrada = m.tipo === 'entrada'
                return (
                  <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#1A1D2E', border: '1px solid #1E2235', borderRadius: 10, padding: '10px 16px' }}>
                    <span style={{
                      width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: isEntrada ? '#064E3B' : '#450A0A', color: isEntrada ? '#6EE7B7' : '#FCA5A5', fontSize: 14, flexShrink: 0,
                    }}>{isEntrada ? '↓' : '↑'}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#F1F5F9' }}>
                        {m.insumo_nome} — {isEntrada ? '+' : '−'}{m.quantidade} {m.unidade}
                      </div>
                      <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>
                        {m.responsavel_nome ?? '—'} · {fmtDataHora(m.created_at)}
                        {m.origem === 'sc' && m.nf_numero && ` · NF ${m.nf_numero}`}
                        {m.observacoes && ` · ${m.observacoes}`}
                      </div>
                    </div>
                    {m.nf_arquivo_url && (
                      <a href={m.nf_arquivo_url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: '#3B82F6', flexShrink: 0 }}>📄 Ver NF</a>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* Modal Novo Item */}
      {novoItemModal && (
        <ModalNovoItem
          onConfirm={registrarNovoItem}
          onClose={() => setNovoItemModal(false)}
        />
      )}

      {/* Modal Editar Item */}
      {editarModal && (
        <ModalEditarItem
          insumo={editarModal}
          onConfirm={renomearInsumo}
          onClose={() => setEditarModal(null)}
        />
      )}

      {/* Modal Saída */}
      {saidaModal && (
        <ModalMovimento
          titulo={`Registrar saída — ${saidaModal.insumo_nome}`}
          insumo={saidaModal}
          tipo="saida"
          onConfirm={(qtd, obs) => registrarSaida(saidaModal, qtd, obs)}
          onClose={() => setSaidaModal(null)}
        />
      )}

      {/* Modal Ajuste */}
      {ajusteModal && (
        <ModalMovimento
          titulo={`Ajustar saldo — ${ajusteModal.insumo_nome}`}
          insumo={ajusteModal}
          tipo="ajuste"
          onConfirm={(qtd, obs) => registrarAjuste(ajusteModal, qtd, obs)}
          onClose={() => setAjusteModal(null)}
        />
      )}

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

function ModalEditarItem({ insumo, onConfirm, onClose }) {
  const [nome, setNome] = useState(insumo.insumo_nome)
  const [unidade, setUnidade] = useState(insumo.unidade)

  const inp = {
    width: '100%', padding: '8px 12px', borderRadius: 7,
    background: '#0F1117', border: '1px solid #1E2235',
    color: '#F1F5F9', fontSize: 13, outline: 'none', fontFamily: 'inherit',
  }
  const lbl = { fontSize: 11, fontWeight: 600, color: '#64748B', marginBottom: 5, display: 'block' }
  const UNIDADES = ['un', 'kg', 'm', 'm²', 'm³', 'l', 'cx', 'sc', 'pç', 'rl', 'barra']

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{ position: 'fixed', inset: 0, background: '#00000090', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
      <div style={{ background: '#1A1D2E', border: '1px solid #1E2235', borderRadius: 16, width: 420, maxWidth: '95vw', padding: 24 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#F1F5F9', marginBottom: 4 }}>✎ Editar item</div>
        <div style={{ fontSize: 12, color: '#475569', marginBottom: 18 }}>
          Atualiza o nome em todo o histórico de movimentações também.
        </div>

        <label style={lbl}>Nome do insumo</label>
        <input style={{ ...inp, marginBottom: 14 }} value={nome} onChange={e => setNome(e.target.value)} autoFocus />

        <label style={lbl}>Unidade</label>
        <select style={{ ...inp, marginBottom: 18 }} value={unidade} onChange={e => setUnidade(e.target.value)}>
          {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
        </select>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: 7, border: '1px solid #1E2235', background: 'transparent', color: '#64748B', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
          <button onClick={() => onConfirm(insumo, nome, unidade)} style={{ padding: '8px 20px', borderRadius: 7, border: 'none', background: 'linear-gradient(135deg, #3B82F6, #6366F1)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
            Salvar
          </button>
        </div>
      </div>
    </div>
  )
}

function ModalNovoItem({ onConfirm, onClose }) {
  const [nome, setNome] = useState('')
  const [unidade, setUnidade] = useState('un')
  const [quantidade, setQuantidade] = useState('')
  const [obs, setObs] = useState('')

  const inp = {
    width: '100%', padding: '8px 12px', borderRadius: 7,
    background: '#0F1117', border: '1px solid #1E2235',
    color: '#F1F5F9', fontSize: 13, outline: 'none', fontFamily: 'inherit',
  }
  const lbl = { fontSize: 11, fontWeight: 600, color: '#64748B', marginBottom: 5, display: 'block' }

  const UNIDADES = ['un', 'kg', 'm', 'm²', 'm³', 'l', 'cx', 'sc', 'pç', 'rl', 'br12m']

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{ position: 'fixed', inset: 0, background: '#00000090', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
      <div style={{ background: '#1A1D2E', border: '1px solid #1E2235', borderRadius: 16, width: 420, maxWidth: '95vw', padding: 24 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#F1F5F9', marginBottom: 4 }}>+ Cadastrar item no estoque</div>
        <div style={{ fontSize: 12, color: '#475569', marginBottom: 18 }}>Para insumos que ainda não passaram por uma SC.</div>

        <label style={lbl}>Nome do insumo</label>
        <input style={{ ...inp, marginBottom: 14 }} value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Cimento CP-II 50kg" autoFocus />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: 10, marginBottom: 14 }}>
          <div>
            <label style={lbl}>Quantidade</label>
            <input style={inp} type="number" step="any" value={quantidade} onChange={e => setQuantidade(e.target.value)} />
          </div>
          <div>
            <label style={lbl}>Unidade</label>
            <select style={inp} value={unidade} onChange={e => setUnidade(e.target.value)}>
              {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
        </div>

        <label style={lbl}>Observações (opcional)</label>
        <textarea style={{ ...inp, marginBottom: 18, minHeight: 60, resize: 'vertical' }} value={obs} onChange={e => setObs(e.target.value)} placeholder="Ex: Material já existente na obra antes do sistema" />

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: 7, border: '1px solid #1E2235', background: 'transparent', color: '#64748B', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
          <button onClick={() => onConfirm(nome, quantidade, unidade, obs)} style={{ padding: '8px 20px', borderRadius: 7, border: 'none', background: 'linear-gradient(135deg, #3B82F6, #6366F1)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
            Cadastrar
          </button>
        </div>
      </div>
    </div>
  )
}

function ModalMovimento({ titulo, insumo, tipo, onConfirm, onClose }) {
  const [valor, setValor] = useState(tipo === 'ajuste' ? String(insumo.quantidade) : '')
  const [obs,   setObs]   = useState('')

  const inp = {
    width: '100%', padding: '8px 12px', borderRadius: 7,
    background: '#0F1117', border: '1px solid #1E2235',
    color: '#F1F5F9', fontSize: 13, outline: 'none', fontFamily: 'inherit',
  }
  const lbl = { fontSize: 11, fontWeight: 600, color: '#64748B', marginBottom: 5, display: 'block' }

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{ position: 'fixed', inset: 0, background: '#00000090', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
      <div style={{ background: '#1A1D2E', border: '1px solid #1E2235', borderRadius: 16, width: 420, maxWidth: '95vw', padding: 24 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#F1F5F9', marginBottom: 4 }}>{titulo}</div>
        <div style={{ fontSize: 12, color: '#475569', marginBottom: 18 }}>Saldo atual: {insumo.quantidade} {insumo.unidade}</div>

        <label style={lbl}>{tipo === 'ajuste' ? 'Nova quantidade total' : 'Quantidade de saída'}</label>
        <input style={{ ...inp, marginBottom: 14 }} type="number" step="any" value={valor} onChange={e => setValor(e.target.value)} autoFocus />

        <label style={lbl}>Observações {tipo === 'saida' ? '(ex: usado na laje do 2º pav.)' : '(opcional)'}</label>
        <textarea style={{ ...inp, marginBottom: 18, minHeight: 70, resize: 'vertical' }} value={obs} onChange={e => setObs(e.target.value)} />

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: 7, border: '1px solid #1E2235', background: 'transparent', color: '#64748B', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
          <button onClick={() => onConfirm(valor, obs)} style={{ padding: '8px 20px', borderRadius: 7, border: 'none', background: tipo === 'saida' ? '#7F1D1D' : 'linear-gradient(135deg, #3B82F6, #6366F1)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
            Confirmar
          </button>
        </div>
      </div>
    </div>
  )
}
