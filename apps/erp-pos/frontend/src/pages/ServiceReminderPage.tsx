import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { ListServiceReminders, SaveServiceReminder, DeleteServiceReminder } from '../../wailsjs/go/main/App'

interface Reminder {
  id: string; customerName: string; phone: string; vehicleNumber: string
  serviceType: string; reminderDate: string; status: string
}

export default function ServiceReminderPage() {
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [draft, setDraft] = useState({
    customerName: '', phone: '', vehicleNumber: '',
    serviceType: 'Alignment', reminderDate: ''
  })
  const [editId, setEditId] = useState<string | null>(null)

  useEffect(() => { loadReminders() }, [])

  const loadReminders = async () => {
    try {
      const data = await ListServiceReminders('') as any
      setReminders(data || [])
    } catch (e: any) { toast.error(e?.message || 'Failed to load reminders'); console.error(e) }
  }

  const handleSave = async () => {
    if (!draft.customerName || !draft.reminderDate) return
    try {
      await SaveServiceReminder({ ...draft, id: editId || '', status: 'PENDING' } as any)
      toast.success(editId ? 'Reminder updated' : 'Reminder saved')
      setDraft({ customerName: '', phone: '', vehicleNumber: '', serviceType: 'Alignment', reminderDate: '' })
      setEditId(null)
      loadReminders()
    } catch (e: any) { toast.error(e?.message || 'Failed to save'); console.error(e) }
  }

  const handleEdit = (r: Reminder) => {
    setDraft({ customerName: r.customerName, phone: r.phone, vehicleNumber: r.vehicleNumber, serviceType: r.serviceType, reminderDate: r.reminderDate })
    setEditId(r.id)
    window.scrollTo(0, 0)
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this reminder? This cannot be undone.')) return
    try {
      await DeleteServiceReminder(id)
      toast.success('Reminder deleted')
      loadReminders()
    } catch (e: any) { toast.error(e?.message || 'Failed to delete'); console.error(e) }
  }

  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column', gap: 0, padding: 0 }}>
      <div style={{ background: 'var(--accent)', color: '#fff', padding: '10px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 600, fontSize: '1rem' }}>Service Reminders</span>
        <span style={{ fontSize: '0.85rem' }}>{reminders.length} reminder(s)</span>
      </div>

      <div style={{ padding: '12px 20px', display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'flex-end', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <label style={{ fontSize: '0.75rem', color: 'var(--fg-muted)' }}>Customer Name *</label>
          <input value={draft.customerName} onChange={e => setDraft({ ...draft, customerName: e.target.value })}
            placeholder="Customer Name" style={{ padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--bg-input)', color: 'var(--fg)' }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <label style={{ fontSize: '0.75rem', color: 'var(--fg-muted)' }}>Phone</label>
          <input value={draft.phone} inputMode="numeric" maxLength={10}
            onChange={e => setDraft({ ...draft, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
            placeholder="Phone" style={{ padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--bg-input)', color: 'var(--fg)' }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <label style={{ fontSize: '0.75rem', color: 'var(--fg-muted)' }}>Vehicle No.</label>
          <input value={draft.vehicleNumber} maxLength={10}
            onChange={e => setDraft({ ...draft, vehicleNumber: e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase() })}
            placeholder="e.g. TS07EA1234" style={{ padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--bg-input)', color: 'var(--fg)', textTransform: 'uppercase' }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <label style={{ fontSize: '0.75rem', color: 'var(--fg-muted)' }}>Service Type</label>
          <select value={draft.serviceType} onChange={e => setDraft({ ...draft, serviceType: e.target.value })}
            style={{ padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--bg-input)', color: 'var(--fg)' }}>
            <option>Alignment</option>
            <option>Balancing</option>
            <option>Rotation</option>
            <option>General Service</option>
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <label style={{ fontSize: '0.75rem', color: 'var(--fg-muted)' }}>Reminder Date *</label>
          <input type="date" value={draft.reminderDate} onChange={e => setDraft({ ...draft, reminderDate: e.target.value })}
            style={{ padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--bg-input)', color: 'var(--fg)' }} />
        </div>
        {editId && (
          <button onClick={() => { setEditId(null); setDraft({ customerName: '', phone: '', vehicleNumber: '', serviceType: 'Alignment', reminderDate: '' }) }}
            style={{ padding: '6px 16px', background: 'var(--bg-card)', color: 'var(--fg)', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}>
            Cancel
          </button>
        )}
        <button onClick={handleSave}
          style={{ padding: '6px 20px', background: editId ? 'var(--accent)' : 'var(--success)', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}>
          {editId ? 'Update' : '+ Add'}
        </button>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '0 20px' }}>
        <table>
          <thead>
            <tr>
              <th style={{ width: 40 }}>#</th>
              <th>Customer</th>
              <th style={{ width: 100 }}>Phone</th>
              <th style={{ width: 100 }}>Vehicle</th>
              <th style={{ width: 120 }}>Service Type</th>
              <th style={{ width: 120 }}>Reminder Date</th>
              <th style={{ width: 90 }}>Status</th>
              <th style={{ width: 100 }}></th>
            </tr>
          </thead>
          <tbody>
            {reminders.map((r, i) => (
              <tr key={r.id} style={{ background: editId === r.id ? 'rgba(var(--accent-rgb, 59,130,246),0.08)' : undefined }}>
                <td>{i + 1}</td>
                <td style={{ fontWeight: 500 }}>{r.customerName}</td>
                <td>{r.phone || '-'}</td>
                <td>{r.vehicleNumber || '-'}</td>
                <td>{r.serviceType}</td>
                <td>{r.reminderDate}</td>
                <td><span style={{ fontSize: '0.78rem', fontWeight: 600 }}>{r.status}</span></td>
                <td>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={() => handleEdit(r)}
                      style={{ padding: '2px 8px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.75rem' }}>
                      Edit
                    </button>
                    <button onClick={() => handleDelete(r.id)}
                      style={{ padding: '2px 8px', background: 'var(--error)', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.75rem' }}>
                      Del
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {reminders.length === 0 && (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--fg-muted)' }}>No reminders added</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
