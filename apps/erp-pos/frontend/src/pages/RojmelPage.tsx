import { useState, useCallback, useEffect } from 'react'
import toast from 'react-hot-toast'
import { Rojmel } from '../../wailsjs/go/main/App'

const today = () => new Date().toISOString().slice(0, 10)
const fmtAmt = (p: number) => (p / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })

const th: React.CSSProperties = { padding: '8px 10px', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '2px solid var(--border)' }

// Backend entry fields (verified in the previous page): date, particulars, voucherNo,
// receiptPaise (Debit/cash in), paymentPaise (Credit/cash out), balancePaise.
// debitPaise / creditPaise are accepted as fallbacks.
const dr = (i: any): number => i.receiptPaise ?? i.debitPaise ?? 0
const cr = (i: any): number => i.paymentPaise ?? i.creditPaise ?? 0

export default function RojmelPage() {
  const [date, setDate] = useState(today())
  const [data, setData] = useState<any[]>([])
  const [openingBalance, setOpeningBalance] = useState(0)

  const load = useCallback(async () => {
    try {
      const d: any = await Rojmel(date)
      setData(d?.entries || [])
      setOpeningBalance(d?.openingBalancePaise || 0)
    } catch (e: any) { toast.error(e?.message || 'Failed to load'); console.error(e) }
  }, [date])

  useEffect(() => { load() }, [load])

  const totalDr = data.reduce((s, i) => s + dr(i), 0)
  const totalCr = data.reduce((s, i) => s + cr(i), 0)
  const closing = openingBalance + totalDr - totalCr

  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column', gap: 0, padding: 0, height: '100%' }}>
      <div style={{ background: 'var(--accent)', color: '#fff', padding: '10px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <span style={{ fontWeight: 700, fontSize: '1rem' }}>Rojmel (Daily Cash Book)</span>
        <button onClick={() => window.print()} style={{ padding: '5px 12px', background: '#fff', color: 'var(--accent)', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700 }}>Print</button>
      </div>

      <div style={{ padding: '10px 20px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', flexShrink: 0 }}>
        <label style={{ fontSize: '0.8rem', color: 'var(--fg-muted)', fontWeight: 600 }}>Date</label>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 5, fontSize: '0.82rem', background: 'var(--bg-input)', color: 'var(--fg)' }} />
        <button onClick={load} style={{ padding: '5px 14px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 5, cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700 }}>Show Report</button>
      </div>

      <div style={{ display: 'flex', gap: 12, padding: '12px 20px', flexShrink: 0, flexWrap: 'wrap' }}>
        {[
          { label: 'Opening Balance', value: openingBalance, color: 'var(--accent)' },
          { label: 'Total Debit', value: totalDr, color: '#16a34a' },
          { label: 'Total Credit', value: totalCr, color: '#ef4444' },
          { label: 'Closing Balance', value: closing, color: 'var(--accent)' },
        ].map(c => (
          <div key={c.label} style={{ flex: '1 1 140px', background: 'var(--bg-card)', border: `1px solid var(--border)`, borderRadius: 8, padding: '10px 14px' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--fg-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{c.label}</div>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: c.color, marginTop: 2 }}>₹{fmtAmt(c.value)}</div>
          </div>
        ))}
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '0 20px 16px' }}>
        {data.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--fg-muted)', fontSize: '0.9rem' }}>No data for this period.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: 'var(--bg-sidebar)', position: 'sticky', top: 0, zIndex: 1 }}>
                <th style={{ ...th, textAlign: 'left', width: 100 }}>Date</th>
                <th style={{ ...th, textAlign: 'left' }}>Particulars</th>
                <th style={{ ...th, textAlign: 'left', width: 120 }}>Voucher No</th>
                <th style={{ ...th, textAlign: 'right', width: 130 }}>Debit (₹)</th>
                <th style={{ ...th, textAlign: 'right', width: 130 }}>Credit (₹)</th>
                <th style={{ ...th, textAlign: 'right', width: 140 }}>Balance (₹)</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-card)', fontWeight: 600 }}>
                <td style={{ padding: '7px 10px' }}>{date}</td>
                <td style={{ padding: '7px 10px' }} colSpan={4}>Opening Balance</td>
                <td style={{ padding: '7px 10px', textAlign: 'right' }}>{fmtAmt(openingBalance)}</td>
              </tr>
              {data.map((item, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '7px 10px', fontVariantNumeric: 'tabular-nums' }}>{item.date}</td>
                  <td style={{ padding: '7px 10px' }}>{item.particulars}</td>
                  <td style={{ padding: '7px 10px', color: 'var(--fg-muted)' }}>{item.voucherNo || ''}</td>
                  <td style={{ padding: '7px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{dr(item) ? fmtAmt(dr(item)) : ''}</td>
                  <td style={{ padding: '7px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{cr(item) ? fmtAmt(cr(item)) : ''}</td>
                  <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{fmtAmt(item.balancePaise || 0)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: 'var(--bg-sidebar)', fontWeight: 700, borderTop: '2px solid var(--border)' }}>
                <td colSpan={3} style={{ padding: '9px 10px', textAlign: 'right' }}>Total</td>
                <td style={{ padding: '9px 10px', textAlign: 'right' }}>{fmtAmt(totalDr)}</td>
                <td style={{ padding: '9px 10px', textAlign: 'right' }}>{fmtAmt(totalCr)}</td>
                <td style={{ padding: '9px 10px', textAlign: 'right', color: 'var(--accent)' }}>₹{fmtAmt(closing)}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  )
}
