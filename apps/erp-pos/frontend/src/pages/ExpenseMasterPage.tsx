import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { FiExternalLink } from 'react-icons/fi'
import { ListExpenseTypes, SaveExpenseType, DeleteExpenseType, ExpenseSummary } from '../../wailsjs/go/main/App'
import { confirmAsk } from '../components/ConfirmDialog'

interface ExpenseType { id: string; name: string; isActive?: boolean }
interface SummaryRow { id: string; label: string; countOrQty: number; amountPaise: number }

const fmt = (p: number) => (p / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })

export default function ExpenseMasterPage() {
  const navigate = useNavigate()
  const [types, setTypes] = useState<ExpenseType[]>([])
  const [summary, setSummary] = useState<SummaryRow[]>([])
  const [editing, setEditing] = useState<ExpenseType | null>(null)
  const [draftName, setDraftName] = useState('')
  const [showInactive, setShowInactive] = useState(false)

  const load = useCallback(async () => {
    try {
      const [t, s] = await Promise.all([ListExpenseTypes(), ExpenseSummary('', '')])
      setTypes(t || [])
      setSummary(s || [])
    } catch (e: any) { toast.error(e?.message || 'Failed to load') }
  }, [])

  const displayed = showInactive ? types : types.filter(t => t.isActive !== false)

  useEffect(() => { load() }, [load])

  const totalById = (id: string): number =>
    summary.find(r => r.id === id)?.amountPaise ?? 0

  const countById = (id: string): number =>
    summary.find(r => r.id === id)?.countOrQty ?? 0

  const grandTotal = types.reduce((s, t) => s + totalById(t.id), 0)

  const openEdit = (t: ExpenseType) => { setEditing(t); setDraftName(t.name) }
  const openCreate = () => { setEditing({ id: '', name: '', isActive: true }); setDraftName('') }

  const handleSave = async () => {
    if (!draftName.trim()) { toast.error('Expense name is required'); return }
    try {
      await SaveExpenseType({ ...editing!, name: draftName.trim() } as any)
      toast.success(editing!.id ? 'Updated' : 'Expense type created')
      setEditing(null)
      load()
    } catch (e: any) { toast.error(e?.message || 'Save failed') }
  }

  const handleDelete = async (t: ExpenseType) => {
    const ok = await confirmAsk({ title: `Deactivate "${t.name}"?`, message: 'It will be hidden from lists. Past entries stay in the ledger. You can reactivate it anytime.', confirmText: 'Deactivate' })
    if (!ok) return
    try { await DeleteExpenseType(t.id); toast.success('Deactivated'); load() } catch (e: any) { toast.error(e?.message || 'Delete failed') }
  }

  const handleReactivate = async (t: ExpenseType) => {
    try { await SaveExpenseType({ ...t, isActive: true } as any); toast.success('Reactivated'); load() } catch (e: any) { toast.error(e?.message || 'Failed') }
  }

  const viewLedger = (typeId: string) => {
    navigate(`/account/expenses?type=${typeId}`)
  }

  return (
    <div className="page">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--fg-bright)', marginBottom: 2 }}>
            Expense Master
            <span style={{ fontSize: '0.8rem', fontWeight: 400, color: 'var(--fg-muted)', marginLeft: 8 }}>({displayed.length} types)</span>
          </h2>
          <div style={{ fontSize: '0.78rem', color: 'var(--fg-muted)' }}>
            Total All-Time Expenses: <strong style={{ color: 'var(--accent)' }}>₹{fmt(grandTotal)}</strong>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.78rem', color: 'var(--fg-muted)', cursor: 'pointer' }}>
            <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} /> Show inactive
          </label>
          <button onClick={() => navigate('/account/expenses')}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', background: 'var(--bg-card)', color: 'var(--accent)', border: '1px solid var(--accent)44', borderRadius: 6, cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}>
            <FiExternalLink size={13} /> View Ledger
          </button>
          <button className="btn btn-primary" onClick={openCreate}>+ Create New</button>
        </div>
      </div>

      {/* Table */}
      <div style={{ overflow: 'auto', flex: 1 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
          <thead>
            <tr style={{ background: 'var(--bg-sidebar)' }}>
              <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '2px solid var(--border)', width: 36 }}>#</th>
              <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '2px solid var(--border)' }}>Expense Name</th>
              <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '2px solid var(--border)', width: 80 }}>Entries</th>
              <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '2px solid var(--border)', width: 150 }}>Balance</th>
              <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '2px solid var(--border)', width: 120 }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {displayed.map((t, i) => {
              const total = totalById(t.id)
              const count = countById(t.id)
              const inactive = t.isActive === false
              return (
                <tr key={t.id} style={{ borderBottom: '1px solid var(--border)', opacity: inactive ? 0.55 : 1 }}
                  onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = 'var(--bg-card)'}
                  onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'}>
                  <td style={{ padding: '10px 12px', color: 'var(--fg-muted)', fontSize: '0.78rem' }}>{i + 1}</td>
                  <td style={{ padding: '10px 12px', fontWeight: 600 }}>
                    {t.name}
                    {inactive && <span style={{ marginLeft: 8, fontSize: '0.68rem', fontWeight: 600, color: 'var(--fg-muted)', border: '1px solid var(--border)', borderRadius: 8, padding: '1px 6px' }}>INACTIVE</span>}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                    {count > 0 ? (
                      <span style={{ display: 'inline-block', padding: '2px 8px', background: 'var(--accent)15', color: 'var(--accent)', borderRadius: 10, fontSize: '0.75rem', fontWeight: 600 }}>{count}</span>
                    ) : (
                      <span style={{ color: 'var(--fg-muted)', fontSize: '0.78rem' }}>0</span>
                    )}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: total > 0 ? 'var(--fg-bright)' : 'var(--fg-muted)' }}>
                    ₹{fmt(total)}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                      <button onClick={() => viewLedger(t.id)}
                        title="View in Ledger"
                        style={{ padding: '3px 8px', border: '1px solid var(--accent)44', borderRadius: 4, background: 'var(--accent)10', cursor: 'pointer', color: 'var(--accent)', fontSize: '0.75rem', fontWeight: 600 }}>
                        Ledger
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => openEdit(t)}>Edit</button>
                      {inactive ? (
                        <button className="btn btn-ghost btn-sm" style={{ color: 'var(--accent)' }} onClick={() => handleReactivate(t)}>Reactivate</button>
                      ) : (
                        <button className="btn btn-ghost btn-sm" style={{ color: 'var(--error)' }} onClick={() => handleDelete(t)}>Delete</button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
            {displayed.length === 0 && (
              <tr><td colSpan={5} style={{ textAlign: 'center', padding: 40, color: 'var(--fg-muted)' }}>
                No expense types found. Click "+ Create New" to add one.
              </td></tr>
            )}
          </tbody>
          {displayed.length > 0 && (
            <tfoot>
              <tr style={{ background: 'var(--bg-sidebar)', fontWeight: 700, borderTop: '2px solid var(--border)' }}>
                <td colSpan={3} style={{ padding: '9px 12px', textAlign: 'right', fontSize: '0.85rem', color: 'var(--fg-muted)' }}>Grand Total :</td>
                <td style={{ padding: '9px 12px', textAlign: 'right', color: 'var(--accent)', fontSize: '0.95rem' }}>₹{fmt(grandTotal)}</td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Create/Edit modal */}
      {editing && (
        <div className="modal-overlay" onClick={() => setEditing(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === 'ArrowDown' || e.key === 'F2') { e.preventDefault(); e.stopPropagation(); handleSave() }
              else if (e.key === 'Escape') { e.stopPropagation(); setEditing(null) }
            }}>
            <div className="modal-title">{editing.id ? 'Edit Expense Type' : 'Create Expense Type'}</div>
            <div className="form-group">
              <label className="form-label">Expense Name *</label>
              <input className="form-input" value={draftName} onChange={e => setDraftName(e.target.value)}
                placeholder="e.g. Electricity, Rent, Transport" autoFocus />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, cursor: 'pointer', fontSize: '0.85rem' }}>
              <input type="checkbox" checked={editing.isActive !== false}
                onChange={e => setEditing({ ...editing, isActive: e.target.checked })} />
              Active <span style={{ color: 'var(--fg-muted)', fontSize: '0.76rem' }}>(unchecked = hidden from lists)</span>
            </label>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button className="btn btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
