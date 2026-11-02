import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { FiMoreVertical, FiEye, FiPrinter, FiRefreshCw, FiFileText, FiSearch, FiPlus, FiTrash2 } from 'react-icons/fi'
import toast from 'react-hot-toast'
import DateRangePicker from '../components/DateRangePicker'
import { GetInvoices, GetInvoiceDetails, PrintReceipt, DeleteInvoice } from '../../wailsjs/go/main/App'

interface Invoice {
  id: string; invoiceNumber: string; customerName: string; status: string
  totalPaise: number; createdAt: string
}
interface InvoiceDetail {
  id: string; invoiceNumber: string; customerName: string; status: string
  subtotalPaise: number; discountPaise: number; taxPaise: number
  roundoffPaise: number; totalPaise: number; createdAt: string
  items: { productName: string; quantityMillis: number; unitPricePaise: number; taxPaise: number; totalPaise: number }[]
  payments: { method: string; amountPaise: number; referenceNumber: string; isVerified: boolean }[]
}

function formatMoney(paise: number): string {
  return '₹' + (paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function isoLocal(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

const inputStyle: CSSProperties = {
  background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--fg)',
  borderRadius: 6, padding: '7px 10px', fontSize: '0.85rem',
}

function StatCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div style={{
      flex: 1, minWidth: 180, background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderLeft: `4px solid ${color}`, borderRadius: 8, padding: '12px 16px',
    }}>
      <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--fg-muted)' }}>{label}</div>
      <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--fg-bright)', marginTop: 4 }}>{value}</div>
      <div style={{ fontSize: '0.78rem', color: 'var(--fg-muted)', marginTop: 2 }}>{sub}</div>
    </div>
  )
}

export default function Invoices() {
  const navigate = useNavigate()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [selected, setSelected] = useState<InvoiceDetail | null>(null)
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'FINAL' | 'DRAFT'>('ALL')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [showRange, setShowRange] = useState(false)

  useEffect(() => {
    loadInvoices()
  }, [])

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'F2' && !showRange) { e.preventDefault(); setShowRange(true) }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [showRange])

  const deleteInvoice = async (inv: Invoice) => {
    if (!confirm(`Delete invoice ${inv.invoiceNumber}?\n\nIt moves to the Recycle Bin — stock is added back and it's removed from reports/GST. You can restore it later.`)) return
    let name = '', email = ''
    try { const u = JSON.parse(localStorage.getItem('sst_user') || '{}'); name = u.name || ''; email = u.email || '' } catch { /* ignore */ }
    try {
      await DeleteInvoice(inv.id, name, email)
      toast.success(`${inv.invoiceNumber} moved to Recycle Bin`)
      setOpenMenu(null)
      loadInvoices()
      window.dispatchEvent(new Event('recyclebin:changed'))
    } catch (e: any) { toast.error(String(e?.message || e)) }
  }

  const loadInvoices = () => {
    GetInvoices().then(d => setInvoices(d || [])).catch(e => { console.error(e); toast.error('Failed to load invoices') })
  }

  const viewDetails = async (id: string) => {
    try {
      const detail = await GetInvoiceDetails(id)
      setSelected(detail)
      setOpenMenu(null)
    } catch (e: any) { toast.error(e?.message || 'Failed to load invoice details') }
  }

  const stats = useMemo(() => {
    const now = new Date()
    const todayStr = isoLocal(now)
    let monthSum = 0, monthCnt = 0, todaySum = 0, todayCnt = 0
    for (const inv of invoices) {
      const d = new Date(inv.createdAt)
      if (isNaN(d.getTime())) continue
      if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()) {
        monthSum += inv.totalPaise; monthCnt++
      }
      if (isoLocal(d) === todayStr) { todaySum += inv.totalPaise; todayCnt++ }
    }
    return { monthSum, monthCnt, todaySum, todayCnt }
  }, [invoices])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return invoices.filter(inv => {
      if (statusFilter !== 'ALL' && inv.status !== statusFilter) return false
      if (q && !(inv.invoiceNumber || '').toLowerCase().includes(q) && !(inv.customerName || '').toLowerCase().includes(q)) return false
      if (dateFrom || dateTo) {
        const d = new Date(inv.createdAt)
        if (isNaN(d.getTime())) return false
        const ds = isoLocal(d)
        if (dateFrom && ds < dateFrom) return false
        if (dateTo && ds > dateTo) return false
      }
      return true
    })
  }, [invoices, search, statusFilter, dateFrom, dateTo])

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--fg-bright)', margin: 0 }}>Sale Invoices</h2>
          <div style={{ fontSize: '0.8rem', color: 'var(--fg-muted)', marginTop: 2 }}>All GST sale invoices: filter, print, take payment</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={loadInvoices}><FiRefreshCw size={14} /> Refresh</button>
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/inventory/add-sale')}><FiPlus size={14} /> Add Sale</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <StatCard label="Sales this month" value={formatMoney(stats.monthSum)} sub={`${stats.monthCnt} invoice${stats.monthCnt === 1 ? '' : 's'}`} color="var(--accent)" />
        <StatCard label="Today's Sale" value={formatMoney(stats.todaySum)} sub={`${stats.todayCnt} invoice${stats.todayCnt === 1 ? '' : 's'}`} color="#22c55e" />
        <StatCard label="Total Invoices" value={String(invoices.length)} sub="All time" color="#f59e0b" />
      </div>

      <div style={{
        display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12,
        background: 'var(--bg-sidebar)', border: '1px solid var(--border)', borderRadius: 8, padding: 10,
      }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
          <FiSearch size={14} style={{ position: 'absolute', left: 10, top: 11, color: 'var(--fg-muted)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search invoice no. or customer..."
            style={{ ...inputStyle, width: '100%', paddingLeft: 30, boxSizing: 'border-box' }} />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as 'ALL' | 'FINAL' | 'DRAFT')} style={inputStyle}>
          <option value="ALL">Status: All</option>
          <option value="FINAL">FINAL</option>
          <option value="DRAFT">DRAFT</option>
        </select>
        <button className="btn btn-ghost btn-sm" onClick={() => setShowRange(true)} title="Date range (F2)">
          📅 {dateFrom && dateTo ? `${dateFrom} to ${dateTo}` : 'Range'}
        </button>
        {(dateFrom || dateTo || search || statusFilter !== 'ALL') && (
          <button className="btn btn-ghost btn-sm" onClick={() => { setDateFrom(''); setDateTo(''); setSearch(''); setStatusFilter('ALL') }}>Clear</button>
        )}
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Invoice No</th>
                <th>Date</th>
                <th>Customer</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Total</th>
                <th style={{ width: 90, textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--fg-muted)' }}>
                    {invoices.length === 0 ? 'No invoices yet. Create one from Billing (F2).' : 'No invoices match the current filters.'}
                  </td>
                </tr>
              ) : filtered.map(inv => (
                <tr key={inv.id}>
                  <td style={{ fontWeight: 600, color: 'var(--accent)' }}>{inv.invoiceNumber}</td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--fg-muted)' }}>
                    {new Date(inv.createdAt).toLocaleDateString('en-IN')}
                  </td>
                  <td>{inv.customerName}</td>
                  <td>
                    <span className={`badge ${inv.status === 'FINAL' ? 'badge-success' : inv.status === 'DRAFT' ? 'badge-warning' : 'badge-error'}`}>
                      {inv.status}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatMoney(inv.totalPaise)}</td>
                  <td style={{ textAlign: 'center', position: 'relative', whiteSpace: 'nowrap' }}>
                    <button title="Print Tax Invoice" onClick={() => navigate('/print/invoice/' + inv.id)}
                      style={{ padding: 4, marginRight: 4, background: 'none', border: 'none', cursor: 'pointer' }}>
                      🧾
                    </button>
                    <button onClick={() => setOpenMenu(openMenu === inv.id ? null : inv.id)}
                      style={{ padding: 4, color: 'var(--accent)' }}>
                      <FiMoreVertical size={16} />
                    </button>
                    {openMenu === inv.id && (
                      <div style={{
                        position: 'absolute', right: 8, top: '100%', zIndex: 50,
                        background: 'var(--bg-card)', border: '1px solid var(--border)',
                        borderRadius: 8, padding: 4, minWidth: 180, boxShadow: '0 8px 24px rgba(0,0,0,0.3)'
                      }}>
                        <button onClick={() => viewDetails(inv.id)} className="dropdown-item">
                          <FiEye size={14} /> View Details
                        </button>
                        <button onClick={() => { setOpenMenu(null); navigate('/print/invoice/' + inv.id) }} className="dropdown-item">
                          <FiFileText size={14} /> Tax Invoice (GST Bill)
                        </button>
                        <button className="dropdown-item" onClick={async () => {
                          try { await PrintReceipt(inv.id); toast.success('Print sent'); setOpenMenu(null) }
                          catch { toast.error('Print failed') }
                        }}><FiPrinter size={14} /> Print Invoice</button>
                        <button className="dropdown-item" onClick={() => toast('Packing Slip coming soon')}>📄 Packing Slip</button>
                        <button className="dropdown-item" onClick={() => toast('WhatsApp integration coming soon')}>📱 Send on WhatsApp</button>
                        <button className="dropdown-item" onClick={() => toast('View Payments coming soon')}>💰 View Payments</button>
                        <button className="dropdown-item" style={{ color: 'var(--error)' }} onClick={() => toast('Go to Inventory → Sales Return')}>🔄 Sell Return</button>
                        <div style={{ height: 1, background: 'var(--border)', margin: '4px 6px' }} />
                        <button className="dropdown-item" style={{ color: '#ef4444' }} onClick={() => deleteInvoice(inv)}>
                          <FiTrash2 size={14} /> Delete (Recycle Bin)
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invoice Detail Modal */}
      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ minWidth: 600 }}>
            <div className="modal-title">
              Invoice: {selected.invoiceNumber}
              <span className={`badge ${selected.status === 'FINAL' ? 'badge-success' : 'badge-warning'}`} style={{ marginLeft: 12 }}>
                {selected.status}
              </span>
            </div>

            <div style={{ marginBottom: 12, fontSize: '0.85rem', color: 'var(--fg-muted)' }}>
              Customer: <strong style={{ color: 'var(--fg)' }}>{selected.customerName}</strong>
              &nbsp;&middot;&nbsp; Date: {new Date(selected.createdAt).toLocaleString('en-IN')}
            </div>

            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th style={{ textAlign: 'right' }}>Qty</th>
                  <th style={{ textAlign: 'right' }}>Rate</th>
                  <th style={{ textAlign: 'right' }}>Tax</th>
                  <th style={{ textAlign: 'right' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {selected.items?.map((item, i) => (
                  <tr key={i}>
                    <td>{item.productName}</td>
                    <td style={{ textAlign: 'right' }}>{item.quantityMillis / 1000}</td>
                    <td style={{ textAlign: 'right' }}>{formatMoney(item.unitPricePaise)}</td>
                    <td style={{ textAlign: 'right' }}>{formatMoney(item.taxPaise)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatMoney(item.totalPaise)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
              <div className="pos-total-row"><span>Subtotal</span><span>{formatMoney(selected.subtotalPaise)}</span></div>
              {selected.discountPaise > 0 && (
                <div className="pos-total-row" style={{ color: 'var(--success)' }}>
                  <span>Discount</span><span>-{formatMoney(selected.discountPaise)}</span>
                </div>
              )}
              <div className="pos-total-row"><span>Tax</span><span>{formatMoney(selected.taxPaise)}</span></div>
              <div className="pos-total-row grand"><span>Total</span><span>{formatMoney(selected.totalPaise)}</span></div>
            </div>

            {selected.payments?.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: 4 }}>Payments</div>
                {selected.payments.map((p, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', padding: '2px 0' }}>
                    <span>{p.method} {p.referenceNumber && `(${p.referenceNumber})`}</span>
                    <span style={{ fontWeight: 600 }}>{formatMoney(p.amountPaise)}</span>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button className="btn btn-ghost" onClick={() => setSelected(null)} style={{ flex: 1 }}>Close</button>
              <button className="btn btn-primary" onClick={async () => {
                try { await PrintReceipt(selected.id); toast.success('Print sent') }
                catch { toast.error('Print failed') }
              }} style={{ flex: 1 }}><FiPrinter size={14} /> Print</button>
            </div>
          </div>
        </div>
      )}

      {showRange && (
        <DateRangePicker
          initialFrom={dateFrom || undefined}
          initialTo={dateTo || undefined}
          onApply={(f, t) => { setDateFrom(f); setDateTo(t); setShowRange(false) }}
          onClose={() => setShowRange(false)}
        />
      )}

      <style>{`
        .dropdown-item {
          display: flex; align-items: center; gap: 8px; padding: 8px 12px;
          width: 100%; text-align: left; font-size: 0.85rem; border-radius: 4px;
          transition: background 0.1s; background: none; border: none; color: var(--fg);
          cursor: pointer;
        }
        .dropdown-item:hover { background: var(--bg-hover); }
      `}</style>
    </div>
  )
}
