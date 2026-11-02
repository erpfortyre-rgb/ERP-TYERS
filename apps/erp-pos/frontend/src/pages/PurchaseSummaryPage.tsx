import { useEffect, useState, useCallback } from 'react'
import toast from 'react-hot-toast'
import { PurchaseSummary } from '../../wailsjs/go/main/App'

interface PurchaseSummaryRow {
  date: string
  orderCount: number
  totalPaise: number
}

const today = () => new Date().toISOString().slice(0, 10)
const fmt = (p: number) => (p / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })

export default function PurchaseSummaryPage() {
  const [rows, setRows] = useState<PurchaseSummaryRow[]>([])
  const [from, setFrom] = useState(today())
  const [to, setTo] = useState(today())

  const load = useCallback(async () => {
    try {
      const data = await PurchaseSummary(from, to) as any
      setRows(data || [])
    } catch (e: any) { toast.error(e?.message || 'Failed to load'); console.error(e) }
  }, [from, to])

  useEffect(() => { load() }, [load])

  const totalPurchases = rows.reduce((s, r) => s + r.totalPaise, 0)
  const totalOrders = rows.reduce((s, r) => s + r.orderCount, 0)

  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column', gap: 0, padding: 0 }}>
      <div style={{ background: 'var(--accent)', color: '#fff', padding: '10px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 600, fontSize: '1rem' }}>Purchase Summary</span>
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

      {/* Summary Cards */}
      <div style={{ display: 'flex', gap: 12, padding: '0 20px 12px' }}>
        <div style={{ flex: 1, background: 'var(--bg-card)', border: '1px solid var(--glass-border)', borderRadius: 8, padding: '12px 16px' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--fg-muted)', marginBottom: 4 }}>Total Purchases</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--accent)' }}>{fmt(totalPurchases)}</div>
        </div>
        <div style={{ flex: 1, background: 'var(--bg-card)', border: '1px solid var(--glass-border)', borderRadius: 8, padding: '12px 16px' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--fg-muted)', marginBottom: 4 }}>Order Count</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--success)' }}>{totalOrders}</div>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '0 20px' }}>
        <table>
          <thead>
            <tr>
              <th style={{ width: 50 }}>#</th>
              <th>Date</th>
              <th style={{ textAlign: 'right' }}>Orders</th>
              <th style={{ textAlign: 'right' }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td>{i + 1}</td>
                <td>{r.date}</td>
                <td style={{ textAlign: 'right' }}>{r.orderCount}</td>
                <td style={{ textAlign: 'right', fontWeight: 500 }}>{fmt(r.totalPaise)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={4} style={{ textAlign: 'center', padding: 40, color: 'var(--fg-muted)' }}>No purchase orders for selected period</td></tr>
            )}
          </tbody>
          <tfoot>
            <tr style={{ fontWeight: 700, background: 'var(--bg-card)' }}>
              <td colSpan={2} style={{ textAlign: 'right' }}>Total</td>
              <td style={{ textAlign: 'right' }}>{totalOrders}</td>
              <td style={{ textAlign: 'right' }}>{fmt(totalPurchases)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
