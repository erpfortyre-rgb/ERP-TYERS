import { useEffect, useState } from 'react'
import { FiTrash2, FiAlertTriangle } from 'react-icons/fi'

export interface ConfirmOpts {
  title?: string
  message?: string
  confirmText?: string
  cancelText?: string
  danger?: boolean
}

type Listener = (opts: ConfirmOpts | null) => void
let listener: Listener | null = null
let resolver: ((v: boolean) => void) | null = null

/** App-wide styled confirmation. Replaces window.confirm(). Returns true if confirmed. */
export function confirmAsk(opts: ConfirmOpts): Promise<boolean> {
  return new Promise(resolve => {
    if (!listener) { resolve(window.confirm(opts.message || opts.title || 'Are you sure?')); return }
    resolver = resolve
    listener(opts)
  })
}

/** Mount once near the app root. */
export function ConfirmHost() {
  const [opts, setOpts] = useState<ConfirmOpts | null>(null)
  useEffect(() => { listener = setOpts; return () => { listener = null } }, [])

  const close = (v: boolean) => { setOpts(null); const r = resolver; resolver = null; r?.(v) }
  if (!opts) return null
  const danger = opts.danger !== false
  const accent = danger ? '#ef4444' : 'var(--accent)'

  return (
    <div onClick={() => close(false)}
      onKeyDown={e => { if (e.key === 'Escape') close(false); if (e.key === 'Enter') close(true) }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000 }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '22px 24px', width: 400, maxWidth: '90vw', boxShadow: '0 12px 40px rgba(0,0,0,0.35)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: accent + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {danger ? <FiTrash2 size={18} color={accent} /> : <FiAlertTriangle size={18} color={accent} />}
          </div>
          <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--fg-bright)' }}>{opts.title || 'Are you sure?'}</div>
        </div>
        {opts.message && <div style={{ fontSize: '0.85rem', color: 'var(--fg-muted)', marginBottom: 18, lineHeight: 1.5 }}>{opts.message}</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={() => close(false)}
            style={{ padding: '8px 16px', background: 'var(--bg-input)', color: 'var(--fg)', border: '1px solid var(--border)', borderRadius: 7, cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>{opts.cancelText || 'Cancel'}</button>
          <button onClick={() => close(true)} autoFocus
            style={{ padding: '8px 18px', background: accent, color: '#fff', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: '0.85rem', fontWeight: 700 }}>{opts.confirmText || 'Confirm'}</button>
        </div>
      </div>
    </div>
  )
}
