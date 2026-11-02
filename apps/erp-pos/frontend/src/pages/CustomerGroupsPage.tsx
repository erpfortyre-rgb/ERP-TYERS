import { useEffect, useState, useCallback } from 'react'
import toast from 'react-hot-toast'
import { ListCustomerGroups, SaveCustomerGroup, DeleteCustomerGroup } from '../../wailsjs/go/main/App'
import { confirmAsk } from '../components/ConfirmDialog'

interface CustomerGroup {
  id: string
  tenantId: string
  name: string
  calcPercent: number
  sellingPriceGroup: string
  isActive: boolean
}

const emptyGroup: CustomerGroup = { id: '', tenantId: '', name: '', calcPercent: 0, sellingPriceGroup: '', isActive: true }

const thStyle = (align: 'left' | 'right' | 'center' = 'left'): React.CSSProperties => ({
  padding: '8px 12px', textAlign: align, fontWeight: 700, fontSize: '0.75rem',
  textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '2px solid var(--border)',
})

export default function CustomerGroupsPage() {
  const [groups, setGroups] = useState<CustomerGroup[]>([])
  const [editing, setEditing] = useState<CustomerGroup | null>(null)
  const [pctText, setPctText] = useState('0')

  const load = useCallback(async () => {
    try {
      const list = (await ListCustomerGroups()) as unknown as CustomerGroup[]
      setGroups((list || []).filter(g => g.isActive !== false))
    } catch (e: any) { toast.error(e?.message || 'Failed to load groups') }
  }, [])

  useEffect(() => { load() }, [load])

  const openNew = () => { setEditing({ ...emptyGroup }); setPctText('0') }
  const openEdit = (g: CustomerGroup) => { setEditing({ ...g }); setPctText(String(g.calcPercent ?? 0)) }
  const close = () => setEditing(null)

  const handleSave = async () => {
    if (!editing) return
    if (!editing.name.trim()) { toast.error('Name is required'); return }
    const pct = parseFloat(pctText)
    if (pctText.trim() !== '' && isNaN(pct)) { toast.error('Calculation percentage must be a number'); return }
    try {
      await SaveCustomerGroup({ ...editing, name: editing.name.trim(), calcPercent: isNaN(pct) ? 0 : pct, isActive: true } as any)
      toast.success(editing.id ? 'Group updated' : 'Group created')
      close()
      load()
    } catch (e: any) { toast.error(e?.message || 'Save failed') }
  }

  const handleDelete = async (g: CustomerGroup) => {
    const ok = await confirmAsk({
      title: `Delete "${g.name}"?`,
      message: 'This customer group will be removed from lists.',
      confirmText: 'Delete',
    })
    if (!ok) return
    try { await DeleteCustomerGroup(g.id); toast.success('Group deleted'); load() }
    catch (e: any) { toast.error(e?.message || 'Delete failed') }
  }

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--fg-bright)', marginBottom: 2 }}>
            Customer Groups
            <span style={{ fontSize: '0.8rem', fontWeight: 400, color: 'var(--fg-muted)', marginLeft: 8 }}>({groups.length})</span>
          </h2>
          <div style={{ fontSize: '0.78rem', color: 'var(--fg-muted)' }}>
            Group discount % is applied to this group's customers during billing.
          </div>
        </div>
        <button className="btn btn-primary" onClick={openNew}>+ Add</button>
      </div>

      <div style={{ overflow: 'auto', flex: 1 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
          <thead>
            <tr style={{ background: 'var(--bg-sidebar)' }}>
              <th style={thStyle()}>Group Name</th>
              <th style={thStyle('right')}>Calculation Percentage (%)</th>
              <th style={thStyle()}>Selling Price Group</th>
              <th style={thStyle('center')}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {groups.map(g => (
              <tr key={g.id} style={{ borderBottom: '1px solid var(--border)' }}
                onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = 'var(--bg-card)'}
                onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'}>
                <td style={{ padding: '10px 12px', fontWeight: 600 }}>{g.name}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right' }}>{g.calcPercent}%</td>
                <td style={{ padding: '10px 12px' }}>{g.sellingPriceGroup}</td>
                <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                  <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => openEdit(g)}>Edit</button>
                    <button className="btn btn-ghost btn-sm" style={{ color: 'var(--error)' }} onClick={() => handleDelete(g)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
            {groups.length === 0 && (
              <tr><td colSpan={4} style={{ textAlign: 'center', padding: 40, color: 'var(--fg-muted)' }}>
                No customer groups found. Click "+ Add" to create one.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="modal-overlay" onClick={close}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ minWidth: 420 }}
            onKeyDown={e => {
              if (e.key === 'Escape') { e.stopPropagation(); close() }
              else if (e.key === 'Enter' || e.key === 'F2') { e.preventDefault(); e.stopPropagation(); handleSave() }
            }}>
            <div className="modal-title">{editing.id ? 'Edit Customer Group' : 'Add Customer Group'}</div>
            <div className="form-group">
              <label className="form-label">Name *</label>
              <input className="form-input" value={editing.name} autoFocus
                onChange={e => setEditing({ ...editing, name: e.target.value })} />
            </div>
            <div className="form-group" style={{ marginTop: 12 }}>
              <label className="form-label">Calculation Percentage</label>
              <input className="form-input" type="number" step="0.01" value={pctText} placeholder="e.g. -2"
                onChange={e => setPctText(e.target.value)} />
            </div>
            <div className="form-group" style={{ marginTop: 12 }}>
              <label className="form-label">Selling Price Group</label>
              <input className="form-input" value={editing.sellingPriceGroup}
                onChange={e => setEditing({ ...editing, sellingPriceGroup: e.target.value })} />
            </div>
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
