import React, { useState, useEffect } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabase'
import Gantt, { CATEGORY_COLORS } from '../components/Gantt'
import TaskModal from '../components/TaskModal'

const CATEGORIES = ['Todas', ...Object.keys(CATEGORY_COLORS)]

function excelDateToISO(val) {
  if (typeof val === 'string' && /\d{4}-\d{2}-\d{2}/.test(val)) return val
  if (val instanceof Date) return val.toISOString().slice(0, 10)
  if (typeof val === 'number') {
    const d = new Date(Math.round((val - 25569) * 86400 * 1000))
    return d.toISOString().slice(0, 10)
  }
  return String(val)
}

const STATUS_META = {
  em_andamento: { label: 'Em andamento', color: '#10B981', bg: '#064E3B' },
  pausada:      { label: 'Pausada',      color: '#F59E0B', bg: '#451A03' },
  concluida:    { label: 'Concluída',    color: '#6366F1', bg: '#1E1B4B' },
}

// ── Lista de obras ────────────────────────────────────────────────────────
function ObrasList({ obras, onSelect, loading }) {
  if (loading) return (
    <div style={{ padding: 60, textAlign: 'center', color: '#334155', fontSize: 14 }}>Carregando obras...</div>
  )
  if (!obras.length) return (
    <div style={{ textAlign: 'center', padding: '60px 0' }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>📅</div>
      <p style={{ fontSize: 15, fontWeight: 600, color: '#475569' }}>Nenhuma obra cadastrada</p>
      <p style={{ fontSize: 13, color: '#334155', marginTop: 4 }}>Cadastre obras no módulo Obras primeiro.</p>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {obras.map(obra => {
        const meta = STATUS_META[obra.status] ?? STATUS_META.em_andamento
        return (
          <div
            key={obra.id}
            onClick={() => onSelect(obra)}
            style={{
              background: '#1A1D2E', border: '1px solid #1E2235', borderRadius: 12,
              padding: '18px 22px', cursor: 'pointer', transition: 'all 0.15s',
              display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#3B82F640'; e.currentTarget.style.background = '#1E2235' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#1E2235'; e.currentTarget.style.background = '#1A1D2E' }}
          >
            <div style={{
              width: 48, height: 48, borderRadius: 12, flexShrink: 0,
              background: 'linear-gradient(135deg, #1E3A5F, #1E1B4B)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
            }}>📅</div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#F1F5F9', marginBottom: 4 }}>{obra.nome}</div>
              {obra.endereco && <div style={{ fontSize: 12, color: '#475569' }}>{obra.endereco}</div>}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
              <div style={{
                padding: '4px 12px', borderRadius: 20,
                background: meta.bg, color: meta.color,
                fontSize: 11, fontWeight: 600,
              }}>{meta.label}</div>
              <div style={{ fontSize: 20, color: '#334155' }}>›</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}


// ── Alertas de boletos ────────────────────────────────────────────────────
function BoletosAlerta({ obraId }) {
  const [boletos, setBoletos] = React.useState([])

  React.useEffect(() => {
    async function load() {
      const { data } = await supabase.from('boletos').select('descricao,valor,vencimento,status').eq('obra_id', obraId).neq('status','pago').order('vencimento')
      const today = new Date(); today.setHours(0,0,0,0)
      const alertas = (data??[]).filter(b => {
        const dt = new Date(b.vencimento+'T00:00:00')
        const diff = Math.round((dt-today)/86400000)
        return diff <= 30
      })
      setBoletos(alertas)
    }
    load()
  }, [obraId])

  if (!boletos.length) return null

  return (
    <div style={{ padding: '10px 24px', borderBottom: '1px solid #1E2235', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {boletos.map((b,i) => {
        const dt = new Date(b.vencimento+'T00:00:00')
        const today = new Date(); today.setHours(0,0,0,0)
        const diff = Math.round((dt-today)/86400000)
        const vencido = diff < 0
        return (
          <div key={i} style={{
            padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
            background: vencido ? '#450A0A' : diff <= 7 ? '#450A0A' : '#451A03',
            color: vencido ? '#FCA5A5' : diff <= 7 ? '#FCA5A5' : '#FCD34D',
            border: `1px solid ${vencido ? '#991B1B' : diff <= 7 ? '#991B1B' : '#92400E'}`,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <span>{vencido ? '⚠️' : '📄'}</span>
            <span>{b.descricao}: {vencido ? `vencido há ${Math.abs(diff)}d` : `vence em ${diff}d`}</span>
            <span style={{ opacity: 0.7 }}>({Number(b.valor||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})})</span>
          </div>
        )
      })}
    </div>
  )
}

// ── Gantt de uma obra ─────────────────────────────────────────────────────
function ObraGantt({ obra, session, onBack }) {
  const [tasks,   setTasks]   = useState([])
  const [modal,   setModal]   = useState(null)
  const [filter,  setFilter]  = useState('Todas')
  const [loading, setLoading] = useState(true)
  const [toast,   setToast]   = useState(null)

  useEffect(() => { fetchTasks() }, [obra.id])

  async function fetchTasks() {
    setLoading(true)
    const { data } = await supabase
      .from('tasks').select('*')
      .eq('obra_id', obra.id)
      .order('start_date')
    setTasks(data ?? [])
    setLoading(false)
  }

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  async function handleSave(form) {
    const payload = { ...form, obra_id: obra.id }
    delete payload.id
    if (form.id) {
      await supabase.from('tasks').update(payload).eq('id', form.id)
    } else {
      await supabase.from('tasks').insert(payload)
    }
    setModal(null)
    fetchTasks()
    showToast(form.id ? 'Tarefa atualizada!' : 'Tarefa adicionada!')
  }

  async function handleDelete(id) {
    await supabase.from('tasks').delete().eq('id', id)
    setModal(null)
    fetchTasks()
    showToast('Tarefa excluída.')
  }

  async function handleImport(e) {
    const file = e.target.files[0]
    if (!file) return

    // .mpp não é suportado diretamente
    if (file.name.toLowerCase().endsWith('.mpp')) {
      showToast('Arquivo .mpp não suportado. Exporte como Excel no MS Project.')
      e.target.value = ''
      return
    }

    const buf  = await file.arrayBuffer()
    const wb   = XLSX.read(buf, { cellDates: true })

    // Tenta achar a sheet de tarefas (Task_Table ou primeira)
    const sheetName = wb.SheetNames.find(n => n.toLowerCase().includes('task')) ?? wb.SheetNames[0]
    const ws   = wb.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json(ws, { raw: false, dateNF: 'yyyy-mm-dd' })

    const toInsert = []

    // Detecta formato MS Project (colunas: Name, Start, Finish, Outline Level)
    const isMSProject = rows[0] && ('Name' in rows[0] || ' Name' in rows[0] || 'Task Name' in rows[0])

    if (isMSProject) {
      // Mapeamento de categorias por nível de outline
      let currentCategory = 'Geral'
      for (const row of rows) {
        const name     = (row['Name'] ?? row[' Name'] ?? row['Task Name'] ?? '').trim()
        const start    = row['Start']  ?? row[' Start']  ?? ''
        const finish   = row['Finish'] ?? row[' Finish'] ?? ''
        const level    = parseInt(row['Outline Level'] ?? row[' Outline Level'] ?? '3')
        if (!name || !start || !finish) continue

        // Nível 1 = projeto, Nível 2 = categoria, Nível 3+ = tarefa
        if (level === 1) continue
        if (level === 2) { currentCategory = name.trim(); continue }

        // Converte datas do formato MS Project "Mon 5/18/26" → "2026-05-18"
        function parseMSDate(s) {
          if (!s) return null
          if (/\d{4}-\d{2}-\d{2}/.test(s)) return s
          const clean = s.replace(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+/i, '')
          const d = new Date(clean)
          if (!isNaN(d)) return d.toISOString().slice(0,10)
          return null
        }

        const sd = parseMSDate(start)
        const ed = parseMSDate(finish)
        if (!sd || !ed) continue

        toInsert.push({
          obra_id: obra.id,
          label: name,
          category: currentCategory,
          start_date: sd,
          end_date: ed,
          progress: 0,
        })
      }
    } else {
      // Formato genérico: colunas Tarefa/Task, Categoria, Início, Fim
      for (const row of rows) {
        const label    = row['Tarefa'] ?? row['Task'] ?? row['Nome'] ?? row['Name'] ?? row['label'] ?? ''
        const category = row['Categoria'] ?? row['Category'] ?? row['category'] ?? 'Geral'
        const start    = row['Início'] ?? row['Inicio'] ?? row['Start'] ?? row['start_date'] ?? ''
        const end      = row['Fim'] ?? row['End'] ?? row['Finish'] ?? row['end_date'] ?? ''
        if (!label || !start || !end) continue
        toInsert.push({ obra_id: obra.id, label: label.trim(), category, start_date: start, end_date: end, progress: 0 })
      }
    }

    if (toInsert.length) {
      await supabase.from('tasks').insert(toInsert)
      await fetchTasks()
      showToast(`${toInsert.length} tarefas importadas!`)
    } else {
      showToast('Nenhuma tarefa encontrada. Verifique o formato do arquivo.')
    }
    e.target.value = ''
  }

  function handleExport() {
    const rows = tasks.map(t => ({
      Tarefa: t.label, Categoria: t.category,
      Início: t.start_date, Fim: t.end_date,
      Progresso: `${t.progress}%`, Responsável: t.responsible ?? '',
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Cronograma')
    XLSX.writeFile(wb, `Cronograma_${obra.nome.replace(/\s+/g, '_')}.xlsx`)
  }

  const btnBase = {
    padding: '7px 14px', borderRadius: 8, border: 'none',
    fontSize: 12, fontWeight: 600, cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: 5,
  }

  const doneTasks = tasks.filter(t => t.progress === 100).length
  const inProgress = tasks.filter(t => t.progress > 0 && t.progress < 100).length
  const meta = STATUS_META[obra.status] ?? STATUS_META.em_andamento

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* Header */}
      <div style={{
        background: '#1A1D2E', borderBottom: '1px solid #1E2235',
        padding: '14px 24px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={onBack} style={{
            background: 'none', border: '1px solid #1E2235', borderRadius: 7,
            color: '#64748B', fontSize: 13, cursor: 'pointer', padding: '5px 10px',
          }}>← Voltar</button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: '#F1F5F9' }}>{obra.nome}</span>
              <span style={{ padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: meta.bg, color: meta.color }}>
                {meta.label}
              </span>
            </div>
            {obra.endereco && <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>{obra.endereco}</div>}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => setModal({})} style={{ ...btnBase, background: 'linear-gradient(135deg, #3B82F6, #6366F1)', color: '#fff' }}>
            + Nova Tarefa
          </button>
          <label style={{ ...btnBase, background: '#1E2235', color: '#94A3B8', cursor: 'pointer' }}>
            ↑ Importar Excel
            <input type="file" accept=".xlsx,.xls,.mpp" style={{ display: 'none' }} onChange={handleImport} />
          </label>
          <button onClick={handleExport} style={{ ...btnBase, background: '#1E2235', color: '#94A3B8' }}>
            ↓ Exportar Excel
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 10, padding: '12px 24px', borderBottom: '1px solid #1E2235', flexShrink: 0 }}>
        {[
          { label: 'Total',        value: tasks.length, color: '#3B82F6' },
          { label: 'Em andamento', value: inProgress,   color: '#F59E0B' },
          { label: 'Concluídas',   value: doneTasks,    color: '#10B981' },
        ].map(s => (
          <div key={s.label} style={{
            background: '#1A1D2E', border: '1px solid #1E2235',
            borderRadius: 8, padding: '8px 14px',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span style={{ fontSize: 18, fontWeight: 700, color: s.color }}>{s.value}</span>
            <span style={{ fontSize: 11, color: '#475569' }}>{s.label}</span>
          </div>
        ))}
      </div>


      {/* Alertas de boletos */}
      <BoletosAlerta obraId={obra.id} />
      {/* Filtros */}
      <div style={{ display: 'flex', gap: 6, padding: '10px 24px', flexWrap: 'wrap', borderBottom: '1px solid #1E2235', flexShrink: 0 }}>
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
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading
          ? <div style={{ padding: 40, textAlign: 'center', color: '#334155', fontSize: 14 }}>Carregando...</div>
          : <Gantt tasks={tasks} filter={filter} onTaskClick={task => setModal(task)} />
        }
      </div>

      {modal !== null && (
        <TaskModal
          task={modal.id ? modal : null}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => setModal(null)}
        />
      )}

      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24,
          background: '#064E3B', border: '1px solid #065F46',
          color: '#6EE7B7', padding: '10px 18px', borderRadius: 10,
          fontSize: 13, fontWeight: 600, zIndex: 2000,
          boxShadow: '0 8px 24px #00000060',
        }}>{toast}</div>
      )}
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────
export default function Cronograma({ session, permissoes }) {
  const [obras,       setObras]       = useState([])
  const [obraSelecionada, setObraSelecionada] = useState(null)
  const [loading,     setLoading]     = useState(true)

  useEffect(() => {
    async function fetchObras() {
      const { data } = await supabase.from('obras').select('*').order('created_at', { ascending: false })
      setObras(data ?? [])
      setLoading(false)
    }
    fetchObras()
  }, [])

  if (obraSelecionada) {
    return (
      <ObraGantt
        obra={obraSelecionada}
        session={session}
        onBack={() => setObraSelecionada(null)}
      />
    )
  }

  return (
    <div style={{ flex: 1, padding: '28px', overflowY: 'auto', color: '#E2E8F0', fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#F1F5F9', marginBottom: 4 }}>Cronograma</h1>
        <p style={{ fontSize: 13, color: '#475569' }}>Selecione uma obra para ver ou editar o cronograma.</p>
      </div>
      <ObrasList obras={obras} onSelect={setObraSelecionada} loading={loading} />
    </div>
  )
}
