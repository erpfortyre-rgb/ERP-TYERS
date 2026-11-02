import { useState } from 'react'
import { SearchProducts } from '../../wailsjs/go/main/App'

interface Product {
  id: string; name: string; sku: string; hsnCode: string; prices: Array<{ tier: string; pricePaise: number }>
}

const fmt = (p: number) => (p / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })

export default function BarcodePage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Product[]>([])
  const [selected, setSelected] = useState<Product | null>(null)
  const [quantity, setQuantity] = useState(1)

  const handleSearch = async (q: string) => {
    setQuery(q)
    if (q.length < 2) { setResults([]); return }
    try {
      const r = await SearchProducts(q)
      setResults(r || [])
    } catch (e) { console.error(e) }
  }

  const selectProduct = (p: Product) => {
    setSelected(p)
    setResults([])
    setQuery(p.name)
  }

  const mrpPrice = selected?.prices?.find(p => p.tier === 'MRP')
  const barcodeValue = selected ? (selected.sku || selected.id) : ''

  const generateBars = (value: string) => {
    const bars: { width: number; black: boolean }[] = []
    bars.push({ width: 2, black: true }, { width: 1, black: false }, { width: 2, black: true })
    for (let i = 0; i < value.length; i++) {
      const code = value.charCodeAt(i)
      bars.push({ width: 2, black: true })
      bars.push({ width: code % 2 === 0 ? 1 : 2, black: false })
      bars.push({ width: code % 3 === 0 ? 3 : 1, black: true })
      bars.push({ width: 1, black: false })
    }
    bars.push({ width: 2, black: true }, { width: 1, black: false }, { width: 2, black: true })
    return bars
  }

  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column', gap: 0, padding: 0 }}>
      <div style={{ background: 'var(--accent)', color: '#fff', padding: '10px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 600, fontSize: '1rem' }}>Barcode Generator</span>
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
        <div style={{ padding: '16px 20px', display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 250, border: '1px solid var(--glass-border)', borderRadius: 8, padding: 16, background: 'var(--bg-card)' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '1rem', color: 'var(--fg)' }}>Product Details</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: '6px 12px', fontSize: '0.85rem' }}>
              <span style={{ color: 'var(--fg-muted)' }}>Name:</span><span style={{ fontWeight: 500, color: 'var(--fg)' }}>{selected.name}</span>
              <span style={{ color: 'var(--fg-muted)' }}>SKU:</span><span style={{ color: 'var(--fg)' }}>{selected.sku || '-'}</span>
              <span style={{ color: 'var(--fg-muted)' }}>HSN:</span><span style={{ color: 'var(--fg)' }}>{selected.hsnCode || '-'}</span>
              <span style={{ color: 'var(--fg-muted)' }}>MRP:</span><span style={{ fontWeight: 600, color: 'var(--fg)' }}>{mrpPrice ? fmt(mrpPrice.pricePaise) : '-'}</span>
            </div>
          </div>

          <div style={{ flex: 1, minWidth: 300, border: '1px solid var(--glass-border)', borderRadius: 8, padding: 16, background: 'var(--bg-card)', textAlign: 'center' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '1rem', color: 'var(--fg)' }}>Barcode</h3>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', height: 60, marginBottom: 8 }}>
              {generateBars(barcodeValue).map((bar, i) => (
                <div key={i} style={{ width: bar.width, height: bar.black ? 55 : 50, background: bar.black ? 'var(--fg)' : 'transparent' }} />
              ))}
            </div>
            <div style={{ fontFamily: 'monospace', fontSize: '1.1rem', letterSpacing: 4, fontWeight: 600, color: 'var(--fg)' }}>{barcodeValue}</div>

            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'center', gap: 12, alignItems: 'center' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--fg-muted)' }}>Qty:</label>
              <input type="number" value={quantity} min={1} onChange={e => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                style={{ width: 60, padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 4, textAlign: 'center', background: 'var(--bg-input)', color: 'var(--fg)' }} />
              <button onClick={() => window.print()}
                style={{ padding: '6px 20px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}>
                Print {quantity} Label(s)
              </button>
            </div>
          </div>
        </div>
      )}

      {!selected && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--fg-muted)', fontSize: '0.9rem' }}>
          Search and select a product to generate barcode
        </div>
      )}
    </div>
  )
}
