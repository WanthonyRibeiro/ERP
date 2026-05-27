import { useState } from 'react'

const inp = {
  width: '100%', padding: '9px 12px', borderRadius: 8,
  background: '#0F1117', border: '1px solid #1E2235',
  color: '#F1F5F9', fontSize: 13, marginBottom: 14, outline: 'none',
  fontFamily: 'inherit',
}
const lbl = { fontSize: 12, fontWeight: 600, color: '#64748B', marginBottom: 5, display: 'block' }

export default function ObraModal({ obra, onSave, onClose }) {
  const isNew = !obra?.id
  const [form, setForm] = useState({
    nome:          obra?.nome          ?? '',
    endereco:      obra?.endereco      ?? '',
    status:        obra?.status        ?? 'em_andamento',
    data_inicio:   obra?.data_inicio   ?? '',
    data_prevista: obra?.data_prevista ?? '',
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const STATUS_OPTS = [
    { value: 'em_andamento', label: 'Em andamento' },
    { value: 'pausada',      label: 'Pausada'      },
    { value: 'concluida',    label: 'Concluída'    },
  ]

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{
      position: 'fixed', inset: 0, background: '#00000090',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}>
      <div style={{
        background: '#1A1D2E', border: '1px solid #1E2235',
        borderRadius: 16, padding: '28px', width: 420, maxWidth: '95vw',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#F1F5F9' }}>
            {isNew ? 'Nova obra' : 'Editar obra'}
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#475569', fontSize: 22, cursor: 'pointer' }}>×</button>
        </div>

        <label style={lbl}>Nome da obra *</label>
        <input style={inp} value={form.nome} onChange={e => set('nome', e.target.value)} placeholder="Ex: Residencial Gênova" />

        <label style={lbl}>Endereço</label>
        <input style={inp} value={form.endereco} onChange={e => set('endereco', e.target.value)} placeholder="Rua, número, bairro" />

        <label style={lbl}>Status</label>
        <select style={{ ...inp }} value={form.status} onChange={e => set('status', e.target.value)}>
          {STATUS_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={lbl}>Data de início</label>
            <input style={inp} type="date" value={form.data_inicio} onChange={e => set('data_inicio', e.target.value)} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={lbl}>Previsão de entrega</label>
            <input style={inp} type="date" value={form.data_prevista} onChange={e => set('data_prevista', e.target.value)} />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
          <button onClick={onClose} style={{
            padding: '9px 20px', borderRadius: 8, border: '1px solid #1E2235',
            background: 'transparent', color: '#64748B', fontWeight: 600, fontSize: 13, cursor: 'pointer',
          }}>Cancelar</button>
          <button onClick={() => form.nome && onSave({ ...obra, ...form })} style={{
            padding: '9px 20px', borderRadius: 8, border: 'none',
            background: 'linear-gradient(135deg, #3B82F6, #6366F1)',
            color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer',
          }}>{isNew ? 'Criar obra' : 'Salvar'}</button>
        </div>
      </div>
    </div>
  )
}
