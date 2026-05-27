    import { useRef, useEffect } from 'react'

export const CATEGORY_COLORS = {
  Porcelanato: '#3B82F6', Instalações: '#8B5CF6', Vinílico: '#10B981',
  Esquadrias:  '#F59E0B', Gesso:       '#6366F1', Pintura:  '#EC4899',
  Acabamento:  '#14B8A6', Geral:       '#64748B',
}

const DAY_MS  = 86400000
const LABEL_W = 256
const COL_W   = 28
const ROW_H   = 38

function parseDate(str) { return new Date(str + 'T00:00:00') }

function getDays(start, end) {
  const days = []
  let cur = new Date(start)
  while (cur <= end) { days.push(new Date(cur)); cur = new Date(cur.getTime() + DAY_MS) }
  return days
}

export default function Gantt({ tasks, onTaskClick, filter }) {
  const scrollRef = useRef(null)
  const TODAY = new Date(); TODAY.setHours(0,0,0,0)

  const displayed = filter === 'Todas' ? tasks : tasks.filter(t => t.category === filter)
  const hasTasks  = tasks.length > 0

  // Always compute these (hooks must not be conditional)
  const dates     = hasTasks ? tasks.flatMap(t => [parseDate(t.start_date), parseDate(t.end_date)]) : [TODAY, TODAY]
  const projStart = new Date(Math.min(...dates))
  const projEnd   = new Date(Math.max(...dates))
  const allDays   = getDays(projStart, projEnd)
  const totalDays = allDays.length
  const todayOff  = Math.round((TODAY - projStart) / DAY_MS)

  const months = []
  allDays.forEach((d, i) => {
    const key = `${d.getFullYear()}-${d.getMonth()}`
    if (!months.length || months[months.length - 1].key !== key) {
      months.push({ key, label: d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }), start: i, count: 1 })
    } else {
      months[months.length - 1].count++
    }
  })

  useEffect(() => {
    if (scrollRef.current && todayOff > 0) {
      scrollRef.current.scrollLeft = Math.max(0, todayOff * COL_W - 120)
    }
  }, [tasks.length])

  if (!hasTasks) return (
    <div style={{ padding: 60, textAlign: 'center', color: '#334155', fontSize: 14 }}>
      Nenhuma tarefa ainda. Clique em "+ Nova Tarefa" para começar.
    </div>
  )

  function progress(t) {
    const s = parseDate(t.start_date), e = parseDate(t.end_date)
    if (typeof t.progress === 'number') return t.progress
    if (TODAY < s) return 0
    if (TODAY > e) return 100
    return Math.round(((TODAY - s) / (e - s)) * 100)
  }

  return (
    <div style={{ overflow: 'hidden' }}>
      <div style={{ display: 'flex' }}>

        {/* Fixed label column */}
        <div style={{ width: LABEL_W, flexShrink: 0, borderRight: '1px solid #1E2235' }}>
          <div style={{ height: 48, borderBottom: '1px solid #1E2235', background: '#0D1020' }} />
          {displayed.map((task, i) => {
            const col = CATEGORY_COLORS[task.category] ?? '#64748B'
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
                <div style={{ fontSize: 11.5, color: '#94A3B8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                  {task.label}
                </div>
                <div style={{ fontSize: 10, fontWeight: 700, color: col, flexShrink: 0 }}>
                  {progress(task)}%
                </div>
              </div>
            )
          })}
        </div>

        {/* Scrollable chart */}
        <div ref={scrollRef} style={{ flex: 1, overflowX: 'auto' }}>
          <div style={{ width: totalDays * COL_W, position: 'relative' }}>

            {/* Header */}
            <div style={{ height: 48, background: '#0D1020', borderBottom: '1px solid #1E2235', position: 'relative' }}>
              {months.map(m => (
                <div key={m.key} style={{
                  position: 'absolute', left: m.start * COL_W, top: 0,
                  width: m.count * COL_W, height: 22,
                  display: 'flex', alignItems: 'center', paddingLeft: 8,
                  fontSize: 10, fontWeight: 700, color: '#475569',
                  letterSpacing: 0.8, textTransform: 'uppercase',
                  borderRight: '1px solid #1E2235',
                }}>{m.label}</div>
              ))}
              {allDays.map((d, i) => {
                const isToday   = d.getTime() === TODAY.getTime()
                const isWeekend = d.getDay() === 0 || d.getDay() === 6
                return (
                  <div key={i} style={{
                    position: 'absolute', left: i * COL_W, top: 24,
                    width: COL_W, height: 24,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10,
                    color: isToday ? '#3B82F6' : isWeekend ? '#2D3748' : '#475569',
                    fontWeight: isToday ? 800 : 400,
                    background: isToday ? '#1E3A5F' : 'transparent',
                    borderRadius: isToday ? 4 : 0,
                  }}>{d.getDate()}</div>
                )
              })}
            </div>

            {/* Rows */}
            {displayed.map((task, i) => {
              const s    = parseDate(task.start_date)
              const e    = parseDate(task.end_date)
              const left = Math.round((s - projStart) / DAY_MS) * COL_W
              const w    = (Math.round((e - s) / DAY_MS) + 1) * COL_W
              const col  = CATEGORY_COLORS[task.category] ?? '#64748B'
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
                  {allDays.map((d, di) => (d.getDay() === 0 || d.getDay() === 6) && (
                    <div key={di} style={{
                      position: 'absolute', left: di * COL_W, top: 0,
                      width: COL_W, height: ROW_H, background: '#0B0E1A',
                      borderRight: '1px solid #1A1D2E',
                    }} />
                  ))}

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

    
