import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const CATEGORIAS = ['Estrutura','Alvenaria','Hidráulica','Elétrica','Revestimento','Pintura','Cobertura','Fundação','Acabamento','Instalações','Esquadrias','Gesso','Porcelanato','Materiais','Equipamentos','Piscinas','Serviços Gerais','Outro']

const STATUS_CONTRATO = {
  ativo:     { label: 'Ativo',     color: '#10B981', bg: '#064E3B' },
  concluido: { label: 'Concluído', color: '#6366F1', bg: '#1E1B4B' },
  suspenso:  { label: 'Suspenso',  color: '#F59E0B', bg: '#451A03' },
  cancelado: { label: 'Cancelado', color: '#EF4444', bg: '#450A0A' },
}

const inp = {
  width: '100%', padding: '8px 12px', borderRadius: 7,
  background: '#0F1117', border: '1px solid #1E2235',
  color: '#F1F5F9', fontSize: 13, outline: 'none', fontFamily: 'inherit',
}
const lbl = { fontSize: 11, fontWeight: 600, color: '#64748B', marginBottom: 5, display: 'block' }

function fmtBRL(v) { return Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}) }
function fmtDate(d) { if (!d) return '—'; return new Date(d+'T00:00:00').toLocaleDateString('pt-BR') }

function fmtCNPJ(v) {
  const d = v.replace(/\D/g,'').slice(0,14)
  return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,'$1.$2.$3/$4-$5')
          .replace(/^(\d{2})(\d{3})(\d{3})(\d{4})$/,'$1.$2.$3/$4')
          .replace(/^(\d{2})(\d{3})(\d{3})$/,'$1.$2.$3')
          .replace(/^(\d{2})(\d{3})$/,'$1.$2')
          .replace(/^(\d{2})$/,'$1')
}

function fmtPhone(v) {
  const d = v.replace(/\D/g,'').slice(0,11)
  if (d.length===11) return d.replace(/^(\d{2})(\d{5})(\d{4})$/,'($1) $2-$3')
  if (d.length===10) return d.replace(/^(\d{2})(\d{4})(\d{4})$/,'($1) $2-$3')
  return d
}

// ── Modal de fornecedor ───────────────────────────────────────────────────
function FornecedorModal({ fornecedor, onSave, onClose }) {
  const isNew = !fornecedor?.id
  const [form, setForm] = useState({
    nome:       fornecedor?.nome       ?? '',
    cnpj:       fornecedor?.cnpj       ?? '',
    telefone:   fornecedor?.telefone   ?? '',
    email:      fornecedor?.email      ?? '',
    contato:    fornecedor?.contato    ?? '',
    categoria:  fornecedor?.categoria  ?? 'Serviços Gerais',
    observacoes:fornecedor?.observacoes?? '',
    ativo:      fornecedor?.ativo      ?? true,
  })
  const setF = (k,v) => setForm(f=>({...f,[k]:v}))

  return (
    <div onClick={e=>e.target===e.currentTarget&&onClose()} style={{position:'fixed',inset:0,background:'#00000090',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1100,padding:16}}>
      <div style={{background:'#1A1D2E',border:'1px solid #1E2235',borderRadius:16,padding:'24px',width:460,maxWidth:'100%',maxHeight:'90vh',overflowY:'auto'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
          <div style={{fontSize:16,fontWeight:700,color:'#F1F5F9'}}>{isNew?'Novo Fornecedor':'Editar Fornecedor'}</div>
          <button onClick={onClose} style={{background:'none',border:'none',color:'#475569',fontSize:22,cursor:'pointer'}}>×</button>
        </div>

        <label style={lbl}>Nome / Razão Social *</label>
        <input style={{...inp,marginBottom:14}} value={form.nome} onChange={e=>setF('nome',e.target.value)} placeholder="Ex: Construtora ABC Ltda" />

        <div style={{display:'flex',gap:12,marginBottom:14}}>
          <div style={{flex:1}}>
            <label style={lbl}>CNPJ</label>
            <input style={inp} value={form.cnpj} onChange={e=>setF('cnpj',fmtCNPJ(e.target.value))} placeholder="00.000.000/0000-00" />
          </div>
          <div style={{flex:1}}>
            <label style={lbl}>Categoria</label>
            <select style={inp} value={form.categoria} onChange={e=>setF('categoria',e.target.value)}>
              {CATEGORIAS.map(c=><option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <div style={{display:'flex',gap:12,marginBottom:14}}>
          <div style={{flex:1}}>
            <label style={lbl}>Telefone / WhatsApp</label>
            <input style={inp} value={form.telefone} onChange={e=>setF('telefone',fmtPhone(e.target.value))} placeholder="(00) 00000-0000" />
          </div>
          <div style={{flex:1}}>
            <label style={lbl}>E-mail</label>
            <input style={inp} type="email" value={form.email} onChange={e=>setF('email',e.target.value)} placeholder="contato@empresa.com" />
          </div>
        </div>

        <label style={lbl}>Nome do contato</label>
        <input style={{...inp,marginBottom:14}} value={form.contato} onChange={e=>setF('contato',e.target.value)} placeholder="Ex: João Silva" />

        <label style={lbl}>Observações</label>
        <textarea style={{...inp,resize:'vertical',minHeight:60,marginBottom:16}} value={form.observacoes} onChange={e=>setF('observacoes',e.target.value)} placeholder="Notas adicionais..." />

        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:20}}>
          <input type="checkbox" id="ativo" checked={form.ativo} onChange={e=>setF('ativo',e.target.checked)} style={{accentColor:'#3B82F6',width:16,height:16}} />
          <label htmlFor="ativo" style={{fontSize:13,color:'#94A3B8',cursor:'pointer'}}>Fornecedor ativo</label>
        </div>

        <div style={{display:'flex',justifyContent:'space-between',gap:8}}>
          <div>
            {!isNew && (
              <button onClick={()=>onSave({...form,_delete:true})} style={{padding:'8px 18px',borderRadius:7,border:'1px solid #991B1B',background:'transparent',color:'#FCA5A5',fontWeight:600,fontSize:13,cursor:'pointer'}}>Excluir</button>
            )}
          </div>
          <div style={{display:'flex',gap:8}}>
            <button onClick={onClose} style={{padding:'8px 18px',borderRadius:7,border:'1px solid #1E2235',background:'transparent',color:'#64748B',fontWeight:600,fontSize:13,cursor:'pointer'}}>Cancelar</button>
            <button onClick={()=>onSave(form)} disabled={!form.nome.trim()} style={{padding:'8px 18px',borderRadius:7,border:'none',background:form.nome.trim()?'linear-gradient(135deg,#3B82F6,#6366F1)':'#334155',color:'#fff',fontWeight:700,fontSize:13,cursor:form.nome.trim()?'pointer':'default'}}>
              {isNew?'Cadastrar':'Salvar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Detalhe do fornecedor ─────────────────────────────────────────────────
function FornecedorDetalhe({ fornecedor, onBack, onEdit }) {
  const [contratos, setContratos] = useState([])
  const [loading,   setLoading]   = useState(true)
  const [abaDetalhe, setAbaDetalhe] = useState('contratos')

  useEffect(() => { fetchContratos() }, [fornecedor.id])

  async function fetchContratos() {
    const { data } = await supabase
      .from('contratos')
      .select('*, obras(id, nome, status)')
      .eq('fornecedor_id', fornecedor.id)
      .order('created_at', { ascending: false })
    setContratos(data ?? [])
    setLoading(false)
  }

  // Agrupa contratos por obra
  const obraMap = {}
  contratos.forEach(c => {
    const obraId = c.obras?.id ?? 'sem_obra'
    const obraNome = c.obras?.nome ?? 'Sem obra vinculada'
    if (!obraMap[obraId]) obraMap[obraId] = { nome: obraNome, contratos: [] }
    obraMap[obraId].contratos.push(c)
  })

  const totalContratado = contratos.reduce((a,c) => a + Number(c.valor_total||0), 0)
  const totalAtivos     = contratos.filter(c => c.status === 'ativo').length

  return (
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',fontFamily:"'DM Sans', sans-serif"}}>
      {/* Header */}
      <div style={{background:'#1A1D2E',borderBottom:'1px solid #1E2235',padding:'14px 24px',display:'flex',alignItems:'center',gap:12,flexWrap:'wrap',flexShrink:0}}>
        <button onClick={onBack} style={{background:'none',border:'1px solid #1E2235',borderRadius:7,color:'#64748B',fontSize:13,cursor:'pointer',padding:'5px 10px'}}>← Voltar</button>
        <div style={{flex:1}}>
          <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
            <span style={{fontSize:16,fontWeight:700,color:'#F1F5F9'}}>🏢 {fornecedor.nome}</span>
            {fornecedor.categoria && <span style={{fontSize:11,color:'#64748B',background:'#1E2235',padding:'2px 8px',borderRadius:6}}>{fornecedor.categoria}</span>}
            {fornecedor.ativo===false && <span style={{fontSize:11,color:'#475569',background:'#1E2235',padding:'2px 8px',borderRadius:6}}>Inativo</span>}
          </div>
          <div style={{display:'flex',gap:14,marginTop:4,flexWrap:'wrap',fontSize:12,color:'#475569'}}>
            {fornecedor.cnpj     && <span>📋 {fornecedor.cnpj}</span>}
            {fornecedor.telefone && <span>📞 {fornecedor.telefone}</span>}
            {fornecedor.email    && <span>✉️ {fornecedor.email}</span>}
          </div>
        </div>
        <button onClick={onEdit} style={{padding:'7px 14px',borderRadius:7,border:'1px solid #1E2235',background:'transparent',color:'#64748B',fontSize:12,fontWeight:600,cursor:'pointer'}}>✏️ Editar</button>
      </div>

      {/* Stats */}
      <div style={{display:'flex',gap:10,padding:'12px 24px',borderBottom:'1px solid #1E2235',flexWrap:'wrap',flexShrink:0}}>
        {[
          {label:'Total contratado', value:fmtBRL(totalContratado), color:'#3B82F6'},
          {label:'Contratos',        value:contratos.length,         color:'#64748B'},
          {label:'Ativos',           value:totalAtivos,              color:'#10B981'},
          {label:'Obras atendidas',  value:Object.keys(obraMap).length, color:'#8B5CF6'},
        ].map(s=>(
          <div key={s.label} style={{background:'#1A1D2E',border:'1px solid #1E2235',borderRadius:8,padding:'8px 14px',display:'flex',alignItems:'center',gap:8}}>
            <span style={{fontSize:16,fontWeight:700,color:s.color}}>{s.value}</span>
            <span style={{fontSize:11,color:'#475569'}}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* Abas */}
      <div style={{display:'flex',gap:4,padding:'10px 24px',borderBottom:'1px solid #1E2235',flexShrink:0}}>
        {[
          {id:'contratos', label:'📃 Contratos'},
          {id:'obras',     label:'🏗️ Por Obra'},
        ].map(a=>(
          <button key={a.id} onClick={()=>setAbaDetalhe(a.id)} style={{padding:'6px 14px',borderRadius:7,border:'none',cursor:'pointer',fontSize:13,fontWeight:600,background:abaDetalhe===a.id?'#1E3A5F':'transparent',color:abaDetalhe===a.id?'#93C5FD':'#475569'}}>{a.label}</button>
        ))}
      </div>

      {/* Conteúdo */}
      <div style={{flex:1,overflowY:'auto',padding:'20px 24px'}}>
        {loading ? <div style={{color:'#334155',fontSize:13}}>Carregando...</div>
        : contratos.length === 0 ? (
          <div style={{textAlign:'center',padding:'40px 0',color:'#334155'}}>
            <div style={{fontSize:36,marginBottom:12}}>📃</div>
            <div style={{fontSize:14,fontWeight:600,color:'#475569'}}>Nenhum contrato vinculado</div>
          </div>
        ) : abaDetalhe === 'contratos' ? (
          // Lista de todos os contratos
          <div>
            {contratos.map((c, idx) => {
              const meta = STATUS_CONTRATO[c.status] ?? STATUS_CONTRATO.ativo
              return (
                <div key={c.id} style={{background:'#1A1D2E',border:'1px solid #1E2235',borderRadius:10,padding:'14px 16px',marginBottom:8}}>
                  <div style={{display:'flex',alignItems:'flex-start',gap:12,flexWrap:'wrap'}}>
                    <div style={{width:32,height:32,borderRadius:8,background:'#1E3A5F',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,color:'#93C5FD',flexShrink:0}}>
                      {contratos.length - idx}
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4,flexWrap:'wrap'}}>
                        <span style={{fontSize:13,fontWeight:600,color:'#F1F5F9'}}>{c.descricao}</span>
                        <span style={{padding:'2px 8px',borderRadius:12,fontSize:10,fontWeight:700,background:meta.bg,color:meta.color}}>{meta.label}</span>
                        {c.tipo_documento==='nota_fiscal' && <span style={{padding:'2px 8px',borderRadius:12,fontSize:10,fontWeight:700,background:'#1E3A5F',color:'#93C5FD'}}>NF</span>}
                      </div>
                      {c.obras?.nome && <div style={{fontSize:12,color:'#64748B',marginBottom:4}}>🏗️ {c.obras.nome}</div>}
                      {c.objeto && <div style={{fontSize:11,color:'#475569',marginBottom:4,lineHeight:1.4}}>{c.objeto.slice(0,120)}{c.objeto.length>120?'...':''}</div>}
                      <div style={{display:'flex',gap:12,flexWrap:'wrap',fontSize:11,color:'#475569'}}>
                        {c.data_inicio && <span>📅 {fmtDate(c.data_inicio)}</span>}
                        {c.data_fim    && <span>🏁 {fmtDate(c.data_fim)}</span>}
                        {c.numero_documento && <span>Nº {c.numero_documento}</span>}
                      </div>
                    </div>
                    <div style={{textAlign:'right',flexShrink:0}}>
                      <div style={{fontSize:15,fontWeight:700,color:'#F1F5F9'}}>{fmtBRL(c.valor_total)}</div>
                      {c.parcelas>1 && <div style={{fontSize:11,color:'#64748B'}}>{c.parcelas}x de {fmtBRL(Number(c.valor_total)/Number(c.parcelas))}</div>}
                      {c.arquivo_url && (
                        <a href={c.arquivo_url} target="_blank" rel="noreferrer" style={{fontSize:11,color:'#3B82F6',fontWeight:600,textDecoration:'none',display:'block',marginTop:4}}>📎 Ver PDF</a>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          // Agrupado por obra
          <div>
            {Object.entries(obraMap).map(([obraId, obra]) => {
              const totalObra = obra.contratos.reduce((a,c)=>a+Number(c.valor_total||0),0)
              return (
                <div key={obraId} style={{marginBottom:20}}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10,flexWrap:'wrap',gap:8}}>
                    <div style={{fontSize:14,fontWeight:700,color:'#F1F5F9'}}>🏗️ {obra.nome}</div>
                    <div style={{fontSize:13,fontWeight:600,color:'#10B981'}}>{fmtBRL(totalObra)}</div>
                  </div>
                  {obra.contratos.map((c,idx) => {
                    const meta = STATUS_CONTRATO[c.status] ?? STATUS_CONTRATO.ativo
                    return (
                      <div key={c.id} style={{background:'#1A1D2E',border:'1px solid #1E2235',borderRadius:8,padding:'12px 14px',marginBottom:6,display:'flex',alignItems:'center',gap:12}}>
                        <div style={{width:26,height:26,borderRadius:6,background:'#1E3A5F',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,color:'#93C5FD',flexShrink:0}}>{idx+1}</div>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
                            <span style={{fontSize:12,fontWeight:600,color:'#F1F5F9'}}>{c.descricao}</span>
                            <span style={{padding:'1px 6px',borderRadius:10,fontSize:10,fontWeight:700,background:meta.bg,color:meta.color}}>{meta.label}</span>
                            {c.tipo_documento==='nota_fiscal' && <span style={{padding:'1px 6px',borderRadius:10,fontSize:10,background:'#1E3A5F',color:'#93C5FD'}}>NF</span>}
                          </div>
                          <div style={{fontSize:11,color:'#475569',marginTop:2}}>
                            {c.data_inicio && fmtDate(c.data_inicio)}
                            {c.data_inicio && c.data_fim && ' → '}
                            {c.data_fim && fmtDate(c.data_fim)}
                          </div>
                        </div>
                        <div style={{textAlign:'right',flexShrink:0}}>
                          <div style={{fontSize:13,fontWeight:700,color:'#F1F5F9'}}>{fmtBRL(c.valor_total)}</div>
                          {c.arquivo_url && (
                            <a href={c.arquivo_url} target="_blank" rel="noreferrer" style={{fontSize:10,color:'#3B82F6',textDecoration:'none'}}>📎 PDF</a>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────
export default function Fornecedores({ session }) {
  const [fornecedores, setFornecedores] = useState([])
  const [loading,      setLoading]      = useState(true)
  const [modal,        setModal]        = useState(null)
  const [detalhe,      setDetalhe]      = useState(null)
  const [toast,        setToast]        = useState(null)
  const [busca,        setBusca]        = useState('')
  const [filtroCateg,  setFiltroCateg]  = useState('Todas')

  useEffect(() => { fetchFornecedores() }, [])

  async function fetchFornecedores() {
    const { data } = await supabase
      .from('fornecedores')
      .select('*')
      .order('nome')
    setFornecedores(data ?? [])
    setLoading(false)
  }

  function showToast(msg) { setToast(msg); setTimeout(()=>setToast(null),3000) }

  async function handleSave(form) {
    if (form._delete) {
      if (!confirm('Excluir este fornecedor?')) return
      await supabase.from('fornecedores').delete().eq('id', modal.id)
      setModal(null); setDetalhe(null)
      await fetchFornecedores()
      showToast('Fornecedor removido.')
      return
    }
    const payload = { ...form, owner_id: session.user.id }
    if (modal?.id) {
      await supabase.from('fornecedores').update(payload).eq('id', modal.id)
      if (detalhe?.id === modal.id) setDetalhe({ ...detalhe, ...form })
    } else {
      await supabase.from('fornecedores').insert(payload)
    }
    setModal(null)
    await fetchFornecedores()
    showToast(modal?.id ? 'Fornecedor atualizado!' : 'Fornecedor cadastrado!')
  }

  const categorias = ['Todas', ...new Set(fornecedores.map(f=>f.categoria).filter(Boolean))]
  const filtrados = fornecedores.filter(f => {
    const matchBusca = !busca || f.nome?.toLowerCase().includes(busca.toLowerCase()) || f.cnpj?.includes(busca) || f.contato?.toLowerCase().includes(busca.toLowerCase())
    const matchCateg = filtroCateg === 'Todas' || f.categoria === filtroCateg
    return matchBusca && matchCateg
  })

  const ativos   = fornecedores.filter(f=>f.ativo!==false).length
  const inativos = fornecedores.filter(f=>f.ativo===false).length

  // Se estiver no detalhe, mostra a tela de detalhe
  if (detalhe) {
    return (
      <>
        <FornecedorDetalhe
          fornecedor={detalhe}
          onBack={() => setDetalhe(null)}
          onEdit={() => setModal(detalhe)}
        />
        {modal !== null && (
          <FornecedorModal
            fornecedor={modal?.id ? modal : null}
            onSave={handleSave}
            onClose={() => setModal(null)}
          />
        )}
        {toast && <div style={{position:'fixed',bottom:24,right:24,background:'#064E3B',border:'1px solid #065F46',color:'#6EE7B7',padding:'10px 18px',borderRadius:10,fontSize:13,fontWeight:600,zIndex:2000}}>{toast}</div>}
      </>
    )
  }

  return (
    <div style={{flex:1,padding:'28px',overflowY:'auto',color:'#E2E8F0',fontFamily:"'DM Sans', sans-serif"}}>
      {/* Header */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:24,flexWrap:'wrap',gap:12}}>
        <div>
          <h1 style={{fontSize:22,fontWeight:700,color:'#F1F5F9',marginBottom:4}}>Fornecedores</h1>
          <p style={{fontSize:13,color:'#475569'}}>Gerencie seus fornecedores e prestadores de serviço.</p>
        </div>
        <button onClick={()=>setModal({})} style={{padding:'9px 18px',borderRadius:8,border:'none',background:'linear-gradient(135deg,#3B82F6,#6366F1)',color:'#fff',fontWeight:700,fontSize:13,cursor:'pointer'}}>+ Novo Fornecedor</button>
      </div>

      {/* Stats */}
      <div style={{display:'flex',gap:12,marginBottom:24,flexWrap:'wrap'}}>
        {[
          {label:'Total',    value:fornecedores.length, color:'#3B82F6'},
          {label:'Ativos',   value:ativos,              color:'#10B981'},
          {label:'Inativos', value:inativos,            color:'#475569'},
        ].map(s=>(
          <div key={s.label} style={{background:'#1A1D2E',border:'1px solid #1E2235',borderRadius:10,padding:'12px 18px',display:'flex',alignItems:'center',gap:10}}>
            <span style={{fontSize:22,fontWeight:700,color:s.color}}>{s.value}</span>
            <span style={{fontSize:12,color:'#475569'}}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div style={{display:'flex',gap:10,marginBottom:20,flexWrap:'wrap',alignItems:'center'}}>
        <input style={{...inp,width:220,marginBottom:0}} value={busca} onChange={e=>setBusca(e.target.value)} placeholder="🔍 Buscar por nome, CNPJ..." />
        <select style={{...inp,width:'auto',marginBottom:0}} value={filtroCateg} onChange={e=>setFiltroCateg(e.target.value)}>
          {categorias.map(c=><option key={c} value={c}>{c}</option>)}
        </select>
        <span style={{fontSize:12,color:'#475569'}}>{filtrados.length} resultado{filtrados.length!==1?'s':''}</span>
      </div>

      {/* Lista */}
      {loading ? (
        <div style={{color:'#334155',fontSize:14}}>Carregando...</div>
      ) : filtrados.length === 0 ? (
        <div style={{textAlign:'center',padding:'60px 0'}}>
          <div style={{fontSize:40,marginBottom:12}}>🏢</div>
          <p style={{fontSize:15,fontWeight:600,color:'#475569'}}>
            {fornecedores.length===0 ? 'Nenhum fornecedor cadastrado' : 'Nenhum resultado encontrado'}
          </p>
          <p style={{fontSize:13,color:'#334155',marginTop:4}}>
            {fornecedores.length===0 ? 'Clique em "+ Novo Fornecedor" para começar.' : 'Tente ajustar os filtros.'}
          </p>
        </div>
      ) : (
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          {filtrados.map(f => (
            <div
              key={f.id}
              onClick={() => setDetalhe(f)}
              style={{
                background:'#1A1D2E', border:'1px solid #1E2235',
                borderRadius:12, padding:'14px 18px', cursor:'pointer',
                display:'flex', alignItems:'center', gap:14,
                transition:'all 0.15s', opacity:f.ativo===false?0.6:1,
              }}
              onMouseEnter={e=>e.currentTarget.style.borderColor='#3B82F640'}
              onMouseLeave={e=>e.currentTarget.style.borderColor='#1E2235'}
            >
              <div style={{width:42,height:42,borderRadius:10,flexShrink:0,background:'linear-gradient(135deg,#1E3A5F,#1E1B4B)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18}}>🏢</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:3,flexWrap:'wrap'}}>
                  <span style={{fontSize:14,fontWeight:600,color:'#F1F5F9'}}>{f.nome}</span>
                  {f.ativo===false && <span style={{fontSize:10,color:'#475569',background:'#1E2235',padding:'1px 6px',borderRadius:4}}>Inativo</span>}
                  {f.categoria && <span style={{fontSize:10,color:'#64748B',background:'#1A1D2E',border:'1px solid #1E2235',padding:'1px 6px',borderRadius:4}}>{f.categoria}</span>}
                </div>
                <div style={{display:'flex',gap:14,flexWrap:'wrap',fontSize:12,color:'#475569'}}>
                  {f.cnpj     && <span>📋 {f.cnpj}</span>}
                  {f.telefone && <span>📞 {f.telefone}</span>}
                  {f.email    && <span>✉️ {f.email}</span>}
                  {f.contato  && <span>👤 {f.contato}</span>}
                </div>
              </div>
              <div style={{fontSize:18,color:'#334155',flexShrink:0}}>›</div>
            </div>
          ))}
        </div>
      )}

      {modal !== null && (
        <FornecedorModal
          fornecedor={modal?.id ? modal : null}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}

      {toast && (
        <div style={{position:'fixed',bottom:24,right:24,background:'#064E3B',border:'1px solid #065F46',color:'#6EE7B7',padding:'10px 18px',borderRadius:10,fontSize:13,fontWeight:600,zIndex:2000}}>
          {toast}
        </div>
      )}
    </div>
  )
}
