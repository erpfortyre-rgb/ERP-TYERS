import { useState, useEffect } from 'react'
import { SearchProducts } from '../../wailsjs/go/main/App'

interface ProductResult { id: string; name: string; hsnCode: string; taxPercent: number; prices: { tier: string; pricePaise: number }[] }

export interface LineItem {
  productId: string; productName: string; gstPercent: number; hsnCode: string
  quantity: number; pricePaise: number; amountPaise: number
}

interface Props {
  items: LineItem[]
  onItemsChange: (items: LineItem[]) => void
}

const fmt = (p: number) => p === 0 ? '0' : (p / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })

export function InvoiceProductTable({ items, onItemsChange }: Props) {
  const [productSearch, setProductSearch] = useState('')
  const [productResults, setProductResults] = useState<ProductResult[]>([])
  const [showDropdown, setShowDropdown] = useState(false)

  useEffect(() => {
    if (productSearch.length >= 2) {
      SearchProducts(productSearch).then((p: any) => { setProductResults(p || []); setShowDropdown(true) }).catch(console.error)
    } else { setProductResults([]); setShowDropdown(false) }
  }, [productSearch])

  const addItem = (product: ProductResult) => {
    const mrp = product.prices?.find(p => p.tier === 'MRP')?.pricePaise || product.prices?.[0]?.pricePaise || 0
    onItemsChange([...items, {
      productId: product.id, productName: product.name, gstPercent: product.taxPercent || 0,
      hsnCode: product.hsnCode, quantity: 1, pricePaise: mrp, amountPaise: mrp
    }])
    setProductSearch('')
    setShowDropdown(false)
  }

  const updateItem = (idx: number, field: string, value: any) => {
    const updated = [...items]
    const item = { ...updated[idx], [field]: value }
    item.amountPaise = item.quantity * item.pricePaise
    updated[idx] = item
    onItemsChange(updated)
  }

  const removeItem = (idx: number) => onItemsChange(items.filter((_, i) => i !== idx))

  return (
    <table>
      <thead>
        <tr>
          <th style={{ width: 50 }}>S.NO</th>
          <th>PRODUCT NAME</th>
          <th style={{ width: 70 }}>GST%</th>
          <th style={{ width: 100 }}>HSN-SAC</th>
          <th style={{ width: 80 }}>QTY</th>
          <th style={{ width: 120 }}>PRICE</th>
          <th style={{ textAlign: 'right', width: 120 }}>AMOUNT</th>
          <th style={{ width: 60 }}>ACTION</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style={{ color: 'var(--fg-muted)' }}>#</td>
          <td style={{ position: 'relative' }}>
            <input value={productSearch} onChange={e => setProductSearch(e.target.value)}
              placeholder="Search product..."
              onFocus={() => productResults.length > 0 && setShowDropdown(true)}
              onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
              style={{ width: '100%', padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 4 }} />
            {showDropdown && productResults.length > 0 && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-card)',
                border: '1px solid var(--border)', borderRadius: 4, maxHeight: 200, overflow: 'auto', zIndex: 10,
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
              }}>
                {productResults.map(p => (
                  <div key={p.id} onMouseDown={() => addItem(p)}
                    style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid var(--border)', fontSize: '0.85rem' }}>
                    <strong>{p.name}</strong>
                    <span style={{ marginLeft: 8, color: 'var(--fg-muted)' }}>GST: {p.taxPercent}%</span>
                  </div>
                ))}
              </div>
            )}
          </td>
          <td></td><td></td><td></td><td></td><td></td><td></td>
        </tr>
        {items.map((item, i) => (
          <tr key={i}>
            <td>{i + 1}</td>
            <td style={{ fontWeight: 500 }}>{item.productName}</td>
            <td>{item.gstPercent}%</td>
            <td>{item.hsnCode}</td>
            <td>
              <input type="number" value={item.quantity} min={1}
                onChange={e => updateItem(i, 'quantity', parseInt(e.target.value) || 1)}
                style={{ width: 60, padding: '4px 6px', textAlign: 'center', border: '1px solid var(--border)', borderRadius: 4 }} />
            </td>
            <td>
              <input type="number" min={0} value={(item.pricePaise / 100).toFixed(2)}
                onChange={e => updateItem(i, 'pricePaise', Math.max(0, Math.round(parseFloat(e.target.value || '0') * 100)))}
                style={{ width: 100, padding: '4px 6px', textAlign: 'right', border: '1px solid var(--border)', borderRadius: 4 }} />
            </td>
            <td style={{ textAlign: 'right', fontWeight: 500 }}>{fmt(item.amountPaise)}</td>
            <td>
              <button onClick={() => removeItem(i)}
                style={{ padding: '2px 8px', background: 'var(--error)', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>✕</button>
            </td>
          </tr>
        ))}
        {items.length === 0 && (
          <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--fg-muted)' }}>Search and add products</td></tr>
        )}
      </tbody>
    </table>
  )
}

export function InvoiceTotals({ items, remark, onRemarkChange }: {
  items: LineItem[]; remark: string; onRemarkChange: (v: string) => void
}) {
  const totalQty = items.reduce((s, i) => s + i.quantity, 0)
  const subtotal = items.reduce((s, i) => s + i.amountPaise, 0)
  const taxableAmount = items.reduce((s, i) => s + Math.round(i.amountPaise * 100 / (100 + i.gstPercent)), 0)
  const totalGst = subtotal - taxableAmount
  const cgst = Math.round(totalGst / 2)
  const sgst = totalGst - cgst

  return (
    <div style={{ borderTop: '2px solid var(--border)', padding: '12px 20px', display: 'flex', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', gap: 24 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--fg-muted)' }}>Total Qty</div>
          <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{totalQty}</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--fg-muted)' }}>Taxable</div>
          <div style={{ fontWeight: 700 }}>{fmt(taxableAmount)}</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--fg-muted)' }}>CGST</div>
          <div style={{ fontWeight: 700 }}>{fmt(cgst)}</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--fg-muted)' }}>SGST</div>
          <div style={{ fontWeight: 700 }}>{fmt(sgst)}</div>
        </div>
      </div>
      <div style={{ minWidth: 200 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <span>Remark</span>
          <input value={remark} onChange={e => onRemarkChange(e.target.value)} placeholder="Notes"
            style={{ width: 150, padding: '2px 6px', border: '1px solid var(--border)', borderRadius: 4 }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '1.1rem', borderTop: '1px solid var(--border)', paddingTop: 8 }}>
          <span>Grand Total</span>
          <span style={{ color: 'var(--accent)' }}>{fmt(subtotal)}</span>
        </div>
      </div>
    </div>
  )
}
