import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function FeedbackButton({ session }) {
  const [open,    setOpen]    = useState(false)
  const [msg,     setMsg]     = useState('')
  const [sending, setSending] = useState(false)
  const [sent,    setSent]    = useState(false)

  async function handleSend() {
    if (!msg.trim()) return
    setSending(true)
    await supabase.from('feedbacks').insert({
      user_id:   session?.user?.id,
      user_nome: session?.user?.user_metadata?.nome ?? session?.user?.email,
      mensagem:  msg.trim(),
      pagina:    window.location.pathname,
    })
    setSending(false)
    setSent(true)
    setMsg('')
    setTimeout(() => { setSent(false); setOpen(false) }, 2000)
  }

  return (
    <>
      {/* Botão flutuante */}
      <button
        onClick={() => setOpen(o => !o)}
        title="Reportar um problema"
        style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 900,
          width: 44, height: 44, borderRadius: '50%',
          background: 'linear-gradient(135deg, #3B82F6, #6366F1)',
          border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18, boxShadow: '0 4px 16px #00000060',
          transition: 'transform 0.15s',
        }}
        onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
      >
        🐛
      </button>

      {/* Modal */}
      {open && (
        <div style={{
          position: 'fixed', bottom: 80, right: 24, zIndex: 901,
          background: '#1A1D2E', border: '1px solid #1E2235',
          borderRadius: 14, padding: '18px 18px 14px',
          width: 300, boxShadow: '0 8px 32px #00000080',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#F1F5F9' }}>Reportar problema</span>
            <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: '#475569', fontSize: 18, cursor: 'pointer' }}>×</button>
          </div>

          {sent ? (
            <div style={{ textAlign: 'center', padding: '16px 0', color: '#10B981', fontSize: 13, fontWeight: 600 }}>
              ✓ Feedback enviado! Obrigado.
            </div>
          ) : (
            <>
              <textarea
                value={msg}
                onChange={e => setMsg(e.target.value)}
                placeholder="Descreva o problema encontrado..."
                style={{
                  width: '100%', minHeight: 90, padding: '9px 12px',
                  borderRadius: 8, border: '1px solid #1E2235',
                  background: '#0F1117', color: '#F1F5F9',
                  fontSize: 13, resize: 'vertical', outline: 'none',
                  fontFamily: 'inherit', marginBottom: 10,
                }}
              />
              <button
                onClick={handleSend}
                disabled={sending || !msg.trim()}
                style={{
                  width: '100%', padding: '9px', borderRadius: 8, border: 'none',
                  background: msg.trim() ? 'linear-gradient(135deg, #3B82F6, #6366F1)' : '#1E2235',
                  color: msg.trim() ? '#fff' : '#475569',
                  fontWeight: 700, fontSize: 13, cursor: msg.trim() ? 'pointer' : 'default',
                }}
              >
                {sending ? 'Enviando...' : 'Enviar'}
              </button>
            </>
          )}
        </div>
      )}
    </>
  )
}
