import { useEffect, useState, useCallback } from 'react'
import toast from 'react-hot-toast'
import { FiRefreshCw, FiMessageCircle } from 'react-icons/fi'
import { PaymentReminders, GetSettings, GetFirmProfile } from '../../wailsjs/go/main/App'
import { BrowserOpenURL } from '../../wailsjs/runtime/runtime'

interface UdhaarRow {
  customerId: string; name: string; phone: string; bills: number
  days0_30Paise: number; days31_60Paise: number; days61_90Paise: number; days90PlusPaise: number
  totalDuePaise: number; oldestDays: number
}

const fmt = (p: number) => '₹' + ((p || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })
const cell = (p: number) => p > 0 ? fmt(p) : '—'

const th: React.CSSProperties = { padding: '8px 12px', textAlign: 'right', fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '2px solid var(--border)' }

export default function PaymentRemindersPage() {
  const [rows, setRows] = useState<UdhaarRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [business, setBusiness] = useState('Shiv Shankar Tyres')

  const load = useCallback(async () => {
    try {
      const [r, s, firm] = await Promise.all([
        PaymentReminders(),
        GetSettings().catch(() => ({} as any)),
        GetFirmProfile().catch(() => null as any),
      ])
      setRows((r as any) || [])
      setSettings((s as any) || {})
      if (firm && firm.name) setBusiness(firm.name)
    } catch (e: any) { toast.error(e?.message || 'Failed to load') }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  const filtered = rows.filter(r =>
    !search || r.name.toLowerCase().includes(search.toLowerCase()) || (r.phone || '').includes(search))

  const totalDue = filtered.reduce((s, r) => s + r.totalDuePaise, 0)

  const sendWhatsApp = (r: UdhaarRow) => {
    const phone = (r.phone || '').replace(/\D/g, '')
    if (phone.length < 10) { toast.error('No valid mobile number for this party'); return }
    const waNumber = phone.length === 10 ? '91' + phone : phone
    const tmpl = settings.payment_reminder_message ||
      'Namaste {name} ji,\nAapka {business} me ₹{due} baaki hai.\nKripya jaldi bhugtan karein.\nDhanyavaad 🙏'
    const upiId = settings.upi_id || ''
    const msg = tmpl
      .replace(/\{name\}/g, r.name)
      .replace(/\{business\}/g, business)
      .replace(/\{due\}/g, ((r.totalDuePaise || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 }))
      .replace(/\{phone\}/g, r.phone || '')
      .replace(/\{upi_link\}/g, upiId ? `upi://pay?pa=${upiId}&am=${((r.totalDuePaise || 0) / 100).toFixed(2)}` : '')
    const url = `https://wa.me/${waNumber}?text=${encodeURIComponent(msg)}`
    try { BrowserOpenURL(url) } catch { window.open(url, '_blank') }
  }

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--fg-bright)', marginBottom: 2 }}>Payment Reminders (Udhaar)</h2>
          <div style={{ fontSize: '0.78rem', color: 'var(--fg-muted)' }}>Who owes you, how old the dues are, and one-click WhatsApp reminders.</div>
        </div>
        <button onClick={load} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', background: 'var(--bg-card)', color: 'var(--fg)', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}>
          <FiRefreshCw size={13} /> Refresh
        </button>
      </div>

      {/* Summary card + search */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ background: 'var(--bg-card)', border: '1px solid #16a34a44', borderRadius: 8, padding: '10px 18px' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--fg-muted)', fontWeight: 600, textTransform: 'uppercase' }}>You'll Receive</div>
          <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#16a34a' }}>{fmt(totalDue)}</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--fg-muted)' }}>{filtered.length} parties with dues</div>
        </div>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search party / mobile…"
          style={{ flex: '1 1 200px', maxWidth: 320, padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-input)', color: 'var(--fg)', fontSize: '0.85rem' }} />
      </div>

      <div style={{ overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
          <thead>
            <tr style={{ background: 'var(--bg-sidebar)' }}>
              <th style={{ ...th, textAlign: 'left' }}>Party</th>
              <th style={{ ...th, textAlign: 'left' }}>Mobile</th>
              <th style={{ ...th, textAlign: 'center', width: 60 }}>Bills</th>
              <th style={th}>0-30 d</th>
              <th style={th}>31-60 d</th>
              <th style={th}>61-90 d</th>
              <th style={th}>90+ d</th>
              <th style={{ ...th, color: 'var(--fg-bright)' }}>Total Due</th>
              <th style={{ ...th, textAlign: 'center', width: 120 }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => (
              <tr key={r.customerId} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '9px 12px', fontWeight: 600 }}>
                  {r.name}
                  {r.oldestDays > 0 && <span style={{ marginLeft: 6, fontSize: '0.7rem', color: 'var(--fg-muted)' }}>oldest {r.oldestDays}d</span>}
                </td>
                <td style={{ padding: '9px 12px', fontVariantNumeric: 'tabular-nums', color: 'var(--fg-muted)' }}>{r.phone || '—'}</td>
                <td style={{ padding: '9px 12px', textAlign: 'center' }}>{r.bills}</td>
                <td style={{ padding: '9px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{cell(r.days0_30Paise)}</td>
                <td style={{ padding: '9px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#d97706' }}>{cell(r.days31_60Paise)}</td>
                <td style={{ padding: '9px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#ea580c' }}>{cell(r.days61_90Paise)}</td>
                <td style={{ padding: '9px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#dc2626', fontWeight: 600 }}>{cell(r.days90PlusPaise)}</td>
                <td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 700, color: '#16a34a', fontVariantNumeric: 'tabular-nums' }}>{fmt(r.totalDuePaise)}</td>
                <td style={{ padding: '9px 12px', textAlign: 'center' }}>
                  <button onClick={() => sendWhatsApp(r)} title="Send WhatsApp reminder"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 12px', background: '#25D366', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700 }}>
                    <FiMessageCircle size={13} /> WhatsApp
                  </button>
                </td>
              </tr>
            ))}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={9} style={{ textAlign: 'center', padding: 44, color: 'var(--fg-muted)' }}>
                No outstanding dues. Everyone is paid up! 🎉
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
