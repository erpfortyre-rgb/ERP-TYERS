import { useEffect, useState, useCallback } from 'react'
import toast from 'react-hot-toast'
import { FiRotateCcw, FiTrash2, FiRefreshCw } from 'react-icons/fi'
import { ListRecycleBin, RestoreEntry, PurgeEntry } from '../../wailsjs/go/main/App'
import { confirmAsk } from '../components/ConfirmDialog'

interface RecycleEntry {
  id: string; kind: string; category: string; narration: string
  amountPaise: number; entryDate: string; deletedBy: string; deletedByEmail: string; deletedAt: string
}

const fmt = (p: number) => '₹' + (p / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })
const fmtDateTime = (s: string) => s ? s.slice(0, 16).replace('T', ' ') : '—'

const GREEN = '#16a34a'
const RED = '#ef4444'

// Only an Owner/Admin may permanently delete (purge) entries. Everyone can
// restore. Role comes from the logged-in user saved in localStorage.
function currentRole(): string {
  try {
    const u = JSON.parse(localStorage.getItem('sst_user') || '{}')
    return (u.roleName || '').toLowerCase()
  } catch { return '' }
}

export default function RecycleBin() {
  const [rows, setRows] = useState<RecycleEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [pendingPurge, setPendingPurge] = useState<RecycleEntry | null>(null)
  const isAdmin = currentRole() === 'owner'

  const load = useCallback(async () => {
    try { setRows((await ListRecycleBin()) || []) }
    catch (e: any) { toast.error(e?.message || 'Failed to load') }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  const handleRestore = async (r: RecycleEntry) => {
    const ok = await confirmAsk({ title: 'Restore this entry?', message: `"${r.category}" — ${fmt(r.amountPaise)} will be moved back to the ${r.kind} ledger.`, confirmText: 'Restore', danger: false })
    if (!ok) return
    try { await RestoreEntry(r.kind, r.id); toast.success('Restored'); window.dispatchEvent(new Event('recyclebin:changed')); load() }
    catch (e: any) { toast.error(e?.message || 'Restore failed') }
  }

  const confirmPurge = async () => {
    if (!pendingPurge) return
    try { await PurgeEntry(pendingPurge.kind, pendingPurge.id, currentRole()); toast.success('Permanently deleted'); setPendingPurge(null); window.dispatchEvent(new Event('recyclebin:changed')); load() }
    catch (e: any) { toast.error(e?.message || 'Delete failed'); setPendingPurge(null) }
  }

  const th: React.CSSProperties = { padding: '8px 12px', textAlign: 'left', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '2px solid var(--border)' }

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--fg-bright)', marginBottom: 2 }}>
            Recycle Bin
            <span style={{ fontSize: '0.8rem', fontWeight: 400, color: 'var(--fg-muted)', marginLeft: 8 }}>({rows.length} deleted)</span>
          </h2>
          <div style={{ fontSize: '0.78rem', color: 'var(--fg-muted)' }}>
            Deleted invoices, expense &amp; income entries — restore{isAdmin ? ' or remove permanently' : ''}.
            {!isAdmin && <span style={{ marginLeft: 6, color: 'var(--fg-muted)' }}>(Only Admin can permanently delete.)</span>}
          </div>
        </div>
        <button onClick={load} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', background: 'var(--bg-card)', color: 'var(--fg)', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}>
          <FiRefreshCw size={13} /> Refresh
        </button>
      </div>

      <div style={{ overflow: 'auto', flex: 1 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
          <thead>
            <tr style={{ background: 'var(--bg-sidebar)' }}>
              <th style={{ ...th, width: 150 }}>Deleted On</th>
              <th style={{ ...th, width: 90 }}>Type</th>
              <th style={th}>Category</th>
              <th style={th}>Narration</th>
              <th style={{ ...th, textAlign: 'right', width: 120 }}>Amount</th>
              <th style={{ ...th, width: 120 }}>Entry Date</th>
              <th style={{ ...th, width: 200 }}>Deleted By</th>
              <th style={{ ...th, textAlign: 'center', width: 180 }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.kind + r.id} style={{ borderBottom: '1px solid var(--border)' }}
                onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = 'var(--bg-card)'}
                onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'}>
                <td style={{ padding: '10px 12px', fontVariantNumeric: 'tabular-nums', fontSize: '0.8rem' }}>{fmtDateTime(r.deletedAt)}</td>
                <td style={{ padding: '10px 12px' }}>
                  <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 10, fontSize: '0.72rem', fontWeight: 600, textTransform: 'capitalize', background: (r.kind === 'income' ? GREEN : RED) + '18', color: r.kind === 'income' ? GREEN : RED }}>{r.kind}</span>
                </td>
                <td style={{ padding: '10px 12px', fontWeight: 600 }}>{r.category || '—'}</td>
                <td style={{ padding: '10px 12px', color: r.narration ? 'var(--fg)' : 'var(--fg-muted)' }}>{r.narration || '—'}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmt(r.amountPaise)}</td>
                <td style={{ padding: '10px 12px', fontVariantNumeric: 'tabular-nums', fontSize: '0.8rem', color: 'var(--fg-muted)' }}>{r.entryDate}</td>
                <td style={{ padding: '10px 12px', fontSize: '0.8rem' }}>
                  {r.deletedBy || 'Unknown'}
                  {r.deletedByEmail && <div style={{ fontSize: '0.72rem', color: 'var(--fg-muted)' }}>{r.deletedByEmail}</div>}
                </td>
                <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                    <button onClick={() => handleRestore(r)} title="Restore"
                      style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', border: `1px solid ${GREEN}55`, borderRadius: 5, background: GREEN + '12', cursor: 'pointer', color: GREEN, fontSize: '0.76rem', fontWeight: 600 }}>
                      <FiRotateCcw size={12} /> Restore
                    </button>
                    {isAdmin && (
                      <button onClick={() => setPendingPurge(r)} title="Delete permanently (Admin only)"
                        style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', border: `1px solid ${RED}44`, borderRadius: 5, background: RED + '10', cursor: 'pointer', color: RED, fontSize: '0.76rem', fontWeight: 600 }}>
                        <FiTrash2 size={12} /> Delete
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: 48, color: 'var(--fg-muted)' }}>
                Recycle Bin is empty. Deleted entries will appear here.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {pendingPurge && (
        <div onClick={() => setPendingPurge(null)}
          onKeyDown={e => { if (e.key === 'Escape') setPendingPurge(null); if (e.key === 'Enter') confirmPurge() }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '22px 24px', width: 400, maxWidth: '90vw', boxShadow: '0 12px 40px rgba(0,0,0,0.35)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: RED + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <FiTrash2 size={18} color={RED} />
              </div>
              <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--fg-bright)' }}>Delete permanently?</div>
            </div>
            <div style={{ fontSize: '0.88rem', color: 'var(--fg)', marginBottom: 4 }}>
              <strong>{pendingPurge.category}</strong> — {fmt(pendingPurge.amountPaise)}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--fg-muted)', marginBottom: 18 }}>
              This cannot be undone. The entry will be removed forever.
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setPendingPurge(null)}
                style={{ padding: '8px 16px', background: 'var(--bg-input)', color: 'var(--fg)', border: '1px solid var(--border)', borderRadius: 7, cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>Cancel</button>
              <button onClick={confirmPurge} autoFocus
                style={{ padding: '8px 18px', background: RED, color: '#fff', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: '0.85rem', fontWeight: 700 }}>Delete Forever</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
