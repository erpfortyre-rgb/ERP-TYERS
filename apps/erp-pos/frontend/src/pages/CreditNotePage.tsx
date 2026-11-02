import { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'
import { ListCreditNotes, SaveCreditNote, SearchCustomers, DeleteCreditNote } from '../../wailsjs/go/main/App'

interface Customer { id: string; name: string }
interface CN { id: string; noteNumber: string; customerId: string; noteDate: string; amountPaise: number; taxPaise: number; totalPaise: number; reason: string }

const today = () => new Date().toISOString().slice(0, 10)
const fmt = (p: number) => '₹' + (p / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })

export default function CreditNotePage() {
  const [notes, setNotes] = useState<CN[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])

  const [selectedCustomer, setSelectedCustomer] = useState('')
  const [noteDate, setNoteDate] = useState(today())
  const [amountPaise, setAmountPaise] = useState(0)
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [editId, setEditId] = useState('')

  const loadNotes = useCallback(() => {
    ListCreditNotes().then(d => setNotes(d || [])).catch(e => { console.error(e); toast.error('Failed to load credit notes') })
  }, [])

  useEffect(() => { loadNotes() }, [loadNotes])
  useEffect(() => { SearchCustomers('').then(c => setCustomers(c || [])).catch(e => { console.error(e); toast.error('Failed to load customers') }) }, [])

  const handleEdit = (n: CN) => {
    setEditId(n.id)
    setSelectedCustomer(n.customerId)
    setNoteDate(n.noteDate)
    setAmountPaise(n.amountPaise)
    setReason(n.reason || '')
  }

  const handleDelete = async (id: string, num: string) => {
    if (!window.confirm(`Delete credit note ${num}?`)) return
    try {
      await DeleteCreditNote(id)
      toast.success('Deleted')
      loadNotes()
    } catch (e: any) { toast.error(e?.message || 'Delete failed') }
  }

  const handleSave = async () => {
    if (!selectedCustomer) { toast.error('Select a customer'); return }
    if (amountPaise <= 0) { toast.error('Enter amount'); return }
    setSaving(true)
    try {
      await SaveCreditNote({
        id: editId, customerId: selectedCustomer, noteDate, amountPaise, taxPaise: 0, totalPaise: amountPaise, reason,
      } as any)
      toast.success(editId ? 'Credit Note updated' : 'Credit Note saved')
      setEditId(''); setAmountPaise(0); setReason(''); setSelectedCustomer(''); loadNotes()
    } catch (e: any) { toast.error(e?.message || 'Save failed') }
    setSaving(false)
  }

  const customerName = (id: string) => customers.find(c => c.id === id)?.name || '—'

  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column', gap: 0, padding: 0 }}>
      <div style={{ background: 'var(--accent)', color: '#fff', padding: '10px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 600, fontSize: '1rem' }}>Credit Notes</span>
        <span style={{ fontSize: '0.8rem', opacity: 0.8 }}>{notes.length} record{notes.length !== 1 ? 's' : ''}</span>
      </div>

      <div style={{ padding: '16px 20px', display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end', borderBottom: '1px solid var(--border)' }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <label style={{ fontWeight: 600, fontSize: '0.8rem', display: 'block', marginBottom: 4 }}>Customer *</label>
          <select className="form-input" value={selectedCustomer} onChange={e => setSelectedCustomer(e.target.value)}>
            <option value="">Select Customer</option>
            {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontWeight: 600, fontSize: '0.8rem', display: 'block', marginBottom: 4 }}>Date</label>
          <input type="date" className="form-input" value={noteDate} onChange={e => setNoteDate(e.target.value)} />
        </div>
        <div>
          <label style={{ fontWeight: 600, fontSize: '0.8rem', display: 'block', marginBottom: 4 }}>Amount (₹)</label>
          <input type="number" min={0} className="form-input" value={amountPaise ? amountPaise / 100 : ''} placeholder="0.00"
            onChange={e => setAmountPaise(Math.max(0, Math.round(parseFloat(e.target.value || '0') * 100)))}
            style={{ width: 140 }} />
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <label style={{ fontWeight: 600, fontSize: '0.8rem', display: 'block', marginBottom: 4 }}>Reason</label>
          <input className="form-input" value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason for credit note" />
        </div>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : editId ? 'Update' : 'Save'}</button>
        {editId && <button className="btn" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }} onClick={() => { setEditId(''); setAmountPaise(0); setReason(''); setSelectedCustomer('') }}>Cancel</button>}
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '0 20px' }}>
        <table>
          <thead>
            <tr>
              <th style={{ width: 50 }}>#</th>
              <th>Note #</th>
              <th>Customer</th>
              <th style={{ width: 110 }}>Date</th>
              <th style={{ textAlign: 'right', width: 140 }}>Amount</th>
              <th>Reason</th>
              <th style={{ width: 100 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {notes.map((n, i) => (
              <tr key={n.id}>
                <td>{i + 1}</td>
                <td style={{ fontWeight: 500 }}>{n.noteNumber || '—'}</td>
                <td>{customerName(n.customerId)}</td>
                <td>{n.noteDate}</td>
                <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--success)' }}>{fmt(n.amountPaise)}</td>
                <td style={{ color: 'var(--fg-muted)', fontSize: '0.85rem' }}>{n.reason || '—'}</td>
                <td>
                  <button onClick={() => handleEdit(n)} style={{ padding: '2px 8px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', marginRight: 4 }}>✏️</button>
                  <button onClick={() => handleDelete(n.id, n.noteNumber || n.id)} style={{ padding: '2px 8px', background: 'var(--error)', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>🗑</button>
                </td>
              </tr>
            ))}
            {notes.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--fg-muted)' }}>No credit notes yet. Create one above.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
