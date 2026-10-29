import { useEffect, useState } from 'react'
import { FiPlus, FiSearch } from 'react-icons/fi'
import toast from 'react-hot-toast'
import { SearchProducts, SaveProduct, GetCategories, GetBrands, ListUnits } from '../../wailsjs/go/main/App'

interface Product {
  id: string; name: string; sku: string; barcode: string; hsnCode: string
  taxPercent: number; isKit: boolean; categoryName: string; brandName: string
  categoryId: string; brandId: string; unitId: string; isActive: boolean; description: string
  stockQtyMillis: number; prices: { id: string; tier: string; pricePaise: number; validFrom: string }[]
}
interface Category { id: string; name: string }
interface Brand { id: string; name: string }
interface Unit { id: string; name: string; shortName: string }

const TIERS = ['MRP', 'CMP_A', 'CMP_B', 'CMP_C', 'CMP_D'] as const

function formatMoney(paise: number): string {
  return '₹' + (paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function Products() {
  const [products, setProducts] = useState<Product[]>([])
  const [query, setQuery] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editProduct, setEditProduct] = useState<Product | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [units, setUnits] = useState<Unit[]>([])

  useEffect(() => {
    loadProducts()
    GetCategories().then(c => setCategories(c || [])).catch(() => {})
    GetBrands().then(b => setBrands(b || [])).catch(() => {})
    ListUnits().then(u => setUnits((u as any) || [])).catch(() => {})
  }, [])

  const loadProducts = () => {
    SearchProducts(query).then(d => setProducts(d || [])).catch(e => { console.error(e); toast.error('Failed to load products') })
  }

  useEffect(() => { loadProducts() }, [query])

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--fg-bright)' }}>Products</h2>
        <button className="btn btn-primary" onClick={() => { setEditProduct(null); setShowForm(true) }}><FiPlus size={14} /> Add Product</button>
      </div>

      <div style={{ marginBottom: 16, position: 'relative' }}>
        <FiSearch style={{ position: 'absolute', left: 12, top: 11, color: 'var(--fg-muted)' }} />
        <input type="text" placeholder="Search by name, SKU, or barcode..."
          value={query} onChange={e => setQuery(e.target.value)}
          style={{ width: '100%', paddingLeft: 36 }} />
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>SKU</th>
                <th>Category</th>
                <th>Brand</th>
                <th style={{ textAlign: 'right' }}>MRP</th>
                <th style={{ textAlign: 'right' }}>Stock</th>
                <th style={{ textAlign: 'right' }}>Tax %</th>
              </tr>
            </thead>
            <tbody>
              {products?.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--fg-muted)' }}>
                    No products yet. Click "Add Product" to create one.
                  </td>
                </tr>
              ) : products?.map(p => {
                const mrp = p.prices?.find(pr => pr.tier === 'MRP')
                const stock = (p.stockQtyMillis || 0) / 1000
                return (
                  <tr key={p.id} onClick={() => { setEditProduct(p); setShowForm(true) }} style={{ cursor: 'pointer' }}>
                    <td>
                      <div style={{ fontWeight: 500 }}>{p.name}</div>
                      {p.barcode && <div style={{ fontSize: '0.72rem', color: 'var(--fg-muted)' }}>Barcode: {p.barcode}</div>}
                    </td>
                    <td style={{ color: 'var(--fg-muted)' }}>{p.sku || '—'}</td>
                    <td>{p.categoryName || '—'}</td>
                    <td>{p.brandName || '—'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--accent)' }}>
                      {mrp ? formatMoney(mrp.pricePaise) : '—'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <span style={{ color: stock <= 5 ? 'var(--error)' : stock <= 20 ? 'var(--warning)' : 'var(--fg)' }}>
                        {stock}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>{p.taxPercent}%</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Product Form Modal */}
      {showForm && (
        <ProductForm
          categories={categories}
          brands={brands}
          units={units}
          editProduct={editProduct}
          onClose={() => { setShowForm(false); setEditProduct(null) }}
          onSave={() => { setShowForm(false); setEditProduct(null); loadProducts() }}
        />
      )}
    </div>
  )
}

function ProductForm({ categories, brands, units, editProduct, onClose, onSave }: {
  categories: Category[]; brands: Brand[]; units: Unit[]
  editProduct: Product | null
  onClose: () => void; onSave: () => void
}) {
  const [name, setName] = useState(editProduct?.name || '')
  const [sku, setSku] = useState(editProduct?.sku || '')
  const [barcode, setBarcode] = useState(editProduct?.barcode || '')
  const [hsn, setHsn] = useState(editProduct?.hsnCode || '')
  const [categoryId, setCategoryId] = useState(editProduct?.categoryId || '')
  const [brandId, setBrandId] = useState(editProduct?.brandId || '')
  const [taxPercent, setTaxPercent] = useState(editProduct?.taxPercent ?? 18)
  const [prices, setPrices] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = { MRP: '', CMP_A: '', CMP_B: '', CMP_C: '', CMP_D: '' }
    if (editProduct?.prices) {
      for (const p of editProduct.prices) {
        if (init[p.tier] !== undefined) init[p.tier] = (p.pricePaise / 100).toFixed(2)
      }
    }
    return init
  })
  const [unitId, setUnitId] = useState(editProduct?.unitId || '')
  const [loading, setLoading] = useState(false)

  const isEdit = !!editProduct

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Product name is required'); return }
    setLoading(true)

    const today = new Date().toISOString().split('T')[0]
    const priceList = TIERS
      .filter(t => prices[t] && parseFloat(prices[t]) > 0)
      .map(t => ({
        id: editProduct?.prices?.find(p => p.tier === t)?.id || '',
        productId: editProduct?.id || '',
        tier: t,
        pricePaise: Math.round(parseFloat(prices[t]) * 100),
        validFrom: today,
      }))

    try {
      await SaveProduct(
        { id: editProduct?.id || '', tenantId: '', name, sku, barcode, hsnCode: hsn, categoryId, brandId,
          unitId, taxPercent, isActive: true, isKit: editProduct?.isKit || false, description: editProduct?.description || '' },
        priceList
      )
      toast.success(isEdit ? `Product "${name}" updated!` : `Product "${name}" saved!`)
      onSave()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save product')
    }
    setLoading(false)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ minWidth: 550 }}>
        <div className="modal-title">{isEdit ? 'Edit Product' : 'Add Product'}</div>

        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">Product Name *</label>
            <input className="form-input" value={name} onChange={e => setName(e.target.value)} autoFocus />
          </div>
          <div className="form-group">
            <label className="form-label">SKU</label>
            <input className="form-input" value={sku} onChange={e => setSku(e.target.value)} />
          </div>
        </div>

        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">Barcode</label>
            <input className="form-input" value={barcode} inputMode="numeric" maxLength={13} onChange={e => setBarcode(e.target.value.replace(/\D/g, ''))} />
          </div>
          <div className="form-group">
            <label className="form-label">HSN Code</label>
            <input className="form-input" value={hsn} inputMode="numeric" maxLength={8} onChange={e => setHsn(e.target.value.replace(/\D/g, ''))} />
          </div>
        </div>

        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">Category</label>
            <select className="form-input" value={categoryId} onChange={e => setCategoryId(e.target.value)}>
              <option value="">— Select —</option>
              {categories?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Brand</label>
            <select className="form-input" value={brandId} onChange={e => setBrandId(e.target.value)}>
              <option value="">— Select —</option>
              {brands?.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
        </div>

        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">Unit</label>
            <select className="form-input" value={unitId} onChange={e => setUnitId(e.target.value)}>
              <option value="">— Select —</option>
              {units?.map(u => <option key={u.id} value={u.id}>{u.name} ({u.shortName})</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Tax / GST %</label>
            <select className="form-input" value={taxPercent} onChange={e => setTaxPercent(Number(e.target.value))} style={{ width: '100%' }}>
              <option value={0}>0%</option>
              <option value={5}>5%</option>
              <option value={12}>12%</option>
              <option value={18}>18%</option>
              <option value={28}>28%</option>
            </select>
          </div>
        </div>

        <div style={{ marginTop: 12, marginBottom: 4, fontWeight: 600, fontSize: '0.85rem' }}>
          Pricing (5 Tiers) — in ₹
        </div>
        <div className="grid-3" style={{ gap: 8 }}>
          {TIERS.map(tier => (
            <div key={tier} className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">{tier.replace('_', ' ')}</label>
              <input className="form-input" type="number" step="0.01" placeholder="0.00"
                value={prices[tier]} onChange={e => setPrices({ ...prices, [tier]: e.target.value })} />
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
          <button className="btn btn-ghost" onClick={onClose} style={{ flex: 1 }}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={loading} style={{ flex: 1 }}>
            {loading ? 'Saving...' : isEdit ? 'Update Product' : 'Save Product'}
          </button>
        </div>
      </div>
    </div>
  )
}
