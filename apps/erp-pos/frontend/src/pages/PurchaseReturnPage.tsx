import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { ListCompanies, SearchProducts, SavePurchaseReturn, ListPurchaseReturns, DeletePurchaseReturn } from '../../wailsjs/go/main/App'

interface PurchaseReturnRecord { id: string; companyId: string; returnNumber: string; returnDate: string; totalPaise: number; notes: string }

interface Company { id: string; name: string }
interface ProductResult { id: string; name: string; hsnCode: string; taxPercent: number; prices: { tier: string; pricePaise: number }[] }
interface LineItem {
  productId: string; productName: string; gstPercent: number; hsnCode: string
  quantity: number; pricePaise: number; amountPaise: number
}

const today = () => new Date().toISOString().slice(0, 10)
const fmt = (p: number) => p === 0 ? '0' : (p / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })

export default function PurchaseReturnPage() {
  const [view, setView] = useState<'list' | 'form'>('list')
  const [returns, setReturns] = useState<PurchaseReturnRecord[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [selectedCompany, setSelectedCompany] = useState('')
  const [returnDate, setReturnDate] = useState(today())
  const [originalBill, setOriginalBill] = useState('')
  const [items, setItems] = useState<LineItem[]>([])
  const [remark, setRemark] = useState('')
  const [saving, setSaving] = useState(false)
  const [editId, setEditId] = useState('')
  const [productSearch, setProductSearch] = useState('')
  const [productResults, setProductResults] = useState<ProductResult[]>([])
  const [showDropdown, setShowDropdown] = useState(false)

  const loadReturns = () => {
    ListPurchaseReturns().then((r: any) => setReturns(r || [])).catch(console.error)
  }

  useEffect(() => {
    ListCompanies('').then(c => setCompanies(c || [])).catch(e => { console.error(e); toast.error('Failed to load companies') })
    loadReturns()
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
      hsnCode: product.hsnCode, quantity: 1, pricePaise: mrp, amountPaise: mrp
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
  const taxableAmount = items.reduce((s, i) => s + Math.round(i.amountPaise * 100 / (100 + i.gstPercent)), 0)
  const totalGst = subtotal - taxableAmount
  const cgst = Math.round(totalGst / 2)
  const sgst = totalGst - cgst

  const handleEdit = (r: PurchaseReturnRecord) => {
    setEditId(r.id)
    setSelectedCompany(r.companyId)
    setReturnDate(r.returnDate)
    setOriginalBill((r as any).purchaseId || '')
    setRemark(r.notes || '')
    setItems([])
    setView('form')
  }

  const handleDelete = async (id: string, num: string) => {
    if (!window.confirm(`Delete purchase return ${num}?`)) return
    try {
      await DeletePurchaseReturn(id)
      toast.success('Deleted')
      loadReturns()
    } catch (e: any) { toast.error(e?.message || 'Delete failed') }
  }

  const handleSave = async () => {
    if (!selectedCompany) { toast.error('Select a company'); return }
    if (items.length === 0) { toast.error('Add at least one item'); return }
    setSaving(true)
    try {
      await SavePurchaseReturn(
        { id: editId, companyId: selectedCompany, returnDate, purchaseId: originalBill,
          subtotalPaise: taxableAmount, taxPaise: totalGst, totalPaise: subtotal, notes: remark } as any,
        items.map(i => ({
          id: '', productId: i.productId, quantityMillis: i.quantity * 1000, unitPricePaise: i.pricePaise,
          taxPercent: i.gstPercent, totalPaise: i.amountPaise
        })) as any
      )
      toast.success('Purchase return saved')
      setEditId('')
      setItems([]); setSelectedCompany(''); setOriginalBill(''); setRemark('')
      loadReturns(); setView('list')
    } catch (e: any) { toast.error(e?.message || 'Save failed') }
    setSaving(false)
  }

  if (view === 'list') {
    const companyMap = Object.fromEntries(companies.map(c => [c.id, c.name]))
    return (
      <div className="page">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--fg-bright)' }}>Purchase Returns</h2>
          <button className="btn btn-primary" onClick={() => { setEditId(''); setView('form'); setItems([]); setSelectedCompany(''); setOriginalBill(''); setRemark(''); setReturnDate(today()) }}>+ New Return</button>
        </div>
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table>
            <thead>
              <tr>
                <th>Return No.</th>
                <th>Date</th>
                <th>Company</th>
                <th>Original Bill</th>
                <th style={{ textAlign: 'right' }}>Total</th>
                <th>Notes</th>
                <th style={{ width: 100 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {returns.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--fg-muted)' }}>No purchase returns yet. Click "+ New Return" to create one.</td></tr>
              ) : returns.map(r => (
                <tr key={r.id}>
                  <td style={{ fontWeight: 600 }}>{r.returnNumber || '—'}</td>
                  <td>{r.returnDate}</td>
                  <td>{companyMap[r.companyId] || '—'}</td>
                  <td style={{ color: 'var(--fg-muted)' }}>{(r as any).purchaseId || '—'}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--accent)' }}>₹{(r.totalPaise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  <td style={{ color: 'var(--fg-muted)' }}>{r.notes || '—'}</td>
                  <td>
                    <button onClick={() => handleEdit(r)} style={{ padding: '2px 8px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', marginRight: 4 }}>✏️</button>
                    <button onClick={() => handleDelete(r.id, r.returnNumber || r.id)} style={{ padding: '2px 8px', background: 'var(--error)', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>🗑</button>
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
      <div style={{ background: 'var(--accent)', color: '#fff', padding: '10px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 600, fontSize: '1rem' }}>Purchase Return</span>
        <button className="btn btn-sm" style={{ background: 'var(--bg-card)', color: 'var(--fg)' }} onClick={() => setView('list')}>← Back to List</button>
      </div>

      <div style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
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
          <label style={{ fontWeight: 600, fontSize: '0.8rem', display: 'block', marginBottom: 2 }}>Original Bill No.</label>
          <input value={originalBill} onChange={e => setOriginalBill(e.target.value)} placeholder="Bill No."
            style={{ padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 4, width: 140 }} />
        </div>
        <div>
          <label style={{ fontWeight: 600, fontSize: '0.8rem', display: 'block', marginBottom: 2 }}>Date</label>
          <input type="date" value={returnDate} onChange={e => setReturnDate(e.target.value)}
            style={{ padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 4 }} />
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '0 20px' }}>
        <table>
          <thead>
            <tr>
              <th style={{ width: 50 }}>S.NO</th>
              <th>PRODUCT NAME</th>
              <th style={{ width: 70 }}>GST%</th>
              <th style={{ width: 100 }}>HSN-SAC</th>
              <th style={{ width: 80 }}>QUANTITY</th>
              <th style={{ width: 120 }}>PRICE</th>
              <th style={{ textAlign: 'right', width: 120 }}>AMOUNT</th>
              <th style={{ width: 60 }}>ACTION</th>
            </tr>
          </thead>
          <tbody>
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
                        <span style={{ marginLeft: 8, color: 'var(--fg-muted)' }}>GST: {p.taxPercent}%</span>
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
                  <input type="number" value={(item.pricePaise / 100).toFixed(2)}
                    onChange={e => updateItem(i, 'pricePaise', Math.round(parseFloat(e.target.value || '0') * 100))}
                    style={{ width: 100, padding: '4px 6px', textAlign: 'right', border: '1px solid var(--border)', borderRadius: 4 }} />
                </td>
                <td style={{ textAlign: 'right', fontWeight: 500 }}>{fmt(item.amountPaise)}</td>
                <td>
                  <button onClick={() => removeItem(i)}
                    style={{ padding: '2px 8px', background: 'var(--error)', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>✕</button>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--fg-muted)' }}>Search and add products to return</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div style={{ borderTop: '2px solid var(--border)', padding: '12px 20px', display: 'flex', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 24 }}>
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
        <div style={{ minWidth: 200 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span>Remark</span>
            <input value={remark} onChange={e => setRemark(e.target.value)} placeholder="Return reason"
              style={{ width: 140, padding: '2px 6px', border: '1px solid var(--border)', borderRadius: 4 }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '1.1rem', borderTop: '1px solid var(--border)', paddingTop: 8 }}>
            <span>Total</span>
            <span style={{ color: 'var(--accent)' }}>{fmt(subtotal)}</span>
          </div>
        </div>
      </div>

      <div style={{ padding: '8px 20px 12px', display: 'flex', gap: 8, justifyContent: 'flex-end', borderTop: '1px solid var(--border)' }}>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ padding: '8px 24px' }}>{saving ? 'Saving...' : 'Save'}</button>
        <button className="btn" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', padding: '8px 16px' }}>Print</button>
        <button className="btn" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', padding: '8px 16px' }} onClick={() => setView('list')}>Close</button>
      </div>
    </div>
  )
}
