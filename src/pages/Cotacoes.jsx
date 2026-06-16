import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

// ── Helpers ───────────────────────────────────────────────────────────────
function fmtBRL(v) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

// Calcula preço equalizado: unit * (1 - desc/100) * (1 + bdi/100)
function precoEqualizado(preco) {
  const unit = parseFloat(preco?.preco_unitario) || 0
  const desc = parseFloat(preco?.desconto_pct) || 0
  const bdi  = parseFloat(preco?.bdi_pct) || 0
  return unit * (1 - desc / 100) * (1 + bdi / 100)
}

// Total equalizado de um fornecedor: soma (precoEq * qtd) + frete
function totalFornecedor(fornecedor, itens, precos) {
  const subtotal = itens.reduce((acc, item) => {
    const p = precos.find(p => p.cotacao_item_id === item.id && p.cotacao_fornecedor_id === fornecedor.id)
    return acc + precoEqualizado(p) * (parseFloat(item.quantidade) || 1)
  }, 0)
  return subtotal + (parseFloat(fornecedor.frete) || 0)
}

const STATUS_META = {
  aberta:     { label: 'Aberta',     color: '#3B82F6', bg: '#1E3A5F' },
  finalizada: { label: 'Finalizada', color: '#10B981', bg: '#064E3B' },
  cancelada:  { label: 'Cancelada',  color: '#EF4444', bg: '#450A0A' },
}

const inp = {
  width: '100%', padding: '7px 10px', borderRadius: 7,
  background: '#0F1117', border: '1px solid #1E2235',
  color: '#F1F5F9', fontSize: 12, outline: 'none', fontFamily: 'inherit',
}
const lbl = { fontSize: 11, fontWeight: 600, color: '#64748B', marginBottom: 4, display: 'block' }

// ── Modal: Nova Cotação ────────────────────────────────────────────────────
function NovaCotacaoModal({ obras, scs, onSave, onClose }) {
  const [form, setForm] = useState({ obra_id: obras[0]?.id ?? '', titulo: '', sc_id: '', observacoes: '' })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const scsObra = scs.filter(s => s.obra_id === form.obra_id && s.status === 'aprovada')

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{
      position: 'fixed', inset: 0, background: '#00000090',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16,
    }}>
      <div style={{ background: '#1A1D2E', border: '1px solid #1E2235', borderRadius: 16, padding: 28, width: 480, maxWidth: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#F1F5F9' }}>Nova Cotação</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#475569', fontSize: 22, cursor: 'pointer' }}>×</button>
        </div>

        <label style={lbl}>Título *</label>
        <input style={{ ...inp, marginBottom: 14 }} value={form.titulo} onChange={e => set('titulo', e.target.value)} placeholder="Ex: Cotação materiais elétricos" />

        <label style={lbl}>Obra *</label>
        <select style={{ ...inp, marginBottom: 14 }} value={form.obra_id} onChange={e => set('obra_id', e.target.value)}>
          {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
        </select>

        <label style={lbl}>Vincular a SC aprovada (opcional)</label>
        <select style={{ ...inp, marginBottom: 14 }} value={form.sc_id} onChange={e => set('sc_id', e.target.value)}>
          <option value="">— Nenhuma, criar do zero —</option>
          {scsObra.map(s => <option key={s.id} value={s.id}>{s.titulo}</option>)}
        </select>

        <label style={lbl}>Observações</label>
        <textarea style={{ ...inp, resize: 'vertical', minHeight: 64, marginBottom: 20 }}
          value={form.observacoes} onChange={e => set('observacoes', e.target.value)}
          placeholder="Instruções gerais para esta cotação..." />

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={{ padding: '8px 18px', borderRadius: 7, border: '1px solid #1E2235', background: 'transparent', color: '#64748B', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
          <button onClick={() => form.titulo && form.obra_id && onSave(form)} style={{
            padding: '8px 20px', borderRadius: 7, border: 'none',
            background: 'linear-gradient(135deg, #3B82F6, #6366F1)',
            color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer',
          }}>Criar Cotação</button>
        </div>
      </div>
    </div>
  )
}

// ── Detalhe da Cotação ─────────────────────────────────────────────────────
function CotacaoDetalhe({ cotacao, session, onBack, onUpdate }) {
  const [itens,        setItens]        = useState([])
  const [fornecedores, setFornecedores] = useState([])
  const [precos,       setPrecos]       = useState([])
  const [fornsList,    setFornsList]    = useState([])
  const [insumos,      setInsumos]      = useState([])
  const [showInsumoSearch, setShowInsumoSearch] = useState(null)
  const [insumoSearch, setInsumoSearch] = useState('')
  const [loading,      setLoading]      = useState(true)
  const [toast,        setToast]        = useState(null)
  const [aba,          setAba]          = useState('comparativo')

  useEffect(() => { load() }, [cotacao.id])

  async function load() {
    setLoading(true)
    const [{ data: itensData }, { data: fornsData }, { data: precosData }, { data: fornsListData }, { data: insumosData }] = await Promise.all([
      supabase.from('cotacao_itens').select('*').eq('cotacao_id', cotacao.id).order('ordem'),
      supabase.from('cotacao_fornecedores').select('*').eq('cotacao_id', cotacao.id).order('ordem'),
      supabase.from('cotacao_precos').select('*').in(
        'cotacao_item_id',
        (await supabase.from('cotacao_itens').select('id').eq('cotacao_id', cotacao.id)).data?.map(i => i.id) ?? []
      ),
      supabase.from('fornecedores').select('id, nome').order('nome'),
      supabase.from('insumos').select('id, codigo, nome, unidade_compra, preco_referencia').eq('ativo', true).order('nome'),
    ])
    setItens(itensData ?? [])
    setFornecedores(fornsData ?? [])
    setPrecos(precosData ?? [])
    setFornsList(fornsListData ?? [])
    setInsumos(insumosData ?? [])
    setLoading(false)
  }

  const insumosFiltrados = insumos.filter(i => {
    if (!insumoSearch) return true
    const q = insumoSearch.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    const nome = (i.nome ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    return nome.includes(q) || (i.codigo ?? '').includes(insumoSearch)
  })

  function showToast(msg, type = 'success') {
    setToast({ msg, type })
    if (type !== 'loading') setTimeout(() => setToast(null), 3000)
  }

  // ── ITENS ────────────────────────────────────────────────────────────────
  async function addItem() {
    const { data } = await supabase.from('cotacao_itens').insert({
      cotacao_id: cotacao.id, descricao: 'Novo item', unidade: 'un', quantidade: 1, ordem: itens.length,
    }).select().single()
    if (data) setItens(i => [...i, data])
  }

  async function updateItem(id, field, value) {
    setItens(its => its.map(i => i.id === id ? { ...i, [field]: value } : i))
    await supabase.from('cotacao_itens').update({ [field]: value }).eq('id', id)
  }

  async function removeItem(id) {
    await supabase.from('cotacao_itens').delete().eq('id', id)
    setItens(its => its.filter(i => i.id !== id))
    setPrecos(ps => ps.filter(p => p.cotacao_item_id !== id))
  }

  // ── FORNECEDORES ──────────────────────────────────────────────────────────
  async function addFornecedor() {
    const { data } = await supabase.from('cotacao_fornecedores').insert({
      cotacao_id: cotacao.id, fornecedor_nome: 'Novo fornecedor', frete: 0, ordem: fornecedores.length,
    }).select().single()
    if (data) setFornecedores(f => [...f, data])
  }

  async function updateFornecedor(id, field, value) {
    setFornecedores(fs => fs.map(f => f.id === id ? { ...f, [field]: value } : f))
    await supabase.from('cotacao_fornecedores').update({ [field]: value }).eq('id', id)
  }

  async function removeFornecedor(id) {
    await supabase.from('cotacao_fornecedores').delete().eq('id', id)
    setFornecedores(fs => fs.filter(f => f.id !== id))
    setPrecos(ps => ps.filter(p => p.cotacao_fornecedor_id !== id))
  }

  async function criarOuVincularFornecedor(cotForn) {
    const nome = cotForn.fornecedor_nome?.trim()
    if (!nome || nome === 'Novo fornecedor') return
    if (cotForn.fornecedor_id) return // já está vinculado a um cadastro existente

    // Verifica se já existe um fornecedor com esse nome (case-insensitive)
    const existente = fornsList.find(f => f.nome.toLowerCase() === nome.toLowerCase())
    if (existente) {
      await updateFornecedor(cotForn.id, 'fornecedor_id', existente.id)
      return
    }

    // Cria fornecedor novo na tabela principal (com dados mínimos)
    const { data: novoForn, error } = await supabase.from('fornecedores').insert({
      nome,
      categoria: 'Materiais de Construção',
      ativo: true,
    }).select('id, nome').single()

    if (error || !novoForn) return

    setFornsList(fl => [...fl, novoForn].sort((a, b) => a.nome.localeCompare(b.nome)))
    await updateFornecedor(cotForn.id, 'fornecedor_id', novoForn.id)
  }

  async function selectFornFromCadastro(fornId, cotFornId) {
    const forn = fornsList.find(f => f.id === fornId)
    if (!forn) return
    await updateFornecedor(cotFornId, 'fornecedor_id', fornId)
    await updateFornecedor(cotFornId, 'fornecedor_nome', forn.nome)
  }

  // ── IMPORTAÇÃO DETERMINÍSTICA: planilha de equalização (fornecedores em colunas) ──
  async function tentarImportarEqualizacao(file) {
    const XLSX = await import('xlsx')
    const buf = await file.arrayBuffer()
    const wb = XLSX.read(buf, { type: 'array' })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true })

    // Acha a linha com nomes dos fornecedores: tem células "FORNECEDOR X" ou similar
    let fornecedorRow = -1
    let headerRow = -1
    for (let i = 0; i < Math.min(rows.length, 10); i++) {
      const row = rows[i] ?? []
      if (row.some(c => typeof c === 'string' && /fornecedor\s*\d/i.test(c))) fornecedorRow = i
      if (row.some(c => typeof c === 'string' && /^(item)$/i.test(String(c).trim()))
          && row.some(c => typeof c === 'string' && /descri/i.test(c))) headerRow = i
    }
    if (fornecedorRow === -1 || headerRow === -1) return null // não é esse formato

    const fRow = rows[fornecedorRow]
    const hRow = rows[headerRow]
    const nomeRow = rows[fornecedorRow + 1] ?? [] // linha com nome real do fornecedor

    // Identifica colunas-base
    const colItem = hRow.findIndex(c => /^item$/i.test(String(c ?? '').trim()))
    const colDesc = hRow.findIndex(c => /descri/i.test(String(c ?? '')))
    const colQtd  = hRow.findIndex(c => /quant/i.test(String(c ?? '')))
    const colUn   = hRow.findIndex(c => /^un\.?$/i.test(String(c ?? '').trim()))

    // Identifica blocos de fornecedores: cada "FORNECEDOR X" na fRow marca o início (colunas Unit/Total seguintes)
    const fornecedores = []
    for (let c = 0; c < fRow.length; c++) {
      const val = fRow[c]
      if (typeof val === 'string' && /fornecedor\s*\d/i.test(val)) {
        // Acha colunas Unit e Total a partir daqui na headerRow
        let colUnit = -1, colTotal = -1
        for (let cc = c; cc < hRow.length && cc < c + 4; cc++) {
          if (colUnit === -1 && /^unit/i.test(String(hRow[cc] ?? ''))) colUnit = cc
          else if (colUnit !== -1 && colTotal === -1 && /^total/i.test(String(hRow[cc] ?? ''))) colTotal = cc
        }
        const nome = (nomeRow[c] ?? val ?? '').toString().trim() || val.trim()
        fornecedores.push({ nome, colUnit, colTotal, colStart: c })
      }
    }
    if (!fornecedores.length) return null

    // Coleta itens: linhas após headerRow até encontrar linha sem ITEM numérico
    const itens = []
    let r = headerRow + 1
    while (r < rows.length) {
      const row = rows[r] ?? []
      const itemVal = row[colItem]
      const descVal = row[colDesc]
      if (typeof itemVal !== 'number' || !descVal) break
      itens.push({
        descricao: String(descVal).trim(),
        unidade: colUn >= 0 ? String(row[colUn] ?? 'un').trim() : 'un',
        quantidade: parseFloat(row[colQtd]) || 1,
        precos: fornecedores.map(f => ({
          unit: parseFloat(row[f.colUnit]) || 0,
        })),
      })
      r++
    }
    if (!itens.length) return null

    // Coleta condições de pagamento, frete, desconto (linhas depois dos itens)
    const condicoes = fornecedores.map(() => ({ pagamento: '', frete: 0, desconto: 0, totalProposta: 0 }))
    for (let rr = r; rr < rows.length; rr++) {
      const row = rows[rr] ?? []
      const label = String(row[colDesc] ?? row[1] ?? row[0] ?? '').toUpperCase()
      fornecedores.forEach((f, fi) => {
        const val = row[f.colUnit]
        const valTotal = row[f.colTotal]
        if (/CONDI[CÇ][AÕ]ES?\s*DE\s*PAGAMENTO/i.test(label) && val != null) condicoes[fi].pagamento = String(val).trim()
        if (/^FRETE/i.test(label) && typeof val === 'number') condicoes[fi].frete = val
        if (/DESCONTO/i.test(label) && typeof val === 'number') condicoes[fi].desconto = val
        if (/VALOR\s*TOTAL\s*DA\s*PROPOSTA\s*INICIAL/i.test(label) && typeof val === 'number') condicoes[fi].totalProposta = val
      })
    }

    // Converte desconto absoluto (R$) em percentual
    condicoes.forEach(c => {
      if (c.desconto > 0 && c.totalProposta > 0) {
        c.desconto_pct = (c.desconto / c.totalProposta) * 100
      } else {
        c.desconto_pct = 0
      }
    })

    return { fornecedores, itens, condicoes }
  }
  const importRef = useRef(null)
  const [importando, setImportando] = useState(false)
  const [importModal, setImportModal] = useState(null) // dados extraídos pela IA

  const [importMultiModal, setImportMultiModal] = useState(null)

  async function handleImportCotacao(e) {
    const file = e.target.files[0]
    if (!file) return
    e.target.value = ''
    const ext = file.name.split('.').pop().toLowerCase()

    // 1. Tenta formato determinístico de equalização (sem IA)
    if (['xlsx', 'xls'].includes(ext)) {
      try {
        const equalizacao = await tentarImportarEqualizacao(file)
        if (equalizacao) {
          setImportMultiModal(equalizacao)
          showToast(`Planilha de equalização detectada: ${equalizacao.fornecedores.length} fornecedores, ${equalizacao.itens.length} itens`, 'success')
          return
        }
      } catch (err) {
        console.error('Erro no parser determinístico:', err)
      }
    }

    // 2. Fallback: usa IA
    setImportando(true)
    showToast('Analisando arquivo com IA...', 'loading')

    try {
      let textContent = ''
      let imageBase64 = null
      let imageType = null

      if (['jpg','jpeg','png','webp'].includes(ext)) {
        // Imagem — manda direto pro Claude
        const reader = new FileReader()
        imageBase64 = await new Promise(res => {
          reader.onload = ev => res(ev.target.result.split(',')[1])
          reader.readAsDataURL(file)
        })
        imageType = `image/${ext === 'jpg' ? 'jpeg' : ext}`
      } else if (['xlsx','xls'].includes(ext)) {
        // Excel — converte para texto
        const XLSX = await import('xlsx')
        const buf = await file.arrayBuffer()
        const wb = XLSX.read(buf, { type: 'array' })
        const textos = wb.SheetNames.map(name => {
          const ws = wb.Sheets[name]
          return `=== Aba: ${name} ===\n` + XLSX.utils.sheet_to_csv(ws)
        })
        textContent = textos.join('\n\n')
      } else if (ext === 'pdf') {
        // PDF — tenta extrair texto
        textContent = `[Arquivo PDF: ${file.name}] — conteúdo não extraível diretamente. Use imagem ou Excel.`
      }

      // Monta mensagem para o Claude
      const prompt = `Você é um assistente de análise de cotações para construção civil.
Analise este documento e extraia as informações da proposta do fornecedor.
Retorne APENAS um JSON válido no formato abaixo, sem texto adicional:
{
  "fornecedor_nome": "nome do fornecedor ou empresa",
  "condicao_pagamento": "ex: 30/60/90 dias ou à vista",
  "prazo_entrega_dias": 15,
  "frete": 0,
  "observacoes": "observações gerais",
  "itens": [
    {
      "descricao": "nome do item",
      "unidade": "kg",
      "quantidade": 1,
      "preco_unitario": 10.50,
      "desconto_pct": 0,
      "bdi_pct": 0
    }
  ]
}`

      const messages = imageBase64 ? [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: imageType, data: imageBase64 } },
          { type: 'text', text: prompt }
        ]
      }] : [{
        role: 'user',
        content: `${prompt}\n\nConteúdo do arquivo:\n${textContent}`
      }]

      const res = await fetch('/api/anthropic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 2000, messages })
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error.message ?? data.error)
      const text = data.content?.[0]?.text ?? ''
      const clean = text.replace(/```json|```/g, '').trim()
      const parsed = JSON.parse(clean)
      setImportModal(parsed)
      showToast('Cotação analisada! Confirme os dados.', 'success')
    } catch (err) {
      console.error(err)
      showToast('Erro ao analisar arquivo.', 'error')
    }
    setImportando(false)
  }

  async function confirmarImportacaoMulti(dados) {
    // 1. Cria itens da cotação (uma vez, compartilhados entre fornecedores)
    const itensIds = []
    for (const it of dados.itens) {
      let itemId = itens.find(i => i.descricao?.toLowerCase() === it.descricao?.toLowerCase())?.id
      if (!itemId) {
        const { data: novoItem } = await supabase.from('cotacao_itens').insert({
          cotacao_id: cotacao.id,
          descricao: it.descricao,
          unidade: it.unidade ?? 'un',
          quantidade: parseFloat(it.quantidade) || 1,
          ordem: itens.length + itensIds.length,
        }).select().single()
        if (novoItem) {
          setItens(its => [...its, novoItem])
          itemId = novoItem.id
        }
      }
      itensIds.push(itemId)
    }

    // 2. Para cada fornecedor: cria fornecedor + insere preços de todos os itens
    for (let fi = 0; fi < dados.fornecedores.length; fi++) {
      const f = dados.fornecedores[fi]
      const cond = dados.condicoes[fi] ?? { pagamento: '', frete: 0, desconto: 0 }

      const { data: novoForn } = await supabase.from('cotacao_fornecedores').insert({
        cotacao_id: cotacao.id,
        fornecedor_nome: f.nome,
        condicao_pagamento: cond.pagamento ?? '',
        frete: parseFloat(cond.frete) || 0,
        observacoes: '',
        ordem: fornecedores.length + fi,
      }).select().single()

      if (!novoForn) continue
      setFornecedores(fs => [...fs, novoForn])
      await criarOuVincularFornecedor(novoForn)

      // Insere preços de cada item para esse fornecedor
      for (let ii = 0; ii < dados.itens.length; ii++) {
        const itemId = itensIds[ii]
        const precoUnit = dados.itens[ii].precos[fi]?.unit ?? 0
        if (!itemId || !precoUnit) continue

        const { data: novoPreco } = await supabase.from('cotacao_precos').insert({
          cotacao_item_id: itemId,
          cotacao_fornecedor_id: novoForn.id,
          preco_unitario: precoUnit,
          desconto_pct: parseFloat(cond.desconto_pct) || 0,
          bdi_pct: 0,
        }).select().single()
        if (novoPreco) setPrecos(ps => [...ps, novoPreco])
      }
    }

    setImportMultiModal(null)
    showToast(`✅ ${dados.fornecedores.length} fornecedores e ${dados.itens.length} itens importados!`)
    setAba('comparativo')
  }

  async function confirmarImportacao(dados, fornecedorId) {
    // Cria ou usa fornecedor existente
    let fornId = fornecedorId
    if (!fornId) {
      const { data } = await supabase.from('cotacao_fornecedores').insert({
        cotacao_id: cotacao.id,
        fornecedor_nome: dados.fornecedor_nome ?? 'Fornecedor importado',
        condicao_pagamento: dados.condicao_pagamento ?? '',
        prazo_entrega_dias: dados.prazo_entrega_dias ?? null,
        frete: parseFloat(dados.frete) || 0,
        observacoes: dados.observacoes ?? '',
        ordem: fornecedores.length,
      }).select().single()
      fornId = data?.id
      if (data) {
        setFornecedores(f => [...f, data])
        await criarOuVincularFornecedor(data)
      }
    }

    if (!fornId) return

    // Para cada item: encontra ou cria o item na cotação, e insere o preço
    for (const it of (dados.itens ?? [])) {
      // Verifica se já existe item com mesma descrição
      let itemId = itens.find(i => i.descricao?.toLowerCase() === it.descricao?.toLowerCase())?.id

      if (!itemId) {
        const { data: novoItem } = await supabase.from('cotacao_itens').insert({
          cotacao_id: cotacao.id,
          descricao: it.descricao,
          unidade: it.unidade ?? 'un',
          quantidade: parseFloat(it.quantidade) || 1,
          ordem: itens.length,
        }).select().single()
        if (novoItem) {
          setItens(its => [...its, novoItem])
          itemId = novoItem.id
        }
      }

      if (itemId) {
        const precoPayload = {
          cotacao_item_id: itemId,
          cotacao_fornecedor_id: fornId,
          preco_unitario: parseFloat(it.preco_unitario) || 0,
          desconto_pct: parseFloat(it.desconto_pct) || 0,
          bdi_pct: parseFloat(it.bdi_pct) || 0,
        }
        const { data: novoPreco } = await supabase.from('cotacao_precos').insert(precoPayload).select().single()
        if (novoPreco) setPrecos(ps => [...ps, novoPreco])
      }
    }

    setImportModal(null)
    showToast(`✅ ${dados.itens?.length ?? 0} itens importados de ${dados.fornecedor_nome}!`)
    setAba('comparativo')
  }
  async function updatePreco(itemId, fornId, field, value) {
    const existing = precos.find(p => p.cotacao_item_id === itemId && p.cotacao_fornecedor_id === fornId)
    const numVal = parseFloat(value) || 0

    if (existing) {
      setPrecos(ps => ps.map(p =>
        p.cotacao_item_id === itemId && p.cotacao_fornecedor_id === fornId
          ? { ...p, [field]: numVal } : p
      ))
      await supabase.from('cotacao_precos').update({ [field]: numVal }).eq('id', existing.id)
    } else {
      const newPreco = { cotacao_item_id: itemId, cotacao_fornecedor_id: fornId, preco_unitario: 0, desconto_pct: 0, bdi_pct: 0, [field]: numVal }
      const { data } = await supabase.from('cotacao_precos').insert(newPreco).select().single()
      if (data) setPrecos(ps => [...ps, data])
    }
  }

  function getPreco(itemId, fornId) {
    return precos.find(p => p.cotacao_item_id === itemId && p.cotacao_fornecedor_id === fornId)
  }

  // Melhor preço equalizado por item
  function melhorPorItem(itemId) {
    const qtd = itens.find(i => i.id === itemId)?.quantidade || 1
    let melhor = null, melhorVal = Infinity
    fornecedores.forEach(f => {
      const p = getPreco(itemId, f.id)
      const eq = precoEqualizado(p) * qtd
      if (eq > 0 && eq < melhorVal) { melhorVal = eq; melhor = f.id }
    })
    return melhor
  }

  // Totais por fornecedor
  const totais = fornecedores.map(f => ({
    id: f.id,
    total: totalFornecedor(f, itens, precos),
  })).sort((a, b) => a.total - b.total)

  const melhorFornId = totais[0]?.total > 0 ? totais[0]?.id : null

  const btnBase = { padding: '6px 14px', borderRadius: 7, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer' }

  if (loading) return <div style={{ padding: 60, textAlign: 'center', color: '#334155' }}>Carregando...</div>

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: "'DM Sans', sans-serif" }}>

      {/* Header */}
      <div style={{ background: '#1A1D2E', borderBottom: '1px solid #1E2235', padding: '14px 24px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={onBack} style={{ background: 'none', border: '1px solid #1E2235', borderRadius: 7, color: '#64748B', fontSize: 13, cursor: 'pointer', padding: '5px 10px' }}>← Voltar</button>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: '#F1F5F9' }}>{cotacao.titulo}</span>
                <span style={{
                  padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                  background: STATUS_META[cotacao.status]?.bg, color: STATUS_META[cotacao.status]?.color,
                }}>{STATUS_META[cotacao.status]?.label}</span>
              </div>
              <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>{cotacao.obra?.nome} • {fmtDate(cotacao.created_at)}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={addItem} style={{ ...btnBase, background: '#1E2235', color: '#94A3B8' }}>+ Item</button>
            <button onClick={addFornecedor} style={{ ...btnBase, background: '#1E2235', color: '#94A3B8' }}>+ Fornecedor</button>
            <label style={{ ...btnBase, background: '#1E2235', color: importando ? '#475569' : '#94A3B8', cursor: importando ? 'default' : 'pointer' }}>
              {importando ? '⏳ Analisando...' : '↑ Importar cotação'}
              <input ref={importRef} type="file" accept=".xlsx,.xls,.pdf,.jpg,.jpeg,.png,.webp" style={{ display: 'none' }} onChange={handleImportCotacao} disabled={importando} />
            </label>
            {cotacao.status === 'aberta' && (
              <button onClick={async () => {
                await supabase.from('cotacoes').update({ status: 'finalizada' }).eq('id', cotacao.id)
                onUpdate()
                showToast('Cotação finalizada!')
              }} style={{ ...btnBase, background: 'linear-gradient(135deg, #10B981, #059669)', color: '#fff' }}>
                ✓ Finalizar
              </button>
            )}
            <button onClick={async () => {
              if (!confirm('Excluir esta cotação? Esta ação não pode ser desfeita.')) return
              await supabase.from('cotacao_precos').delete().in(
                'cotacao_item_id',
                (await supabase.from('cotacao_itens').select('id').eq('cotacao_id', cotacao.id)).data?.map(i => i.id) ?? ['none']
              )
              await supabase.from('cotacao_itens').delete().eq('cotacao_id', cotacao.id)
              await supabase.from('cotacao_fornecedores').delete().eq('cotacao_id', cotacao.id)
              await supabase.from('cotacoes').delete().eq('id', cotacao.id)
              onBack()
            }} style={{ ...btnBase, background: 'transparent', border: '1px solid #7F1D1D', color: '#FCA5A5' }}>
              🗑 Excluir
            </button>
          </div>
        </div>

        {/* Abas */}
        <div style={{ display: 'flex', gap: 4, marginTop: 14 }}>
          {[
            { id: 'comparativo', label: '📊 Comparativo' },
            { id: 'fornecedores', label: '🏢 Fornecedores' },
            { id: 'itens', label: '📦 Itens' },
          ].map(a => (
            <button key={a.id} onClick={() => setAba(a.id)} style={{
              padding: '6px 16px', borderRadius: '7px 7px 0 0', border: 'none',
              background: aba === a.id ? '#0F1117' : 'transparent',
              color: aba === a.id ? '#F1F5F9' : '#475569',
              fontSize: 13, fontWeight: aba === a.id ? 600 : 400, cursor: 'pointer',
              borderBottom: aba === a.id ? '2px solid #3B82F6' : '2px solid transparent',
            }}>{a.label}</button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

        {/* ── ABA COMPARATIVO ── */}
        {aba === 'comparativo' && (
          <>
            {/* Cards de resumo por fornecedor */}
            {fornecedores.length > 0 && (
              <div style={{ display: 'flex', gap: 10, marginBottom: 24, flexWrap: 'wrap' }}>
                {totais.map((t, idx) => {
                  const f = fornecedores.find(f => f.id === t.id)
                  const isMelhor = idx === 0 && t.total > 0
                  return (
                    <div key={t.id} style={{
                      flex: 1, minWidth: 160,
                      background: isMelhor ? '#064E3B' : '#1A1D2E',
                      border: `1px solid ${isMelhor ? '#10B981' : '#1E2235'}`,
                      borderRadius: 10, padding: '14px 16px',
                    }}>
                      {isMelhor && <div style={{ fontSize: 10, fontWeight: 700, color: '#10B981', marginBottom: 4 }}>🏆 MELHOR PROPOSTA</div>}
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#F1F5F9', marginBottom: 4 }}>{f?.fornecedor_nome}</div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: isMelhor ? '#10B981' : '#F1F5F9' }}>{fmtBRL(t.total)}</div>
                      {f?.frete > 0 && <div style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>incl. frete {fmtBRL(f.frete)}</div>}
                      {f?.prazo_entrega_dias && <div style={{ fontSize: 11, color: '#475569' }}>Prazo: {f.prazo_entrega_dias} dias</div>}
                      {f?.condicao_pagamento && <div style={{ fontSize: 11, color: '#475569' }}>{f.condicao_pagamento}</div>}
                    </div>
                  )
                })}
              </div>
            )}

            {/* Tabela comparativa */}
            {itens.length === 0 || fornecedores.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 0', color: '#334155' }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>📊</div>
                <p style={{ color: '#475569', fontWeight: 600 }}>
                  {itens.length === 0 ? 'Adicione itens para comparar' : 'Adicione fornecedores para comparar'}
                </p>
                <p style={{ fontSize: 13, color: '#334155', marginTop: 4 }}>Use os botões "+ Item" e "+ Fornecedor" no topo.</p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: '#0D1020' }}>
                      <th style={{ padding: '10px 12px', textAlign: 'left', color: '#475569', fontWeight: 700, fontSize: 10, textTransform: 'uppercase', border: '1px solid #1E2235', minWidth: 200 }}>Item</th>
                      <th style={{ padding: '10px 8px', color: '#475569', fontWeight: 700, fontSize: 10, textTransform: 'uppercase', border: '1px solid #1E2235', minWidth: 50 }}>Un.</th>
                      <th style={{ padding: '10px 8px', color: '#475569', fontWeight: 700, fontSize: 10, textTransform: 'uppercase', border: '1px solid #1E2235', minWidth: 60 }}>Qtd.</th>
                      {fornecedores.map(f => (
                        <th key={f.id} colSpan={4} style={{
                          padding: '10px 12px', textAlign: 'center', border: '1px solid #1E2235',
                          color: f.id === melhorFornId ? '#10B981' : '#94A3B8',
                          fontWeight: 700, fontSize: 11,
                          background: f.id === melhorFornId ? '#064E3B22' : 'transparent',
                        }}>
                          {f.id === melhorFornId ? '🏆 ' : ''}{f.fornecedor_nome}
                        </th>
                      ))}
                    </tr>
                    <tr style={{ background: '#0A0D14' }}>
                      <th style={{ border: '1px solid #1E2235' }} colSpan={3} />
                      {fornecedores.map(f => (
                        <>
                          <th key={`${f.id}-pu`} style={{ padding: '6px 8px', color: '#334155', fontWeight: 600, fontSize: 10, border: '1px solid #1E2235', minWidth: 90 }}>Preço Unit.</th>
                          <th key={`${f.id}-desc`} style={{ padding: '6px 8px', color: '#334155', fontWeight: 600, fontSize: 10, border: '1px solid #1E2235', minWidth: 60 }}>Desc %</th>
                          <th key={`${f.id}-bdi`} style={{ padding: '6px 8px', color: '#334155', fontWeight: 600, fontSize: 10, border: '1px solid #1E2235', minWidth: 55 }}>BDI %</th>
                          <th key={`${f.id}-eq`} style={{ padding: '6px 8px', color: '#334155', fontWeight: 600, fontSize: 10, border: '1px solid #1E2235', minWidth: 100 }}>Total Equal.</th>
                        </>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {itens.map((item, ri) => {
                      const melhorFornItemId = melhorPorItem(item.id)
                      return (
                        <tr key={item.id} style={{ background: ri % 2 === 0 ? '#0F1117' : '#0D1020' }}>
                          <td style={{ padding: '8px 12px', color: '#94A3B8', border: '1px solid #161929' }}>{item.descricao}</td>
                          <td style={{ padding: '8px 8px', color: '#64748B', border: '1px solid #161929', textAlign: 'center' }}>{item.unidade}</td>
                          <td style={{ padding: '8px 8px', color: '#64748B', border: '1px solid #161929', textAlign: 'center' }}>{item.quantidade}</td>
                          {fornecedores.map(f => {
                            const p = getPreco(item.id, f.id)
                            const eq = precoEqualizado(p) * (parseFloat(item.quantidade) || 1)
                            const isMelhorCell = f.id === melhorFornItemId && eq > 0
                            return (
                              <>
                                <td key={`${item.id}-${f.id}-pu`} style={{ padding: '4px 6px', border: '1px solid #161929' }}>
                                  <input
                                    type="number" min="0" step="0.01"
                                    value={p?.preco_unitario ?? ''}
                                    onChange={e => updatePreco(item.id, f.id, 'preco_unitario', e.target.value)}
                                    style={{ ...inp, padding: '4px 6px', fontSize: 12, textAlign: 'right' }}
                                    placeholder="0,00"
                                  />
                                </td>
                                <td key={`${item.id}-${f.id}-desc`} style={{ padding: '4px 6px', border: '1px solid #161929' }}>
                                  <input
                                    type="number" min="0" max="100" step="0.1"
                                    value={p?.desconto_pct ?? ''}
                                    onChange={e => updatePreco(item.id, f.id, 'desconto_pct', e.target.value)}
                                    style={{ ...inp, padding: '4px 6px', fontSize: 12, textAlign: 'right' }}
                                    placeholder="0"
                                  />
                                </td>
                                <td key={`${item.id}-${f.id}-bdi`} style={{ padding: '4px 6px', border: '1px solid #161929' }}>
                                  <input
                                    type="number" min="0" step="0.1"
                                    value={p?.bdi_pct ?? ''}
                                    onChange={e => updatePreco(item.id, f.id, 'bdi_pct', e.target.value)}
                                    style={{ ...inp, padding: '4px 6px', fontSize: 12, textAlign: 'right' }}
                                    placeholder="0"
                                  />
                                </td>
                                <td key={`${item.id}-${f.id}-eq`} style={{
                                  padding: '8px 10px', border: '1px solid #161929', textAlign: 'right',
                                  fontWeight: isMelhorCell ? 700 : 400,
                                  color: isMelhorCell ? '#10B981' : eq > 0 ? '#F1F5F9' : '#334155',
                                  background: isMelhorCell ? '#064E3B22' : 'transparent',
                                }}>
                                  {eq > 0 ? fmtBRL(eq) : '—'}
                                  {isMelhorCell && <span style={{ fontSize: 9, marginLeft: 4 }}>✓</span>}
                                </td>
                              </>
                            )
                          })}
                        </tr>
                      )
                    })}

                    {/* Linha de frete */}
                    <tr style={{ background: '#0A0D14' }}>
                      <td colSpan={3} style={{ padding: '8px 12px', color: '#475569', fontWeight: 600, fontSize: 11, border: '1px solid #1E2235' }}>Frete</td>
                      {fornecedores.map(f => (
                        <>
                          <td key={`frete-${f.id}-inp`} colSpan={3} style={{ padding: '4px 6px', border: '1px solid #1E2235' }}>
                            <input
                              type="number" min="0" step="0.01"
                              value={f.frete ?? ''}
                              onChange={e => updateFornecedor(f.id, 'frete', parseFloat(e.target.value) || 0)}
                              style={{ ...inp, padding: '4px 6px', fontSize: 12, textAlign: 'right' }}
                              placeholder="0,00"
                            />
                          </td>
                          <td key={`frete-${f.id}-val`} style={{ padding: '8px 10px', color: '#64748B', textAlign: 'right', border: '1px solid #1E2235', fontSize: 12 }}>
                            {fmtBRL(f.frete)}
                          </td>
                        </>
                      ))}
                    </tr>

                    {/* Linha de total */}
                    <tr style={{ background: '#0D1020' }}>
                      <td colSpan={3} style={{ padding: '10px 12px', color: '#F1F5F9', fontWeight: 700, border: '1px solid #1E2235' }}>TOTAL EQUALIZADO</td>
                      {fornecedores.map(f => {
                        const total = totalFornecedor(f, itens, precos)
                        const isMelhor = f.id === melhorFornId && total > 0
                        return (
                          <td key={`total-${f.id}`} colSpan={4} style={{
                            padding: '10px 12px', textAlign: 'right', border: '1px solid #1E2235',
                            fontWeight: 700, fontSize: 14,
                            color: isMelhor ? '#10B981' : '#F1F5F9',
                            background: isMelhor ? '#064E3B33' : 'transparent',
                          }}>
                            {total > 0 ? fmtBRL(total) : '—'}
                            {isMelhor && <span style={{ fontSize: 10, marginLeft: 6, color: '#10B981' }}>🏆 Menor</span>}
                          </td>
                        )
                      })}
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* ── ABA FORNECEDORES ── */}
        {aba === 'fornecedores' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {fornecedores.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 0', color: '#334155' }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>🏢</div>
                <p style={{ color: '#475569', fontWeight: 600 }}>Nenhum fornecedor adicionado</p>
                <button onClick={addFornecedor} style={{ marginTop: 12, padding: '8px 18px', borderRadius: 7, border: 'none', background: '#1E3A5F', color: '#93C5FD', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>+ Adicionar fornecedor</button>
              </div>
            ) : fornecedores.map(f => (
              <div key={f.id} style={{ background: '#1A1D2E', border: '1px solid #1E2235', borderRadius: 12, padding: '16px 20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                  <div style={{ flex: 1, marginRight: 16 }}>
                    <label style={lbl}>Fornecedor</label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <select
                        style={{ ...inp, flex: 1 }}
                        value={f.fornecedor_id ?? ''}
                        onChange={e => selectFornFromCadastro(e.target.value, f.id)}
                      >
                        <option value="">— Selecionar do cadastro —</option>
                        {fornsList.map(fl => <option key={fl.id} value={fl.id}>{fl.nome}</option>)}
                      </select>
                      <span style={{ color: '#334155', fontSize: 12, alignSelf: 'center' }}>ou</span>
                      <input
                        style={{ ...inp, flex: 1 }}
                        value={f.fornecedor_nome}
                        onChange={e => updateFornecedor(f.id, 'fornecedor_nome', e.target.value)}
                        onBlur={() => criarOuVincularFornecedor(f)}
                        placeholder="Nome manual"
                      />
                    </div>
                  </div>
                  <button onClick={() => removeFornecedor(f.id)} style={{ background: 'none', border: '1px solid #450A0A', borderRadius: 6, color: '#FCA5A5', fontSize: 12, cursor: 'pointer', padding: '4px 8px' }}>Remover</button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={lbl}>Condição de pagamento</label>
                    <input style={inp} value={f.condicao_pagamento ?? ''} onChange={e => updateFornecedor(f.id, 'condicao_pagamento', e.target.value)} placeholder="Ex: 30/60/90 dias" />
                  </div>
                  <div>
                    <label style={lbl}>Prazo de entrega (dias)</label>
                    <input style={inp} type="number" min="0" value={f.prazo_entrega_dias ?? ''} onChange={e => updateFornecedor(f.id, 'prazo_entrega_dias', parseInt(e.target.value) || null)} placeholder="Ex: 15" />
                  </div>
                  <div>
                    <label style={lbl}>Frete (R$)</label>
                    <input style={inp} type="number" min="0" step="0.01" value={f.frete ?? ''} onChange={e => updateFornecedor(f.id, 'frete', parseFloat(e.target.value) || 0)} placeholder="0,00" />
                  </div>
                </div>

                <div style={{ marginTop: 12 }}>
                  <label style={lbl}>Observações</label>
                  <input style={inp} value={f.observacoes ?? ''} onChange={e => updateFornecedor(f.id, 'observacoes', e.target.value)} placeholder="Validade da proposta, condições especiais..." />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── ABA ITENS ── */}
        {aba === 'itens' && (
          <div>
            {itens.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 0', color: '#334155' }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>📦</div>
                <p style={{ color: '#475569', fontWeight: 600 }}>Nenhum item adicionado</p>
                <button onClick={addItem} style={{ marginTop: 12, padding: '8px 18px', borderRadius: 7, border: 'none', background: '#1E3A5F', color: '#93C5FD', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>+ Adicionar item</button>
              </div>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 28px', gap: 8, marginBottom: 8 }}>
                  {['Descrição', 'Unidade', 'Quantidade', ''].map(h => (
                    <div key={h} style={{ fontSize: 10, fontWeight: 700, color: '#334155', textTransform: 'uppercase' }}>{h}</div>
                  ))}
                </div>
                {itens.map(item => (
                  <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 28px', gap: 8, marginBottom: 8, position: 'relative' }}>
                    <div style={{ position: 'relative' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <input
                          style={{ ...inp, flex: 1 }}
                          value={item.descricao}
                          onChange={e => {
                            updateItem(item.id, 'descricao', e.target.value)
                            setInsumoSearch(e.target.value)
                            setShowInsumoSearch(item.id)
                          }}
                          onBlur={() => setTimeout(() => setShowInsumoSearch(null), 150)}
                          placeholder="Material ou serviço"
                        />
                        <button
                          onMouseDown={e => { e.preventDefault(); setShowInsumoSearch(showInsumoSearch === item.id ? null : item.id); setInsumoSearch('') }}
                          style={{ padding: '6px 10px', borderRadius: 7, border: '1px solid #1E3A5F', background: showInsumoSearch === item.id ? '#1E3A5F' : 'transparent', color: '#3B82F6', fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap' }}
                        >🔍</button>
                      </div>
                      {showInsumoSearch === item.id && (
                        <div
                          onMouseDown={e => e.preventDefault()}
                          style={{
                            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                            background: '#1A1D2E', border: '1px solid #1E2235', borderRadius: 8,
                            boxShadow: '0 8px 24px #00000080', maxHeight: 200, overflowY: 'auto',
                          }}>
                          <div style={{ padding: '6px 8px', borderBottom: '1px solid #1E2235' }}>
                            <input
                              style={{ ...inp, fontSize: 12, padding: '5px 8px' }}
                              placeholder="Buscar insumo..."
                              value={insumoSearch}
                              onChange={e => setInsumoSearch(e.target.value)}
                            />
                          </div>
                          {insumosFiltrados.length === 0 ? (
                            <div style={{ padding: '10px', fontSize: 12, color: '#334155', textAlign: 'center' }}>Nenhum insumo encontrado</div>
                          ) : insumosFiltrados.slice(0, 20).map(ins => (
                            <div
                              key={ins.id}
                              onMouseDown={() => {
                                updateItem(item.id, 'descricao', ins.nome)
                                updateItem(item.id, 'unidade', ins.unidade_compra ?? 'un')
                                setShowInsumoSearch(null)
                                setInsumoSearch('')
                              }}
                              style={{ padding: '7px 10px', cursor: 'pointer', borderBottom: '1px solid #161929', display: 'flex', justifyContent: 'space-between' }}
                              onMouseEnter={e => e.currentTarget.style.background = '#0F1117'}
                              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            >
                              <div>
                                <span style={{ fontSize: 10, color: '#3B82F6', fontFamily: 'monospace', marginRight: 6 }}>{ins.codigo}</span>
                                <span style={{ fontSize: 12, color: '#F1F5F9' }}>{ins.nome}</span>
                              </div>
                              <span style={{ fontSize: 11, color: '#475569', flexShrink: 0 }}>{ins.unidade_compra}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <input style={inp} value={item.unidade} onChange={e => updateItem(item.id, 'unidade', e.target.value)} />
                    <input style={inp} type="number" min="0" step="0.01" value={item.quantidade} onChange={e => updateItem(item.id, 'quantidade', e.target.value)} />
                    <button onClick={() => removeItem(item.id)} style={{ background: 'none', border: 'none', color: '#475569', fontSize: 18, cursor: 'pointer', padding: 0, alignSelf: 'center' }}>×</button>
                  </div>
                ))}
                <button onClick={addItem} style={{ marginTop: 8, padding: '7px 16px', borderRadius: 7, border: '1px solid #1E3A5F', background: 'transparent', color: '#3B82F6', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>+ Adicionar item</button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Modal de confirmação - equalização multi-fornecedor */}
      {importMultiModal && (
        <div style={{ position: 'fixed', inset: 0, background: '#00000095', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 16 }}>
          <div style={{ background: '#1A1D2E', border: '1px solid #1E2235', borderRadius: 16, width: 700, maxWidth: '95vw', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #1E2235' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#F1F5F9', marginBottom: 4 }}>✅ Planilha de equalização detectada</div>
              <div style={{ fontSize: 12, color: '#475569' }}>{importMultiModal.fornecedores.length} fornecedores · {importMultiModal.itens.length} itens — confirme antes de importar</div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>

              {/* Fornecedores */}
              <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 8, textTransform: 'uppercase' }}>Fornecedores</div>
              {importMultiModal.fornecedores.map((f, i) => {
                const cond = importMultiModal.condicoes[i] ?? {}
                return (
                  <div key={i} style={{ background: '#0F1117', border: '1px solid #1E2235', borderRadius: 8, padding: '10px 14px', marginBottom: 8, fontSize: 12 }}>
                    <div style={{ fontWeight: 700, color: '#F1F5F9', marginBottom: 4 }}>{f.nome}</div>
                    <div style={{ display: 'flex', gap: 16, color: '#64748B', fontSize: 11 }}>
                      <span>Pagamento: {cond.pagamento || '—'}</span>
                      <span>Frete: {cond.frete ? fmtBRL(cond.frete) : '—'}</span>
                      <span>Desconto: {cond.desconto ? fmtBRL(cond.desconto) : '—'}</span>
                    </div>
                  </div>
                )
              })}

              {/* Itens */}
              <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', marginTop: 14, marginBottom: 8, textTransform: 'uppercase' }}>{importMultiModal.itens.length} Itens</div>
              <div style={{ maxHeight: 240, overflowY: 'auto' }}>
                {importMultiModal.itens.map((it, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 50px 60px', gap: 8, marginBottom: 4, fontSize: 12 }}>
                    <div style={{ color: '#94A3B8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.descricao}</div>
                    <div style={{ color: '#64748B' }}>{it.unidade}</div>
                    <div style={{ color: '#64748B' }}>{it.quantidade}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ padding: '14px 24px', borderTop: '1px solid #1E2235', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setImportMultiModal(null)} style={{ padding: '8px 18px', borderRadius: 7, border: '1px solid #1E2235', background: 'transparent', color: '#64748B', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
              <button onClick={() => confirmarImportacaoMulti(importMultiModal)} style={{ padding: '8px 20px', borderRadius: 7, border: 'none', background: 'linear-gradient(135deg, #3B82F6, #6366F1)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                ✓ Importar {importMultiModal.fornecedores.length} fornecedores
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmação de importação */}
      {importModal && (
        <div style={{ position: 'fixed', inset: 0, background: '#00000095', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 16 }}>
          <div style={{ background: '#1A1D2E', border: '1px solid #1E2235', borderRadius: 16, width: 560, maxWidth: '95vw', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #1E2235' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#F1F5F9', marginBottom: 4 }}>✅ Cotação analisada</div>
              <div style={{ fontSize: 12, color: '#475569' }}>Confirme os dados extraídos antes de importar</div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
              {/* Dados do fornecedor */}
              <div style={{ background: '#0F1117', border: '1px solid #1E2235', borderRadius: 8, padding: '12px 14px', marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 8, textTransform: 'uppercase' }}>Fornecedor</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12 }}>
                  <div><span style={{ color: '#475569' }}>Nome: </span><span style={{ color: '#F1F5F9', fontWeight: 600 }}>{importModal.fornecedor_nome ?? '—'}</span></div>
                  <div><span style={{ color: '#475569' }}>Pagamento: </span><span style={{ color: '#F1F5F9' }}>{importModal.condicao_pagamento ?? '—'}</span></div>
                  <div><span style={{ color: '#475569' }}>Prazo: </span><span style={{ color: '#F1F5F9' }}>{importModal.prazo_entrega_dias ? `${importModal.prazo_entrega_dias} dias` : '—'}</span></div>
                  <div><span style={{ color: '#475569' }}>Frete: </span><span style={{ color: '#F1F5F9' }}>{importModal.frete ? fmtBRL(importModal.frete) : '—'}</span></div>
                </div>
                {importModal.observacoes && <div style={{ marginTop: 8, fontSize: 11, color: '#475569', fontStyle: 'italic' }}>{importModal.observacoes}</div>}
              </div>

              {/* Vincular a fornecedor existente */}
              {fornecedores.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#64748B', marginBottom: 4, display: 'block' }}>Vincular a fornecedor já cadastrado na cotação (opcional)</label>
                  <select
                    style={{ width: '100%', padding: '7px 10px', borderRadius: 7, border: '1px solid #1E2235', background: '#0F1117', color: '#F1F5F9', fontSize: 12, outline: 'none' }}
                    onChange={e => setImportModal(m => ({ ...m, _fornecedorId: e.target.value || null }))}
                  >
                    <option value="">— Criar novo fornecedor —</option>
                    {fornecedores.map(f => <option key={f.id} value={f.id}>{f.fornecedor_nome}</option>)}
                  </select>
                </div>
              )}

              {/* Itens */}
              <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 8, textTransform: 'uppercase' }}>{importModal.itens?.length ?? 0} Itens</div>
              {(importModal.itens ?? []).map((it, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 60px 80px 80px', gap: 8, marginBottom: 6, fontSize: 12 }}>
                  <div style={{ color: '#94A3B8' }}>{it.descricao}</div>
                  <div style={{ color: '#64748B' }}>{it.unidade}</div>
                  <div style={{ color: '#64748B' }}>{it.quantidade} un</div>
                  <div style={{ color: '#10B981', textAlign: 'right' }}>{fmtBRL(it.preco_unitario)}</div>
                </div>
              ))}
            </div>
            <div style={{ padding: '14px 24px', borderTop: '1px solid #1E2235', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setImportModal(null)} style={{ padding: '8px 18px', borderRadius: 7, border: '1px solid #1E2235', background: 'transparent', color: '#64748B', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
              <button onClick={() => confirmarImportacao(importModal, importModal._fornecedorId ?? null)} style={{ padding: '8px 20px', borderRadius: 7, border: 'none', background: 'linear-gradient(135deg, #3B82F6, #6366F1)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                ✓ Importar {importModal.itens?.length ?? 0} itens
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24,
          background: toast.type === 'loading' ? '#1E3A5F' : '#064E3B',
          border: `1px solid ${toast.type === 'loading' ? '#3B82F6' : '#065F46'}`,
          color: toast.type === 'loading' ? '#93C5FD' : '#6EE7B7',
          padding: '10px 18px', borderRadius: 10,
          fontSize: 13, fontWeight: 600, zIndex: 2000,
        }}>{toast.msg}</div>
      )}
    </div>
  )
}

// ── Componente principal ───────────────────────────────────────────────────
export default function Cotacoes({ session, permissoes }) {
  const [cotacoes,    setCotacoes]    = useState([])
  const [obras,       setObras]       = useState([])
  const [scs,         setScs]         = useState([])
  const [loading,     setLoading]     = useState(true)
  const [modal,       setModal]       = useState(false)
  const [detalhe,     setDetalhe]     = useState(null)
  const [filterObra,  setFilterObra]  = useState('all')
  const [filterStatus,setFilterStatus]= useState('all')

  useEffect(() => { init() }, [])

  async function init() {
    const [{ data: cotData }, { data: obrasData }, { data: scsData }] = await Promise.all([
      supabase.from('cotacoes').select('*, obra:obras(nome)').order('created_at', { ascending: false }),
      supabase.from('obras').select('id, nome').order('nome'),
      supabase.from('solicitacoes_compra').select('id, titulo, obra_id, status').eq('status', 'aprovada').order('created_at', { ascending: false }),
    ])
    setCotacoes(cotData ?? [])
    setObras(obrasData ?? [])
    setScs(scsData ?? [])
    setLoading(false)
  }

  async function handleCreate(form) {
    const { data } = await supabase.from('cotacoes').insert({
      ...form,
      sc_id: form.sc_id || null,
      owner_id: session.user.id,
    }).select('*, obra:obras(nome)').single()
    if (data) {
      // Se veio de SC, importa os itens automaticamente
      if (form.sc_id) {
        const { data: itensData } = await supabase.from('itens_solicitacao').select('*').eq('solicitacao_id', form.sc_id)
        if (itensData?.length) {
          await supabase.from('cotacao_itens').insert(
            itensData.map((it, idx) => ({
              cotacao_id: data.id,
              descricao: it.descricao,
              unidade: it.unidade,
              quantidade: it.quantidade,
              ordem: idx,
            }))
          )
        }
      }
      setCotacoes(cs => [data, ...cs])
      setModal(false)
      setDetalhe(data)
    }
  }

  const filtered = cotacoes.filter(c => {
    if (filterObra !== 'all' && c.obra_id !== filterObra) return false
    if (filterStatus !== 'all' && c.status !== filterStatus) return false
    return true
  })

  const stats = {
    aberta:     cotacoes.filter(c => c.status === 'aberta').length,
    finalizada: cotacoes.filter(c => c.status === 'finalizada').length,
  }

  if (detalhe) {
    return (
      <CotacaoDetalhe
        cotacao={detalhe}
        session={session}
        onBack={() => { setDetalhe(null); init() }}
        onUpdate={init}
      />
    )
  }

  const selStyle = {
    padding: '6px 12px', borderRadius: 7, border: '1px solid #1E2235',
    background: '#0F1117', color: '#94A3B8', fontSize: 12, outline: 'none', cursor: 'pointer',
  }

  return (
    <div style={{ flex: 1, padding: '28px', overflowY: 'auto', color: '#E2E8F0', fontFamily: "'DM Sans', sans-serif" }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#F1F5F9', marginBottom: 4 }}>Cotações</h1>
          <p style={{ fontSize: 13, color: '#475569' }}>Compare propostas de fornecedores e escolha as melhores condições.</p>
        </div>
        <button onClick={() => obras.length ? setModal(true) : alert('Cadastre ao menos uma obra primeiro.')} style={{
          padding: '9px 18px', borderRadius: 8, border: 'none',
          background: 'linear-gradient(135deg, #3B82F6, #6366F1)',
          color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer',
        }}>+ Nova Cotação</button>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { key: 'aberta',     label: 'Em andamento', icon: '📊', meta: STATUS_META.aberta },
          { key: 'finalizada', label: 'Finalizadas',  icon: '✅', meta: STATUS_META.finalizada },
        ].map(s => (
          <div key={s.key} onClick={() => setFilterStatus(f => f === s.key ? 'all' : s.key)} style={{
            background: filterStatus === s.key ? s.meta.bg : '#1A1D2E',
            border: `1px solid ${filterStatus === s.key ? s.meta.color + '40' : '#1E2235'}`,
            borderRadius: 10, padding: '12px 18px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{ fontSize: 20 }}>{s.icon}</span>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700, color: s.meta.color }}>{stats[s.key]}</div>
              <div style={{ fontSize: 11, color: '#475569' }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <select style={selStyle} value={filterObra} onChange={e => setFilterObra(e.target.value)}>
          <option value="all">Todas as obras</option>
          {obras.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
        </select>
        <select style={selStyle} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="all">Todos os status</option>
          {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        {(filterObra !== 'all' || filterStatus !== 'all') && (
          <button onClick={() => { setFilterObra('all'); setFilterStatus('all') }} style={{
            padding: '6px 12px', borderRadius: 7, border: '1px solid #334155',
            background: 'transparent', color: '#64748B', fontSize: 12, cursor: 'pointer',
          }}>Limpar filtros</button>
        )}
      </div>

      {/* Lista */}
      {loading ? (
        <p style={{ color: '#334155', fontSize: 14 }}>Carregando...</p>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#334155' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📊</div>
          <p style={{ fontSize: 15, fontWeight: 600, color: '#475569' }}>
            {cotacoes.length === 0 ? 'Nenhuma cotação criada' : 'Nenhuma cotação encontrada'}
          </p>
          <p style={{ fontSize: 13, color: '#334155', marginTop: 4 }}>
            {cotacoes.length === 0 ? 'Clique em "+ Nova Cotação" para começar.' : 'Tente ajustar os filtros.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(cot => {
            const smeta = STATUS_META[cot.status] ?? STATUS_META.aberta
            return (
              <div
                key={cot.id}
                onClick={() => setDetalhe(cot)}
                style={{
                  background: '#1A1D2E', border: '1px solid #1E2235', borderRadius: 10,
                  padding: '14px 18px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 14, transition: 'border-color 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = '#334155'}
                onMouseLeave={e => e.currentTarget.style.borderColor = '#1E2235'}
              >
                <div style={{
                  width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                  background: 'linear-gradient(135deg, #1E3A5F, #1E1B4B)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
                }}>📊</div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#F1F5F9', marginBottom: 3 }}>{cot.titulo}</div>
                  <div style={{ fontSize: 12, color: '#475569' }}>{cot.obra?.nome} • {fmtDate(cot.created_at)}</div>
                </div>

                {cot.sc_id && (
                  <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 6, background: '#1E3A5F', color: '#93C5FD', fontWeight: 600 }}>SC vinculada</span>
                )}

                <span style={{
                  padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                  background: smeta.bg, color: smeta.color,
                }}>{smeta.label}</span>

                <span style={{ fontSize: 18, color: '#334155' }}>›</span>
              </div>
            )
          })}
        </div>
      )}

      {modal && (
        <NovaCotacaoModal
          obras={obras}
          scs={scs}
          onSave={handleCreate}
          onClose={() => setModal(false)}
        />
      )}
    </div>
  )
}
