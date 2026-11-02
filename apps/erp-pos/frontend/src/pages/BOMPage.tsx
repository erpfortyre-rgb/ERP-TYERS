import { useEffect, useState, useRef } from 'react'
import toast from 'react-hot-toast'
import { ListBOMKits, SaveBOMKit, DeleteBOMKit, SearchProducts } from '../../wailsjs/go/main/App'

interface BOMKit { id: string; parentProductId: string; name: string; isActive: boolean; createdAt: string }
interface BOMComponent { id: string; kitId: string; productId: string; quantityMillis: number; priceTier: string; sortOrder: number }
interface ProductResult { id: string; name: string; hsnCode: string; taxPercent: number; prices: { tier: string; pricePaise: number }[] }

interface LocalComponent {
  productId: string; productName: string; quantityMillis: number
  priceTier: string; unitPricePaise: number
}

const TIERS = ['MRP', 'CMP_A', 'CMP_B', 'CMP_C', 'CMP_D'] as const
const fmt = (p: number) => (p / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })

export default function BOMPage() {
  const [kits, setKits] = useState<BOMKit[]>([])
  const [editingKit, setEditingKit] = useState<BOMKit | null>(null)
  const [kitName, setKitName] = useState('')
  const [components, setComponents] = useState<LocalComponent[]>([])

  const [productSearch, setProductSearch] = useState('')
  const [productResults, setProductResults] = useState<ProductResult[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => { loadKits() }, [])

  const loadKits = async () => {
    try {
      const data = await ListBOMKits()
      setKits(data || [])
    } catch (e: any) { toast.error(e?.message || 'Failed to load kits'); console.error(e) }
  }

  useEffect(() => {
    if (productSearch.length >= 2) {
      SearchProducts(productSearch).then((p: any) => { setProductResults(p || []); setShowDropdown(true) }).catch(console.error)
    } else { setProductResults([]); setShowDropdown(false) }
  }, [productSearch])

  const addComponent = (product: ProductResult) => {
    const mrp = product.prices?.find(p => p.tier === 'MRP')?.pricePaise || 0
    setComponents(prev => [...prev, {
      productId: product.id, productName: product.name,
      quantityMillis: 1000, priceTier: 'MRP', unitPricePaise: mrp
    }])
    setProductSearch('')
    setShowDropdown(false)
  }

  const updateComponent = (idx: number, field: string, value: any) => {
    setComponents(prev => {
      const updated = [...prev]
      updated[idx] = { ...updated[idx], [field]: value }
      return updated
    })
  }

  const removeComponent = (idx: number) => setComponents(prev => prev.filter((_, i) => i !== idx))

  const handleSave = async () => {
    if (!kitName.trim()) { toast.error('Kit name is required'); return }
    if (components.length === 0) { toast.error('Add at least one component'); return }
    try {
      const kit: any = {
        id: editingKit?.id || '', parentProductId: components[0].productId, name: kitName, isActive: true, createdAt: ''
      }
      const comps: any[] = components.map((c, i) => ({
        id: '', kitId: '', productId: c.productId,
        quantityMillis: c.quantityMillis, priceTier: c.priceTier, sortOrder: i
      }))
      await SaveBOMKit(kit, comps)
      toast.success('BOM saved!')
      setKitName(''); setComponents([]); setEditingKit(null)
      loadKits()
    } catch (e: any) { toast.error(e?.message || 'Save failed') }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this BOM kit? This cannot be undone.')) return
    try { await DeleteBOMKit(id); toast.success('Kit deleted'); loadKits() }
    catch (e: any) { toast.error(e?.message || 'Delete failed') }
  }

  const handleEditKit = (k: BOMKit) => {
    toast('To edit a BOM kit, delete it and recreate with updated components.', { icon: 'ℹ️', duration: 4000 })
    setKitName(k.name)
    setEditingKit(k)
    setComponents([])
  }

  const newKit = () => { setEditingKit(null); setKitName(''); setComponents([]) }

  const grandTotal = components.reduce((sum, c) => sum + (c.quantityMillis / 1000) * c.unitPricePaise, 0)

  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column', gap: 0, padding: 0 }}>
      <div style={{ background: 'var(--accent)', color: '#fff', padding: '10px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 600, fontSize: '1rem' }}>Bill of Materials (BOM)</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={newKit} style={{ padding: '4px 14px', background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 4, cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem' }}>+ New Kit</button>
        </div>
      </div>

      {/* Kit name + component add */}
      <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
          <label style={{ fontSize: '0.85rem', fontWeight: 600, whiteSpace: 'nowrap' }}>Kit Name:</label>
          <input value={kitName} onChange={e => setKitName(e.target.value)}
            placeholder="e.g. Tyre + Tube + Flap Set"
            style={{ flex: 1, padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--bg-input)', color: 'var(--fg)' }} />
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <label style={{ fontSize: '0.75rem', color: 'var(--fg-muted)', display: 'block', marginBottom: 2 }}>Add Component (search product)</label>
            <input ref={searchRef} value={productSearch} onChange={e => setProductSearch(e.target.value)}
              onFocus={() => productResults.length > 0 && setShowDropdown(true)}
              onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
              placeholder="Type product name..."
              style={{ width: '100%', padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--bg-input)', color: 'var(--fg)' }} />
            {showDropdown && productResults.length > 0 && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-card)',
                border: '1px solid var(--border)', borderRadius: 4, maxHeight: 200, overflow: 'auto', zIndex: 10,
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
              }}>
                {productResults.map(p => (
                  <div key={p.id} onMouseDown={() => addComponent(p)}
                    style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid var(--border)', fontSize: '0.85rem' }}>
                    <strong>{p.name}</strong>
                    <span style={{ marginLeft: 8, color: 'var(--fg-muted)' }}>
                      MRP: {fmt(p.prices?.find(pr => pr.tier === 'MRP')?.pricePaise || 0)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Components table */}
      <div style={{ flex: 1, overflow: 'auto', padding: '0 20px' }}>
        <table>
          <thead>
            <tr>
              <th style={{ width: 40 }}>#</th>
              <th>Component</th>
              <th style={{ textAlign: 'center', width: 90 }}>Qty</th>
              <th style={{ textAlign: 'center', width: 110 }}>Price Tier</th>
              <th style={{ textAlign: 'right', width: 120 }}>Unit Price</th>
              <th style={{ textAlign: 'right', width: 120 }}>Total</th>
              <th style={{ width: 50 }}></th>
            </tr>
          </thead>
          <tbody>
            {components.map((c, i) => {
              const qty = c.quantityMillis / 1000
              return (
                <tr key={i}>
                  <td>{i + 1}</td>
                  <td style={{ fontWeight: 500 }}>{c.productName}</td>
                  <td style={{ textAlign: 'center' }}>
                    <input type="number" value={qty} min={1}
                      onChange={e => updateComponent(i, 'quantityMillis', (parseInt(e.target.value) || 1) * 1000)}
                      style={{ width: 60, padding: '3px 6px', textAlign: 'center', border: '1px solid var(--border)', borderRadius: 4 }} />
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <select value={c.priceTier} onChange={e => updateComponent(i, 'priceTier', e.target.value)}
                      style={{ padding: '3px 6px', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--bg-input)', color: 'var(--fg)' }}>
                      {TIERS.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
                    </select>
                  </td>
                  <td style={{ textAlign: 'right' }}>{fmt(c.unitPricePaise)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(qty * c.unitPricePaise)}</td>
                  <td>
                    <button onClick={() => removeComponent(i)}
                      style={{ padding: '2px 8px', background: 'var(--error)', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.75rem' }}>
                      ✕
                    </button>
                  </td>
                </tr>
              )
            })}
            {components.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--fg-muted)' }}>Search and add product components above</td></tr>
            )}
          </tbody>
          {components.length > 0 && (
            <tfoot>
              <tr>
                <td colSpan={5} style={{ textAlign: 'right', fontWeight: 700, fontSize: '0.95rem' }}>Kit Total:</td>
                <td style={{ textAlign: 'right', fontWeight: 700, fontSize: '0.95rem', color: 'var(--accent)' }}>{fmt(grandTotal)}</td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>

        {/* Saved kits list */}
        {kits.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <h3 style={{ fontSize: '0.95rem', marginBottom: 8, color: 'var(--fg)' }}>Saved BOM Kits</h3>
            <table>
              <thead>
                <tr>
                  <th style={{ width: 40 }}>#</th>
                  <th>Kit Name</th>
                  <th style={{ width: 100 }}>Status</th>
                  <th style={{ width: 100 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {kits.map((k, i) => (
                  <tr key={k.id}>
                    <td>{i + 1}</td>
                    <td style={{ fontWeight: 500 }}>{k.name}</td>
                    <td>
                      <span className={`badge ${k.isActive ? 'badge-success' : 'badge-warning'}`}>
                        {k.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button onClick={() => handleEditKit(k)}
                          style={{ padding: '2px 10px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.75rem' }}>
                          Edit
                        </button>
                        <button onClick={() => handleDelete(k.id)}
                          style={{ padding: '2px 10px', background: 'var(--error)', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.75rem' }}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Save bar */}
      <div style={{ padding: '10px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button onClick={newKit}
          style={{ padding: '8px 16px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer', fontWeight: 600, color: 'var(--fg)' }}>
          Clear
        </button>
        <button onClick={handleSave} disabled={!kitName.trim()}
          style={{ padding: '8px 24px', background: kitName.trim() ? 'var(--accent)' : 'var(--fg-muted)', color: '#fff', border: 'none', borderRadius: 4, cursor: kitName.trim() ? 'pointer' : 'not-allowed', fontWeight: 600, opacity: kitName.trim() ? 1 : 0.6 }}>
          Save BOM Kit
        </button>
      </div>
    </div>
  )
}
