import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

// ── Dados técnicos de aços CA-50/CA-60 ───────────────────────────────────
const ACO_BITOLAS = {
  '5':    { peso_m: 0.154, nome: 'CA-50 ø 5mm'   },
  '6.3':  { peso_m: 0.245, nome: 'CA-50 ø 6.3mm' },
  '8':    { peso_m: 0.395, nome: 'CA-50 ø 8mm'   },
  '10':   { peso_m: 0.617, nome: 'CA-50 ø 10mm'  },
  '12.5': { peso_m: 0.963, nome: 'CA-50 ø 12.5mm'},
  '16':   { peso_m: 1.578, nome: 'CA-50 ø 16mm'  },
  '20':   { peso_m: 2.466, nome: 'CA-50 ø 20mm'  },
  '25':   { peso_m: 3.853, nome: 'CA-50 ø 25mm'  },
  '32':   { peso_m: 6.313, nome: 'CA-50 ø 32mm'  },
}

// ── Templates de insumos por palavra-chave ────────────────────────────────
const TEMPLATES = [
  // Aços
  { match: /^aço|^aco|steel/i, categoria: 'Estrutura', tipo: 'Aço CA-50',
    unidade_compra: 'kg', unidade_uso: 'kg', fator_conversao: 1,
    sugestoes: ['Diâmetro (mm): 8, 10, 12.5, 16, 20, 25'],
    campos_extras: ['diametro_mm', 'comprimento_m'],
    hint: 'Aço vendido em kg. Informe o diâmetro para calcular quantas barras de 12m.',
  },
  // Cimento
  { match: /cimento|cement/i, categoria: 'Estrutura', tipo: 'Cimento Portland',
    unidade_compra: 'sc', unidade_uso: 'kg', fator_conversao: 50,
    peso_unitario_kg: 50, comprimento_m: null,
    hint: '1 saco = 50kg. Conversão automática saco ↔ kg.',
  },
  // Concreto
  { match: /concreto|concrete/i, categoria: 'Estrutura', tipo: 'Concreto Usinado',
    unidade_compra: 'm³', unidade_uso: 'm³', fator_conversao: 1,
    hint: 'Vendido e utilizado em m³.',
  },
  // Tubo PVC
  { match: /tubo\s*pvc|pvc/i, categoria: 'Hidráulica', tipo: 'Tubo PVC',
    unidade_compra: 'barra', unidade_uso: 'm', fator_conversao: 6,
    comprimento_m: 6,
    hint: '1 barra = 6m. Conversão automática barra ↔ metro.',
    campos_extras: ['diametro_mm'],
  },
  // Tubo PPR
  { match: /tubo\s*ppr|ppr/i, categoria: 'Hidráulica', tipo: 'Tubo PPR',
    unidade_compra: 'barra', unidade_uso: 'm', fator_conversao: 3,
    comprimento_m: 3,
    hint: '1 barra = 3m.',
    campos_extras: ['diametro_mm'],
  },
  // Fio/Cabo elétrico
  { match: /fio|cabo\s*el[eé]t|cabo\s*\d+mm/i, categoria: 'Elétrica', tipo: 'Cabo Elétrico',
    unidade_compra: 'm', unidade_uso: 'm', fator_conversao: 1,
    hint: 'Vendido por metro.',
    campos_extras: ['diametro_mm'],
  },
  // Tijolo
  { match: /tijolo|bloco\s*cer/i, categoria: 'Alvenaria', tipo: 'Tijolo Cerâmico',
    unidade_compra: 'mil', unidade_uso: 'un', fator_conversao: 1000,
    hint: 'Vendido por milheiro. 1 mil = 1000 unidades.',
  },
  // Areia
  { match: /areia/i, categoria: 'Estrutura', tipo: 'Areia',
    unidade_compra: 'm³', unidade_uso: 'm³', fator_conversao: 1,
    hint: 'Vendida em m³.',
  },
  // Brita
  { match: /brita|pedra\s*britada/i, categoria: 'Estrutura', tipo: 'Brita',
    unidade_compra: 'm³', unidade_uso: 'm³', fator_conversao: 1,
    hint: 'Vendida em m³.',
  },
  // Tinta
  { match: /tinta|paint/i, categoria: 'Pintura', tipo: 'Tinta',
    unidade_compra: 'lt', unidade_uso: 'lt', fator_conversao: 1,
    hint: 'Vendida em litros.',
  },
  // Cerâmica/Porcelanato
  { match: /cer[aâ]mica|porcelanato|piso/i, categoria: 'Acabamento', tipo: 'Revestimento',
    unidade_compra: 'm²', unidade_uso: 'm²', fator_conversao: 1,
    hint: 'Vendido em m².',
  },
  // Madeira
  { match: /madeira|t[áa]bua|viga|caibro/i, categoria: 'Estrutura', tipo: 'Madeira',
    unidade_compra: 'pç', unidade_uso: 'm', fator_conversao: null,
    hint: 'Informe o comprimento da peça para conversão m ↔ peça.',
    campos_extras: ['comprimento_m', 'largura_m', 'altura_m'],
  },
]

function detectTemplate(nome) {
  if (!nome || nome.length < 3) return null
  return TEMPLATES.find(t => t.match.test(nome)) ?? null
}

// ── Gera próximo código numérico sequencial ───────────────────────────────
function gerarProximoCodigo(insumosExistentes) {
  if (!insumosExistentes.length) return '00001'
  const numeros = insumosExistentes
    .map(i => parseInt(i.codigo))
    .filter(n => !isNaN(n))
  const maximo = Math.max(...numeros, 0)
  return String(maximo + 1).padStart(5, '0')
}

// ── Calculadora de conversão ──────────────────────────────────────────────
function Calculadora({ insumo, onClose }) {
  const [qtdCompra, setQtdCompra] = useState('')
  const [qtdUso, setQtdUso] = useState('')
  const [barras, setBarras] = useState('')

  const isAco = /aço|aco/i.test(insumo.nome) && insumo.diametro_mm
  const pesoM = isAco ? ACO_BITOLAS[String(insumo.diametro_mm)]?.peso_m : null
  const compBarra = insumo.comprimento_m ?? 12

  function calcFromCompra(v) {
    setQtdCompra(v)
    const n = parseFloat(v) || 0
    if (isAco && pesoM) {
      const metros = n / pesoM
      setQtdUso(metros.toFixed(2))
      setBarras((metros / compBarra).toFixed(2))
    } else if (insumo.fator_conversao) {
      setQtdUso((n * insumo.fator_conversao).toFixed(3))
    }
  }

  function calcFromUso(v) {
    setQtdUso(v)
    const n = parseFloat(v) || 0
    if (isAco && pesoM) {
      const kg = n * pesoM
      setQtdCompra(kg.toFixed(2))
      setBarras((n / compBarra).toFixed(2))
    } else if (insumo.fator_conversao) {
      setQtdCompra((n / insumo.fator_conversao).toFixed(3))
    }
  }

  function calcFromBarras(v) {
    setBarras(v)
    const n = parseFloat(v) || 0
    if (isAco && pesoM) {
      const metros = n * compBarra
      const kg = metros * pesoM
      setQtdUso(metros.toFixed(2))
      setQtdCompra(kg.toFixed(2))
    }
  }

  const inp = {
    padding: '8px 12px', borderRadius: 7, border: '1px solid #1E2235',
    background: '#0F1117', color: '#F1F5F9', fontSize: 14, outline: 'none',
    width: '100%', fontFamily: 'inherit', textAlign: 'right',
  }

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{
      position: 'fixed', inset: 0, background: '#00000090',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 16,
    }}>
      <div style={{ background: '#1A1D2E', border: '1px solid #1E2235', borderRadius: 16, padding: 28, width: 400, maxWidth: '95vw' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#F1F5F9' }}>⚖️ Conversão de Unidades</div>
            <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>{insumo.nome}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#475569', fontSize: 22, cursor: 'pointer' }}>×</button>
        </div>

        {isAco && pesoM && (
          <div style={{ background: '#0F1117', border: '1px solid #1E3A5F', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#93C5FD' }}>
            ø{insumo.diametro_mm}mm · {pesoM} kg/m · barra de {compBarra}m ({(pesoM * compBarra).toFixed(2)} kg/barra)
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#64748B', marginBottom: 4, display: 'block' }}>
              {insumo.unidade_compra?.toUpperCase()} (unidade de compra)
            </label>
            <input style={inp} type="number" min="0" step="0.01" value={qtdCompra} onChange={e => calcFromCompra(e.target.value)} placeholder="0" />
          </div>

          {insumo.unidade_uso && insumo.unidade_uso !== insumo.unidade_compra && (
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#64748B', marginBottom: 4, display: 'block' }}>
                {insumo.unidade_uso?.toUpperCase()} (unidade de uso)
              </label>
              <input style={inp} type="number" min="0" step="0.01" value={qtdUso} onChange={e => calcFromUso(e.target.value)} placeholder="0" />
            </div>
          )}

          {isAco && (
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#64748B', marginBottom: 4, display: 'block' }}>
                BARRAS de {compBarra}m
              </label>
              <input style={inp} type="number" min="0" step="0.01" value={barras} onChange={e => calcFromBarras(e.target.value)} placeholder="0" />
            </div>
          )}
        </div>

        {(parseFloat(qtdCompra) > 0 || parseFloat(qtdUso) > 0) && (
          <div style={{ marginTop: 16, padding: '12px 14px', background: '#064E3B22', border: '1px solid #10B98144', borderRadius: 8, fontSize: 12, color: '#6EE7B7' }}>
            {isAco && pesoM ? (
              <>
                <div>{qtdCompra || '0'} kg = {qtdUso || '0'} metros = {barras || '0'} barras de {compBarra}m</div>
                <div style={{ marginTop: 4, color: '#475569' }}>
                  Sobra: {((parseFloat(barras) - Math.floor(parseFloat(barras))) * compBarra).toFixed(2)}m na última barra
                </div>
              </>
            ) : (
              <div>{qtdCompra || '0'} {insumo.unidade_compra} = {qtdUso || '0'} {insumo.unidade_uso}</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Modal de cadastro/edição ──────────────────────────────────────────────
function InsumoModal({ insumo, fornecedores, insumos, onSave, onClose }) {
  const isNew = !insumo?.id
  const proximoCodigo = gerarProximoCodigo(insumos)
  const [form, setForm] = useState({
    codigo:           insumo?.codigo           ?? proximoCodigo,
    codigo_sinapi:    insumo?.codigo_sinapi     ?? '',
    nome:             insumo?.nome             ?? '',
    descricao:        insumo?.descricao        ?? '',
    categoria:        insumo?.categoria        ?? 'Geral',
    tipo:             insumo?.tipo             ?? '',
    unidade_compra:   insumo?.unidade_compra   ?? 'un',
    unidade_uso:      insumo?.unidade_uso      ?? '',
    fator_conversao:  insumo?.fator_conversao  ?? '',
    peso_unitario_kg: insumo?.peso_unitario_kg ?? '',
    comprimento_m:    insumo?.comprimento_m    ?? '',
    diametro_mm:      insumo?.diametro_mm      ?? '',
    largura_m:        insumo?.largura_m        ?? '',
    altura_m:         insumo?.altura_m         ?? '',
    preco_referencia: insumo?.preco_referencia ?? '',
    fornecedor_id:    insumo?.fornecedor_id    ?? '',
    fornecedor_nome:  insumo?.fornecedor_nome  ?? '',
  })

  const [template, setTemplate] = useState(null)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  function handleNomeChange(nome) {
    set('nome', nome)
    const t = detectTemplate(nome)
    if (t && isNew) {
      setTemplate(t)
      set('categoria',       t.categoria        ?? form.categoria)
      set('tipo',            t.tipo             ?? form.tipo)
      set('unidade_compra',  t.unidade_compra   ?? form.unidade_compra)
      set('unidade_uso',     t.unidade_uso      ?? form.unidade_uso)
      set('fator_conversao', t.fator_conversao  ?? form.fator_conversao)
      set('comprimento_m',   t.comprimento_m    ?? form.comprimento_m)
    } else {
      setTemplate(null)
    }
  }

  // Para aço: calcula peso automaticamente pela bitola
  useEffect(() => {
    if (form.diametro_mm && /aço|aco/i.test(form.nome)) {
      const bitola = ACO_BITOLAS[String(form.diametro_mm)]
      if (bitola) {
        const compBarra = parseFloat(form.comprimento_m) || 12
        set('peso_unitario_kg', (bitola.peso_m * compBarra).toFixed(3))
        set('fator_conversao', compBarra)
        if (!form.comprimento_m) set('comprimento_m', 12)
      }
    }
  }, [form.diametro_mm, form.nome])

  const CATEGORIAS = ['Geral','Estrutura','Alvenaria','Hidráulica','Elétrica','Acabamento','Pintura','Cobertura','Impermeabilização','Instalações','Esquadrias','Externo','Logística','Locações','Administrativo','Projetos','Jurídico','Financeiro','RH']
  const UNIDADES   = ['un','m','m²','m³','kg','sc','lt','barra','rolo','pç','cj','ml','cm','mm','t','cx','fr','gl','tb','vb','mil']

  const inp = {
    width: '100%', padding: '8px 12px', borderRadius: 7,
    background: '#0F1117', border: '1px solid #1E2235',
    color: '#F1F5F9', fontSize: 13, outline: 'none', fontFamily: 'inherit',
  }
  const lbl = { fontSize: 11, fontWeight: 600, color: '#64748B', marginBottom: 4, display: 'block' }

  const isAco = /aço|aco/i.test(form.nome)

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{
      position: 'fixed', inset: 0, background: '#00000090',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16,
    }}>
      <div style={{
        background: '#1A1D2E', border: '1px solid #1E2235', borderRadius: 16,
        width: 580, maxWidth: '95vw', maxHeight: '90vh',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #1E2235', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: '#F1F5F9' }}>
              {isNew ? '📦 Novo Insumo' : '✏️ Editar Insumo'}
            </span>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#475569', fontSize: 22, cursor: 'pointer' }}>×</button>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

          {/* Nome — campo principal com detecção */}
          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>Nome do insumo *</label>
            <input style={inp} value={form.nome} onChange={e => handleNomeChange(e.target.value)}
              placeholder="Ex: Aço CA-50, Tubo PVC, Cimento CP-II..." autoFocus />
          </div>

          {/* Hint do template detectado */}
          {template && (
            <div style={{ marginBottom: 14, padding: '10px 14px', background: '#1E3A5F22', border: '1px solid #3B82F644', borderRadius: 8, fontSize: 12, color: '#93C5FD' }}>
              💡 <strong>{template.tipo}</strong> detectado — {template.hint}
            </div>
          )}

          {/* Código + SINAPI */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div>
              <label style={lbl}>Código *</label>
              <div style={{ display: 'flex', gap: 6 }}>
                <input style={{ ...inp, flex: 1, fontFamily: 'monospace' }} value={form.codigo} onChange={e => set('codigo', e.target.value)} placeholder="00001" />
                <button onClick={() => set('codigo', gerarProximoCodigo(insumos))}
                  style={{ padding: '8px 10px', borderRadius: 7, border: '1px solid #1E3A5F', background: 'transparent', color: '#3B82F6', fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  🔄 Auto
                </button>
              </div>
            </div>
            <div>
              <label style={lbl}>Código SINAPI (opcional)</label>
              <input style={inp} value={form.codigo_sinapi} onChange={e => set('codigo_sinapi', e.target.value)} placeholder="Ex: 00001007" />
            </div>
          </div>

          {/* Categoria + Tipo */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div>
              <label style={lbl}>Categoria</label>
              <select style={inp} value={form.categoria} onChange={e => set('categoria', e.target.value)}>
                {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Tipo / Especificação</label>
              <input style={inp} value={form.tipo} onChange={e => set('tipo', e.target.value)} placeholder="Ex: CA-50, CP-II, PVC Rígido..." />
            </div>
          </div>

          {/* Unidades */}
          <div style={{ background: '#0F1117', border: '1px solid #1E2235', borderRadius: 10, padding: '14px', marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#64748B', marginBottom: 12 }}>⚖️ Unidades e Conversão</div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
              <div>
                <label style={lbl}>Unidade de compra *</label>
                <select style={inp} value={form.unidade_compra} onChange={e => set('unidade_compra', e.target.value)}>
                  {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Unidade de uso</label>
                <select style={inp} value={form.unidade_uso} onChange={e => set('unidade_uso', e.target.value)}>
                  <option value="">— mesma —</option>
                  {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Fator (1 {form.unidade_compra} = ? {form.unidade_uso || form.unidade_compra})</label>
                <input style={inp} type="number" min="0" step="0.001" value={form.fator_conversao}
                  onChange={e => set('fator_conversao', e.target.value)} placeholder="Ex: 12, 50, 6..." />
              </div>
            </div>

            {/* Campos físicos */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10 }}>
              {/* Diâmetro — para aço e tubos */}
              <div>
                <label style={lbl}>Diâmetro (mm)</label>
                {isAco ? (
                  <select style={inp} value={form.diametro_mm} onChange={e => set('diametro_mm', e.target.value)}>
                    <option value="">— bitola —</option>
                    {Object.entries(ACO_BITOLAS).map(([d, info]) => (
                      <option key={d} value={d}>ø{d}mm</option>
                    ))}
                  </select>
                ) : (
                  <input style={inp} type="number" min="0" value={form.diametro_mm}
                    onChange={e => set('diametro_mm', e.target.value)} placeholder="mm" />
                )}
              </div>
              <div>
                <label style={lbl}>Comprimento (m)</label>
                <input style={inp} type="number" min="0" step="0.01" value={form.comprimento_m}
                  onChange={e => set('comprimento_m', e.target.value)} placeholder="m" />
              </div>
              <div>
                <label style={lbl}>Largura (m)</label>
                <input style={inp} type="number" min="0" step="0.01" value={form.largura_m}
                  onChange={e => set('largura_m', e.target.value)} placeholder="m" />
              </div>
              <div>
                <label style={lbl}>Peso unit. (kg)</label>
                <input style={{ ...inp, color: isAco && form.diametro_mm ? '#10B981' : '#F1F5F9' }}
                  type="number" min="0" step="0.001" value={form.peso_unitario_kg}
                  onChange={e => set('peso_unitario_kg', e.target.value)}
                  placeholder="kg"
                  readOnly={isAco && !!form.diametro_mm} />
              </div>
            </div>

            {/* Info automática do aço */}
            {isAco && form.diametro_mm && ACO_BITOLAS[String(form.diametro_mm)] && (
              <div style={{ marginTop: 10, padding: '8px 12px', background: '#064E3B22', border: '1px solid #10B98144', borderRadius: 7, fontSize: 11, color: '#6EE7B7' }}>
                ø{form.diametro_mm}mm · {ACO_BITOLAS[String(form.diametro_mm)].peso_m} kg/m ·
                barra {form.comprimento_m || 12}m = {(ACO_BITOLAS[String(form.diametro_mm)].peso_m * (parseFloat(form.comprimento_m) || 12)).toFixed(3)} kg/barra ✓
              </div>
            )}
          </div>

          {/* Preço + Fornecedor */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div>
              <label style={lbl}>Preço de referência (R$/{form.unidade_compra})</label>
              <input style={inp} type="number" min="0" step="0.01" value={form.preco_referencia}
                onChange={e => set('preco_referencia', e.target.value)} placeholder="0,00" />
            </div>
            <div>
              <label style={lbl}>Fornecedor padrão</label>
              <select style={inp} value={form.fornecedor_id}
                onChange={e => {
                  set('fornecedor_id', e.target.value)
                  const f = fornecedores.find(f => f.id === e.target.value)
                  if (f) set('fornecedor_nome', f.nome)
                }}>
                <option value="">— Nenhum —</option>
                {fornecedores.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
              </select>
            </div>
          </div>

          {/* Descrição */}
          <div>
            <label style={lbl}>Descrição / Observações</label>
            <textarea style={{ ...inp, resize: 'vertical', minHeight: 64, fontFamily: 'inherit' }}
              value={form.descricao} onChange={e => set('descricao', e.target.value)}
              placeholder="Especificações adicionais, normas, observações..." />
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px', borderTop: '1px solid #1E2235', display: 'flex', justifyContent: 'flex-end', gap: 8, flexShrink: 0 }}>
          <button onClick={onClose} style={{ padding: '8px 18px', borderRadius: 7, border: '1px solid #1E2235', background: 'transparent', color: '#64748B', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
          <button onClick={() => form.nome && form.codigo && form.unidade_compra && onSave(form)} style={{
            padding: '8px 20px', borderRadius: 7, border: 'none',
            background: 'linear-gradient(135deg, #3B82F6, #6366F1)',
            color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer',
          }}>Salvar insumo</button>
        </div>
      </div>
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────
const CATEGORIAS_FILTER = ['Todas','Estrutura','Alvenaria','Hidráulica','Elétrica','Acabamento','Pintura','Cobertura','Impermeabilização','Instalações','Esquadrias','Externo','Logística','Locações','Administrativo','Projetos','Jurídico','Financeiro','RH','Geral']

export default function Insumos({ session }) {
  const [insumos,     setInsumos]     = useState([])
  const [fornecedores,setFornecedores]= useState([])
  const [loading,     setLoading]     = useState(true)
  const [modal,       setModal]       = useState(null)
  const [calcModal,   setCalcModal]   = useState(null)
  const [search,      setSearch]      = useState('')
  const [catFilter,   setCatFilter]   = useState('Todas')
  const [toast,       setToast]       = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    const [{ data: ins }, { data: forn }] = await Promise.all([
      supabase.from('insumos').select('*').order('nome'),
      supabase.from('fornecedores').select('id, nome').order('nome'),
    ])
    setInsumos(ins ?? [])
    setFornecedores(forn ?? [])
    setLoading(false)
  }

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const [histModal, setHistModal] = useState(null)
  const [histDados, setHistDados] = useState([])
  const [histLoading, setHistLoading] = useState(false)

  async function verHistorico(insumo) {
    setHistModal(insumo)
    setHistLoading(true)
    // Busca cotações que têm esse insumo pelo nome
    const { data: precos } = await supabase
      .from('cotacao_itens')
      .select(`
        descricao, unidade, quantidade,
        cotacao:cotacoes(titulo, created_at, status, obra:obras(nome)),
        precos:cotacao_precos(
          preco_unitario, desconto_pct, bdi_pct,
          fornecedor:cotacao_fornecedores(fornecedor_nome, condicao_pagamento)
        )
      `)
      .ilike('descricao', `%${insumo.nome.split(' ').slice(0, 3).join(' ')}%`)
      .order('created_at', { foreignTable: 'cotacoes', ascending: false })
      .limit(50)

    setHistDados(precos ?? [])
    setHistLoading(false)
  }

  async function handleSave(form) {
    const payload = {
      ...form,
      fator_conversao:  parseFloat(form.fator_conversao)  || null,
      peso_unitario_kg: parseFloat(form.peso_unitario_kg) || null,
      comprimento_m:    parseFloat(form.comprimento_m)    || null,
      diametro_mm:      parseFloat(form.diametro_mm)      || null,
      largura_m:        parseFloat(form.largura_m)        || null,
      altura_m:         parseFloat(form.altura_m)         || null,
      preco_referencia: parseFloat(form.preco_referencia) || null,
      fornecedor_id:    form.fornecedor_id                || null,
      owner_id:         session.user.id,
    }
    const id = modal?.id
    if (id) {
      delete payload.id
      await supabase.from('insumos').update(payload).eq('id', id)
      showToast('Insumo atualizado!')
    } else {
      await supabase.from('insumos').insert(payload)
      showToast('Insumo cadastrado!')
    }
    setModal(null)
    load()
  }

  async function handleDelete(id) {
    if (!confirm('Excluir este insumo?')) return
    await supabase.from('insumos').delete().eq('id', id)
    setModal(null)
    load()
    showToast('Insumo excluído.')
  }

  const filtered = insumos.filter(i => {
    if (catFilter !== 'Todas' && i.categoria !== catFilter) return false
    if (search && !i.nome.toLowerCase().includes(search.toLowerCase()) &&
        !i.codigo?.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const selStyle = {
    padding: '6px 12px', borderRadius: 7, border: '1px solid #1E2235',
    background: '#0F1117', color: '#94A3B8', fontSize: 12, outline: 'none', cursor: 'pointer',
  }

  return (
    <div style={{ flex: 1, padding: '28px', overflowY: 'auto', color: '#E2E8F0', fontFamily: "'DM Sans', sans-serif" }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#F1F5F9', marginBottom: 4 }}>Insumos</h1>
          <p style={{ fontSize: 13, color: '#475569' }}>Cadastro de materiais com conversão automática de unidades.</p>
        </div>
        <button onClick={() => setModal({})} style={{
          padding: '9px 18px', borderRadius: 8, border: 'none',
          background: 'linear-gradient(135deg, #3B82F6, #6366F1)',
          color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer',
        }}>+ Novo Insumo</button>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { label: 'Total cadastrado', value: insumos.length,                              color: '#3B82F6' },
          { label: 'Com conversão',    value: insumos.filter(i => i.fator_conversao).length, color: '#10B981' },
          { label: 'Com preço ref.',   value: insumos.filter(i => i.preco_referencia).length, color: '#F59E0B' },
        ].map(s => (
          <div key={s.label} style={{ background: '#1A1D2E', border: '1px solid #1E2235', borderRadius: 10, padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</span>
            <span style={{ fontSize: 11, color: '#475569' }}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          style={{ ...selStyle, color: '#F1F5F9', minWidth: 200 }}
          placeholder="🔍 Buscar por nome ou código..."
          value={search} onChange={e => setSearch(e.target.value)}
        />
        <select style={selStyle} value={catFilter} onChange={e => setCatFilter(e.target.value)}>
          {CATEGORIAS_FILTER.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <span style={{ fontSize: 12, color: '#334155' }}>{filtered.length} insumo(s)</span>
      </div>

      {/* Lista */}
      {loading ? (
        <p style={{ color: '#334155', fontSize: 14 }}>Carregando...</p>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#334155' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📦</div>
          <p style={{ fontSize: 15, fontWeight: 600, color: '#475569' }}>
            {insumos.length === 0 ? 'Nenhum insumo cadastrado' : 'Nenhum insumo encontrado'}
          </p>
          <p style={{ fontSize: 13, color: '#334155', marginTop: 4 }}>
            {insumos.length === 0 ? 'Clique em "+ Novo Insumo" para começar.' : 'Tente ajustar os filtros.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {/* Header */}
          <div style={{ display: 'grid', gridTemplateColumns: '120px 2fr 80px 100px 100px 80px 100px', gap: 12, padding: '0 16px', marginBottom: 4 }}>
            {['Código','Nome','Categoria','Un. Compra','Un. Uso','Preço Ref.',''].map(h => (
              <div key={h} style={{ fontSize: 10, fontWeight: 700, color: '#334155', textTransform: 'uppercase' }}>{h}</div>
            ))}
          </div>

          {filtered.map(ins => (
            <div key={ins.id} style={{
              display: 'grid', gridTemplateColumns: '120px 2fr 80px 100px 100px 80px 100px',
              gap: 12, padding: '12px 16px', alignItems: 'center',
              background: '#1A1D2E', border: '1px solid #1E2235', borderRadius: 10,
              transition: 'border-color 0.15s',
            }}
              onMouseEnter={e => e.currentTarget.style.borderColor = '#334155'}
              onMouseLeave={e => e.currentTarget.style.borderColor = '#1E2235'}
            >
              <div style={{ fontSize: 11, fontWeight: 700, color: '#3B82F6', fontFamily: 'monospace' }}>{ins.codigo}</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#F1F5F9' }}>{ins.nome}</div>
                {ins.tipo && <div style={{ fontSize: 11, color: '#475569' }}>{ins.tipo}</div>}
                {ins.diametro_mm && <div style={{ fontSize: 10, color: '#334155' }}>ø{ins.diametro_mm}mm</div>}
              </div>
              <div style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: '#1E2235', color: '#64748B', textAlign: 'center', whiteSpace: 'nowrap' }}>{ins.categoria}</div>
              <div style={{ fontSize: 12, color: '#94A3B8', textAlign: 'center' }}>{ins.unidade_compra}</div>
              <div style={{ fontSize: 12, color: ins.fator_conversao ? '#10B981' : '#334155', textAlign: 'center' }}>
                {ins.unidade_uso ? `${ins.fator_conversao} ${ins.unidade_uso}` : '—'}
              </div>
              <div style={{ fontSize: 12, color: ins.preco_referencia ? '#F1F5F9' : '#334155', textAlign: 'right' }}>
                {ins.preco_referencia ? `R$ ${Number(ins.preco_referencia).toFixed(2)}` : '—'}
              </div>
              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                {ins.fator_conversao && (
                  <button onClick={() => setCalcModal(ins)} style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #1E3A5F', background: 'transparent', color: '#3B82F6', fontSize: 12, cursor: 'pointer' }} title="Calculadora de conversão">⚖️</button>
                )}
                <button onClick={() => verHistorico(ins)} style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #1E2235', background: 'transparent', color: '#8B5CF6', fontSize: 12, cursor: 'pointer' }} title="Histórico de preços">📈</button>
                <button onClick={() => setModal(ins)} style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #1E2235', background: 'transparent', color: '#475569', fontSize: 12, cursor: 'pointer' }}>✏️</button>
                <button onClick={() => handleDelete(ins.id)} style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #450A0A', background: 'transparent', color: '#EF4444', fontSize: 12, cursor: 'pointer' }}>×</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal !== null && (
        <InsumoModal
          insumo={modal.id ? modal : null}
          fornecedores={fornecedores}
          insumos={insumos}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}

      {calcModal && (
        <Calculadora
          insumo={calcModal}
          onClose={() => setCalcModal(null)}
        />
      )}

      {histModal && (
        <div onClick={e => e.target === e.currentTarget && setHistModal(null)} style={{ position: 'fixed', inset: 0, background: '#00000090', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
          <div style={{ background: '#1A1D2E', border: '1px solid #1E2235', borderRadius: 16, width: 700, maxWidth: '95vw', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #1E2235', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#F1F5F9' }}>📈 Histórico de Preços</div>
                <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>{histModal.nome}</div>
              </div>
              <button onClick={() => setHistModal(null)} style={{ background: 'none', border: 'none', color: '#475569', fontSize: 22, cursor: 'pointer' }}>×</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
              {histLoading ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#334155' }}>Buscando histórico...</div>
              ) : histDados.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#334155' }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>📊</div>
                  <div style={{ color: '#475569' }}>Nenhuma cotação encontrada para este insumo</div>
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: '#0D1020' }}>
                      {['Cotação', 'Obra', 'Data', 'Fornecedor', 'Preço Unit.', 'Desc%', 'BDI%', 'Preço Eq.', 'Pagamento'].map(h => (
                        <th key={h} style={{ padding: '8px 10px', textAlign: 'left', color: '#475569', fontWeight: 700, fontSize: 10, textTransform: 'uppercase', borderBottom: '1px solid #1E2235', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {histDados.flatMap((item, i) =>
                      (item.precos ?? []).map((preco, j) => {
                        const pu = parseFloat(preco.preco_unitario) || 0
                        const desc = parseFloat(preco.desconto_pct) || 0
                        const bdi  = parseFloat(preco.bdi_pct) || 0
                        const eq   = pu * (1 - desc/100) * (1 + bdi/100)
                        return (
                          <tr key={`${i}-${j}`} style={{ background: (i+j) % 2 === 0 ? '#0F1117' : '#0D1020', borderBottom: '1px solid #161929' }}>
                            <td style={{ padding: '8px 10px', color: '#94A3B8' }}>{item.cotacao?.titulo ?? '—'}</td>
                            <td style={{ padding: '8px 10px', color: '#64748B' }}>{item.cotacao?.obra?.nome ?? '—'}</td>
                            <td style={{ padding: '8px 10px', color: '#64748B', whiteSpace: 'nowrap' }}>
                              {item.cotacao?.created_at ? new Date(item.cotacao.created_at).toLocaleDateString('pt-BR') : '—'}
                            </td>
                            <td style={{ padding: '8px 10px', color: '#F1F5F9', fontWeight: 600 }}>{preco.fornecedor?.fornecedor_nome ?? '—'}</td>
                            <td style={{ padding: '8px 10px', color: '#F1F5F9', textAlign: 'right' }}>{pu > 0 ? `R$ ${pu.toFixed(2)}` : '—'}</td>
                            <td style={{ padding: '8px 10px', color: '#64748B', textAlign: 'center' }}>{desc > 0 ? `${desc}%` : '—'}</td>
                            <td style={{ padding: '8px 10px', color: '#64748B', textAlign: 'center' }}>{bdi > 0 ? `${bdi}%` : '—'}</td>
                            <td style={{ padding: '8px 10px', color: eq > 0 ? '#10B981' : '#334155', textAlign: 'right', fontWeight: 600 }}>{eq > 0 ? `R$ ${eq.toFixed(2)}` : '—'}</td>
                            <td style={{ padding: '8px 10px', color: '#64748B' }}>{preco.fornecedor?.condicao_pagamento ?? '—'}</td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
        <div style={{
          position: 'fixed', bottom: 24, right: 24,
          background: '#064E3B', border: '1px solid #065F46',
          color: '#6EE7B7', padding: '10px 18px', borderRadius: 10,
          fontSize: 13, fontWeight: 600, zIndex: 2000,
        }}>{toast}</div>
      )}
    </div>
  )
}
