import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { SearchProducts, ListStockTransfers, SaveStockTransfer } from '../../wailsjs/go/main/App'

interface ProductWithPrices {
  id: string; name: string; categoryName?: string
}
interface StockInItem {
  productId: string; productName: string; qty: number; date: string
}

export default function StockInPage() {
  const [sourceBranch] = useState('Main Branch')
  const [transferDate, setTransferDate] = useState(new Date().toISOString().split('T')[0])
  const [searchQ, setSearchQ] = useState('')
  const [searchResults, setSearchResults] = useState<ProductWithPrices[]>([])
  const [items, setItems] = useState<StockInItem[]>([])
  const [addQty, setAddQty] = useState('')
  const [transfers, setTransfers] = useState<any[]>([])

  useEffect(() => {
    (async () => {
      try {
        const data = await ListStockTransfers('') as any
        setTransfers(data || [])
      } catch (e: any) { toast.error(e?.message || 'Failed to load transfers'); console.error(e) }
    })()
  }, [])

  const handleSearch = async (q: string) => {
    setSearchQ(q)
    if (q.length < 2) { setSearchResults([]); return }
    try {
      const res = await SearchProducts(q)
      setSearchResults(res || [])
    } catch (e) { console.error('SearchProducts failed:', e) }
  }

  const addProduct = (p: ProductWithPrices) => {
    const qty = Number(addQty) || 1
    setItems(prev => [...prev, { productId: p.id, productName: p.name, qty, date: transferDate }])
    setSearchQ(''); setSearchResults([]); setAddQty('')
  }

  const removeItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx))

  return (
    <div className="page">
      <div style={{ background: 'var(--accent)', color: '#fff', padding: '10px 20px', borderRadius: 8, marginBottom: 16 }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>Stock In (Branch Transfer)</h2>
      </div>

      {/* Transfer Info */}
      <div className="card" style={{ padding: 16, marginBottom: 16, display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ flex: '1 1 200px' }}>
          <label style={{ fontSize: '0.75rem', color: 'var(--fg-muted)', display: 'block', marginBottom: 4 }}>Source Branch</label>
          <select value={sourceBranch} disabled
            style={{ width: '100%', padding: '8px 12px', background: 'var(--bg-input)', color: 'var(--fg)', border: '1px solid var(--border)', borderRadius: 6, opacity: 0.7 }}>
            <option>Main Branch</option>
          </select>
        </div>
        <div style={{ flex: '0 0 160px' }}>
          <label style={{ fontSize: '0.75rem', color: 'var(--fg-muted)', display: 'block', marginBottom: 4 }}>Transfer Date</label>
          <input type="date" value={transferDate} onChange={e => setTransferDate(e.target.value)}
            style={{ width: '100%', padding: '8px 12px', background: 'var(--bg-input)', color: 'var(--fg)', border: '1px solid var(--border)', borderRadius: 6 }} />
        </div>
      </div>

      {/* Add Products */}
      <div className="card" style={{ padding: 16, marginBottom: 16 }}>
        <label style={{ fontSize: '0.75rem', color: 'var(--fg-muted)', display: 'block', marginBottom: 4 }}>Add Product</label>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', position: 'relative' }}>
          <div style={{ flex: '1 1 250px', position: 'relative' }}>
            <input value={searchQ} onChange={e => handleSearch(e.target.value)} placeholder="Search product..."
              style={{ width: '100%', padding: '8px 12px', background: 'var(--bg-input)', color: 'var(--fg)', border: '1px solid var(--border)', borderRadius: 6, outline: 'none' }} />
            {searchResults.length > 0 && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, background: 'var(--bg-card)', border: '1px solid var(--glass-border)', borderRadius: 6, maxHeight: 160, overflowY: 'auto' }}>
                {searchResults.map(p => (
                  <div key={p.id} onClick={() => addProduct(p)}
                    style={{ padding: '8px 12px', cursor: 'pointer', color: 'var(--fg)', fontSize: '0.85rem', borderBottom: '1px solid var(--border)' }}>
                    {p.name}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div style={{ flex: '0 0 100px' }}>
            <input type="number" min={0} value={addQty} onChange={e => setAddQty(e.target.value)} placeholder="Qty"
              style={{ width: '100%', padding: '8px 12px', background: 'var(--bg-input)', color: 'var(--fg)', border: '1px solid var(--border)', borderRadius: 6 }} />
          </div>
        </div>
      </div>

      {/* Items Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th style={{ textAlign: 'right' }}>Qty</th>
                <th>Date</th>
                <th style={{ width: 60, textAlign: 'center' }}>Remove</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan={4} style={{ textAlign: 'center', padding: 40, color: 'var(--fg-muted)' }}>No items added yet.</td></tr>
              ) : items.map((item, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 600, color: 'var(--fg)' }}>{item.productName}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{item.qty}</td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--fg-muted)' }}>{new Date(item.date).toLocaleDateString('en-IN')}</td>
                  <td style={{ textAlign: 'center' }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => removeItem(i)} style={{ color: 'var(--error)', padding: '4px 8px' }}>x</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Save */}
      <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 12, alignItems: 'center' }}>
        <button className="btn btn-ghost btn-sm" onClick={async () => {
          try {
            const transfer = { id: '', transferNumber: '', fromStoreId: '', toStoreId: '', transferDate: transferDate, status: 'DRAFT', notes: '' } as any
            const transferItems = items.map(item => ({ id: '', transferId: '', productId: item.productId, quantityMillis: item.qty * 1000 } as any))
            await SaveStockTransfer(transfer, transferItems)
            setItems([])
            toast.success('Stock In saved')
          } catch (e: any) { toast.error(e?.message || 'SaveStockTransfer failed'); console.error(e) }
        }} disabled={items.length === 0} style={{ padding: '8px 24px', opacity: items.length === 0 ? 0.5 : 1 }}>
          Save Stock In
        </button>
      </div>
    </div>
  )
}
