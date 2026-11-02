import { useEffect, useState } from 'react'
import { FiSearch, FiRefreshCw } from 'react-icons/fi'
import toast from 'react-hot-toast'
import { GetStockList } from '../../wailsjs/go/main/App'

interface StockEntry {
  productId: string; productName: string; sku: string; barcode: string
  categoryName: string; brandName: string; quantityMillis: number; mrpPaise: number
}

function formatMoney(paise: number): string {
  if (paise === 0) return '—'
  return '₹' + (paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function Stock() {
  const [stock, setStock] = useState<StockEntry[]>([])
  const [query, setQuery] = useState('')

  useEffect(() => { loadStock() }, [])

  const loadStock = () => {
    GetStockList().then(d => setStock(d || [])).catch(e => { console.error(e); toast.error('Failed to load stock') })
  }

  const filtered = stock?.filter(s =>
    !query || s.productName.toLowerCase().includes(query.toLowerCase()) ||
    s.sku?.toLowerCase().includes(query.toLowerCase()) ||
    s.barcode?.toLowerCase().includes(query.toLowerCase())
  ) || []

  const lowStockCount = filtered.filter(s => s.quantityMillis <= 5000 && s.quantityMillis >= 0).length
  const totalValue = filtered.reduce((sum, s) => sum + ((s.quantityMillis / 1000) * s.mrpPaise), 0)

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--fg-bright)' }}>Stock Management</h2>
          <div style={{ fontSize: '0.8rem', color: 'var(--fg-muted)', marginTop: 2 }}>
            {filtered.length} items &middot; Low stock: <span style={{ color: lowStockCount > 0 ? 'var(--error)' : 'var(--success)' }}>{lowStockCount}</span>
            &middot; Total value (MRP): {formatMoney(totalValue)}
          </div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={loadStock}><FiRefreshCw size={14} /> Refresh</button>
      </div>

      <div style={{ marginBottom: 16, position: 'relative' }}>
        <FiSearch style={{ position: 'absolute', left: 12, top: 11, color: 'var(--fg-muted)' }} />
        <input type="text" placeholder="Search stock by name, SKU, or barcode..."
          value={query} onChange={e => setQuery(e.target.value)}
          style={{ width: '100%', paddingLeft: 36 }} />
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>SKU</th>
                <th>Category</th>
                <th>Brand</th>
                <th style={{ textAlign: 'right' }}>MRP</th>
                <th style={{ textAlign: 'right' }}>Quantity</th>
                <th style={{ textAlign: 'right' }}>Value</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--fg-muted)' }}>
                    No stock data. Add products and record purchases.
                  </td>
                </tr>
              ) : filtered.map(s => {
                const qty = s.quantityMillis / 1000
                const value = qty * s.mrpPaise
                return (
                  <tr key={s.productId}>
                    <td>
                      <div style={{ fontWeight: 500 }}>{s.productName}</div>
                      {s.barcode && <div style={{ fontSize: '0.72rem', color: 'var(--fg-muted)' }}>Barcode: {s.barcode}</div>}
                    </td>
                    <td style={{ color: 'var(--fg-muted)' }}>{s.sku || '—'}</td>
                    <td>{s.categoryName || '—'}</td>
                    <td>{s.brandName || '—'}</td>
                    <td style={{ textAlign: 'right' }}>{formatMoney(s.mrpPaise)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <span style={{
                        fontWeight: 600,
                        color: qty <= 0 ? 'var(--error)' : qty <= 5 ? 'var(--warning)' : 'var(--fg)'
                      }}>
                        {qty}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 500 }}>{formatMoney(value)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
