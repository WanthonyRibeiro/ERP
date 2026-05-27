    import { useState } from 'react'

const CATEGORIES = ['Porcelanato','Instalações','Vinílico','Esquadrias','Gesso','Pintura','Acabamento','Geral']

const COLORS = {
  Porcelanato: '#3B82F6', Instalações: '#8B5CF6', Vinílico: '#10B981',
  Esquadrias: '#F59E0B', Gesso: '#6366F1', Pintura: '#EC4899',
  Acabamento: '#14B8A6', Geral: '#64748B',
}

const inp = {
  width: '100%', padding: '9px 12px', borderRadius: 8,
  background: '#0F1117', border: '1px solid #1E2235',
  color: '#F1F5F9', fontSize: 13, marginBottom: 16, outline: 'none',
}

export default function TaskModal({ task, onSave, onDelete, onClose }) {
  const isNew = !task?.id

  const [form, setForm] = useState({
    label:       task?.label       ?? '',
    category:    task?.category    ?? 'Geral',
    start_date:  task?.start_date  ?? '',
    end_date:    task?.end_date    ?? '',
    progress:    task?.progress    ?? 0,
    responsible: task?.responsible ?? '',
    notes:       task?.notes       ?? '',
  })

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  function handleSave() {
    if (!form.label || !form.start_date || !form.end_date) return
    onSave({ ...task, ...form })
  }

  const lbl = { fontSize: 12, fontWeight: 600, color: '#64748B', marginBottom: 6, display: 'block' }

  return (
    <div
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{
        position: 'fixed', inset: 0, background: '#00000090',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
      }}
    >
      <div style={{
        background: '#1A1D2E', border: '1px solid #1E2235',
        borderRadius: 16, padding: '28px 28px 24px',
        width: 440, maxWidth: '95vw',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#F1F5F9' }}>
            {isNew ? 'Nova tarefa' : 'Editar tarefa'}
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#475569', fontSize: 22, cursor: 'pointer' }}>×</button>
        </div>

        <label style={lbl}>Nome da tarefa</label>
        <input style={inp} value={form.label} onChange={e => set('label', e.target.value)} placeholder="Ex: Porcelanato 3º pavimento" />

        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={lbl}>Categoria</label>
            <select style={{ ...inp, marginBottom: 16 }} value={form.category} onChange={e => set('category', e.target.value)}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={lbl}>Responsável</label>
            <input style={inp} value={form.responsible} onChange={e => set('responsible', e.target.value)} placeholder="Nome (opcional)" />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={lbl}>Início</label>
            <input style={inp} type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={lbl}>Fim</label>
            <input style={inp} type="date" value={form.end_date} onChange={e => set('end_date', e.target.value)} />
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={lbl}>Progresso</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <input
              style={{ flex: 1, accentColor: '#3B82F6' }}
              type="range" min={0} max={100}
              value={form.progress}
              onChange={e => set('progress', Number(e.target.value))}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
              <input
                type="number" min={0} max={100}
                value={form.progress}
                onChange={e => set('progress', Math.min(100, Math.max(0, Number(e.target.value))))}
                style={{
                  width: 56, padding: '5px 8px', borderRadius: 7,
                  background: '#0F1117', border: '1px solid #1E2235',
                  color: '#3B82F6', fontSize: 13, fontWeight: 700,
                  outline: 'none', textAlign: 'center', fontFamily: 'inherit',
                }}
              />
              <span style={{ fontSize: 12, fontWeight: 700, color: '#3B82F6' }}>%</span>
            </div>
          </div>
        </div>

        <label style={lbl}>Observações</label>
        <textarea
          style={{ ...inp, resize: 'vertical', minHeight: 72, fontFamily: 'inherit' }}
          value={form.notes} onChange={e => set('notes', e.target.value)}
          placeholder="Notas, pendências, detalhes..."
        />

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
          <div>
            {!isNew && (
              <button onClick={() => onDelete(task.id)} style={{
                padding: '9px 20px', borderRadius: 8, border: '1px solid #991B1B',
                background: 'transparent', color: '#FCA5A5', fontWeight: 600, fontSize: 13, cursor: 'pointer',
              }}>Excluir</button>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={{
              padding: '9px 20px', borderRadius: 8, border: '1px solid #1E2235',
              background: 'transparent', color: '#64748B', fontWeight: 600, fontSize: 13, cursor: 'pointer',
            }}>Cancelar</button>
            <button onClick={handleSave} style={{
              padding: '9px 20px', borderRadius: 8, border: 'none',
              background: 'linear-gradient(135deg, #3B82F6, #6366F1)',
              color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer',
            }}>{isNew ? 'Adicionar' : 'Salvar'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

    
