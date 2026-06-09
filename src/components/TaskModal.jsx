import { useState } from 'react'
import { getCategoryColor } from './Gantt'

const CATEGORIES_DEFAULT = ['Geral','Estrutura','Alvenaria','Hidráulica','Elétrica','Revestimento','Pintura','Cobertura','Fundação','Acabamento','Instalações','Esquadrias','Gesso','Porcelanato','Vinílico']

const inp = {
  width: '100%', padding: '9px 12px', borderRadius: 8,
  background: '#0F1117', border: '1px solid #1E2235',
  color: '#F1F5F9', fontSize: 13, marginBottom: 16, outline: 'none',
}

export default function TaskModal({ task, onSave, onDelete, onClose, extraCategories = [], allTasks = [] }) {
  const isNew = !task?.id

  const [form, setForm] = useState({
    label:          task?.label          ?? '',
    category:       task?.category       ?? 'Geral',
    start_date:     task?.start_date     ?? '',
    end_date:       task?.end_date       ?? '',
    progress:       task?.progress       ?? 0,
    responsible:    task?.responsible    ?? '',
    notes:          task?.notes          ?? '',
    predecessora_id: task?.predecessora_id ?? '',
    dep_tipo:       task?.dep_tipo       ?? 'FS',
    dep_lag:        task?.dep_lag        ?? 0,
  })

  const allCategories = [...new Set([...CATEGORIES_DEFAULT, ...extraCategories])]
  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  // Tarefas disponíveis como predecessora (exceto a própria)
  const tarefasDisponiveis = allTasks.filter(t => t.id !== task?.id)

  function handleSave() {
    if (!form.label || !form.start_date || !form.end_date) return
    onSave({
      ...task,
      ...form,
      predecessora_id: form.predecessora_id || null,
      dep_lag: parseInt(form.dep_lag) || 0,
    })
  }

  const lbl = { fontSize: 12, fontWeight: 600, color: '#64748B', marginBottom: 6, display: 'block' }
  const col = getCategoryColor(form.category)

  const predecessora = tarefasDisponiveis.find(t => t.id === form.predecessora_id)

  // Calcula data mínima de início baseada na predecessora
  function calcMinStart() {
    if (!predecessora) return null
    const predEnd = new Date(predecessora.end_date + 'T00:00:00')
    const lag = parseInt(form.dep_lag) || 0
    if (form.dep_tipo === 'FS') {
      predEnd.setDate(predEnd.getDate() + 1 + lag)
      return predEnd.toISOString().slice(0, 10)
    }
    if (form.dep_tipo === 'SS') {
      const predStart = new Date(predecessora.start_date + 'T00:00:00')
      predStart.setDate(predStart.getDate() + lag)
      return predStart.toISOString().slice(0, 10)
    }
    return null
  }

  const minStart = calcMinStart()
  const startConflito = minStart && form.start_date && form.start_date < minStart

  return (
    <div
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{
        position: 'fixed', inset: 0, background: '#00000090',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        padding: 16,
      }}
    >
      <div style={{
        background: '#1A1D2E', border: '1px solid #1E2235',
        borderRadius: 16, padding: '28px 28px 24px',
        width: 480, maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: col }} />
            <span style={{ fontSize: 16, fontWeight: 700, color: '#F1F5F9' }}>
              {isNew ? 'Nova tarefa' : 'Editar tarefa'}
            </span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#475569', fontSize: 22, cursor: 'pointer' }}>×</button>
        </div>

        <label style={lbl}>Nome da tarefa</label>
        <input style={inp} value={form.label} onChange={e => set('label', e.target.value)} placeholder="Ex: EST- TÉRREO" />

        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={lbl}>Categoria</label>
            <select style={{ ...inp, marginBottom: 16 }} value={form.category} onChange={e => set('category', e.target.value)}>
              {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={lbl}>Responsável</label>
            <input style={inp} value={form.responsible ?? ''} onChange={e => set('responsible', e.target.value)} placeholder="Nome (opcional)" />
          </div>
        </div>

        {/* Dependência */}
        <div style={{ background: '#0F1117', border: '1px solid #1E2235', borderRadius: 10, padding: '14px', marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#64748B', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            🔗 Dependência (predecessora)
          </div>

          <label style={{ ...lbl, marginBottom: 4 }}>Tarefa predecessora</label>
          <select
            style={{ ...inp, marginBottom: 10 }}
            value={form.predecessora_id}
            onChange={e => set('predecessora_id', e.target.value)}
          >
            <option value="">— Sem dependência —</option>
            {tarefasDisponiveis.map(t => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>

          {form.predecessora_id && (
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={{ ...lbl, marginBottom: 4 }}>Tipo</label>
                <select style={{ ...inp, marginBottom: 0, fontSize: 12 }} value={form.dep_tipo} onChange={e => set('dep_tipo', e.target.value)}>
                  <option value="FS">FS — Fim → Início (padrão)</option>
                  <option value="SS">SS — Início → Início</option>
                  <option value="FF">FF — Fim → Fim</option>
                  <option value="SF">SF — Início → Fim</option>
                </select>
              </div>
              <div style={{ width: 80 }}>
                <label style={{ ...lbl, marginBottom: 4 }}>Lag (dias)</label>
                <input
                  style={{ ...inp, marginBottom: 0, fontSize: 12 }}
                  type="number"
                  value={form.dep_lag}
                  onChange={e => set('dep_lag', e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>
          )}

          {predecessora && (
            <div style={{ marginTop: 10, fontSize: 11, color: '#475569', padding: '8px 10px', background: '#1A1D2E', borderRadius: 7 }}>
              <span style={{ color: '#64748B' }}>Predecessora: </span>
              <span style={{ color: '#94A3B8', fontWeight: 600 }}>{predecessora.label}</span>
              <span style={{ color: '#334155' }}> · {predecessora.start_date} → {predecessora.end_date}</span>
            </div>
          )}
        </div>

        {/* Datas */}
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={lbl}>Início</label>
            <input
              style={{ ...inp, borderColor: startConflito ? '#EF4444' : '#1E2235' }}
              type="date"
              value={form.start_date}
              min={minStart ?? undefined}
              onChange={e => set('start_date', e.target.value)}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={lbl}>Fim</label>
            <input
              style={inp}
              type="date"
              value={form.end_date}
              min={form.start_date ?? undefined}
              onChange={e => set('end_date', e.target.value)}
            />
          </div>
        </div>

        {startConflito && (
          <div style={{ marginTop: -12, marginBottom: 16, padding: '8px 12px', borderRadius: 7, background: '#450A0A', border: '1px solid #991B1B', fontSize: 12, color: '#FCA5A5' }}>
            ⚠️ Esta tarefa não pode iniciar antes de <strong>{minStart}</strong> (restrição da predecessora)
          </div>
        )}

        {/* Progresso */}
        <div style={{ marginBottom: 16 }}>
          <label style={lbl}>Progresso</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <input
              style={{ flex: 1, accentColor: col }}
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
                  color: col, fontSize: 13, fontWeight: 700,
                  outline: 'none', textAlign: 'center', fontFamily: 'inherit',
                }}
              />
              <span style={{ fontSize: 12, fontWeight: 700, color: col }}>%</span>
            </div>
          </div>
        </div>

        <label style={lbl}>Observações</label>
        <textarea
          style={{ ...inp, resize: 'vertical', minHeight: 72, fontFamily: 'inherit' }}
          value={form.notes ?? ''} onChange={e => set('notes', e.target.value)}
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
              background: `linear-gradient(135deg, ${col}, ${col}99)`,
              color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer',
            }}>{isNew ? 'Adicionar' : 'Salvar'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
