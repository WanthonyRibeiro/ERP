import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import ObraModal from '../components/ObraModal'

const STATUS_META = {
  em_andamento: { label: 'Em andamento', color: '#10B981', bg: '#064E3B' },
  pausada:      { label: 'Pausada',      color: '#F59E0B', bg: '#451A03' },
  concluida:    { label: 'Concluída',    color: '#6366F1', bg: '#1E1B4B' },
}

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function Obras({ session, permissoes }) {
  const [obras, setObras]   = useState([])
  const [modal, setModal]   = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchObras() }, [permissoes?.isAdmin, JSON.stringify(permissoes?.obrasIds)])

  async function fetchObras() {
    // RLS handles filtering — admin sees owned obras, others see permitted obras
    const { data, error } = await supabase.from('obras').select('*').order('created_at', { ascending: false })
    console.log('obras data:', data, 'error:', error)
    setObras(data ?? [])
    setLoading(false)
  }

  async function handleSave(form) {
    const payload = { ...form, owner_id: session.user.id }
    delete payload.id
    if (form.id) {
      await supabase.from('obras').update(payload).eq('id', form.id)
    } else {
      await supabase.from('obras').insert(payload)
    }
    setModal(null)
    fetchObras()
  }

  async function handleDelete(id) {
    if (!confirm('Excluir esta obra? Isso vai remover também todas as solicitações vinculadas.')) return
    await supabase.from('obras').delete().eq('id', id)
    setModal(null)
    fetchObras()
  }

  const counts = {
    em_andamento: obras.filter(o => o.status === 'em_andamento').length,
    pausada:      obras.filter(o => o.status === 'pausada').length,
    concluida:    obras.filter(o => o.status === 'concluida').length,
  }

  return (
    <div style={{ flex: 1, padding: '28px', overflowY: 'auto', color: '#E2E8F0', fontFamily: "'DM Sans', sans-serif" }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#F1F5F9', marginBottom: 4 }}>Obras</h1>
          <p style={{ fontSize: 13, color: '#475569' }}>Gerencie seus canteiros e acompanhe o status geral.</p>
        </div>
        <button onClick={() => setModal({})} style={{
          padding: '9px 18px', borderRadius: 8, border: 'none',
          background: 'linear-gradient(135deg, #3B82F6, #6366F1)',
          color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer',
        }}>+ Nova Obra</button>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        {Object.entries(STATUS_META).map(([key, meta]) => (
          <div key={key} style={{
            background: '#1A1D2E', border: '1px solid #1E2235',
            borderRadius: 10, padding: '12px 18px',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{ fontSize: 22, fontWeight: 700, color: meta.color }}>{counts[key]}</span>
            <span style={{ fontSize: 12, color: '#475569' }}>{meta.label}</span>
          </div>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <p style={{ color: '#334155', fontSize: 14 }}>Carregando...</p>
      ) : obras.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#334155' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🏗️</div>
          <p style={{ fontSize: 15, fontWeight: 600, color: '#475569' }}>Nenhuma obra cadastrada</p>
          <p style={{ fontSize: 13, color: '#334155', marginTop: 4 }}>Clique em "+ Nova Obra" para começar.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {obras.map(obra => {
            const meta = STATUS_META[obra.status] ?? STATUS_META.em_andamento
            return (
              <div
                key={obra.id}
                onClick={() => setModal(obra)}
                style={{
                  background: '#1A1D2E', border: '1px solid #1E2235', borderRadius: 12,
                  padding: '16px 20px', cursor: 'pointer', transition: 'border-color 0.15s',
                  display: 'flex', alignItems: 'center', gap: 16,
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = '#3B82F640'}
                onMouseLeave={e => e.currentTarget.style.borderColor = '#1E2235'}
              >
                <div style={{
                  width: 42, height: 42, borderRadius: 10, flexShrink: 0,
                  background: 'linear-gradient(135deg, #1E3A5F, #1E1B4B)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 20,
                }}>🏗️</div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: '#F1F5F9', marginBottom: 3 }}>{obra.nome}</div>
                  {obra.endereco && <div style={{ fontSize: 12, color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{obra.endereco}</div>}
                </div>

                <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexShrink: 0 }}>
                  {obra.data_prevista && (
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 10, color: '#334155' }}>Previsão</div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#94A3B8' }}>{fmtDate(obra.data_prevista)}</div>
                    </div>
                  )}
                  <div style={{
                    padding: '4px 10px', borderRadius: 20,
                    background: meta.bg, color: meta.color,
                    fontSize: 11, fontWeight: 600,
                  }}>{meta.label}</div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {modal !== null && (
        <ObraModal
          obra={modal.id ? modal : null}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
