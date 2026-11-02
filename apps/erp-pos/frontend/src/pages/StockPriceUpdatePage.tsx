import { useState } from 'react'
import toast from 'react-hot-toast'
import { SearchProducts, UpdateProductPrice } from '../../wailsjs/go/main/App'

interface PriceTier { tier: string; pricePaise: number }
interface Product { id: string; name: string; sku: string; prices: PriceTier[] }

const TIERS = ['MRP', 'CMP_A', 'CMP_B', 'CMP_C', 'CMP_D']
const fmt = (p: number) => (p / 100).toFixed(2)

export default function StockPriceUpdatePage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Product[]>([])
  const [selected, setSelected] = useState<Product | null>(null)
  const [newPrices, setNewPrices] = useState<Record<string, string>>({})

  const handleSearch = async (q: string) => {
    setQuery(q)
    if (q.length < 2) { setResults([]); return }
    try {
      const r = await SearchProducts(q)
      setResults(r || [])
    } catch (e: any) { toast.error(e?.message || 'Search failed'); console.error(e) }
  }

  const selectProduct = (p: Product) => {
    setSelected(p)
    setResults([])
    setQuery(p.name)
    const prices: Record<string, string> = {}
    TIERS.forEach(t => {
      const found = p.prices?.find(pr => pr.tier === t)
      prices[t] = found ? fmt(found.pricePaise) : ''
    })
    setNewPrices(prices)
  }

  const getOldPrice = (tier: string) => {
    const found = selected?.prices?.find(p => p.tier === tier)
    return found ? fmt(found.pricePaise) : '-'
  }

  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column', gap: 0, padding: 0 }}>
      <div style={{ background: 'var(--accent)', color: '#fff', padding: '10px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 600, fontSize: '1rem' }}>Stock Price Update</span>
      </div>

      <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ position: 'relative' }}>
          <input value={query} onChange={e => handleSearch(e.target.value)}
            placeholder="Search product by name or SKU..."
            style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--bg-input)', color: 'var(--fg)', fontSize: '0.9rem' }} />
          {results.length > 0 && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 4, maxHeight: 200, overflow: 'auto', zIndex: 10 }}>
              {results.map(p => (
                <div key={p.id} onClick={() => selectProduct(p)}
                  style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid var(--border)', fontSize: '0.85rem' }}>
                  <span style={{ fontWeight: 500 }}>{p.name}</span>
                  <span style={{ color: 'var(--fg-muted)', marginLeft: 8 }}>SKU: {p.sku || '-'}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {selected && (
        <div style={{ padding: '16px 20px', flex: 1 }}>
          <div style={{ marginBottom: 16, padding: 12, background: 'var(--bg-card)', border: '1px solid var(--glass-border)', borderRadius: 8 }}>
            <span style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--fg)' }}>{selected.name}</span>
            <span style={{ color: 'var(--fg-muted)', marginLeft: 12, fontSize: '0.85rem' }}>SKU: {selected.sku || '-'}</span>
          </div>

          <table>
            <thead>
              <tr>
                <th style={{ width: 120 }}>Price Tier</th>
                <th style={{ textAlign: 'right', width: 150 }}>Current Price</th>
                <th style={{ width: 200 }}>New Price</th>
              </tr>
            </thead>
            <tbody>
              {TIERS.map(tier => (
                <tr key={tier}>
                  <td style={{ fontWeight: 600 }}>{tier}</td>
                  <td style={{ textAlign: 'right', color: 'var(--fg-muted)' }}>{getOldPrice(tier)}</td>
                  <td>
                    <input type="number" step="0.01" min={0} value={newPrices[tier] || ''}
                      onChange={e => setNewPrices({ ...newPrices, [tier]: e.target.value })}
                      placeholder="0.00"
                      style={{ width: '100%', padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 4, textAlign: 'right', background: 'var(--bg-input)', color: 'var(--fg)' }} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ marginTop: 16, textAlign: 'right' }}>
            <button onClick={async () => {
              if (!selected) return
              try {
                for (const [tier, val] of Object.entries(newPrices)) {
                  if (!val) continue
                  const pricePaise = Math.round(parseFloat(val) * 100)
                  await UpdateProductPrice(selected.id, tier, pricePaise)
                }
                toast.success('Prices updated')
                setSelected(null); setNewPrices({}); handleSearch(query)
              } catch (e: any) { toast.error(e?.message || 'Failed to update prices'); console.error(e) }
            }}
              style={{ padding: '8px 24px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}>
              Update Prices
            </button>
          </div>
        </div>
      )}

      {!selected && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--fg-muted)', fontSize: '0.9rem' }}>
          Search and select a product to update prices
        </div>
      )}
    </div>
  )
}
