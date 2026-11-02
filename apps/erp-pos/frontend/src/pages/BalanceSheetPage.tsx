import { useState, useCallback, useEffect } from 'react'
import toast from 'react-hot-toast'
import { BalanceSheet } from '../../wailsjs/go/main/App'

interface Item { account: string; amountPaise: number }

const today = () => new Date().toISOString().slice(0, 10)
const fmtAmt = (p: number) => (p / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })

const th: React.CSSProperties = { padding: '8px 10px', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '2px solid var(--border)', background: 'var(--bg-sidebar)' }
const td: React.CSSProperties = { padding: '7px 10px', borderBottom: '1px solid var(--border)', fontSize: '0.85rem' }

export default function BalanceSheetPage() {
  const [asOf, setAsOf] = useState(today())
  const [liabilities, setLiabilities] = useState<Item[]>([])
  const [assets, setAssets] = useState<Item[]>([])

  const load = useCallback(async () => {
    try {
      const d: any = await BalanceSheet(asOf)
      setLiabilities(d?.liabilities || [])
      setAssets(d?.assets || [])
    } catch (e: any) { toast.error(e?.message || 'Failed to load'); console.error(e) }
  }, [asOf])

  useEffect(() => { load() }, [load])

  const totalL = liabilities.reduce((s, i) => s + (i.amountPaise || 0), 0)
  const totalA = assets.reduce((s, i) => s + (i.amountPaise || 0), 0)
  const rows = Math.max(liabilities.length, assets.length)
  const isEmpty = liabilities.length === 0 && assets.length === 0
  const balanced = totalL === totalA

  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column', gap: 0, padding: 0, height: '100%' }}>
      <div style={{ background: 'var(--accent)', color: '#fff', padding: '10px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <span style={{ fontWeight: 700, fontSize: '1rem' }}>Balance Sheet</span>
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
          <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Balance Sheet</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--fg-muted)' }}>As on {asOf}</div>
        </div>

        {isEmpty ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--fg-muted)', fontSize: '0.9rem' }}>No data for this period.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid var(--border)' }}>
            <thead>
              <tr>
                <th style={{ ...th, textAlign: 'left' }}>Liabilities</th>
                <th style={{ ...th, textAlign: 'right', width: 150, borderRight: '2px solid var(--border)' }}>Amount (₹)</th>
                <th style={{ ...th, textAlign: 'left' }}>Assets</th>
                <th style={{ ...th, textAlign: 'right', width: 150 }}>Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: rows }).map((_, i) => (
                <tr key={i}>
                  <td style={td}>{liabilities[i]?.account || ''}</td>
                  <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', borderRight: '2px solid var(--border)' }}>{liabilities[i] ? fmtAmt(liabilities[i].amountPaise) : ''}</td>
                  <td style={td}>{assets[i]?.account || ''}</td>
                  <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{assets[i] ? fmtAmt(assets[i].amountPaise) : ''}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: 'var(--bg-sidebar)', fontWeight: 700, borderTop: '2px solid var(--border)' }}>
                <td style={{ padding: '9px 10px' }}>Total Liabilities</td>
                <td style={{ padding: '9px 10px', textAlign: 'right', borderRight: '2px solid var(--border)', color: 'var(--accent)' }}>₹{fmtAmt(totalL)}</td>
                <td style={{ padding: '9px 10px' }}>Total Assets</td>
                <td style={{ padding: '9px 10px', textAlign: 'right', color: 'var(--accent)' }}>₹{fmtAmt(totalA)}</td>
              </tr>
            </tfoot>
          </table>
        )}

        {!isEmpty && !balanced && (
          <div style={{ marginTop: 12, color: '#ef4444', fontSize: '0.82rem', fontWeight: 600, textAlign: 'right' }}>
            Difference: ₹{fmtAmt(Math.abs(totalL - totalA))} ({totalL > totalA ? 'Liabilities' : 'Assets'} higher)
          </div>
        )}
      </div>
    </div>
  )
}
