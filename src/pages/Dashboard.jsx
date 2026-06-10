import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

function fmtDate(d) {
  if (!d) return '-'
  return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

function diasAtraso(endDate) {
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const fim = new Date(endDate + 'T00:00:00')
  return Math.round((hoje - fim) / 86400000)
}

function Card({ children, style }) {
  return (
    <div style={{
      background: '#1A1D2E',
      border: '1px solid #1E2235',
      borderRadius: 12,
      padding: '18px 20px',
      ...style
    }}>
      {children}
    </div>
  )
}

function StatCard({ icon, label, value, sub, color, onClick, alert }) {
  const borderColor = alert ? color + '44' : '#1E2235'
  return (
    <div
      onClick={onClick}
      style={{
        background: '#1A1D2E',
        border: '1px solid ' + borderColor,
        borderRadius: 12,
        padding: '18px 20px',
        cursor: onClick ? 'pointer' : 'default',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {alert && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 3,
          background: color,
        }} />
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 11, color: '#475569', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
            {label}
          </div>
          <div style={{ fontSize: 32, fontWeight: 800, color: color, letterSpacing: '-1px', lineHeight: 1 }}>
            {value}
          </div>
          {sub && (
            <div style={{ fontSize: 12, color: '#475569', marginTop: 6 }}>{sub}</div>
          )}
        </div>
        <div style={{ fontSize: 28, opacity: 0.6 }}>{icon}</div>
      </div>
    </div>
  )
}

const URGENCIA_META = {
  critica: { label: 'Critica',  color: '#EF4444', bg: '#450A0A' },
  alta:    { label: 'Alta',     color: '#F59E0B', bg: '#451A03' },
  normal:  { label: 'Normal',   color: '#3B82F6', bg: '#1E3A5F' },
  baixa:   { label: 'Baixa',    color: '#64748B', bg: '#1E2235' },
}

const STATUS_OBRA = {
  em_andamento: { label: 'Em andamento', color: '#10B981', bg: '#064E3B' },
  pausada:      { label: 'Pausada',       color: '#F59E0B', bg: '#451A03' },
  concluida:    { label: 'Concluida',     color: '#6366F1', bg: '#1E1B4B' },
}

export default function Dashboard({ session, permissoes, onNavigate }) {
  const [dados, setDados] = useState(null)
  const [loading, setLoading] = useState(true)

  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const hojeStr = hoje.toISOString().slice(0, 10)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [r1, r2, r3, r4] = await Promise.all([
      supabase.from('obras').select('id, nome, status'),
      supabase.from('solicitacoes_compra').select('id, titulo, status, urgencia, prazo_entrega, obra_id, gestao, solicitante_nome, created_at').order('created_at', { ascending: false }),
      supabase.from('tasks').select('id, label, start_date, end_date, progress, obra_id').order('start_date'),
      supabase.from('cotacoes').select('id, titulo, status, obra_id, created_at').eq('status', 'aberta'),
    ])

    const obras = r1.data ?? []
    const scs   = r2.data ?? []
    const tasks = r3.data ?? []
    const cots  = r4.data ?? []

    const obrasMap = {}
    obras.forEach(o => { obrasMap[o.id] = o })

    const scsPendentes   = scs.filter(s => s.status === 'pendente')
    const scsCriticas    = scsPendentes.filter(s => s.urgencia === 'critica')
    const scsVencidas    = scsPendentes.filter(s => s.prazo_entrega && s.prazo_entrega < hojeStr)

    const tasksAtrasadas = tasks.filter(t => {
      if (t.progress >= 100) return false
      return new Date(t.end_date + 'T00:00:00') < hoje
    })
    const tasksAtivas = tasks.filter(t => t.progress > 0 && t.progress < 100)
    const tasksHoje   = tasks.filter(t => {
      if (t.progress >= 100) return false
      const ini = new Date(t.start_date + 'T00:00:00')
      const fim = new Date(t.end_date   + 'T00:00:00')
      return ini <= hoje && fim >= hoje
    })

    const cotVencidas = cots.filter(c => {
      const dias = Math.round((hoje - new Date(c.created_at)) / 86400000)
      return dias > 7
    })

    const alertas = []
    if (scsCriticas.length) {
      alertas.push({ tipo: 'critico', icon: 'SC', msg: scsCriticas.length + ' SC(s) com urgencia critica aguardando aprovacao', acao: 'compras' })
    }
    if (scsVencidas.length) {
      alertas.push({ tipo: 'aviso', icon: 'SC', msg: scsVencidas.length + ' SC(s) com prazo de entrega vencido', acao: 'compras' })
    }
    if (tasksAtrasadas.length) {
      alertas.push({ tipo: 'aviso', icon: 'CR', msg: tasksAtrasadas.length + ' tarefa(s) atrasada(s) no cronograma', acao: 'cronograma' })
    }
    if (cotVencidas.length) {
      alertas.push({ tipo: 'info', icon: 'COT', msg: cotVencidas.length + ' cotacao(oes) aberta(s) ha mais de 7 dias', acao: 'cotacoes' })
    }

    setDados({ obras, obrasMap, scs, scsPendentes, scsCriticas, scsVencidas, tasksAtrasadas, tasksAtivas, tasksHoje, cotacoes: cots, cotVencidas, alertas })
    setLoading(false)
  }

  if (loading) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#334155', fontSize: 14, background: '#0F1117' }}>
        Carregando dashboard...
      </div>
    )
  }

  const { obras, obrasMap, scs, scsPendentes, scsCriticas, tasksAtrasadas, tasksAtivas, tasksHoje, cotacoes, cotVencidas, alertas } = dados

  const obrasEmAndamento = obras.filter(o => o.status === 'em_andamento').length
  const userName = session?.user?.user_metadata?.nome ?? session?.user?.email?.split('@')[0] ?? ''
  const hora = new Date().getHours()
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite'
  const totalPendencias = scsPendentes.length + tasksAtrasadas.length + cotVencidas.length

  const ALERT_COLORS = { critico: '#EF4444', aviso: '#F59E0B', info: '#3B82F6' }
  const ALERT_BG = { critico: '#450A0A', aviso: '#451A03', info: '#1E3A5F' }

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: '#0F1117', color: '#E2E8F0', fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '28px 24px' }}>

        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#F1F5F9' }}>
            {saudacao}, {userName}
          </div>
          <div style={{ fontSize: 13, color: '#475569', marginTop: 4 }}>
            {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
        </div>

        {alertas.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
            {alertas.map((al, i) => (
              <div
                key={i}
                onClick={() => onNavigate && onNavigate(al.acao)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 16px', borderRadius: 10, cursor: 'pointer',
                  background: ALERT_BG[al.tipo],
                  border: '1px solid ' + ALERT_COLORS[al.tipo] + '44',
                }}
              >
                <span style={{ fontSize: 11, fontWeight: 800, color: ALERT_COLORS[al.tipo], background: ALERT_COLORS[al.tipo] + '22', padding: '2px 8px', borderRadius: 6 }}>{al.icon}</span>
                <span style={{ fontSize: 13, color: '#F1F5F9', flex: 1 }}>{al.msg}</span>
                <span style={{ fontSize: 11, color: '#475569' }}>Ver</span>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 24 }}>
          <StatCard icon="🏗️" label="Obras em andamento" value={obrasEmAndamento} color="#3B82F6" onClick={() => onNavigate && onNavigate('obras')} />
          <StatCard icon="🛒" label="SCs pendentes" value={scsPendentes.length} color={scsCriticas.length ? '#EF4444' : '#F59E0B'} alert={scsCriticas.length > 0} sub={scsCriticas.length ? scsCriticas.length + ' critica(s)' : undefined} onClick={() => onNavigate && onNavigate('compras')} />
          <StatCard icon="📅" label="Tarefas atrasadas" value={tasksAtrasadas.length} color={tasksAtrasadas.length > 0 ? '#EF4444' : '#10B981'} alert={tasksAtrasadas.length > 0} sub={tasksHoje.length ? tasksHoje.length + ' em andamento hoje' : 'Sem atrasos'} onClick={() => onNavigate && onNavigate('cronograma')} />
          <StatCard icon="📊" label="Cotacoes abertas" value={cotacoes.length} color="#8B5CF6" onClick={() => onNavigate && onNavigate('cotacoes')} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>

          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#F1F5F9' }}>SCs aguardando aprovacao</div>
              <button onClick={() => onNavigate && onNavigate('compras')} style={{ background: 'none', border: 'none', color: '#3B82F6', fontSize: 12, cursor: 'pointer' }}>Ver todas</button>
            </div>
            {scsPendentes.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px 0', color: '#334155', fontSize: 13 }}>Nenhuma SC pendente</div>
            ) : scsPendentes.slice(0, 5).map(sc => {
              const urg = URGENCIA_META[sc.urgencia] ?? URGENCIA_META.normal
              const obra = obrasMap[sc.obra_id]
              const vencida = sc.prazo_entrega && sc.prazo_entrega < hojeStr
              return (
                <div key={sc.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid #161929' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#F1F5F9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sc.titulo}</div>
                    <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>
                      {obra ? obra.nome : '-'} &bull; {sc.solicitante_nome}
                      {vencida && <span style={{ color: '#EF4444', marginLeft: 6 }}>Prazo vencido</span>}
                    </div>
                  </div>
                  <span style={{ padding: '2px 8px', borderRadius: 6, background: urg.bg, color: urg.color, fontSize: 10, fontWeight: 700 }}>{urg.label}</span>
                </div>
              )
            })}
          </Card>

          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#F1F5F9' }}>Cronograma</div>
              <button onClick={() => onNavigate && onNavigate('cronograma')} style={{ background: 'none', border: 'none', color: '#3B82F6', fontSize: 12, cursor: 'pointer' }}>Ver</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
              {[
                { label: 'Em andamento', value: tasksAtivas.length, color: '#3B82F6' },
                { label: 'Atrasadas', value: tasksAtrasadas.length, color: tasksAtrasadas.length > 0 ? '#EF4444' : '#10B981' },
                { label: 'Hoje', value: tasksHoje.length, color: '#F59E0B' },
              ].map(s => (
                <div key={s.label} style={{ background: '#0F1117', borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: 10, color: '#475569', marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>
            {tasksAtrasadas.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '12px 0', color: '#334155', fontSize: 13 }}>Sem atrasos</div>
            ) : tasksAtrasadas.slice(0, 4).map(t => {
              const atraso = diasAtraso(t.end_date)
              const obra = obrasMap[t.obra_id]
              return (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #161929' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#F1F5F9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.label}</div>
                    <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>{obra ? obra.nome : '-'} &bull; {fmtDate(t.end_date)}</div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#EF4444', flexShrink: 0 }}>+{atraso}d</span>
                </div>
              )
            })}
          </Card>

          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#F1F5F9' }}>Obras</div>
              <button onClick={() => onNavigate && onNavigate('obras')} style={{ background: 'none', border: 'none', color: '#3B82F6', fontSize: 12, cursor: 'pointer' }}>Ver todas</button>
            </div>
            {obras.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px 0', color: '#334155', fontSize: 13 }}>Nenhuma obra</div>
            ) : obras.map(o => {
              const s = STATUS_OBRA[o.status] ?? STATUS_OBRA.em_andamento
              const scsDaObra = scs.filter(sc => sc.obra_id === o.id && sc.status === 'pendente').length
              return (
                <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid #161929' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#F1F5F9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.nome}</div>
                    {scsDaObra > 0 && <div style={{ fontSize: 11, color: '#F59E0B', marginTop: 2 }}>{scsDaObra} SC(s) pendente(s)</div>}
                  </div>
                  <span style={{ padding: '2px 10px', borderRadius: 20, background: s.bg, color: s.color, fontSize: 10, fontWeight: 600 }}>{s.label}</span>
                </div>
              )
            })}
          </Card>

          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#F1F5F9' }}>Cotacoes abertas</div>
              <button onClick={() => onNavigate && onNavigate('cotacoes')} style={{ background: 'none', border: 'none', color: '#3B82F6', fontSize: 12, cursor: 'pointer' }}>Ver todas</button>
            </div>
            {cotacoes.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px 0', color: '#334155', fontSize: 13 }}>Nenhuma cotacao aberta</div>
            ) : cotacoes.map(c => {
              const obra = obrasMap[c.obra_id]
              const dias = Math.round((hoje - new Date(c.created_at)) / 86400000)
              return (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid #161929' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#F1F5F9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.titulo}</div>
                    <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>{obra ? obra.nome : '-'}</div>
                  </div>
                  <span style={{ fontSize: 11, color: dias > 7 ? '#F59E0B' : '#475569', flexShrink: 0 }}>{dias}d</span>
                </div>
              )
            })}
          </Card>
        </div>

        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#F1F5F9' }}>Lista de Pendencias</div>
            <span style={{ fontSize: 11, color: '#475569' }}>{totalPendencias} pendencia(s)</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {scsPendentes.map(sc => {
              const urg = URGENCIA_META[sc.urgencia] ?? URGENCIA_META.normal
              const obra = obrasMap[sc.obra_id]
              const vencida = sc.prazo_entrega && sc.prazo_entrega < hojeStr
              return (
                <div key={'sc-' + sc.id} onClick={() => onNavigate && onNavigate('compras')} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 8, cursor: 'pointer', background: '#0F1117', border: '1px solid #1E2235' }}>
                  <span style={{ fontSize: 13, padding: '2px 8px', borderRadius: 6, background: '#1E3A5F', color: '#93C5FD', fontWeight: 700, flexShrink: 0 }}>SC</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#F1F5F9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      SC aguardando aprovacao - {sc.titulo}
                    </div>
                    <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>
                      {obra ? obra.nome : '-'} &bull; {sc.solicitante_nome}
                      {vencida && <span style={{ color: '#EF4444', marginLeft: 6 }}>Prazo vencido</span>}
                    </div>
                  </div>
                  <span style={{ padding: '2px 8px', borderRadius: 6, background: urg.bg, color: urg.color, fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{urg.label}</span>
                </div>
              )
            })}
            {tasksAtrasadas.map(t => {
              const atraso = diasAtraso(t.end_date)
              const obra = obrasMap[t.obra_id]
              return (
                <div key={'t-' + t.id} onClick={() => onNavigate && onNavigate('cronograma')} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 8, cursor: 'pointer', background: '#0F1117', border: '1px solid #1E2235' }}>
                  <span style={{ fontSize: 13, padding: '2px 8px', borderRadius: 6, background: '#450A0A', color: '#FCA5A5', fontWeight: 700, flexShrink: 0 }}>CRON</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#F1F5F9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      Tarefa atrasada - {t.label}
                    </div>
                    <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>
                      {obra ? obra.nome : '-'} &bull; Previsao: {fmtDate(t.end_date)}
                    </div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#EF4444', flexShrink: 0 }}>+{atraso}d</span>
                </div>
              )
            })}
            {cotVencidas.map(c => {
              const dias = Math.round((hoje - new Date(c.created_at)) / 86400000)
              const obra = obrasMap[c.obra_id]
              return (
                <div key={'c-' + c.id} onClick={() => onNavigate && onNavigate('cotacoes')} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 8, cursor: 'pointer', background: '#0F1117', border: '1px solid #1E2235' }}>
                  <span style={{ fontSize: 13, padding: '2px 8px', borderRadius: 6, background: '#451A03', color: '#FCD34D', fontWeight: 700, flexShrink: 0 }}>COT</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#F1F5F9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      Cotacao sem resposta - {c.titulo}
                    </div>
                    <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>
                      {obra ? obra.nome : '-'} &bull; Aberta ha {dias} dias
                    </div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#F59E0B', flexShrink: 0 }}>{dias}d</span>
                </div>
              )
            })}
            {totalPendencias === 0 && (
              <div style={{ textAlign: 'center', padding: '24px 0', color: '#334155' }}>
                <div style={{ fontSize: 13, color: '#475569', fontWeight: 600 }}>Tudo em dia! Nenhuma pendencia.</div>
              </div>
            )}
          </div>
        </Card>

      </div>
    </div>
  )
}
