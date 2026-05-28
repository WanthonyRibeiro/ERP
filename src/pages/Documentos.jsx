import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const DOCUMENTOS_CONFIG = [
  // Técnicos e legais
  { tipo: 'CNO',           label: 'CNO',           grupo: 'Técnicos e Legais', desc: 'Cadastro Nacional de Obras',                        temValidade: false, temResponsavel: false },
  { tipo: 'ART',           label: 'ART',           grupo: 'Técnicos e Legais', desc: 'Anotação de Responsabilidade Técnica (CREA)',        temValidade: true,  temResponsavel: true  },
  { tipo: 'RRT',           label: 'RRT',           grupo: 'Técnicos e Legais', desc: 'Registro de Responsabilidade Técnica (CAU)',         temValidade: true,  temResponsavel: true  },
  { tipo: 'Alvará',        label: 'Alvará',        grupo: 'Técnicos e Legais', desc: 'Alvará de Construção',                              temValidade: true,  temResponsavel: false },
  { tipo: 'ComunicacaoPrevia', label: 'Comunicação Prévia', grupo: 'Técnicos e Legais', desc: 'NR-18 via SCPO',                           temValidade: false, temResponsavel: false },
  // Programas obrigatórios
  { tipo: 'PGR',           label: 'PGR',           grupo: 'Programas NR-1',   desc: 'Programa de Gerenciamento de Riscos',               temValidade: true,  temResponsavel: true  },
  { tipo: 'PCMSO',         label: 'PCMSO',         grupo: 'Programas NR-1',   desc: 'Prog. de Controle Médico de Saúde Ocupacional',     temValidade: true,  temResponsavel: true  },
  { tipo: 'PCMAT',         label: 'PCMAT',         grupo: 'Programas NR-1',   desc: 'Prog. de Cond. e Meio Ambiente do Trabalho (>20)',   temValidade: true,  temResponsavel: true  },
  { tipo: 'PPRA',          label: 'PPRA',          grupo: 'Programas NR-1',   desc: 'Prog. de Prevenção de Riscos Ambientais (≤20)',      temValidade: true,  temResponsavel: true  },
  // Licenças
  { tipo: 'LicencaAmbiental', label: 'Licença Ambiental', grupo: 'Licenças', desc: 'Licença Ambiental da obra',                         temValidade: true,  temResponsavel: false },
  { tipo: 'LicencaResiduos',  label: 'Lic. Resíduos',    grupo: 'Licenças', desc: 'Licença de destinação final de resíduos',            temValidade: true,  temResponsavel: false },
]

const GRUPOS = [...new Set(DOCUMENTOS_CONFIG.map(d => d.grupo))]

const inp = {
  width: '100%', padding: '8px 12px', borderRadius: 7,
  background: '#0F1117', border: '1px solid #1E2235',
  color: '#F1F5F9', fontSize: 13, outline: 'none', fontFamily: 'inherit',
}
const lbl = { fontSize: 11, fontWeight: 600, color: '#64748B', marginBottom: 5, display: 'block' }

function getStatus(doc) {
  if (!doc?.data_validade) return null
  const today = new Date(); today.setHours(0,0,0,0)
  const val   = new Date(doc.data_validade + 'T00:00:00')
  const diff  = Math.round((val - today) / 86400000)
  if (diff < 0)  return { label: `Vencido há ${Math.abs(diff)}d`, color: '#EF4444', bg: '#450A0A' }
  if (diff <= 30) return { label: `Vence em ${diff}d`,            color: '#F59E0B', bg: '#451A03' }
  return              { label: 'Válido',                           color: '#10B981', bg: '#064E3B' }
}

function DocModal({ doc, config, onSave, onClose }) {
  const [form, setForm] = useState({
    numero:        doc?.numero        ?? '',
    responsavel:   doc?.responsavel   ?? '',
    data_emissao:  doc?.data_emissao  ?? '',
    data_validade: doc?.data_validade ?? '',
    observacoes:   doc?.observacoes   ?? '',
  })
  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const status = form.data_validade ? getStatus({ data_validade: form.data_validade }) : null

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{
      position: 'fixed', inset: 0, background: '#00000090',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: 16,
    }}>
      <div style={{ background: '#1A1D2E', border: '1px solid #1E2235', borderRadius: 16, padding: '24px', width: 440, maxWidth: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#F1F5F9' }}>{config.label}</div>
            <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>{config.desc}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#475569', fontSize: 22, cursor: 'pointer' }}>×</button>
        </div>

        <label style={lbl}>Número / Código</label>
        <input style={{ ...inp, marginBottom: 14 }} value={form.numero} onChange={e => setF('numero', e.target.value)} placeholder="Ex: 2024/001234" />

        {config.temResponsavel && (
          <>
            <label style={lbl}>Responsável Técnico</label>
            <input style={{ ...inp, marginBottom: 14 }} value={form.responsavel} onChange={e => setF('responsavel', e.target.value)} placeholder="Nome e nº de registro" />
          </>
        )}

        <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
          <div style={{ flex: 1 }}>
            <label style={lbl}>Data de emissão</label>
            <input style={inp} type="date" value={form.data_emissao} onChange={e => setF('data_emissao', e.target.value)} />
          </div>
          {config.temValidade && (
            <div style={{ flex: 1 }}>
              <label style={lbl}>Validade</label>
              <input style={{ ...inp, borderColor: status?.color === '#EF4444' ? '#EF4444' : '#1E2235' }} type="date" value={form.data_validade} onChange={e => setF('data_validade', e.target.value)} />
            </div>
          )}
        </div>

        {status && (
          <div style={{ padding: '8px 12px', borderRadius: 8, background: status.bg, color: status.color, fontSize: 12, fontWeight: 600, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
            {status.color === '#EF4444' ? '⚠️' : status.color === '#F59E0B' ? '⏰' : '✓'} {status.label}
            {status.color === '#EF4444' && <span style={{ fontWeight: 400, opacity: 0.8 }}> — documento aceito mesmo vencido</span>}
          </div>
        )}

        <label style={lbl}>Observações</label>
        <textarea style={{ ...inp, resize: 'vertical', minHeight: 60, marginBottom: 16 }} value={form.observacoes} onChange={e => setF('observacoes', e.target.value)} placeholder="Notas adicionais..." />

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={{ padding: '8px 18px', borderRadius: 7, border: '1px solid #1E2235', background: 'transparent', color: '#64748B', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
          <button onClick={() => onSave(form)} style={{ padding: '8px 18px', borderRadius: 7, border: 'none', background: 'linear-gradient(135deg, #3B82F6, #6366F1)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Salvar</button>
        </div>
      </div>
    </div>
  )
}

export default function Documentos({ obra }) {
  const [docs,    setDocs]    = useState([])
  const [modal,   setModal]   = useState(null) // { config }
  const [loading, setLoading] = useState(true)
  const [toast,   setToast]   = useState(null)

  useEffect(() => { fetchDocs() }, [obra.id])

  async function fetchDocs() {
    const { data } = await supabase.from('obra_documentos').select('*').eq('obra_id', obra.id)
    setDocs(data ?? [])
    setLoading(false)
  }

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(null), 3000) }

  function getDoc(tipo) { return docs.find(d => d.tipo === tipo) }

  async function handleSave(form) {
    const existing = getDoc(modal.config.tipo)
    const payload = { ...form, obra_id: obra.id, tipo: modal.config.tipo }
    if (existing) {
      await supabase.from('obra_documentos').update(payload).eq('id', existing.id)
    } else {
      await supabase.from('obra_documentos').insert(payload)
    }
    setModal(null)
    fetchDocs()
    showToast('Documento salvo!')
  }

  // Count alerts
  const vencidos  = docs.filter(d => { const s = getStatus(d); return s?.color === '#EF4444' }).length
  const proximos  = docs.filter(d => { const s = getStatus(d); return s?.color === '#F59E0B' }).length

  if (loading) return <div style={{ padding: 20, color: '#334155', fontSize: 13 }}>Carregando...</div>

  return (
    <div style={{ padding: '0 0 24px' }}>
      {/* Alertas */}
      {(vencidos > 0 || proximos > 0) && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
          {vencidos > 0 && (
            <div style={{ padding: '10px 16px', borderRadius: 10, background: '#450A0A', border: '1px solid #991B1B', color: '#FCA5A5', fontSize: 13, fontWeight: 600 }}>
              ⚠️ {vencidos} documento{vencidos > 1 ? 's' : ''} vencido{vencidos > 1 ? 's' : ''}
            </div>
          )}
          {proximos > 0 && (
            <div style={{ padding: '10px 16px', borderRadius: 10, background: '#451A03', border: '1px solid #92400E', color: '#FCD34D', fontSize: 13, fontWeight: 600 }}>
              ⏰ {proximos} vencendo em breve
            </div>
          )}
        </div>
      )}

      {/* Grupos */}
      {GRUPOS.map(grupo => (
        <div key={grupo} style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
            {grupo}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {DOCUMENTOS_CONFIG.filter(c => c.grupo === grupo).map(config => {
              const doc    = getDoc(config.tipo)
              const status = doc ? getStatus(doc) : null
              const filled = !!doc?.numero || !!doc?.data_emissao

              return (
                <div
                  key={config.tipo}
                  onClick={() => setModal({ config })}
                  style={{
                    background: '#1A1D2E', border: `1px solid ${filled ? '#1E3A5F' : '#1E2235'}`,
                    borderRadius: 10, padding: '12px 16px', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 12,
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = '#3B82F640'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = filled ? '#1E3A5F' : '#1E2235'}
                >
                  {/* Status icon */}
                  <div style={{
                    width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                    background: filled ? (status ? status.bg : '#064E3B') : '#0F1117',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14,
                  }}>
                    {!filled ? '📄' : status ? (status.color === '#EF4444' ? '⚠️' : status.color === '#F59E0B' ? '⏰' : '✅') : '✅'}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#F1F5F9' }}>{config.label}</span>
                      {!filled && <span style={{ fontSize: 10, color: '#334155', fontStyle: 'italic' }}>Não cadastrado</span>}
                      {doc?.numero && <span style={{ fontSize: 11, color: '#64748B' }}>• {doc.numero}</span>}
                    </div>
                    <div style={{ fontSize: 11, color: '#475569' }}>{config.desc}</div>
                    {doc?.responsavel && <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>👤 {doc.responsavel}</div>}
                  </div>

                  <div style={{ flexShrink: 0, textAlign: 'right' }}>
                    {status && (
                      <div style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: status.bg, color: status.color, marginBottom: 4 }}>
                        {status.label}
                      </div>
                    )}
                    {doc?.data_validade && !status && config.temValidade && (
                      <div style={{ fontSize: 11, color: '#475569' }}>
                        Válido até {new Date(doc.data_validade + 'T00:00:00').toLocaleDateString('pt-BR')}
                      </div>
                    )}
                    <div style={{ fontSize: 18, color: '#334155', marginTop: 2 }}>›</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {modal && (
        <DocModal
          doc={getDoc(modal.config.tipo)}
          config={modal.config}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}

      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, background: '#064E3B', border: '1px solid #065F46', color: '#6EE7B7', padding: '10px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600, zIndex: 2000 }}>
          {toast}
        </div>
      )}
    </div>
  )
}
