import { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'
import { ListPurchaseOrders, SavePurchaseOrder, ListCompanies } from '../../wailsjs/go/main/App'
import { InvoiceProductTable, InvoiceTotals, LineItem } from './InvoiceForm'

interface Company { id: string; name: string }
interface PO { id: string; orderNumber: string; companyId: string; orderDate: string; status: string; totalPaise: number; notes: string }

const fmt = (p: number) => '₹' + (p / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })
const today = () => new Date().toISOString().slice(0, 10)

function statusColor(s: string) {
  if (s === 'RECEIVED') return 'var(--success)'
  if (s === 'CANCELLED') return 'var(--error)'
  if (s === 'SENT' || s === 'PARTIAL') return 'var(--accent)'
  return 'var(--warning)'
}

export default function PurchaseOrderPage() {
  const [view, setView] = useState<'list' | 'form'>('list')
  const [orders, setOrders] = useState<PO[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [filter, setFilter] = useState('')

  const [selectedCompany, setSelectedCompany] = useState('')
  const [orderDate, setOrderDate] = useState(today())
  const [expectedDate, setExpectedDate] = useState('')
  const [items, setItems] = useState<LineItem[]>([])
  const [remark, setRemark] = useState('')
  const [saving, setSaving] = useState(false)

  const loadOrders = useCallback(() => {
    ListPurchaseOrders(filter).then(d => setOrders(d || [])).catch(e => { console.error(e); toast.error('Failed to load purchase orders') })
  }, [filter])

  useEffect(() => { loadOrders() }, [loadOrders])
  useEffect(() => { ListCompanies('').then(c => setCompanies(c || [])).catch(e => { console.error(e); toast.error('Failed to load companies') }) }, [])

  const resetForm = () => { setSelectedCompany(''); setOrderDate(today()); setExpectedDate(''); setItems([]); setRemark('') }

  const handleNew = () => { resetForm(); setView('form') }

  const handleSave = async () => {
    if (!selectedCompany) { toast.error('Select a company'); return }
    if (items.length === 0) { toast.error('Add at least one item'); return }
    setSaving(true)
    const subtotal = items.reduce((s, i) => s + i.amountPaise, 0)
    try {
      const taxTotal = items.reduce((s, i) => {
          const taxable = Math.round(i.amountPaise * 100 / (100 + i.gstPercent))
          return s + (i.amountPaise - taxable)
        }, 0)
      await SavePurchaseOrder(
        { id: '', companyId: selectedCompany, orderDate, status: 'DRAFT',
          subtotalPaise: subtotal - taxTotal, taxPaise: taxTotal, totalPaise: subtotal, notes: remark } as any,
        items.map(i => ({
          id: '', productId: i.productId, quantityMillis: i.quantity * 1000, unitPricePaise: i.pricePaise,
          taxPercent: i.gstPercent, totalPaise: i.amountPaise,
        })) as any
      )
      toast.success('Purchase Order saved')
      resetForm(); setView('list'); loadOrders()
    } catch (e: any) { toast.error(e?.message || 'Save failed') }
    setSaving(false)
  }

  const companyName = (id: string) => companies.find(c => c.id === id)?.name || '—'

  if (view === 'form') {
    return (
      <div className="page" style={{ display: 'flex', flexDirection: 'column', gap: 0, padding: 0 }}>
        <div style={{ background: 'var(--accent)', color: '#fff', padding: '10px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 600, fontSize: '1rem' }}>New Purchase Order</span>
          <button className="btn btn-sm" style={{ background: 'var(--bg-card)', color: 'var(--fg)' }} onClick={() => setView('list')}>← Back</button>
        </div>
        <div style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <label style={{ fontWeight: 600, fontSize: '0.8rem', display: 'block', marginBottom: 2 }}>Company *</label>
            <select className="form-input" value={selectedCompany} onChange={e => setSelectedCompany(e.target.value)}>
              <option value="">Select Company</option>
              {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontWeight: 600, fontSize: '0.8rem', display: 'block', marginBottom: 2 }}>Order Date</label>
            <input type="date" className="form-input" value={orderDate} onChange={e => setOrderDate(e.target.value)} />
          </div>
          <div>
            <label style={{ fontWeight: 600, fontSize: '0.8rem', display: 'block', marginBottom: 2 }}>Expected Date</label>
            <input type="date" className="form-input" value={expectedDate} onChange={e => setExpectedDate(e.target.value)} />
          </div>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: '0 20px' }}>
          <InvoiceProductTable items={items} onItemsChange={setItems} />
        </div>
        <InvoiceTotals items={items} remark={remark} onRemarkChange={setRemark} />
        <div style={{ padding: '8px 20px 12px', display: 'flex', gap: 8, justifyContent: 'flex-end', borderTop: '1px solid var(--border)' }}>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
          <button className="btn" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }} onClick={() => setView('list')}>Cancel</button>
        </div>
      </div>
    )
  }

  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column', gap: 0, padding: 0 }}>
      <div style={{ background: 'var(--accent)', color: '#fff', padding: '10px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 600, fontSize: '1rem' }}>Purchase Orders</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <select style={{ padding: '4px 8px', borderRadius: 4, border: 'none', fontSize: '0.8rem' }} value={filter} onChange={e => setFilter(e.target.value)}>
            <option value="">All</option>
            <option value="DRAFT">Draft</option>
            <option value="SENT">Sent</option>
            <option value="PARTIAL">Partial</option>
            <option value="RECEIVED">Received</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
          <button className="btn btn-sm" style={{ background: '#fff', color: 'var(--accent)', fontWeight: 600 }} onClick={handleNew}>+ New</button>
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '0 20px 20px' }}>
        <table>
          <thead>
            <tr>
              <th style={{ width: 50 }}>#</th>
              <th>Order #</th>
              <th>Company</th>
              <th style={{ width: 110 }}>Date</th>
              <th style={{ width: 100 }}>Status</th>
              <th style={{ textAlign: 'right', width: 140 }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o, i) => (
              <tr key={o.id}>
                <td>{i + 1}</td>
                <td style={{ fontWeight: 500 }}>{o.orderNumber || '—'}</td>
                <td>{companyName(o.companyId)}</td>
                <td>{o.orderDate}</td>
                <td><span style={{ color: statusColor(o.status), fontWeight: 600, fontSize: '0.8rem' }}>{o.status}</span></td>
                <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(o.totalPaise)}</td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--fg-muted)' }}>No purchase orders yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
