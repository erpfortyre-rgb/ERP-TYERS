import { useEffect, useState, useCallback } from 'react'
import toast from 'react-hot-toast'
import { ListCheques, SaveCheque, UpdateChequeStatus } from '../../wailsjs/go/main/App'

interface Cheque {
  id: string; chequeNumber: string; chequeDate: string; bankName: string
  partyType: string; partyId: string; partyName: string; direction: string
  amountPaise: number; status: string; referenceType: string; referenceId: string
  clearedDate: string; notes: string
}

const today = () => new Date().toISOString().slice(0, 10)
const fmt = (p: number) => p === 0 ? '0' : (p / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })

export default function ChequeStatusPage() {
  const [cheques, setCheques] = useState<Cheque[]>([])
  const [filter, setFilter] = useState('')
  const [draft, setDraft] = useState({
    chequeNumber: '', bankName: '', partyName: '', amountPaise: 0, chequeDate: today(),
    direction: 'IN' as string, partyType: 'CUSTOMER' as string, notes: ''
  })

  const load = useCallback(async () => {
    try {
      const list = await ListCheques(filter)
      setCheques(list || [])
    } catch (e: any) { toast.error(e?.message || 'Failed to load cheques'); console.error(e) }
  }, [filter])

  useEffect(() => { load() }, [load])

  const handleAdd = async () => {
    if (!draft.chequeNumber || draft.amountPaise <= 0) return
    try {
      await SaveCheque({
        id: '', chequeNumber: draft.chequeNumber, bankName: draft.bankName,
        partyType: draft.partyType, partyName: draft.partyName, direction: draft.direction,
        amountPaise: draft.amountPaise, chequeDate: draft.chequeDate, status: 'PENDING', notes: draft.notes,
      } as any)
      toast.success('Cheque added')
      setDraft({ chequeNumber: '', bankName: '', partyName: '', amountPaise: 0, chequeDate: today(), direction: 'IN', partyType: 'CUSTOMER', notes: '' })
      load()
    } catch (e: any) { toast.error(e?.message || 'Failed to add cheque'); console.error(e) }
  }

  const updateStatus = async (id: string, status: string) => {
    try { await UpdateChequeStatus(id, status, new Date().toISOString().slice(0, 10)); toast.success(`Status updated to ${status}`); load() } catch (e: any) { toast.error(e?.message || 'Failed to update status'); console.error(e) }
  }

  const statusColors: Record<string, string> = {
    PENDING: '#f59e0b',
    CLEARED: 'var(--success)',
    RETURNED: 'var(--error)',
    CANCELLED: '#6b7280',
  }

  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column', gap: 0, padding: 0 }}>
      <div style={{ background: 'var(--accent)', color: '#fff', padding: '10px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 600, fontSize: '1rem' }}>Cheque Status</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <select value={filter} onChange={e => setFilter(e.target.value)}
            style={{ padding: '4px 10px', borderRadius: 4, border: 'none' }}>
            <option value="">All Status</option>
            <option value="PENDING">Pending</option>
            <option value="CLEARED">Cleared</option>
            <option value="RETURNED">Returned</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '12px 20px' }}>
        <table>
          <thead>
            <tr>
              <th style={{ width: 50 }}>#</th>
              <th style={{ width: 100 }}>Cheque No</th>
              <th style={{ width: 60 }}>Dir</th>
              <th>Bank Name</th>
              <th style={{ width: 90 }}>Party Type</th>
              <th>Party Name</th>
              <th style={{ width: 110 }}>Date</th>
              <th style={{ textAlign: 'right', width: 130 }}>Amount</th>
              <th style={{ width: 100 }}>Status</th>
              <th style={{ width: 200 }}>Update Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ color: 'var(--fg-muted)' }}>#</td>
              <td>
                <input value={draft.chequeNumber} inputMode="numeric" maxLength={6} onChange={e => setDraft({ ...draft, chequeNumber: e.target.value.replace(/\D/g, '') })}
                  placeholder="Cheque No" style={{ width: '100%', padding: '4px 6px', border: '1px solid var(--border)', borderRadius: 4 }} />
              </td>
              <td>
                <select value={draft.direction} onChange={e => setDraft({ ...draft, direction: e.target.value })}
                  style={{ width: '100%', padding: '4px 6px', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--bg-input)', color: 'var(--fg)' }}>
                  <option value="IN">IN</option>
                  <option value="OUT">OUT</option>
                </select>
              </td>
              <td>
                <input value={draft.bankName} onChange={e => setDraft({ ...draft, bankName: e.target.value })}
                  placeholder="Bank" style={{ width: '100%', padding: '4px 6px', border: '1px solid var(--border)', borderRadius: 4 }} />
              </td>
              <td>
                <select value={draft.partyType} onChange={e => setDraft({ ...draft, partyType: e.target.value })}
                  style={{ width: '100%', padding: '4px 6px', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--bg-input)', color: 'var(--fg)' }}>
                  <option value="CUSTOMER">Customer</option>
                  <option value="COMPANY">Company</option>
                </select>
              </td>
              <td>
                <input value={draft.partyName} onChange={e => setDraft({ ...draft, partyName: e.target.value })}
                  placeholder="Party Name" style={{ width: '100%', padding: '4px 6px', border: '1px solid var(--border)', borderRadius: 4 }} />
              </td>
              <td>
                <input type="date" value={draft.chequeDate} onChange={e => setDraft({ ...draft, chequeDate: e.target.value })}
                  style={{ width: '100%', padding: '4px 6px', border: '1px solid var(--border)', borderRadius: 4 }} />
              </td>
              <td>
                <input type="number" value={draft.amountPaise ? draft.amountPaise / 100 : ''} placeholder="0"
                  onChange={e => setDraft({ ...draft, amountPaise: Math.round(parseFloat(e.target.value || '0') * 100) })}
                  style={{ width: '100%', padding: '4px 6px', textAlign: 'right', border: '1px solid var(--border)', borderRadius: 4 }} />
              </td>
              <td></td>
              <td>
                <button onClick={handleAdd}
                  style={{ padding: '4px 16px', background: 'var(--success)', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}>
                  + Add
                </button>
              </td>
            </tr>

            {cheques.map((cheque, i) => (
              <tr key={cheque.id}>
                <td>{i + 1}</td>
                <td style={{ fontWeight: 500 }}>{cheque.chequeNumber}</td>
                <td><span style={{ fontSize: '0.75rem', fontWeight: 600, color: cheque.direction === 'IN' ? 'var(--success)' : 'var(--error)' }}>{cheque.direction || '—'}</span></td>
                <td>{cheque.bankName}</td>
                <td style={{ fontSize: '0.78rem' }}>{cheque.partyType || '—'}</td>
                <td>{cheque.partyName}</td>
                <td>{cheque.chequeDate}</td>
                <td style={{ textAlign: 'right', fontWeight: 500 }}>{fmt(cheque.amountPaise)}</td>
                <td>
                  <span style={{
                    padding: '2px 10px', borderRadius: 12, fontSize: '0.78rem', fontWeight: 600,
                    background: statusColors[cheque.status] || '#ccc', color: '#fff'
                  }}>
                    {cheque.status}
                  </span>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {['CLEARED', 'RETURNED', 'CANCELLED'].filter(s => s !== cheque.status).map(s => (
                      <button key={s} onClick={() => updateStatus(cheque.id, s)}
                        style={{
                          padding: '2px 8px', fontSize: '0.72rem', fontWeight: 600, borderRadius: 4, cursor: 'pointer',
                          background: statusColors[s], color: '#fff', border: 'none'
                        }}>
                        {s}
                      </button>
                    ))}
                  </div>
                </td>
              </tr>
            ))}

            {cheques.length === 0 && (
              <tr><td colSpan={10} style={{ textAlign: 'center', padding: 40, color: 'var(--fg-muted)' }}>No cheques recorded</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
