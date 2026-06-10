import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

function diasAtraso(endDate) {
  const hoje = new Date(); hoje.setHours(0,0,0,0)
  const fim = new Date(endDate + 'T00:00:00')
  return Math.round((hoje - fim) / 86400000)
}

// ── Card base ─────────────────────────────────────────────────────────────
function Card({ children, style = {} }) {
  return (
    <div style={{
      background: '#1A1D2E', border: '1px solid #1E2235',
      borderRadius: 12, padding: '18px 20px', ...style
    }}>
      {children}
    </div>
  )
}

// ── Stat card ─────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, sub, color = '#3B82F6', onClick, alert }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: '#1A1D2E',
        border: `1px solid ${alert ? color + '44' : '#1E2235'}`,
        borderRadius: 12, padding: '18px 20px',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'border-color 0.15s, background 0.15s',
        position: 'relative', overflow: 'hidden',
      }}
      onMouseEnter={e => { if (onClick) e.currentTarget.style.borderColor = color + '66' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = alert ? color + '44' : '#1E2235' }}
    >
      {alert && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 3,
          background: `linear-gradient(90deg, ${color}, ${color}88)`,
        }} />
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 11, color: '#475569', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>{label}</div>
          <div style={{ fontSize: 32, fontWeight: 800, color, letterSpacing: '-1px', lineHeight: 1 }}>{value}</div>
          {sub && <div style={{ fontSize: 12, color: '#475569', marginTop: 6 }}>{sub}</div>}
        </div>
        <div style={{ fontSize: 28, opacity: 0.6 }}>{icon}</div>
      </div>
    </div>
  )
}

export default function Dashboard({ session, permissoes, onNavigate }) {
  const [dados, setDados] = useState(null)
  const [loading, setLoading] = useState(true)
  const hoje = new Date(); hoje.setHours(0,0,0,0)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [
      { data: obras },
      { data: scs },
      { data: tasks },
      { data: cotacoes },
    ] = await Promise.all([
      supabase.from('obras').select('id, nome, status'),
      supabase.from('solicitacoes_compra').select('id, titulo, status, urgencia, prazo_entrega, obra_id, gestao, solicitante_nome, created_at').order('created_at', { ascending: false }),
      supabase.from('tasks').select('id, label, start_date, end_date, progress, obra_id').order('start_date'),
      supabase.from('cotacoes').select('id, titulo, status, obra_id, created_at').eq('status', 'aberta'),
    ])

    // Processa dados
    const obrasMap = {}
    ;(obras ?? []).forEach(o => { obrasMap[o.id] = o })

    const scsPendentes   = (scs ?? []).filter(s => s.status === 'pendente')
    const scsCriticas    = scsPendentes.filter(s => s.urgencia === 'critica')
    const scsVencidas    = scsPendentes.filter(s => s.prazo_entrega && s.prazo_entrega < hoje.toISOString().slice(0,10))

    const tasksAtivas    = (tasks ?? []).filter(t => t.progress > 0 && t.progress < 100)
    const tasksAtrasadas = (tasks ?? []).filter(t => {
      if (t.progress >= 100) return false
      const fim = new Date(t.end_date + 'T00:00:00')
      return fim < hoje
    })
    const tasksHoje      = (tasks ?? []).filter(t => {
      if (t.progress >= 100) return false
      const ini = new Date(t.start_date + 'T00:00:00')
      const fim = new Date(t.end_date   + 'T00:00:00')
      return ini <= hoje && fim >= hoje
    })

    // Alertas
    const alertas = []

    if (scsCriticas.length) alertas.push({
      tipo: 'critico', icon: '🚨',
      msg: `${scsCriticas.length} SC${scsCriticas.length > 1 ? 's' : ''} com urgência crítica aguardando aprovação`,
      acao: 'compras',
    })
    if (scsVencidas.length) alertas.push({
      tipo: 'aviso', icon: '⚠️',
      msg: `${scsVencidas.length} SC${scsVencidas.length > 1 ? 's' : ''} com prazo de entrega vencido`,
      acao: 'compras',
    })
    if (tasksAtrasadas.length) alertas.push({
      tipo: 'aviso', icon: '📅',
      msg: `${tasksAtrasadas.length} tarefa${tasksAtrasadas.length > 1 ? 's' : ''} atrasada${tasksAtrasadas.length > 1 ? 's' : ''} no cronograma`,
      acao: 'cronograma',
    })
    if ((cotacoes ?? []).length) alertas.push({
      tipo: 'info', icon: '📊',
      msg: `${cotacoes.length} cotação${cotacoes.length > 1 ? 'ões' : ''} aberta${cotacoes.length > 1 ? 's' : ''} aguardando resposta`,
      acao: 'cotacoes',
    })

    setDados({
      obras: obras ?? [],
      obrasMap,
      scsPendentes,
      scsCriticas,
      scsVencidas,
      tasksAtrasadas,
      tasksHoje,
      tasksAtivas,
      cotacoes: cotacoes ?? [],
      alertas,
      ultimasSCs: (scs ?? []).slice(0, 5),
      scs: scs ?? [],
    })
    setLoading(false)
  }

  if (loading) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#334155', fontSize: 14, background: '#0F1117' }}>
      Carregando dashboard...
    </div>
  )

  const { obras, scsPendentes, scsCriticas, scsVencidas, tasksAtrasadas, tasksHoje, cotacoes, alertas, ultimasSCs, obrasMap, tasksAtivas } = dados

  const obrasEmAndamento = obras.filter(o => o.status === 'em_andamento').length
  const userName = session?.user?.user_metadata?.nome ?? session?.user?.email?.split('@')[0] ?? 'você'

  const horaAtual = new Date().getHours()
  const saudacao = horaAtual < 12 ? 'Bom dia' : horaAtual < 18 ? 'Boa tarde' : 'Boa noite'

  const URGENCIA_META = {
    critica:  { label: 'Crítica',  color: '#EF4444', bg: '#450A0A' },
    alta:     { label: 'Alta',     color: '#F59E0B', bg: '#451A03' },
    normal:   { label: 'Normal',   color: '#3B82F6', bg: '#1E3A5F' },
    baixa:    { label: 'Baixa',    color: '#64748B', bg: '#1E2235' },
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: '#0F1117', color: '#E2E8F0', fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '28px 24px' }}>

        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#F1F5F9' }}>
            {saudacao}, {userName} 👋
          </div>
          <div style={{ fontSize: 13, color: '#475569', marginTop: 4 }}>
            {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
        </div>

        {/* Alertas */}
        {alertas.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
            {alertas.map((al, i) => (
              <div
                key={i}
                onClick={() => onNavigate?.(al.acao)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 16px', borderRadius: 10, cursor: 'pointer',
                  background: al.tipo === 'critico' ? '#450A0A' : al.tipo === 'aviso' ? '#451A03' : '#1E3A5F',
                  border: `1px solid ${al.tipo === 'critico' ? '#7F1D1D' : al.tipo === 'aviso' ? '#78350F' : '#1E3A5F'}`,
                  transition: 'opacity 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                onMouseLeave={e => e.currentTarget.style.opacity = '1'}
              >
                <span style={{ fontSize: 18 }}>{al.icon}</span>
                <span style={{ fontSize: 13, color: al.tipo === 'critico' ? '#FCA5A5' : al.tipo === 'aviso' ? '#FCD34D' : '#93C5FD', flex: 1 }}>{al.msg}</span>
                <span style={{ fontSize: 11, color: '#475569' }}>Ver →</span>
              </div>
            ))}
          </div>
        )}

        {/* Stats principais */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 24 }}>
          <StatCard icon="🏗️" label="Obras em andamento" value={obrasEmAndamento} color="#3B82F6" onClick={() => onNavigate?.('obras')} />
          <StatCard icon="🛒" label="SCs pendentes" value={scsPendentes.length} color={scsCriticas.length ? '#EF4444' : '#F59E0B'} alert={scsCriticas.length > 0} sub={scsCriticas.length ? `${scsCriticas.length} crítica${scsCriticas.length > 1 ? 's' : ''}` : undefined} onClick={() => onNavigate?.('compras')} />
          <StatCard icon="📅" label="Tarefas atrasadas" value={tasksAtrasadas.length} color={tasksAtrasadas.length > 0 ? '#EF4444' : '#10B981'} alert={tasksAtrasadas.length > 0} sub={tasksHoje.length ? `${tasksHoje.length} em andamento hoje` : 'Nenhum atraso'} onClick={() => onNavigate?.('cronograma')} />
          <StatCard icon="📊" label="Cotações abertas" value={cotacoes.length} color="#8B5CF6" onClick={() => onNavigate?.('cotacoes')} />
        </div>

        {/* Grid de detalhes */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

          {/* SCs pendentes */}
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#F1F5F9' }}>🛒 SCs aguardando aprovação</div>
              <button onClick={() => onNavigate?.('compras')} style={{ background: 'none', border: 'none', color: '#3B82F6', fontSize: 12, cursor: 'pointer' }}>Ver todas →</button>
            </div>
            {scsPendentes.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px 0', color: '#334155', fontSize: 13 }}>✅ Nenhuma SC pendente</div>
            ) : scsPendentes.slice(0, 5).map(sc => {
              const urg = URGENCIA_META[sc.urgencia] ?? URGENCIA_META.normal
              const obra = obrasMap[sc.obra_id]
              const vencida = sc.prazo_entrega && sc.prazo_entrega < hoje.toISOString().slice(0,10)
              return (
                <div key={sc.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid #161929' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#F1F5F9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sc.titulo}</div>
                    <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>
                      {obra?.nome ?? '—'} · {sc.solicitante_nome}
                      {sc.gestao && <span style={{ marginLeft: 6, padding: '1px 6px', borderRadius: 4, background: sc.gestao === 'GA' ? '#1E3A5F' : '#064E3B', color: sc.gestao === 'GA' ? '#93C5FD' : '#6EE7B7', fontSize: 10 }}>{sc.gestao}</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                    <span style={{ padding: '2px 8px', borderRadius: 6, background: urg.bg, color: urg.color, fontSize: 10, fontWeight: 700 }}>{urg.label}</span>
                    {vencida && <span style={{ fontSize: 10, color: '#EF4444' }}>⚠️ Prazo vencido</span>}
                  </div>
                </div>
              )
            })}
            {scsPendentes.length > 5 && (
              <div style={{ paddingTop: 10, fontSize: 12, color: '#475569', textAlign: 'center' }}>+{scsPendentes.length - 5} mais</div>
            )}
          </Card>

          {/* Tarefas atrasadas */}
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#F1F5F9' }}>📅 Cronograma</div>
              <button onClick={() => onNavigate?.('cronograma')} style={{ background: 'none', border: 'none', color: '#3B82F6', fontSize: 12, cursor: 'pointer' }}>Ver →</button>
            </div>

            {/* Mini stats do cronograma */}
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
              <div style={{ textAlign: 'center', padding: '12px 0', color: '#334155', fontSize: 13 }}>✅ Sem atrasos no cronograma</div>
            ) : tasksAtrasadas.slice(0, 4).map(t => {
              const atraso = diasAtraso(t.end_date)
              const obra = obrasMap[t.obra_id]
              return (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #161929' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#F1F5F9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.label}</div>
                    <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>{obra?.nome ?? '—'} · Previsão: {fmtDate(t.end_date)}</div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#EF4444', flexShrink: 0 }}>+{atraso}d</span>
                </div>
              )
            })}
            {tasksAtrasadas.length > 4 && (
              <div style={{ paddingTop: 10, fontSize: 12, color: '#475569', textAlign: 'center' }}>+{tasksAtrasadas.length - 4} mais atrasadas</div>
            )}
          </Card>

          {/* Obras */}
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#F1F5F9' }}>🏗️ Obras</div>
              <button onClick={() => onNavigate?.('obras')} style={{ background: 'none', border: 'none', color: '#3B82F6', fontSize: 12, cursor: 'pointer' }}>Ver todas →</button>
            </div>
            {obras.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px 0', color: '#334155', fontSize: 13 }}>Nenhuma obra cadastrada</div>
            ) : obras.map(o => {
              const STATUS = { em_andamento: { label: 'Em andamento', color: '#10B981', bg: '#064E3B' }, pausada: { label: 'Pausada', color: '#F59E0B', bg: '#451A03' }, concluida: { label: 'Concluída', color: '#6366F1', bg: '#1E1B4B' } }
              const s = STATUS[o.status] ?? STATUS.em_andamento
              const scsDaObra = dados.scs.filter(sc => sc.obra_id === o.id && sc.status === 'pendente').length
              return (
                <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid #161929' }}>
                  <div style={{ fontSize: 20 }}>🏗️</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#F1F5F9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.nome}</div>
                    {scsDaObra > 0 && <div style={{ fontSize: 11, color: '#F59E0B', marginTop: 2 }}>{scsDaObra} SC{scsDaObra > 1 ? 's' : ''} pendente{scsDaObra > 1 ? 's' : ''}</div>}
                  </div>
                  <span style={{ padding: '2px 10px', borderRadius: 20, background: s.bg, color: s.color, fontSize: 10, fontWeight: 600 }}>{s.label}</span>
                </div>
              )
            })}
          </Card>

          {/* Cotações abertas */}
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#F1F5F9' }}>📊 Cotações abertas</div>
              <button onClick={() => onNavigate?.('cotacoes')} style={{ background: 'none', border: 'none', color: '#3B82F6', fontSize: 12, cursor: 'pointer' }}>Ver todas →</button>
            </div>
            {cotacoes.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px 0', color: '#334155', fontSize: 13 }}>Nenhuma cotação aberta</div>
            ) : cotacoes.map(c => {
              const obra = obrasMap[c.obra_id]
              const dias = Math.round((hoje - new Date(c.created_at)) / 86400000)
              return (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid #161929' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#F1F5F9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.titulo}</div>
                    <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>{obra?.nome ?? '—'}</div>
                  </div>
                  <span style={{ fontSize: 11, color: dias > 7 ? '#F59E0B' : '#475569', flexShrink: 0 }}>{dias}d aberta</span>
                </div>
              )
            })}
          </Card>
        </div>

        {/* Card Pendências */}
        <Card style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#F1F5F9' }}>📋 Lista de Pendências</div>
              <span style={{ fontSize: 11, color: '#475569' }}>{[
                ...scsPendentes.map(sc => 1),
                ...tasksAtrasadas.map(t => 1),
                ...cotacoes.filter(c => Math.round((hoje - new Date(c.created_at)) / 86400000) > 7).map(c => 1),
              ].length} pendência(s)</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>

              {/* SCs pendentes */}
              {scsPendentes.map(sc => {
                const urg = URGENCIA_META[sc.urgencia] ?? URGENCIA_META.normal
                const vencida = sc.prazo_entrega && sc.prazo_entrega < hoje.toISOString().slice(0,10)
                return (
                  <div key={sc.id} onClick={() => onNavigate?.('compras')} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 14px', borderRadius: 8, cursor: 'pointer',
                    background: '#0F1117', border: '1px solid #1E2235',
                    transition: 'border-color 0.15s',
                  }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = '#334155'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = '#1E2235'}
                  >
                    <span style={{ fontSize: 15, flexShrink: 0 }}>🛒</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#F1F5F9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        SC aguardando aprovação — {sc.titulo}
                      </div>
                      <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>
                        {obrasMap[sc.obra_id]?.nome ?? '—'} · {sc.solicitante_nome}
                        {vencida && <span style={{ color: '#EF4444', marginLeft: 6 }}>· Prazo vencido</span>}
                      </div>
                    </div>
                    <span style={{ padding: '2px 8px', borderRadius: 6, background: urg.bg, color: urg.color, fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{urg.label}</span>
                  </div>
                )
              })}

              {/* Tarefas atrasadas */}
              {tasksAtrasadas.map(t => {
                const atraso = diasAtraso(t.end_date)
                return (
                  <div key={t.id} onClick={() => onNavigate?.('cronograma')} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 14px', borderRadius: 8, cursor: 'pointer',
                    background: '#0F1117', border: '1px solid #1E2235',
                    transition: 'border-color 0.15s',
                  }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = '#334155'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = '#1E2235'}
                  >
                    <span style={{ fontSize: 15, flexShrink: 0 }}>📅</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#F1F5F9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        Tarefa atrasada — {t.label}
                      </div>
                      <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>
                        {obrasMap[t.obra_id]?.nome ?? '—'} · Previsão: {fmtDate(t.end_date)}
                      </div>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#EF4444', flexShrink: 0 }}>+{atraso}d</span>
                  </div>
                )
              })}

              {/* Cotações abertas há mais de 7 dias */}
              {cotacoes.filter(c => Math.round((hoje - new Date(c.created_at)) / 86400000) > 7).map(c => {
                const dias = Math.round((hoje - new Date(c.created_at)) / 86400000)
                return (
                  <div key={c.id} onClick={() => onNavigate?.('cotacoes')} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 14px', borderRadius: 8, cursor: 'pointer',
                    background: '#0F1117', border: '1px solid #1E2235',
                    transition: 'border-color 0.15s',
                  }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = '#334155'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = '#1E2235'}
                  >
                    <span style={{ fontSize: 15, flexShrink: 0 }}>📊</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#F1F5F9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        Cotação sem resposta — {c.titulo}
                      </div>
                      <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>
                        {obrasMap[c.obra_id]?.nome ?? '—'} · Aberta há {dias} dias
                      </div>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#F59E0B', flexShrink: 0 }}>⚠️ {dias}d</span>
                  </div>
                )
              })}

              {/* Nenhuma pendência */}
              {scsPendentes.length === 0 && tasksAtrasadas.length === 0 && cotacoes.filter(c => Math.round((hoje - new Date(c.created_at)) / 86400000) > 7).length === 0 && (
                <div style={{ textAlign: 'center', padding: '24px 0', color: '#334155' }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>✅</div>
                  <div style={{ fontSize: 13, color: '#475569', fontWeight: 600 }}>Tudo em dia! Nenhuma pendência.</div>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}