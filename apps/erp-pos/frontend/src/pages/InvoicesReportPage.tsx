import { useEffect, useState, useCallback } from 'react'
import toast from 'react-hot-toast'
import { InvoicesReport } from '../../wailsjs/go/main/App'

interface Invoice {
  id: string; invoiceNumber: string; customerName: string
  totalPaise: number; status: string; createdAt: string
}

const fmt = (p: number) => (p / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })
const today = () => new Date().toISOString().slice(0, 10)

export default function InvoicesReportPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [statusFilter, setStatusFilter] = useState('All')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState(today())

  const load = useCallback(async () => {
    try {
      const data = await InvoicesReport(dateFrom || '2000-01-01', dateTo) as any
      setInvoices(data || [])
    } catch (e: any) { toast.error(e?.message || 'Failed to load'); console.error(e) }
  }, [dateFrom, dateTo])

  useEffect(() => { load() }, [load])

  const filtered = invoices.filter(inv => {
    if (statusFilter !== 'All' && inv.status !== statusFilter) return false
    const d = inv.createdAt?.slice(0, 10) || ''
    if (dateFrom && d < dateFrom) return false
    if (dateTo && d > dateTo) return false
    return true
  })

  const totalAmount = filtered.reduce((s, i) => s + (i.totalPaise || 0), 0)

  const statusColors: Record<string, string> = {
    FINAL: 'var(--success)', DRAFT: 'var(--warning)', CANCELLED: 'var(--error)', RETURNED: 'var(--fg-muted)'
  }

  const getStatus = (inv: Invoice) => {
    return inv.status || 'DRAFT'
  }

  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column', gap: 0, padding: 0 }}>
      <div style={{ background: 'var(--accent)', color: '#fff', padding: '10px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 600, fontSize: '1rem' }}>Invoices Report</span>
      </div>

      <div style={{ padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--fg)' }}>From:</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            style={{ padding: '4px 10px', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--bg-input)', color: 'var(--fg)' }} />
          <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--fg)' }}>To:</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            style={{ padding: '4px 10px', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--bg-input)', color: 'var(--fg)' }} />
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            style={{ padding: '4px 10px', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--bg-input)', color: 'var(--fg)' }}>
            <option>All</option>
            <option value="FINAL">Final</option>
            <option value="DRAFT">Draft</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="RETURNED">Returned</option>
          </select>
        </div>
      </div>

      <div style={{ padding: '12px 20px', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {[
          { label: 'Total Invoices', value: String(filtered.length), color: 'var(--fg)' },
          { label: 'Total Amount', value: fmt(totalAmount), color: 'var(--accent)' },
        ].map(card => (
          <div key={card.label} style={{ flex: 1, minWidth: 150, padding: '12px 16px', background: 'var(--bg-card)', border: '1px solid var(--glass-border)', borderRadius: 8 }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--fg-muted)', marginBottom: 4 }}>{card.label}</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: card.color }}>{card.value}</div>
          </div>
        ))}
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '0 20px' }}>
        <table>
          <thead>
            <tr>
              <th style={{ width: 40 }}>#</th>
              <th style={{ width: 120 }}>Invoice #</th>
              <th style={{ width: 100 }}>Date</th>
              <th>Customer</th>
              <th style={{ textAlign: 'right', width: 120 }}>Total</th>
              <th style={{ width: 90 }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((inv, i) => {
              const status = getStatus(inv)
              return (
                <tr key={inv.id}>
                  <td>{i + 1}</td>
                  <td style={{ fontWeight: 500 }}>{inv.invoiceNumber || inv.id}</td>
                  <td>{inv.createdAt ? new Date(inv.createdAt).toLocaleDateString('en-IN') : '-'}</td>
                  <td>{inv.customerName || '-'}</td>
                  <td style={{ textAlign: 'right' }}>{fmt(inv.totalPaise || 0)}</td>
                  <td>
                    <span style={{
                      padding: '2px 10px', borderRadius: 12, fontSize: '0.78rem', fontWeight: 600,
                      background: statusColors[status] || '#ccc', color: '#fff'
                    }}>
                      {status}
                    </span>
                  </td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--fg-muted)' }}>No invoices found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
