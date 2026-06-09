import React, { useState, useEffect } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabase'
import Gantt, { getCategoryColor, getPavimentos, extrairPavimento } from '../components/Gantt'
import TaskModal from '../components/TaskModal'

// Categorias dinâmicas — geradas a partir das tarefas carregadas
function getCategories(tasks) {
  const cats = [...new Set(tasks.map(t => t.category).filter(Boolean))]
  return ['Todas', ...cats.sort()]
}

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
function ObraGantt({ obra, session, onBack, modoFinanceiro = false }) {
  const [tasks,   setTasks]   = useState([])
  const [modal,   setModal]   = useState(null)
  const [filter,  setFilter]  = useState('Todas')
  const [pavFilter, setPavFilter] = useState('Todos')
  const [zoom,    setZoom]    = useState('mes')
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

  // ── Propagação de datas em cascata ──────────────────────────────────────
  const [propagacaoModal, setPropagacaoModal] = useState(null)
  // propagacaoModal = { taskOriginal, novaForm, impactadas: [{task, novoStart, novoEnd}] }

  function calcDuracao(task) {
    const s = new Date(task.start_date + 'T00:00:00')
    const e = new Date(task.end_date   + 'T00:00:00')
    return Math.round((e - s) / 86400000)
  }

  function addDias(dateStr, dias) {
    const d = new Date(dateStr + 'T00:00:00')
    d.setDate(d.getDate() + dias)
    return d.toISOString().slice(0, 10)
  }

  // Encontra todas as tarefas impactadas em cascata a partir de uma tarefa alterada
  function calcImpacto(taskId, novoEndDate, todasTasks) {
    const impactadas = []
    const visitadas = new Set()

    function propagar(predId, predEnd) {
      if (visitadas.has(predId)) return
      visitadas.add(predId)
      // Acha todas as tarefas que dependem de predId
      const sucessoras = todasTasks.filter(t => t.predecessora_id === predId && t.id !== predId)
      for (const suc of sucessoras) {
        const lag = suc.dep_lag || 0
        const dur = calcDuracao(suc)
        let novoStart, novoEnd

        if (suc.dep_tipo === 'SS') {
          // Start-to-Start: começa junto com a predecessora + lag
          const predTask = todasTasks.find(t => t.id === predId)
          novoStart = addDias(predTask?.start_date ?? predEnd, lag)
        } else {
          // FS (padrão): começa 1 dia após o fim da predecessora + lag
          novoStart = addDias(predEnd, 1 + lag)
        }
        novoEnd = addDias(novoStart, dur)

        // Só impacta se a data realmente mudou
        if (novoStart !== suc.start_date || novoEnd !== suc.end_date) {
          impactadas.push({ task: suc, novoStart, novoEnd })
          propagar(suc.id, novoEnd)
        }
      }
    }

    propagar(taskId, novoEndDate)
    return impactadas
  }

  async function handleSave(form) {
    const isEdit = !!form.id
    const taskOriginal = tasks.find(t => t.id === form.id)

    // Verifica se houve mudança nas datas e se tem sucessoras
    if (isEdit && taskOriginal) {
      const endMudou   = form.end_date   !== taskOriginal.end_date
      const startMudou = form.start_date !== taskOriginal.start_date

      if (endMudou || startMudou) {
        const novoEnd = form.end_date
        const impactadas = calcImpacto(form.id, novoEnd, tasks)

        if (impactadas.length > 0) {
          // Mostra modal de propagação antes de salvar
          setPropagacaoModal({ taskOriginal, novaForm: form, impactadas })
          return
        }
      }
    }

    await salvarTask(form)
  }

  async function salvarTask(form, propagarTasks = []) {
    const payload = {
      ...form,
      obra_id: obra.id,
      predecessora_id: form.predecessora_id || null,
      dep_tipo: form.dep_tipo || 'FS',
      dep_lag: parseInt(form.dep_lag) || 0,
    }
    delete payload.id

    if (form.id) {
      await supabase.from('tasks').update(payload).eq('id', form.id)
    } else {
      await supabase.from('tasks').insert(payload)
    }

    // Propaga datas nas sucessoras se confirmado
    if (propagarTasks.length > 0) {
      for (const { task, novoStart, novoEnd } of propagarTasks) {
        await supabase.from('tasks').update({
          start_date: novoStart,
          end_date:   novoEnd,
        }).eq('id', task.id)
      }
    }

    setModal(null)
    setPropagacaoModal(null)
    fetchTasks()
    showToast(propagarTasks.length > 0
      ? `Tarefa atualizada! ${propagarTasks.length} tarefa(s) reprogramada(s).`
      : form.id ? 'Tarefa atualizada!' : 'Tarefa adicionada!'
    )
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
              <span style={{ padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: modoFinanceiro ? '#064E3B' : '#1E3A5F', color: modoFinanceiro ? '#6EE7B7' : '#93C5FD' }}>
                {modoFinanceiro ? '📊 Físico-Financeiro' : '🔨 Físico'}
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
      {/* Filtros — Categoria + Pavimento + Zoom */}
      <div style={{ display: 'flex', gap: 8, padding: '10px 24px', flexWrap: 'wrap', borderBottom: '1px solid #1E2235', flexShrink: 0, alignItems: 'center' }}>

        {/* Zoom */}
        <div style={{ display: 'flex', background: '#0F1117', borderRadius: 8, border: '1px solid #1E2235', overflow: 'hidden', flexShrink: 0 }}>
          {[
            { id: 'dia',      label: 'Dia' },
            { id: 'quinzena', label: 'Quinzena' },
            { id: 'mes',      label: 'Mês' },
            { id: 'ano',      label: 'Ano' },
          ].map(z => (
            <button key={z.id} onClick={() => setZoom(z.id)} style={{
              padding: '4px 12px', border: 'none', fontSize: 11, fontWeight: 600, cursor: 'pointer',
              background: zoom === z.id ? '#1E3A5F' : 'transparent',
              color: zoom === z.id ? '#93C5FD' : '#475569',
            }}>{z.label}</button>
          ))}
        </div>

        <div style={{ width: 1, height: 20, background: '#1E2235', flexShrink: 0 }} />

        {/* Filtro pavimento */}
        {getPavimentos(tasks).length > 0 && (
          <>
            {['Todos', ...getPavimentos(tasks)].map(pav => (
              <button key={pav} onClick={() => setPavFilter(pav)} style={{
                padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                border: pavFilter === pav ? '1.5px solid #8B5CF6' : '1.5px solid #1E2235',
                background: pavFilter === pav ? '#8B5CF622' : 'transparent',
                color: pavFilter === pav ? '#A78BFA' : '#64748B',
              }}>🏢 {pav}</button>
            ))}
            <div style={{ width: 1, height: 20, background: '#1E2235', flexShrink: 0 }} />
          </>
        )}

        {/* Filtro categoria */}
        {getCategories(tasks).map(cat => {
          const active = filter === cat
          const color  = cat === 'Todas' ? '#3B82F6' : getCategoryColor(cat)
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
          : <Gantt tasks={tasks} filter={filter} pavimentoFilter={pavFilter} zoom={zoom} onTaskClick={task => setModal(task)} />
        }
      </div>

      {modal !== null && (
        <TaskModal
          task={modal.id ? modal : null}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => setModal(null)}
          extraCategories={[...new Set(tasks.map(t => t.category).filter(Boolean))]}
          allTasks={tasks}
        />
      )}

      {/* Modal de propagação de datas */}
      {propagacaoModal && (
        <div style={{
          position: 'fixed', inset: 0, background: '#00000095',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1100, padding: 16,
        }}>
          <div style={{
            background: '#1A1D2E', border: '1px solid #F59E0B44',
            borderRadius: 16, padding: '28px', width: 520, maxWidth: '95vw', maxHeight: '85vh',
            display: 'flex', flexDirection: 'column',
          }}>
            {/* Header */}
            <div style={{ display: 'flex', gap: 14, marginBottom: 20 }}>
              <div style={{ fontSize: 32, flexShrink: 0 }}>⚠️</div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#F1F5F9', marginBottom: 6 }}>
                  Impacto na programação detectado
                </div>
                <div style={{ fontSize: 13, color: '#94A3B8', lineHeight: 1.5 }}>
                  A alteração de <strong style={{ color: '#F59E0B' }}>{propagacaoModal.taskOriginal.end_date}</strong> → <strong style={{ color: '#10B981' }}>{propagacaoModal.novaForm.end_date}</strong> em <strong style={{ color: '#F1F5F9' }}>"{propagacaoModal.taskOriginal.label}"</strong> afeta <strong style={{ color: '#F59E0B' }}>{propagacaoModal.impactadas.length} tarefa(s)</strong> dependente(s).
                </div>
              </div>
            </div>

            {/* Lista de impactadas */}
            <div style={{ flex: 1, overflowY: 'auto', marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#334155', textTransform: 'uppercase', marginBottom: 8 }}>
                Tarefas que serão reprogramadas:
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {propagacaoModal.impactadas.map(({ task, novoStart, novoEnd }) => (
                  <div key={task.id} style={{
                    background: '#0F1117', border: '1px solid #1E2235',
                    borderRadius: 8, padding: '10px 14px',
                    display: 'flex', alignItems: 'center', gap: 12,
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#F1F5F9', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {task.label}
                      </div>
                      <div style={{ display: 'flex', gap: 8, fontSize: 11 }}>
                        <span style={{ color: '#EF4444', textDecoration: 'line-through' }}>
                          {task.start_date} → {task.end_date}
                        </span>
                        <span style={{ color: '#334155' }}>→</span>
                        <span style={{ color: '#10B981', fontWeight: 600 }}>
                          {novoStart} → {novoEnd}
                        </span>
                      </div>
                    </div>
                    <div style={{
                      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                      background: '#451A03', color: '#F59E0B', flexShrink: 0,
                    }}>
                      +{Math.round((new Date(novoStart+'T00:00:00') - new Date(task.start_date+'T00:00:00')) / 86400000)}d
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Botões */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button
                onClick={() => setPropagacaoModal(null)}
                style={{
                  flex: 1, padding: '10px', borderRadius: 8, border: '1px solid #1E2235',
                  background: 'transparent', color: '#64748B', fontWeight: 600, fontSize: 13, cursor: 'pointer',
                }}
              >Cancelar alteração</button>
              <button
                onClick={() => salvarTask(propagacaoModal.novaForm, [])}
                style={{
                  flex: 1, padding: '10px', borderRadius: 8, border: '1px solid #334155',
                  background: '#1E2235', color: '#94A3B8', fontWeight: 600, fontSize: 13, cursor: 'pointer',
                }}
              >Salvar só esta tarefa</button>
              <button
                onClick={() => salvarTask(propagacaoModal.novaForm, propagacaoModal.impactadas)}
                style={{
                  flex: 2, padding: '10px', borderRadius: 8, border: 'none',
                  background: 'linear-gradient(135deg, #F59E0B, #D97706)',
                  color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer',
                }}
              >✓ Atualizar todas as {propagacaoModal.impactadas.length} tarefas</button>
            </div>
          </div>
        </div>
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

// ── Seleção de tipo de Gantt ──────────────────────────────────────────────
function SelecionarTipo({ obra, onSelect, onBack }) {
  const meta = STATUS_META[obra.status] ?? STATUS_META.em_andamento
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: "'DM Sans', sans-serif" }}>
      {/* Header */}
      <div style={{ background: '#1A1D2E', borderBottom: '1px solid #1E2235', padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <button onClick={onBack} style={{ background: 'none', border: '1px solid #1E2235', borderRadius: 7, color: '#64748B', fontSize: 13, cursor: 'pointer', padding: '5px 10px' }}>← Voltar</button>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: '#F1F5F9' }}>{obra.nome}</span>
            <span style={{ padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: meta.bg, color: meta.color }}>{meta.label}</span>
          </div>
          {obra.endereco && <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>{obra.endereco}</div>}
        </div>
      </div>

      {/* Seleção */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <div style={{ maxWidth: 600, width: '100%' }}>
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📅</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#F1F5F9', marginBottom: 8 }}>Qual cronograma deseja abrir?</div>
            <div style={{ fontSize: 13, color: '#475569' }}>Escolha o tipo de visualização para <strong style={{ color: '#94A3B8' }}>{obra.nome}</strong></div>
          </div>

          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {/* Físico */}
            <div
              onClick={() => onSelect('fisico')}
              style={{
                flex: 1, minWidth: 220, background: '#1A1D2E', border: '1px solid #1E3A5F',
                borderRadius: 16, padding: '28px 24px', cursor: 'pointer', transition: 'all 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#1E2A45'; e.currentTarget.style.borderColor = '#3B82F6'; e.currentTarget.style.transform = 'translateY(-2px)' }}
              onMouseLeave={e => { e.currentTarget.style.background = '#1A1D2E'; e.currentTarget.style.borderColor = '#1E3A5F'; e.currentTarget.style.transform = 'translateY(0)' }}
            >
              <div style={{ fontSize: 36, marginBottom: 16 }}>🔨</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#F1F5F9', marginBottom: 8 }}>Cronograma Físico</div>
              <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.5 }}>
                Acompanhamento diário do andamento da obra. Atualize o progresso de cada tarefa livremente.
              </div>
              <div style={{ marginTop: 16, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {['Uso diário', 'Progresso livre', 'Gantt visual'].map(t => (
                  <span key={t} style={{ padding: '3px 8px', borderRadius: 6, background: '#1E3A5F', color: '#93C5FD', fontSize: 11, fontWeight: 600 }}>{t}</span>
                ))}
              </div>
            </div>

            {/* Físico-Financeiro */}
            <div
              onClick={() => onSelect('financeiro')}
              style={{
                flex: 1, minWidth: 220, background: '#1A1D2E', border: '1px solid #064E3B',
                borderRadius: 16, padding: '28px 24px', cursor: 'pointer', transition: 'all 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#1A2E25'; e.currentTarget.style.borderColor = '#10B981'; e.currentTarget.style.transform = 'translateY(-2px)' }}
              onMouseLeave={e => { e.currentTarget.style.background = '#1A1D2E'; e.currentTarget.style.borderColor = '#064E3B'; e.currentTarget.style.transform = 'translateY(0)' }}
            >
              <div style={{ fontSize: 36, marginBottom: 16 }}>📊</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#F1F5F9', marginBottom: 8 }}>Cronograma Físico-Financeiro</div>
              <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.5 }}>
                Medição mensal por contrato e fornecedor. Emita medições todo dia 25 e atualize o Gantt automaticamente.
              </div>
              <div style={{ marginTop: 16, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {['Medição mensal', 'Por contrato', 'Dia 25'].map(t => (
                  <span key={t} style={{ padding: '3px 8px', borderRadius: 6, background: '#064E3B', color: '#6EE7B7', fontSize: 11, fontWeight: 600 }}>{t}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────
export default function Cronograma({ session, permissoes }) {
  const [obras,           setObras]           = useState([])
  const [obraSelecionada, setObraSelecionada] = useState(null)
  const [tipoGantt,       setTipoGantt]       = useState(null) // 'fisico' | 'financeiro'
  const [loading,         setLoading]         = useState(true)

  useEffect(() => {
    async function fetchObras() {
      const { data } = await supabase.from('obras').select('*').order('created_at', { ascending: false })
      setObras(data ?? [])
      setLoading(false)
    }
    fetchObras()
  }, [])

  // Voltou da obra → limpa tipo também
  function handleBack() {
    if (tipoGantt) { setTipoGantt(null) }
    else { setObraSelecionada(null) }
  }

  if (obraSelecionada && tipoGantt === 'fisico') {
    return (
      <ObraGantt
        obra={obraSelecionada}
        session={session}
        onBack={handleBack}
      />
    )
  }

  if (obraSelecionada && tipoGantt === 'financeiro') {
    return (
      <ObraGantt
        obra={obraSelecionada}
        session={session}
        onBack={handleBack}
        modoFinanceiro
      />
    )
  }

  if (obraSelecionada && !tipoGantt) {
    return (
      <SelecionarTipo
        obra={obraSelecionada}
        onSelect={setTipoGantt}
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
