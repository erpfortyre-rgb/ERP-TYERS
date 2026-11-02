import { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'
import { ListSaleOrders, SaveSaleOrder, SearchCustomers, DeleteSaleOrder } from '../../wailsjs/go/main/App'
import { InvoiceProductTable, InvoiceTotals, LineItem } from './InvoiceForm'

interface Customer { id: string; name: string }
interface SO { id: string; orderNumber: string; customerId: string; orderDate: string; status: string; totalPaise: number; notes: string }

const fmt = (p: number) => '₹' + (p / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })
const today = () => new Date().toISOString().slice(0, 10)

function statusColor(s: string) {
  if (s === 'DELIVERED') return 'var(--success)'
  if (s === 'CANCELLED') return 'var(--error)'
  if (s === 'CONFIRMED' || s === 'PARTIAL') return 'var(--accent)'
  return 'var(--warning)'
}

export default function SaleOrderPage() {
  const [view, setView] = useState<'list' | 'form'>('list')
  const [orders, setOrders] = useState<SO[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [filter, setFilter] = useState('')

  const [selectedCustomer, setSelectedCustomer] = useState('')
  const [orderDate, setOrderDate] = useState(today())
  const [items, setItems] = useState<LineItem[]>([])
  const [remark, setRemark] = useState('')
  const [saving, setSaving] = useState(false)
  const [editId, setEditId] = useState('')

  const loadOrders = useCallback(() => {
    ListSaleOrders(filter).then(d => setOrders(d || [])).catch(e => { console.error(e); toast.error('Failed to load sale orders') })
  }, [filter])

  useEffect(() => { loadOrders() }, [loadOrders])
  useEffect(() => { SearchCustomers('').then(c => setCustomers(c || [])).catch(e => { console.error(e); toast.error('Failed to load customers') }) }, [])

  const resetForm = () => { setEditId(''); setSelectedCustomer(''); setOrderDate(today()); setItems([]); setRemark('') }
  const handleNew = () => { resetForm(); setView('form') }

  const handleEdit = (o: SO) => {
    setEditId(o.id); setSelectedCustomer(o.customerId); setOrderDate(o.orderDate); setRemark(o.notes); setItems([])
    setView('form')
  }

  const handleDelete = async (id: string, num: string) => {
    if (!window.confirm(`Delete sale order "${num || id}"?`)) return
    try { await DeleteSaleOrder(id); toast.success('Deleted'); loadOrders() } catch (e: any) { toast.error(e?.message || 'Delete failed') }
  }

  const handleSave = async () => {
    if (!selectedCustomer) { toast.error('Select a customer'); return }
    if (items.length === 0) { toast.error('Add at least one item'); return }
    setSaving(true)
    const subtotal = items.reduce((s, i) => s + i.amountPaise, 0)
    try {
      const taxTotal = items.reduce((s, i) => {
          const taxable = Math.round(i.amountPaise * 100 / (100 + i.gstPercent))
          return s + (i.amountPaise - taxable)
        }, 0)
      await SaveSaleOrder(
        { id: editId, customerId: selectedCustomer, orderDate, status: 'DRAFT',
          subtotalPaise: subtotal - taxTotal, taxPaise: taxTotal, totalPaise: subtotal, notes: remark } as any,
        items.map(i => ({
          id: '', productId: i.productId, quantityMillis: i.quantity * 1000, unitPricePaise: i.pricePaise,
          taxPercent: i.gstPercent, totalPaise: i.amountPaise,
        })) as any
      )
      toast.success('Sale Order saved')
      resetForm(); setView('list'); loadOrders()
    } catch (e: any) { toast.error(e?.message || 'Save failed') }
    setSaving(false)
  }

  const customerName = (id: string) => customers.find(c => c.id === id)?.name || '—'

  if (view === 'form') {
    return (
      <div className="page" style={{ display: 'flex', flexDirection: 'column', gap: 0, padding: 0 }}>
        <div style={{ background: 'var(--accent)', color: '#fff', padding: '10px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 600, fontSize: '1rem' }}>New Sale Order</span>
          <button className="btn btn-sm" style={{ background: 'var(--bg-card)', color: 'var(--fg)' }} onClick={() => setView('list')}>← Back</button>
        </div>
        <div style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <label style={{ fontWeight: 600, fontSize: '0.8rem', display: 'block', marginBottom: 2 }}>Customer *</label>
            <select className="form-input" value={selectedCustomer} onChange={e => setSelectedCustomer(e.target.value)}>
              <option value="">Select Customer</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontWeight: 600, fontSize: '0.8rem', display: 'block', marginBottom: 2 }}>Order Date</label>
            <input type="date" className="form-input" value={orderDate} onChange={e => setOrderDate(e.target.value)} />
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
        <span style={{ fontWeight: 600, fontSize: '1rem' }}>Sale Orders</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <select style={{ padding: '4px 8px', borderRadius: 4, border: 'none', fontSize: '0.8rem' }} value={filter} onChange={e => setFilter(e.target.value)}>
            <option value="">All</option>
            <option value="DRAFT">Draft</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="PARTIAL">Partial</option>
            <option value="DELIVERED">Delivered</option>
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
              <th>Customer</th>
              <th style={{ width: 110 }}>Date</th>
              <th style={{ width: 100 }}>Status</th>
              <th style={{ textAlign: 'right', width: 140 }}>Total</th>
              <th style={{ width: 120 }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o, i) => (
              <tr key={o.id}>
                <td>{i + 1}</td>
                <td style={{ fontWeight: 500 }}>{o.orderNumber || '—'}</td>
                <td>{customerName(o.customerId)}</td>
                <td>{o.orderDate}</td>
                <td><span style={{ color: statusColor(o.status), fontWeight: 600, fontSize: '0.8rem' }}>{o.status}</span></td>
                <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(o.totalPaise)}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button onClick={() => handleEdit(o)} style={{ marginRight: 4, padding: '2px 8px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.8rem' }}>✏️ Edit</button>
                  <button onClick={() => handleDelete(o.id, o.orderNumber)} style={{ padding: '2px 8px', background: 'var(--error)', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.8rem' }}>🗑</button>
                </td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--fg-muted)' }}>No sale orders yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
