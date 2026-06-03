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
      <SvgLineChart data={data} height={280} lines={[
        {key:'previsto',  color:'#3B82F6', dashed:true},
        {key:'realizado', color:'#10B981', dashed:false},
      ]} />
      <div style={{display:'flex',gap:16,justifyContent:'center',marginTop:8,fontSize:12,color:'#64748B'}}>
        <span style={{display:'flex',alignItems:'center',gap:4}}><span style={{width:20,height:2,background:'#3B82F6',display:'inline-block',borderRadius:2}}/>Previsto</span>
        <span style={{display:'flex',alignItems:'center',gap:4}}><span style={{width:20,height:2,background:'#10B981',display:'inline-block',borderRadius:2}}/>Realizado</span>
      </div>
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
        <SvgBarChart data={data} height={200} bars={[
          {key:'previsto',  color:'#3B82F6'},
          {key:'realizado', color:'#10B981'},
        ]} formatY={v=>v>999?`${(v/1000).toFixed(0)}k`:v.toFixed(0)} />
        <div style={{display:'flex',gap:16,justifyContent:'center',marginTop:6,fontSize:12,color:'#64748B'}}>
          <span style={{display:'flex',alignItems:'center',gap:4}}><span style={{width:12,height:12,background:'#3B82F6',display:'inline-block',borderRadius:2}}/>Previsto</span>
          <span style={{display:'flex',alignItems:'center',gap:4}}><span style={{width:12,height:12,background:'#10B981',display:'inline-block',borderRadius:2}}/>Realizado</span>
        </div>
      </div>
      <div>
        <div style={{fontSize:13,fontWeight:600,color:'#94A3B8',marginBottom:10}}>Avanço Físico por Mês (%)</div>
        <SvgBarChart data={data} height={180} bars={[{key:'fisico',color:'#8B5CF6'}]} formatY={v=>`${v.toFixed(0)}%`} />
      </div>
    </div>
  )
}

// ── BOLETOS ───────────────────────────────────────────────────────────────
const BANCOS = ['Bradesco','Itaú','Banco do Brasil','Caixa Econômica','Santander','Sicoob','Sicredi','Nubank','Inter','BTG','Outro']

function BoletoDetalheModal({ boleto, onSave, onClose }) {
  const [form, setForm] = useState({
    banco:          boleto.banco          ?? '',
    agencia:        boleto.agencia        ?? '',
    conta:          boleto.conta          ?? '',
    favorecido:     boleto.favorecido     ?? boleto.fornecedor ?? '',
    cnpj_favorecido:boleto.cnpj_favorecido?? '',
    linha_digitavel:boleto.linha_digitavel?? '',
    codigo_barras:  boleto.codigo_barras  ?? '',
    nosso_numero:   boleto.nosso_numero   ?? '',
    instrucoes:     boleto.instrucoes     ?? '',
  })
  const setF = (k,v) => setForm(f=>({...f,[k]:v}))
  const [imprimindo, setImprimindo] = useState(false)

  function emitirBoleto() {
    setImprimindo(true)
    const w = window.open('','_blank','width=800,height=600')
    const venc = boleto.vencimento ? new Date(boleto.vencimento+'T00:00:00').toLocaleDateString('pt-BR') : '—'
    const emis = boleto.emissao    ? new Date(boleto.emissao+'T00:00:00').toLocaleDateString('pt-BR')    : '—'
    const valor = Number(boleto.valor||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})

    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Boleto</title>
    <style>
      *{margin:0;padding:0;box-sizing:border-box;font-family:Arial,sans-serif}
      body{background:#fff;color:#000;padding:20px}
      .header{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #000;padding-bottom:8px;margin-bottom:8px}
      .logo{font-size:20px;font-weight:bold}
      .banco{font-size:18px;font-weight:bold;border-left:2px solid #000;border-right:2px solid #000;padding:0 12px}
      .codigo-banco{font-size:16px;font-weight:bold}
      .linha{font-size:13px;letter-spacing:1px;text-align:right;flex:1;padding-left:12px}
      .grid{display:grid;gap:0}
      .row{display:flex;border-bottom:1px solid #000}
      .cell{border-right:1px solid #000;padding:4px 8px;flex:1}
      .cell:last-child{border-right:none}
      .cell-label{font-size:9px;color:#555;text-transform:uppercase;margin-bottom:2px}
      .cell-value{font-size:12px;font-weight:bold}
      .barcode{text-align:center;margin:16px 0;padding:12px;border:1px solid #000}
      .barcode-text{font-family:monospace;font-size:11px;letter-spacing:2px;word-break:break-all}
      .instrucoes{border:1px solid #000;padding:8px;margin-top:8px;min-height:60px}
      .instrucoes-label{font-size:9px;color:#555;margin-bottom:4px}
      .footer{margin-top:16px;border-top:1px dashed #000;padding-top:8px;font-size:10px;color:#555;text-align:center}
      h3{font-size:13px;margin-bottom:8px;margin-top:12px;border-bottom:1px solid #ccc;padding-bottom:4px}
      @media print{body{padding:10px}.no-print{display:none}}
    </style></head><body>
    <div class="no-print" style="margin-bottom:12px">
      <button onclick="window.print()" style="padding:8px 20px;background:#1a56db;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:14px">🖨️ Imprimir / Salvar PDF</button>
      <button onclick="window.close()" style="padding:8px 16px;background:#e5e7eb;color:#111;border:none;border-radius:4px;cursor:pointer;font-size:14px;margin-left:8px">Fechar</button>
    </div>

    <div class="header">
      <div class="logo">SA Pride Construtora</div>
      <div class="banco">${form.banco||'BANCO'}</div>
      <div class="codigo-banco">${form.banco==='Bradesco'?'237':form.banco==='Itaú'?'341':form.banco==='Banco do Brasil'?'001':form.banco==='Caixa Econômica'?'104':form.banco==='Santander'?'033':'000'}-9</div>
      <div class="linha">${form.linha_digitavel||'00000.00000 00000.000000 00000.000000 0 00000000000000'}</div>
    </div>

    <div class="grid">
      <div class="row">
        <div class="cell" style="flex:3">
          <div class="cell-label">Beneficiário</div>
          <div class="cell-value">${form.favorecido||boleto.fornecedor||'—'}</div>
        </div>
        <div class="cell">
          <div class="cell-label">CNPJ/CPF</div>
          <div class="cell-value">${form.cnpj_favorecido||'—'}</div>
        </div>
        <div class="cell">
          <div class="cell-label">Agência/Conta</div>
          <div class="cell-value">${form.agencia||'—'}/${form.conta||'—'}</div>
        </div>
      </div>
      <div class="row">
        <div class="cell" style="flex:3">
          <div class="cell-label">Pagador</div>
          <div class="cell-value">${boleto.descricao}</div>
        </div>
        <div class="cell">
          <div class="cell-label">Nosso Número</div>
          <div class="cell-value">${form.nosso_numero||'—'}</div>
        </div>
        <div class="cell">
          <div class="cell-label">Nº Documento</div>
          <div class="cell-value">${boleto.observacoes||'—'}</div>
        </div>
      </div>
      <div class="row">
        <div class="cell">
          <div class="cell-label">Data de Emissão</div>
          <div class="cell-value">${emis}</div>
        </div>
        <div class="cell">
          <div class="cell-label">Vencimento</div>
          <div class="cell-value" style="color:#c00;font-size:14px">${venc}</div>
        </div>
        <div class="cell">
          <div class="cell-label">Espécie</div>
          <div class="cell-value">R$</div>
        </div>
        <div class="cell" style="flex:2">
          <div class="cell-label">Valor do Documento</div>
          <div class="cell-value" style="font-size:16px;color:#000">R$ ${valor}</div>
        </div>
      </div>
    </div>

    <div class="instrucoes">
      <div class="instrucoes-label">Instruções (texto de responsabilidade do beneficiário)</div>
      <div style="font-size:12px;margin-top:4px">${form.instrucoes||'Pagar até a data de vencimento.'}</div>
    </div>

    <div class="barcode">
      <div class="instrucoes-label" style="margin-bottom:6px">Linha Digitável</div>
      <div class="barcode-text">${form.linha_digitavel||'00000.00000 00000.000000 00000.000000 0 00000000000000'}</div>
      ${form.codigo_barras ? `<div style="margin-top:8px;font-family:monospace;font-size:8px;letter-spacing:4px;overflow:hidden">${form.codigo_barras}</div>` : ''}
    </div>

    <div class="footer">Documento gerado pelo SA Pride ERP — ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}</div>
    </body></html>`)
    w.document.close()
    setTimeout(() => setImprimindo(false), 500)
  }

  return (
    <div onClick={e=>e.target===e.currentTarget&&onClose()} style={{position:'fixed',inset:0,background:'#00000090',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1200,padding:16}}>
      <div style={{background:'#1A1D2E',border:'1px solid #1E2235',borderRadius:16,padding:'24px',width:500,maxWidth:'100%',maxHeight:'92vh',overflowY:'auto'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
          <div>
            <div style={{fontSize:16,fontWeight:700,color:'#F1F5F9'}}>Detalhes do Boleto</div>
            <div style={{fontSize:12,color:'#475569',marginTop:2}}>{boleto.descricao}</div>
          </div>
          <button onClick={onClose} style={{background:'none',border:'none',color:'#475569',fontSize:22,cursor:'pointer'}}>×</button>
        </div>

        {/* Info resumida */}
        <div style={{display:'flex',gap:10,marginBottom:16,padding:'10px 14px',background:'#0F1117',borderRadius:8}}>
          <div style={{flex:1}}>
            <div style={{fontSize:10,color:'#475569'}}>Valor</div>
            <div style={{fontSize:16,fontWeight:700,color:'#F1F5F9'}}>{Number(boleto.valor||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</div>
          </div>
          <div style={{flex:1}}>
            <div style={{fontSize:10,color:'#475569'}}>Vencimento</div>
            <div style={{fontSize:14,fontWeight:700,color:'#EF4444'}}>{boleto.vencimento?new Date(boleto.vencimento+'T00:00:00').toLocaleDateString('pt-BR'):'—'}</div>
          </div>
          <div style={{flex:1}}>
            <div style={{fontSize:10,color:'#475569'}}>Fornecedor</div>
            <div style={{fontSize:12,fontWeight:600,color:'#94A3B8'}}>{boleto.fornecedor||'—'}</div>
          </div>
        </div>

        <div style={{display:'flex',gap:12,marginBottom:12}}>
          <div style={{flex:2}}>
            <label style={lbl}>Favorecido (Beneficiário)</label>
            <input style={inp} value={form.favorecido} onChange={e=>setF('favorecido',e.target.value)} placeholder="Nome do favorecido" />
          </div>
          <div style={{flex:1}}>
            <label style={lbl}>CNPJ/CPF</label>
            <input style={inp} value={form.cnpj_favorecido} onChange={e=>setF('cnpj_favorecido',e.target.value)} placeholder="00.000.000/0001-00" />
          </div>
        </div>

        <div style={{display:'flex',gap:12,marginBottom:12}}>
          <div style={{flex:2}}>
            <label style={lbl}>Banco</label>
            <select style={inp} value={form.banco} onChange={e=>setF('banco',e.target.value)}>
              <option value="">Selecione...</option>
              {BANCOS.map(b=><option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <div style={{flex:1}}>
            <label style={lbl}>Agência</label>
            <input style={inp} value={form.agencia} onChange={e=>setF('agencia',e.target.value)} placeholder="0000" />
          </div>
          <div style={{flex:1}}>
            <label style={lbl}>Conta</label>
            <input style={inp} value={form.conta} onChange={e=>setF('conta',e.target.value)} placeholder="00000-0" />
          </div>
        </div>

        <label style={lbl}>Linha Digitável *</label>
        <input style={{...inp,marginBottom:12,fontFamily:'monospace',letterSpacing:1}} value={form.linha_digitavel} onChange={e=>setF('linha_digitavel',e.target.value)} placeholder="00000.00000 00000.000000 00000.000000 0 00000000000000" />

        <label style={lbl}>Código de Barras</label>
        <input style={{...inp,marginBottom:12,fontFamily:'monospace',fontSize:11}} value={form.codigo_barras} onChange={e=>setF('codigo_barras',e.target.value)} placeholder="00000000000000000000000000000000000000000000" />

        <div style={{display:'flex',gap:12,marginBottom:12}}>
          <div style={{flex:1}}>
            <label style={lbl}>Nosso Número</label>
            <input style={inp} value={form.nosso_numero} onChange={e=>setF('nosso_numero',e.target.value)} placeholder="00000000" />
          </div>
        </div>

        <label style={lbl}>Instruções de pagamento</label>
        <textarea style={{...inp,resize:'vertical',minHeight:60,marginBottom:20}} value={form.instrucoes} onChange={e=>setF('instrucoes',e.target.value)} placeholder="Ex: Não receber após o vencimento. Multa de 2% após vencimento." />

        <div style={{display:'flex',justifyContent:'space-between',gap:8}}>
          <button onClick={onClose} style={{padding:'8px 16px',borderRadius:7,border:'1px solid #1E2235',background:'transparent',color:'#64748B',fontWeight:600,fontSize:13,cursor:'pointer'}}>Cancelar</button>
          <div style={{display:'flex',gap:8}}>
            <button onClick={()=>onSave(form)} style={{padding:'8px 16px',borderRadius:7,border:'1px solid #1E3A5F',background:'transparent',color:'#93C5FD',fontWeight:600,fontSize:13,cursor:'pointer'}}>💾 Salvar</button>
            <button onClick={emitirBoleto} disabled={imprimindo} style={{padding:'8px 18px',borderRadius:7,border:'none',background:'linear-gradient(135deg,#3B82F6,#6366F1)',color:'#fff',fontWeight:700,fontSize:13,cursor:'pointer'}}>
              🖨️ Emitir boleto
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Boletos({ obra }) {
  const [boletos,  setBoletos]  = useState([])
  const [loading,  setLoading]  = useState(true)
  const [modal,    setModal]    = useState(null)
  const [detalhe,  setDetalhe]  = useState(null)
  const [toast,    setToast]    = useState(null)
  const [filtro,   setFiltro]   = useState('todos')
  const [form, setForm] = useState({ descricao:'', valor:'', emissao:'', parcelas:'1', condicao:'30', fornecedor:'', observacoes:'' })

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
      valor: valorParcela, emissao: form.emissao, vencimento: v,
      status: 'pendente', fornecedor: form.fornecedor||null, observacoes: form.observacoes||null,
    }))
    await supabase.from('boletos').insert(toInsert)
    setModal(null)
    setForm({descricao:'',valor:'',emissao:'',parcelas:'1',condicao:'30',fornecedor:'',observacoes:''})
    await fetchBoletos()
    showToast(`${toInsert.length} boleto${toInsert.length>1?'s':''} criado${toInsert.length>1?'s':''}!`)
  }

  async function togglePago(b) {
    const novoStatus = b.status === 'pago' ? 'pendente' : 'pago'
    await supabase.from('boletos').update({status:novoStatus, data_pagamento: novoStatus==='pago' ? today() : null}).eq('id',b.id)
    setBoletos(bs=>bs.map(bb=>bb.id===b.id?{...bb,status:novoStatus}:bb))
    showToast(novoStatus==='pago' ? '✅ Boleto marcado como pago!' : 'Boleto desmarcado.')
  }

  async function deleteBoleto(id) {
    if (!confirm('Excluir boleto?')) return
    await supabase.from('boletos').delete().eq('id',id)
    setBoletos(bs=>bs.filter(b=>b.id!==id))
  }

  async function saveDetalhe(id, form) {
    await supabase.from('boletos').update({
      banco:           form.banco,
      agencia:         form.agencia,
      conta:           form.conta,
      favorecido:      form.favorecido,
      cnpj_favorecido: form.cnpj_favorecido,
      linha_digitavel: form.linha_digitavel,
      codigo_barras:   form.codigo_barras,
      nosso_numero:    form.nosso_numero,
      instrucoes:      form.instrucoes,
    }).eq('id', id)
    setBoletos(bs => bs.map(b => b.id===id ? {...b,...form} : b))
    setDetalhe(null)
    showToast('Boleto salvo!')
  }

  // Calcula status real
  const boletosComStatus = boletos.map(b => {
    if (b.status==='pago') return b
    const dt = new Date(b.vencimento+'T00:00:00')
    const t = new Date(); t.setHours(0,0,0,0)
    if (dt < t) return {...b, _status:'vencido'}
    const diff = Math.round((dt-t)/86400000)
    if (diff <= 7) return {...b, _status:'urgente', _diff: diff}
    if (diff <= 30) return {...b, _status:'proximo', _diff: diff}
    return {...b, _status:'ok', _diff: diff}
  })

  // Stats
  const vencidos  = boletosComStatus.filter(b=>b._status==='vencido').length
  const urgentes  = boletosComStatus.filter(b=>b._status==='urgente').length
  const proximos  = boletosComStatus.filter(b=>b._status==='proximo').length
  const pagos     = boletosComStatus.filter(b=>b.status==='pago').length
  const totalPend = boletosComStatus.filter(b=>b.status!=='pago').reduce((a,b)=>a+Number(b.valor||0),0)
  const totalPago = boletosComStatus.filter(b=>b.status==='pago').reduce((a,b)=>a+Number(b.valor||0),0)
  const totalVenc = boletosComStatus.filter(b=>b._status==='vencido').reduce((a,b)=>a+Number(b.valor||0),0)

  // Filtro
  const filtrados = boletosComStatus.filter(b => {
    if (filtro==='todos')    return true
    if (filtro==='pago')     return b.status==='pago'
    if (filtro==='vencido')  return b._status==='vencido'
    if (filtro==='proximos') return b._status==='urgente'||b._status==='proximo'
    if (filtro==='pendente') return b.status!=='pago'&&b._status!=='vencido'
    return true
  })

  // Agrupa por mês de vencimento
  const grupos = {}
  filtrados.forEach(b => {
    const mes = b.vencimento?.slice(0,7) ?? 'sem_data'
    if (!grupos[mes]) grupos[mes] = []
    grupos[mes].push(b)
  })

  return (
    <div>
      {/* Alertas de vencimento */}
      {(vencidos > 0 || urgentes > 0) && (
        <div style={{background:'#450A0A',border:'1px solid #991B1B',borderRadius:10,padding:'12px 16px',marginBottom:16,display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
          <span style={{fontSize:20}}>🚨</span>
          <div>
            {vencidos > 0 && <div style={{fontSize:13,fontWeight:700,color:'#FCA5A5'}}>{vencidos} boleto{vencidos>1?'s':''} VENCIDO{vencidos>1?'S':''} — {fmtBRL(totalVenc)}</div>}
            {urgentes > 0 && <div style={{fontSize:12,color:'#FCA5A5',opacity:0.8}}>{urgentes} vencendo nos próximos 7 dias</div>}
          </div>
        </div>
      )}

      {/* Stats */}
      <div style={{display:'flex',gap:10,marginBottom:16,flexWrap:'wrap'}}>
        {[
          {label:'A pagar',    value:fmtBRL(totalPend), color:'#F59E0B', icon:'📋'},
          {label:'Pago',       value:fmtBRL(totalPago), color:'#10B981', icon:'✅'},
          {label:'Vencidos',   value:vencidos,           color:'#EF4444', icon:'⚠️'},
          {label:'Próx. 30d',  value:proximos+urgentes,  color:'#F59E0B', icon:'⏰'},
          {label:'Pagos (qtd)',value:pagos,              color:'#6366F1', icon:'🧾'},
        ].map(s=>(
          <div key={s.label} style={{flex:1,minWidth:100,...card}}>
            <div style={{fontSize:16,marginBottom:4}}>{s.icon}</div>
            <div style={{fontSize:10,color:'#475569',marginBottom:2}}>{s.label}</div>
            <div style={{fontSize:15,fontWeight:700,color:s.color}}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filtros + botão novo */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16,flexWrap:'wrap',gap:8}}>
        <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
          {[
            {id:'todos',    label:'Todos', count: boletosComStatus.length},
            {id:'vencido',  label:'⚠️ Vencidos', count: vencidos, color:'#EF4444'},
            {id:'proximos', label:'⏰ Próximos', count: proximos+urgentes, color:'#F59E0B'},
            {id:'pendente', label:'📋 Pendentes', count: boletosComStatus.filter(b=>b.status!=='pago'&&b._status!=='vencido').length},
            {id:'pago',     label:'✅ Pagos', count: pagos, color:'#10B981'},
          ].map(f=>(
            <button key={f.id} onClick={()=>setFiltro(f.id)} style={{
              padding:'5px 12px',borderRadius:20,border:'none',cursor:'pointer',fontSize:12,fontWeight:600,
              background:filtro===f.id?(f.color?f.color+'22':'#1E3A5F'):'transparent',
              color:filtro===f.id?(f.color??'#93C5FD'):'#475569',
              outline: filtro===f.id?`1.5px solid ${f.color??'#3B82F6'}`:'none',
            }}>{f.label} {f.count>0&&<span style={{opacity:0.7}}>({f.count})</span>}</button>
          ))}
        </div>
        <button onClick={()=>setModal(true)} style={{padding:'7px 14px',borderRadius:7,border:'none',background:'linear-gradient(135deg,#3B82F6,#6366F1)',color:'#fff',fontWeight:700,fontSize:12,cursor:'pointer'}}>+ Novo boleto</button>
      </div>

      {/* Lista agrupada por mês */}
      {loading ? <div style={{color:'#334155',fontSize:13}}>Carregando...</div>
      : filtrados.length === 0 ? (
        <div style={{textAlign:'center',padding:'40px 0',color:'#334155',fontSize:13}}>
          {filtro==='todos' ? 'Nenhum boleto cadastrado.' : 'Nenhum boleto neste filtro.'}
        </div>
      ) : Object.entries(grupos).sort().map(([mes, items]) => {
        const totalMes = items.reduce((a,b)=>a+Number(b.valor||0),0)
        const nomeMes = mes==='sem_data' ? 'Sem data' : new Date(mes+'-01T00:00:00').toLocaleDateString('pt-BR',{month:'long',year:'numeric'})
        return (
          <div key={mes} style={{marginBottom:20}}>
            {/* Header do mês */}
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8,padding:'6px 0',borderBottom:'1px solid #1E2235'}}>
              <div style={{fontSize:12,fontWeight:700,color:'#64748B',textTransform:'uppercase',letterSpacing:0.5}}>
                📅 {nomeMes}
              </div>
              <div style={{fontSize:12,fontWeight:600,color:'#94A3B8'}}>{fmtBRL(totalMes)}</div>
            </div>

            {items.map(b => {
              const isPago   = b.status==='pago'
              const isVenc   = b._status==='vencido'
              const isUrgent = b._status==='urgente'
              const isProx   = b._status==='proximo'

              const borderColor = isPago ? '#064E3B' : isVenc ? '#991B1B' : isUrgent ? '#92400E' : '#1E2235'
              const badgeColor  = isPago ? '#10B981' : isVenc ? '#EF4444' : isUrgent ? '#F59E0B' : isProx ? '#F59E0B' : '#64748B'
              const badgeBg     = isPago ? '#064E3B' : isVenc ? '#450A0A' : isUrgent||isProx ? '#451A03' : '#1E2235'
              const badgeLabel  = isPago ? `✓ Pago` : isVenc ? `Vencido` : `${b._diff}d`

              return (
                <div key={b.id} style={{
                  background: isPago ? '#0A1A10' : isVenc ? '#1A0808' : '#1A1D2E',
                  border:`1px solid ${borderColor}`,
                  borderRadius:10, padding:'12px 14px', marginBottom:6,
                  display:'flex', alignItems:'center', gap:12, transition:'all 0.15s',
                }}>
                  {/* Indicador lateral */}
                  <div style={{width:4,height:40,borderRadius:2,background:badgeColor,flexShrink:0}} />

                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:600,color: isPago?'#64748B':'#F1F5F9',marginBottom:3,textDecoration:isPago?'line-through':'none'}}>
                      {b.descricao}
                    </div>
                    <div style={{display:'flex',gap:10,flexWrap:'wrap',fontSize:11,color:'#475569'}}>
                      {b.fornecedor && <span>🏢 {b.fornecedor}</span>}
                      <span>📅 {new Date(b.vencimento+'T00:00:00').toLocaleDateString('pt-BR')}</span>
                      {b.data_pagamento && <span>✓ Pago em {new Date(b.data_pagamento+'T00:00:00').toLocaleDateString('pt-BR')}</span>}
                      {b.observacoes && <span style={{maxWidth:200,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>💬 {b.observacoes}</span>}
                    </div>
                  </div>

                  <div style={{textAlign:'right',flexShrink:0}}>
                    <div style={{fontSize:15,fontWeight:700,color:isPago?'#64748B':'#F1F5F9',marginBottom:4}}>{fmtBRL(b.valor)}</div>
                    <span style={{padding:'2px 8px',borderRadius:12,fontSize:10,fontWeight:700,background:badgeBg,color:badgeColor}}>{badgeLabel}</span>
                  </div>

                  <div style={{display:'flex',gap:6,flexShrink:0}}>
                    <button
                      onClick={()=>setDetalhe(b)}
                      title="Preencher e emitir boleto"
                      style={{padding:'6px 10px',borderRadius:6,border:'1px solid #1E2235',background:'transparent',color:'#64748B',fontSize:11,cursor:'pointer',fontWeight:600}}
                    >📋 Detalhes</button>
                    <button
                      onClick={()=>togglePago(b)}
                      title={isPago?'Desmarcar pagamento':'Confirmar pagamento'}
                      style={{padding:'6px 10px',borderRadius:6,border:`1px solid ${isPago?'#064E3B':'#1E3A5F'}`,background:'transparent',color:isPago?'#6EE7B7':'#93C5FD',fontSize:12,cursor:'pointer',fontWeight:600}}
                    >{isPago?'✓ Pago':'Pagar'}</button>
                    <button onClick={()=>deleteBoleto(b.id)} style={{padding:'6px 8px',borderRadius:6,border:'1px solid #1E2235',background:'transparent',color:'#475569',fontSize:14,cursor:'pointer'}}>×</button>
                  </div>
                </div>
              )
            })}
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
                  <option value="7">7 dias</option>
                  <option value="15">15 dias</option>
                  <option value="30">30 dias</option>
                  <option value="60">60 dias</option>
                  <option value="90">90 dias</option>
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
                  <div key={i} style={{marginBottom:2}}>Parcela {i+1}: <strong style={{color:'#94A3B8'}}>{new Date(v+'T00:00:00').toLocaleDateString('pt-BR')}</strong> — {fmtBRL(Number(form.valor||0)/parseInt(form.parcelas||1))}</div>
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

      {detalhe && (
        <BoletoDetalheModal
          boleto={detalhe}
          onSave={form => saveDetalhe(detalhe.id, form)}
          onClose={() => setDetalhe(null)}
        />
      )}
    </div>
  )
}

// ── ORÇAMENTO (MO / MA) ───────────────────────────────────────────────────
function Orcamento({ obra }) {
  const [itens,     setItens]     = useState([])
  const [rows,      setRows]      = useState([])
  const [contratos, setContratos] = useState([])
  const [loading,   setLoading]   = useState(true)
  const [toast,     setToast]     = useState(null)
  const [abaOrc,    setAbaOrc]    = useState('lista')

  useEffect(() => { fetchItens() }, [obra.id])

  async function fetchItens() {
    const [{ data }, { data: cts }] = await Promise.all([
      supabase.from('orcamento_itens').select('*').eq('obra_id', obra.id).order('ordem'),
      supabase.from('contratos').select('id,numero,descricao').eq('obra_id', obra.id).order('created_at'),
    ])
    setItens(data??[])
    setContratos(cts??[])
    setLoading(false)
  }

  useEffect(() => { setRows(itens.map(i=>({...i,isNew:false}))) }, [itens])

  function showToast(msg) { setToast(msg); setTimeout(()=>setToast(null),3000) }
  function newRow() { return {_tmp:Date.now(),obra_id:obra.id,descricao:'',categoria:'Geral',tipo:'MA',unidade:'un',quantidade:1,valor_unit:0,contrato_id:null,isNew:true} }
  function setRow(idx,k,v) { setRows(rs=>rs.map((r,i)=>i===idx?{...r,[k]:v}:r)) }
  function addRow() { setRows(rs=>[...rs,newRow()]) }
  async function removeRow(idx) {
    const r = rows[idx]
    if (!r.isNew) await supabase.from('orcamento_itens').delete().eq('id',r.id)
    setRows(rs=>rs.filter((_,i)=>i!==idx))
  }

  async function saveAll() {
    for (const r of rows) {
      const payload = {obra_id:obra.id,descricao:r.descricao,categoria:r.categoria,tipo:r.tipo||'MA',unidade:r.unidade,quantidade:Number(r.quantidade),valor_unit:Number(r.valor_unit),ordem:rows.indexOf(r),contrato_id:r.contrato_id||null}
      if (r.isNew) { if (r.descricao.trim()) await supabase.from('orcamento_itens').insert(payload) }
      else await supabase.from('orcamento_itens').update(payload).eq('id',r.id)
    }
    await fetchItens()
    showToast('Orçamento salvo!')
  }

  async function handleImport(e) {
    const file = e.target.files[0]; if (!file) return
    const buf = await file.arrayBuffer()
    const wb  = XLSX.read(buf, { cellDates: true })
    const ws  = wb.Sheets[wb.SheetNames[0]]
    const raw = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null })

    let toInsert = []

    // Detecta formato Cronograma Físico/Financeiro
    // Col B = descrição, Col C = M.O ou Material, Col G = custo
    const isCronFormat = raw.slice(0,5).some(r =>
      (r[2]==='M.O' || r[2]==='Material' || r[1]==='M.O' || r[1]==='Material')
    )

    if (isCronFormat) {
      let lastDesc = ''
      let ordem = 0
      for (const row of raw) {
        const colB = row[1]
        const colC = row[2]
        const colG = row[6]

        // Ignora linhas de cabeçalho
        if (colB === 'DESCRIÇÃO' || (typeof colB === 'string' && colB.includes('CRONOGRAMA'))) continue

        // Linha de Material — tem descrição em colB e tipo em colC
        if (colC === 'Material' && colB && typeof colB === 'string' && colB.trim()) {
          lastDesc = colB.trim()
        }

        // Linha de MO — colB é null, tipo em colC, descrição vem da linha anterior
        const tipo = colC === 'M.O' ? 'MO' : colC === 'Material' ? 'MA' : null
        if (!tipo || !lastDesc) continue

        // Resolve valor — pode ser número, fórmula string, ou null
        let valor = 0
        if (typeof colG === 'number') {
          valor = colG
        } else if (typeof colG === 'string' && colG.startsWith('=')) {
          try {
            const expr = colG.slice(1).replace(/[^0-9+\-*/.()]/g, '')
            valor = expr ? Function(`"use strict"; return (${expr})`)() : 0
          } catch { valor = 0 }
        }

        if (valor > 0) {
          toInsert.push({
            obra_id:    obra.id,
            descricao:  lastDesc,
            categoria:  inferCategoria(lastDesc),
            tipo,
            unidade:    'vb',
            quantidade: 1,
            valor_unit: Number(valor.toFixed(2)),
            ordem:      ordem++,
          })
        }
      }
    } else {
      // Formato padrão com cabeçalho
      const data = XLSX.utils.sheet_to_json(ws, { raw: false, dateNF: 'yyyy-mm-dd' })
      toInsert = data
        .filter(r => r['Descrição'] || r['Descricao'] || r['descricao'] || r['Item'] || r['item'])
        .map((r, idx) => ({
          obra_id:    obra.id,
          descricao:  r['Descrição'] || r['Descricao'] || r['descricao'] || r['Item'] || r['item'] || '',
          categoria:  r['Categoria'] || r['categoria'] || 'Geral',
          tipo:       r['Tipo'] || r['tipo'] || 'MA',
          unidade:    r['Unidade'] || r['unidade'] || 'un',
          quantidade: Number(r['Quantidade'] || r['quantidade'] || 1),
          valor_unit: Number(String(r['Valor Unit'] || r['Valor Unitário'] || r['valor_unit'] || 0).replace(/[^0-9.,]/g, '').replace(',', '.')),
          ordem:      idx,
        }))
    }

    if (toInsert.length) {
      await supabase.from('orcamento_itens').insert(toInsert)
      await fetchItens()
      showToast(`${toInsert.length} itens importados!`)
    } else {
      showToast('Nenhum item encontrado. Verifique o formato.')
    }
    e.target.value = ''
  }

  // Infere categoria pelo nome da descrição
  function inferCategoria(desc) {
    const d = desc.toLowerCase()
    if (d.includes('gesso'))          return 'Gesso'
    if (d.includes('pintura'))        return 'Pintura'
    if (d.includes('porcelanato'))    return 'Porcelanato'
    if (d.includes('vinílico') || d.includes('vinilico')) return 'Vinílico'
    if (d.includes('elétric') || d.includes('eletric') || d.includes('telecom')) return 'Elétrica'
    if (d.includes('encanador') || d.includes('hidráulic') || d.includes('hidraulic')) return 'Hidráulica'
    if (d.includes('esquadria'))      return 'Esquadrias'
    if (d.includes('impermeabil'))    return 'Acabamento'
    if (d.includes('piso') || d.includes('pórtico') || d.includes('portico')) return 'Acabamento'
    if (d.includes('ppci'))           return 'Instalações'
    if (d.includes('andaime') || d.includes('tamborville')) return 'Equipamentos'
    return 'Geral'
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
          <div style={{display:'grid',gridTemplateColumns:'2fr 80px 1fr 60px 80px 100px 120px 80px 28px',gap:8,padding:'0 4px',marginBottom:6}}>
            {['Descrição','Tipo','Categoria','Un.','Qtde','Valor Unit.','Contrato','Total',''].map((h,i)=>(
              <div key={i} style={{fontSize:10,fontWeight:700,color:'#334155',textTransform:'uppercase'}}>{h}</div>
            ))}
          </div>
          {loading ? <div style={{color:'#334155',fontSize:13,padding:'20px 0'}}>Carregando...</div>
          : rows.length === 0 ? <div style={{textAlign:'center',padding:'40px 0',color:'#334155',fontSize:13}}>Nenhum item. Adicione ou importe.</div>
          : rows.map((r,idx)=>(
            <div key={r.id||r._tmp} style={{display:'grid',gridTemplateColumns:'2fr 80px 1fr 60px 80px 100px 120px 80px 28px',gap:8,marginBottom:6}}>
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
              <select style={{...inp,padding:'7px 6px',fontSize:11}} value={r.contrato_id||''} onChange={e=>setRow(idx,'contrato_id',e.target.value||null)}>
                <option value="">—</option>
                {contratos.map(c=><option key={c.id} value={c.id}>{c.numero||c.descricao.slice(0,20)}</option>)}
              </select>
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
  const [medicoes,   setMedicoes]   = useState([])
  const [orcItens,   setOrcItens]   = useState([])
  const [contratos,  setContratos]  = useState([])
  const [selected,   setSelected]   = useState(null)
  const [medItens,   setMedItens]   = useState([])
  const [loading,    setLoading]    = useState(true)
  const [toast,      setToast]      = useState(null)
  const [novaMed,    setNovaMed]    = useState(false)
  const [novoMes,    setNovoMes]    = useState('')
  const [novoDia,    setNovoDia]    = useState('25')
  const [novoNome,   setNovoNome]   = useState('')
  const [novoContrato, setNovoContrato] = useState('')

  useEffect(() => { init() }, [obra.id])

  async function init() {
    const [{ data: meds }, { data: orc }, { data: cts }] = await Promise.all([
      supabase.from('medicoes').select('*, contratos(numero, descricao)').eq('obra_id', obra.id).order('numero',{ascending:false}),
      supabase.from('orcamento_itens').select('*').eq('obra_id', obra.id).order('ordem'),
      supabase.from('contratos').select('id, numero, descricao, fornecedor_id, valor_total').eq('obra_id', obra.id).order('created_at'),
    ])
    setMedicoes(meds??[]); setOrcItens(orc??[]); setContratos(cts??[]); setLoading(false)
  }

  function showToast(msg) { setToast(msg); setTimeout(()=>setToast(null),3000) }

  // Auto-gera número do contrato ao selecionar
  function handleSelectContrato(contratoId) {
    setNovoContrato(contratoId)
    if (contratoId) {
      const ct = contratos.find(c => c.id === contratoId)
      if (ct && !novoNome) setNovoNome(ct.numero ? `${ct.numero} — ${ct.descricao}` : ct.descricao)
    }
  }

  async function criarMedicao() {
    if (!novoMes) return
    const num = (medicoes[0]?.numero??0)+1
    const dia = String(novoDia).padStart(2,'0')
    const mesRef = `${novoMes}-${dia}`
    const nome = novoNome.trim() || null

    const { data } = await supabase.from('medicoes').insert({
      obra_id:     obra.id,
      numero:      num,
      mes_ref:     mesRef,
      status:      'rascunho',
      nome:        nome,
      contrato_id: novoContrato || null,
    }).select().single()

    if (data) {
      // Filtra itens do orçamento pelo contrato selecionado (se houver)
      let itensParaMedir = orcItens
      if (novoContrato) {
        const itensDoContrato = orcItens.filter(o => o.contrato_id === novoContrato)
        // Se contrato tem itens vinculados, usa só eles; senão usa todos
        if (itensDoContrato.length > 0) itensParaMedir = itensDoContrato
      }

      if (itensParaMedir.length) {
        await supabase.from('medicao_itens').insert(
          itensParaMedir.map(o => ({
            medicao_id:         data.id,
            orcamento_item_id:  o.id,
            descricao:          o.descricao,
            categoria:          o.categoria,
            tipo:               o.tipo || 'MA',
            qtd_prevista:       o.quantidade,
            qtd_medida:         0,
            valor_unit:         o.valor_unit,
          }))
        )
      }
    }

    setNovaMed(false); setNovoMes(''); setNovoNome(''); setNovoContrato('')
    await init()
    showToast(`Medição ${num} criada!`)
  }

  async function abrirMedicao(med) {
    const { data } = await supabase.from('medicao_itens').select('*').eq('medicao_id',med.id).order('created_at')
    setSelected(med); setMedItens(data??[])
  }

  function setMedItem(idx,k,v) { setMedItens(its=>its.map((it,i)=>i===idx?{...it,[k]:v}:it)) }

  async function saveMedicao() {
    for (const it of medItens) await supabase.from('medicao_itens').update({qtd_medida:Number(it.qtd_medida)}).eq('id',it.id)
    showToast('✅ Medição salva!')
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

  async function excluirMedicao(id, status) {
    if (status === 'aprovada') {
      // Somente admin pode excluir medição aprovada — por ora bloqueia
      showToast('⛔ Medições aprovadas só podem ser excluídas pelo administrador.')
      return
    }
    if (!confirm('Excluir esta medição? Esta ação não pode ser desfeita.')) return
    await supabase.from('medicao_itens').delete().eq('medicao_id', id)
    await supabase.from('medicoes').delete().eq('id', id)
    setSelected(null)
    await init()
    showToast('Medição excluída.')
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
            <span style={{fontSize:16,fontWeight:700,color:'#F1F5F9'}}>
              {selected.nome || `Medição ${selected.numero}`}
            </span>
            <span style={{padding:'3px 10px',borderRadius:20,fontSize:11,fontWeight:700,background:STATUS_MED[selected.status]?.bg,color:STATUS_MED[selected.status]?.color}}>{STATUS_MED[selected.status]?.label}</span>
          </div>
          <div style={{fontSize:12,color:'#475569',marginTop:2,display:'flex',gap:10,flexWrap:'wrap'}}>
            <span>{fmtMes(selected.mes_ref?.slice(0,7))}</span>
            {selected.contrato_id && contratos.find(c=>c.id===selected.contrato_id) && (
              <span style={{color:'#3B82F6'}}>📃 {(() => { const c = contratos.find(x=>x.id===selected.contrato_id); return c?.numero ? `${c.numero} — ${c.descricao}` : c?.descricao })()}</span>
            )}
          </div>
        </div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          {selected.status==='rascunho' && <button onClick={enviarMedicao} style={{padding:'7px 16px',borderRadius:7,border:'none',background:'#1E3A5F',color:'#93C5FD',fontWeight:600,fontSize:12,cursor:'pointer'}}>Enviar</button>}
          {selected.status==='enviada'  && <button onClick={()=>aprovarMedicao(selected.id)} style={{padding:'7px 16px',borderRadius:7,border:'none',background:'#064E3B',color:'#6EE7B7',fontWeight:600,fontSize:12,cursor:'pointer'}}>✓ Aprovar</button>}
          {selected.status==='enviada'  && <button onClick={()=>rejeitarMedicao(selected.id)} style={{padding:'7px 16px',borderRadius:7,border:'1px solid #991B1B',background:'transparent',color:'#FCA5A5',fontWeight:600,fontSize:12,cursor:'pointer'}}>✕ Rejeitar</button>}
          {selected.status==='rascunho' && <button onClick={saveMedicao} style={{padding:'7px 16px',borderRadius:7,border:'none',background:'linear-gradient(135deg,#3B82F6,#6366F1)',color:'#fff',fontWeight:700,fontSize:12,cursor:'pointer'}}>Salvar</button>}
          <button onClick={()=>exportarRelatorio(selected)} style={{padding:'7px 14px',borderRadius:7,border:'1px solid #1E2235',background:'transparent',color:'#94A3B8',fontWeight:600,fontSize:12,cursor:'pointer'}}>↓ Exportar</button>
          {(selected.status==='rascunho'||selected.status==='rejeitada') && (
            <button onClick={()=>excluirMedicao(selected.id, selected.status)} style={{padding:'7px 14px',borderRadius:7,border:'1px solid #991B1B',background:'transparent',color:'#FCA5A5',fontWeight:600,fontSize:12,cursor:'pointer'}}>🗑 Excluir</button>
          )}
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
          <div style={{fontSize:13,fontWeight:600,color:'#F1F5F9',marginBottom:12}}>Nova Medição</div>
          <div style={{display:'flex',gap:12,flexWrap:'wrap',marginBottom:12}}>
            <div style={{flex:2,minWidth:160}}>
              <label style={lbl}>Contrato (opcional)</label>
              <select style={inp} value={novoContrato} onChange={e=>handleSelectContrato(e.target.value)}>
                <option value="">Todos os itens do orçamento</option>
                {contratos.map(c=>(
                  <option key={c.id} value={c.id}>
                    {c.numero ? `${c.numero} — ` : ''}{c.descricao} ({fmtBRL(c.valor_total)})
                  </option>
                ))}
              </select>
            </div>
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
            <div style={{minWidth:100}}>
              <label style={lbl}>Dia</label>
              <select style={inp} value={novoDia} onChange={e=>setNovoDia(e.target.value)}>
                {[1,5,10,15,20,25,28,30].map(d=>(
                  <option key={d} value={d}>Dia {d}{d===25?' ✓':''}</option>
                ))}
              </select>
            </div>
          </div>
          <div style={{marginBottom:12}}>
            <label style={lbl}>Nome da medição (opcional)</label>
            <input style={inp} value={novoNome} onChange={e=>setNovoNome(e.target.value)} placeholder="Ex: CT/323 — Piscina — ou deixe em branco para gerar automático" />
          </div>
          {novoContrato && (
            <div style={{background:'#0F1117',borderRadius:8,padding:'8px 12px',marginBottom:12,fontSize:12,color:'#64748B'}}>
              📋 Serão incluídos apenas os itens do orçamento vinculados a este contrato.
              {orcItens.filter(o=>o.contrato_id===novoContrato).length === 0 && (
                <span style={{color:'#F59E0B'}}> ⚠️ Nenhum item vinculado ainda — serão incluídos todos os itens.</span>
              )}
            </div>
          )}
          <div style={{display:'flex',gap:8}}>
            <button onClick={criarMedicao} disabled={!novoMes} style={{padding:'8px 18px',borderRadius:7,border:'none',background:novoMes?'#3B82F6':'#334155',color:'#fff',fontWeight:700,fontSize:13,cursor:novoMes?'pointer':'default'}}>Criar</button>
            <button onClick={()=>{setNovaMed(false);setNovoMes('');setNovoNome('');setNovoContrato('')}} style={{padding:'8px 14px',borderRadius:7,border:'1px solid #1E2235',background:'transparent',color:'#64748B',fontWeight:600,fontSize:13,cursor:'pointer'}}>Cancelar</button>
          </div>
        </div>
      )}

      {loading ? <div style={{color:'#334155',fontSize:13,padding:'20px 0'}}>Carregando...</div>
      : medicoes.length===0 ? <div style={{textAlign:'center',padding:'40px 0',color:'#334155',fontSize:13}}>Nenhuma medição ainda. Clique em "+ Nova Medição".</div>
      : medicoes.map(m=>{
        const meta = STATUS_MED[m.status]
        const nomeDisplay = m.nome || `Medição ${m.numero}`
        const contratoLabel = m.contratos ? (m.contratos.numero ? `${m.contratos.numero} — ${m.contratos.descricao}` : m.contratos.descricao) : null
        return (
          <div key={m.id} onClick={()=>abrirMedicao(m)} style={{...card,marginBottom:8,cursor:'pointer',display:'flex',alignItems:'center',gap:16,transition:'border-color 0.15s'}}
            onMouseEnter={e=>e.currentTarget.style.borderColor='#334155'}
            onMouseLeave={e=>e.currentTarget.style.borderColor='#1E2235'}
          >
            <div style={{width:40,height:40,borderRadius:8,background:'#1E3A5F',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,fontWeight:700,color:'#93C5FD',flexShrink:0}}>{m.numero}</div>
            <div style={{flex:1}}>
              <div style={{fontSize:14,fontWeight:600,color:'#F1F5F9'}}>{nomeDisplay}</div>
              <div style={{fontSize:12,color:'#475569',marginTop:2,display:'flex',gap:10,flexWrap:'wrap'}}>
                <span>{fmtMes(m.mes_ref?.slice(0,7))}</span>
                {contratoLabel && <span style={{color:'#3B82F6'}}>📃 {contratoLabel}</span>}
              </div>
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

// ── CONTRATOS ─────────────────────────────────────────────────────────────
const STATUS_CONTRATO = {
  ativo:     { label: 'Ativo',     color: '#10B981', bg: '#064E3B' },
  concluido: { label: 'Concluído', color: '#6366F1', bg: '#1E1B4B' },
  suspenso:  { label: 'Suspenso',  color: '#F59E0B', bg: '#451A03' },
  cancelado: { label: 'Cancelado', color: '#EF4444', bg: '#450A0A' },
}
const TIPOS_REAJUSTE = ['Nenhum','INCC','IPCA','IGP-M','IPC-A','Outro']
const TIPOS_RETENCAO = ['Nenhuma','5%','10%','15%','Outro']

function ContratoModal({ contrato, obraId, fornecedores: fornecedoresInit, onSave, onClose, onFornecedorCriado }) {
  const isNew = !contrato?.id
  const [fornecedores, setFornecedores] = useState(fornecedoresInit ?? [])

  // Sync fornecedores when prop changes
  useEffect(() => { setFornecedores(fornecedoresInit ?? []) }, [fornecedoresInit?.length])
  const [form, setForm] = useState({
    numero:         contrato?.numero         ?? '',
    descricao:      contrato?.descricao      ?? '',
    fornecedor_id:  contrato?.fornecedor_id  ?? '',
    valor_total:    contrato?.valor_total    ?? '',
    data_inicio:    contrato?.data_inicio    ?? '',
    data_fim:       contrato?.data_fim       ?? '',
    parcelas:       contrato?.parcelas       ?? '1',
    retencao:       contrato?.retencao       ?? 'Nenhuma',
    reajuste:       contrato?.reajuste       ?? 'Nenhum',
    indice_reajuste:contrato?.indice_reajuste?? '',
    status:         contrato?.status         ?? 'ativo',
    objeto:         contrato?.objeto         ?? '',
    observacoes:    contrato?.observacoes    ?? '',
    arquivo_url:    contrato?.arquivo_url    ?? '',
    arquivo_nome:   contrato?.arquivo_nome   ?? '',
    numero_documento: contrato?.numero_documento ?? '',
    tipo_documento:   contrato?.tipo_documento   ?? 'contrato',
  })
  const setF = (k,v) => setForm(f=>({...f,[k]:v}))
  const [reading,  setReading]  = useState(false)
  const [readMsg,  setReadMsg]  = useState('')
  const [uploading,setUploading]= useState(false)
  const pdfRef = useRef()

  async function handlePDF(file) {
    if (!file) return
    if (file.type !== 'application/pdf') { setReadMsg('⚠️ Apenas PDF é suportado.'); return }
    if (file.size > 20 * 1024 * 1024) { setReadMsg('⚠️ PDF muito grande. Máximo 20 MB.'); return }

    // 1. Upload para o Supabase Storage
    setUploading(true)
    setReadMsg('📤 Enviando PDF...')
    const path = `contratos/${obraId}/${Date.now()}_${file.name.replace(/\s+/g,'_')}`
    const { error: upErr } = await supabase.storage.from('documentos').upload(path, file, { upsert: true })
    if (upErr) { setReadMsg('❌ Erro ao salvar PDF.'); setUploading(false); return }
    const { data: urlData } = supabase.storage.from('documentos').getPublicUrl(path)
    const publicUrl = urlData.publicUrl  // ← salva em variável local
    setF('arquivo_url',  publicUrl)
    setF('arquivo_nome', file.name)
    setUploading(false)

    // 2. Leitura via Edge Function (usa variável local, não form.arquivo_url)
    setReading(true)
    setReadMsg('🤖 Analisando contrato com IA...')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ler-contrato`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ pdfUrl: publicUrl })  // ← usa variável local
        }
      )
      const parsed = await res.json()
      if (parsed.error) throw new Error(parsed.error)

      // Busca ou cria fornecedor automaticamente
      let fornId = form.fornecedor_id || ''
      if (parsed.fornecedor_cnpj || parsed.fornecedor_nome) {
        const { data: fors } = await supabase.from('fornecedores').select('id,nome,cnpj')
        const cnpjLimpo = (parsed.fornecedor_cnpj ?? '').replace(/\D/g,'')

        // Busca por CNPJ primeiro, depois por nome
        const match = (fors??[]).find(f =>
          (cnpjLimpo && f.cnpj?.replace(/\D/g,'') === cnpjLimpo) ||
          (parsed.fornecedor_nome && f.nome?.toLowerCase().includes(parsed.fornecedor_nome.toLowerCase()))
        )

        if (match) {
          fornId = match.id
          setReadMsg('✅ Contrato lido! Fornecedor encontrado: ' + match.nome)
        } else if (parsed.fornecedor_nome) {
          // Cria fornecedor automaticamente
          const { data: { user } } = await supabase.auth.getUser()
          const { data: novoForn } = await supabase.from('fornecedores').insert({
            owner_id: user.id,
            nome:      parsed.fornecedor_nome,
            cnpj:      cnpjLimpo ? cnpjLimpo.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,'$1.$2.$3/$4-$5') : null,
            telefone:  parsed.fornecedor_telefone || null,
            email:     parsed.fornecedor_email    || null,
            categoria: parsed.fornecedor_categoria || 'Serviços Gerais',
            ativo:     true,
          }).select().single()
          if (novoForn) {
            fornId = novoForn.id
            const { data: forsAtual } = await supabase.from('fornecedores').select('id,nome,categoria').order('nome')
            setFornecedores(forsAtual ?? [])
            if (onFornecedorCriado) onFornecedorCriado()
            setReadMsg('✅ Contrato lido! Fornecedor "' + parsed.fornecedor_nome + '" criado e vinculado automaticamente.')
          }
        }
      }

      setForm(f => ({
        ...f,
        descricao:    parsed.descricao    || f.descricao,
        objeto:       parsed.objeto       || f.objeto,
        valor_total:  parsed.valor_total  || f.valor_total,
        parcelas:     parsed.parcelas     || f.parcelas,
        data_inicio:  parsed.data_inicio  || f.data_inicio,
        data_fim:     parsed.data_fim     || f.data_fim,
        retencao:     TIPOS_RETENCAO.includes(parsed.retencao) ? parsed.retencao : (parsed.retencao?.includes('%') ? 'Outro' : 'Nenhuma'),
        reajuste:     TIPOS_REAJUSTE.includes(parsed.reajuste) ? parsed.reajuste : (parsed.reajuste && parsed.reajuste!=='Nenhum' ? 'Outro' : 'Nenhum'),
        observacoes:  parsed.observacoes  || f.observacoes,
        fornecedor_id: fornId || f.fornecedor_id,
        numero_documento: parsed.numero_documento || f.numero_documento || '',
        tipo_documento:   parsed.tipo_documento   || f.tipo_documento   || 'contrato',
      }))
      setReadMsg(`✅ Contrato lido! ${!fornId && parsed.fornecedor_nome ? `Fornecedor "${parsed.fornecedor_nome}" não encontrado no cadastro.` : ''}`.trim())
    } catch(err) {
      setReadMsg('⚠️ IA não conseguiu extrair os dados. Preencha manualmente.')
    }
    setReading(false)
  }

  const valorParcela = form.parcelas && form.valor_total
    ? Number(form.valor_total) / Number(form.parcelas)
    : 0
  const valorRetencao = form.retencao && form.retencao !== 'Nenhuma'
    ? Number(form.valor_total||0) * (parseFloat(form.retencao)/100||0)
    : 0

  return (
    <div onClick={e=>e.target===e.currentTarget&&onClose()} style={{position:'fixed',inset:0,background:'#00000090',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1100,padding:16}}>
      <div style={{background:'#1A1D2E',border:'1px solid #1E2235',borderRadius:16,padding:'24px',width:520,maxWidth:'100%',maxHeight:'90vh',overflowY:'auto'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
          <div style={{fontSize:16,fontWeight:700,color:'#F1F5F9'}}>{isNew?'Novo Contrato':'Editar Contrato'}</div>
          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            <label style={{padding:'6px 12px',borderRadius:7,border:'1px solid #1E3A5F',background:'transparent',color:'#93C5FD',fontSize:12,fontWeight:600,cursor:reading||uploading?'default':'pointer',opacity:reading||uploading?0.6:1,display:'flex',alignItems:'center',gap:5}}>
              {reading||uploading ? '⏳ Processando...' : '📄 Importar PDF'}
              <input ref={pdfRef} type="file" accept=".pdf" style={{display:'none'}} disabled={reading||uploading} onChange={e=>handlePDF(e.target.files[0])} />
            </label>
            <button onClick={onClose} style={{background:'none',border:'none',color:'#475569',fontSize:22,cursor:'pointer'}}>×</button>
          </div>
        </div>

        {/* Status da leitura do PDF */}
        {readMsg && (
          <div style={{padding:'10px 14px',borderRadius:8,background:readMsg.startsWith('✅')?'#064E3B':readMsg.startsWith('⚠️')||readMsg.startsWith('❌')?'#450A0A':'#1E3A5F',border:`1px solid ${readMsg.startsWith('✅')?'#065F46':readMsg.startsWith('⚠️')||readMsg.startsWith('❌')?'#991B1B':'#1E40AF'}`,color:readMsg.startsWith('✅')?'#6EE7B7':readMsg.startsWith('⚠️')||readMsg.startsWith('❌')?'#FCA5A5':'#93C5FD',fontSize:12,fontWeight:600,marginBottom:16,display:'flex',alignItems:'center',justifyContent:'space-between',gap:8}}>
            <span>{readMsg}</span>
            <button onClick={()=>setReadMsg('')} style={{background:'none',border:'none',color:'inherit',fontSize:14,cursor:'pointer',opacity:0.7}}>×</button>
          </div>
        )}

        {/* PDF anexado */}
        {form.arquivo_url && (
          <div style={{padding:'10px 14px',borderRadius:8,background:'#0F1117',border:'1px solid #1E3A5F',marginBottom:16,display:'flex',alignItems:'center',gap:10}}>
            <span style={{fontSize:18}}>📎</span>
            <span style={{fontSize:12,color:'#93C5FD',flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{form.arquivo_nome||'Contrato PDF'}</span>
            <a href={form.arquivo_url} target="_blank" rel="noreferrer" style={{fontSize:11,color:'#3B82F6',fontWeight:600,textDecoration:'none',flexShrink:0}}>Abrir</a>
          </div>
        )}

        <label style={lbl}>Número do Contrato</label>
        <input style={{...inp,marginBottom:14,fontFamily:'monospace',fontWeight:600}} value={form.numero} onChange={e=>setF('numero',e.target.value)} placeholder="Ex: CT/001" />

        <label style={lbl}>Descrição / Objeto do Contrato *</label>
        <input style={{...inp,marginBottom:14}} value={form.descricao} onChange={e=>setF('descricao',e.target.value)} placeholder="Ex: Execução de estrutura de concreto" />

        <label style={lbl}>Objeto detalhado</label>
        <textarea style={{...inp,resize:'vertical',minHeight:56,marginBottom:14}} value={form.objeto} onChange={e=>setF('objeto',e.target.value)} placeholder="Descrição detalhada do escopo..." />

        <div style={{display:'flex',gap:12,marginBottom:14}}>
          <div style={{flex:2}}>
            <label style={lbl}>Fornecedor *</label>
            <select style={inp} value={form.fornecedor_id} onChange={e=>setF('fornecedor_id',e.target.value)}>
              <option value="">Selecione...</option>
              {fornecedores.map(f=><option key={f.id} value={f.id}>{f.nome}</option>)}
            </select>
          </div>
          <div style={{flex:1}}>
            <label style={lbl}>Status</label>
            <select style={inp} value={form.status} onChange={e=>setF('status',e.target.value)}>
              {Object.entries(STATUS_CONTRATO).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
        </div>

        <div style={{display:'flex',gap:12,marginBottom:14}}>
          <div style={{flex:1}}>
            <label style={lbl}>Valor Total (R$) *</label>
            <input style={inp} type="number" min="0" step="0.01" value={form.valor_total} onChange={e=>setF('valor_total',e.target.value)} placeholder="0,00" />
          </div>
          <div style={{flex:1}}>
            <label style={lbl}>Nº de Parcelas</label>
            <input style={inp} type="number" min="1" max="120" value={form.parcelas} onChange={e=>setF('parcelas',e.target.value)} />
          </div>
        </div>

        {valorParcela > 0 && (
          <div style={{background:'#0F1117',borderRadius:8,padding:'10px 14px',marginBottom:14,fontSize:12,color:'#64748B'}}>
            💰 Valor por parcela: <strong style={{color:'#10B981'}}>{fmtBRL(valorParcela)}</strong>
          </div>
        )}

        <div style={{display:'flex',gap:12,marginBottom:14}}>
          <div style={{flex:1}}>
            <label style={lbl}>Data de início</label>
            <input style={inp} type="date" value={form.data_inicio} onChange={e=>setF('data_inicio',e.target.value)} />
          </div>
          <div style={{flex:1}}>
            <label style={lbl}>Data de término</label>
            <input style={inp} type="date" value={form.data_fim} onChange={e=>setF('data_fim',e.target.value)} />
          </div>
        </div>

        <div style={{display:'flex',gap:12,marginBottom:14}}>
          <div style={{flex:1}}>
            <label style={lbl}>Retenção</label>
            <select style={inp} value={form.retencao} onChange={e=>setF('retencao',e.target.value)}>
              {TIPOS_RETENCAO.map(r=><option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div style={{flex:1}}>
            <label style={lbl}>Índice de Reajuste</label>
            <select style={inp} value={form.reajuste} onChange={e=>setF('reajuste',e.target.value)}>
              {TIPOS_REAJUSTE.map(r=><option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        </div>

        {(valorRetencao > 0) && (
          <div style={{background:'#0F1117',borderRadius:8,padding:'10px 14px',marginBottom:14,fontSize:12,color:'#64748B'}}>
            ✂️ Retenção: <strong style={{color:'#F59E0B'}}>{fmtBRL(valorRetencao)}</strong> ({form.retencao})
            {' · '}Líquido: <strong style={{color:'#10B981'}}>{fmtBRL(Number(form.valor_total||0)-valorRetencao)}</strong>
          </div>
        )}

        <label style={lbl}>Observações</label>
        <textarea style={{...inp,resize:'vertical',minHeight:56,marginBottom:20}} value={form.observacoes} onChange={e=>setF('observacoes',e.target.value)} placeholder="Notas adicionais..." />

        <div style={{display:'flex',justifyContent:'space-between',gap:8}}>
          <div>
            {!isNew && (
              <button onClick={()=>onSave({...form,_delete:true})} style={{padding:'8px 16px',borderRadius:7,border:'1px solid #991B1B',background:'transparent',color:'#FCA5A5',fontWeight:600,fontSize:13,cursor:'pointer'}}>Excluir</button>
            )}
          </div>
          <div style={{display:'flex',gap:8}}>
            <button onClick={onClose} style={{padding:'8px 16px',borderRadius:7,border:'1px solid #1E2235',background:'transparent',color:'#64748B',fontWeight:600,fontSize:13,cursor:'pointer'}}>Cancelar</button>
            <button onClick={()=>onSave(form)} disabled={!form.descricao||!form.valor_total} style={{padding:'8px 18px',borderRadius:7,border:'none',background:form.descricao&&form.valor_total?'linear-gradient(135deg,#3B82F6,#6366F1)':'#334155',color:'#fff',fontWeight:700,fontSize:13,cursor:form.descricao&&form.valor_total?'pointer':'default'}}>
              {isNew?'Criar Contrato':'Salvar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Contratos({ obra }) {
  const [contratos,    setContratos]    = useState([])
  const [fornecedores, setFornecedores] = useState([])
  const [modal,        setModal]        = useState(null)
  const [loading,      setLoading]      = useState(true)
  const [toast,        setToast]        = useState(null)

  useEffect(() => { init() }, [obra.id])

  async function init() {
    const [{ data: cts }, { data: fors }] = await Promise.all([
      supabase.from('contratos').select('*').eq('obra_id', obra.id).order('created_at', {ascending:false}),
      supabase.from('fornecedores').select('id,nome,categoria').order('nome'),
    ])
    setContratos(cts??[])
    setFornecedores(fors??[])
    setLoading(false)
  }

  async function reloadFornecedores() {
    const { data: fors } = await supabase.from('fornecedores').select('id,nome,categoria').order('nome')
    setFornecedores(fors??[])
  }

  function showToast(msg) { setToast(msg); setTimeout(()=>setToast(null),3000) }

  function getFornecedor(id) { return fornecedores.find(f=>f.id===id) }

  async function gerarBoletos(c, e) {
    e.stopPropagation()
    if (!c.data_inicio) { showToast('⚠️ Defina a data de início do contrato antes.'); return }
    if (!c.parcelas || c.parcelas <= 1) { showToast('⚠️ Contrato com apenas 1 parcela — adicione manualmente na aba Boletos.'); return }

    // Verifica duplicidade — busca boletos já existentes com mesma descrição
    const { data: existing } = await supabase.from('boletos')
      .select('id, descricao').eq('obra_id', obra.id)
      .ilike('descricao', `${c.descricao}%`)

    if (existing?.length > 0) {
      const confirma = confirm(`Já existem ${existing.length} boleto(s) com nome similar a este contrato.\n\nDeseja gerar mesmo assim? Isso pode criar duplicatas.`)
      if (!confirma) return
    }

    const forn = getFornecedor(c.fornecedor_id)
    const valorParcela = Number(c.valor_total||0) / Number(c.parcelas||1)
    const boletos = Array.from({length: Number(c.parcelas)}, (_, i) => {
      const venc = new Date(c.data_inicio + 'T00:00:00')
      venc.setMonth(venc.getMonth() + i + 1)
      return {
        obra_id:     obra.id,
        descricao:   `${c.descricao} (${i+1}/${c.parcelas})`,
        fornecedor:  forn?.nome || null,
        valor:       valorParcela,
        emissao:     c.data_inicio,
        vencimento:  venc.toISOString().slice(0,10),
        status:      'pendente',
        observacoes: `Gerado do contrato: ${c.descricao}`,
      }
    })
    await supabase.from('boletos').insert(boletos)
    showToast(`✅ ${boletos.length} boleto${boletos.length>1?'s':''} gerado${boletos.length>1?'s':''}!`)
  }

  async function handleSave(form) {
    if (form._delete) {
      if (!confirm('Excluir este contrato?')) return
      await supabase.from('contratos').delete().eq('id', modal.id)
      setModal(null); await init(); showToast('Contrato excluído.')
      return
    }
    const payload = {
      obra_id:         obra.id,
      numero:          form.numero || null,
      descricao:       form.descricao,
      objeto:          form.objeto,
      fornecedor_id:   form.fornecedor_id || null,
      valor_total:     Number(form.valor_total||0),
      parcelas:        Number(form.parcelas||1),
      data_inicio:     form.data_inicio || null,
      data_fim:        form.data_fim    || null,
      retencao:        form.retencao,
      reajuste:        form.reajuste,
      status:          form.status,
      observacoes:     form.observacoes,
      arquivo_url:     form.arquivo_url  || null,
      arquivo_nome:    form.arquivo_nome || null,
      numero_documento: form.numero_documento || null,
      tipo_documento:   form.tipo_documento   || 'contrato',
    }

    let contratoId = modal?.id
    if (modal?.id) {
      await supabase.from('contratos').update(payload).eq('id', modal.id)
    } else {
      const { data: novo } = await supabase.from('contratos').insert(payload).select().single()
      contratoId = novo?.id

      // Gera boletos automaticamente se tiver parcelas e data de início
      if (contratoId && Number(form.parcelas) > 1 && form.data_inicio) {
        const valorParcela = Number(form.valor_total||0) / Number(form.parcelas||1)
        const forn = fornecedores.find(f => f.id === form.fornecedor_id)
        const boletos = Array.from({length: Number(form.parcelas)}, (_, i) => {
          const venc = new Date(form.data_inicio + 'T00:00:00')
          venc.setMonth(venc.getMonth() + i + 1)
          return {
            obra_id:    obra.id,
            descricao:  `${form.descricao} (${i+1}/${form.parcelas})`,
            fornecedor: forn?.nome || null,
            valor:      valorParcela,
            emissao:    form.data_inicio,
            vencimento: venc.toISOString().slice(0,10),
            status:     'pendente',
            observacoes: `Contrato: ${form.descricao}`,
          }
        })
        await supabase.from('boletos').insert(boletos)
        showToast(`Contrato criado! ${form.parcelas} boleto${Number(form.parcelas)>1?'s':''} gerado${Number(form.parcelas)>1?'s':''} automaticamente.`)
      } else {
        showToast(modal?.id ? 'Contrato atualizado!' : 'Contrato criado!')
      }
    }

    if (modal?.id) showToast('Contrato atualizado!')
    setModal(null); await init()
  }

  const totalContratos = contratos.reduce((a,c)=>a+Number(c.valor_total||0),0)
  const ativos = contratos.filter(c=>c.status==='ativo').length

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20,flexWrap:'wrap',gap:10}}>
        <div>
          <div style={{fontSize:16,fontWeight:700,color:'#F1F5F9'}}>Contratos</div>
          <div style={{fontSize:12,color:'#475569',marginTop:2}}>Contratos vinculados a esta obra</div>
        </div>
        <button onClick={()=>setModal({})} style={{padding:'8px 16px',borderRadius:7,border:'none',background:'linear-gradient(135deg,#3B82F6,#6366F1)',color:'#fff',fontWeight:700,fontSize:12,cursor:'pointer'}}>+ Novo Contrato</button>
      </div>

      {/* Resumo */}
      <div style={{display:'flex',gap:10,marginBottom:20,flexWrap:'wrap'}}>
        {[
          {label:'Total contratado', value:fmtBRL(totalContratos), color:'#3B82F6', icon:'📃'},
          {label:'Contratos ativos', value:ativos,                 color:'#10B981', icon:'✅'},
          {label:'Total contratos',  value:contratos.length,       color:'#64748B', icon:'📋'},
        ].map(s=>(
          <div key={s.label} style={{flex:1,minWidth:130,...card}}>
            <div style={{fontSize:18,marginBottom:6}}>{s.icon}</div>
            <div style={{fontSize:11,color:'#475569',marginBottom:2}}>{s.label}</div>
            <div style={{fontSize:16,fontWeight:700,color:s.color}}>{s.value}</div>
          </div>
        ))}
      </div>

      {loading ? <div style={{color:'#334155',fontSize:13}}>Carregando...</div>
      : contratos.length===0 ? (
        <div style={{textAlign:'center',padding:'40px 0',color:'#334155',fontSize:13}}>
          <div style={{fontSize:36,marginBottom:12}}>📃</div>
          <div style={{fontSize:14,fontWeight:600,color:'#475569',marginBottom:4}}>Nenhum contrato cadastrado</div>
          <div style={{fontSize:12}}>Clique em "+ Novo Contrato" para começar.</div>
        </div>
      ) : contratos.map(c => {
        const meta = STATUS_CONTRATO[c.status] ?? STATUS_CONTRATO.ativo
        const forn = getFornecedor(c.fornecedor_id)
        const valorParcela = c.parcelas > 1 ? Number(c.valor_total||0)/Number(c.parcelas||1) : null
        const retencaoPct = c.retencao && c.retencao!=='Nenhuma' ? parseFloat(c.retencao) : 0
        const valorRetencao = retencaoPct > 0 ? Number(c.valor_total||0)*retencaoPct/100 : 0

        return (
          <div key={c.id} style={{...card,marginBottom:10,transition:'border-color 0.15s'}}
            onMouseEnter={e=>e.currentTarget.style.borderColor='#334155'}
            onMouseLeave={e=>e.currentTarget.style.borderColor='#1E2235'}
          >
            <div style={{display:'flex',alignItems:'flex-start',gap:12,flexWrap:'wrap'}}>
              <div style={{flex:1,minWidth:0,cursor:'pointer'}} onClick={()=>setModal(c)}>
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6,flexWrap:'wrap'}}>
                  <span style={{fontSize:14,fontWeight:700,color:'#F1F5F9'}}>{c.descricao}</span>
                  <span style={{padding:'2px 8px',borderRadius:12,fontSize:10,fontWeight:700,background:meta.bg,color:meta.color}}>{meta.label}</span>
                  {c.tipo_documento==='nota_fiscal' && <span style={{padding:'2px 8px',borderRadius:12,fontSize:10,background:'#1E3A5F',color:'#93C5FD'}}>NF</span>}
                </div>
                {forn && <div style={{fontSize:12,color:'#64748B',marginBottom:4}}>🏢 {forn.nome}{forn.categoria?` · ${forn.categoria}`:''}</div>}
                {c.objeto && <div style={{fontSize:11,color:'#475569',marginBottom:6,lineHeight:1.4}}>{c.objeto.slice(0,120)}{c.objeto.length>120?'...':''}</div>}
                <div style={{display:'flex',gap:16,flexWrap:'wrap',fontSize:11,color:'#475569'}}>
                  {c.data_inicio && <span>📅 Início: {new Date(c.data_inicio+'T00:00:00').toLocaleDateString('pt-BR')}</span>}
                  {c.data_fim    && <span>🏁 Término: {new Date(c.data_fim+'T00:00:00').toLocaleDateString('pt-BR')}</span>}
                  {c.reajuste && c.reajuste!=='Nenhum' && <span>📈 Reajuste: {c.reajuste}</span>}
                  {c.arquivo_url && <a href={c.arquivo_url} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()} style={{color:'#3B82F6',textDecoration:'none'}}>📎 PDF</a>}
                </div>
              </div>
              <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:8,flexShrink:0}}>
                <div style={{textAlign:'right'}}>
                  <div style={{fontSize:18,fontWeight:700,color:'#F1F5F9',marginBottom:2}}>{fmtBRL(c.valor_total)}</div>
                  {valorParcela && <div style={{fontSize:11,color:'#64748B'}}>{c.parcelas}x de {fmtBRL(valorParcela)}</div>}
                  {valorRetencao > 0 && <div style={{fontSize:11,color:'#F59E0B',marginTop:2}}>✂️ Ret. {fmtBRL(valorRetencao)}</div>}
                </div>
                {c.parcelas > 1 && (
                  <button
                    onClick={e => gerarBoletos(c, e)}
                    style={{padding:'5px 12px',borderRadius:6,border:'1px solid #1E3A5F',background:'transparent',color:'#93C5FD',fontSize:11,fontWeight:600,cursor:'pointer',whiteSpace:'nowrap'}}
                    title="Gerar boletos para este contrato"
                  >
                    📄 Gerar boletos
                  </button>
                )}
              </div>
            </div>
          </div>
        )
      })}

      {modal!==null && (
        <ContratoModal
          contrato={modal?.id ? modal : null}
          obraId={obra.id}
          fornecedores={fornecedores}
          onSave={handleSave}
          onClose={()=>setModal(null)}
          onFornecedorCriado={reloadFornecedores}
        />
      )}

      {toast && <div style={{position:'fixed',bottom:24,right:24,background:'#064E3B',border:'1px solid #065F46',color:'#6EE7B7',padding:'10px 18px',borderRadius:10,fontSize:13,fontWeight:600,zIndex:2000}}>{toast}</div>}
    </div>
  )
}


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
    {id:'painel',    label:'📊 Painel'},
    {id:'contratos', label:'📃 Contratos'},
    {id:'orcamento', label:'📋 Orçamento'},
    {id:'medicoes',  label:'📐 Medições'},
    {id:'boletos',   label:'📄 Boletos'},
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
        {aba==='contratos' && <Contratos obra={obra} />}
        {aba==='orcamento' && <Orcamento obra={obra} />}
        {aba==='medicoes'  && <Medicoes  obra={obra} />}
        {aba==='boletos'   && <Boletos   obra={obra} />}
      </div>
    </div>
  )
}
