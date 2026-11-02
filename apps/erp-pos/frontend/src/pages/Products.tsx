import { useEffect, useState, useMemo } from 'react'
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent } from 'react'
import { FiEdit2, FiPlus, FiSearch, FiTrash2, FiDownload, FiAlertTriangle, FiPackage, FiBarChart2, FiX } from 'react-icons/fi'
import toast from 'react-hot-toast'
import { SearchProducts, SaveProduct, DeleteProduct, GetCategories, GetBrands, ListUnits, SaveCSVFile, GetProductSubItems, GetProductRawMaterials, GetSettings, SaveSetting } from '../../wailsjs/go/main/App'

interface Product {
  id: string; name: string; sku: string; barcode: string; hsnCode: string
  taxPercent: number; isKit: boolean; categoryName: string; brandName: string
  categoryId: string; brandId: string; unitId: string; isActive: boolean; description: string
  alertQuantityMillis: number; purchasePricePaise: number
  stockQtyMillis: number; prices: { id: string; tier: string; pricePaise: number; validFrom: string }[]
}
interface Category { id: string; name: string }
interface Brand { id: string; name: string }
interface Unit { id: string; name: string; shortName: string }


function formatMoney(paise: number): string {
  return '₹' + (paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

type TabType = 'all' | 'stock'

export default function Products() {
  const [products, setProducts] = useState<Product[]>([])
  const [query, setQuery] = useState('')
  const [catFilter, setCatFilter] = useState('')
  const [tab, setTab] = useState<TabType>('all')
  const [showForm, setShowForm] = useState(false)
  const [editProduct, setEditProduct] = useState<Product | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [prefs, setPrefs] = useState<Record<string, boolean>>({})
  const [showSettings, setShowSettings] = useState(false)

  const unitMap = useMemo(() => {
    const m: Record<string, Unit> = {}
    units.forEach(u => { m[u.id] = u })
    return m
  }, [units])

  const loadProducts = (q: string) => {
    SearchProducts(q).then(d => setProducts(d || [])).catch(e => { console.error(e); toast.error('Failed to load products') })
  }

  useEffect(() => {
    loadProducts('')
    GetCategories().then(c => setCategories(c || [])).catch(() => {})
    GetBrands().then(b => setBrands(b || [])).catch(() => {})
    ListUnits().then(u => setUnits((u as any) || [])).catch(() => {})
    GetSettings().then(m => {
      try {
        const raw = m?.[PRODUCT_SETTINGS_KEY]
        if (raw) setPrefs(JSON.parse(raw) || {})
      } catch { /* invalid JSON: keep defaults (all visible) */ }
    }).catch(() => {})
  }, [])

  useEffect(() => { loadProducts(query) }, [query])

  const filtered = useMemo(() => {
    let list = products
    if (catFilter) list = list.filter(p => p.categoryName === catFilter)
    return list
  }, [products, catFilter])

  // Summary stats
  const totalItems = filtered.length
  const lowStockItems = filtered.filter(p => {
    const alertQty = (p.alertQuantityMillis || 0) / 1000
    const stock = (p.stockQtyMillis || 0) / 1000
    return alertQty > 0 && stock <= alertQty
  }).length
  const outOfStock = filtered.filter(p => (p.stockQtyMillis || 0) === 0).length
  const totalStockValue = filtered.reduce((sum, p) => {
    const mrp = p.prices?.find(pr => pr.tier === 'MRP')?.pricePaise || 0
    const qty = (p.stockQtyMillis || 0) / 1000
    return sum + mrp * qty
  }, 0)

  // Bottom summary bar totals (presentation only; all derived from loaded list data)
  const totalQty = filtered.reduce((sum, p) => sum + (p.stockQtyMillis || 0) / 1000, 0)
  // MRP is tax-inclusive, so taxable value = value / (1 + gst%/100), summed per product
  const taxableTotal = filtered.reduce((sum, p) => {
    const mrp = p.prices?.find(pr => pr.tier === 'MRP')?.pricePaise || 0
    const qty = (p.stockQtyMillis || 0) / 1000
    const value = mrp * qty
    const rate = p.taxPercent || 0
    return sum + (rate > 0 ? value / (1 + rate / 100) : value)
  }, 0)
  // Rupee formatter with Indian digit grouping (input in paise)
  const fmtRupeesGrouped = (paise: number) =>
    '₹' + (paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })

  const handleExportCSV = async () => {
    const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`
    const headers = ['Name', 'SKU', 'Barcode', 'HSN', 'Category', 'Brand', 'Purchase Price', 'MRP', 'CMP-A', 'CMP-B', 'Stock', 'Alert Qty', 'GST %']
    const rows = filtered.map(p => {
      const getP = (tier: string) => ((p.prices?.find(pr => pr.tier === tier)?.pricePaise || 0) / 100).toFixed(2)
      const unit = unitMap[p.unitId]?.shortName || ''
      const stock = ((p.stockQtyMillis || 0) / 1000).toFixed(3)
      const alertQty = ((p.alertQuantityMillis || 0) / 1000).toFixed(0)
      const purchasePrice = ((p.purchasePricePaise || 0) / 100).toFixed(2)
      return [p.name, p.sku, p.barcode, p.hsnCode, p.categoryName, p.brandName, purchasePrice, getP('MRP'), getP('CMP_A'), getP('CMP_B'), `${stock} ${unit}`, alertQty, `${p.taxPercent}%`]
    })
    const csv = [headers, ...rows].map(r => r.map(esc).join(',')).join('\n')
    try {
      const path = await SaveCSVFile(csv, 'Products_Export.csv')
      if (path) toast.success(`Saved: ${path}`)
    } catch (e: any) { toast.error(e?.message || 'Export failed') }
  }

  return (
    <div className="page">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--fg-bright)' }}>Products</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost" style={{ fontSize: '0.8rem' }} onClick={handleExportCSV}>
            <FiDownload size={13} /> Export CSV
          </button>
          <button className="btn btn-primary" onClick={() => { setEditProduct(null); setShowForm(true) }}>
            <FiPlus size={14} /> Add Product
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 14 }}>
        <div className="card" style={{ padding: '10px 14px', display: 'flex', gap: 10, alignItems: 'center' }}>
          <FiPackage size={20} color="var(--accent)" />
          <div>
            <div style={{ fontSize: '0.68rem', color: 'var(--fg-muted)' }}>Total Items</div>
            <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{totalItems}</div>
          </div>
        </div>
        <div className="card" style={{ padding: '10px 14px', display: 'flex', gap: 10, alignItems: 'center' }}>
          <FiAlertTriangle size={20} color={lowStockItems > 0 ? '#f59e0b' : 'var(--fg-muted)'} />
          <div>
            <div style={{ fontSize: '0.68rem', color: 'var(--fg-muted)' }}>Low Stock</div>
            <div style={{ fontWeight: 700, fontSize: '1.1rem', color: lowStockItems > 0 ? '#f59e0b' : 'var(--fg)' }}>{lowStockItems}</div>
          </div>
        </div>
        <div className="card" style={{ padding: '10px 14px', display: 'flex', gap: 10, alignItems: 'center' }}>
          <FiAlertTriangle size={20} color={outOfStock > 0 ? 'var(--error)' : 'var(--fg-muted)'} />
          <div>
            <div style={{ fontSize: '0.68rem', color: 'var(--fg-muted)' }}>Out of Stock</div>
            <div style={{ fontWeight: 700, fontSize: '1.1rem', color: outOfStock > 0 ? 'var(--error)' : 'var(--fg)' }}>{outOfStock}</div>
          </div>
        </div>
        <div className="card" style={{ padding: '10px 14px', display: 'flex', gap: 10, alignItems: 'center' }}>
          <FiBarChart2 size={20} color="var(--accent)" />
          <div>
            <div style={{ fontSize: '0.68rem', color: 'var(--fg-muted)' }}>Stock Value (MRP)</div>
            <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--accent)' }}>
              {(() => {
                const rs = totalStockValue / 100
                return rs >= 10000000 ? `₹${(rs / 10000000).toFixed(2)}Cr`
                  : rs >= 100000 ? `₹${(rs / 100000).toFixed(2)}L`
                  : `₹${rs.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
              })()}
            </div>
          </div>
        </div>
      </div>

      {/* Search + filter bar + tabs */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 12, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <FiSearch style={{ position: 'absolute', left: 10, top: 10, color: 'var(--fg-muted)' }} size={14} />
          <input type="text" placeholder="Search by name, SKU, or barcode..."
            value={query} onChange={e => setQuery(e.target.value)}
            style={{ width: '100%', paddingLeft: 32, fontSize: '0.85rem' }} />
        </div>
        <select value={catFilter} onChange={e => setCatFilter(e.target.value)}
          style={{ padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--bg-input)', color: 'var(--fg)', fontSize: '0.82rem', minWidth: 140 }}>
          <option value="">All Categories</option>
          {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
        </select>
        <div style={{ display: 'flex', gap: 0, border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
          {(['all', 'stock'] as TabType[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              style={{ padding: '6px 14px', fontSize: '0.8rem', fontWeight: tab === t ? 600 : 400,
                background: tab === t ? 'var(--accent)' : 'transparent',
                color: tab === t ? '#fff' : 'var(--fg)', border: 'none', cursor: 'pointer' }}>
              {t === 'all' ? '📦 All Products' : '📊 Stock Report'}
            </button>
          ))}
        </div>
      </div>

      {/* Product Table */}
      <style>{`
        .products-list-table table th,
        .products-list-table table td { padding: 11px 14px; line-height: 1.5; }
        .products-list-table table th { white-space: nowrap; }
      `}</style>
      <div className="card products-list-table" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          {tab === 'all' ? (
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Product</th>
                  <th>Category</th>
                  <th>Brand</th>
                  <th style={{ textAlign: 'right' }}>Purchase ₹</th>
                  <th style={{ textAlign: 'right' }}>MRP ₹</th>
                  <th style={{ textAlign: 'right' }}>Stock</th>
                  <th style={{ textAlign: 'center' }}>GST</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={9} style={{ textAlign: 'center', padding: 40, color: 'var(--fg-muted)' }}>
                    No products found
                  </td></tr>
                ) : filtered.map((p, i) => {
                  const mrp = p.prices?.find(pr => pr.tier === 'MRP')
                  const stock = (p.stockQtyMillis || 0) / 1000
                  const alertQty = (p.alertQuantityMillis || 0) / 1000
                  const unit = unitMap[p.unitId]
                  const isLow = alertQty > 0 && stock <= alertQty
                  const isOut = stock === 0
                  return (
                    <tr key={p.id} style={isOut ? { background: 'rgba(239,68,68,0.04)' } : isLow ? { background: 'rgba(245,158,11,0.05)' } : undefined}>
                      <td style={{ color: 'var(--fg-muted)', fontSize: '0.75rem' }}>{i + 1}</td>
                      <td>
                        <div style={{ fontWeight: 500 }}>{p.name}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--fg-muted)' }}>
                          {p.sku && <span>SKU: {p.sku}</span>}
                          {p.sku && p.barcode && <span> · </span>}
                          {p.barcode && <span>Barcode: {p.barcode}</span>}
                        </div>
                      </td>
                      <td style={{ fontSize: '0.82rem' }}>{p.categoryName || '—'}</td>
                      <td style={{ fontSize: '0.82rem', color: 'var(--fg-muted)' }}>{p.brandName || '—'}</td>
                      <td style={{ textAlign: 'right', fontSize: '0.82rem', color: 'var(--fg-muted)' }}>
                        {p.purchasePricePaise ? formatMoney(p.purchasePricePaise) : '—'}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--accent)' }}>
                        {mrp ? formatMoney(mrp.pricePaise) : '—'}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <span style={{ fontWeight: 600, color: isOut ? 'var(--error)' : isLow ? '#f59e0b' : 'var(--fg)' }}>
                          {stock % 1 === 0 ? stock.toFixed(0) : stock.toFixed(2)}
                        </span>
                        {unit && <span style={{ fontSize: '0.7rem', color: 'var(--fg-muted)', marginLeft: 3 }}>{unit.shortName}</span>}
                        {isOut && <span style={{ fontSize: '0.65rem', background: 'var(--error)', color: '#fff', borderRadius: 3, padding: '1px 4px', marginLeft: 4 }}>OUT</span>}
                        {isLow && !isOut && <span style={{ fontSize: '0.65rem', background: '#f59e0b', color: '#fff', borderRadius: 3, padding: '1px 4px', marginLeft: 4 }}>LOW</span>}
                      </td>
                      <td style={{ textAlign: 'center', fontSize: '0.78rem' }}>
                        <span style={{ background: 'rgba(99,102,241,0.1)', color: 'var(--accent)', padding: '2px 6px', borderRadius: 4 }}>
                          GST {p.taxPercent}%
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="btn btn-ghost" style={{ padding: '3px 8px', fontSize: '0.75rem' }}
                            onClick={() => { setEditProduct(p); setShowForm(true) }}>
                            <FiEdit2 size={11} /> Edit
                          </button>
                          <button className="btn btn-ghost" style={{ padding: '3px 8px', fontSize: '0.75rem', color: 'var(--error)' }}
                            onClick={() => {
                              if (!window.confirm(`Delete "${p.name}"?`)) return
                              DeleteProduct(p.id).then(() => { toast.success(`"${p.name}" deleted`); loadProducts(query) }).catch(e => toast.error(e?.message || 'Delete failed'))
                            }}>
                            <FiTrash2 size={11} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          ) : (
            /* Stock Report tab */
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Product</th>
                  <th>Category</th>
                  <th style={{ textAlign: 'right' }}>Purchase ₹</th>
                  <th style={{ textAlign: 'right' }}>MRP ₹</th>
                  <th style={{ textAlign: 'right' }}>Stock</th>
                  <th style={{ textAlign: 'right' }}>Alert Qty</th>
                  <th style={{ textAlign: 'right' }}>Stock Value</th>
                  <th style={{ textAlign: 'center' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={9} style={{ textAlign: 'center', padding: 40, color: 'var(--fg-muted)' }}>No products found</td></tr>
                ) : filtered.map((p, i) => {
                  const mrp = p.prices?.find(pr => pr.tier === 'MRP')?.pricePaise || 0
                  const stock = (p.stockQtyMillis || 0) / 1000
                  const alertQty = (p.alertQuantityMillis || 0) / 1000
                  const unit = unitMap[p.unitId]
                  const stockValue = mrp * stock / 100
                  const isOut = stock === 0
                  const isLow = alertQty > 0 && stock <= alertQty
                  const status = isOut ? 'OUT' : isLow ? 'LOW' : 'OK'
                  return (
                    <tr key={p.id} style={isOut ? { background: 'rgba(239,68,68,0.04)' } : isLow ? { background: 'rgba(245,158,11,0.05)' } : undefined}>
                      <td style={{ color: 'var(--fg-muted)', fontSize: '0.75rem' }}>{i + 1}</td>
                      <td>
                        <div style={{ fontWeight: 500 }}>{p.name}</div>
                        {p.hsnCode && <div style={{ fontSize: '0.7rem', color: 'var(--fg-muted)' }}>HSN: {p.hsnCode} | GST {p.taxPercent}%</div>}
                      </td>
                      <td style={{ fontSize: '0.82rem' }}>{p.categoryName || '—'}</td>
                      <td style={{ textAlign: 'right', fontSize: '0.82rem', color: 'var(--fg-muted)' }}>
                        {p.purchasePricePaise ? formatMoney(p.purchasePricePaise) : '—'}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--accent)' }}>
                        {mrp ? formatMoney(mrp) : '—'}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: isOut ? 'var(--error)' : isLow ? '#f59e0b' : 'var(--fg)' }}>
                        {stock % 1 === 0 ? stock.toFixed(0) : stock.toFixed(2)}{unit ? ` ${unit.shortName}` : ''}
                      </td>
                      <td style={{ textAlign: 'right', fontSize: '0.82rem', color: 'var(--fg-muted)' }}>
                        {alertQty > 0 ? alertQty.toFixed(0) : '—'}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>
                        ₹{stockValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{
                          fontSize: '0.72rem', fontWeight: 600, padding: '2px 8px', borderRadius: 4,
                          background: status === 'OUT' ? 'rgba(239,68,68,0.12)' : status === 'LOW' ? 'rgba(245,158,11,0.12)' : 'rgba(34,197,94,0.1)',
                          color: status === 'OUT' ? 'var(--error)' : status === 'LOW' ? '#f59e0b' : '#22c55e'
                        }}>{status}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {filtered.length > 0 && (
          <div style={{ padding: '8px 16px', borderTop: '1px solid var(--border)', fontSize: '0.75rem', color: 'var(--fg-muted)', display: 'flex', justifyContent: 'space-between' }}>
            <span>Showing {filtered.length} of {products.length} products</span>
          </div>
        )}
      </div>

      {/* Sticky bottom totals bar (OS-Books "Stock Details" style) */}
      {filtered.length > 0 && (
        <div style={{
          position: 'sticky', bottom: 0, marginTop: 12, zIndex: 5,
          background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8,
          padding: '10px 16px', display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'stretch',
          boxShadow: '0 -2px 8px rgba(0,0,0,0.08)'
        }}>
          <SummaryTile label="Total Items" value={String(totalItems)} />
          <SummaryTile
            label="Total Qty"
            value={totalQty.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          />
          <SummaryTile label="Taxable Total" value={fmtRupeesGrouped(taxableTotal)} />
          <SummaryTile label="Grand Value (MRP)" value={fmtRupeesGrouped(totalStockValue)} accent />
        </div>
      )}

      {showForm && (
        <ProductForm
          key={editProduct?.id || 'new'}
          categories={categories}
          brands={brands}
          units={units}
          editProduct={editProduct}
          prefs={prefs}
          onOpenSettings={() => setShowSettings(true)}
          onClose={() => { setShowForm(false); setEditProduct(null) }}
          onSave={() => { setShowForm(false); setEditProduct(null); loadProducts(query) }}
        />
      )}

      {showSettings && (
        <ProductSettingModal
          prefs={prefs}
          onClose={() => setShowSettings(false)}
          onSaved={p => { setPrefs(p); setShowSettings(false) }}
        />
      )}
    </div>
  )
}

function SummaryTile({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div style={{
      flex: '1 1 140px', minWidth: 120, padding: '8px 14px',
      borderLeft: '3px solid ' + (accent ? 'var(--accent)' : 'var(--border)'),
      background: 'var(--bg-input, transparent)', borderRadius: 4,
      display: 'flex', flexDirection: 'column', gap: 2
    }}>
      <span style={{ fontSize: '0.68rem', color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
      <span style={{ fontSize: '1.05rem', fontWeight: 700, color: accent ? 'var(--accent)' : 'var(--fg)', lineHeight: 1.2 }}>{value}</span>
    </div>
  )
}

const GST_RATES = [0, 0.25, 3, 5, 18, 40]
const FORM_TIERS: { key: string; label: string }[] = [
  { key: 'MRP', label: 'MRP' },
  { key: 'CMP_A', label: 'Cash' },
  { key: 'CMP_B', label: 'Credit' },
]

const PRODUCT_SETTINGS_KEY = 'product_form_settings'
const SETTING_GROUPS: { title: string; items: { key: string; label: string }[] }[] = [
  { title: 'Product Form', items: [
    { key: 'productCode', label: 'Product Code' }, { key: 'brand', label: 'Brand Name' },
    { key: 'category', label: 'Category' }, { key: 'gst', label: 'GST (Applicable + Rate)' },
    { key: 'hsn', label: 'HSN' }, { key: 'groupCode', label: 'Group Code' },
    { key: 'groupName', label: 'Group Name' }, { key: 'autoQty', label: 'Auto Qty' },
    { key: 'openingQty', label: 'Opening Qty' }, { key: 'reorderQty', label: 'Reorder Qty' },
    { key: 'purchasePrice', label: 'Purchase Price' },
  ] },
  { title: 'Sale Prices', items: [
    { key: 'mrp', label: 'MRP' }, { key: 'cash', label: 'Cash' }, { key: 'credit', label: 'Credit' },
  ] },
  { title: 'Sections', items: [
    { key: 'moreInfo', label: 'More Info' }, { key: 'subItem', label: 'Sub Item' }, { key: 'rawMaterials', label: 'Raw Materials' },
  ] },
]
const TIER_PREF_KEY: Record<string, string> = { MRP: 'mrp', CMP_A: 'cash', CMP_B: 'credit' }

function ProductSettingModal({ prefs, onClose, onSaved }: {
  prefs: Record<string, boolean>
  onClose: () => void
  onSaved: (p: Record<string, boolean>) => void
}) {
  const [local, setLocal] = useState<Record<string, boolean>>({ ...prefs })
  const [saving, setSaving] = useState(false)
  const isOn = (k: string) => local[k] !== false

  const handleSave = async () => {
    if (saving) return
    setSaving(true)
    try {
      const full: Record<string, boolean> = {}
      SETTING_GROUPS.forEach(g => g.items.forEach(i => { full[i.key] = isOn(i.key) }))
      await SaveSetting(PRODUCT_SETTINGS_KEY, JSON.stringify(full))
      toast.success('Product settings saved')
      onSaved(full)
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save settings')
    }
    setSaving(false)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}
        onKeyDown={e => { if (e.key === 'Escape') { e.preventDefault(); onClose() } }}
        style={{ minWidth: 460, width: 560, maxWidth: '95vw', maxHeight: '92vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <div className="modal-title" style={{ margin: 0 }}>Product Setting</div>
          <button className="btn btn-ghost" onClick={onClose} title="Close" style={{ padding: '3px 8px' }}><FiX size={14} /></button>
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--fg-muted)', marginBottom: 10 }}>
          Field Visibility — switch off to hide a field from the product form.
        </div>
        {SETTING_GROUPS.map(g => (
          <div key={g.title} style={{ border: '1px solid var(--border)', borderRadius: 6, padding: 12, marginTop: 10 }}>
            <div style={{ fontWeight: 600, fontSize: '0.82rem', marginBottom: 8, color: 'var(--fg-bright, var(--fg))' }}>{g.title}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
              {g.items.map(i => (
                <Toggle key={i.key} on={isOn(i.key)} onChange={v => setLocal({ ...local, [i.key]: v })} label={i.label} />
              ))}
            </div>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" onClick={onClose} style={{ minWidth: 100, background: 'var(--border)' }}>Close</button>
          <button className="btn" onClick={handleSave} disabled={saving}
            style={{ minWidth: 110, background: '#16a34a', color: '#fff', border: 'none' }}>
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

interface SubRow { name: string; value: string }
interface RawRow { name: string; qty: string; unit: string }

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.8rem', color: 'var(--fg)', userSelect: 'none' }}>
      <span onClick={() => onChange(!on)} role="switch" aria-checked={on}
        style={{ width: 34, height: 18, borderRadius: 9, background: on ? 'var(--accent)' : 'var(--border)', position: 'relative', transition: 'background .15s', display: 'inline-block' }}>
        <span style={{ position: 'absolute', top: 2, left: on ? 18 : 2, width: 14, height: 14, borderRadius: '50%', background: '#fff', transition: 'left .15s' }} />
      </span>
      {label && <span onClick={() => onChange(!on)}>{label}</span>}
    </label>
  )
}

function ProductForm({ categories, brands, units, editProduct, prefs, onOpenSettings, onClose, onSave }: {
  categories: Category[]; brands: Brand[]; units: Unit[]
  editProduct: Product | null
  prefs: Record<string, boolean>; onOpenSettings: () => void
  onClose: () => void; onSave: () => void
}) {
  const ep: any = editProduct || {}
  const [name, setName] = useState<string>(ep.name || '')
  const [isActive, setIsActive] = useState<boolean>(editProduct ? ep.isActive !== false : true)
  const [isService, setIsService] = useState<boolean>(!!ep.isService)
  const [productCode, setProductCode] = useState<string>(ep.productCode || '')
  const [sku, setSku] = useState<string>(ep.sku || '')
  const [barcode, setBarcode] = useState<string>(ep.barcode || '')
  const [hsn, setHsn] = useState<string>(ep.hsnCode || '')
  const [categoryId, setCategoryId] = useState<string>(ep.categoryId || '')
  const [brandId, setBrandId] = useState<string>(ep.brandId || '')
  const [gstApplicable, setGstApplicable] = useState<boolean>(editProduct ? ep.gstApplicable !== false : true)
  const [taxPercent, setTaxPercent] = useState<number>(ep.taxPercent ?? 18)
  const [groupCode, setGroupCode] = useState<string>(ep.groupCode || '')
  const [groupName, setGroupName] = useState<string>(ep.groupName || '')
  const [autoQty, setAutoQty] = useState<string>(ep.autoQtyMillis ? String(ep.autoQtyMillis / 1000) : '')
  const [openingQty, setOpeningQty] = useState<string>(ep.openingQtyMillis ? String(ep.openingQtyMillis / 1000) : '')
  const [reorderQty, setReorderQty] = useState<string>(ep.reorderQtyMillis ? String(ep.reorderQtyMillis / 1000) : '')
  const [purchasePrice, setPurchasePrice] = useState<string>(ep.purchasePricePaise ? (ep.purchasePricePaise / 100).toFixed(2) : '')
  const [unitId, setUnitId] = useState<string>(ep.unitId || '')
  const [prices, setPrices] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = { MRP: '', CMP_A: '', CMP_B: '' }
    for (const p of ep.prices || []) {
      if (init[p.tier] !== undefined) init[p.tier] = (p.pricePaise / 100).toFixed(2)
    }
    return init
  })
  const [showMore, setShowMore] = useState(false)
  const [showRaw, setShowRaw] = useState(false)
  const [showSub, setShowSub] = useState(false)
  const [size, setSize] = useState<string>(ep.size || '')
  const [colour, setColour] = useState<string>(ep.colour || '')
  const [expiryMonth, setExpiryMonth] = useState<string>(ep.expiryMonth || '')
  const [location, setLocation] = useState<string>(ep.location || '')
  const [description, setDescription] = useState<string>(ep.description || '')
  const [terms, setTerms] = useState<string>(ep.terms || '')
  const [productTags, setProductTags] = useState<string>(ep.productTags || '')
  const [subItems, setSubItems] = useState<SubRow[]>([])
  const [rawMaterials, setRawMaterials] = useState<RawRow[]>([])
  const [loading, setLoading] = useState(false)
  const isEdit = !!editProduct
  const show = (key: string) => prefs[key] !== false

  // Prefill child tables on edit
  useEffect(() => {
    if (!editProduct?.id) return
    let cancelled = false
    GetProductSubItems(editProduct.id).then(rows => {
      if (cancelled) return
      const list = (rows || []).map((r: any) => ({ name: r.name || '', value: r.value || '' }))
      setSubItems(list)
      if (list.length > 0) setShowSub(true)
    }).catch(() => {})
    GetProductRawMaterials(editProduct.id).then(rows => {
      if (cancelled) return
      const list = (rows || []).map((r: any) => ({ name: r.name || '', qty: r.qtyMillis ? String(r.qtyMillis / 1000) : '', unit: r.unit || '' }))
      setRawMaterials(list)
      if (list.length > 0) setShowRaw(true)
    }).catch(() => {})
    if (ep.size || ep.colour || ep.expiryMonth || ep.location || ep.terms || ep.productTags || ep.description || ep.sku || ep.barcode) setShowMore(true)
    return () => { cancelled = true }
  }, [editProduct?.id])

  const toMillis = (s: string) => Math.round((parseFloat(s) || 0) * 1000)

  const handleSave = async () => {
    if (loading) return
    if (!name.trim()) { toast.error('Product name is required'); return }
    setLoading(true)

    const today = new Date().toISOString().split('T')[0]
    const priceList: any[] = FORM_TIERS
      .filter(t => prices[t.key] && parseFloat(prices[t.key]) > 0)
      .map(t => ({
        id: ep.prices?.find((p: any) => p.tier === t.key)?.id || '',
        productId: editProduct?.id || '',
        tier: t.key,
        pricePaise: Math.round(parseFloat(prices[t.key]) * 100),
        validFrom: today,
      }))
    // Preserve any legacy tiers (CMP_C / CMP_D) that the form does not edit
    for (const p of ep.prices || []) {
      if (p.tier === 'CMP_C' || p.tier === 'CMP_D') {
        priceList.push({ id: p.id || '', productId: editProduct?.id || '', tier: p.tier, pricePaise: p.pricePaise, validFrom: p.validFrom || today })
      }
    }

    const subList = subItems.filter(r => r.name.trim() || r.value.trim())
      .map((r, i) => ({ id: '', productId: editProduct?.id || '', name: r.name.trim(), value: r.value.trim(), sortOrder: i }))
    const rawList = rawMaterials.filter(r => r.name.trim())
      .map((r, i) => ({ id: '', productId: editProduct?.id || '', name: r.name.trim(), qtyMillis: toMillis(r.qty), unit: r.unit.trim(), sortOrder: i }))

    const product = {
      id: editProduct?.id || '', tenantId: '', name: name.trim(), sku, barcode, hsnCode: hsn,
      categoryId, brandId, unitId, taxPercent, isActive, isKit: ep.isKit || false, description,
      alertQuantityMillis: ep.alertQuantityMillis || 0,
      purchasePricePaise: Math.round((parseFloat(purchasePrice) || 0) * 100),
      productCode, gstApplicable, groupCode, groupName,
      autoQtyMillis: toMillis(autoQty), openingQtyMillis: toMillis(openingQty), reorderQtyMillis: toMillis(reorderQty),
      isService, size, colour, expiryMonth, location, terms, productTags,
    }

    try {
      await SaveProduct(product as any, priceList as any, subList as any, rawList as any)
      toast.success(isEdit ? `Product "${name}" updated` : `Product "${name}" saved`)
      onSave()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save product')
    }
    setLoading(false)
  }

  const onKeyDown = (e: ReactKeyboardEvent) => {
    const t = e.target as HTMLElement
    const tag = t.tagName
    if (e.key === 'Escape') { e.preventDefault(); onClose(); return }
    if (tag === 'TEXTAREA') {
      if (e.key === 'F2') { e.preventDefault(); handleSave() }
      return
    }
    if (e.key === 'F2') { e.preventDefault(); handleSave(); return }
    if (e.key === 'Enter' && tag !== 'BUTTON') { e.preventDefault(); handleSave(); return }
    if (e.key === 'ArrowDown') {
      if (tag === 'SELECT') return
      if (tag === 'INPUT' && (t as HTMLInputElement).type === 'number') return
      e.preventDefault(); handleSave()
    }
  }

  const unitLabel = units.find(u => u.id === unitId)?.shortName || units.find(u => u.id === unitId)?.name || '—'
  const lbl: CSSProperties = { display: 'block', fontSize: '0.72rem', color: 'var(--fg-muted)', marginBottom: 3, fontWeight: 600 }
  const section: CSSProperties = { border: '1px solid var(--border)', borderRadius: 6, padding: 12, marginTop: 12 }
  const numProps = { type: 'number', min: 0, step: '0.01' } as const
  const smallBtn: CSSProperties = { padding: '3px 8px', fontSize: '0.75rem' }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} onKeyDown={onKeyDown}
        style={{ minWidth: 640, width: 760, maxWidth: '95vw', maxHeight: '92vh', overflowY: 'auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, gap: 12 }}>
          <div className="modal-title" style={{ margin: 0 }}>Product Master{isEdit ? ' — Edit' : ''}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: '0.8rem', fontWeight: isService ? 400 : 700, color: isService ? 'var(--fg-muted)' : 'var(--accent)' }}>Product</span>
            <Toggle on={isService} onChange={setIsService} />
            <span style={{ fontSize: '0.8rem', fontWeight: isService ? 700 : 400, color: isService ? 'var(--accent)' : 'var(--fg-muted)' }}>Service</span>
            <button className="btn btn-ghost" onClick={onOpenSettings} title="Product Setting" style={smallBtn}>Setting</button>
            <button className="btn btn-ghost" onClick={onClose} title="Close" style={{ padding: '3px 8px' }}><FiX size={14} /></button>
          </div>
        </div>

        {/* Name + Active */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'end', marginBottom: 10 }}>
          <div>
            <label style={lbl}>Product Name *</label>
            <input className="form-input" value={name} onChange={e => setName(e.target.value)} autoFocus />
          </div>
          <div style={{ paddingBottom: 8 }}><Toggle on={isActive} onChange={setIsActive} label="Active" /></div>
        </div>

        {(show('productCode') || show('hsn')) && (
        <div className="grid-2" style={{ marginBottom: 10 }}>
          {show('productCode') && (
          <div>
            <label style={lbl}>Product Code</label>
            <input className="form-input" value={productCode} onChange={e => setProductCode(e.target.value)} />
          </div>
          )}
          {show('hsn') && (
          <div>
            <label style={lbl}>HSN</label>
            <input className="form-input" value={hsn} inputMode="numeric" maxLength={8} onChange={e => setHsn(e.target.value.replace(/\D/g, ''))} />
          </div>
          )}
        </div>
        )}

        {(show('brand') || show('category')) && (
        <div className="grid-2" style={{ marginBottom: 10 }}>
          {show('brand') && (
          <div>
            <label style={lbl}>Brand Name</label>
            <select className="form-input" value={brandId} onChange={e => setBrandId(e.target.value)}>
              <option value="">— Select —</option>
              {(brands || []).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          )}
          {show('category') && (
          <div>
            <label style={lbl}>Category</label>
            <select className="form-input" value={categoryId} onChange={e => setCategoryId(e.target.value)}>
              <option value="">— Select —</option>
              {(categories || []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          )}
        </div>
        )}

        {show('gst') && (
        <div className="grid-2" style={{ marginBottom: 10 }}>
          <div>
            <label style={lbl}>GST</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Toggle on={gstApplicable} onChange={setGstApplicable} label={gstApplicable ? 'Applicable: Yes' : 'Applicable: No'} />
            </div>
          </div>
          <div>
            <label style={lbl}>GST Rate</label>
            <select className="form-input" value={taxPercent} disabled={!gstApplicable} onChange={e => setTaxPercent(Number(e.target.value))}>
              {!GST_RATES.includes(taxPercent) && <option value={taxPercent}>@{taxPercent} %</option>}
              {GST_RATES.map(r => <option key={r} value={r}>@{r} %</option>)}
            </select>
          </div>
        </div>
        )}

        {(show('groupCode') || show('groupName')) && (
        <div className="grid-2" style={{ marginBottom: 10 }}>
          {show('groupCode') && (
          <div>
            <label style={lbl}>Group Code</label>
            <input className="form-input" value={groupCode} onChange={e => setGroupCode(e.target.value)} />
          </div>
          )}
          {show('groupName') && (
          <div>
            <label style={lbl}>Group Name</label>
            <input className="form-input" value={groupName} onChange={e => setGroupName(e.target.value)} />
          </div>
          )}
        </div>
        )}

        {show('autoQty') && (
        <div style={{ marginBottom: 10, maxWidth: 'calc(50% - 8px)' }}>
          <label style={lbl}>Auto Qty</label>
          <input className="form-input" {...numProps} step="1" value={autoQty} onChange={e => setAutoQty(e.target.value)} />
        </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 4 }}>
          {show('openingQty') && (
          <div>
            <label style={lbl}>Opening Qty</label>
            <input className="form-input" {...numProps} step="1" value={openingQty} onChange={e => setOpeningQty(e.target.value)} />
          </div>
          )}
          <div>
            <label style={lbl}>Unit</label>
            <select className="form-input" value={unitId} onChange={e => setUnitId(e.target.value)}>
              <option value="">— Select —</option>
              {(units || []).map(u => <option key={u.id} value={u.id}>{u.name} ({u.shortName})</option>)}
            </select>
          </div>
          {show('purchasePrice') && (
          <div>
            <label style={lbl}>Purchase Price (₹)</label>
            <input className="form-input" {...numProps} value={purchasePrice} onChange={e => setPurchasePrice(e.target.value)} />
          </div>
          )}
          {show('reorderQty') && (
          <div>
            <label style={lbl}>Reorder Qty</label>
            <input className="form-input" {...numProps} step="1" value={reorderQty} onChange={e => setReorderQty(e.target.value)} />
          </div>
          )}
        </div>

        {/* Unit price block */}
        <div style={section}>
          <div style={{ fontWeight: 600, fontSize: '0.82rem', marginBottom: 8, color: 'var(--fg-bright, var(--fg))' }}>Unit : {unitLabel}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {FORM_TIERS.filter(t => show(TIER_PREF_KEY[t.key])).map(t => (
              <div key={t.key}>
                <label style={lbl}>{t.label} (₹)</label>
                <input className="form-input" {...numProps} placeholder="0.00" value={prices[t.key]}
                  onChange={e => setPrices({ ...prices, [t.key]: e.target.value })} />
              </div>
            ))}
          </div>
        </div>

        {/* Section toggles */}
        <div style={{ display: 'flex', gap: 24, marginTop: 14, flexWrap: 'wrap' }}>
          {show('moreInfo') && <Toggle on={showMore} onChange={setShowMore} label="More Info" />}
          {show('rawMaterials') && <Toggle on={showRaw} onChange={setShowRaw} label="Raw Materials" />}
          {show('subItem') && <Toggle on={showSub} onChange={setShowSub} label="Sub Item" />}
        </div>

        {show('moreInfo') && showMore && (
          <div style={section}>
            <div style={{ fontWeight: 600, fontSize: '0.82rem', marginBottom: 8 }}>More Info</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 10 }}>
              <div><label style={lbl}>Size</label><input className="form-input" value={size} onChange={e => setSize(e.target.value)} /></div>
              <div><label style={lbl}>Colour</label><input className="form-input" value={colour} onChange={e => setColour(e.target.value)} /></div>
              <div><label style={lbl}>Expiry Month</label><input className="form-input" value={expiryMonth} onChange={e => setExpiryMonth(e.target.value)} /></div>
              <div><label style={lbl}>Location</label><input className="form-input" value={location} onChange={e => setLocation(e.target.value)} /></div>
            </div>
            <div className="grid-2" style={{ marginBottom: 10 }}>
              <div><label style={lbl}>SKU</label><input className="form-input" value={sku} onChange={e => setSku(e.target.value)} /></div>
              <div><label style={lbl}>Barcode</label><input className="form-input" value={barcode} inputMode="numeric" maxLength={13} onChange={e => setBarcode(e.target.value.replace(/\D/g, ''))} /></div>
            </div>
            <div style={{ marginBottom: 10 }}>
              <label style={lbl}>Description</label>
              <textarea className="form-input" rows={2} value={description} onChange={e => setDescription(e.target.value)} style={{ resize: 'vertical', minHeight: 48 }} />
            </div>
            <div className="grid-2">
              <div><label style={lbl}>Terms &amp; Condition</label><textarea className="form-input" rows={2} value={terms} onChange={e => setTerms(e.target.value)} style={{ resize: 'vertical', minHeight: 48 }} /></div>
              <div><label style={lbl}>Product Tags</label><input className="form-input" value={productTags} placeholder="Comma separated" onChange={e => setProductTags(e.target.value)} /></div>
            </div>
          </div>
        )}

        {show('subItem') && showSub && (
          <div style={section}>
            <div style={{ fontWeight: 600, fontSize: '0.82rem', marginBottom: 8 }}>Sub Items</div>
            <table style={{ width: '100%' }}>
              <thead><tr>
                <th style={{ width: 44 }}>S.No</th><th>Sub Item Name</th><th>Sub Item Value</th>
                <th style={{ width: 90, textAlign: 'center' }}>Action</th>
              </tr></thead>
              <tbody>
                {subItems.length === 0 && <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--fg-muted)', padding: 10 }}>No sub items</td></tr>}
                {subItems.map((r, i) => (
                  <tr key={i}>
                    <td>{i + 1}</td>
                    <td><input className="form-input" value={r.name} onChange={e => setSubItems(subItems.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} /></td>
                    <td><input className="form-input" value={r.value} onChange={e => setSubItems(subItems.map((x, j) => j === i ? { ...x, value: e.target.value } : x))} /></td>
                    <td style={{ textAlign: 'center' }}>
                      <button className="btn btn-ghost" title="Remove row" style={{ ...smallBtn, color: 'var(--error)' }} onClick={() => setSubItems(subItems.filter((_, j) => j !== i))}><FiTrash2 size={12} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button className="btn btn-ghost" style={{ ...smallBtn, marginTop: 8 }} onClick={() => setSubItems([...subItems, { name: '', value: '' }])}><FiPlus size={12} /> Add Row</button>
          </div>
        )}

        {show('rawMaterials') && showRaw && (
          <div style={section}>
            <div style={{ fontWeight: 600, fontSize: '0.82rem', marginBottom: 8 }}>Raw Materials</div>
            <table style={{ width: '100%' }}>
              <thead><tr>
                <th style={{ width: 44 }}>S.No</th><th>Name</th><th style={{ width: 110 }}>Qty</th><th style={{ width: 110 }}>Unit</th>
                <th style={{ width: 90, textAlign: 'center' }}>Action</th>
              </tr></thead>
              <tbody>
                {rawMaterials.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--fg-muted)', padding: 10 }}>No raw materials</td></tr>}
                {rawMaterials.map((r, i) => (
                  <tr key={i}>
                    <td>{i + 1}</td>
                    <td><input className="form-input" value={r.name} onChange={e => setRawMaterials(rawMaterials.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} /></td>
                    <td><input className="form-input" {...numProps} step="any" value={r.qty} onChange={e => setRawMaterials(rawMaterials.map((x, j) => j === i ? { ...x, qty: e.target.value } : x))} /></td>
                    <td><input className="form-input" value={r.unit} onChange={e => setRawMaterials(rawMaterials.map((x, j) => j === i ? { ...x, unit: e.target.value } : x))} /></td>
                    <td style={{ textAlign: 'center' }}>
                      <button className="btn btn-ghost" title="Remove row" style={{ ...smallBtn, color: 'var(--error)' }} onClick={() => setRawMaterials(rawMaterials.filter((_, j) => j !== i))}><FiTrash2 size={12} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button className="btn btn-ghost" style={{ ...smallBtn, marginTop: 8 }} onClick={() => setRawMaterials([...rawMaterials, { name: '', qty: '', unit: '' }])}><FiPlus size={12} /> Add Row</button>
          </div>
        )}

        {/* Footer */}
        <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" onClick={onClose} style={{ minWidth: 110, background: 'var(--border)' }}>Close</button>
          <button className="btn" onClick={handleSave} disabled={loading}
            style={{ minWidth: 130, background: '#16a34a', color: '#fff', border: 'none' }}>
            {loading ? 'Saving...' : 'Submit'}
          </button>
        </div>
      </div>
    </div>
  )
}
