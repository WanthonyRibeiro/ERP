import { useState, useEffect } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabase'
import Gantt, { CATEGORY_COLORS } from '../components/Gantt'
import TaskModal from '../components/TaskModal'

// Converts Excel serial date to YYYY-MM-DD string
function excelDateToISO(val) {
  if (typeof val === 'string' && /\d{4}-\d{2}-\d{2}/.test(val)) return val
  if (val instanceof Date) return val.toISOString().slice(0, 10)
  if (typeof val === 'number') {
    const d = new Date(Math.round((val - 25569) * 86400 * 1000))
    return d.toISOString().slice(0, 10)
  }
  return String(val)
}

const CATEGORIES = ['Todas', ...Object.keys(CATEGORY_COLORS)]

export default function Dashboard({ session }) {
  const [tasks,      setTasks]      = useState([])
  const [projectId,  setProjectId]  = useState(null)
  const [loading,    setLoading]    = useState(true)
  const [modal,      setModal]      = useState(null) // null | task object (empty = new)
  const [filter,     setFilter]     = useState('Todas')
  const [toast,      setToast]      = useState(null)

  // ── Bootstrap: get or create default project ──────────────────────────────
  useEffect(() => {
    async function init() {
      let { data: projects } = await supabase
        .from('projects').select('id').eq('owner_id', session.user.id).limit(1)

      let pid = projects?.[0]?.id

      if (!pid) {
        const { data } = await supabase.from('projects')
          .insert({ name: 'Gênova', owner_id: session.user.id })
          .select('id').single()
        pid = data?.id
      }

      setProjectId(pid)
      await fetchTasks(pid)
      setLoading(false)
    }
    init()
  }, [])

  async function fetchTasks(pid) {
    const { data } = await supabase
      .from('tasks').select('*')
      .eq('project_id', pid ?? projectId)
      .order('start_date')
    setTasks(data ?? [])
  }

  function showToast(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  // ── CRUD ──────────────────────────────────────────────────────────────────
  async function handleSave(form) {
    const payload = { ...form, project_id: projectId }
    delete payload.id

    if (form.id) {
      await supabase.from('tasks').update(payload).eq('id', form.id)
      showToast('Tarefa atualizada!')
    } else {
      await supabase.from('tasks').insert(payload)
      showToast('Tarefa adicionada!')
    }

    setModal(null)
    fetchTasks()
  }

  async function handleDelete(id) {
    await supabase.from('tasks').delete().eq('id', id)
    setModal(null)
    fetchTasks()
    showToast('Tarefa excluída.', 'info')
  }

  // ── Import ─────────────────────────────────────────────────────────────────
  async function handleImport(e) {
    const file = e.target.files[0]
    if (!file) return
    const buf  = await file.arrayBuffer()
    const wb   = XLSX.read(buf)
    const ws   = wb.Sheets[wb.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1 })

    const toInsert = []
    for (const row of rows) {
      // Try to detect rows with at least 3 non-empty cells
      const cells = row.filter(c => c !== null && c !== undefined && c !== '')
      if (cells.length < 3) continue

      // Heuristic: if first or second cell is a number (date serial) it's a task row
      const hasDateLike = row.slice(0, 4).some(c => typeof c === 'number' && c > 40000 && c < 60000)
      const hasText     = row.some(c => typeof c === 'string' && c.trim().length > 4)
      if (!hasDateLike || !hasText) continue

      const label = row.find(c => typeof c === 'string' && c.trim().length > 4)?.trim()
      const dates = row.filter(c => typeof c === 'number' && c > 40000 && c < 60000)
      if (!label || dates.length < 1) continue

      const startDate = excelDateToISO(dates[0])
      const endDate   = excelDateToISO(dates[dates.length - 1])

      toInsert.push({ project_id: projectId, label, category: 'Geral', start_date: startDate, end_date: endDate, progress: 0 })
    }

    if (toInsert.length) {
      await supabase.from('tasks').insert(toInsert)
      await fetchTasks()
      showToast(`${toInsert.length} tarefas importadas!`)
    } else {
      showToast('Nenhuma tarefa encontrada no arquivo.', 'warn')
    }
    e.target.value = ''
  }

  // ── Export ─────────────────────────────────────────────────────────────────
  function handleExport() {
    const rows = tasks.map(t => ({
      Tarefa:       t.label,
      Categoria:    t.category,
      Início:       t.start_date,
      Fim:          t.end_date,
      Progresso:    `${t.progress}%`,
      Responsável:  t.responsible ?? '',
      Observações:  t.notes ?? '',
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Cronograma')
    XLSX.writeFile(wb, 'Cronograma_Genova.xlsx')
    showToast('Arquivo exportado!')
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0F1117', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#475569', fontSize: 14 }}>Carregando tarefas...</div>
    </div>
  )

  const btnBase = {
    padding: '7px 14px', borderRadius: 8, border: 'none',
    fontSize: 12, fontWeight: 600, cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: 5,
  }

  const totalTasks    = tasks.length
  const doneTasks     = tasks.filter(t => t.progress === 100).length
  const inProgressTasks = tasks.filter(t => t.progress > 0 && t.progress < 100).length

  return (
    <div style={{ minHeight: '100vh', background: '#0F1117', color: '#E2E8F0', fontFamily: "'DM Sans', sans-serif" }}>

      {/* Header */}
      <div style={{
        background: '#1A1D2E', borderBottom: '1px solid #1E2235',
        padding: '14px 24px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 8,
            background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 17, fontWeight: 800, color: '#fff',
          }}>G</div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#F1F5F9' }}>Gênova Cronograma</div>
            <div style={{ fontSize: 11, color: '#475569' }}>{session.user.email}</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => setModal({})} style={{ ...btnBase, background: 'linear-gradient(135deg, #3B82F6, #6366F1)', color: '#fff' }}>
            + Nova Tarefa
          </button>

          {/* Import */}
          <label style={{ ...btnBase, background: '#1E2235', color: '#94A3B8', cursor: 'pointer' }}>
            ↑ Importar Excel
            <input type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleImport} />
          </label>

          <button onClick={handleExport} style={{ ...btnBase, background: '#1E2235', color: '#94A3B8' }}>
            ↓ Exportar Excel
          </button>

          <button onClick={() => supabase.auth.signOut()} style={{ ...btnBase, background: 'transparent', color: '#475569', border: '1px solid #1E2235' }}>
            Sair
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 12, padding: '14px 24px', borderBottom: '1px solid #1E2235' }}>
        {[
          { label: 'Total',       value: totalTasks,      color: '#3B82F6' },
          { label: 'Em andamento', value: inProgressTasks, color: '#F59E0B' },
          { label: 'Concluídas',  value: doneTasks,        color: '#10B981' },
        ].map(s => (
          <div key={s.label} style={{
            background: '#1A1D2E', border: '1px solid #1E2235', borderRadius: 10,
            padding: '10px 18px', display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.value}</span>
            <span style={{ fontSize: 12, color: '#475569' }}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* Category filter */}
      <div style={{ display: 'flex', gap: 6, padding: '12px 24px', flexWrap: 'wrap', borderBottom: '1px solid #1E2235' }}>
        {CATEGORIES.map(cat => {
          const active = filter === cat
          const color  = cat === 'Todas' ? '#3B82F6' : CATEGORY_COLORS[cat]
          return (
            <button key={cat} onClick={() => setFilter(cat)} style={{
              padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              border: active ? `1.5px solid ${color}` : '1.5px solid #1E2235',
              background: active ? `${color}22` : 'transparent',
              color: active ? color : '#64748B',
            }}>{cat}</button>
          )
        })}
      </div>

      {/* Gantt */}
      <Gantt tasks={tasks} filter={filter} onTaskClick={task => setModal(task)} />

      {/* Modal */}
      {modal !== null && (
        <TaskModal
          task={modal.id ? modal : null}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => setModal(null)}
        />
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24,
          background: toast.type === 'success' ? '#064E3B' : toast.type === 'warn' ? '#451A03' : '#1E2235',
          border: `1px solid ${toast.type === 'success' ? '#065F46' : toast.type === 'warn' ? '#92400E' : '#334155'}`,
          color: toast.type === 'success' ? '#6EE7B7' : toast.type === 'warn' ? '#FCD34D' : '#94A3B8',
          padding: '10px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600,
          boxShadow: '0 8px 24px #00000060', zIndex: 2000,
        }}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}
