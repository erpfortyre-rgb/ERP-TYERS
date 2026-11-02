import { useState, useCallback, useEffect } from 'react'
import toast from 'react-hot-toast'
import { TrialBalance } from '../../wailsjs/go/main/App'

const today = () => new Date().toISOString().slice(0, 10)
const fmtAmt = (p: number) => (p / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })

const th: React.CSSProperties = { padding: '8px 10px', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '2px solid var(--border)' }

export default function TrialBalancePage() {
  const [asOf, setAsOf] = useState(today())
  const [data, setData] = useState<any[]>([])

  const load = useCallback(async () => {
    try {
      const d: any = await TrialBalance(asOf)
      setData(d || [])
    } catch (e: any) { toast.error(e?.message || 'Failed to load'); console.error(e) }
  }, [asOf])

  useEffect(() => { load() }, [load])

  const totalDr = data.reduce((s, i) => s + (i.debitPaise || 0), 0)
  const totalCr = data.reduce((s, i) => s + (i.creditPaise || 0), 0)
  const balanced = totalDr === totalCr

  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column', gap: 0, padding: 0, height: '100%' }}>
      <div style={{ background: 'var(--accent)', color: '#fff', padding: '10px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <span style={{ fontWeight: 700, fontSize: '1rem' }}>Trial Balance</span>
        <button onClick={() => window.print()} style={{ padding: '5px 12px', background: '#fff', color: 'var(--accent)', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700 }}>Print</button>
      </div>

      <div style={{ padding: '10px 20px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', flexShrink: 0 }}>
        <label style={{ fontSize: '0.8rem', color: 'var(--fg-muted)', fontWeight: 600 }}>As on Date</label>
        <input type="date" value={asOf} onChange={e => setAsOf(e.target.value)} style={{ padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 5, fontSize: '0.82rem', background: 'var(--bg-input)', color: 'var(--fg)' }} />
        <button onClick={load} style={{ padding: '5px 14px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 5, cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700 }}>Show Report</button>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px' }}>
        <div style={{ textAlign: 'center', marginBottom: 14 }}>
          <div style={{ fontWeight: 700, fontSize: '1.15rem', color: 'var(--fg-bright)' }}>Shiv Shankar Tyres</div>
          <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Trial Balance</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--fg-muted)' }}>As on {asOf}</div>
        </div>

        {data.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--fg-muted)', fontSize: '0.9rem' }}>No data for this period.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: 'var(--bg-sidebar)', position: 'sticky', top: 0, zIndex: 1 }}>
                <th style={{ ...th, textAlign: 'left' }}>Account Name</th>
                <th style={{ ...th, textAlign: 'right', width: 160 }}>Debit (₹)</th>
                <th style={{ ...th, textAlign: 'right', width: 160 }}>Credit (₹)</th>
              </tr>
            </thead>
            <tbody>
              {data.map((r, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '7px 10px' }}>{r.accountName}</td>
                  <td style={{ padding: '7px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{r.debitPaise ? fmtAmt(r.debitPaise) : ''}</td>
                  <td style={{ padding: '7px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{r.creditPaise ? fmtAmt(r.creditPaise) : ''}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: 'var(--bg-sidebar)', fontWeight: 700, borderTop: '2px solid var(--border)' }}>
                <td style={{ padding: '9px 10px' }}>Total</td>
                <td style={{ padding: '9px 10px', textAlign: 'right', color: 'var(--accent)' }}>₹{fmtAmt(totalDr)}</td>
                <td style={{ padding: '9px 10px', textAlign: 'right', color: 'var(--accent)' }}>₹{fmtAmt(totalCr)}</td>
              </tr>
              {!balanced && (
                <tr>
                  <td colSpan={3} style={{ padding: '8px 10px', textAlign: 'right', color: '#ef4444', fontSize: '0.8rem', fontWeight: 600 }}>
                    Difference: ₹{fmtAmt(Math.abs(totalDr - totalCr))} ({totalDr > totalCr ? 'Debit' : 'Credit'} higher)
                  </td>
                </tr>
              )}
            </tfoot>
          </table>
        )}
      </div>
    </div>
  )
}
