import { useEffect, useState, useCallback, useMemo } from 'react'
import toast from 'react-hot-toast'
import { SearchCustomers, SaveCustomer, ListCustomerGroups, SaveCSVFile } from '../../wailsjs/go/main/App'
import { confirmAsk } from '../components/ConfirmDialog'

interface Customer {
  id: string
  tenantId: string
  name: string
  phone: string
  email: string
  gstin: string
  address: string
  creditLimitPaise: number
  isActive: boolean
  businessName: string
  contactId: string
  groupId: string
  contactType: string
  alternatePhone: string
  landline: string
  payTermDays: number
  openingBalancePaise: number
  city: string
  stateCode: string
}

interface Group { id: string; name: string; isActive?: boolean }

const emptyCustomer: Customer = {
  id: '', tenantId: '', name: '', phone: '', email: '', gstin: '', address: '',
  creditLimitPaise: 0, isActive: true, businessName: '', contactId: '', groupId: '',
  contactType: 'individual', alternatePhone: '', landline: '', payTermDays: 0,
  openingBalancePaise: 0, city: '', stateCode: '',
}

const fmt = (p: number) => ((p || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const thStyle = (align: 'left' | 'right' | 'center' = 'left'): React.CSSProperties => ({
  padding: '8px 12px', textAlign: align, fontWeight: 700, fontSize: '0.75rem',
  textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '2px solid var(--border)', whiteSpace: 'nowrap',
})
const tdStyle: React.CSSProperties = { padding: '10px 12px' }

export default function CustomerMaster() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Customer | null>(null)
  const [moreInfo, setMoreInfo] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    try {
      const [list, g] = await Promise.all([SearchCustomers(''), ListCustomerGroups()])
      setCustomers((list || []) as unknown as Customer[])
      setGroups(((g || []) as unknown as Group[]).filter(x => x.isActive !== false))
    } catch (e: any) { console.error(e); toast.error(e?.message || 'Failed to load customers') }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return customers
    return customers.filter(c =>
      (c.name || '').toLowerCase().includes(q) ||
      (c.businessName || '').toLowerCase().includes(q) ||
      (c.contactId || '').toLowerCase().includes(q) ||
      (c.phone || '').toLowerCase().includes(q))
  }, [customers, search])

  const totalCredit = customers.reduce((s, c) => s + (c.creditLimitPaise || 0), 0)

  const openNew = () => { setEditing({ ...emptyCustomer }); setErrors({}); setMoreInfo(false) }
  const openEdit = (c: Customer) => { setEditing({ ...emptyCustomer, ...c }); setErrors({}); setMoreInfo(false) }
  const close = () => { setEditing(null); setErrors({}) }

  const handleSave = async () => {
    if (!editing) return
    const e: Record<string, string> = {}
    if (!editing.name.trim()) e.name = 'Name is required'
    if (!editing.phone.trim()) e.phone = 'Mobile is required'
    setErrors(e)
    if (Object.keys(e).length) { if (e.name || e.phone) setMoreInfo(m => m); return }
    try {
      await SaveCustomer({ ...editing, name: editing.name.trim(), phone: editing.phone.trim() } as any)
      toast.success(editing.id ? 'Customer updated' : 'Customer created')
      close()
      load()
    } catch (err: any) { toast.error(err?.message || 'Save failed') }
  }

  const handleDelete = async (c: Customer) => {
    const ok = await confirmAsk({
      title: 'Deactivate customer?',
      message: `"${c.name}" will be hidden from lists. Past invoices and ledger entries are kept.`,
      confirmText: 'Deactivate',
    })
    if (!ok) return
    try {
      await SaveCustomer({ ...c, isActive: false } as any)
      toast.success('Customer deactivated')
      load()
    } catch (err: any) { toast.error(err?.message || 'Delete failed') }
  }

  const exportCSV = async () => {
    const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const header = ['Contact ID', 'Business Name', 'Name', 'Email', 'Tax No', 'Credit Limit', 'Pay Term (days)', 'City']
    const rows = filtered.map(c => [c.contactId, c.businessName, c.name, c.email, c.gstin, (c.creditLimitPaise / 100).toFixed(2), c.payTermDays, c.city])
    const csv = [header, ...rows].map(r => r.map(esc).join(',')).join('\n')
    try {
      const path = await SaveCSVFile(csv, 'Customers.csv')
      if (path) toast.success('Exported')
    } catch (err: any) { toast.error(err?.message || 'Export failed') }
  }

  const set = (patch: Partial<Customer>) => setEditing(prev => (prev ? { ...prev, ...patch } : prev))
  const errStyle: React.CSSProperties = { fontSize: '0.72rem', color: 'var(--error)', marginTop: 2 }

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--fg-bright)', marginBottom: 2 }}>Customers</h2>
          <div style={{ fontSize: '0.78rem', color: 'var(--fg-muted)' }}>Customers, their dues and advance balance</div>
        </div>
        <button className="btn btn-primary" onClick={openNew}>+ Add Customer</button>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 16px', minWidth: 160 }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Customers</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--fg-bright)' }}>{customers.length}</div>
        </div>
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 16px', minWidth: 160 }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Credit Limit</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--accent)' }}>₹{fmt(totalCredit)}</div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <input placeholder="Search name, business, contact ID, phone..." value={search}
          onChange={e => setSearch(e.target.value)} style={{ width: 340 }} />
        <button className="btn btn-ghost" onClick={exportCSV} disabled={filtered.length === 0}>Export CSV</button>
      </div>

      <div style={{ overflow: 'auto', flex: 1 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
          <thead>
            <tr style={{ background: 'var(--bg-sidebar)' }}>
              <th style={thStyle()}>Contact ID</th>
              <th style={thStyle()}>Business Name</th>
              <th style={thStyle()}>Name</th>
              <th style={thStyle()}>Email</th>
              <th style={thStyle()}>Tax No</th>
              <th style={thStyle('right')}>Credit Limit</th>
              <th style={thStyle('center')}>Pay Term</th>
              <th style={thStyle()}>City</th>
              <th style={thStyle('center')}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(c => (
              <tr key={c.id} style={{ borderBottom: '1px solid var(--border)' }}
                onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = 'var(--bg-card)'}
                onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'}>
                <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: '0.8rem' }}>{c.contactId}</td>
                <td style={tdStyle}>{c.businessName}</td>
                <td style={{ ...tdStyle, fontWeight: 600 }}>{c.name}</td>
                <td style={tdStyle}>{c.email}</td>
                <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: '0.8rem' }}>{c.gstin}</td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>{c.creditLimitPaise ? `₹${fmt(c.creditLimitPaise)}` : '-'}</td>
                <td style={{ ...tdStyle, textAlign: 'center' }}>{c.payTermDays ? `${c.payTermDays}d` : '-'}</td>
                <td style={tdStyle}>{c.city}</td>
                <td style={{ ...tdStyle, textAlign: 'center' }}>
                  <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => openEdit(c)}>Edit</button>
                    <button className="btn btn-ghost btn-sm" style={{ color: 'var(--error)' }} onClick={() => handleDelete(c)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={9} style={{ textAlign: 'center', padding: 40, color: 'var(--fg-muted)' }}>
                No customers found. Click "+ Add Customer" to add one.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="modal-overlay" onClick={close}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ minWidth: 560, maxHeight: '90vh', overflow: 'auto' }}
            onKeyDown={e => {
              const tag = (e.target as HTMLElement).tagName
              if (e.key === 'Escape') { e.stopPropagation(); close() }
              else if (e.key === 'F2' || (e.key === 'Enter' && tag !== 'TEXTAREA' && tag !== 'BUTTON')) {
                e.preventDefault(); e.stopPropagation(); handleSave()
              }
            }}>
            <div className="modal-title">{editing.id ? 'Edit Contact' : 'Add Contact'}</div>

            <div style={{ display: 'flex', gap: 20, marginBottom: 12, fontSize: '0.85rem' }}>
              <span style={{ color: 'var(--fg-muted)' }}>Contact type:</span>
              {(['individual', 'business'] as const).map(t => (
                <label key={t} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <input type="radio" name="contactType" checked={editing.contactType === t} onChange={() => set({ contactType: t })} />
                  {t === 'individual' ? 'Individual' : 'Business'}
                </label>
              ))}
            </div>

            <div className="grid-2" style={{ gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Contact ID</label>
                <input className="form-input" value={editing.contactId} placeholder="Leave empty to auto-generate"
                  disabled={!editing.id} onChange={e => set({ contactId: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Customer Group</label>
                <select className="form-input" value={editing.groupId || ''} onChange={e => set({ groupId: e.target.value })}>
                  <option value="">None</option>
                  {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Name *</label>
                <input className="form-input" value={editing.name} autoFocus onChange={e => set({ name: e.target.value })} />
                {errors.name && <div style={errStyle}>{errors.name}</div>}
              </div>
              <div className="form-group">
                <label className="form-label">Mobile *</label>
                <input className="form-input" value={editing.phone} onChange={e => set({ phone: e.target.value })} />
                {errors.phone && <div style={errStyle}>{errors.phone}</div>}
              </div>
              <div className="form-group">
                <label className="form-label">Alternate contact</label>
                <input className="form-input" value={editing.alternatePhone} onChange={e => set({ alternatePhone: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Landline</label>
                <input className="form-input" value={editing.landline} onChange={e => set({ landline: e.target.value })} />
              </div>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Email</label>
                <input className="form-input" type="email" value={editing.email} onChange={e => set({ email: e.target.value })} />
              </div>
            </div>

            <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 12 }} onClick={() => setMoreInfo(m => !m)}>
              {moreInfo ? '▲ Less Information' : '▼ More Information'}
            </button>

            {moreInfo && (
              <div className="grid-2" style={{ gap: 12, marginTop: 12 }}>
                <div className="form-group">
                  <label className="form-label">Tax number / GSTIN</label>
                  <input className="form-input" value={editing.gstin} maxLength={15}
                    style={{ fontFamily: 'monospace', textTransform: 'uppercase' }}
                    onChange={e => set({ gstin: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Opening Balance (₹)</label>
                  <input className="form-input" type="number" step="0.01"
                    value={editing.openingBalancePaise ? editing.openingBalancePaise / 100 : ''}
                    onChange={e => set({ openingBalancePaise: Math.round(parseFloat(e.target.value || '0') * 100) })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Pay term (days)</label>
                  <input className="form-input" type="number" min={0} step={1}
                    value={editing.payTermDays ? editing.payTermDays : ''}
                    onChange={e => set({ payTermDays: Math.max(0, parseInt(e.target.value || '0', 10) || 0) })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Credit Limit (₹)</label>
                  <input className="form-input" type="number" min={0} step="0.01" placeholder="Blank = no limit"
                    value={editing.creditLimitPaise ? editing.creditLimitPaise / 100 : ''}
                    onChange={e => set({ creditLimitPaise: Math.round(parseFloat(e.target.value || '0') * 100) || 0 })} />
                </div>
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="form-label">Address</label>
                  <textarea className="form-input" rows={2} value={editing.address} onChange={e => set({ address: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">City</label>
                  <input className="form-input" value={editing.city} onChange={e => set({ city: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">State code</label>
                  <input className="form-input" value={editing.stateCode} maxLength={2} placeholder="e.g. 36"
                    onChange={e => set({ stateCode: e.target.value.replace(/[^0-9]/g, '') })} />
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
