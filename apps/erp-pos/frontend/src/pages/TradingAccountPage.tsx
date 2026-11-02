import { useState, useCallback, useEffect } from 'react'
import toast from 'react-hot-toast'
import { TradingAccount } from '../../wailsjs/go/main/App'
import DateRangePicker from '../components/DateRangePicker'

interface Item { account: string; amountPaise: number }

const today = () => new Date().toISOString().slice(0, 10)
const firstOfMonth = () => { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10) }
const fmtAmt = (p: number) => (p / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })

const th: React.CSSProperties = { padding: '8px 10px', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '2px solid var(--border)', background: 'var(--bg-sidebar)' }
const td: React.CSSProperties = { padding: '7px 10px', borderBottom: '1px solid var(--border)', fontSize: '0.85rem' }

export default function TradingAccountPage() {
  const [from, setFrom] = useState(firstOfMonth())
  const [to, setTo] = useState(today())
  const [showPicker, setShowPicker] = useState(false)
  const [debit, setDebit] = useState<Item[]>([])
  const [credit, setCredit] = useState<Item[]>([])

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'F2' && !showPicker) { e.preventDefault(); setShowPicker(true) } }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [showPicker])

  const load = useCallback(async () => {
    try {
      const d: any = await TradingAccount(from, to)
      setDebit(d?.debitItems || [])
      setCredit(d?.creditItems || [])
    } catch (e: any) { toast.error(e?.message || 'Failed to load'); console.error(e) }
  }, [from, to])

  useEffect(() => { load() }, [load])

  const totalDebit = debit.reduce((s, i) => s + (i.amountPaise || 0), 0)
  const totalCredit = credit.reduce((s, i) => s + (i.amountPaise || 0), 0)
  const gross = totalCredit - totalDebit
  const rows = Math.max(debit.length, credit.length)
  const isEmpty = debit.length === 0 && credit.length === 0
  const grandTotal = Math.max(totalDebit, totalCredit)

  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column', gap: 0, padding: 0, height: '100%' }}>
      <div style={{ background: 'var(--accent)', color: '#fff', padding: '10px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <span style={{ fontWeight: 700, fontSize: '1rem' }}>Trading Account</span>
        <button onClick={() => window.print()} style={{ padding: '5px 12px', background: '#fff', color: 'var(--accent)', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700 }}>Print</button>
      </div>

      <div style={{ padding: '10px 20px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', flexShrink: 0 }}>
        <label style={{ fontSize: '0.8rem', color: 'var(--fg-muted)', fontWeight: 600 }}>From</label>
        <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={{ padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 5, fontSize: '0.82rem', background: 'var(--bg-input)', color: 'var(--fg)' }} />
        <label style={{ fontSize: '0.8rem', color: 'var(--fg-muted)', fontWeight: 600 }}>To</label>
        <input type="date" value={to} onChange={e => setTo(e.target.value)} style={{ padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 5, fontSize: '0.82rem', background: 'var(--bg-input)', color: 'var(--fg)' }} />
        <button onClick={() => setShowPicker(true)} title="Pick date range (F2)"
          style={{ padding: '5px 12px', borderRadius: 5, fontSize: '0.8rem', fontWeight: 600, background: 'var(--accent)15', color: 'var(--accent)', border: '1px solid var(--accent)44', cursor: 'pointer' }}>
          📅 Range (F2)
        </button>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px' }}>
        <div style={{ textAlign: 'center', marginBottom: 14 }}>
          <div style={{ fontWeight: 700, fontSize: '1.15rem', color: 'var(--fg-bright)' }}>Shiv Shankar Tyres</div>
          <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Trading Account</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--fg-muted)' }}>For the period {from} to {to}</div>
        </div>

        {isEmpty ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--fg-muted)', fontSize: '0.9rem' }}>No data for this period.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid var(--border)' }}>
            <thead>
              <tr>
                <th style={{ ...th, textAlign: 'left' }}>Particular (Dr.)</th>
                <th style={{ ...th, textAlign: 'right', width: 150, borderRight: '2px solid var(--border)' }}>Amount (₹)</th>
                <th style={{ ...th, textAlign: 'left' }}>Particular (Cr.)</th>
                <th style={{ ...th, textAlign: 'right', width: 150 }}>Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: rows }).map((_, i) => (
                <tr key={i}>
                  <td style={td}>{debit[i]?.account || ''}</td>
                  <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', borderRight: '2px solid var(--border)' }}>{debit[i] ? fmtAmt(debit[i].amountPaise) : ''}</td>
                  <td style={td}>{credit[i]?.account || ''}</td>
                  <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{credit[i] ? fmtAmt(credit[i].amountPaise) : ''}</td>
                </tr>
              ))}
              <tr style={{ background: gross >= 0 ? '#16a34a18' : '#ef444418', fontWeight: 700 }}>
                <td style={td}>{gross >= 0 ? 'Gross Profit c/d' : ''}</td>
                <td style={{ ...td, textAlign: 'right', borderRight: '2px solid var(--border)', color: '#16a34a' }}>{gross > 0 ? fmtAmt(gross) : ''}</td>
                <td style={td}>{gross < 0 ? 'Gross Loss c/d' : ''}</td>
                <td style={{ ...td, textAlign: 'right', color: '#ef4444' }}>{gross < 0 ? fmtAmt(-gross) : ''}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr style={{ background: 'var(--bg-sidebar)', fontWeight: 700, borderTop: '2px solid var(--border)' }}>
                <td style={{ padding: '9px 10px' }}>Total</td>
                <td style={{ padding: '9px 10px', textAlign: 'right', borderRight: '2px solid var(--border)' }}>{fmtAmt(grandTotal)}</td>
                <td style={{ padding: '9px 10px' }}>Total</td>
                <td style={{ padding: '9px 10px', textAlign: 'right' }}>{fmtAmt(grandTotal)}</td>
              </tr>
            </tfoot>
          </table>
        )}

        {!isEmpty && (
          <div style={{ marginTop: 16, padding: '12px 16px', background: 'var(--bg-card)', border: `1px solid ${gross >= 0 ? '#16a34a55' : '#ef444455'}`, borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 700, color: 'var(--fg-bright)' }}>{gross >= 0 ? 'Gross Profit' : 'Gross Loss'}</span>
            <span style={{ fontWeight: 700, fontSize: '1.15rem', color: gross >= 0 ? '#16a34a' : '#ef4444' }}>₹{fmtAmt(Math.abs(gross))}</span>
          </div>
        )}
      </div>

      {showPicker && <DateRangePicker initialFrom={from} initialTo={to} onApply={(f, t) => { setFrom(f); setTo(t); setShowPicker(false) }} onClose={() => setShowPicker(false)} />}
    </div>
  )
}
