import { useState, useCallback, useEffect } from 'react'
import toast from 'react-hot-toast'
import { BrandwiseSummary } from '../../wailsjs/go/main/App'

const today = () => new Date().toISOString().slice(0, 10)
const fmtQty = (m: number) => (m / 1000).toLocaleString('en-IN', { minimumFractionDigits: 1 })
const fmtAmt = (p: number) => (p / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })

export default function BrandwiseSummaryPage() {
  const [from, setFrom] = useState(today())
  const [to, setTo] = useState(today())
  const [data, setData] = useState<any[]>([])

  const load = useCallback(async () => {
    try {
      const d = await BrandwiseSummary(from, to); setData(d || [])
    } catch (e: any) { toast.error(e?.message || 'Failed to load'); console.error(e) }
  }, [from, to])

  useEffect(() => { load() }, [load])

  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column', gap: 0, padding: 0 }}>
      <div style={{ background: 'var(--accent)', color: '#fff', padding: '10px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 600, fontSize: '1rem' }}>Brandwise Summary</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-sm" style={{ background: 'var(--bg-card)', color: 'var(--fg)' }}>Print</button>
          <button className="btn btn-sm" style={{ background: 'var(--success)', color: '#fff' }}>Export</button>
        </div>
      </div>

      <div style={{ padding: '12px 20px', display: 'flex', gap: 12, alignItems: 'center' }}>
        <label style={{ fontSize: '0.85rem', fontWeight: 500 }}>From:</label>
        <input type="date" value={from} onChange={e => setFrom(e.target.value)}
          style={{ padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--bg-input)', color: 'var(--fg)' }} />
        <label style={{ fontSize: '0.85rem', fontWeight: 500 }}>To:</label>
        <input type="date" value={to} onChange={e => setTo(e.target.value)}
          style={{ padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--bg-input)', color: 'var(--fg)' }} />
        <button className="btn btn-primary btn-sm" onClick={load}>Search</button>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '0 20px' }}>
        <table>
          <thead>
            <tr>
              <th>Brand</th>
              <th style={{ textAlign: 'right' }}>Sale Qty</th>
              <th style={{ textAlign: 'right' }}>Sale Amount</th>
              <th style={{ textAlign: 'right' }}>Purchase Qty</th>
              <th style={{ textAlign: 'right' }}>Purchase Amount</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row: any, i: number) => (
              <tr key={i}>
                <td>{row.brandName}</td>
                <td style={{ textAlign: 'right' }}>{fmtQty(row.saleQtyMillis)}</td>
                <td style={{ textAlign: 'right' }}>{fmtAmt(row.saleAmountPaise)}</td>
                <td style={{ textAlign: 'right' }}>{fmtQty(row.purchQtyMillis)}</td>
                <td style={{ textAlign: 'right' }}>{fmtAmt(row.purchAmountPaise)}</td>
              </tr>
            ))}
            {data.length === 0 && (
              <tr><td colSpan={5} style={{ textAlign: 'center', padding: 40, color: 'var(--fg-muted)' }}>No data available</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
