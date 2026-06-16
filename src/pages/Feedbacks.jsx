import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

function fmtData(d) {
  return new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function Feedbacks({ session }) {
  const [feedbacks, setFeedbacks] = useState([])
  const [loading,   setLoading]   = useState(true)
  const [filtro,    setFiltro]    = useState('todos')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('feedbacks').select('*').order('created_at', { ascending: false })
    setFeedbacks(data ?? [])
    setLoading(false)
  }

  async function marcarResolvido(id, resolvido) {
    await supabase.from('feedbacks').update({ resolvido }).eq('id', id)
    load()
  }

  async function excluir(id) {
    if (!confirm('Excluir este feedback?')) return
    await supabase.from('feedbacks').delete().eq('id', id)
    load()
  }

  const filtered = feedbacks.filter(f => {
    if (filtro === 'pendentes') return !f.resolvido
    if (filtro === 'resolvidos') return f.resolvido
    return true
  })

  const selStyle = {
    padding: '7px 14px', borderRadius: 7, border: '1px solid #1E2235',
    background: '#0F1117', color: '#94A3B8', fontSize: 12, cursor: 'pointer',
  }

  return (
    <div style={{ flex: 1, padding: '28px', overflowY: 'auto', color: '#E2E8F0', fontFamily: "'DM Sans', sans-serif" }}>

      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#F1F5F9', marginBottom: 4 }}>🐛 Bugs &amp; Melhorias</h1>
        <p style={{ fontSize: 13, color: '#475569' }}>Reportes enviados pelos usuários através do botão de feedback.</p>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { label: 'Total',      value: feedbacks.length,                          color: '#3B82F6' },
          { label: 'Pendentes',  value: feedbacks.filter(f => !f.resolvido).length, color: '#F59E0B' },
          { label: 'Resolvidos', value: feedbacks.filter(f => f.resolvido).length,  color: '#10B981' },
        ].map(s => (
          <div key={s.label} style={{ background: '#1A1D2E', border: '1px solid #1E2235', borderRadius: 10, padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</span>
            <span style={{ fontSize: 11, color: '#475569' }}>{s.label}</span>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {[
          { id: 'todos',      label: 'Todos' },
          { id: 'pendentes',  label: 'Pendentes' },
          { id: 'resolvidos', label: 'Resolvidos' },
        ].map(f => (
          <button key={f.id} onClick={() => setFiltro(f.id)} style={{
            ...selStyle,
            background: filtro === f.id ? '#1E3A5F' : '#0F1117',
            color: filtro === f.id ? '#93C5FD' : '#94A3B8',
            border: filtro === f.id ? '1px solid #3B82F6' : '1px solid #1E2235',
          }}>{f.label}</button>
        ))}
      </div>

      {loading ? (
        <p style={{ color: '#334155', fontSize: 14 }}>Carregando...</p>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#334155' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🐛</div>
          <p style={{ fontSize: 15, fontWeight: 600, color: '#475569' }}>Nenhum feedback encontrado</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(f => (
            <div key={f.id} style={{
              background: '#1A1D2E', border: '1px solid #1E2235', borderRadius: 10,
              padding: '14px 18px', opacity: f.resolvido ? 0.6 : 1,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: '#F1F5F9', marginBottom: 6, whiteSpace: 'pre-wrap' }}>{f.mensagem}</div>
                  <div style={{ display: 'flex', gap: 12, fontSize: 11, color: '#475569' }}>
                    <span>{f.user_nome ?? 'Anônimo'}</span>
                    <span>{fmtData(f.created_at)}</span>
                    {f.pagina && <span>📍 {f.pagina}</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button onClick={() => marcarResolvido(f.id, !f.resolvido)} style={{
                    padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                    border: f.resolvido ? '1px solid #334155' : '1px solid #10B981',
                    background: 'transparent', color: f.resolvido ? '#64748B' : '#10B981',
                  }}>{f.resolvido ? '↺ Reabrir' : '✓ Resolver'}</button>
                  <button onClick={() => excluir(f.id)} style={{
                    padding: '5px 10px', borderRadius: 6, border: '1px solid #450A0A',
                    background: 'transparent', color: '#EF4444', fontSize: 11, cursor: 'pointer',
                  }}>×</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
