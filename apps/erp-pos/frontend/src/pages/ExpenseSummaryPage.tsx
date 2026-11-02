import { useEffect, useState, useCallback } from 'react'
import toast from 'react-hot-toast'
import { ExpenseSummary } from '../../wailsjs/go/main/App'

interface SummaryRow { label: string; countOrQty: number; amountPaise: number }

const today = () => new Date().toISOString().slice(0, 10)
const firstOfMonth = () => { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10) }
const fmt = (p: number) => (p / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })

export default function ExpenseSummaryPage() {
  const [rows, setRows] = useState<SummaryRow[]>([])
  const [from, setFrom] = useState(firstOfMonth())
  const [to, setTo] = useState(today())

  const load = useCallback(async () => {
    try {
      const list = await ExpenseSummary(from, to)
      setRows(list || [])
    } catch (e: any) { toast.error(e?.message || 'Failed to load'); console.error(e) }
  }, [from, to])

  useEffect(() => { load() }, [load])

  const total = rows.reduce((s, r) => s + r.amountPaise, 0)

  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column', gap: 0, padding: 0 }}>
      <div style={{ background: 'var(--accent)', color: '#fff', padding: '10px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 600, fontSize: '1rem' }}>Expenses Summary</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-sm" style={{ background: 'var(--bg-card)', color: 'var(--fg)' }}>Print</button>
          <button className="btn btn-sm" style={{ background: 'var(--success)', color: '#fff' }}>Export</button>
        </div>
      </div>

      <div style={{ padding: '12px 20px', display: 'flex', gap: 12, alignItems: 'center' }}>
        <label style={{ fontSize: '0.85rem', fontWeight: 500 }}>From:</label>
        <input type="date" value={from} onChange={e => setFrom(e.target.value)}
          style={{ padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 4 }} />
        <label style={{ fontSize: '0.85rem', fontWeight: 500 }}>To:</label>
        <input type="date" value={to} onChange={e => setTo(e.target.value)}
          style={{ padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 4 }} />
        <button className="btn btn-primary btn-sm" onClick={load}>Search</button>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '0 20px' }}>
        <table>
          <thead>
            <tr>
              <th style={{ width: 50 }}>#</th>
              <th>Expense Type</th>
              <th style={{ textAlign: 'right', width: 160 }}>Total Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                <td>{i + 1}</td>
                <td style={{ fontWeight: 500 }}>{row.label}</td>
                <td style={{ textAlign: 'right', fontWeight: 500, color: 'var(--error)' }}>{fmt(row.amountPaise)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={3} style={{ textAlign: 'center', padding: 40, color: 'var(--fg-muted)' }}>No expenses for selected period</td></tr>
            )}
          </tbody>
          <tfoot>
            <tr style={{ fontWeight: 700, background: 'var(--bg-sidebar)' }}>
              <td colSpan={2} style={{ textAlign: 'right' }}>Total Expenses</td>
              <td style={{ textAlign: 'right', color: 'var(--error)' }}>{fmt(total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
