import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { AdjustStock, GetStockList } from '../../wailsjs/go/main/App'

interface StockEntry {
  productId: string; productName: string; quantityMillis: number; categoryName: string
}
interface CorrectionRow extends StockEntry {
  newQty: string
}

export default function StockCorrectionPage() {
  const [rows, setRows] = useState<CorrectionRow[]>([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState('')

  useEffect(() => { loadStock() }, [])

  const loadStock = async () => {
    setLoading(true)
    try {
      const data = await GetStockList() as any
      setRows(((data || []) as StockEntry[]).map((s: StockEntry) => ({ ...s, newQty: '' })))
    } catch (e: any) { toast.error(e?.message || 'Failed to load stock'); console.error(e) }
    setLoading(false)
  }

  const updateNewQty = (productId: string, val: string) => {
    setRows(prev => prev.map(r => r.productId === productId ? { ...r, newQty: val } : r))
  }

  const filtered = rows.filter(r =>
    r.productName.toLowerCase().includes(filter.toLowerCase()) ||
    r.categoryName.toLowerCase().includes(filter.toLowerCase())
  )

  const hasChanges = rows.some(r => r.newQty !== '')

  return (
    <div className="page">
      <div style={{ background: 'var(--accent)', color: '#fff', padding: '10px 20px', borderRadius: 8, marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>Stock Correction</h2>
        <button className="btn btn-ghost btn-sm" onClick={loadStock} style={{ color: '#fff', border: '1px solid rgba(255,255,255,0.3)', padding: '4px 12px' }}>
          Refresh
        </button>
      </div>

      {/* Filter */}
      <div className="card" style={{ padding: 16, marginBottom: 16, display: 'flex', gap: 12, alignItems: 'flex-end' }}>
        <div style={{ flex: '1 1 300px' }}>
          <label style={{ fontSize: '0.75rem', color: 'var(--fg-muted)', display: 'block', marginBottom: 4 }}>Filter by product or category</label>
          <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Type to filter..."
            style={{ width: '100%', padding: '8px 12px', background: 'var(--bg-input)', color: 'var(--fg)', border: '1px solid var(--border)', borderRadius: 6, outline: 'none' }} />
        </div>
        <div style={{ fontSize: '0.8rem', color: 'var(--fg-muted)' }}>
          {filtered.length} of {rows.length} items
        </div>
      </div>

      {/* Stock Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Product Name</th>
                <th>Category</th>
                <th style={{ textAlign: 'right' }}>Current Stock</th>
                <th style={{ textAlign: 'right', width: 150 }}>New Stock</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} style={{ textAlign: 'center', padding: 40, color: 'var(--fg-muted)' }}>Loading stock data...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={4} style={{ textAlign: 'center', padding: 40, color: 'var(--fg-muted)' }}>No stock entries found.</td></tr>
              ) : filtered.map(r => (
                <tr key={r.productId}>
                  <td style={{ fontWeight: 600, color: 'var(--fg)' }}>{r.productName}</td>
                  <td style={{ color: 'var(--fg-muted)' }}>{r.categoryName}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{(r.quantityMillis / 1000).toFixed(2)}</td>
                  <td style={{ textAlign: 'right' }}>
                    <input
                      type="number"
                      min={0}
                      value={r.newQty}
                      onChange={e => updateNewQty(r.productId, e.target.value)}
                      placeholder={(r.quantityMillis / 1000).toFixed(2)}
                      style={{
                        width: 120, padding: '6px 10px', textAlign: 'right',
                        background: 'var(--bg-input)', color: 'var(--fg)',
                        border: r.newQty !== '' ? '1px solid var(--accent)' : '1px solid var(--border)',
                        borderRadius: 6, outline: 'none'
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Save */}
      <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 12, alignItems: 'center' }}>
        {hasChanges && (
          <span style={{ fontSize: '0.8rem', color: 'var(--accent)' }}>
            {rows.filter(r => r.newQty !== '').length} item(s) modified
          </span>
        )}
        <button className="btn btn-ghost btn-sm" onClick={async () => {
          const changed = rows.filter(r => r.newQty !== '')
          for (const r of changed) {
            try {
              const newQtyMillis = Math.round(parseFloat(r.newQty) * 1000)
              await AdjustStock(r.productId, newQtyMillis, 'Stock correction')
            } catch (e: any) { toast.error(e?.message || 'AdjustStock failed'); console.error(e) }
          }
          toast.success('Corrections saved')
          loadStock()
        }} disabled={!hasChanges} style={{ padding: '8px 24px', opacity: hasChanges ? 1 : 0.5 }}>
          Save All Corrections
        </button>
      </div>
    </div>
  )
}
