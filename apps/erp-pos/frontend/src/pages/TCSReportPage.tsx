import { useState, useCallback, useEffect } from 'react'
import toast from 'react-hot-toast'
import { TCSReport } from '../../wailsjs/go/main/App'
import DateRangePicker from '../components/DateRangePicker'

const today = () => new Date().toISOString().slice(0, 10)
const firstOfMonth = () => { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10) }
const fmtAmt = (p: number) => (p / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })

const th: React.CSSProperties = { padding: '8px 10px', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '2px solid var(--border)' }

export default function TCSReportPage() {
  const [from, setFrom] = useState(firstOfMonth())
  const [to, setTo] = useState(today())
  const [showPicker, setShowPicker] = useState(false)
  const [data, setData] = useState<any[]>([])

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'F2' && !showPicker) { e.preventDefault(); setShowPicker(true) } }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [showPicker])

  const load = useCallback(async () => {
    try {
      const d = await TCSReport(from, to)
      setData(d || [])
    } catch (e: any) { toast.error(e?.message || 'Failed to load'); console.error(e) }
  }, [from, to])

  useEffect(() => { load() }, [load])

  const totalAmount = data.reduce((s, i) => s + (i.amountPaise || 0), 0)
  const totalTCS = data.reduce((s, i) => s + (i.taxAmountPaise || 0), 0)

  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column', gap: 0, padding: 0, height: '100%' }}>
      <div style={{ background: 'var(--accent)', color: '#fff', padding: '10px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <span style={{ fontWeight: 700, fontSize: '1rem' }}>TCS Report</span>
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
          <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>TCS Report</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--fg-muted)' }}>For the period {from} to {to}</div>
        </div>

        {data.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--fg-muted)', fontSize: '0.9rem' }}>No data for this period.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: 'var(--bg-sidebar)', position: 'sticky', top: 0, zIndex: 1 }}>
                <th style={{ ...th, textAlign: 'left', width: 130 }}>Invoice No</th>
                <th style={{ ...th, textAlign: 'left', width: 110 }}>Date</th>
                <th style={{ ...th, textAlign: 'left' }}>Customer</th>
                <th style={{ ...th, textAlign: 'right', width: 140 }}>Amount (₹)</th>
                <th style={{ ...th, textAlign: 'right', width: 90 }}>TCS %</th>
                <th style={{ ...th, textAlign: 'right', width: 140 }}>TCS Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              {data.map((item, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '7px 10px' }}>{item.invoiceNo}</td>
                  <td style={{ padding: '7px 10px', fontVariantNumeric: 'tabular-nums' }}>{item.date}</td>
                  <td style={{ padding: '7px 10px' }}>{item.customerName}</td>
                  <td style={{ padding: '7px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmtAmt(item.amountPaise || 0)}</td>
                  <td style={{ padding: '7px 10px', textAlign: 'right' }}>{item.taxPercent}%</td>
                  <td style={{ padding: '7px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmtAmt(item.taxAmountPaise || 0)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: 'var(--bg-sidebar)', fontWeight: 700, borderTop: '2px solid var(--border)' }}>
                <td colSpan={3} style={{ padding: '9px 10px', textAlign: 'right' }}>Total ({data.length} invoices)</td>
                <td style={{ padding: '9px 10px', textAlign: 'right' }}>₹{fmtAmt(totalAmount)}</td>
                <td></td>
                <td style={{ padding: '9px 10px', textAlign: 'right', color: 'var(--accent)' }}>₹{fmtAmt(totalTCS)}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      {showPicker && <DateRangePicker initialFrom={from} initialTo={to} onApply={(f, t) => { setFrom(f); setTo(t); setShowPicker(false) }} onClose={() => setShowPicker(false)} />}
    </div>
  )
}
