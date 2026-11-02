import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { AdjustStock, SearchProducts, GetStockList } from '../../wailsjs/go/main/App'

interface StockEntry {
  productId: string; productName: string; quantityMillis: number; categoryName: string
}
interface ProductWithPrices {
  id: string; name: string; categoryName?: string
}
interface AdjustmentRow {
  productId: string; productName: string; quantityMillis: number; adjustQty: number; type: 'add' | 'remove'; reason: string; timestamp: string
}

const fmt = (p: number) => (p / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })

export default function StockAdjustmentPage() {
  const [stock, setStock] = useState<StockEntry[]>([])
  const [searchQ, setSearchQ] = useState('')
  const [searchResults, setSearchResults] = useState<ProductWithPrices[]>([])
  const [selectedProduct, setSelectedProduct] = useState<StockEntry | null>(null)
  const [adjustType, setAdjustType] = useState<'add' | 'remove'>('add')
  const [adjustQty, setAdjustQty] = useState('')
  const [reason, setReason] = useState('')
  const [adjustments, setAdjustments] = useState<AdjustmentRow[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => { loadStock() }, [])

  const loadStock = async () => {
    setLoading(true)
    try {
      const data = await GetStockList() as any
      setStock(data || [])
    } catch (e: any) { toast.error(e?.message || 'Failed to load stock'); console.error(e) }
    setLoading(false)
  }

  const handleSearch = async (q: string) => {
    setSearchQ(q)
    if (q.length < 2) { setSearchResults([]); return }
    try {
      const res = await SearchProducts(q) as any
      setSearchResults(res || [])
    } catch (e: any) { toast.error(e?.message || 'Search failed'); console.error(e) }
  }

  const selectProduct = (p: ProductWithPrices) => {
    const entry = stock.find(s => s.productId === p.id)
    setSelectedProduct(entry || { productId: p.id, productName: p.name, quantityMillis: 0, categoryName: p.categoryName || '' })
    setSearchQ(p.name)
    setSearchResults([])
  }

  const addAdjustment = () => {
    if (!selectedProduct || !adjustQty || !reason) return
    setAdjustments(prev => [{
      productId: selectedProduct.productId, productName: selectedProduct.productName,
      quantityMillis: selectedProduct.quantityMillis, adjustQty: Number(adjustQty),
      type: adjustType, reason, timestamp: new Date().toISOString()
    }, ...prev])
    setSelectedProduct(null); setSearchQ(''); setAdjustQty(''); setReason('')
  }

  return (
    <div className="page">
      <div style={{ background: 'var(--accent)', color: '#fff', padding: '10px 20px', borderRadius: 8, marginBottom: 16 }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>Stock Adjustment</h2>
      </div>

      {/* Search & Adjust Form */}
      <div className="card" style={{ padding: 16, marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 250px', position: 'relative' }}>
            <label style={{ fontSize: '0.75rem', color: 'var(--fg-muted)', display: 'block', marginBottom: 4 }}>Product</label>
            <input value={searchQ} onChange={e => handleSearch(e.target.value)} placeholder="Search product..."
              style={{ width: '100%', padding: '8px 12px', background: 'var(--bg-input)', color: 'var(--fg)', border: '1px solid var(--border)', borderRadius: 6, outline: 'none' }} />
            {searchResults.length > 0 && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, background: 'var(--bg-card)', border: '1px solid var(--glass-border)', borderRadius: 6, maxHeight: 160, overflowY: 'auto' }}>
                {searchResults.map(p => (
                  <div key={p.id} onClick={() => selectProduct(p)}
                    style={{ padding: '8px 12px', cursor: 'pointer', color: 'var(--fg)', fontSize: '0.85rem', borderBottom: '1px solid var(--border)' }}>
                    {p.name}
                  </div>
                ))}
              </div>
            )}
          </div>
          {selectedProduct && (
            <div style={{ fontSize: '0.85rem', color: 'var(--fg-muted)', flex: '0 0 auto', padding: '8px 0' }}>
              Current Stock: <strong style={{ color: 'var(--fg)' }}>{(selectedProduct.quantityMillis / 1000).toFixed(2)}</strong>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 12, alignItems: 'flex-end' }}>
          <div style={{ flex: '0 0 120px' }}>
            <label style={{ fontSize: '0.75rem', color: 'var(--fg-muted)', display: 'block', marginBottom: 4 }}>Type</label>
            <select value={adjustType} onChange={e => setAdjustType(e.target.value as 'add' | 'remove')}
              style={{ width: '100%', padding: '8px 12px', background: 'var(--bg-input)', color: 'var(--fg)', border: '1px solid var(--border)', borderRadius: 6 }}>
              <option value="add">Add</option>
              <option value="remove">Remove</option>
            </select>
          </div>
          <div style={{ flex: '0 0 120px' }}>
            <label style={{ fontSize: '0.75rem', color: 'var(--fg-muted)', display: 'block', marginBottom: 4 }}>Quantity</label>
            <input type="number" min={0} value={adjustQty} onChange={e => setAdjustQty(e.target.value)} placeholder="0"
              style={{ width: '100%', padding: '8px 12px', background: 'var(--bg-input)', color: 'var(--fg)', border: '1px solid var(--border)', borderRadius: 6 }} />
          </div>
          <div style={{ flex: '1 1 200px' }}>
            <label style={{ fontSize: '0.75rem', color: 'var(--fg-muted)', display: 'block', marginBottom: 4 }}>Reason</label>
            <input value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason for adjustment..."
              style={{ width: '100%', padding: '8px 12px', background: 'var(--bg-input)', color: 'var(--fg)', border: '1px solid var(--border)', borderRadius: 6, outline: 'none' }} />
          </div>
          <div style={{ position: 'relative' }}>
            <button className="btn btn-ghost btn-sm" onClick={addAdjustment} disabled={!selectedProduct || !adjustQty || !reason}
              style={{ padding: '8px 16px', opacity: (!selectedProduct || !adjustQty || !reason) ? 0.5 : 1 }}>
              Add to List
            </button>
          </div>
        </div>

        <div style={{ marginTop: 12, textAlign: 'right' }}>
          <button className="btn btn-ghost btn-sm" onClick={async () => {
            for (const a of adjustments) {
              try {
                const newQtyMillis = a.type === 'add'
                  ? a.quantityMillis + a.adjustQty * 1000
                  : a.quantityMillis - a.adjustQty * 1000
                await AdjustStock(a.productId, newQtyMillis, a.reason)
              } catch (e: any) { toast.error(e?.message || 'AdjustStock failed'); console.error(e) }
            }
            toast.success('Adjustments saved')
            setAdjustments([])
            loadStock()
          }} disabled={adjustments.length === 0}
            style={{ padding: '8px 16px', opacity: adjustments.length === 0 ? 0.5 : 1 }}>
            Save All Adjustments
          </button>
        </div>
      </div>

      {/* Adjustments Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Type</th>
                <th style={{ textAlign: 'right' }}>Qty</th>
                <th style={{ textAlign: 'right' }}>Current Stock</th>
                <th>Reason</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {adjustments.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--fg-muted)' }}>No adjustments added yet.</td></tr>
              ) : adjustments.map((a, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 600, color: 'var(--fg)' }}>{a.productName}</td>
                  <td><span className={`badge ${a.type === 'add' ? 'badge-success' : 'badge-error'}`}>{a.type === 'add' ? '+Add' : '-Remove'}</span></td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{a.adjustQty}</td>
                  <td style={{ textAlign: 'right', color: 'var(--fg-muted)' }}>{(a.quantityMillis / 1000).toFixed(2)}</td>
                  <td style={{ color: 'var(--fg-muted)' }}>{a.reason}</td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--fg-muted)' }}>{new Date(a.timestamp).toLocaleTimeString('en-IN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
