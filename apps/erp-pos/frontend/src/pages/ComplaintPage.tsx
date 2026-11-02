import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { ListComplaints, SaveComplaint, DeleteComplaint } from '../../wailsjs/go/main/App'

interface Complaint {
  id: string; customerName: string; phone: string; vehicleNumber: string
  complaintType: string; description: string; status: string; createdAt: string
}

const today = () => new Date().toISOString().slice(0, 10)

export default function ComplaintPage() {
  const [complaints, setComplaints] = useState<Complaint[]>([])
  const [draft, setDraft] = useState({
    customerName: '', phone: '', vehicleNumber: '',
    complaintType: 'Tyre Defect', description: '', status: 'OPEN'
  })
  const [editId, setEditId] = useState<string | null>(null)

  useEffect(() => { loadComplaints() }, [])

  const loadComplaints = async () => {
    try {
      const data = await ListComplaints('') as any
      setComplaints(data || [])
    } catch (e: any) { toast.error(e?.message || 'Failed to load complaints'); console.error(e) }
  }

  const handleSave = async () => {
    if (!draft.customerName || !draft.description) return
    try {
      await SaveComplaint({ ...draft, id: editId || '', createdAt: today() } as any)
      toast.success(editId ? 'Complaint updated' : 'Complaint saved')
      setDraft({ customerName: '', phone: '', vehicleNumber: '', complaintType: 'Tyre Defect', description: '', status: 'OPEN' })
      setEditId(null)
      loadComplaints()
    } catch (e: any) { toast.error(e?.message || 'Failed to save'); console.error(e) }
  }

  const handleEdit = (c: Complaint) => {
    setDraft({ customerName: c.customerName, phone: c.phone, vehicleNumber: c.vehicleNumber, complaintType: c.complaintType, description: c.description, status: c.status })
    setEditId(c.id)
    window.scrollTo(0, 0)
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this complaint? This cannot be undone.')) return
    try {
      await DeleteComplaint(id)
      toast.success('Complaint deleted')
      loadComplaints()
    } catch (e: any) { toast.error(e?.message || 'Failed to delete'); console.error(e) }
  }

  const statusColors: Record<string, string> = {
    OPEN: 'var(--warning)', IN_PROGRESS: 'var(--accent)', RESOLVED: 'var(--success)', CLOSED: '#6b7280'
  }

  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column', gap: 0, padding: 0 }}>
      <div style={{ background: 'var(--accent)', color: '#fff', padding: '10px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 600, fontSize: '1rem' }}>Complaints</span>
        <span style={{ fontSize: '0.85rem' }}>{complaints.length} complaint(s)</span>
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
          <label style={{ fontSize: '0.75rem', color: 'var(--fg-muted)' }}>Complaint Type</label>
          <select value={draft.complaintType} onChange={e => setDraft({ ...draft, complaintType: e.target.value })}
            style={{ padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--bg-input)', color: 'var(--fg)' }}>
            <option>Tyre Defect</option>
            <option>Alignment Issue</option>
            <option>Warranty Claim</option>
            <option>Other</option>
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <label style={{ fontSize: '0.75rem', color: 'var(--fg-muted)' }}>Status</label>
          <select value={draft.status} onChange={e => setDraft({ ...draft, status: e.target.value })}
            style={{ padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--bg-input)', color: 'var(--fg)' }}>
            <option value="OPEN">Open</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="RESOLVED">Resolved</option>
            <option value="CLOSED">Closed</option>
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 200 }}>
          <label style={{ fontSize: '0.75rem', color: 'var(--fg-muted)' }}>Description *</label>
          <textarea value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })}
            placeholder="Describe the complaint..." rows={1}
            style={{ padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--bg-input)', color: 'var(--fg)', resize: 'vertical' }} />
        </div>
        {editId && (
          <button onClick={() => { setEditId(null); setDraft({ customerName: '', phone: '', vehicleNumber: '', complaintType: 'Tyre Defect', description: '', status: 'OPEN' }) }}
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
              <th style={{ width: 120 }}>Type</th>
              <th>Description</th>
              <th style={{ width: 90 }}>Date</th>
              <th style={{ width: 100 }}>Status</th>
              <th style={{ width: 100 }}></th>
            </tr>
          </thead>
          <tbody>
            {complaints.map((c, i) => (
              <tr key={c.id} style={{ background: editId === c.id ? 'rgba(var(--accent-rgb, 59,130,246),0.08)' : undefined }}>
                <td>{i + 1}</td>
                <td style={{ fontWeight: 500 }}>{c.customerName}</td>
                <td>{c.phone || '-'}</td>
                <td>{c.vehicleNumber || '-'}</td>
                <td>{c.complaintType}</td>
                <td style={{ fontSize: '0.85rem' }}>{c.description}</td>
                <td>{c.createdAt}</td>
                <td>
                  <span style={{
                    padding: '2px 10px', borderRadius: 12, fontSize: '0.78rem', fontWeight: 600,
                    background: statusColors[c.status] || '#ccc', color: '#fff'
                  }}>
                    {c.status}
                  </span>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={() => handleEdit(c)}
                      style={{ padding: '2px 8px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.75rem' }}>
                      Edit
                    </button>
                    <button onClick={() => handleDelete(c.id)}
                      style={{ padding: '2px 8px', background: 'var(--error)', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.75rem' }}>
                      Del
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {complaints.length === 0 && (
              <tr><td colSpan={9} style={{ textAlign: 'center', padding: 40, color: 'var(--fg-muted)' }}>No complaints recorded</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
