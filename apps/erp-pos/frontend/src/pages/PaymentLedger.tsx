import { useEffect, useState, useCallback, useMemo } from 'react'
import toast from 'react-hot-toast'
import { FiDownload, FiPlus, FiX, FiEdit2, FiTrash2, FiFilter } from 'react-icons/fi'
import { ListPaymentEntries, SavePaymentEntry, DeletePaymentEntry, ListPaymentTypes, SearchCustomers, SaveCSVFile } from '../../wailsjs/go/main/App'

interface PaymentEntry {
  id: string; paymentTypeId: string; partyType: string; partyId: string; amountPaise: number
  paymentMethod: string; referenceNumber: string; narration: string; entryDate: string
}
interface PaymentType { id: string; name: string; isActive?: boolean }
interface Customer { id: string; name: string }

const today = () => new Date().toISOString().slice(0, 10)
const firstOfMonth = () => { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10) }
const fmt = (p: number) => (p / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })

const PAY_METHODS = [
  { value: 'CASH', label: 'Cash', color: '#16a34a' },
  { value: 'UPI', label: 'UPI', color: '#7c3aed' },
  { value: 'CARD', label: 'Card', color: '#2563eb' },
  { value: 'CHEQUE', label: 'Cheque', color: '#d97706' },
  { value: 'BANK_TRANSFER', label: 'Bank Transfer', color: '#0891b2' },
]

const methodLabel = (v: string) => PAY_METHODS.find(m => m.value === v)?.label || v
const methodColor = (v: string) => PAY_METHODS.find(m => m.value === v)?.color || '#888'

function PayBadge({ method }: { method: string }) {
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 10,
      fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.03em',
      background: methodColor(method) + '20', color: methodColor(method), border: `1px solid ${methodColor(method)}44`
    }}>{methodLabel(method)}</span>
  )
}

const EMPTY_DRAFT = { entryDate: today(), paymentTypeId: '', partyType: 'CUSTOMER', partyId: '', narration: '', amountPaise: 0, paymentMethod: 'CASH', referenceNumber: '' }

export default function PaymentLedger() {
  const [entries, setEntries] = useState<PaymentEntry[]>([])
  const [types, setTypes] = useState<PaymentType[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [filterType, setFilterType] = useState('')
  const [from, setFrom] = useState(firstOfMonth())
  const [to, setTo] = useState(today())
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [draft, setDraft] = useState({ ...EMPTY_DRAFT })

  const load = useCallback(async () => {
    try {
      const [list, t, c] = await Promise.all([ListPaymentEntries(from, to), ListPaymentTypes(), SearchCustomers('')])
      setEntries(list || [])
      setTypes(t || [])
      setCustomers(c || [])
    } catch (e: any) { toast.error(e?.message || 'Failed to load') }
  }, [from, to])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() =>
    filterType ? entries.filter(e => e.paymentTypeId === filterType) : entries,
    [entries, filterType]
  )

  const typeName = (id: string) => types.find(t => t.id === id)?.name || '—'
  const customerName = (id: string) => customers.find(c => c.id === id)?.name || '—'

  // Summary stats
  const totalPaise = filtered.reduce((s, e) => s + e.amountPaise, 0)
  const cashPaise = filtered.filter(e => e.paymentMethod === 'CASH').reduce((s, e) => s + e.amountPaise, 0)
  const upiPaise = filtered.filter(e => e.paymentMethod === 'UPI').reduce((s, e) => s + e.amountPaise, 0)
  const otherPaise = filtered.filter(e => !['CASH', 'UPI'].includes(e.paymentMethod)).reduce((s, e) => s + e.amountPaise, 0)

  const openAdd = () => {
    setEditId(null)
    setDraft({ ...EMPTY_DRAFT, paymentTypeId: filterType || '' })
    setShowForm(true)
  }

  const openEdit = (entry: PaymentEntry) => {
    setEditId(entry.id)
    setDraft({
      entryDate: entry.entryDate, paymentTypeId: entry.paymentTypeId, partyType: entry.partyType,
      partyId: entry.partyId, narration: entry.narration, amountPaise: entry.amountPaise,
      paymentMethod: entry.paymentMethod, referenceNumber: entry.referenceNumber,
    })
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!draft.amountPaise) { toast.error('Enter amount'); return }
    try {
      await SavePaymentEntry({
        id: editId || '', paymentTypeId: draft.paymentTypeId, partyType: draft.partyType,
        partyId: draft.partyId, amountPaise: draft.amountPaise, paymentMethod: draft.paymentMethod,
        referenceNumber: draft.referenceNumber, narration: draft.narration, entryDate: draft.entryDate,
      } as any)
      toast.success(editId ? 'Payment updated' : 'Payment saved')
      setShowForm(false)
      setEditId(null)
      setDraft({ ...EMPTY_DRAFT })
      load()
    } catch (e: any) { toast.error(e?.message || 'Save failed') }
  }

  const handleDelete = async (id: string, label: string) => {
    if (!confirm(`Delete payment "${label}"?`)) return
    try { await DeletePaymentEntry(id); toast.success('Deleted'); load() } catch (e: any) { toast.error(e?.message || 'Delete failed') }
  }

  const exportCSV = async () => {
    const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`
    const headers = ['#', 'Date', 'Payment Type', 'Party', 'Narration', 'Amount (₹)', 'Pay Method', 'Reference']
    const rows = filtered.map((e, i) => [
      String(i + 1), e.entryDate, typeName(e.paymentTypeId), customerName(e.partyId),
      e.narration, (e.amountPaise / 100).toFixed(2), methodLabel(e.paymentMethod), e.referenceNumber || '',
    ])
    const csv = [headers, ...rows].map(r => r.map(esc).join(',')).join('\n')
    try {
      const path = await SaveCSVFile(csv, 'Payments_Export.csv')
      if (path) toast.success(`Saved: ${path}`)
    } catch (e: any) { toast.error(e?.message || 'Export failed') }
  }

  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column', gap: 0, padding: 0, height: '100%' }}>

      {/* Header */}
      <div style={{ background: 'var(--accent)', color: '#fff', padding: '10px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <span style={{ fontWeight: 700, fontSize: '1rem' }}>Payment Ledger</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={exportCSV} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 6, cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}>
            <FiDownload size={13} /> Export CSV
          </button>
          <button onClick={openAdd} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', background: '#fff', color: 'var(--accent)', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700 }}>
            <FiPlus size={13} /> Add Payment
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ padding: '10px 20px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', flexShrink: 0 }}>
        <FiFilter size={14} style={{ color: 'var(--fg-muted)' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <label style={{ fontSize: '0.8rem', color: 'var(--fg-muted)', fontWeight: 600 }}>From</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={{ padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 5, fontSize: '0.82rem', background: 'var(--bg-input)', color: 'var(--fg)' }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <label style={{ fontSize: '0.8rem', color: 'var(--fg-muted)', fontWeight: 600 }}>To</label>
          <input type="date" value={to} onChange={e => setTo(e.target.value)} style={{ padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 5, fontSize: '0.82rem', background: 'var(--bg-input)', color: 'var(--fg)' }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <label style={{ fontSize: '0.8rem', color: 'var(--fg-muted)', fontWeight: 600 }}>Type</label>
          <select value={filterType} onChange={e => setFilterType(e.target.value)}
            style={{ padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 5, fontSize: '0.82rem', background: 'var(--bg-input)', color: 'var(--fg)', minWidth: 160 }}>
            <option value="">All Types</option>
            {types.filter(t => t.isActive !== false).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'flex', gap: 12, padding: '12px 20px', flexShrink: 0, flexWrap: 'wrap' }}>
        {[
          { label: 'Total Received', value: fmt(totalPaise), color: 'var(--accent)', big: true },
          { label: 'Cash', value: fmt(cashPaise), color: '#16a34a' },
          { label: 'UPI', value: fmt(upiPaise), color: '#7c3aed' },
          { label: 'Other', value: fmt(otherPaise), color: '#0891b2' },
        ].map(card => (
          <div key={card.label} style={{ flex: card.big ? '1 1 160px' : '1 1 120px', background: 'var(--bg-card)', border: `1px solid ${card.color}33`, borderRadius: 8, padding: '10px 14px' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--fg-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{card.label}</div>
            <div style={{ fontSize: card.big ? '1.1rem' : '0.95rem', fontWeight: 700, color: card.color, marginTop: 2 }}>₹{card.value}</div>
          </div>
        ))}
      </div>

      {/* Add / Edit form */}
      {showForm && (
        <div style={{ margin: '0 20px 12px', background: 'var(--bg-card)', border: '1px solid var(--accent)44', borderRadius: 8, padding: '14px 16px', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--accent)' }}>{editId ? 'Edit Payment' : 'Add New Payment'}</span>
            <button onClick={() => { setShowForm(false); setEditId(null); setDraft({ ...EMPTY_DRAFT }) }} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--fg-muted)' }}><FiX /></button>
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '0 0 130px' }}>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--fg-muted)' }}>Date *</label>
              <input type="date" value={draft.entryDate} onChange={e => setDraft({ ...draft, entryDate: e.target.value })}
                style={{ padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 5, background: 'var(--bg-input)', color: 'var(--fg)', fontSize: '0.85rem' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 160px' }}>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--fg-muted)' }}>Payment Type</label>
              <select value={draft.paymentTypeId} onChange={e => setDraft({ ...draft, paymentTypeId: e.target.value })}
                style={{ padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 5, background: 'var(--bg-input)', color: 'var(--fg)', fontSize: '0.85rem' }}>
                <option value="">Select Type</option>
                {types.filter(t => t.isActive !== false).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 180px' }}>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--fg-muted)' }}>Customer / Party</label>
              <select value={draft.partyId} onChange={e => setDraft({ ...draft, partyId: e.target.value })}
                style={{ padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 5, background: 'var(--bg-input)', color: 'var(--fg)', fontSize: '0.85rem' }}>
                <option value="">Select Customer</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '2 1 200px' }}>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--fg-muted)' }}>Narration</label>
              <input placeholder="Payment details / note" value={draft.narration} onChange={e => setDraft({ ...draft, narration: e.target.value })}
                style={{ padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 5, background: 'var(--bg-input)', color: 'var(--fg)', fontSize: '0.85rem' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '0 0 120px' }}>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--fg-muted)' }}>Amount (₹) *</label>
              <input type="number" min="0" step="0.01" placeholder="0.00"
                value={draft.amountPaise ? draft.amountPaise / 100 : ''}
                onChange={e => setDraft({ ...draft, amountPaise: Math.round(parseFloat(e.target.value || '0') * 100) })}
                style={{ padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 5, background: 'var(--bg-input)', color: 'var(--fg)', fontSize: '0.85rem', textAlign: 'right' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '0 0 140px' }}>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--fg-muted)' }}>Pay Method</label>
              <select value={draft.paymentMethod} onChange={e => setDraft({ ...draft, paymentMethod: e.target.value })}
                style={{ padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 5, background: 'var(--bg-input)', color: 'var(--fg)', fontSize: '0.85rem' }}>
                {PAY_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '0 0 130px' }}>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--fg-muted)' }}>Reference #</label>
              <input placeholder="Ref / Cheque no." value={draft.referenceNumber} onChange={e => setDraft({ ...draft, referenceNumber: e.target.value })}
                style={{ padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 5, background: 'var(--bg-input)', color: 'var(--fg)', fontSize: '0.85rem' }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button onClick={handleSave} style={{ padding: '7px 20px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem' }}>
              {editId ? 'Update' : 'Save Payment'}
            </button>
            <button onClick={() => { setShowForm(false); setEditId(null); setDraft({ ...EMPTY_DRAFT }) }}
              style={{ padding: '7px 14px', background: 'var(--bg-input)', color: 'var(--fg)', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', fontSize: '0.85rem' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div style={{ flex: 1, overflow: 'auto', padding: '0 20px 16px' }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--fg-muted)', fontSize: '0.9rem' }}>
            No payment entries found for this period.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: 'var(--bg-sidebar)', position: 'sticky', top: 0, zIndex: 1 }}>
                {['#', 'Date', 'Type', 'Party', 'Narration', 'Amount (₹)', 'Pay Method', 'Reference', 'Action'].map((h, idx) => (
                  <th key={h} style={{
                    padding: '8px 10px', textAlign: idx === 5 ? 'right' : idx === 6 || idx === 8 ? 'center' : 'left',
                    fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em',
                    borderBottom: '2px solid var(--border)',
                    width: [36, 100, 130, 150, undefined, 120, 120, 100, 70][idx]
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((entry, i) => (
                <tr key={entry.id} style={{ borderBottom: '1px solid var(--border)', background: editId === entry.id ? 'var(--bg-sidebar)' : 'transparent' }}
                  onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = 'var(--bg-card)'}
                  onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = editId === entry.id ? 'var(--bg-sidebar)' : 'transparent'}>
                  <td style={{ padding: '8px 10px', color: 'var(--fg-muted)', fontSize: '0.78rem' }}>{i + 1}</td>
                  <td style={{ padding: '8px 10px', fontVariantNumeric: 'tabular-nums', fontSize: '0.82rem' }}>{entry.entryDate}</td>
                  <td style={{ padding: '8px 10px' }}>
                    {entry.paymentTypeId ? (
                      <span style={{ display: 'inline-block', padding: '2px 8px', background: 'var(--accent)15', color: 'var(--accent)', borderRadius: 6, fontSize: '0.78rem', fontWeight: 600 }}>
                        {typeName(entry.paymentTypeId)}
                      </span>
                    ) : <span style={{ color: 'var(--fg-muted)' }}>—</span>}
                  </td>
                  <td style={{ padding: '8px 10px', fontSize: '0.82rem' }}>{entry.partyId ? customerName(entry.partyId) : '—'}</td>
                  <td style={{ padding: '8px 10px', color: entry.narration ? 'var(--fg)' : 'var(--fg-muted)' }}>{entry.narration || '—'}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmt(entry.amountPaise)}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'center' }}><PayBadge method={entry.paymentMethod || 'CASH'} /></td>
                  <td style={{ padding: '8px 10px', color: entry.referenceNumber ? 'var(--fg)' : 'var(--fg-muted)', fontSize: '0.82rem' }}>{entry.referenceNumber || '—'}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                      <button title="Edit" onClick={() => openEdit(entry)}
                        style={{ padding: '3px 6px', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--bg-input)', cursor: 'pointer', color: 'var(--fg)', display: 'flex', alignItems: 'center' }}>
                        <FiEdit2 size={12} />
                      </button>
                      <button title="Delete" onClick={() => handleDelete(entry.id, `${typeName(entry.paymentTypeId)} ₹${fmt(entry.amountPaise)}`)}
                        style={{ padding: '3px 6px', border: '1px solid #fca5a544', borderRadius: 4, background: '#fca5a510', cursor: 'pointer', color: '#ef4444', display: 'flex', alignItems: 'center' }}>
                        <FiTrash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: 'var(--bg-sidebar)', fontWeight: 700, borderTop: '2px solid var(--border)' }}>
                <td colSpan={5} style={{ padding: '9px 10px', textAlign: 'right', fontSize: '0.85rem', color: 'var(--fg-muted)' }}>
                  Total ({filtered.length} entries) :
                </td>
                <td style={{ padding: '9px 10px', textAlign: 'right', color: 'var(--accent)', fontSize: '0.95rem' }}>₹{fmt(totalPaise)}</td>
                <td colSpan={3}></td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  )
}
