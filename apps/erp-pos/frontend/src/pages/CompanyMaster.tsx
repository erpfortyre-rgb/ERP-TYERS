import { useEffect, useState, useCallback, useMemo } from 'react'
import toast from 'react-hot-toast'
import { ListCompanies, GetCompany, SaveCompany, DeleteCompany, SaveCSVFile } from '../../wailsjs/go/main/App'
import { confirmAsk } from '../components/ConfirmDialog'

interface Company {
  id: string
  tenantId: string
  name: string
  contactPerson: string
  phone: string
  email: string
  gstin: string
  pan: string
  address: string
  city: string
  state: string
  stateCode: string
  pincode: string
  openingBalancePaise: number
  isActive: boolean
  createdAt?: string
}

const emptyCompany: Company = {
  id: '', tenantId: '', name: '', contactPerson: '', phone: '', email: '', gstin: '', pan: '',
  address: '', city: '', state: '', stateCode: '', pincode: '', openingBalancePaise: 0, isActive: true,
}

const fmt = (p: number) => ((p || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const thStyle = (align: 'left' | 'right' | 'center' = 'left'): React.CSSProperties => ({
  padding: '8px 12px', textAlign: align, fontWeight: 700, fontSize: '0.75rem',
  textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '2px solid var(--border)', whiteSpace: 'nowrap',
})
const tdStyle: React.CSSProperties = { padding: '10px 12px' }

export default function CompanyMaster() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Company | null>(null)
  const [moreInfo, setMoreInfo] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    try {
      const list = await ListCompanies('')
      // Deleted suppliers are soft-deleted (isActive = false): hide them
      setCompanies(((list || []) as unknown as Company[]).filter(c => c.isActive !== false))
    } catch (e: any) { console.error(e); toast.error(e?.message || 'Failed to load suppliers') }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return companies
    return companies.filter(c =>
      (c.name || '').toLowerCase().includes(q) ||
      (c.phone || '').toLowerCase().includes(q) ||
      (c.gstin || '').toLowerCase().includes(q) ||
      (c.contactPerson || '').toLowerCase().includes(q))
  }, [companies, search])

  const totalOpening = companies.reduce((s, c) => s + (c.openingBalancePaise || 0), 0)

  const openNew = () => { setEditing({ ...emptyCompany }); setErrors({}); setMoreInfo(false) }
  const openEdit = async (c: Company) => {
    let full: Company = c
    try {
      const g = await GetCompany(c.id)
      if (g) full = g as unknown as Company
    } catch { /* fall back to list row */ }
    setEditing({ ...emptyCompany, ...full })
    setErrors({})
    setMoreInfo(false)
  }
  const close = () => { setEditing(null); setErrors({}) }

  const handleSave = async () => {
    if (!editing) return
    const e: Record<string, string> = {}
    if (!editing.name.trim()) e.name = 'Name is required'
    setErrors(e)
    if (Object.keys(e).length) return
    try {
      await SaveCompany({ ...editing, name: editing.name.trim() } as any)
      toast.success(editing.id ? 'Supplier updated' : 'Supplier created')
      close()
      load()
    } catch (err: any) { toast.error(err?.message || 'Save failed') }
  }

  const handleDelete = async (c: Company) => {
    const ok = await confirmAsk({
      title: 'Delete supplier?',
      message: `"${c.name}" will be removed from the supplier list. Past purchases and ledger entries are kept.`,
      confirmText: 'Delete',
    })
    if (!ok) return
    try {
      await DeleteCompany(c.id)
      toast.success('Supplier deleted')
      load()
    } catch (err: any) { toast.error(err?.message || 'Delete failed') }
  }

  const exportCSV = async () => {
    const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const header = ['Name', 'Contact Person', 'Phone', 'GSTIN', 'City', 'State', 'Opening Balance']
    const rows = filtered.map(c => [c.name, c.contactPerson, c.phone, c.gstin, c.city, c.state, ((c.openingBalancePaise || 0) / 100).toFixed(2)])
    const csv = [header, ...rows].map(r => r.map(esc).join(',')).join('\n')
    try {
      const path = await SaveCSVFile(csv, 'Suppliers.csv')
      if (path) toast.success('Exported')
    } catch (err: any) { toast.error(err?.message || 'Export failed') }
  }

  const set = (patch: Partial<Company>) => setEditing(prev => (prev ? { ...prev, ...patch } : prev))
  const errStyle: React.CSSProperties = { fontSize: '0.72rem', color: 'var(--error)', marginTop: 2 }

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--fg-bright)', marginBottom: 2 }}>Suppliers</h2>
          <div style={{ fontSize: '0.78rem', color: 'var(--fg-muted)' }}>Suppliers, what you owe them and advances paid</div>
        </div>
        <button className="btn btn-primary" onClick={openNew}>+ Add Supplier</button>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 16px', minWidth: 160 }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Suppliers</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--fg-bright)' }}>{companies.length}</div>
        </div>
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 16px', minWidth: 160 }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Opening Balance</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--accent)' }}>{totalOpening < 0 ? '-' : ''}₹{fmt(Math.abs(totalOpening))}</div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <input placeholder="Search name, contact person, phone, GSTIN..." value={search}
          onChange={e => setSearch(e.target.value)} style={{ width: 340 }} />
        <button className="btn btn-ghost" onClick={exportCSV} disabled={filtered.length === 0}>Export CSV</button>
      </div>

      <div style={{ overflow: 'auto', flex: 1 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
          <thead>
            <tr style={{ background: 'var(--bg-sidebar)' }}>
              <th style={thStyle()}>Name</th>
              <th style={thStyle()}>Contact Person</th>
              <th style={thStyle()}>Phone</th>
              <th style={thStyle()}>GSTIN</th>
              <th style={thStyle()}>City</th>
              <th style={thStyle()}>State</th>
              <th style={thStyle('right')}>Opening Balance</th>
              <th style={thStyle('center')}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(c => (
              <tr key={c.id} style={{ borderBottom: '1px solid var(--border)' }}
                onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = 'var(--bg-card)'}
                onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'}>
                <td style={{ ...tdStyle, fontWeight: 600 }}>{c.name}</td>
                <td style={tdStyle}>{c.contactPerson}</td>
                <td style={tdStyle}>{c.phone}</td>
                <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: '0.8rem' }}>{c.gstin}</td>
                <td style={tdStyle}>{c.city}</td>
                <td style={tdStyle}>{c.state}</td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>
                  {c.openingBalancePaise ? `${c.openingBalancePaise < 0 ? '-' : ''}₹${fmt(Math.abs(c.openingBalancePaise))}` : '-'}
                </td>
                <td style={{ ...tdStyle, textAlign: 'center' }}>
                  <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => openEdit(c)}>Edit</button>
                    <button className="btn btn-ghost btn-sm" style={{ color: 'var(--error)' }} onClick={() => handleDelete(c)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--fg-muted)' }}>
                No suppliers found. Click "+ Add Supplier" to add one.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="modal-overlay" onClick={close}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ minWidth: 560, maxHeight: '90vh', overflow: 'auto' }}
            onKeyDown={ev => {
              const target = ev.target as HTMLElement
              const tag = target.tagName
              if (ev.key === 'Escape') { ev.stopPropagation(); close() }
              else if (ev.key === 'F2' || (ev.key === 'Enter' && tag !== 'TEXTAREA' && tag !== 'BUTTON')) {
                ev.preventDefault(); ev.stopPropagation(); handleSave()
              }
            }}>
            <div className="modal-title">{editing.id ? 'Edit Supplier' : 'Add Supplier'}</div>

            <div className="grid-2" style={{ gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Name *</label>
                <input className="form-input" value={editing.name} autoFocus onChange={e => set({ name: e.target.value })} />
                {errors.name && <div style={errStyle}>{errors.name}</div>}
              </div>
              <div className="form-group">
                <label className="form-label">Contact Person</label>
                <input className="form-input" value={editing.contactPerson} onChange={e => set({ contactPerson: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Phone</label>
                <input className="form-input" value={editing.phone} onChange={e => set({ phone: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input className="form-input" type="email" value={editing.email} onChange={e => set({ email: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">GSTIN</label>
                <input className="form-input" value={editing.gstin} maxLength={15} placeholder="e.g. 36ABCDE1234F1Z5"
                  style={{ fontFamily: 'monospace', textTransform: 'uppercase' }}
                  onChange={e => set({ gstin: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })} />
              </div>
              <div className="form-group">
                <label className="form-label">PAN</label>
                <input className="form-input" value={editing.pan} maxLength={10} placeholder="e.g. ABCDE1234F"
                  style={{ fontFamily: 'monospace', textTransform: 'uppercase' }}
                  onChange={e => set({ pan: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })} />
              </div>
            </div>

            <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 12 }} onClick={() => setMoreInfo(m => !m)}>
              {moreInfo ? '▲ Less Information' : '▼ More Information'}
            </button>

            {moreInfo && (
              <div className="grid-2" style={{ gap: 12, marginTop: 12 }}>
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="form-label">Address</label>
                  <textarea className="form-input" rows={2} value={editing.address} onChange={e => set({ address: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">City</label>
                  <input className="form-input" value={editing.city} onChange={e => set({ city: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">State</label>
                  <input className="form-input" value={editing.state} onChange={e => set({ state: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">State Code</label>
                  <input className="form-input" value={editing.stateCode} maxLength={2} placeholder="e.g. 36"
                    onChange={e => set({ stateCode: e.target.value.replace(/[^0-9]/g, '') })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Pincode</label>
                  <input className="form-input" value={editing.pincode} maxLength={6} inputMode="numeric"
                    onChange={e => set({ pincode: e.target.value.replace(/[^0-9]/g, '') })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Opening Balance (₹)</label>
                  <input className="form-input" type="number" step="0.01"
                    value={editing.openingBalancePaise ? editing.openingBalancePaise / 100 : ''}
                    onChange={e => set({ openingBalancePaise: Math.round(parseFloat(e.target.value || '0') * 100) || 0 })} />
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button className="btn btn-primary" style={{ background: '#16a34a', borderColor: '#16a34a' }} onClick={handleSave}>Save</button>
              <button className="btn btn-ghost" onClick={close}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
