import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { ListCompanies, ListPurchaseOrders, SearchProducts, SavePurchaseOrder, DeletePurchaseOrder } from '../../wailsjs/go/main/App'

interface Company { id: string; name: string }
interface ProductResult { id: string; name: string; hsnCode: string; taxPercent: number; prices: { tier: string; pricePaise: number }[] }
interface LineItem {
  productId: string; productName: string; gstPercent: number; hsnCode: string
  quantity: number; pricePaise: number; taxIncluded: boolean; amountPaise: number
}
interface PurchaseRecord { id: string; companyId: string; orderNumber: string; orderDate: string; status: string; totalPaise: number; notes: string }

const today = () => new Date().toISOString().slice(0, 10)
const fmt = (p: number) => p === 0 ? '0' : (p / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })

export default function PurchaseInvoice() {
  const [view, setView] = useState<'list' | 'form'>('list')
  const [invoices, setInvoices] = useState<PurchaseRecord[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [selectedCompany, setSelectedCompany] = useState('')
  const [invoiceType, setInvoiceType] = useState<'CREDIT' | 'CASH'>('CREDIT')
  const [invoiceDate, setInvoiceDate] = useState(today())
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [items, setItems] = useState<LineItem[]>([])
  const [discountPercent, setDiscountPercent] = useState(0)
  const [freightPaise, setFreightPaise] = useState(0)
  const [freightGstPercent, setFreightGstPercent] = useState(18)
  const [remark, setRemark] = useState('')
  const [productSearch, setProductSearch] = useState('')
  const [productResults, setProductResults] = useState<ProductResult[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editId, setEditId] = useState('')

  const loadInvoices = () => {
    ListPurchaseOrders('').then((r: any) => setInvoices(r || [])).catch(console.error)
  }

  useEffect(() => {
    ListCompanies('').then(c => setCompanies(c || [])).catch(e => { console.error(e); toast.error('Failed to load companies') })
    loadInvoices()
  }, [])

  useEffect(() => {
    if (productSearch.length >= 2) {
      SearchProducts(productSearch).then((p: any) => { setProductResults(p || []); setShowDropdown(true) }).catch(console.error)
    } else { setProductResults([]); setShowDropdown(false) }
  }, [productSearch])

  const addItem = (product: ProductResult) => {
    const mrp = product.prices?.find(p => p.tier === 'MRP')?.pricePaise || product.prices?.[0]?.pricePaise || 0
    setItems([...items, {
      productId: product.id, productName: product.name, gstPercent: product.taxPercent || 0,
      hsnCode: product.hsnCode, quantity: 1, pricePaise: mrp,
      taxIncluded: true, amountPaise: mrp
    }])
    setProductSearch('')
    setShowDropdown(false)
  }

  const updateItem = (idx: number, field: string, value: any) => {
    const updated = [...items]
    const item = { ...updated[idx], [field]: value }
    item.amountPaise = item.quantity * item.pricePaise
    updated[idx] = item
    setItems(updated)
  }

  const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx))

  const totalQty = items.reduce((s, i) => s + i.quantity, 0)
  const subtotal = items.reduce((s, i) => s + i.amountPaise, 0)
  const taxableAmount = items.reduce((s, i) => {
    if (i.taxIncluded) return s + Math.round(i.amountPaise * 100 / (100 + i.gstPercent))
    return s + i.amountPaise
  }, 0)
  const totalGst = items.reduce((s, i) => {
    if (i.taxIncluded) {
      // Tax-inclusive: back-calculate tax from the inclusive amount
      return s + (i.amountPaise - Math.round(i.amountPaise * 100 / (100 + i.gstPercent)))
    }
    // Tax-exclusive: compute tax to add on top
    return s + Math.round(i.amountPaise * i.gstPercent / 100)
  }, 0)
  const cgst = Math.round(totalGst / 2)
  const sgst = totalGst - cgst
  const discountAmount = Math.round(subtotal * discountPercent / 100)
  const freightTotal = freightPaise + Math.round(freightPaise * freightGstPercent / 100)
  // For tax-inclusive items, tax is already in subtotal; for tax-exclusive, add GST
  const itemTaxExclGst = items.reduce((s, i) => s + (i.taxIncluded ? 0 : Math.round(i.amountPaise * i.gstPercent / 100)), 0)
  const grandTotal = subtotal + itemTaxExclGst - discountAmount + freightTotal

  const handleSave = async () => {
    if (!selectedCompany) { toast.error('Select a company'); return }
    if (items.length === 0) { toast.error('Add at least one item'); return }
    setSaving(true)
    try {
      await SavePurchaseOrder(
        { id: editId, companyId: selectedCompany, orderNumber: invoiceNumber, orderDate: invoiceDate, status: 'RECEIVED',
          subtotalPaise: grandTotal - totalGst, taxPaise: totalGst, totalPaise: grandTotal, notes: remark } as any,
        items.map(i => ({
          id: '', productId: i.productId, quantityMillis: i.quantity * 1000, unitPricePaise: i.pricePaise,
          taxPercent: i.gstPercent,
          totalPaise: i.taxIncluded ? i.amountPaise : i.amountPaise + Math.round(i.amountPaise * i.gstPercent / 100),
        })) as any
      )
      toast.success('Purchase invoice saved')
      setItems([]); setSelectedCompany(''); setInvoiceNumber(''); setRemark(''); setDiscountPercent(0); setFreightPaise(0)
      loadInvoices(); setView('list')
    } catch (e: any) { toast.error(e?.message || 'Save failed') }
    setSaving(false)
  }

  const handleEditInvoice = (inv: PurchaseRecord) => {
    setEditId(inv.id)
    setSelectedCompany(inv.companyId)
    setInvoiceNumber(inv.orderNumber)
    setInvoiceDate(inv.orderDate?.slice(0, 10) || today())
    setRemark(inv.notes)
    setItems([])
    setView('form')
  }

  const handleDeleteInvoice = async (id: string, num: string) => {
    if (!window.confirm(`Delete invoice "${num || id}"? This cannot be undone.`)) return
    try {
      await DeletePurchaseOrder(id)
      toast.success('Invoice deleted')
      loadInvoices()
    } catch (e: any) { toast.error(e?.message || 'Delete failed') }
  }

  if (view === 'list') {
    const companyMap = Object.fromEntries(companies.map(c => [c.id, c.name]))
    const statusColor = (s: string) => s === 'RECEIVED' ? 'var(--success)' : s === 'CANCELLED' ? 'var(--error)' : 'var(--accent)'
    return (
      <div className="page">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--fg-bright)' }}>Purchase Invoices</h2>
          <button className="btn btn-primary" onClick={() => { setEditId(''); setView('form'); setItems([]); setSelectedCompany(''); setInvoiceNumber(''); setRemark(''); setDiscountPercent(0); setFreightPaise(0); setInvoiceDate(today()) }}>+ New Invoice</button>
        </div>
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table>
            <thead>
              <tr>
                <th>Invoice No.</th><th>Company</th><th>Date</th><th>Status</th><th style={{ textAlign: 'right' }}>Total</th><th>Notes</th><th>Action</th>
              </tr>
            </thead>
            <tbody>
              {invoices.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--fg-muted)' }}>No purchase invoices yet. Click "+ New Invoice" to create one.</td></tr>
              ) : invoices.map(inv => (
                <tr key={inv.id}>
                  <td style={{ fontWeight: 600 }}>{inv.orderNumber || '—'}</td>
                  <td>{companyMap[inv.companyId] || '—'}</td>
                  <td>{inv.orderDate?.slice(0, 10) || '—'}</td>
                  <td><span style={{ padding: '2px 8px', borderRadius: 4, fontSize: '0.8rem', background: statusColor(inv.status), color: '#fff' }}>{inv.status}</span></td>
                  <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--accent)' }}>₹{fmt(inv.totalPaise)}</td>
                  <td style={{ color: 'var(--fg-muted)' }}>{inv.notes || '—'}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button onClick={() => handleEditInvoice(inv)} style={{ marginRight: 4, padding: '2px 8px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.8rem' }}>✏️ Edit</button>
                    <button onClick={() => handleDeleteInvoice(inv.id, inv.orderNumber)} style={{ padding: '2px 8px', background: 'var(--error)', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.8rem' }}>🗑 Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column', gap: 0, padding: 0 }}>
      {/* Header */}
      <div style={{ background: 'var(--accent)', color: '#fff', padding: '10px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 600, fontSize: '1rem' }}>Purchase Invoice</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-sm" style={{ background: 'var(--bg-card)', color: 'var(--fg)' }} onClick={() => setView('list')}>← Back to List</button>
        </div>
      </div>

      {/* Credit/Cash toggle + Company + Date */}
      <div style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 0, borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border)' }}>
          <button onClick={() => setInvoiceType('CREDIT')}
            style={{ padding: '6px 16px', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem',
              background: invoiceType === 'CREDIT' ? 'var(--accent)' : 'var(--bg-card)',
              color: invoiceType === 'CREDIT' ? '#fff' : 'var(--fg)' }}>Credit</button>
          <button onClick={() => setInvoiceType('CASH')}
            style={{ padding: '6px 16px', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem',
              background: invoiceType === 'CASH' ? 'var(--accent)' : 'var(--bg-card)',
              color: invoiceType === 'CASH' ? '#fff' : 'var(--fg)' }}>Cash</button>
        </div>

        <div style={{ flex: 1, minWidth: 200 }}>
          <label style={{ fontWeight: 600, fontSize: '0.8rem', display: 'block', marginBottom: 2 }}>Company Name</label>
          <select className="form-input" value={selectedCompany}
            onChange={e => setSelectedCompany(e.target.value)}
            style={{ background: 'var(--bg-input)', borderColor: 'var(--accent)' }}>
            <option value="">Select Company</option>
            {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        <div>
          <label style={{ fontWeight: 600, fontSize: '0.8rem', display: 'block', marginBottom: 2 }}>Invoice No.</label>
          <input value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)}
            placeholder="Invoice Number"
            style={{ padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 4, width: 160 }} />
        </div>

        <div>
          <label style={{ fontWeight: 600, fontSize: '0.8rem', display: 'block', marginBottom: 2 }}>Date</label>
          <input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)}
            style={{ padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 4 }} />
        </div>
      </div>

      {/* Product table */}
      <div style={{ flex: 1, overflow: 'auto', padding: '0 20px' }}>
        <table>
          <thead>
            <tr>
              <th style={{ width: 50 }}>S.NO</th>
              <th>PRODUCT NAME</th>
              <th style={{ width: 70 }}>GST%</th>
              <th style={{ width: 100 }}>HSN-SAC</th>
              <th style={{ width: 80 }}>QUANTITY</th>
              <th style={{ width: 150 }}>
                PRICE
                <span style={{ fontSize: '0.7rem', marginLeft: 4, opacity: 0.8 }}>Tax Included</span>
              </th>
              <th style={{ textAlign: 'right', width: 120 }}>AMOUNT</th>
              <th style={{ width: 60 }}>ACTION</th>
            </tr>
          </thead>
          <tbody>
            {/* Add product row */}
            <tr>
              <td style={{ color: 'var(--fg-muted)' }}>#</td>
              <td style={{ position: 'relative' }}>
                <input value={productSearch} onChange={e => setProductSearch(e.target.value)}
                  placeholder="Search product..."
                  onFocus={() => productResults.length > 0 && setShowDropdown(true)}
                  onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                  style={{ width: '100%', padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 4 }} />
                {showDropdown && productResults.length > 0 && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-card)',
                    border: '1px solid var(--border)', borderRadius: 4, maxHeight: 200, overflow: 'auto', zIndex: 10,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                  }}>
                    {productResults.map(p => (
                      <div key={p.id} onMouseDown={() => addItem(p)}
                        style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid var(--border)', fontSize: '0.85rem' }}>
                        <strong>{p.name}</strong>
                        <span style={{ marginLeft: 8, color: 'var(--fg-muted)' }}>GST: {p.taxPercent}% | HSN: {p.hsnCode}</span>
                      </div>
                    ))}
                  </div>
                )}
              </td>
              <td></td><td></td><td></td><td></td><td></td><td></td>
            </tr>

            {items.map((item, i) => (
              <tr key={i}>
                <td>{i + 1}</td>
                <td style={{ fontWeight: 500 }}>{item.productName}</td>
                <td>{item.gstPercent}%</td>
                <td>{item.hsnCode}</td>
                <td>
                  <input type="number" value={item.quantity} min={1}
                    onChange={e => updateItem(i, 'quantity', parseInt(e.target.value) || 1)}
                    style={{ width: 60, padding: '4px 6px', textAlign: 'center', border: '1px solid var(--border)', borderRadius: 4 }} />
                </td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input type="number" value={(item.pricePaise / 100).toFixed(2)}
                      onChange={e => updateItem(i, 'pricePaise', Math.round(parseFloat(e.target.value || '0') * 100))}
                      style={{ width: 90, padding: '4px 6px', textAlign: 'right', border: '1px solid var(--border)', borderRadius: 4 }} />
                    <button onClick={() => updateItem(i, 'taxIncluded', !item.taxIncluded)}
                      style={{
                        width: 32, height: 18, borderRadius: 9, position: 'relative', cursor: 'pointer',
                        background: item.taxIncluded ? 'var(--accent)' : '#ccc', border: 'none', transition: 'background 0.2s'
                      }}>
                      <span style={{
                        position: 'absolute', top: 1.5, width: 15, height: 15, borderRadius: '50%', background: '#fff',
                        left: item.taxIncluded ? 15.5 : 1.5, transition: 'left 0.2s',
                      }} />
                    </button>
                  </div>
                </td>
                <td style={{ textAlign: 'right', fontWeight: 500 }}>{fmt(item.amountPaise)}</td>
                <td>
                  <button onClick={() => removeItem(i)}
                    style={{ padding: '2px 8px', background: 'var(--error)', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>✕</button>
                </td>
              </tr>
            ))}

            {items.length === 0 && (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--fg-muted)' }}>Search and add products above</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Bottom summary */}
      <div style={{ borderTop: '2px solid var(--border)', padding: '12px 20px', display: 'flex', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
        {/* Left: Tax summary */}
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--fg-muted)' }}>Total Qty</div>
            <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{totalQty}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--fg-muted)' }}>Taxable</div>
            <div style={{ fontWeight: 700 }}>{fmt(taxableAmount)}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--fg-muted)' }}>CGST</div>
            <div style={{ fontWeight: 700 }}>{fmt(cgst)}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--fg-muted)' }}>SGST</div>
            <div style={{ fontWeight: 700 }}>{fmt(sgst)}</div>
          </div>
        </div>

        {/* Right: Totals */}
        <div style={{ minWidth: 240 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span>Subtotal</span>
            <span style={{ fontWeight: 600 }}>{fmt(subtotal)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span>Discount</span>
              <input type="number" value={discountPercent || ''} placeholder="0"
                onChange={e => setDiscountPercent(parseFloat(e.target.value) || 0)}
                style={{ width: 50, padding: '2px 4px', textAlign: 'right', border: '1px solid var(--border)', borderRadius: 4 }} />
              <span>%</span>
            </div>
            <span style={{ color: 'var(--error)' }}>-{fmt(discountAmount)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span>Freight</span>
              <input type="number" value={freightPaise ? freightPaise / 100 : ''} placeholder="0"
                onChange={e => setFreightPaise(Math.round(parseFloat(e.target.value || '0') * 100))}
                style={{ width: 70, padding: '2px 4px', textAlign: 'right', border: '1px solid var(--border)', borderRadius: 4 }} />
            </div>
            <span>+{fmt(freightTotal)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <span>Remark</span>
            <input value={remark} onChange={e => setRemark(e.target.value)} placeholder="Enter remark"
              style={{ width: 160, padding: '2px 6px', border: '1px solid var(--border)', borderRadius: 4 }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '1.1rem', borderTop: '1px solid var(--border)', paddingTop: 8 }}>
            <span>Grand Total</span>
            <span style={{ color: 'var(--accent)' }}>{fmt(grandTotal)}</span>
          </div>
        </div>
      </div>

      {/* Action bar */}
      <div style={{ padding: '8px 20px 12px', display: 'flex', gap: 8, justifyContent: 'flex-end', borderTop: '1px solid var(--border)' }}>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ padding: '8px 24px' }}>{saving ? 'Saving...' : 'Save'}</button>
        <button className="btn" style={{ background: '#6c757d', color: '#fff', padding: '8px 16px' }} onClick={() => toast('Feature coming soon')}>Convert Type</button>
        <button className="btn" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', padding: '8px 16px' }} onClick={() => toast('Print coming soon')}>Print</button>
        <button className="btn" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', padding: '8px 16px' }} onClick={() => setView('list')}>Close</button>
      </div>
    </div>
  )
}
