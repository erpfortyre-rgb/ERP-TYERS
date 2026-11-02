import { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'
import { ListQuotations, SaveQuotation, SearchCustomers, DeleteQuotation } from '../../wailsjs/go/main/App'
import { InvoiceProductTable, InvoiceTotals, LineItem } from './InvoiceForm'

interface Customer { id: string; name: string }
interface QT { id: string; quotationNumber: string; customerId: string; quotationDate: string; validUntil: string; status: string; totalPaise: number; notes: string }

const fmt = (p: number) => '₹' + (p / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })
const today = () => new Date().toISOString().slice(0, 10)

function statusColor(s: string) {
  if (s === 'ACCEPTED') return 'var(--success)'
  if (s === 'REJECTED' || s === 'EXPIRED') return 'var(--error)'
  if (s === 'SENT') return 'var(--accent)'
  return 'var(--warning)'
}

export default function QuotationPage() {
  const [view, setView] = useState<'list' | 'form'>('list')
  const [quotations, setQuotations] = useState<QT[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [filter, setFilter] = useState('')

  const [selectedCustomer, setSelectedCustomer] = useState('')
  const [quoteDate, setQuoteDate] = useState(today())
  const [validTill, setValidTill] = useState('')
  const [items, setItems] = useState<LineItem[]>([])
  const [remark, setRemark] = useState('')
  const [saving, setSaving] = useState(false)
  const [editId, setEditId] = useState('')

  const loadQuotations = useCallback(() => {
    ListQuotations(filter).then(d => setQuotations(d || [])).catch(e => { console.error(e); toast.error('Failed to load quotations') })
  }, [filter])

  useEffect(() => { loadQuotations() }, [loadQuotations])
  useEffect(() => { SearchCustomers('').then(c => setCustomers(c || [])).catch(e => { console.error(e); toast.error('Failed to load customers') }) }, [])

  const resetForm = () => { setEditId(''); setSelectedCustomer(''); setQuoteDate(today()); setValidTill(''); setItems([]); setRemark('') }
  const handleNew = () => { resetForm(); setView('form') }

  const handleEdit = (q: QT) => {
    setEditId(q.id); setSelectedCustomer(q.customerId); setQuoteDate(q.quotationDate)
    setValidTill(q.validUntil || ''); setRemark(q.notes); setItems([])
    setView('form')
  }

  const handleDelete = async (id: string, num: string) => {
    if (!window.confirm(`Delete quotation "${num || id}"?`)) return
    try { await DeleteQuotation(id); toast.success('Deleted'); loadQuotations() } catch (e: any) { toast.error(e?.message || 'Delete failed') }
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
      await SaveQuotation(
        { id: editId, customerId: selectedCustomer, quotationDate: quoteDate, validUntil: validTill,
          status: 'DRAFT', subtotalPaise: subtotal - taxTotal, discountPaise: 0, taxPaise: taxTotal, totalPaise: subtotal, notes: remark } as any,
        items.map(i => ({
          id: '', productId: i.productId, quantityMillis: i.quantity * 1000, unitPricePaise: i.pricePaise,
          discountPaise: 0, taxPercent: i.gstPercent, totalPaise: i.amountPaise,
        })) as any
      )
      toast.success('Quotation saved')
      resetForm(); setView('list'); loadQuotations()
    } catch (e: any) { toast.error(e?.message || 'Save failed') }
    setSaving(false)
  }

  const customerName = (id: string) => customers.find(c => c.id === id)?.name || '—'

  if (view === 'form') {
    return (
      <div className="page" style={{ display: 'flex', flexDirection: 'column', gap: 0, padding: 0 }}>
        <div style={{ background: 'var(--accent)', color: '#fff', padding: '10px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 600, fontSize: '1rem' }}>{editId ? 'Edit Quotation' : 'New Quotation'}</span>
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
            <label style={{ fontWeight: 600, fontSize: '0.8rem', display: 'block', marginBottom: 2 }}>Date</label>
            <input type="date" className="form-input" value={quoteDate} onChange={e => setQuoteDate(e.target.value)} />
          </div>
          <div>
            <label style={{ fontWeight: 600, fontSize: '0.8rem', display: 'block', marginBottom: 2 }}>Valid Till</label>
            <input type="date" className="form-input" value={validTill} onChange={e => setValidTill(e.target.value)} />
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
        <span style={{ fontWeight: 600, fontSize: '1rem' }}>Quotations</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <select style={{ padding: '4px 8px', borderRadius: 4, border: 'none', fontSize: '0.8rem' }} value={filter} onChange={e => setFilter(e.target.value)}>
            <option value="">All</option>
            <option value="DRAFT">Draft</option>
            <option value="SENT">Sent</option>
            <option value="ACCEPTED">Accepted</option>
            <option value="REJECTED">Rejected</option>
            <option value="EXPIRED">Expired</option>
          </select>
          <button className="btn btn-sm" style={{ background: '#fff', color: 'var(--accent)', fontWeight: 600 }} onClick={handleNew}>+ New</button>
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '0 20px 20px' }}>
        <table>
          <thead>
            <tr>
              <th style={{ width: 50 }}>#</th>
              <th>Quotation #</th>
              <th>Customer</th>
              <th style={{ width: 110 }}>Date</th>
              <th style={{ width: 110 }}>Valid Till</th>
              <th style={{ width: 100 }}>Status</th>
              <th style={{ textAlign: 'right', width: 140 }}>Total</th>
              <th style={{ width: 120 }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {quotations.map((q, i) => (
              <tr key={q.id}>
                <td>{i + 1}</td>
                <td style={{ fontWeight: 500 }}>{q.quotationNumber || '—'}</td>
                <td>{customerName(q.customerId)}</td>
                <td>{q.quotationDate}</td>
                <td>{q.validUntil || '—'}</td>
                <td><span style={{ color: statusColor(q.status), fontWeight: 600, fontSize: '0.8rem' }}>{q.status}</span></td>
                <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(q.totalPaise)}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button onClick={() => handleEdit(q)} style={{ marginRight: 4, padding: '2px 8px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.8rem' }}>✏️ Edit</button>
                  <button onClick={() => handleDelete(q.id, q.quotationNumber)} style={{ padding: '2px 8px', background: 'var(--error)', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.8rem' }}>🗑</button>
                </td>
              </tr>
            ))}
            {quotations.length === 0 && (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--fg-muted)' }}>No quotations yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
