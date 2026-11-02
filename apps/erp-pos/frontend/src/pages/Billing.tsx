import { useState, useEffect, useRef, useCallback } from 'react'
import { FiSearch, FiTrash2, FiPlus, FiMinus, FiShoppingCart, FiUser, FiCalendar, FiPrinter, FiMaximize2 } from 'react-icons/fi'
import toast from 'react-hot-toast'
import { SearchProducts, FindByBarcode, FinalizeSale, SearchCustomers, SaveCustomer, GetCategories, GetBrands, PrintReceipt } from '../../wailsjs/go/main/App'

interface ProductPrice { id: string; productId: string; tier: string; pricePaise: number; validFrom: string }
interface Product {
  id: string; name: string; sku: string; barcode: string; hsnCode: string
  taxPercent: number; isKit: boolean; categoryName: string; brandName: string
  stockQtyMillis: number; prices: ProductPrice[]
}
interface Customer { id: string; name: string; phone: string; email: string; gstin: string }
interface CartLine {
  productId: string; productName: string; hsnCode: string
  quantityMillis: number; priceTier: string; unitPricePaise: number
  discountPaise: number; taxPercent: number
}
interface Payment { method: string; amountPaise: number; referenceNumber: string }
interface CategoryItem { id: string; name: string }
interface BrandItem { id: string; name: string }
type PayMethod = 'CASH' | 'UPI' | 'CARD' | 'CREDIT'

function formatMoney(paise: number): string {
  return '₹ ' + (paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function calcLine(line: CartLine) {
  const gross = (line.unitPricePaise * line.quantityMillis) / 1000
  const afterDiscount = gross - line.discountPaise
  // MRP is tax-inclusive in India — back-calculate taxable from gross
  const taxable = Math.round(afterDiscount * 100 / (100 + line.taxPercent))
  const tax = afterDiscount - taxable
  return { gross, taxable, tax, total: afterDiscount }
}

const now = () => {
  const d = new Date()
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' ' +
    d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
}

const actionBtn: React.CSSProperties = {
  padding: '10px 22px', borderRadius: 8, fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer',
  border: 'none', color: '#fff', display: 'flex', alignItems: 'center', gap: 8,
}
const ghostBtn: React.CSSProperties = {
  padding: '10px 16px', borderRadius: 8, fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer',
  background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--fg-muted)',
}
const iconBtn: React.CSSProperties = {
  width: 34, height: 34, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--fg-muted)', cursor: 'pointer',
}

export default function Billing() {
  const [cart, setCart] = useState<CartLine[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [allProducts, setAllProducts] = useState<Product[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [showPayment, setShowPayment] = useState(false)
  const [payMethod, setPayMethod] = useState<PayMethod>('CASH')
  const [showCustomerPicker, setShowCustomerPicker] = useState(false)
  const [activeTab, setActiveTab] = useState<'category' | 'brands' | 'featured'>('featured')
  const [categories, setCategories] = useState<CategoryItem[]>([])
  const [brands, setBrands] = useState<BrandItem[]>([])
  const [selectedCategory, setSelectedCategory] = useState('')
  const [selectedBrand, setSelectedBrand] = useState('')
  const [dateTime] = useState(now())

  const searchRef = useRef<HTMLInputElement>(null)

  const safeSearch = (q: string) => {
    try { SearchProducts(q).then(r => { const p = r || []; setProducts(p); if (!q) setAllProducts(p) }).catch(console.error) } catch {}
  }

  useEffect(() => {
    if (searchQuery.length >= 2) safeSearch(searchQuery)
    else if (searchQuery === '') safeSearch('')
  }, [searchQuery])

  useEffect(() => {
    safeSearch('')
    try { GetCategories().then(c => setCategories(c || [])).catch(console.error) } catch {}
    try { GetBrands().then(b => setBrands(b || [])).catch(console.error) } catch {}
  }, [])

  useEffect(() => {
    if (activeTab === 'category' && selectedCategory) {
      setProducts(allProducts.filter(p => p.categoryName === selectedCategory))
    } else if (activeTab === 'brands' && selectedBrand) {
      setProducts(allProducts.filter(p => p.brandName === selectedBrand))
    } else {
      setProducts(allProducts)
    }
  }, [activeTab, selectedCategory, selectedBrand, allProducts])

  const openPayment = (m: PayMethod) => {
    if (cart.length === 0) { toast.error('Cart is empty'); return }
    setPayMethod(m)
    setShowPayment(true)
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'F2') { e.preventDefault(); newInvoice() }
      else if (e.key === 'F4') { e.preventDefault(); if (cart.length > 0) { setPayMethod('CASH'); setShowPayment(true) } }
      else if (e.key === 'F8') { e.preventDefault(); searchRef.current?.focus(); searchRef.current?.select() }
      else if (e.key === 'Escape') { setShowPayment(false); setShowCustomerPicker(false) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [cart.length])

  const newInvoice = useCallback(() => {
    setCart([]); setSelectedCustomer(null); setSearchQuery('')
    toast.success('New invoice started')
  }, [])

  const addToCart = useCallback((product: Product) => {
    const stockUnits = (product.stockQtyMillis || 0) / 1000
    if (stockUnits <= 0) {
      toast(`⚠️ ${product.name} is out of stock — this sale will make stock negative`, { icon: '⚠️' })
    }
    setCart(prev => {
      const existing = prev.findIndex(c => c.productId === product.id)
      if (existing >= 0) {
        const newQty = prev[existing].quantityMillis / 1000 + 1
        if (newQty > stockUnits && stockUnits > 0) toast(`⚠️ ${product.name}: only ${stockUnits} in stock`, { icon: '⚠️' })
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
  }, [])

  const updateQty = (index: number, delta: number) => {
    setCart(prev => {
      const updated = [...prev]
      updated[index] = { ...updated[index], quantityMillis: Math.max(1000, updated[index].quantityMillis + delta * 1000) }
      return updated
    })
  }

  const removeLine = (index: number) => setCart(prev => prev.filter((_, i) => i !== index))

  const handleSearchKeyDown = async (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      try {
        const product = await FindByBarcode(searchQuery.trim())
        addToCart(product)
        setSearchQuery('')
        toast.success(`Added: ${product.name}`)
      } catch { /* not a barcode, normal search continues */ }
    }
  }

  const subtotal = cart.reduce((sum, line) => sum + calcLine(line).gross, 0)
  const totalDiscount = cart.reduce((sum, line) => sum + line.discountPaise, 0)
  const totalTax = cart.reduce((sum, line) => sum + calcLine(line).tax, 0)
  // subtotal is MRP-inclusive (already contains tax), so don't add tax again
  const grandTotal = subtotal - totalDiscount
  const roundoff = Math.round(grandTotal / 100) * 100 - grandTotal
  const payable = grandTotal + roundoff
  const itemCount = cart.reduce((s, l) => s + l.quantityMillis / 1000, 0)

  const chip = (active: boolean): React.CSSProperties => ({
    padding: '4px 12px', borderRadius: 16, fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
    background: active ? 'var(--accent)' : 'var(--bg-input)',
    color: active ? '#fff' : 'var(--fg-muted)',
    border: '1px solid var(--border)',
  })

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        {/* ===== TOP BAR ===== */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 16px', background: 'var(--bg-sidebar)', borderBottom: '1px solid var(--border)', gap: 12, flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--fg-muted)' }}>Location:</span>
            <span style={{ padding: '5px 14px', borderRadius: 6, fontSize: '0.85rem', fontWeight: 600, background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--fg)' }}>
              SHIV SHANKAR TYRES
            </span>
            <span style={{ padding: '5px 14px', borderRadius: 6, fontSize: '0.82rem', fontWeight: 600, background: 'var(--accent)', color: '#fff' }}>
              <FiCalendar size={12} style={{ marginRight: 6, verticalAlign: -1 }} />{dateTime}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={() => toast('Print feature coming soon')} style={iconBtn} title="Print"><FiPrinter size={16} /></button>
            <button onClick={() => toast('Fullscreen feature coming soon')} style={iconBtn} title="Fullscreen"><FiMaximize2 size={16} /></button>
          </div>
        </div>

        {/* ===== MAIN ===== */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

          {/* ===== LEFT: Customer, search, cart, summary ===== */}
          <div style={{ width: '55%', display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--border)', minWidth: 0 }}>
            <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid var(--border)' }}>
              <FiUser size={16} style={{ color: 'var(--fg-muted)', flexShrink: 0 }} />
              <button onClick={() => setShowCustomerPicker(true)} style={{
                padding: '7px 14px', borderRadius: 8, fontSize: '0.85rem', cursor: 'pointer',
                background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--fg)',
                textAlign: 'left', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
              }}>
                {selectedCustomer ? `${selectedCustomer.name}${selectedCustomer.phone ? ' · ' + selectedCustomer.phone : ''}` : 'Walk-In Customer'}
              </button>
              {selectedCustomer && (
                <button onClick={() => setSelectedCustomer(null)} title="Clear customer" style={{ ...iconBtn, width: 30, height: 30 }}>✕</button>
              )}
              <button onClick={() => setShowCustomerPicker(true)} title="Add / select customer" style={{
                width: 30, height: 30, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'var(--accent)', color: '#fff', cursor: 'pointer', flexShrink: 0, border: 'none'
              }}><FiPlus size={14} /></button>
            </div>

            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ position: 'relative' }}>
                <FiSearch style={{ position: 'absolute', left: 12, top: 11, color: 'var(--fg-muted)' }} />
                <input
                  ref={searchRef}
                  type="text"
                  placeholder="Enter Product name / SKU / Scan bar code"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  style={{ width: '100%', paddingLeft: 38, fontSize: '0.9rem' }}
                />
              </div>
            </div>

            <div style={{ flex: 1, overflow: 'auto' }}>
              {cart.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--fg-muted)', gap: 12, textAlign: 'center', padding: 16 }}>
                  <FiShoppingCart size={56} style={{ opacity: 0.3 }} />
                  <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>Your cart is empty</div>
                  <div style={{ fontSize: '0.85rem' }}>Scan a barcode, tap a product tile, or type to search.</div>
                </div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: 30 }}>#</th>
                      <th>Product</th>
                      <th style={{ width: 120, textAlign: 'center' }}>Quantity</th>
                      <th style={{ width: 110, textAlign: 'right' }}>Price Inc. Tax</th>
                      <th style={{ width: 110, textAlign: 'right' }}>Subtotal</th>
                      <th style={{ width: 36 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {cart.map((line, i) => {
                      const { total } = calcLine(line)
                      return (
                        <tr key={i}>
                          <td style={{ color: 'var(--fg-muted)' }}>{i + 1}</td>
                          <td>
                            <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{line.productName}</div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--fg-muted)' }}>
                              {line.priceTier}{line.hsnCode && ` · HSN: ${line.hsnCode}`} · GST {line.taxPercent}%
                            </div>
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                              <button className="btn btn-sm btn-ghost" onClick={() => updateQty(i, -1)} style={{ padding: '2px 6px', borderRadius: 4 }}><FiMinus size={12} /></button>
                              <span style={{ minWidth: 28, textAlign: 'center', fontWeight: 700, fontSize: '0.9rem' }}>{line.quantityMillis / 1000}</span>
                              <button className="btn btn-sm btn-ghost" onClick={() => updateQty(i, 1)} style={{ padding: '2px 6px', borderRadius: 4 }}><FiPlus size={12} /></button>
                            </div>
                          </td>
                          <td style={{ textAlign: 'right', fontSize: '0.85rem' }}>{formatMoney(line.unitPricePaise)}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700, fontSize: '0.9rem' }}>{formatMoney(total)}</td>
                          <td>
                            <button onClick={() => removeLine(i)} style={{ color: 'var(--error)', padding: 4, cursor: 'pointer', background: 'none', border: 'none' }}>
                              <FiTrash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Summary block */}
            <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', background: 'var(--bg-sidebar)', flexShrink: 0 }}>
              <div className="pos-total-row"><span>Items</span><span>{cart.length} ({itemCount} qty)</span></div>
              <div className="pos-total-row"><span>Subtotal</span><span>{formatMoney(subtotal)}</span></div>
              <div className="pos-total-row" style={{ color: totalDiscount > 0 ? 'var(--success)' : undefined }}>
                <span>Discount (−)</span><span>{totalDiscount > 0 ? '-' : ''}{formatMoney(totalDiscount)}</span>
              </div>
              {cart.length > 0 && (
                <div className="pos-total-row" style={{ fontSize: '0.78rem', color: 'var(--fg-muted)' }}>
                  <span>GST included in price</span><span>{formatMoney(totalTax)}</span>
                </div>
              )}
              {roundoff !== 0 && (
                <div className="pos-total-row" style={{ fontSize: '0.78rem' }}>
                  <span>Round off</span><span>{roundoff > 0 ? '+' : ''}{formatMoney(roundoff)}</span>
                </div>
              )}
              <div className="pos-total-row grand">
                <span>Total Payable</span><span>{formatMoney(payable)}</span>
              </div>
            </div>
          </div>

          {/* ===== RIGHT: Tabs + product tiles ===== */}
          <div style={{ width: '45%', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--bg-sidebar)' }}>
              {[
                { key: 'category' as const, label: 'Category', count: categories.length },
                { key: 'brands' as const, label: 'Brands', count: brands.length },
                { key: 'featured' as const, label: 'Featured Products', count: 0 },
              ].map(tab => (
                <button key={tab.key} onClick={() => { setActiveTab(tab.key); setSelectedCategory(''); setSelectedBrand('') }}
                  style={{
                    flex: 1, padding: '11px 12px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600,
                    background: 'transparent',
                    color: activeTab === tab.key ? 'var(--accent)' : 'var(--fg-muted)',
                    border: 'none',
                    borderBottom: activeTab === tab.key ? '2px solid var(--accent)' : '2px solid transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  }}>
                  {tab.label}
                  {tab.count > 0 && (
                    <span style={{
                      padding: '1px 8px', borderRadius: 10, fontSize: '0.7rem', fontWeight: 700,
                      background: activeTab === tab.key ? 'var(--accent)' : 'var(--bg-input)',
                      color: activeTab === tab.key ? '#fff' : 'var(--fg-muted)'
                    }}>{tab.count}</span>
                  )}
                </button>
              ))}
            </div>

            {activeTab === 'category' && categories.length > 0 && (
              <div style={{ padding: '8px 12px', display: 'flex', gap: 6, flexWrap: 'wrap', borderBottom: '1px solid var(--border)', maxHeight: 90, overflowY: 'auto' }}>
                <button onClick={() => setSelectedCategory('')} style={chip(!selectedCategory)}>All</button>
                {categories.map(c => (
                  <button key={c.id} onClick={() => setSelectedCategory(c.name)} style={chip(selectedCategory === c.name)}>{c.name}</button>
                ))}
              </div>
            )}
            {activeTab === 'brands' && brands.length > 0 && (
              <div style={{ padding: '8px 12px', display: 'flex', gap: 6, flexWrap: 'wrap', borderBottom: '1px solid var(--border)', maxHeight: 90, overflowY: 'auto' }}>
                <button onClick={() => setSelectedBrand('')} style={chip(!selectedBrand)}>All</button>
                {brands.map(b => (
                  <button key={b.id} onClick={() => setSelectedBrand(b.name)} style={chip(selectedBrand === b.name)}>{b.name}</button>
                ))}
              </div>
            )}

            <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
                {products?.map(product => {
                  const mrp = product.prices?.find(p => p.tier === 'MRP')
                  const stock = (product.stockQtyMillis || 0) / 1000
                  return (
                    <div key={product.id} onClick={() => addToCart(product)} tabIndex={0}
                      onKeyDown={e => e.key === 'Enter' && addToCart(product)}
                      style={{
                        display: 'flex', flexDirection: 'column', textAlign: 'center', alignItems: 'center',
                        padding: '12px 8px 10px', borderRadius: 10, cursor: 'pointer',
                        background: 'var(--bg-card)', border: '1px solid var(--border)', transition: 'border-color 0.15s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)' }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)' }}>
                      <div style={{
                        fontWeight: 600, fontSize: '0.8rem', color: 'var(--fg-bright)', width: '100%', marginBottom: 2,
                        overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', minHeight: '2.4em'
                      }}>{product.name}</div>
                      {(product.sku || product.barcode) && (
                        <div style={{ fontSize: '0.68rem', color: 'var(--fg-muted)', marginBottom: 2 }}>({product.sku || product.barcode})</div>
                      )}
                      <div style={{ fontSize: '0.7rem', color: stock <= 5 ? 'var(--error)' : 'var(--fg-muted)', marginBottom: 4 }}>
                        {stock.toFixed(2)} in stock
                      </div>
                      <div style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--accent)' }}>
                        {mrp ? formatMoney(mrp.pricePaise) : '—'}
                      </div>
                    </div>
                  )
                })}
              </div>
              {products?.length === 0 && (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--fg-muted)' }}>
                  No products found. Add products from the Products screen.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ===== BOTTOM ACTION BAR ===== */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px',
          background: 'var(--bg-sidebar)', borderTop: '1px solid var(--border)', flexShrink: 0, flexWrap: 'wrap'
        }}>
          <button onClick={newInvoice} style={{ ...ghostBtn, background: 'transparent', border: '2px solid var(--error)', color: 'var(--error)' }}>✕ Cancel (F2)</button>
          <button onClick={() => setShowCustomerPicker(true)} style={ghostBtn}>Customer</button>
          <div style={{ flex: 1 }} />
          <button onClick={() => openPayment('CREDIT')} disabled={cart.length === 0}
            style={{ ...actionBtn, background: '#f59e0b', opacity: cart.length > 0 ? 1 : 0.5, cursor: cart.length > 0 ? 'pointer' : 'default' }}>
            Credit Sale
          </button>
          <button onClick={() => openPayment('CARD')} disabled={cart.length === 0}
            style={{ ...actionBtn, background: '#3b82f6', opacity: cart.length > 0 ? 1 : 0.5, cursor: cart.length > 0 ? 'pointer' : 'default' }}>
            💳 Card
          </button>
          <button onClick={() => openPayment('UPI')} disabled={cart.length === 0}
            style={{ ...actionBtn, background: 'var(--accent2, #7c3aed)', opacity: cart.length > 0 ? 1 : 0.5, cursor: cart.length > 0 ? 'pointer' : 'default' }}>
            UPI
          </button>
          <button onClick={() => openPayment('CASH')} disabled={cart.length === 0}
            style={{ ...actionBtn, padding: '10px 30px', background: 'linear-gradient(135deg, #22c55e, #16a34a)', opacity: cart.length > 0 ? 1 : 0.5, cursor: cart.length > 0 ? 'pointer' : 'default' }}>
            💵 Cash (F4)
          </button>
        </div>
      </div>

      {/* Payment Modal */}
      {showPayment && (
        <PaymentModal
          totalPaise={payable}
          initialMethod={payMethod}
          onClose={() => setShowPayment(false)}
          onPay={async (payments) => {
            try {
              let cbName = '', cbEmail = ''
              try { const u = JSON.parse(localStorage.getItem('sst_user') || '{}'); cbName = u.name || ''; cbEmail = u.email || '' } catch { /* ignore */ }
              const result = await FinalizeSale({
                customerId: selectedCustomer?.id || '',
                lines: cart, payments, notes: '',
                createdBy: cbName, createdByEmail: cbEmail,
              } as any)
              toast.success(`Invoice ${result.invoiceNumber} saved!`)
              try { await PrintReceipt(result.id) } catch { /* printer may not be configured */ }
              setCart([]); setSelectedCustomer(null); setShowPayment(false)
              safeSearch('') // refresh product tiles so stock reflects the sale
            } catch (err: any) { toast.error(err?.message || 'Failed to save invoice') }
          }}
        />
      )}

      {/* Customer Picker Modal */}
      {showCustomerPicker && (
        <CustomerPickerModal
          onSelect={(c) => { setSelectedCustomer(c); setShowCustomerPicker(false) }}
          onClose={() => setShowCustomerPicker(false)}
        />
      )}
    </>
  )
}

function PaymentModal({ totalPaise, initialMethod, onClose, onPay }: {
  totalPaise: number; initialMethod: PayMethod; onClose: () => void; onPay: (payments: Payment[]) => Promise<void>
}) {
  const [method, setMethod] = useState<PayMethod>(initialMethod)
  const [cashAmount, setCashAmount] = useState(String(totalPaise / 100))
  const [refNumber, setRefNumber] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    setLoading(true)
    await onPay([{ method, amountPaise: Math.round(parseFloat(cashAmount || '0') * 100), referenceNumber: refNumber }])
    setLoading(false)
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ minWidth: 480 }}>
        <form onSubmit={e => { e.preventDefault(); if (!loading) handleSubmit() }}>
        <div className="modal-title">Payment — {formatMoney(totalPaise)}</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {(['CASH', 'UPI', 'CARD', 'CREDIT'] as const).map(m => (
            <button type="button" key={m} className={`btn ${method === m ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setMethod(m)} style={{ flex: 1 }}>{m}</button>
          ))}
        </div>
        <div className="form-group">
          <label className="form-label">Amount (₹)</label>
          <input className="form-input" type="number" value={cashAmount}
            onChange={e => setCashAmount(e.target.value)} autoFocus step="0.01" />
        </div>
        {(method === 'UPI' || method === 'CARD' || method === 'CREDIT') && (
          <div className="form-group">
            <label className="form-label">{method === 'CREDIT' ? 'Customer Name' : 'Reference Number'}</label>
            <input className="form-input" type="text" value={refNumber}
              onChange={e => setRefNumber(e.target.value)} placeholder={method === 'UPI' ? 'UPI Transaction ID' : ''} />
          </div>
        )}
        {parseFloat(cashAmount || '0') * 100 > totalPaise && method === 'CASH' && (
          <div style={{ marginTop: 8, padding: '8px 12px', background: 'rgba(34,197,94,0.1)', borderRadius: 6, fontSize: '0.85rem' }}>
            Change: <strong style={{ color: 'var(--success)' }}>{formatMoney(Math.round(parseFloat(cashAmount) * 100) - totalPaise)}</strong>
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
          <button type="button" className="btn btn-ghost" onClick={onClose} style={{ flex: 1 }}>Cancel (Esc)</button>
          <button type="submit" className="btn btn-success" disabled={loading} style={{ flex: 1 }}>
            {loading ? 'Saving...' : 'Save & Print (Enter)'}
          </button>
        </div>
        </form>
      </div>
    </div>
  )
}

function CustomerPickerModal({ onSelect, onClose }: { onSelect: (c: Customer) => void; onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [customers, setCustomers] = useState<Customer[]>([])
  const [showNew, setShowNew] = useState(false)
  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])
  useEffect(() => {
    try { SearchCustomers(query).then(c => setCustomers(c || [])).catch(console.error) } catch {}
  }, [query])

  const handleCreateCustomer = async () => {
    if (!newName.trim()) { toast.error('Customer name is required'); return }
    try {
      const id = await SaveCustomer({ id: '', name: newName.trim(), phone: newPhone.trim(), email: '', gstin: '', address: '', creditLimitPaise: 0, isActive: true } as any)
      toast.success('Customer created')
      onSelect({ id: id as any, name: newName.trim(), phone: newPhone.trim(), email: '', gstin: '' })
    } catch (e: any) { toast.error(e?.message || 'Failed to create customer') }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ minWidth: 500 }}>
        <div className="modal-title">Select Customer</div>
        {!showNew ? (
          <>
            <input ref={inputRef} className="form-input" type="text" placeholder="Search by name or phone..."
              value={query} onChange={e => setQuery(e.target.value)} style={{ marginBottom: 12 }} />
            <div style={{ maxHeight: 300, overflowY: 'auto' }}>
              {customers?.map(c => (
                <div key={c.id} onClick={() => onSelect(c)} tabIndex={0} onKeyDown={e => e.key === 'Enter' && onSelect(c)}
                  style={{
                    padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid var(--border)',
                    borderRadius: 6, marginBottom: 2, transition: 'background 0.15s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <div style={{ fontWeight: 600 }}>{c.name}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--fg-muted)' }}>
                    {c.phone} {c.gstin && `· GSTIN: ${c.gstin}`}
                  </div>
                </div>
              ))}
              {customers?.length === 0 && (
                <div style={{ textAlign: 'center', padding: 20, color: 'var(--fg-muted)' }}>No customers found</div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button className="btn btn-ghost" onClick={onClose} style={{ flex: 1 }}>Cancel</button>
              <button className="btn btn-primary" onClick={() => setShowNew(true)} style={{ flex: 1 }}>+ New Customer</button>
            </div>
          </>
        ) : (
          <>
            <div className="form-group" style={{ marginBottom: 10 }}>
              <label className="form-label">Customer Name *</label>
              <input className="form-input" value={newName} onChange={e => setNewName(e.target.value)} autoFocus placeholder="Enter name" />
            </div>
            <div className="form-group" style={{ marginBottom: 10 }}>
              <label className="form-label">Phone</label>
              <input className="form-input" value={newPhone} inputMode="numeric" maxLength={10}
                onChange={e => setNewPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="Phone number" />
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button className="btn btn-ghost" onClick={() => setShowNew(false)} style={{ flex: 1 }}>Back</button>
              <button className="btn btn-primary" onClick={handleCreateCustomer} style={{ flex: 1 }}>Create & Select</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
