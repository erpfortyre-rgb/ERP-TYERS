import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { FiTrash2, FiPlus, FiSearch, FiSave, FiPrinter } from 'react-icons/fi'
import toast from 'react-hot-toast'
import { SearchProducts, FindByBarcode, FinalizeSale, SearchCustomers, SaveCustomer, GetSettings } from '../../wailsjs/go/main/App'
import HistoryPickerField from '../components/HistoryPickerField'

interface ProductPrice { id: string; productId: string; tier: string; pricePaise: number; validFrom: string }
interface Product {
  id: string; name: string; sku: string; barcode: string; hsnCode: string
  taxPercent: number; isKit: boolean; categoryName: string; brandName: string
  stockQtyMillis: number; prices: ProductPrice[]
}
interface Customer { id: string; name: string; phone: string; email: string; gstin: string }
// Identical shape to Billing.tsx CartLine / SaleLineInput
interface CartLine {
  productId: string; productName: string; hsnCode: string
  quantityMillis: number; priceTier: string; unitPricePaise: number
  discountPaise: number; taxPercent: number
}
interface Payment { method: string; amountPaise: number; referenceNumber: string }
type PayMethod = 'CASH' | 'CARD' | 'UPI' | 'CHEQUE' | 'CREDIT'

function formatMoney(paise: number): string {
  return '₹ ' + (paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// COPIED VERBATIM from Billing.tsx
function calcLine(line: CartLine) {
  const gross = (line.unitPricePaise * line.quantityMillis) / 1000
  const afterDiscount = gross - line.discountPaise
  // MRP is tax-inclusive in India — back-calculate taxable from gross
  const taxable = Math.round(afterDiscount * 100 / (100 + line.taxPercent))
  const tax = afterDiscount - taxable
  return { gross, taxable, tax, total: afterDiscount }
}

function nowLocalInput(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

const sectionStyle: React.CSSProperties = {
  background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: 16, marginBottom: 14,
}
const sectionTitle: React.CSSProperties = {
  fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--fg-muted)', marginBottom: 12, textTransform: 'uppercase',
}
const labelStyle: React.CSSProperties = { display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--fg-muted)', marginBottom: 4 }
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)',
  background: 'var(--bg-input)', color: 'var(--fg)', fontSize: '0.88rem', boxSizing: 'border-box',
}
const cellInput: React.CSSProperties = { ...inputStyle, padding: '6px 8px', textAlign: 'right' }
const th: React.CSSProperties = {
  padding: '8px 10px', fontSize: '0.72rem', fontWeight: 700, color: 'var(--fg-muted)', textAlign: 'left',
  borderBottom: '1px solid var(--border)', background: 'var(--bg-sidebar)', whiteSpace: 'nowrap',
}
const td: React.CSSProperties = { padding: '6px 10px', borderBottom: '1px solid var(--border)', fontSize: '0.85rem', color: 'var(--fg)' }
const btnBase: React.CSSProperties = {
  padding: '10px 22px', borderRadius: 8, fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer',
  border: 'none', color: '#fff', display: 'flex', alignItems: 'center', gap: 8,
}

export default function AddSalePage() {
  const navigate = useNavigate()

  // Party & invoice
  const [customer, setCustomer] = useState<Customer | null>(null) // null = Walk-In
  const [custQuery, setCustQuery] = useState('')
  const [custResults, setCustResults] = useState<Customer[]>([])
  const [showCustList, setShowCustList] = useState(false)
  const [showNewCust, setShowNewCust] = useState(false)
  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [saleDate, setSaleDate] = useState(nowLocalInput())
  const [notes, setNotes] = useState('')
  const [terms, setTerms] = useState('')
  const [defaultTerms, setDefaultTerms] = useState('')

  // Items
  const [cart, setCart] = useState<CartLine[]>([])
  const [qtyText, setQtyText] = useState<Record<number, string>>({})
  const [prodQuery, setProdQuery] = useState('')
  const [prodResults, setProdResults] = useState<Product[]>([])
  const [showProdList, setShowProdList] = useState(false)
  const prodRef = useRef<HTMLInputElement>(null)

  // Payment
  const [method, setMethod] = useState<PayMethod>('CASH')
  const [amountText, setAmountText] = useState('')
  const [amountTouched, setAmountTouched] = useState(false)
  const [refNo, setRefNo] = useState('')
  const [saving, setSaving] = useState(false)

  // ---- Totals: same math as Billing.tsx ----
  const subtotal = cart.reduce((sum, line) => sum + calcLine(line).gross, 0)
  const totalDiscount = cart.reduce((sum, line) => sum + line.discountPaise, 0)
  // subtotal is MRP-inclusive (already contains tax), so don't add tax again
  const grandTotal = subtotal - totalDiscount
  const roundoff = Math.round(grandTotal / 100) * 100 - grandTotal
  const payable = grandTotal + roundoff
  const itemCount = cart.reduce((s, l) => s + l.quantityMillis / 1000, 0)

  // Keep default amount = payable until user edits it
  useEffect(() => {
    if (!amountTouched) setAmountText(payable > 0 ? String(payable / 100) : '')
  }, [payable, amountTouched])

  // Pre-fill Terms from the global Settings default (owner can still change per bill).
  useEffect(() => {
    GetSettings().then((s: any) => {
      const t = (s && s.terms_conditions) || ''
      if (t) { setDefaultTerms(t); setTerms(prev => prev || t) }
    }).catch(() => {})
  }, [])

  // Customer search
  useEffect(() => {
    if (!showCustList) return
    try { SearchCustomers(custQuery).then(c => setCustResults(c || [])).catch(console.error) } catch { /* ignore */ }
  }, [custQuery, showCustList])

  // Product search
  useEffect(() => {
    if (!showProdList || prodQuery.trim().length < 2) { setProdResults([]); return }
    try { SearchProducts(prodQuery.trim()).then(r => setProdResults((r || []) as any)).catch(console.error) } catch { /* ignore */ }
  }, [prodQuery, showProdList])

  const addToCart = useCallback((product: Product) => {
    setCart(prev => {
      const existing = prev.findIndex(c => c.productId === product.id)
      if (existing >= 0) {
        const updated = [...prev]
        updated[existing] = { ...updated[existing], quantityMillis: updated[existing].quantityMillis + 1000 }
        return updated
      }
      const mrpPrice = product.prices?.find(p => p.tier === 'MRP')
      return [...prev, {
        productId: product.id, productName: product.name, hsnCode: product.hsnCode || '',
        quantityMillis: 1000, priceTier: 'MRP', unitPricePaise: mrpPrice?.pricePaise || 0,
        discountPaise: 0, taxPercent: product.taxPercent,
      }]
    })
    setQtyText({})
  }, [])

  const pickProduct = (p: Product) => {
    addToCart(p)
    setProdQuery(''); setProdResults([]); setShowProdList(false)
    prodRef.current?.focus()
  }

  const handleProdKeyDown = async (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter' || !prodQuery.trim()) return
    e.preventDefault()
    try {
      const product = await FindByBarcode(prodQuery.trim())
      addToCart(product as any)
      setProdQuery(''); setProdResults([]); setShowProdList(false)
      toast.success(`Added: ${product.name}`)
    } catch {
      if (prodResults.length === 1) pickProduct(prodResults[0])
      else toast.error('No exact match - pick from the list')
    }
  }

  const updateLine = (index: number, patch: Partial<CartLine>) =>
    setCart(prev => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)))

  const removeLine = (index: number) => { setCart(prev => prev.filter((_, i) => i !== index)); setQtyText({}) }

  const commitQty = (index: number, text: string) => {
    const q = parseFloat(text)
    const millis = isFinite(q) && q > 0 ? Math.round(q * 1000) : 1000
    updateLine(index, { quantityMillis: millis })
    setQtyText(prev => { const n = { ...prev }; delete n[index]; return n })
  }

  const rupeesToPaise = (s: string): number => {
    const v = parseFloat(s)
    return isFinite(v) && v >= 0 ? Math.round(v * 100) : 0
  }

  const createCustomer = async () => {
    if (!newName.trim()) { toast.error('Customer name is required'); return }
    try {
      const id = await SaveCustomer({ id: '', name: newName.trim(), phone: newPhone.trim(), email: '', gstin: '', address: '', creditLimitPaise: 0, isActive: true } as any)
      toast.success('Customer created')
      setCustomer({ id: id as any, name: newName.trim(), phone: newPhone.trim(), email: '', gstin: '' })
      setShowNewCust(false); setNewName(''); setNewPhone('')
    } catch (e: any) { toast.error(e?.message || 'Failed to create customer') }
  }

  const resetForm = () => {
    setCart([]); setQtyText({}); setCustomer(null); setCustQuery(''); setNotes(''); setTerms(defaultTerms)
    setSaleDate(nowLocalInput()); setMethod('CASH'); setAmountTouched(false); setRefNo('')
    setProdQuery(''); setProdResults([])
  }

  const save = async (andPrint: boolean) => {
    if (saving) return
    if (cart.length === 0) { toast.error('Add at least one item'); return }
    if (cart.some(l => l.quantityMillis <= 0)) { toast.error('Quantity must be greater than zero'); return }
    if (payable <= 0) { toast.error('Total payable must be greater than zero'); return }
    const amt = parseFloat(amountText || '0')
    if (!isFinite(amt) || amt < 0) { toast.error('Enter a valid payment amount'); return }
    const amountPaise = Math.round(amt * 100)
    const payments: Payment[] = [{ method, amountPaise, referenceNumber: refNo }]
    setSaving(true)
    try {
      let cbName = '', cbEmail = ''
      try { const u = JSON.parse(localStorage.getItem('sst_user') || '{}'); cbName = u.name || ''; cbEmail = u.email || '' } catch { /* ignore */ }
      const result = await FinalizeSale({
        customerId: customer?.id || '',
        lines: cart, payments, notes, terms,
        createdBy: cbName, createdByEmail: cbEmail,
      } as any)
      toast.success(`Invoice ${result.invoiceNumber} saved!`)
      if (andPrint) navigate('/print/invoice/' + result.id)
      else resetForm()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save invoice')
    } finally {
      setSaving(false)
    }
  }

  const amountPaiseNow = Math.round((parseFloat(amountText || '0') || 0) * 100)
  const balance = payable - amountPaiseNow

  const dropdown: React.CSSProperties = {
    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20, maxHeight: 280, overflowY: 'auto',
    background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 6, boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
  }

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: 20, background: 'var(--bg-sidebar)', boxSizing: 'border-box' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <h2 style={{ margin: '0 0 14px', fontSize: '1.2rem', color: 'var(--fg-bright)' }}>Add Sale</h2>

        {/* 1. PARTY & INVOICE DETAILS */}
        <div style={sectionStyle}>
          <div style={sectionTitle}>Party &amp; Invoice Details</div>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 14 }}>
            <div style={{ position: 'relative' }}>
              <label style={labelStyle}>Customer</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  style={inputStyle}
                  placeholder="Search customer by name or phone..."
                  value={showCustList ? custQuery : (customer ? `${customer.name}${customer.phone ? ' - ' + customer.phone : ''}` : 'Walk-In Customer')}
                  onFocus={() => { setShowCustList(true); setCustQuery('') }}
                  onChange={e => setCustQuery(e.target.value)}
                  onBlur={() => setTimeout(() => setShowCustList(false), 150)}
                />
                <button type="button" onClick={() => setShowNewCust(v => !v)}
                  style={{ ...btnBase, background: 'var(--accent)', padding: '8px 14px', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                  <FiPlus size={14} /> Add
                </button>
              </div>
              {showCustList && (
                <div style={dropdown}>
                  <div onMouseDown={() => { setCustomer(null); setShowCustList(false) }}
                    style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid var(--border)', fontWeight: 600, color: 'var(--fg)' }}>
                    Walk-In Customer
                  </div>
                  {custResults.map(c => (
                    <div key={c.id} onMouseDown={() => { setCustomer(c); setShowCustList(false) }}
                      style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ fontWeight: 600, color: 'var(--fg)' }}>{c.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--fg-muted)' }}>{c.phone} {c.gstin && `· GSTIN: ${c.gstin}`}</div>
                    </div>
                  ))}
                  {custResults.length === 0 && (
                    <div style={{ padding: 12, textAlign: 'center', color: 'var(--fg-muted)', fontSize: '0.8rem' }}>No customers found</div>
                  )}
                </div>
              )}
            </div>
            <div>
              <label style={labelStyle}>Sale Date</label>
              <input type="datetime-local" style={inputStyle} value={saleDate} onChange={e => setSaleDate(e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Invoice No</label>
              <input style={{ ...inputStyle, opacity: 0.7 }} value="" placeholder="Auto-generated on save" readOnly />
            </div>
          </div>
          {showNewCust && (
            <div style={{ display: 'flex', gap: 10, marginTop: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ flex: 2, minWidth: 200 }}>
                <label style={labelStyle}>New customer name</label>
                <input style={inputStyle} value={newName} onChange={e => setNewName(e.target.value)} />
              </div>
              <div style={{ flex: 1, minWidth: 160 }}>
                <label style={labelStyle}>Phone</label>
                <input style={inputStyle} value={newPhone} onChange={e => setNewPhone(e.target.value)} />
              </div>
              <button type="button" onClick={createCustomer} style={{ ...btnBase, background: '#16a34a', padding: '9px 18px' }}>Create</button>
              <button type="button" onClick={() => setShowNewCust(false)}
                style={{ ...btnBase, background: 'var(--bg-input)', color: 'var(--fg-muted)', border: '1px solid var(--border)', padding: '9px 18px' }}>
                Cancel
              </button>
            </div>
          )}
        </div>

        {/* 2. ITEMS */}
        <div style={sectionStyle}>
          <div style={sectionTitle}>Items</div>
          <div style={{ position: 'relative', marginBottom: 12 }}>
            <FiSearch size={15} style={{ position: 'absolute', left: 12, top: 11, color: 'var(--fg-muted)' }} />
            <input
              ref={prodRef}
              style={{ ...inputStyle, paddingLeft: 36 }}
              placeholder="Enter Product name / SKU / Scan bar code"
              value={prodQuery}
              onChange={e => { setProdQuery(e.target.value); setShowProdList(true) }}
              onFocus={() => setShowProdList(true)}
              onBlur={() => setTimeout(() => setShowProdList(false), 150)}
              onKeyDown={handleProdKeyDown}
            />
            {showProdList && prodQuery.trim().length >= 2 && (
              <div style={dropdown}>
                {prodResults.map(p => {
                  const mrp = p.prices?.find(x => x.tier === 'MRP')?.pricePaise || 0
                  return (
                    <div key={p.id} onMouseDown={() => pickProduct(p)}
                      style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--fg)' }}>{p.name}</div>
                        <div style={{ fontSize: '0.74rem', color: 'var(--fg-muted)' }}>
                          {p.sku} {p.brandName && `· ${p.brandName}`} · Stock: {p.stockQtyMillis / 1000}
                        </div>
                      </div>
                      <div style={{ fontWeight: 700, color: 'var(--fg)', whiteSpace: 'nowrap' }}>{formatMoney(mrp)}</div>
                    </div>
                  )
                })}
                {prodResults.length === 0 && (
                  <div style={{ padding: 12, textAlign: 'center', color: 'var(--fg-muted)', fontSize: '0.8rem' }}>No products found</div>
                )}
              </div>
            )}
          </div>

          <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 860 }}>
              <thead>
                <tr>
                  <th style={{ ...th, width: 40 }}>#</th>
                  <th style={th}>Product</th>
                  <th style={th}>HSN</th>
                  <th style={{ ...th, width: 100, textAlign: 'right' }}>Quantity</th>
                  <th style={{ ...th, width: 130, textAlign: 'right' }}>Unit Price (Inc. Tax)</th>
                  <th style={{ ...th, width: 110, textAlign: 'right' }}>Discount</th>
                  <th style={{ ...th, width: 70, textAlign: 'right' }}>GST %</th>
                  <th style={{ ...th, width: 120, textAlign: 'right' }}>Subtotal</th>
                  <th style={{ ...th, width: 44 }}></th>
                </tr>
              </thead>
              <tbody>
                {cart.length === 0 && (
                  <tr><td colSpan={9} style={{ ...td, textAlign: 'center', color: 'var(--fg-muted)', padding: 24 }}>
                    No items added. Search or scan a product above.
                  </td></tr>
                )}
                {cart.map((line, i) => (
                  <tr key={line.productId}>
                    <td style={td}>{i + 1}</td>
                    <td style={{ ...td, fontWeight: 600 }}>{line.productName}</td>
                    <td style={{ ...td, color: 'var(--fg-muted)' }}>{line.hsnCode || '-'}</td>
                    <td style={td}>
                      <input type="number" min="0" step="any" style={cellInput}
                        value={qtyText[i] !== undefined ? qtyText[i] : String(line.quantityMillis / 1000)}
                        onChange={e => setQtyText(prev => ({ ...prev, [i]: e.target.value }))}
                        onBlur={e => commitQty(i, e.target.value)} />
                    </td>
                    <td style={td}>
                      <input type="number" min="0" step="0.01" style={cellInput}
                        defaultValue={line.unitPricePaise / 100} key={`p-${line.productId}-${line.unitPricePaise}`}
                        onBlur={e => updateLine(i, { unitPricePaise: rupeesToPaise(e.target.value) })} />
                    </td>
                    <td style={td}>
                      <input type="number" min="0" step="0.01" style={cellInput}
                        defaultValue={line.discountPaise / 100} key={`d-${line.productId}-${line.discountPaise}`}
                        onBlur={e => updateLine(i, { discountPaise: rupeesToPaise(e.target.value) })} />
                    </td>
                    <td style={{ ...td, textAlign: 'right' }}>{line.taxPercent}%</td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: 700 }}>{formatMoney(calcLine(line).total)}</td>
                    <td style={td}>
                      <button type="button" onClick={() => removeLine(i)} title="Remove"
                        style={{ background: 'transparent', border: 'none', color: 'var(--error)', cursor: 'pointer' }}>
                        <FiTrash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {/* 3. TOTALS */}
          <div style={sectionStyle}>
            <div style={sectionTitle}>Discount / Totals</div>
            {[
              ['Items (qty)', String(itemCount)],
              ['Subtotal', formatMoney(subtotal)],
              ['Total Discount', '- ' + formatMoney(totalDiscount)],
              ['Round off', (roundoff >= 0 ? '+ ' : '- ') + formatMoney(Math.abs(roundoff))],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '0.88rem', color: 'var(--fg)' }}>
                <span style={{ color: 'var(--fg-muted)' }}>{k}</span><span>{v}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderTop: '2px solid var(--border)', marginTop: 8, paddingTop: 10 }}>
              <span style={{ fontWeight: 700, color: 'var(--fg-bright)' }}>Total Payable</span>
              <span style={{ fontSize: '1.7rem', fontWeight: 800, color: 'var(--accent)' }}>{formatMoney(payable)}</span>
            </div>
            <div style={{ marginTop: 12 }}>
              <HistoryPickerField kind="narration" label="Narration / Notes" value={notes} onChange={setNotes} placeholder="Optional — type or press F4 for saved lines" />
            </div>
            <div style={{ marginTop: 12 }}>
              <HistoryPickerField kind="terms" label="Terms & Conditions (this bill)" value={terms} onChange={setTerms} invoiceNo={''} placeholder="Prefilled from Settings — edit per bill, or F4 for saved terms" />
            </div>
          </div>

          {/* 4. ADD PAYMENT */}
          <div style={sectionStyle}>
            <div style={sectionTitle}>Add Payment</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>Amount (₹)</label>
                <input type="number" min="0" step="0.01" style={inputStyle} value={amountText}
                  onChange={e => { setAmountText(e.target.value); setAmountTouched(true) }} />
              </div>
              <div>
                <label style={labelStyle}>Payment Method</label>
                <select style={inputStyle} value={method}
                  onChange={e => {
                    const m = e.target.value as PayMethod
                    setMethod(m)
                    if (m === 'CREDIT') { setAmountTouched(false) } // credit = full amount, same as Billing.tsx default
                  }}>
                  <option value="CASH">Cash</option>
                  <option value="CARD">Card</option>
                  <option value="UPI">UPI</option>
                  <option value="CHEQUE">Cheque</option>
                  <option value="CREDIT">Credit</option>
                </select>
              </div>
              <div style={{ gridColumn: '1 / span 2' }}>
                <label style={labelStyle}>{method === 'CREDIT' ? 'Customer Name / Remark' : 'Reference No'}</label>
                <input style={inputStyle} value={refNo} onChange={e => setRefNo(e.target.value)}
                  placeholder={method === 'UPI' ? 'UPI Transaction ID' : method === 'CHEQUE' ? 'Cheque No' : ''} />
              </div>
            </div>
            <div style={{ marginTop: 14, padding: '8px 12px', borderRadius: 6, background: 'var(--bg-input)', fontSize: '0.85rem', color: 'var(--fg)' }}>
              {balance > 0
                ? <>Balance due: <strong style={{ color: '#f59e0b' }}>{formatMoney(balance)}</strong> (saved as Draft until fully paid)</>
                : balance < 0 && method === 'CASH'
                  ? <>Change to return: <strong style={{ color: 'var(--success)' }}>{formatMoney(-balance)}</strong></>
                  : <>Fully paid</>}
            </div>
          </div>
        </div>

        {/* 5. FOOTER */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4, paddingBottom: 20 }}>
          <button type="button" onClick={resetForm} disabled={saving}
            style={{ ...btnBase, background: 'transparent', border: '2px solid var(--error)', color: 'var(--error)' }}>
            Clear
          </button>
          <button type="button" onClick={() => save(false)} disabled={saving || cart.length === 0}
            style={{ ...btnBase, background: '#3b82f6', opacity: saving || cart.length === 0 ? 0.5 : 1 }}>
            <FiSave size={15} /> {saving ? 'Saving...' : 'Save'}
          </button>
          <button type="button" onClick={() => save(true)} disabled={saving || cart.length === 0}
            style={{ ...btnBase, background: 'linear-gradient(135deg, #22c55e, #16a34a)', opacity: saving || cart.length === 0 ? 0.5 : 1 }}>
            <FiPrinter size={15} /> {saving ? 'Saving...' : 'Save & Print'}
          </button>
        </div>
      </div>
    </div>
  )
}
