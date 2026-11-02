import { useEffect, useState, useCallback } from 'react'
import toast from 'react-hot-toast'
import { SaleSummary } from '../../wailsjs/go/main/App'

interface SaleSummaryRow {
  date: string
  invoiceCount: number
  totalPaise: number
  cashPaise: number
  upiPaise: number
  cardPaise: number
  creditPaise: number
}

const today = () => new Date().toISOString().slice(0, 10)
const fmt = (p: number) => (p / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })

export default function SaleSummaryPage() {
  const [rows, setRows] = useState<SaleSummaryRow[]>([])
  const [from, setFrom] = useState(today())
  const [to, setTo] = useState(today())

  const load = useCallback(async () => {
    try {
      const data = await SaleSummary(from, to) as any
      setRows(data || [])
    } catch (e: any) { toast.error(e?.message || 'Failed to load'); console.error(e) }
  }, [from, to])

  useEffect(() => { load() }, [load])

  const totalSales = rows.reduce((s, r) => s + r.totalPaise, 0)
  const totalCash = rows.reduce((s, r) => s + r.cashPaise, 0)
  const totalUPI = rows.reduce((s, r) => s + r.upiPaise, 0)
  const totalCard = rows.reduce((s, r) => s + r.cardPaise, 0)
  const totalCredit = rows.reduce((s, r) => s + r.creditPaise, 0)
  const totalInvoices = rows.reduce((s, r) => s + r.invoiceCount, 0)

  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column', gap: 0, padding: 0 }}>
      <div style={{ background: 'var(--accent)', color: '#fff', padding: '10px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 600, fontSize: '1rem' }}>Sale Summary</span>
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
      <div style={{ display: 'flex', gap: 12, padding: '0 20px 12px', flexWrap: 'wrap' }}>
        {[
          { label: 'Total Sales', value: fmt(totalSales), color: 'var(--accent)' },
          { label: 'Cash', value: fmt(totalCash), color: 'var(--success)' },
          { label: 'UPI', value: fmt(totalUPI), color: 'var(--fg-muted)' },
          { label: 'Card', value: fmt(totalCard), color: 'var(--fg-muted)' },
          { label: 'Credit', value: fmt(totalCredit), color: 'var(--error)' },
          { label: 'Invoices', value: String(totalInvoices), color: 'var(--accent)' },
        ].map(c => (
          <div key={c.label} style={{ flex: 1, minWidth: 120, background: 'var(--bg-card)', border: '1px solid var(--glass-border)', borderRadius: 8, padding: '12px 16px' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--fg-muted)', marginBottom: 4 }}>{c.label}</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: c.color }}>{c.value}</div>
          </div>
        ))}
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '0 20px' }}>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th style={{ textAlign: 'right' }}>Invoices</th>
              <th style={{ textAlign: 'right' }}>Cash</th>
              <th style={{ textAlign: 'right' }}>UPI</th>
              <th style={{ textAlign: 'right' }}>Card</th>
              <th style={{ textAlign: 'right' }}>Credit</th>
              <th style={{ textAlign: 'right' }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.date}>
                <td style={{ fontWeight: 600 }}>{r.date}</td>
                <td style={{ textAlign: 'right' }}>{r.invoiceCount}</td>
                <td style={{ textAlign: 'right' }}>{fmt(r.cashPaise)}</td>
                <td style={{ textAlign: 'right' }}>{fmt(r.upiPaise)}</td>
                <td style={{ textAlign: 'right' }}>{fmt(r.cardPaise)}</td>
                <td style={{ textAlign: 'right' }}>{fmt(r.creditPaise)}</td>
                <td style={{ textAlign: 'right', fontWeight: 500 }}>{fmt(r.totalPaise)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--fg-muted)' }}>No sales data for selected period</td></tr>
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr style={{ fontWeight: 700, borderTop: '2px solid var(--border)' }}>
                <td>Total</td>
                <td style={{ textAlign: 'right' }}>{totalInvoices}</td>
                <td style={{ textAlign: 'right' }}>{fmt(totalCash)}</td>
                <td style={{ textAlign: 'right' }}>{fmt(totalUPI)}</td>
                <td style={{ textAlign: 'right' }}>{fmt(totalCard)}</td>
                <td style={{ textAlign: 'right' }}>{fmt(totalCredit)}</td>
                <td style={{ textAlign: 'right' }}>{fmt(totalSales)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}
