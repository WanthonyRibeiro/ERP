import { useState, useEffect, useRef } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabase'

// ── SVG Chart helpers ─────────────────────────────────────────────────────
function SvgLineChart({ data, lines, height = 220 }) {
  if (!data.length) return null
  const W = 600, H = height, PL = 48, PR = 16, PT = 12, PB = 28
  const iW = W - PL - PR, iH = H - PT - PB
  const allVals = lines.flatMap(l => data.map(d => d[l.key] ?? 0))
  const maxV = Math.max(...allVals, 1)
  const px = (i) => PL + (i / (data.length - 1 || 1)) * iW
  const py = (v) => PT + iH - (v / maxV) * iH
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height }} preserveAspectRatio="none">
      {[0,25,50,75,100].map(p => (
        <line key={p} x1={PL} x2={W-PR} y1={PT + iH*(1-p/100)} y2={PT + iH*(1-p/100)} stroke="#1E2235" strokeWidth="1" />
      ))}
      {data.map((d, i) => (
        <text key={i} x={px(i)} y={H-6} textAnchor="middle" fontSize="9" fill="#475569">{d.mes}</text>
      ))}
      {[0,25,50,75,100].map(p => (
        <text key={p} x={PL-4} y={PT + iH*(1-p/100) + 3} textAnchor="end" fontSize="9" fill="#475569">{p}%</text>
      ))}
      {lines.map(l => {
        const pts = data.map((d,i) => `${px(i)},${py(d[l.key]??0)}`).join(' ')
        return (
          <g key={l.key}>
            <polyline points={pts} fill="none" stroke={l.color} strokeWidth="2"
              strokeDasharray={l.dashed ? '6 3' : undefined} />
            {data.map((d,i) => <circle key={i} cx={px(i)} cy={py(d[l.key]??0)} r="3" fill={l.color} />)}
          </g>
        )
      })}
    </svg>
  )
}

function SvgBarChart({ data, bars, height = 180, formatY }) {
  if (!data.length) return null
  const W = 600, H = height, PL = 56, PR = 16, PT = 12, PB = 28
  const iW = W - PL - PR, iH = H - PT - PB
  const allVals = bars.flatMap(b => data.map(d => d[b.key] ?? 0))
  const maxV = Math.max(...allVals, 1)
  const slotW = iW / data.length
  const barW = Math.max(4, (slotW / (bars.length + 1)) - 2)
  const fmt = formatY ?? (v => v > 999 ? `${(v/1000).toFixed(0)}k` : v.toFixed(0))
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height }} preserveAspectRatio="none">
      {[0,25,50,75,100].map(p => (
        <line key={p} x1={PL} x2={W-PR} y1={PT + iH*(1-p/100)} y2={PT + iH*(1-p/100)} stroke="#1E2235" strokeWidth="1" />
      ))}
      {data.map((d,i) => (
        <text key={i} x={PL + slotW*i + slotW/2} y={H-6} textAnchor="middle" fontSize="9" fill="#475569">{d.mes}</text>
      ))}
      {[0,25,50,75,100].map(p => (
        <text key={p} x={PL-4} y={PT + iH*(1-p/100) + 3} textAnchor="end" fontSize="9" fill="#475569">{fmt(maxV*p/100)}</text>
      ))}
      {data.map((d,i) => bars.map((b,bi) => {
        const v = d[b.key] ?? 0
        const bH = (v / maxV) * iH
        const x = PL + slotW*i + slotW/(bars.length+1) * (bi+1)
        return <rect key={b.key} x={x - barW/2} y={PT + iH - bH} width={barW} height={bH} fill={b.color} rx="3" />
      }))}
    </svg>
  )
}

const CATEGORIAS = ['Geral','Porcelanato','Instalações','Vinílico','Esquadrias','Gesso','Pintura','Acabamento','Fundação','Estrutura','Alvenaria','Cobertura','Hidráulica','Elétrica','Ar Condicionado','MO Geral']
const MESES = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez']

const STATUS_MED = {
  rascunho:  { label: 'Rascunho',  color: '#64748B', bg: '#1E2235' },
  enviada:   { label: 'Enviada',   color: '#F59E0B', bg: '#451A03' },
  aprovada:  { label: 'Aprovada',  color: '#10B981', bg: '#064E3B' },
  rejeitada: { label: 'Rejeitada', color: '#EF4444', bg: '#450A0A' },
}
const STATUS_BOLETO = {
  pendente: { label: 'Pendente', color: '#F59E0B', bg: '#451A03' },
  pago:     { label: 'Pago',     color: '#10B981', bg: '#064E3B' },
  vencido:  { label: 'Vencido',  color: '#EF4444', bg: '#450A0A' },
}
const STATUS_OBRA = {
  em_andamento: { label: 'Em andamento', color: '#10B981', bg: '#064E3B' },
  pausada:      { label: 'Pausada',      color: '#F59E0B', bg: '#451A03' },
  concluida:    { label: 'Concluída',    color: '#6366F1', bg: '#1E1B4B' },
}

function fmtBRL(v) { return Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}) }
function fmtMes(s) { if (!s) return '—'; return new Date(s+'T00:00:00').toLocaleDateString('pt-BR',{month:'long',year:'numeric'}) }
function today() { return new Date().toISOString().slice(0,10) }
function addDays(d, n) { const dt = new Date(d+'T00:00:00'); dt.setDate(dt.getDate()+n); return dt.toISOString().slice(0,10) }

const inp = { width:'100%', padding:'8px 12px', borderRadius:7, background:'#0F1117', border:'1px solid #1E2235', color:'#F1F5F9', fontSize:13, outline:'none', fontFamily:'inherit' }
const lbl = { fontSize:11, fontWeight:600, color:'#64748B', marginBottom:5, display:'block' }
const card = { background:'#1A1D2E', border:'1px solid #1E2235', borderRadius:12, padding:'16px' }

// ── helpers ───────────────────────────────────────────────────────────────
function getVencimentoBoleto(d) {
  if (!d) return null
  const dt = new Date(d+'T00:00:00')
  const t  = new Date(); t.setHours(0,0,0,0)
  const diff = Math.round((dt-t)/86400000)
  if (diff < 0)   return { label:`Vencido há ${Math.abs(diff)}d`, color:'#EF4444', bg:'#450A0A' }
  if (diff <= 7)  return { label:`Vence em ${diff}d`,             color:'#EF4444', bg:'#450A0A' }
  if (diff <= 30) return { label:`Vence em ${diff}d`,             color:'#F59E0B', bg:'#451A03' }
  return                 { label:`Vence em ${diff}d`,             color:'#10B981', bg:'#064E3B' }
}

// ── CURVA ABC ─────────────────────────────────────────────────────────────
function CurvaABC({ itens }) {
  if (!itens.length) return <div style={{color:'#334155',fontSize:13,padding:'20px 0',textAlign:'center'}}>Nenhum item no orçamento.</div>

  const total = itens.reduce((a,r) => a + Number(r.quantidade||0)*Number(r.valor_unit||0), 0)
  const sorted = [...itens]
    .map(r => ({ ...r, total: Number(r.quantidade||0)*Number(r.valor_unit||0) }))
    .sort((a,b) => b.total - a.total)

  let acc = 0
  const classified = sorted.map(r => {
    acc += r.total
    const pct = total > 0 ? (acc/total)*100 : 0
    return { ...r, acumulado: pct, classe: pct <= 80 ? 'A' : pct <= 95 ? 'B' : 'C' }
  })

  const classMeta = { A:{color:'#EF4444',bg:'#450A0A',desc:'~80% do custo'}, B:{color:'#F59E0B',bg:'#451A03',desc:'~15% do custo'}, C:{color:'#10B981',bg:'#064E3B',desc:'~5% do custo'} }

  const resumo = ['A','B','C'].map(c => {
    const group = classified.filter(r => r.classe === c)
    return { classe: c, qtd: group.length, total: group.reduce((a,r)=>a+r.total,0), meta: classMeta[c] }
  })

  return (
    <div>
      <div style={{display:'flex',gap:10,marginBottom:20,flexWrap:'wrap'}}>
        {resumo.map(r => (
          <div key={r.classe} style={{flex:1,minWidth:140,...card,borderColor:r.meta.color+'44'}}>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
              <span style={{width:28,height:28,borderRadius:8,background:r.meta.bg,color:r.meta.color,fontWeight:700,fontSize:14,display:'flex',alignItems:'center',justifyContent:'center'}}>{r.classe}</span>
              <span style={{fontSize:11,color:'#64748B'}}>{r.meta.desc}</span>
            </div>
            <div style={{fontSize:18,fontWeight:700,color:r.meta.color}}>{fmtBRL(r.total)}</div>
            <div style={{fontSize:11,color:'#475569',marginTop:2}}>{r.qtd} item{r.qtd!==1?'s':''}</div>
          </div>
        ))}
      </div>

      {/* Tabela */}
      <div style={{display:'grid',gridTemplateColumns:'28px 2fr 1fr 100px 100px 60px',gap:8,padding:'0 4px',marginBottom:6}}>
        {['Cl.','Descrição','Categoria','Total (R$)','Acumulado','%'].map((h,i)=>(
          <div key={i} style={{fontSize:10,fontWeight:700,color:'#334155',textTransform:'uppercase'}}>{h}</div>
        ))}
      </div>
      <div style={{maxHeight:360,overflowY:'auto'}}>
        {classified.map((r,i) => {
          const m = classMeta[r.classe]
          return (
            <div key={i} style={{display:'grid',gridTemplateColumns:'28px 2fr 1fr 100px 100px 60px',gap:8,marginBottom:5,padding:'6px 4px',borderRadius:6,background:'#1A1D2E',border:'1px solid #1E2235'}}>
              <span style={{width:22,height:22,borderRadius:5,background:m.bg,color:m.color,fontWeight:700,fontSize:11,display:'flex',alignItems:'center',justifyContent:'center'}}>{r.classe}</span>
              <span style={{fontSize:12,color:'#F1F5F9',alignSelf:'center',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.descricao}</span>
              <span style={{fontSize:11,color:'#64748B',alignSelf:'center'}}>{r.categoria}</span>
              <span style={{fontSize:12,color:'#10B981',alignSelf:'center',fontWeight:600}}>{fmtBRL(r.total)}</span>
              <span style={{fontSize:11,color:'#475569',alignSelf:'center'}}>{fmtBRL(acc)}</span>
              <span style={{fontSize:11,color:m.color,alignSelf:'center',fontWeight:600}}>{r.acumulado.toFixed(1)}%</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── CURVA S ───────────────────────────────────────────────────────────────
function CurvaS({ obra }) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [obra.id])

  async function load() {
    const [{ data: meds }, { data: orc }] = await Promise.all([
      supabase.from('medicoes').select('id,mes_ref,status').eq('obra_id', obra.id).order('mes_ref'),
      supabase.from('orcamento_itens').select('quantidade,valor_unit,avanco_fisico_mensal').eq('obra_id', obra.id),
    ])
    const totalOrc = (orc??[]).reduce((a,r)=>a+Number(r.quantidade||0)*Number(r.valor_unit||0),0)

    // Busca itens de medições aprovadas
    const aprovadas = (meds??[]).filter(m=>m.status==='aprovada')
    let medMap = {}
    if (aprovadas.length) {
      const { data: mitens } = await supabase.from('medicao_itens').select('medicao_id,qtd_medida,valor_unit').in('medicao_id', aprovadas.map(m=>m.id))
      for (const it of mitens??[]) {
        const med = aprovadas.find(m=>m.id===it.medicao_id)
        const mes = med?.mes_ref?.slice(0,7)
        if (!mes) continue
        medMap[mes] = (medMap[mes]||0) + Number(it.qtd_medida||0)*Number(it.valor_unit||0)
      }
    }

    // Gera série de meses
    if (!obra.data_inicio) { setLoading(false); return }
    const start = new Date(obra.data_inicio+'T00:00:00')
    const end   = obra.data_prevista ? new Date(obra.data_prevista+'T00:00:00') : new Date()
    const months = []
    const cur = new Date(start.getFullYear(), start.getMonth(), 1)
    while (cur <= end) {
      months.push(`${cur.getFullYear()}-${String(cur.getMonth()+1).padStart(2,'0')}`)
      cur.setMonth(cur.getMonth()+1)
    }

    // Distribuição prevista uniforme
    const prevPorMes = totalOrc / (months.length || 1)
    let accPrev = 0, accReal = 0
    const series = months.map(m => {
      accPrev += prevPorMes
      accReal += medMap[m] || 0
      return {
        mes: m.slice(5)+'/'+m.slice(2,4),
        previsto: totalOrc > 0 ? Math.min(100,(accPrev/totalOrc)*100) : 0,
        realizado: totalOrc > 0 ? Math.min(100,(accReal/totalOrc)*100) : 0,
        prevBRL: accPrev,
        realBRL: accReal,
      }
    })
    setData(series)
    setLoading(false)
  }

  if (loading) return <div style={{color:'#334155',fontSize:13}}>Carregando...</div>
  if (!data.length) return <div style={{color:'#334155',fontSize:13,textAlign:'center',padding:'40px 0'}}>Defina data de início e previsão de término na obra para gerar a curva S.</div>

  return (
    <div>
      <div style={{fontSize:13,color:'#475569',marginBottom:16}}>Avanço financeiro acumulado — previsto vs realizado</div>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{top:5,right:20,left:0,bottom:5}}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1E2235" />
          <XAxis dataKey="mes" tick={{fontSize:10,fill:'#475569'}} />
          <YAxis tickFormatter={v=>`${v.toFixed(0)}%`} tick={{fontSize:10,fill:'#475569'}} domain={[0,100]} />
          <Tooltip
            contentStyle={{background:'#1A1D2E',border:'1px solid #334155',borderRadius:8,fontSize:12}}
            formatter={(v,name)=>[`${v.toFixed(1)}%`, name]}
          />
          <Legend wrapperStyle={{fontSize:12,color:'#94A3B8'}} />
          <Line type="monotone" dataKey="previsto" name="Previsto" stroke="#3B82F6" strokeWidth={2} dot={false} strokeDasharray="5 3" />
          <Line type="monotone" dataKey="realizado" name="Realizado" stroke="#10B981" strokeWidth={2} dot={{r:3}} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── AVANÇO MENSAL ─────────────────────────────────────────────────────────
function AvancoMensal({ obra }) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [obra.id])

  async function load() {
    const { data: meds } = await supabase.from('medicoes').select('id,mes_ref,status').eq('obra_id', obra.id).order('mes_ref')
    const aprovadas = (meds??[]).filter(m=>m.status==='aprovada')
    if (!aprovadas.length) { setLoading(false); return }

    const { data: mitens } = await supabase.from('medicao_itens').select('medicao_id,qtd_medida,qtd_prevista,valor_unit').in('medicao_id', aprovadas.map(m=>m.id))

    const series = aprovadas.map(med => {
      const its = (mitens??[]).filter(it=>it.medicao_id===med.id)
      const previsto  = its.reduce((a,it)=>a+Number(it.qtd_prevista||0)*Number(it.valor_unit||0),0)
      const realizado = its.reduce((a,it)=>a+Number(it.qtd_medida||0)*Number(it.valor_unit||0),0)
      const fisico = previsto > 0 ? Math.min(100,(realizado/previsto)*100) : 0
      return {
        mes: (med.mes_ref??'').slice(0,7).replace('-','/'),
        previsto, realizado, fisico,
      }
    })
    setData(series)
    setLoading(false)
  }

  if (loading) return <div style={{color:'#334155',fontSize:13}}>Carregando...</div>
  if (!data.length) return <div style={{color:'#334155',fontSize:13,textAlign:'center',padding:'30px 0'}}>Nenhuma medição aprovada ainda.</div>

  return (
    <div style={{display:'flex',flexDirection:'column',gap:20}}>
      <div>
        <div style={{fontSize:13,fontWeight:600,color:'#94A3B8',marginBottom:10}}>Avanço Financeiro por Mês (R$)</div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data} margin={{top:5,right:20,left:0,bottom:5}}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1E2235" />
            <XAxis dataKey="mes" tick={{fontSize:10,fill:'#475569'}} />
            <YAxis tickFormatter={v=>fmtBRL(v).replace('R$','')} tick={{fontSize:10,fill:'#475569'}} />
            <Tooltip contentStyle={{background:'#1A1D2E',border:'1px solid #334155',borderRadius:8,fontSize:12}} formatter={v=>fmtBRL(v)} />
            <Legend wrapperStyle={{fontSize:12,color:'#94A3B8'}} />
            <Bar dataKey="previsto"  name="Previsto"  fill="#3B82F6" radius={[4,4,0,0]} />
            <Bar dataKey="realizado" name="Realizado" fill="#10B981" radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div>
        <div style={{fontSize:13,fontWeight:600,color:'#94A3B8',marginBottom:10}}>Avanço Físico por Mês (%)</div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={data} margin={{top:5,right:20,left:0,bottom:5}}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1E2235" />
            <XAxis dataKey="mes" tick={{fontSize:10,fill:'#475569'}} />
            <YAxis tickFormatter={v=>`${v.toFixed(0)}%`} domain={[0,100]} tick={{fontSize:10,fill:'#475569'}} />
            <Tooltip contentStyle={{background:'#1A1D2E',border:'1px solid #334155',borderRadius:8,fontSize:12}} formatter={v=>`${v.toFixed(1)}%`} />
            <Bar dataKey="fisico" name="Avanço Físico %" fill="#8B5CF6" radius={[4,4,0,0]} />
            <ReferenceLine y={100} stroke="#334155" strokeDasharray="4 2" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// ── BOLETOS ───────────────────────────────────────────────────────────────
function Boletos({ obra }) {
  const [boletos, setBoletos] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal]     = useState(null)
  const [toast, setToast]     = useState(null)
  const [form, setForm]       = useState({ descricao:'', valor:'', emissao:'', parcelas:'1', condicao:'30', fornecedor:'', observacoes:'' })

  useEffect(() => { fetchBoletos() }, [obra.id])

  function showToast(msg) { setToast(msg); setTimeout(()=>setToast(null),3000) }

  async function fetchBoletos() {
    const { data } = await supabase.from('boletos').select('*').eq('obra_id', obra.id).order('vencimento')
    setBoletos(data??[])
    setLoading(false)
  }

  function calcVencimentos(emissao, condicao, parcelas) {
    const p = parseInt(parcelas)||1
    const dias = parseInt(condicao)||30
    return Array.from({length:p},(_,i)=>addDays(emissao, dias*(i+1)))
  }

  async function handleSave() {
    if (!form.descricao||!form.valor||!form.emissao) return
    const vencimentos = calcVencimentos(form.emissao, form.condicao, form.parcelas)
    const valorParcela = Number(form.valor) / vencimentos.length
    const toInsert = vencimentos.map((v,i)=>({
      obra_id: obra.id,
      descricao: vencimentos.length > 1 ? `${form.descricao} (${i+1}/${vencimentos.length})` : form.descricao,
      valor: valorParcela,
      emissao: form.emissao,
      vencimento: v,
      status: 'pendente',
      fornecedor: form.fornecedor||null,
      observacoes: form.observacoes||null,
    }))
    await supabase.from('boletos').insert(toInsert)
    setModal(null)
    setForm({descricao:'',valor:'',emissao:'',parcelas:'1',condicao:'30',fornecedor:'',observacoes:''})
    await fetchBoletos()
    showToast(`${toInsert.length} boleto${toInsert.length>1?'s':''} criado${toInsert.length>1?'s':''}!`)
  }

  async function togglePago(b) {
    const novoStatus = b.status === 'pago' ? 'pendente' : 'pago'
    await supabase.from('boletos').update({status:novoStatus}).eq('id',b.id)
    setBoletos(bs=>bs.map(bb=>bb.id===b.id?{...bb,status:novoStatus}:bb))
  }

  async function deleteBoleto(id) {
    if (!confirm('Excluir boleto?')) return
    await supabase.from('boletos').delete().eq('id',id)
    setBoletos(bs=>bs.filter(b=>b.id!==id))
  }

  // Atualiza status de vencidos automaticamente
  const boletosComStatus = boletos.map(b => {
    if (b.status==='pago') return b
    const dt = new Date(b.vencimento+'T00:00:00')
    const t = new Date(); t.setHours(0,0,0,0)
    if (dt < t) return {...b, status:'vencido'}
    return b
  })

  const totalPendente = boletosComStatus.filter(b=>b.status!=='pago').reduce((a,b)=>a+Number(b.valor||0),0)
  const totalPago     = boletosComStatus.filter(b=>b.status==='pago').reduce((a,b)=>a+Number(b.valor||0),0)
  const vencendo7d    = boletosComStatus.filter(b=>{
    if (b.status==='pago') return false
    const diff = Math.round((new Date(b.vencimento+'T00:00:00')-new Date())/86400000)
    return diff >= 0 && diff <= 7
  }).length

  return (
    <div>
      {/* Resumo */}
      <div style={{display:'flex',gap:10,marginBottom:20,flexWrap:'wrap'}}>
        {[
          {label:'A pagar',     value:fmtBRL(totalPendente), color:'#F59E0B', icon:'📋'},
          {label:'Pago',        value:fmtBRL(totalPago),     color:'#10B981', icon:'✅'},
          {label:'Vencendo em 7d', value:vencendo7d,         color:'#EF4444', icon:'⚠️'},
        ].map(s=>(
          <div key={s.label} style={{flex:1,minWidth:130,...card}}>
            <div style={{fontSize:18,marginBottom:6}}>{s.icon}</div>
            <div style={{fontSize:11,color:'#475569',marginBottom:2}}>{s.label}</div>
            <div style={{fontSize:17,fontWeight:700,color:s.color}}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
        <div style={{fontSize:14,fontWeight:600,color:'#F1F5F9'}}>Boletos</div>
        <button onClick={()=>setModal(true)} style={{padding:'7px 14px',borderRadius:7,border:'none',background:'linear-gradient(135deg,#3B82F6,#6366F1)',color:'#fff',fontWeight:700,fontSize:12,cursor:'pointer'}}>+ Novo boleto</button>
      </div>

      {loading ? <div style={{color:'#334155',fontSize:13}}>Carregando...</div>
      : boletosComStatus.length === 0 ? (
        <div style={{textAlign:'center',padding:'30px 0',color:'#334155',fontSize:13}}>Nenhum boleto cadastrado.</div>
      ) : boletosComStatus.map(b => {
        const meta = STATUS_BOLETO[b.status] ?? STATUS_BOLETO.pendente
        const alerta = b.status !== 'pago' ? getVencimentoBoleto(b.vencimento) : null
        return (
          <div key={b.id} style={{...card,marginBottom:8,display:'flex',alignItems:'center',gap:12}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:13,fontWeight:600,color:'#F1F5F9',marginBottom:2}}>{b.descricao}</div>
              <div style={{display:'flex',gap:10,flexWrap:'wrap',fontSize:11,color:'#64748B'}}>
                {b.fornecedor && <span>🏢 {b.fornecedor}</span>}
                <span>📅 Vence: {new Date(b.vencimento+'T00:00:00').toLocaleDateString('pt-BR')}</span>
                {alerta && <span style={{color:alerta.color,fontWeight:600}}>{alerta.label}</span>}
              </div>
            </div>
            <div style={{textAlign:'right',flexShrink:0}}>
              <div style={{fontSize:15,fontWeight:700,color:'#F1F5F9',marginBottom:4}}>{fmtBRL(b.valor)}</div>
              <span style={{padding:'2px 8px',borderRadius:12,fontSize:10,fontWeight:700,background:meta.bg,color:meta.color}}>{meta.label}</span>
            </div>
            <div style={{display:'flex',gap:6,flexShrink:0}}>
              <button onClick={()=>togglePago(b)} title={b.status==='pago'?'Desmarcar':'Marcar como pago'} style={{padding:'5px 8px',borderRadius:6,border:`1px solid ${b.status==='pago'?'#064E3B':'#1E3A5F'}`,background:'transparent',color:b.status==='pago'?'#6EE7B7':'#93C5FD',fontSize:12,cursor:'pointer'}}>
                {b.status==='pago'?'✓':'Pagar'}
              </button>
              <button onClick={()=>deleteBoleto(b.id)} style={{padding:'5px 8px',borderRadius:6,border:'1px solid #450A0A',background:'transparent',color:'#FCA5A5',fontSize:12,cursor:'pointer'}}>×</button>
            </div>
          </div>
        )
      })}

      {/* Modal novo boleto */}
      {modal && (
        <div onClick={e=>e.target===e.currentTarget&&setModal(null)} style={{position:'fixed',inset:0,background:'#00000090',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1100,padding:16}}>
          <div style={{background:'#1A1D2E',border:'1px solid #1E2235',borderRadius:16,padding:'24px',width:440,maxWidth:'100%',maxHeight:'90vh',overflowY:'auto'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
              <div style={{fontSize:16,fontWeight:700,color:'#F1F5F9'}}>Novo Boleto</div>
              <button onClick={()=>setModal(null)} style={{background:'none',border:'none',color:'#475569',fontSize:22,cursor:'pointer'}}>×</button>
            </div>
            <label style={lbl}>Descrição</label>
            <input style={{...inp,marginBottom:12}} value={form.descricao} onChange={e=>setForm(f=>({...f,descricao:e.target.value}))} placeholder="Ex: Fornecedor Elétrica" />
            <label style={lbl}>Fornecedor</label>
            <input style={{...inp,marginBottom:12}} value={form.fornecedor} onChange={e=>setForm(f=>({...f,fornecedor:e.target.value}))} placeholder="Opcional" />
            <div style={{display:'flex',gap:12,marginBottom:12}}>
              <div style={{flex:1}}>
                <label style={lbl}>Valor total (R$)</label>
                <input style={inp} type="number" min="0" step="0.01" value={form.valor} onChange={e=>setForm(f=>({...f,valor:e.target.value}))} />
              </div>
              <div style={{flex:1}}>
                <label style={lbl}>Data de emissão</label>
                <input style={inp} type="date" value={form.emissao} onChange={e=>setForm(f=>({...f,emissao:e.target.value}))} />
              </div>
            </div>
            <div style={{display:'flex',gap:12,marginBottom:12}}>
              <div style={{flex:1}}>
                <label style={lbl}>Condição de pagamento</label>
                <select style={inp} value={form.condicao} onChange={e=>setForm(f=>({...f,condicao:e.target.value}))}>
                  <option value="30">30 dias</option>
                  <option value="60">60 dias</option>
                  <option value="90">90 dias</option>
                  <option value="15">15 dias</option>
                  <option value="7">7 dias</option>
                </select>
              </div>
              <div style={{flex:1}}>
                <label style={lbl}>Número de parcelas</label>
                <select style={inp} value={form.parcelas} onChange={e=>setForm(f=>({...f,parcelas:e.target.value}))}>
                  {[1,2,3,4,5,6,8,10,12].map(n=><option key={n} value={n}>{n}x</option>)}
                </select>
              </div>
            </div>
            {form.emissao && (
              <div style={{background:'#0F1117',borderRadius:8,padding:'10px 12px',marginBottom:12,fontSize:12,color:'#64748B'}}>
                {calcVencimentos(form.emissao,form.condicao,form.parcelas).map((v,i)=>(
                  <div key={i}>Parcela {i+1}: {new Date(v+'T00:00:00').toLocaleDateString('pt-BR')} — {fmtBRL(Number(form.valor||0)/parseInt(form.parcelas||1))}</div>
                ))}
              </div>
            )}
            <label style={lbl}>Observações</label>
            <textarea style={{...inp,resize:'vertical',minHeight:56,marginBottom:16}} value={form.observacoes} onChange={e=>setForm(f=>({...f,observacoes:e.target.value}))} placeholder="Opcional" />
            <div style={{display:'flex',justifyContent:'flex-end',gap:8}}>
              <button onClick={()=>setModal(null)} style={{padding:'8px 16px',borderRadius:7,border:'1px solid #1E2235',background:'transparent',color:'#64748B',fontWeight:600,fontSize:13,cursor:'pointer'}}>Cancelar</button>
              <button onClick={handleSave} style={{padding:'8px 16px',borderRadius:7,border:'none',background:'linear-gradient(135deg,#3B82F6,#6366F1)',color:'#fff',fontWeight:700,fontSize:13,cursor:'pointer'}}>Salvar</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div style={{position:'fixed',bottom:24,right:24,background:'#064E3B',border:'1px solid #065F46',color:'#6EE7B7',padding:'10px 18px',borderRadius:10,fontSize:13,fontWeight:600,zIndex:2000}}>{toast}</div>}
    </div>
  )
}

// ── ORÇAMENTO (MO / MA) ───────────────────────────────────────────────────
function Orcamento({ obra }) {
  const [itens, setItens]     = useState([])
  const [rows, setRows]       = useState([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast]     = useState(null)
  const [abaOrc, setAbaOrc]   = useState('lista') // lista | abc

  useEffect(() => { fetchItens() }, [obra.id])

  async function fetchItens() {
    const { data } = await supabase.from('orcamento_itens').select('*').eq('obra_id', obra.id).order('ordem')
    setItens(data??[])
    setLoading(false)
  }

  useEffect(() => { setRows(itens.map(i=>({...i,isNew:false}))) }, [itens])

  function showToast(msg) { setToast(msg); setTimeout(()=>setToast(null),3000) }
  function newRow() { return {_tmp:Date.now(),obra_id:obra.id,descricao:'',categoria:'Geral',tipo:'MA',unidade:'un',quantidade:1,valor_unit:0,isNew:true} }
  function setRow(idx,k,v) { setRows(rs=>rs.map((r,i)=>i===idx?{...r,[k]:v}:r)) }
  function addRow() { setRows(rs=>[...rs,newRow()]) }
  async function removeRow(idx) {
    const r = rows[idx]
    if (!r.isNew) await supabase.from('orcamento_itens').delete().eq('id',r.id)
    setRows(rs=>rs.filter((_,i)=>i!==idx))
  }

  async function saveAll() {
    for (const r of rows) {
      const payload = {obra_id:obra.id,descricao:r.descricao,categoria:r.categoria,tipo:r.tipo||'MA',unidade:r.unidade,quantidade:Number(r.quantidade),valor_unit:Number(r.valor_unit),ordem:rows.indexOf(r)}
      if (r.isNew) { if (r.descricao.trim()) await supabase.from('orcamento_itens').insert(payload) }
      else await supabase.from('orcamento_itens').update(payload).eq('id',r.id)
    }
    await fetchItens()
    showToast('Orçamento salvo!')
  }

  async function handleImport(e) {
    const file = e.target.files[0]; if (!file) return
    const buf = await file.arrayBuffer()
    const wb  = XLSX.read(buf,{cellDates:true})
    const ws  = wb.Sheets[wb.SheetNames[0]]

    // Tenta detectar formato Cronograma Físico/Financeiro (MO/Material por linha)
    const raw = XLSX.utils.sheet_to_json(ws,{header:1,raw:false})
    let toInsert = []

    // Verifica se é o formato da planilha de cronograma (col B=descrição, col C=MO/Material, col D=valor)
    const isCronFormat = raw.some(r => r[2]==='M.O' || r[2]==='Material' || r[1]==='M.O' || r[1]==='Material')

    if (isCronFormat) {
      let lastDesc = ''
      for (const row of raw) {
        const col1 = String(row[0]||'').trim()
        const col2 = String(row[1]||'').trim() // M.O ou Material
        const col3 = String(row[2]||'').trim()
        const valRaw = col3 || String(row[3]||'').trim()
        const val = Number(String(valRaw).replace(/[^0-9.,]/g,'').replace(',','.'))
        if (col1 && col1 !== 'M.O' && col1 !== 'Material') lastDesc = col1
        if ((col2==='M.O'||col2==='Material'||col1==='M.O'||col1==='Material') && lastDesc) {
          const tipo = (col2==='M.O'||col1==='M.O') ? 'MO' : 'MA'
          if (val > 0) toInsert.push({obra_id:obra.id,descricao:lastDesc,categoria:'Geral',tipo,unidade:'vb',quantidade:1,valor_unit:val,ordem:toInsert.length})
        }
      }
    }

    // Fallback: formato padrão
    if (!toInsert.length) {
      const data = XLSX.utils.sheet_to_json(ws,{raw:false,dateNF:'yyyy-mm-dd'})
      toInsert = data.filter(r=>r['Descrição']||r['Descricao']||r['descricao']).map((r,idx)=>({
        obra_id:obra.id,
        descricao: r['Descrição']||r['Descricao']||r['descricao']||'',
        categoria: r['Categoria']||r['categoria']||'Geral',
        tipo:      r['Tipo']||r['tipo']||'MA',
        unidade:   r['Unidade']||r['unidade']||'un',
        quantidade:Number(r['Quantidade']||r['quantidade']||1),
        valor_unit:Number(String(r['Valor Unit']||r['Valor Unitário']||r['valor_unit']||0).replace(/[^0-9.,]/g,'').replace(',','.')),
        ordem:idx,
      }))
    }

    if (toInsert.length) {
      await supabase.from('orcamento_itens').insert(toInsert)
      await fetchItens()
      showToast(`${toInsert.length} itens importados!`)
    } else { showToast('Nenhum item encontrado.') }
    e.target.value = ''
  }

  function handleExport() {
    const data = rows.map(r=>({'Descrição':r.descricao,'Tipo':r.tipo||'MA','Categoria':r.categoria,'Unidade':r.unidade,'Quantidade':r.quantidade,'Valor Unit':r.valor_unit,'Total':(Number(r.quantidade)*Number(r.valor_unit)).toFixed(2)}))
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb,ws,'Orçamento')
    XLSX.writeFile(wb,`Orcamento_${obra.nome.replace(/\s+/g,'_')}.xlsx`)
  }

  const totalMA = rows.filter(r=>r.tipo!=='MO').reduce((a,r)=>a+Number(r.quantidade||0)*Number(r.valor_unit||0),0)
  const totalMO = rows.filter(r=>r.tipo==='MO').reduce((a,r)=>a+Number(r.quantidade||0)*Number(r.valor_unit||0),0)
  const total   = totalMA + totalMO

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16,flexWrap:'wrap',gap:8}}>
        <div>
          <div style={{fontSize:16,fontWeight:700,color:'#F1F5F9'}}>Orçamento Base</div>
          <div style={{fontSize:12,color:'#475569',marginTop:2}}>Serviços e valores previstos — MO e MA separados</div>
        </div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          <label style={{padding:'7px 14px',borderRadius:7,border:'1px solid #1E2235',background:'transparent',color:'#94A3B8',fontSize:12,fontWeight:600,cursor:'pointer'}}>
            ↑ Importar Excel
            <input type="file" accept=".xlsx,.xls" style={{display:'none'}} onChange={handleImport} />
          </label>
          <button onClick={handleExport} style={{padding:'7px 14px',borderRadius:7,border:'1px solid #1E2235',background:'transparent',color:'#94A3B8',fontSize:12,fontWeight:600,cursor:'pointer'}}>↓ Exportar</button>
          <button onClick={addRow} style={{padding:'7px 14px',borderRadius:7,border:'1px solid #1E3A5F',background:'transparent',color:'#3B82F6',fontSize:12,fontWeight:600,cursor:'pointer'}}>+ Item</button>
          <button onClick={saveAll} style={{padding:'7px 16px',borderRadius:7,border:'none',background:'linear-gradient(135deg,#3B82F6,#6366F1)',color:'#fff',fontSize:12,fontWeight:700,cursor:'pointer'}}>Salvar tudo</button>
        </div>
      </div>

      {/* Totais MO / MA */}
      <div style={{display:'flex',gap:10,marginBottom:16,flexWrap:'wrap'}}>
        {[
          {label:'Total MA (Material)',color:'#3B82F6',value:fmtBRL(totalMA)},
          {label:'Total MO (Mão de obra)',color:'#8B5CF6',value:fmtBRL(totalMO)},
          {label:'Total geral',color:'#10B981',value:fmtBRL(total)},
        ].map(s=>(
          <div key={s.label} style={{flex:1,minWidth:150,background:'#1A1D2E',border:'1px solid #1E2235',borderRadius:10,padding:'12px 16px'}}>
            <div style={{fontSize:11,color:'#475569',marginBottom:4}}>{s.label}</div>
            <div style={{fontSize:16,fontWeight:700,color:s.color}}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Abas lista / ABC */}
      <div style={{display:'flex',gap:4,marginBottom:14}}>
        {[{id:'lista',label:'📋 Lista'},{id:'abc',label:'📊 Curva ABC'}].map(a=>(
          <button key={a.id} onClick={()=>setAbaOrc(a.id)} style={{padding:'6px 14px',borderRadius:7,border:'none',cursor:'pointer',fontSize:12,fontWeight:600,background:abaOrc===a.id?'#1E3A5F':'transparent',color:abaOrc===a.id?'#93C5FD':'#475569'}}>{a.label}</button>
        ))}
      </div>

      {abaOrc === 'abc' ? <CurvaABC itens={rows} /> : (
        <>
          <div style={{display:'grid',gridTemplateColumns:'2fr 80px 1fr 60px 80px 100px 80px 28px',gap:8,padding:'0 4px',marginBottom:6}}>
            {['Descrição','Tipo','Categoria','Un.','Qtde','Valor Unit.','Total',''].map((h,i)=>(
              <div key={i} style={{fontSize:10,fontWeight:700,color:'#334155',textTransform:'uppercase'}}>{h}</div>
            ))}
          </div>
          {loading ? <div style={{color:'#334155',fontSize:13,padding:'20px 0'}}>Carregando...</div>
          : rows.length === 0 ? <div style={{textAlign:'center',padding:'40px 0',color:'#334155',fontSize:13}}>Nenhum item. Adicione ou importe.</div>
          : rows.map((r,idx)=>(
            <div key={r.id||r._tmp} style={{display:'grid',gridTemplateColumns:'2fr 80px 1fr 60px 80px 100px 80px 28px',gap:8,marginBottom:6}}>
              <input style={{...inp,padding:'7px 10px'}} value={r.descricao} onChange={e=>setRow(idx,'descricao',e.target.value)} placeholder="Descrição" />
              <select style={{...inp,padding:'7px 6px',borderColor:r.tipo==='MO'?'#8B5CF660':'#3B82F660'}} value={r.tipo||'MA'} onChange={e=>setRow(idx,'tipo',e.target.value)}>
                <option value="MA">MA</option>
                <option value="MO">MO</option>
              </select>
              <select style={{...inp,padding:'7px 8px'}} value={r.categoria} onChange={e=>setRow(idx,'categoria',e.target.value)}>
                {CATEGORIAS.map(c=><option key={c} value={c}>{c}</option>)}
              </select>
              <input style={{...inp,padding:'7px 6px'}} value={r.unidade} onChange={e=>setRow(idx,'unidade',e.target.value)} />
              <input style={{...inp,padding:'7px 6px'}} type="number" min="0" value={r.quantidade} onChange={e=>setRow(idx,'quantidade',e.target.value)} />
              <input style={{...inp,padding:'7px 6px'}} type="number" min="0" step="0.01" value={r.valor_unit} onChange={e=>setRow(idx,'valor_unit',e.target.value)} />
              <div style={{display:'flex',alignItems:'center',fontSize:12,fontWeight:600,color:'#10B981'}}>{fmtBRL(Number(r.quantidade||0)*Number(r.valor_unit||0))}</div>
              <button onClick={()=>removeRow(idx)} style={{background:'none',border:'none',color:'#475569',fontSize:16,cursor:'pointer',alignSelf:'center'}}>×</button>
            </div>
          ))}
        </>
      )}
      {toast && <div style={{position:'fixed',bottom:24,right:24,background:'#064E3B',border:'1px solid #065F46',color:'#6EE7B7',padding:'10px 18px',borderRadius:10,fontSize:13,fontWeight:600,zIndex:2000}}>{toast}</div>}
    </div>
  )
}

// ── MEDIÇÕES ──────────────────────────────────────────────────────────────
function Medicoes({ obra }) {
  const [medicoes,  setMedicoes]  = useState([])
  const [orcItens,  setOrcItens]  = useState([])
  const [selected,  setSelected]  = useState(null)
  const [medItens,  setMedItens]  = useState([])
  const [loading,   setLoading]   = useState(true)
  const [toast,     setToast]     = useState(null)
  const [novaMed,   setNovaMed]   = useState(false)
  const [novoMes,   setNovoMes]   = useState('')
  const [novoDia,   setNovoDia]   = useState('25')

  useEffect(() => { init() }, [obra.id])

  async function init() {
    const [{ data: meds }, { data: orc }] = await Promise.all([
      supabase.from('medicoes').select('*').eq('obra_id', obra.id).order('numero',{ascending:false}),
      supabase.from('orcamento_itens').select('*').eq('obra_id', obra.id).order('ordem'),
    ])
    setMedicoes(meds??[]); setOrcItens(orc??[]); setLoading(false)
  }

  function showToast(msg) { setToast(msg); setTimeout(()=>setToast(null),3000) }

  async function criarMedicao() {
    if (!novoMes) return
    const num = (medicoes[0]?.numero??0)+1
    const dia = String(novoDia).padStart(2,'0')
    const mesRef = `${novoMes}-${dia}`
    const { data } = await supabase.from('medicoes').insert({obra_id:obra.id,numero:num,mes_ref:mesRef,status:'rascunho'}).select().single()
    if (data && orcItens.length) {
      await supabase.from('medicao_itens').insert(orcItens.map(o=>({medicao_id:data.id,orcamento_item_id:o.id,descricao:o.descricao,categoria:o.categoria,tipo:o.tipo||'MA',qtd_prevista:o.quantidade,qtd_medida:0,valor_unit:o.valor_unit})))
    }
    setNovaMed(false); setNovoMes(''); await init(); showToast(`Medição ${num} criada!`)
  }

  async function abrirMedicao(med) {
    const { data } = await supabase.from('medicao_itens').select('*').eq('medicao_id',med.id).order('created_at')
    setSelected(med); setMedItens(data??[])
  }

  function setMedItem(idx,k,v) { setMedItens(its=>its.map((it,i)=>i===idx?{...it,[k]:v}:it)) }

  async function saveMedicao() {
    for (const it of medItens) await supabase.from('medicao_itens').update({qtd_medida:Number(it.qtd_medida)}).eq('id',it.id)
    showToast('Medição salva!')
  }

  async function enviarMedicao() {
    await saveMedicao()
    await supabase.from('medicoes').update({status:'enviada'}).eq('id',selected.id)
    setSelected(s=>({...s,status:'enviada'}))
    setMedicoes(ms=>ms.map(m=>m.id===selected.id?{...m,status:'enviada'}:m))
    showToast('Medição enviada para aprovação!')
  }

  async function aprovarMedicao(id) {
    await supabase.from('medicoes').update({status:'aprovada'}).eq('id',id)
    setMedicoes(ms=>ms.map(m=>m.id===id?{...m,status:'aprovada'}:m))
    if (selected?.id===id) setSelected(s=>({...s,status:'aprovada'}))
    showToast('Medição aprovada!')
  }

  async function rejeitarMedicao(id) {
    await supabase.from('medicoes').update({status:'rejeitada'}).eq('id',id)
    setMedicoes(ms=>ms.map(m=>m.id===id?{...m,status:'rejeitada'}:m))
    if (selected?.id===id) setSelected(s=>({...s,status:'rejeitada'}))
    showToast('Medição rejeitada.')
  }

  async function exportarRelatorio(med) {
    const { data: its } = await supabase.from('medicao_itens').select('*').eq('medicao_id',med.id)
    const data = (its??[]).map(it=>({'Descrição':it.descricao,'Tipo':it.tipo||'MA','Categoria':it.categoria,'Qtde Prevista':it.qtd_prevista,'Qtde Medida':it.qtd_medida,'Valor Unit':it.valor_unit,'Total Previsto':(Number(it.qtd_prevista||0)*Number(it.valor_unit||0)).toFixed(2),'Total Medido':(Number(it.qtd_medida||0)*Number(it.valor_unit||0)).toFixed(2)}))
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb,ws,'Medição')
    XLSX.writeFile(wb,`Medicao_${med.numero}_${obra.nome.replace(/\s+/g,'_')}.xlsx`)
  }

  const totalMedido   = medItens.reduce((a,it)=>a+Number(it.qtd_medida||0)*Number(it.valor_unit||0),0)
  const totalPrevisto = medItens.reduce((a,it)=>a+Number(it.qtd_prevista||0)*Number(it.valor_unit||0),0)
  const totalMO  = medItens.filter(it=>it.tipo==='MO').reduce((a,it)=>a+Number(it.qtd_medida||0)*Number(it.valor_unit||0),0)
  const totalMA  = medItens.filter(it=>it.tipo!=='MO').reduce((a,it)=>a+Number(it.qtd_medida||0)*Number(it.valor_unit||0),0)

  if (selected) return (
    <div>
      <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:20,flexWrap:'wrap'}}>
        <button onClick={()=>setSelected(null)} style={{background:'none',border:'1px solid #1E2235',borderRadius:7,color:'#64748B',fontSize:13,cursor:'pointer',padding:'5px 10px'}}>← Voltar</button>
        <div style={{flex:1}}>
          <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
            <span style={{fontSize:16,fontWeight:700,color:'#F1F5F9'}}>Medição {selected.numero} — {fmtMes(selected.mes_ref?.slice(0,7))}</span>
            <span style={{padding:'3px 10px',borderRadius:20,fontSize:11,fontWeight:700,background:STATUS_MED[selected.status]?.bg,color:STATUS_MED[selected.status]?.color}}>{STATUS_MED[selected.status]?.label}</span>
          </div>
        </div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          {selected.status==='rascunho' && <button onClick={enviarMedicao} style={{padding:'7px 16px',borderRadius:7,border:'none',background:'#1E3A5F',color:'#93C5FD',fontWeight:600,fontSize:12,cursor:'pointer'}}>Enviar</button>}
          {selected.status==='enviada'  && <button onClick={()=>aprovarMedicao(selected.id)} style={{padding:'7px 16px',borderRadius:7,border:'none',background:'#064E3B',color:'#6EE7B7',fontWeight:600,fontSize:12,cursor:'pointer'}}>✓ Aprovar</button>}
          {selected.status==='enviada'  && <button onClick={()=>rejeitarMedicao(selected.id)} style={{padding:'7px 16px',borderRadius:7,border:'1px solid #991B1B',background:'transparent',color:'#FCA5A5',fontWeight:600,fontSize:12,cursor:'pointer'}}>✕ Rejeitar</button>}
          {selected.status==='rascunho' && <button onClick={saveMedicao} style={{padding:'7px 16px',borderRadius:7,border:'none',background:'linear-gradient(135deg,#3B82F6,#6366F1)',color:'#fff',fontWeight:700,fontSize:12,cursor:'pointer'}}>Salvar</button>}
          <button onClick={()=>exportarRelatorio(selected)} style={{padding:'7px 14px',borderRadius:7,border:'1px solid #1E2235',background:'transparent',color:'#94A3B8',fontWeight:600,fontSize:12,cursor:'pointer'}}>↓ Exportar</button>
        </div>
      </div>

      {/* Totais */}
      <div style={{display:'flex',gap:10,marginBottom:16,flexWrap:'wrap'}}>
        {[
          {label:'Previsto',           value:fmtBRL(totalPrevisto), color:'#3B82F6'},
          {label:'Medido Total',       value:fmtBRL(totalMedido),   color:'#10B981'},
          {label:'MO Medido',          value:fmtBRL(totalMO),       color:'#8B5CF6'},
          {label:'MA Medido',          value:fmtBRL(totalMA),       color:'#F59E0B'},
          {label:'% Execução',         value:totalPrevisto>0?`${((totalMedido/totalPrevisto)*100).toFixed(1)}%`:'—', color:'#64748B'},
        ].map(s=>(
          <div key={s.label} style={{flex:1,minWidth:110,...card}}>
            <div style={{fontSize:10,color:'#475569',marginBottom:4}}>{s.label}</div>
            <div style={{fontSize:15,fontWeight:700,color:s.color}}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Itens */}
      <div style={{display:'grid',gridTemplateColumns:'2fr 60px 1fr 80px 80px 100px 100px',gap:8,padding:'0 4px',marginBottom:6}}>
        {['Descrição','Tipo','Categoria','Qtde Prev.','Qtde Med.','Valor Unit.','Total Medido'].map((h,i)=>(
          <div key={i} style={{fontSize:10,fontWeight:700,color:'#334155',textTransform:'uppercase'}}>{h}</div>
        ))}
      </div>
      {medItens.map((it,idx)=>(
        <div key={it.id} style={{display:'grid',gridTemplateColumns:'2fr 60px 1fr 80px 80px 100px 100px',gap:8,marginBottom:6}}>
          <div style={{padding:'7px 10px',fontSize:13,color:'#94A3B8',background:'#0F1117',borderRadius:7,border:'1px solid #1E2235',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{it.descricao}</div>
          <div style={{padding:'7px 6px',fontSize:11,fontWeight:600,color:it.tipo==='MO'?'#A78BFA':'#60A5FA',background:'#0F1117',borderRadius:7,border:'1px solid #1E2235',textAlign:'center'}}>{it.tipo||'MA'}</div>
          <div style={{padding:'7px 8px',fontSize:12,color:'#64748B',background:'#0F1117',borderRadius:7,border:'1px solid #1E2235'}}>{it.categoria}</div>
          <div style={{padding:'7px 8px',fontSize:13,color:'#64748B',background:'#0F1117',borderRadius:7,border:'1px solid #1E2235',textAlign:'right'}}>{it.qtd_prevista}</div>
          <input style={{...inp,padding:'7px 8px',textAlign:'right',background:selected.status==='rascunho'?'#0F1117':'#0A0D14'}} type="number" min="0" step="0.01" value={it.qtd_medida} disabled={selected.status!=='rascunho'} onChange={e=>setMedItem(idx,'qtd_medida',e.target.value)} />
          <div style={{padding:'7px 8px',fontSize:13,color:'#64748B',background:'#0F1117',borderRadius:7,border:'1px solid #1E2235',textAlign:'right'}}>{fmtBRL(it.valor_unit)}</div>
          <div style={{padding:'7px 8px',fontSize:12,fontWeight:700,color:'#10B981',background:'#0F1117',borderRadius:7,border:'1px solid #1E2235',textAlign:'right'}}>{fmtBRL(Number(it.qtd_medida||0)*Number(it.valor_unit||0))}</div>
        </div>
      ))}
      {toast && <div style={{position:'fixed',bottom:24,right:24,background:'#064E3B',border:'1px solid #065F46',color:'#6EE7B7',padding:'10px 18px',borderRadius:10,fontSize:13,fontWeight:600,zIndex:2000}}>{toast}</div>}
    </div>
  )

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
        <div>
          <div style={{fontSize:16,fontWeight:700,color:'#F1F5F9'}}>Medições</div>
          <div style={{fontSize:12,color:'#475569',marginTop:2}}>Registro mensal de produção</div>
        </div>
        <button onClick={()=>setNovaMed(true)} style={{padding:'7px 16px',borderRadius:7,border:'none',background:'linear-gradient(135deg,#3B82F6,#6366F1)',color:'#fff',fontWeight:700,fontSize:12,cursor:'pointer'}}>+ Nova Medição</button>
      </div>

      {novaMed && (
        <div style={{background:'#1A1D2E',border:'1px solid #1E3A5F',borderRadius:10,padding:'16px',marginBottom:16}}>
          <div style={{display:'flex',gap:12,alignItems:'flex-end',flexWrap:'wrap'}}>
            <div style={{flex:1,minWidth:140}}>
              <label style={lbl}>Mês de referência</label>
              <select style={inp} value={novoMes} onChange={e=>setNovoMes(e.target.value)}>
                <option value="">Selecione o mês...</option>
                {Array.from({length:12},(_,i)=>{
                  const d = new Date(); d.setMonth(d.getMonth()-3+i)
                  const val = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
                  const label = d.toLocaleDateString('pt-BR',{month:'long',year:'numeric'})
                  return <option key={val} value={val}>{label.charAt(0).toUpperCase()+label.slice(1)}</option>
                })}
              </select>
            </div>
            <div style={{minWidth:120}}>
              <label style={lbl}>Dia da medição</label>
              <select style={inp} value={novoDia} onChange={e=>setNovoDia(e.target.value)}>
                {[1,5,10,15,20,25,28,30].map(d=>(
                  <option key={d} value={d}>Dia {d}{d===25?' (padrão)':''}</option>
                ))}
              </select>
            </div>
            <button onClick={criarMedicao} style={{padding:'8px 18px',borderRadius:7,border:'none',background:'#3B82F6',color:'#fff',fontWeight:700,fontSize:13,cursor:'pointer',marginBottom:1}}>Criar</button>
            <button onClick={()=>setNovaMed(false)} style={{padding:'8px 14px',borderRadius:7,border:'1px solid #1E2235',background:'transparent',color:'#64748B',fontWeight:600,fontSize:13,cursor:'pointer',marginBottom:1}}>Cancelar</button>
          </div>
        </div>
      )}

      {loading ? <div style={{color:'#334155',fontSize:13,padding:'20px 0'}}>Carregando...</div>
      : medicoes.length===0 ? <div style={{textAlign:'center',padding:'40px 0',color:'#334155',fontSize:13}}>Nenhuma medição ainda. Clique em "+ Nova Medição".</div>
      : medicoes.map(m=>{
        const meta = STATUS_MED[m.status]
        return (
          <div key={m.id} onClick={()=>abrirMedicao(m)} style={{...card,marginBottom:8,cursor:'pointer',display:'flex',alignItems:'center',gap:16,transition:'border-color 0.15s'}}
            onMouseEnter={e=>e.currentTarget.style.borderColor='#334155'}
            onMouseLeave={e=>e.currentTarget.style.borderColor='#1E2235'}
          >
            <div style={{width:40,height:40,borderRadius:8,background:'#1E3A5F',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,fontWeight:700,color:'#93C5FD',flexShrink:0}}>{m.numero}</div>
            <div style={{flex:1}}>
              <div style={{fontSize:14,fontWeight:600,color:'#F1F5F9'}}>Medição {m.numero}</div>
              <div style={{fontSize:12,color:'#475569',marginTop:2}}>{fmtMes(m.mes_ref?.slice(0,7))}</div>
            </div>
            <span style={{padding:'3px 12px',borderRadius:20,fontSize:11,fontWeight:700,background:meta.bg,color:meta.color}}>{meta.label}</span>
            {m.status==='enviada' && (
              <div style={{display:'flex',gap:6}} onClick={e=>e.stopPropagation()}>
                <button onClick={()=>aprovarMedicao(m.id)} style={{padding:'5px 12px',borderRadius:6,border:'none',background:'#064E3B',color:'#6EE7B7',fontWeight:600,fontSize:11,cursor:'pointer'}}>✓ Aprovar</button>
                <button onClick={()=>rejeitarMedicao(m.id)} style={{padding:'5px 12px',borderRadius:6,border:'1px solid #991B1B',background:'transparent',color:'#FCA5A5',fontWeight:600,fontSize:11,cursor:'pointer'}}>✕ Rejeitar</button>
              </div>
            )}
            <button onClick={e=>{e.stopPropagation();exportarRelatorio(m)}} style={{padding:'5px 10px',borderRadius:6,border:'1px solid #1E2235',background:'transparent',color:'#475569',fontSize:11,cursor:'pointer'}}>↓</button>
            <div style={{fontSize:16,color:'#334155'}}>›</div>
          </div>
        )
      })}
      {toast && <div style={{position:'fixed',bottom:24,right:24,background:'#064E3B',border:'1px solid #065F46',color:'#6EE7B7',padding:'10px 18px',borderRadius:10,fontSize:13,fontWeight:600,zIndex:2000}}>{toast}</div>}
    </div>
  )
}

// ── PAINEL ────────────────────────────────────────────────────────────────
function Painel({ obra }) {
  const [data, setData]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [abaP, setAbaP]     = useState('resumo') // resumo | curvaS | avanco | boletos

  useEffect(() => { load() }, [obra.id])

  async function load() {
    const [{ data: orc }, { data: meds }, { data: boletos }] = await Promise.all([
      supabase.from('orcamento_itens').select('quantidade,valor_unit,tipo').eq('obra_id', obra.id),
      supabase.from('medicoes').select('id,status').eq('obra_id', obra.id),
      supabase.from('boletos').select('valor,status,vencimento').eq('obra_id', obra.id),
    ])
    const totalOrc = (orc??[]).reduce((a,r)=>a+Number(r.quantidade||0)*Number(r.valor_unit||0),0)
    const totalOrcMO = (orc??[]).filter(r=>r.tipo==='MO').reduce((a,r)=>a+Number(r.quantidade||0)*Number(r.valor_unit||0),0)
    const totalOrcMA = (orc??[]).filter(r=>r.tipo!=='MO').reduce((a,r)=>a+Number(r.quantidade||0)*Number(r.valor_unit||0),0)
    const aprovadas = (meds??[]).filter(m=>m.status==='aprovada')
    let medTotal = 0
    if (aprovadas.length) {
      const { data: mitens } = await supabase.from('medicao_itens').select('qtd_medida,valor_unit').in('medicao_id', aprovadas.map(m=>m.id))
      medTotal = (mitens??[]).reduce((a,it)=>a+Number(it.qtd_medida||0)*Number(it.valor_unit||0),0)
    }
    const today_s = today()
    const boletosVenc = (boletos??[]).filter(b=>{
      if (b.status==='pago') return false
      return b.vencimento <= today_s
    }).length
    const boletosPend = (boletos??[]).filter(b=>b.status!=='pago').reduce((a,b)=>a+Number(b.valor||0),0)
    setData({totalOrc,totalOrcMO,totalOrcMA,medTotal,medCount:(meds??[]).length,boletosVenc,boletosPend})
    setLoading(false)
  }

  if (loading) return <div style={{color:'#334155',fontSize:13}}>Carregando...</div>

  const pct = data.totalOrc > 0 ? Math.min(100,(data.medTotal/data.totalOrc)*100) : 0

  return (
    <div>
      {/* Abas painel */}
      <div style={{display:'flex',gap:4,marginBottom:20,flexWrap:'wrap'}}>
        {[
          {id:'resumo', label:'📊 Resumo'},
          {id:'curvaS', label:'📈 Curva S'},
          {id:'avanco', label:'📅 Avanço Mensal'},
        ].map(a=>(
          <button key={a.id} onClick={()=>setAbaP(a.id)} style={{padding:'7px 14px',borderRadius:8,border:'none',cursor:'pointer',fontSize:13,fontWeight:600,background:abaP===a.id?'#1E3A5F':'transparent',color:abaP===a.id?'#93C5FD':'#475569'}}>{a.label}</button>
        ))}
      </div>

      {abaP==='curvaS' && <CurvaS obra={obra} />}
      {abaP==='avanco' && <AvancoMensal obra={obra} />}
      {abaP==='resumo' && (
        <>
          {data.boletosVenc > 0 && (
            <div style={{background:'#450A0A',border:'1px solid #991B1B',borderRadius:10,padding:'12px 16px',marginBottom:16,display:'flex',alignItems:'center',gap:10}}>
              <span style={{fontSize:18}}>⚠️</span>
              <span style={{fontSize:13,fontWeight:600,color:'#FCA5A5'}}>{data.boletosVenc} boleto{data.boletosVenc>1?'s':''} vencido{data.boletosVenc>1?'s':''}!</span>
            </div>
          )}
          <div style={{display:'flex',gap:12,marginBottom:24,flexWrap:'wrap'}}>
            {[
              {label:'Orçamento total',    value:fmtBRL(data.totalOrc),   color:'#3B82F6', icon:'📋'},
              {label:'Total MA',           value:fmtBRL(data.totalOrcMA), color:'#60A5FA', icon:'📦'},
              {label:'Total MO',           value:fmtBRL(data.totalOrcMO), color:'#A78BFA', icon:'👷'},
              {label:'Medido (aprovado)',  value:fmtBRL(data.medTotal),   color:'#10B981', icon:'✅'},
              {label:'Saldo',             value:fmtBRL(data.totalOrc-data.medTotal), color:'#F59E0B', icon:'💰'},
              {label:'Boletos a pagar',   value:fmtBRL(data.boletosPend), color:'#EF4444', icon:'📄'},
            ].map(s=>(
              <div key={s.label} style={{flex:1,minWidth:140,...card}}>
                <div style={{fontSize:20,marginBottom:8}}>{s.icon}</div>
                <div style={{fontSize:11,color:'#475569',marginBottom:4}}>{s.label}</div>
                <div style={{fontSize:16,fontWeight:700,color:s.color}}>{s.value}</div>
              </div>
            ))}
          </div>
          <div style={{...card}}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:10}}>
              <span style={{fontSize:13,fontWeight:600,color:'#94A3B8'}}>Execução financeira</span>
              <span style={{fontSize:14,fontWeight:700,color:'#10B981'}}>{pct.toFixed(1)}%</span>
            </div>
            <div style={{height:12,background:'#0F1117',borderRadius:6,overflow:'hidden'}}>
              <div style={{height:'100%',width:`${pct}%`,background:'linear-gradient(90deg,#3B82F6,#10B981)',borderRadius:6,transition:'width 0.5s ease'}} />
            </div>
            <div style={{display:'flex',justifyContent:'space-between',marginTop:8}}>
              <span style={{fontSize:11,color:'#334155'}}>R$ 0</span>
              <span style={{fontSize:11,color:'#334155'}}>{fmtBRL(data.totalOrc)}</span>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ── COMPONENTE PRINCIPAL ──────────────────────────────────────────────────
export default function Financeiro({ session, permissoes, abaInicial = 'painel' }) {
  const [obras,   setObras]   = useState([])
  const [obra,    setObra]    = useState(null)
  const [aba,     setAba]     = useState(abaInicial)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (()=>{
      const isAdmin = permissoes?.isAdmin ?? true
      let q = supabase.from('obras').select('*').order('created_at',{ascending:false})
      if (isAdmin) return q.eq('owner_id', session.user.id)
      const ids = permissoes?.obrasIds ?? []
      if (!ids.length) return q.eq('id','none')
      return q.in('id', ids)
    })().then(({ data }) => { setObras(data??[]); setLoading(false) })
  }, [])

  if (!obra) return (
    <div style={{flex:1,padding:'28px',overflowY:'auto',color:'#E2E8F0',fontFamily:"'DM Sans', sans-serif"}}>
      <div style={{marginBottom:24}}>
        <h1 style={{fontSize:22,fontWeight:700,color:'#F1F5F9',marginBottom:4}}>Financeiro</h1>
        <p style={{fontSize:13,color:'#475569'}}>Selecione uma obra para gerenciar o financeiro.</p>
      </div>
      {loading ? <div style={{color:'#334155'}}>Carregando...</div>
      : obras.length===0 ? (
        <div style={{textAlign:'center',padding:'60px 0'}}>
          <div style={{fontSize:40,marginBottom:12}}>💰</div>
          <p style={{fontSize:15,fontWeight:600,color:'#475569'}}>Nenhuma obra cadastrada</p>
        </div>
      ) : obras.map(o=>{
        const meta = STATUS_OBRA[o.status]??STATUS_OBRA.em_andamento
        return (
          <div key={o.id} onClick={()=>setObra(o)} style={{background:'#1A1D2E',border:'1px solid #1E2235',borderRadius:12,padding:'18px 22px',cursor:'pointer',marginBottom:10,display:'flex',alignItems:'center',gap:16,transition:'all 0.15s'}}
            onMouseEnter={e=>{e.currentTarget.style.borderColor='#3B82F640';e.currentTarget.style.background='#1E2235'}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor='#1E2235';e.currentTarget.style.background='#1A1D2E'}}
          >
            <div style={{width:48,height:48,borderRadius:12,background:'linear-gradient(135deg,#064E3B,#1E3A5F)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:22}}>💰</div>
            <div style={{flex:1}}>
              <div style={{fontSize:16,fontWeight:600,color:'#F1F5F9',marginBottom:3}}>{o.nome}</div>
              {o.endereco && <div style={{fontSize:12,color:'#475569'}}>{o.endereco}</div>}
            </div>
            <span style={{padding:'4px 12px',borderRadius:20,fontSize:11,fontWeight:600,background:meta.bg,color:meta.color}}>{meta.label}</span>
            <div style={{fontSize:20,color:'#334155'}}>›</div>
          </div>
        )
      })}
    </div>
  )

  const ABAS = [
    {id:'painel',   label:'📊 Painel'},
    {id:'orcamento',label:'📋 Orçamento'},
    {id:'medicoes', label:'📐 Medições'},
    {id:'boletos',  label:'📄 Boletos'},
  ]

  return (
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',fontFamily:"'DM Sans', sans-serif"}}>
      <div style={{background:'#1A1D2E',borderBottom:'1px solid #1E2235',padding:'14px 24px',display:'flex',alignItems:'center',gap:12,flexShrink:0,flexWrap:'wrap'}}>
        <button onClick={()=>setObra(null)} style={{background:'none',border:'1px solid #1E2235',borderRadius:7,color:'#64748B',fontSize:13,cursor:'pointer',padding:'5px 10px'}}>← Voltar</button>
        <div style={{fontSize:16,fontWeight:700,color:'#F1F5F9'}}>{obra.nome}</div>
        <div style={{fontSize:12,color:'#475569'}}>Financeiro</div>
      </div>
      <div style={{display:'flex',gap:4,padding:'12px 24px',borderBottom:'1px solid #1E2235',flexShrink:0,flexWrap:'wrap'}}>
        {ABAS.map(a=>(
          <button key={a.id} onClick={()=>setAba(a.id)} style={{padding:'7px 16px',borderRadius:8,border:'none',cursor:'pointer',fontSize:13,fontWeight:600,background:aba===a.id?'#1E3A5F':'transparent',color:aba===a.id?'#93C5FD':'#475569'}}>{a.label}</button>
        ))}
      </div>
      <div style={{flex:1,overflowY:'auto',padding:'24px'}}>
        {aba==='painel'    && <Painel    obra={obra} />}
        {aba==='orcamento' && <Orcamento obra={obra} />}
        {aba==='medicoes'  && <Medicoes  obra={obra} />}
        {aba==='boletos'   && <Boletos   obra={obra} />}
      </div>
    </div>
  )
}
