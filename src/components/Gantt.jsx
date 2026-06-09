import { useRef, useEffect, useState } from 'react'

export const CATEGORY_COLORS = {
  'ESTRUTURA DE CONCRETO': '#3B82F6',
  'ALVENARIA':             '#F59E0B',
  'HIDRÁULICA':            '#06B6D4',
  'ELÉTRICA':              '#F59E0B',
  'ESQUADRIAS':            '#8B5CF6',
  'REVESTIMENTO':          '#10B981',
  'PINTURA':               '#EC4899',
  'COBERTURA':             '#EF4444',
  'FUNDAÇÃO':              '#A16207',
  'ACABAMENTO':            '#14B8A6',
  'INFRAESTRUTURA':        '#6366F1',
  'INSTALAÇÕES':           '#0EA5E9',
  Porcelanato: '#3B82F6', Instalações: '#8B5CF6', Vinílico: '#10B981',
  Esquadrias:  '#8B5CF6', Gesso:       '#6366F1', Pintura:  '#EC4899',
  Acabamento:  '#14B8A6', Geral:       '#64748B',
}

const PALETTE = ['#3B82F6','#8B5CF6','#10B981','#F59E0B','#EF4444','#06B6D4','#EC4899','#6366F1','#14B8A6','#A16207','#0EA5E9','#84CC16']
const _colorCache = {}
export function getCategoryColor(cat) {
  if (CATEGORY_COLORS[cat]) return CATEGORY_COLORS[cat]
  if (_colorCache[cat]) return _colorCache[cat]
  const idx = Object.keys(_colorCache).length % PALETTE.length
  _colorCache[cat] = PALETTE[idx]
  return _colorCache[cat]
}

// ── Extrai pavimento do label da tarefa ───────────────────────────────────
const PAVIMENTO_PATTERNS = [
  { regex: /t[eé]rreo/i,         label: 'Térreo' },
  { regex: /subsolo|sub.solo/i,  label: 'Subsolo' },
  { regex: /funda[çc][aã]o/i,    label: 'Fundação' },
  { regex: /caixa\s*d['`]?agua/i,label: "Caixa d'Água" },
  { regex: /cobertura/i,         label: 'Cobertura' },
  { regex: /telhado/i,           label: 'Telhado' },
  { regex: /(\d+)[oº°]\s*pv?t?o?/i, label: (m) => `${m[1]}º Pavto` },
  { regex: /pav(?:imento)?\s*(\d+)/i, label: (m) => `${m[1]}º Pavto` },
]

export function extrairPavimento(label) {
  if (!label) return null
  for (const { regex, label: lbl } of PAVIMENTO_PATTERNS) {
    const m = label.match(regex)
    if (m) return typeof lbl === 'function' ? lbl(m) : lbl
  }
  return null
}

// Ordem lógica dos pavimentos (do mais baixo pro mais alto)
const PAVIMENTO_ORDER = ['Subsolo','Fundação','Térreo','1º Pavto','2º Pavto','3º Pavto','4º Pavto','5º Pavto','6º Pavto','7º Pavto','8º Pavto','9º Pavto','10º Pavto',"Caixa d'Água",'Cobertura','Telhado']

export function getPavimentos(tasks) {
  const pavs = [...new Set(tasks.map(t => extrairPavimento(t.label)).filter(Boolean))]
  return pavs.sort((a, b) => {
    const ia = PAVIMENTO_ORDER.indexOf(a)
    const ib = PAVIMENTO_ORDER.indexOf(b)
    if (ia === -1 && ib === -1) return a.localeCompare(b)
    if (ia === -1) return 1
    if (ib === -1) return -1
    return ia - ib
  })
}

const DAY_MS  = 86400000
const LABEL_W = 256
const ROW_H   = 38

// Largura de coluna por zoom
const COL_W_MAP = { dia: 38, quinzena: 26, mes: 18, ano: 8 }

function parseDate(str) { return new Date(str + 'T00:00:00') }

function getDays(start, end) {
  const days = []
  let cur = new Date(start)
  while (cur <= end) { days.push(new Date(cur)); cur = new Date(cur.getTime() + DAY_MS) }
  return days
}

function progress(t) {
  const s = parseDate(t.start_date), e = parseDate(t.end_date)
  const TODAY = new Date(); TODAY.setHours(0,0,0,0)
  if (typeof t.progress === 'number') return t.progress
  if (TODAY < s) return 0
  if (TODAY > e) return 100
  return Math.round(((TODAY - s) / (e - s)) * 100)
}

// ── Componente principal ──────────────────────────────────────────────────
export default function Gantt({ tasks, onTaskClick, filter, pavimentoFilter = 'Todos', zoom = 'mes' }) {
  const scrollRef = useRef(null)
  const TODAY = new Date(); TODAY.setHours(0,0,0,0)
  const COL_W = COL_W_MAP[zoom] ?? 18

  // Aplica filtros
  let displayed = tasks
  if (filter && filter !== 'Todas') displayed = displayed.filter(t => t.category === filter)
  if (pavimentoFilter && pavimentoFilter !== 'Todos') {
    displayed = displayed.filter(t => extrairPavimento(t.label) === pavimentoFilter)
  }

  const hasTasks = tasks.length > 0

  const dates     = hasTasks ? tasks.flatMap(t => [parseDate(t.start_date), parseDate(t.end_date)]) : [TODAY, TODAY]
  const projStart = new Date(Math.min(...dates))
  const projEnd   = new Date(Math.max(...dates))
  const allDays   = getDays(projStart, projEnd)
  const totalDays = allDays.length
  const todayOff  = Math.round((TODAY - projStart) / DAY_MS)

  // Agrupa dias em meses/quinzenas conforme zoom
  const headers = buildHeaders(allDays, zoom)

  useEffect(() => {
    if (scrollRef.current && todayOff > 0) {
      scrollRef.current.scrollLeft = Math.max(0, todayOff * COL_W - 120)
    }
  }, [tasks.length, zoom])

  if (!hasTasks) return (
    <div style={{ padding: 60, textAlign: 'center', color: '#334155', fontSize: 14 }}>
      Nenhuma tarefa ainda. Clique em "+ Nova Tarefa" para começar.
    </div>
  )

  if (displayed.length === 0) return (
    <div style={{ padding: 60, textAlign: 'center', color: '#334155', fontSize: 14 }}>
      Nenhuma tarefa encontrada com os filtros selecionados.
    </div>
  )

  // Mapa id → índice para desenhar setas de dependência
  const taskIndexMap = {}
  displayed.forEach((t, i) => { taskIndexMap[t.id] = i })

  return (
    <div style={{ overflow: 'hidden' }}>
      <div style={{ display: 'flex' }}>

        {/* Fixed label column */}
        <div style={{ width: LABEL_W, flexShrink: 0, borderRight: '1px solid #1E2235' }}>
          <div style={{ height: 48, borderBottom: '1px solid #1E2235', background: '#0D1020' }} />
          {displayed.map((task, i) => {
            const col = getCategoryColor(task.category)
            const pav = extrairPavimento(task.label)
            return (
              <div
                key={task.id}
                onClick={() => onTaskClick(task)}
                style={{
                  height: ROW_H, display: 'flex', alignItems: 'center',
                  padding: '0 12px', borderBottom: '1px solid #161929',
                  background: i % 2 === 0 ? '#0F1117' : '#0D1020',
                  gap: 8, cursor: 'pointer', transition: 'background 0.1s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#1A1D2E'}
                onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? '#0F1117' : '#0D1020'}
              >
                <div style={{ width: 7, height: 7, borderRadius: 2, background: col, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11.5, color: '#94A3B8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {task.label}
                  </div>
                  {pav && (
                    <div style={{ fontSize: 9, color: '#334155', marginTop: 1 }}>{pav}</div>
                  )}
                </div>
                <div style={{ fontSize: 10, fontWeight: 700, color: col, flexShrink: 0 }}>
                  {progress(task)}%
                </div>
              </div>
            )
          })}
        </div>

        {/* Scrollable chart */}
        <div ref={scrollRef} style={{ flex: 1, overflowX: 'auto', position: 'relative' }}>
          <div style={{ width: totalDays * COL_W, position: 'relative' }}>

            {/* Header */}
            <div style={{ height: 48, background: '#0D1020', borderBottom: '1px solid #1E2235', position: 'relative' }}>
              {headers.top.map((h, i) => (
                <div key={i} style={{
                  position: 'absolute', left: h.left * COL_W, top: 0,
                  width: h.count * COL_W, height: 24,
                  display: 'flex', alignItems: 'center', paddingLeft: 8,
                  fontSize: 10, fontWeight: 700, color: '#475569',
                  letterSpacing: 0.8, textTransform: 'uppercase',
                  borderRight: '1px solid #1E2235',
                }}>{h.label}</div>
              ))}
              {headers.bottom.map((h, i) => {
                const isToday = h.isToday
                return (
                  <div key={i} style={{
                    position: 'absolute', left: h.left * COL_W, top: 24,
                    width: h.count * COL_W, height: 24,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10,
                    color: isToday ? '#3B82F6' : '#475569',
                    fontWeight: isToday ? 800 : 400,
                    background: isToday ? '#1E3A5F' : 'transparent',
                    borderRadius: isToday ? 4 : 0,
                    borderRight: zoom !== 'dia' ? '1px solid #1E2235' : 'none',
                  }}>{h.label}</div>
                )
              })}
            </div>

            {/* SVG layer para setas de dependência */}
            <svg
              style={{ position: 'absolute', top: 48, left: 0, width: totalDays * COL_W, height: displayed.length * ROW_H, pointerEvents: 'none', zIndex: 5 }}
            >
              {displayed.map((task) => {
                if (!task.predecessora_id) return null
                const predIdx = taskIndexMap[task.predecessora_id]
                const succIdx = taskIndexMap[task.id]
                if (predIdx === undefined || succIdx === undefined) return null

                const pred = displayed[predIdx]
                const predEndDay = Math.round((parseDate(pred.end_date) - projStart) / DAY_MS)
                const succStartDay = Math.round((parseDate(task.start_date) - projStart) / DAY_MS)

                const x1 = (predEndDay + 1) * COL_W
                const y1 = predIdx * ROW_H + ROW_H / 2
                const x2 = succStartDay * COL_W
                const y2 = succIdx * ROW_H + ROW_H / 2

                const midX = (x1 + x2) / 2

                return (
                  <g key={`dep-${task.id}`}>
                    <path
                      d={`M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`}
                      fill="none" stroke="#3B82F666" strokeWidth={1.5} strokeDasharray="4 3"
                    />
                    {/* Seta */}
                    <polygon
                      points={`${x2},${y2} ${x2-6},${y2-4} ${x2-6},${y2+4}`}
                      fill="#3B82F666"
                    />
                  </g>
                )
              })}
            </svg>

            {/* Rows */}
            {displayed.map((task, i) => {
              const s    = parseDate(task.start_date)
              const e    = parseDate(task.end_date)
              const left = Math.round((s - projStart) / DAY_MS) * COL_W
              const w    = (Math.round((e - s) / DAY_MS) + 1) * COL_W
              const col  = getCategoryColor(task.category)
              const pct  = progress(task)

              return (
                <div
                  key={task.id}
                  onClick={() => onTaskClick(task)}
                  style={{
                    height: ROW_H, position: 'relative',
                    borderBottom: '1px solid #161929',
                    background: i % 2 === 0 ? '#0F1117' : '#0D1020',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={e2 => e2.currentTarget.style.background = '#1A1D2E'}
                  onMouseLeave={e2 => e2.currentTarget.style.background = i % 2 === 0 ? '#0F1117' : '#0D1020'}
                >
                  {/* Fins de semana */}
                  {zoom === 'dia' && allDays.map((d, di) => (d.getDay() === 0 || d.getDay() === 6) && (
                    <div key={di} style={{
                      position: 'absolute', left: di * COL_W, top: 0,
                      width: COL_W, height: ROW_H, background: '#0B0E1A',
                    }} />
                  ))}

                  {/* Barra */}
                  <div style={{
                    position: 'absolute', left, top: 7, width: w, height: ROW_H - 14,
                    borderRadius: 5, background: col + '28', border: `1.5px solid ${col}55`,
                    overflow: 'hidden', zIndex: 2,
                  }}>
                    <div style={{
                      position: 'absolute', left: 0, top: 0,
                      height: '100%', width: `${pct}%`,
                      background: `linear-gradient(90deg, ${col}BB, ${col}77)`,
                    }} />
                  </div>

                  {/* Linha do hoje */}
                  {todayOff >= 0 && todayOff < totalDays && (
                    <div style={{
                      position: 'absolute',
                      left: todayOff * COL_W + COL_W / 2 - 1,
                      top: 0, bottom: 0, width: 2,
                      background: '#3B82F666', zIndex: 10, pointerEvents: 'none',
                    }} />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Gera headers conforme zoom ─────────────────────────────────────────────
function buildHeaders(allDays, zoom) {
  const TODAY = new Date(); TODAY.setHours(0,0,0,0)
  const top = []
  const bottom = []

  if (zoom === 'dia') {
    // Top: mês | Bottom: dia
    allDays.forEach((d, i) => {
      const key = `${d.getFullYear()}-${d.getMonth()}`
      if (!top.length || top[top.length-1].key !== key) {
        top.push({ key, label: d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }), left: i, count: 1 })
      } else { top[top.length-1].count++ }
      bottom.push({ label: d.getDate(), left: i, count: 1, isToday: d.getTime() === TODAY.getTime() })
    })
  } else if (zoom === 'quinzena') {
    // Top: mês | Bottom: 1-15 / 16-fim
    allDays.forEach((d, i) => {
      const key = `${d.getFullYear()}-${d.getMonth()}`
      if (!top.length || top[top.length-1].key !== key) {
        top.push({ key, label: d.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }), left: i, count: 1 })
      } else { top[top.length-1].count++ }

      const qKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate() <= 15 ? 'a' : 'b'}`
      if (!bottom.length || bottom[bottom.length-1].key !== qKey) {
        const lbl = d.getDate() <= 15 ? `1–15` : `16–${new Date(d.getFullYear(), d.getMonth()+1, 0).getDate()}`
        bottom.push({ key: qKey, label: lbl, left: i, count: 1, isToday: false })
      } else { bottom[bottom.length-1].count++ }
    })
  } else if (zoom === 'mes') {
    // Top: ano | Bottom: mês abreviado
    allDays.forEach((d, i) => {
      const yearKey = `${d.getFullYear()}`
      if (!top.length || top[top.length-1].key !== yearKey) {
        top.push({ key: yearKey, label: yearKey, left: i, count: 1 })
      } else { top[top.length-1].count++ }

      const mKey = `${d.getFullYear()}-${d.getMonth()}`
      if (!bottom.length || bottom[bottom.length-1].key !== mKey) {
        bottom.push({ key: mKey, label: d.toLocaleDateString('pt-BR', { month: 'short' }), left: i, count: 1, isToday: false })
      } else { bottom[bottom.length-1].count++ }
    })
  } else if (zoom === 'ano') {
    // Top: ano | Bottom: trimestre
    allDays.forEach((d, i) => {
      const yearKey = `${d.getFullYear()}`
      if (!top.length || top[top.length-1].key !== yearKey) {
        top.push({ key: yearKey, label: yearKey, left: i, count: 1 })
      } else { top[top.length-1].count++ }

      const q = Math.floor(d.getMonth() / 3) + 1
      const qKey = `${d.getFullYear()}-Q${q}`
      if (!bottom.length || bottom[bottom.length-1].key !== qKey) {
        bottom.push({ key: qKey, label: `T${q}`, left: i, count: 1, isToday: false })
      } else { bottom[bottom.length-1].count++ }
    })
  }

  return { top, bottom }
}
