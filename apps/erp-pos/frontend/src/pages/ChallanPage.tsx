import { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'
import { ListChallans, SaveChallan, SearchCustomers, DeleteChallan } from '../../wailsjs/go/main/App'
import { InvoiceProductTable, InvoiceTotals, LineItem } from './InvoiceForm'

interface Customer { id: string; name: string }
interface Challan { id: string; challanNumber: string; customerId: string; challanDate: string; status: string; notes: string }

const today = () => new Date().toISOString().slice(0, 10)

function statusColor(s: string) {
  if (s === 'INVOICED') return 'var(--success)'
  if (s === 'CANCELLED') return 'var(--error)'
  return 'var(--warning)'
}

export default function ChallanPage() {
  const [view, setView] = useState<'list' | 'form'>('list')
  const [challans, setChallans] = useState<Challan[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [filter, setFilter] = useState('')

  const [selectedCustomer, setSelectedCustomer] = useState('')
  const [challanDate, setChallanDate] = useState(today())
  const [items, setItems] = useState<LineItem[]>([])
  const [remark, setRemark] = useState('')
  const [saving, setSaving] = useState(false)
  const [editId, setEditId] = useState('')

  const loadChallans = useCallback(() => {
    ListChallans(filter).then(d => setChallans(d || [])).catch(e => { console.error(e); toast.error('Failed to load challans') })
  }, [filter])

  useEffect(() => { loadChallans() }, [loadChallans])
  useEffect(() => { SearchCustomers('').then(c => setCustomers(c || [])).catch(e => { console.error(e); toast.error('Failed to load customers') }) }, [])

  const resetForm = () => { setEditId(''); setSelectedCustomer(''); setChallanDate(today()); setItems([]); setRemark('') }
  const handleNew = () => { resetForm(); setView('form') }

  const handleEdit = (ch: Challan) => {
    setEditId(ch.id); setSelectedCustomer(ch.customerId); setChallanDate(ch.challanDate)
    setRemark(ch.notes); setItems([])
    setView('form')
  }

  const handleDelete = async (id: string, num: string) => {
    if (!window.confirm(`Delete challan "${num || id}"?`)) return
    try { await DeleteChallan(id); toast.success('Deleted'); loadChallans() } catch (e: any) { toast.error(e?.message || 'Delete failed') }
  }

  const handleSave = async () => {
    if (!selectedCustomer) { toast.error('Select a customer'); return }
    if (items.length === 0) { toast.error('Add at least one item'); return }
    setSaving(true)
    try {
      await SaveChallan(
        { id: editId, customerId: selectedCustomer, challanDate, status: 'PENDING', notes: remark } as any,
        items.map(i => ({
          id: '', productId: i.productId, quantityMillis: i.quantity * 1000, unitPricePaise: i.pricePaise,
        })) as any
      )
      toast.success('Challan saved')
      resetForm(); setView('list'); loadChallans()
    } catch (e: any) { toast.error(e?.message || 'Save failed') }
    setSaving(false)
  }

  const customerName = (id: string) => customers.find(c => c.id === id)?.name || '—'

  if (view === 'form') {
    return (
      <div className="page" style={{ display: 'flex', flexDirection: 'column', gap: 0, padding: 0 }}>
        <div style={{ background: 'var(--accent)', color: '#fff', padding: '10px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 600, fontSize: '1rem' }}>{editId ? 'Edit Challan' : 'New Customer Challan'}</span>
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
            <label style={{ fontWeight: 600, fontSize: '0.8rem', display: 'block', marginBottom: 2 }}>Challan Date</label>
            <input type="date" className="form-input" value={challanDate} onChange={e => setChallanDate(e.target.value)} />
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
        <span style={{ fontWeight: 600, fontSize: '1rem' }}>Customer Challans</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <select style={{ padding: '4px 8px', borderRadius: 4, border: 'none', fontSize: '0.8rem' }} value={filter} onChange={e => setFilter(e.target.value)}>
            <option value="">All</option>
            <option value="PENDING">Pending</option>
            <option value="INVOICED">Invoiced</option>
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
              <th>Challan #</th>
              <th>Customer</th>
              <th style={{ width: 110 }}>Date</th>
              <th style={{ width: 100 }}>Status</th>
              <th>Notes</th>
              <th style={{ width: 120 }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {challans.map((ch, i) => (
              <tr key={ch.id}>
                <td>{i + 1}</td>
                <td style={{ fontWeight: 500 }}>{ch.challanNumber || '—'}</td>
                <td>{customerName(ch.customerId)}</td>
                <td>{ch.challanDate}</td>
                <td><span style={{ color: statusColor(ch.status), fontWeight: 600, fontSize: '0.8rem' }}>{ch.status}</span></td>
                <td style={{ color: 'var(--fg-muted)', fontSize: '0.85rem' }}>{ch.notes || '—'}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button onClick={() => handleEdit(ch)} style={{ marginRight: 4, padding: '2px 8px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.8rem' }}>✏️ Edit</button>
                  <button onClick={() => handleDelete(ch.id, ch.challanNumber)} style={{ padding: '2px 8px', background: 'var(--error)', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.8rem' }}>🗑</button>
                </td>
              </tr>
            ))}
            {challans.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--fg-muted)' }}>No challans yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
