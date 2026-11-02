import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { CustomerInvoices as CustomerInvoicesApi, GetInvoices, SearchCustomers } from '../../wailsjs/go/main/App'

interface Invoice {
  id: string; invoiceNumber: string; customerId: string; customerName: string
  totalPaise: number; taxPaise: number; discountPaise: number
  status: string; createdAt: string
}
interface Customer {
  id: string; name: string
}

const fmt = (p: number) => '₹' + (p / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })

export default function CustomerInvoicePage() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [filtered, setFiltered] = useState<Invoice[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [custQuery, setCustQuery] = useState('')
  const [selectedCust, setSelectedCust] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => { loadInvoices() }, [])

  const loadInvoices = async (customerId?: string) => {
    setLoading(true)
    try {
      if (customerId) {
        const data = await CustomerInvoicesApi(customerId) as any
        setInvoices(data || [])
        setFiltered(data || [])
      } else {
        const data = await GetInvoices() as any
        setInvoices(data || [])
        setFiltered(data || [])
      }
    } catch (e: any) { toast.error(e?.message || 'Failed to load invoices'); console.error(e) }
    setLoading(false)
  }

  const handleCustSearch = async (q: string) => {
    setCustQuery(q)
    if (q.length < 2) { setCustomers([]); return }
    try {
      const res = await SearchCustomers(q) as any
      setCustomers(res || [])
    } catch (e: any) { console.error(e); toast.error(e?.message || 'Failed to search customers') }
  }

  useEffect(() => {
    let list = invoices
    if (selectedCust) list = list.filter(i => i.customerId === selectedCust)
    if (dateFrom) list = list.filter(i => i.createdAt >= dateFrom)
    if (dateTo) list = list.filter(i => i.createdAt <= dateTo + 'T23:59:59')
    setFiltered(list)
  }, [selectedCust, dateFrom, dateTo, invoices])

  const statusBadge = (s: string) => {
    const cls = s === 'FINAL' ? 'badge-success' : s === 'DRAFT' ? 'badge-warning' : 'badge-error'
    return <span className={`badge ${cls}`}>{s === 'FINAL' ? 'Paid' : s}</span>
  }

  return (
    <div className="page">
      <div style={{ background: 'var(--accent)', color: '#fff', padding: '10px 20px', borderRadius: 8, marginBottom: 16 }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>Customer Invoices</h2>
      </div>

      {/* Filters */}
      <div className="card" style={{ padding: 16, marginBottom: 16, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ flex: '1 1 200px', position: 'relative' }}>
          <label style={{ fontSize: '0.75rem', color: 'var(--fg-muted)', display: 'block', marginBottom: 4 }}>Customer</label>
          <input
            value={custQuery}
            onChange={e => handleCustSearch(e.target.value)}
            placeholder="Search customer..."
            style={{ width: '100%', padding: '8px 12px', background: 'var(--bg-input)', color: 'var(--fg)', border: '1px solid var(--border)', borderRadius: 6, outline: 'none' }}
          />
          {customers.length > 0 && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, background: 'var(--bg-card)', border: '1px solid var(--glass-border)', borderRadius: 6, maxHeight: 160, overflowY: 'auto' }}>
              {customers.map(c => (
                <div key={c.id} onClick={() => { setSelectedCust(c.id); setCustQuery(c.name); setCustomers([]) }}
                  style={{ padding: '8px 12px', cursor: 'pointer', color: 'var(--fg)', fontSize: '0.85rem', borderBottom: '1px solid var(--border)' }}>
                  {c.name}
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={{ flex: '0 0 160px' }}>
          <label style={{ fontSize: '0.75rem', color: 'var(--fg-muted)', display: 'block', marginBottom: 4 }}>From Date</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            style={{ width: '100%', padding: '8px 12px', background: 'var(--bg-input)', color: 'var(--fg)', border: '1px solid var(--border)', borderRadius: 6 }} />
        </div>
        <div style={{ flex: '0 0 160px' }}>
          <label style={{ fontSize: '0.75rem', color: 'var(--fg-muted)', display: 'block', marginBottom: 4 }}>To Date</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            style={{ width: '100%', padding: '8px 12px', background: 'var(--bg-input)', color: 'var(--fg)', border: '1px solid var(--border)', borderRadius: 6 }} />
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => { setSelectedCust(''); setCustQuery(''); setDateFrom(''); setDateTo('') }}
          style={{ padding: '8px 16px' }}>Clear</button>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Customer</th>
                <th>Date</th>
                <th style={{ textAlign: 'right' }}>Total</th>
                <th style={{ textAlign: 'right' }}>Tax</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--fg-muted)' }}>Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--fg-muted)' }}>No invoices found.</td></tr>
              ) : filtered.map(inv => (
                <tr key={inv.id} style={{ cursor: 'pointer' }}>
                  <td style={{ fontWeight: 600, color: 'var(--accent)' }}>{inv.invoiceNumber}</td>
                  <td>{inv.customerName}</td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--fg-muted)' }}>{new Date(inv.createdAt).toLocaleDateString('en-IN')}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(inv.totalPaise)}</td>
                  <td style={{ textAlign: 'right', color: 'var(--fg-muted)' }}>{fmt(inv.taxPaise)}</td>
                  <td>{statusBadge(inv.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
