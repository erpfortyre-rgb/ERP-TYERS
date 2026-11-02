import { useEffect, useState, useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { FiDownload, FiPlus, FiX, FiEdit2, FiTrash2, FiFilter, FiCalendar } from 'react-icons/fi'
import { ListIncomeEntries, SaveIncomeEntry, DeleteIncomeEntry, ListIncomeTypes, SaveCSVFile } from '../../wailsjs/go/main/App'
import DateRangePicker from '../components/DateRangePicker'

interface IncomeEntry {
  id: string; incomeId: string; quantityMillis: number; ratePaise: number; amountPaise: number; paymentMethod: string
  referenceNumber: string; narration: string; entryDate: string
}
interface IncomeType { id: string; name: string; isActive?: boolean }

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

const EMPTY_DRAFT = { entryDate: today(), incomeId: '', narration: '', quantityMillis: 0, ratePaise: 0, amountPaise: 0, paymentMethod: 'CASH', referenceNumber: '' }

export default function IncomesLedger() {
  const [searchParams] = useSearchParams()
  const [entries, setEntries] = useState<IncomeEntry[]>([])
  const [types, setTypes] = useState<IncomeType[]>([])
  const [filterType, setFilterType] = useState(searchParams.get('type') || '')
  const [from, setFrom] = useState(firstOfMonth())
  const [to, setTo] = useState(today())
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [draft, setDraft] = useState({ ...EMPTY_DRAFT })
  const [pendingDelete, setPendingDelete] = useState<IncomeEntry | null>(null)
  const [showDatePicker, setShowDatePicker] = useState(false)

  // F2 opens the date-range calendar — only when no form/modal/picker is open.
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'F2' && !showForm && !pendingDelete && !showDatePicker) {
        e.preventDefault()
        setShowDatePicker(true)
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [showForm, pendingDelete, showDatePicker])

  const load = useCallback(async () => {
    try {
      const [list, t] = await Promise.all([ListIncomeEntries(from, to), ListIncomeTypes()])
      setEntries(list || [])
      setTypes(t || [])
    } catch (e: any) { toast.error(e?.message || 'Failed to load') }
  }, [from, to])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() =>
    filterType ? entries.filter(e => e.incomeId === filterType) : entries,
    [entries, filterType]
  )

  const hasFilter = filterType !== '' || from !== firstOfMonth() || to !== today()

  const typeName = (id: string) => types.find(t => t.id === id)?.name || '—'

  const totalPaise = filtered.reduce((s, e) => s + e.amountPaise, 0)
  const cashPaise = filtered.filter(e => e.paymentMethod === 'CASH').reduce((s, e) => s + e.amountPaise, 0)
  const upiPaise = filtered.filter(e => e.paymentMethod === 'UPI').reduce((s, e) => s + e.amountPaise, 0)
  const otherPaise = filtered.filter(e => !['CASH', 'UPI'].includes(e.paymentMethod)).reduce((s, e) => s + e.amountPaise, 0)

  // Running balance (cumulative) — computed oldest→newest, keyed by entry id.
  const runningBalance = useMemo(() => {
    const map: Record<string, number> = {}
    let acc = 0
    for (let i = filtered.length - 1; i >= 0; i--) {
      acc += filtered[i].amountPaise
      map[filtered[i].id] = acc
    }
    return map
  }, [filtered])

  const categoryTotals = useMemo(() => {
    const map: Record<string, number> = {}
    filtered.forEach(e => { map[e.incomeId] = (map[e.incomeId] || 0) + e.amountPaise })
    return Object.entries(map)
      .map(([id, paise]) => ({ id, name: typeName(id), paise }))
      .sort((a, b) => b.paise - a.paise)
  }, [filtered, types])

  const openAdd = () => {
    setEditId(null)
    setDraft({ ...EMPTY_DRAFT, incomeId: filterType || '' })
    setShowForm(true)
  }
  const openEdit = (entry: IncomeEntry) => {
    setEditId(entry.id)
    setDraft({ entryDate: entry.entryDate, incomeId: entry.incomeId, narration: entry.narration, quantityMillis: entry.quantityMillis || 0, ratePaise: entry.ratePaise || 0, amountPaise: entry.amountPaise, paymentMethod: entry.paymentMethod, referenceNumber: entry.referenceNumber })
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!draft.incomeId) { toast.error('Select income category'); return }
    if (!draft.amountPaise || draft.amountPaise <= 0) { toast.error('Enter a valid amount'); return }
    try {
      await SaveIncomeEntry({ id: editId || '', incomeId: draft.incomeId, quantityMillis: draft.quantityMillis, ratePaise: draft.ratePaise, amountPaise: draft.amountPaise, paymentMethod: draft.paymentMethod, referenceNumber: draft.referenceNumber, narration: draft.narration, entryDate: draft.entryDate } as any)
      toast.success(editId ? 'Income updated' : 'Income saved')
      setShowForm(false); setEditId(null); setDraft({ ...EMPTY_DRAFT }); load()
    } catch (e: any) { toast.error(e?.message || 'Save failed') }
  }

  const confirmDelete = async () => {
    if (!pendingDelete) return
    const u = (() => { try { return JSON.parse(localStorage.getItem('sst_user') || '{}') } catch { return {} as any } })()
    try { await DeleteIncomeEntry(pendingDelete.id, u.name || '', u.email || ''); toast.success('Moved to Recycle Bin'); setPendingDelete(null); window.dispatchEvent(new Event('recyclebin:changed')); load() }
    catch (e: any) { toast.error(e?.message || 'Delete failed'); setPendingDelete(null) }
  }

  const exportCSV = async () => {
    const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`
    const headers = ['#', 'Date', 'Category', 'Narration', 'Qty', 'Rate (₹)', 'Amount (₹)', 'Balance (₹)', 'Pay Method', 'Reference']
    const rows = filtered.map((e, i) => [String(i + 1), e.entryDate, typeName(e.incomeId), e.narration, e.quantityMillis ? String(e.quantityMillis / 1000) : '', e.ratePaise ? (e.ratePaise / 100).toFixed(2) : '', (e.amountPaise / 100).toFixed(2), ((runningBalance[e.id] || 0) / 100).toFixed(2), methodLabel(e.paymentMethod), e.referenceNumber || ''])
    const csv = [headers, ...rows].map(r => r.map(esc).join(',')).join('\n')
    try {
      const path = await SaveCSVFile(csv, 'Income_Export.csv')
      if (path) toast.success(`Saved: ${path}`)
    } catch (e: any) { toast.error(e?.message || 'Export failed') }
  }

  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column', gap: 0, padding: 0, height: '100%' }}>

      <div style={{ background: '#16a34a', color: '#fff', padding: '10px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <span style={{ fontWeight: 700, fontSize: '1rem' }}>Income Ledger</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={exportCSV} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 6, cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}>
            <FiDownload size={13} /> Export CSV
          </button>
          <button onClick={openAdd} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', background: '#fff', color: '#16a34a', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700 }}>
            <FiPlus size={13} /> Add Income
          </button>
        </div>
      </div>

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
          <label style={{ fontSize: '0.8rem', color: 'var(--fg-muted)', fontWeight: 600 }}>Category</label>
          <select value={filterType} onChange={e => setFilterType(e.target.value)}
            style={{ padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 5, fontSize: '0.82rem', background: 'var(--bg-input)', color: 'var(--fg)', minWidth: 160 }}>
            <option value="">All Categories</option>
            {types.filter(t => t.isActive !== false).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <button onClick={() => setShowDatePicker(true)} title="Pick date range (F2) — quick: today, month, quarter, FY"
          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 5, fontSize: '0.8rem', fontWeight: 600, background: '#16a34a15', color: '#16a34a', border: '1px solid #16a34a44', cursor: 'pointer' }}>
          <FiCalendar size={13} /> Range <span style={{ fontSize: '0.68rem', opacity: 0.7, border: '1px solid currentColor', borderRadius: 3, padding: '0 3px' }}>F2</span>
        </button>
        <button onClick={() => { setFrom(firstOfMonth()); setTo(today()); setFilterType('') }}
          disabled={!hasFilter}
          title={hasFilter ? 'Reset date range to this month and show all categories' : 'No filters applied'}
          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 5, fontSize: '0.8rem', fontWeight: 600, transition: 'all 0.15s',
            background: hasFilter ? '#ef444418' : 'var(--bg-input)',
            color: hasFilter ? '#ef4444' : 'var(--fg-muted)',
            border: `1px solid ${hasFilter ? '#ef444455' : 'var(--border)'}`,
            cursor: hasFilter ? 'pointer' : 'default', opacity: hasFilter ? 1 : 0.6 }}>
          <FiX size={13} /> Clear Filters
        </button>
      </div>

      <div style={{ display: 'flex', gap: 12, padding: '12px 20px', flexShrink: 0, flexWrap: 'wrap' }}>
        {[
          { label: 'Total Income', value: fmt(totalPaise), color: '#16a34a', big: true },
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

      {showForm && (
        <div onKeyDown={e => {
          const el = e.target as HTMLElement
          const isPicker = el.tagName === 'SELECT' || (el as HTMLInputElement).type === 'number'
          if (e.key === 'Enter' || e.key === 'F2' || (e.key === 'ArrowDown' && !isPicker)) { e.preventDefault(); e.stopPropagation(); handleSave() }
          else if (e.key === 'Escape') { e.stopPropagation(); setShowForm(false); setEditId(null); setDraft({ ...EMPTY_DRAFT }) }
        }}
          style={{ margin: '0 20px 12px', background: 'var(--bg-card)', border: '1px solid #16a34a44', borderRadius: 8, padding: '14px 16px', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#16a34a' }}>{editId ? 'Edit Income' : 'Add New Income'}</span>
            <button onClick={() => { setShowForm(false); setEditId(null); setDraft({ ...EMPTY_DRAFT }) }} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--fg-muted)' }}><FiX /></button>
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '0 0 130px' }}>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--fg-muted)' }}>Date *</label>
              <input type="date" value={draft.entryDate} onChange={e => setDraft({ ...draft, entryDate: e.target.value })}
                style={{ padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 5, background: 'var(--bg-input)', color: 'var(--fg)', fontSize: '0.85rem' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 180px' }}>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--fg-muted)' }}>Category *</label>
              <select value={draft.incomeId} onChange={e => setDraft({ ...draft, incomeId: e.target.value })}
                style={{ padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 5, background: 'var(--bg-input)', color: 'var(--fg)', fontSize: '0.85rem' }}>
                <option value="">Select Category</option>
                {types.filter(t => t.isActive !== false).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '2 1 220px' }}>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--fg-muted)' }}>Narration</label>
              <input placeholder="Income details / note" value={draft.narration} onChange={e => setDraft({ ...draft, narration: e.target.value })}
                style={{ padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 5, background: 'var(--bg-input)', color: 'var(--fg)', fontSize: '0.85rem' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '0 0 80px' }}>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--fg-muted)' }}>Qty</label>
              <input type="number" min="0" step="any" placeholder="0"
                value={draft.quantityMillis ? draft.quantityMillis / 1000 : ''}
                onChange={e => { const q = Math.round(parseFloat(e.target.value || '0') * 1000); setDraft(d => ({ ...d, quantityMillis: q, amountPaise: q > 0 && d.ratePaise > 0 ? Math.round(q * d.ratePaise / 1000) : d.amountPaise })) }}
                style={{ padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 5, background: 'var(--bg-input)', color: 'var(--fg)', fontSize: '0.85rem', textAlign: 'right' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '0 0 100px' }}>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--fg-muted)' }}>Rate (₹)</label>
              <input type="number" min="0" step="0.01" placeholder="0.00"
                value={draft.ratePaise ? draft.ratePaise / 100 : ''}
                onChange={e => { const r = Math.round(parseFloat(e.target.value || '0') * 100); setDraft(d => ({ ...d, ratePaise: r, amountPaise: d.quantityMillis > 0 && r > 0 ? Math.round(d.quantityMillis * r / 1000) : d.amountPaise })) }}
                style={{ padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 5, background: 'var(--bg-input)', color: 'var(--fg)', fontSize: '0.85rem', textAlign: 'right' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '0 0 120px' }}>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--fg-muted)' }}>Amount (₹) *</label>
              <input type="number" min="0" step="0.01" placeholder="0.00"
                value={draft.amountPaise ? draft.amountPaise / 100 : ''}
                onChange={e => setDraft({ ...draft, amountPaise: Math.round(parseFloat(e.target.value || '0') * 100) })}
                title="Auto = Qty × Rate (editable)"
                style={{ padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 5, background: 'var(--bg-input)', color: 'var(--fg)', fontSize: '0.85rem', textAlign: 'right' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '0 0 140px' }}>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--fg-muted)' }}>Payment Method</label>
              <select value={draft.paymentMethod} onChange={e => setDraft({ ...draft, paymentMethod: e.target.value })}
                style={{ padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 5, background: 'var(--bg-input)', color: 'var(--fg)', fontSize: '0.85rem' }}>
                {PAY_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '0 0 130px' }}>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--fg-muted)' }}>Reference #</label>
              <input placeholder="Ref / Bill no." value={draft.referenceNumber} onChange={e => setDraft({ ...draft, referenceNumber: e.target.value })}
                style={{ padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 5, background: 'var(--bg-input)', color: 'var(--fg)', fontSize: '0.85rem' }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button onClick={handleSave} style={{ padding: '7px 20px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem' }}>
              {editId ? 'Update' : 'Save Income'}
            </button>
            <button onClick={() => { setShowForm(false); setEditId(null); setDraft({ ...EMPTY_DRAFT }) }}
              style={{ padding: '7px 14px', background: 'var(--bg-input)', color: 'var(--fg)', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', fontSize: '0.85rem' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <div style={{ flex: 1, overflow: 'auto', padding: '0 20px 16px', scrollbarGutter: 'stable' }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--fg-muted)', fontSize: '0.9rem' }}>No income entries found for this period.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: 'var(--bg-sidebar)', position: 'sticky', top: 0, zIndex: 1 }}>
                {['#', 'Date', 'Category', 'Narration', 'Qty', 'Amount (₹)', 'Balance (₹)', 'Pay Method', 'Reference', 'Action'].map((h, idx) => (
                  <th key={h} style={{
                    padding: '8px 10px', textAlign: idx === 4 || idx === 5 || idx === 6 ? 'right' : idx === 7 || idx === 9 ? 'center' : 'left',
                    fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em',
                    borderBottom: '2px solid var(--border)',
                    width: [36, 100, 150, undefined, 60, 120, 130, 120, 100, 70][idx]
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((entry, i) => (
                <tr key={entry.id} style={{ borderBottom: '1px solid var(--border)' }}
                  onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = 'var(--bg-card)'}
                  onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'}>
                  <td style={{ padding: '8px 10px', color: 'var(--fg-muted)', fontSize: '0.78rem' }}>{i + 1}</td>
                  <td style={{ padding: '8px 10px', fontVariantNumeric: 'tabular-nums', fontSize: '0.82rem' }}>{entry.entryDate}</td>
                  <td style={{ padding: '8px 10px' }}>
                    <span style={{ display: 'inline-block', padding: '2px 8px', background: '#16a34a15', color: '#16a34a', borderRadius: 6, fontSize: '0.78rem', fontWeight: 600 }}>
                      {typeName(entry.incomeId)}
                    </span>
                  </td>
                  <td style={{ padding: '8px 10px', color: entry.narration ? 'var(--fg)' : 'var(--fg-muted)' }}>{entry.narration || '—'}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--fg-muted)', fontSize: '0.82rem' }}>{entry.quantityMillis ? (entry.quantityMillis / 1000).toLocaleString('en-IN') : '—'}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmt(entry.amountPaise)}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--fg-muted)', fontWeight: 500 }}>{fmt(runningBalance[entry.id] || 0)}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'center' }}><PayBadge method={entry.paymentMethod || 'CASH'} /></td>
                  <td style={{ padding: '8px 10px', color: entry.referenceNumber ? 'var(--fg)' : 'var(--fg-muted)', fontSize: '0.82rem' }}>{entry.referenceNumber || '—'}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                      <button title="Edit" onClick={() => openEdit(entry)}
                        style={{ padding: '3px 6px', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--bg-input)', cursor: 'pointer', color: 'var(--fg)', display: 'flex', alignItems: 'center' }}>
                        <FiEdit2 size={12} />
                      </button>
                      <button title="Delete" onClick={() => setPendingDelete(entry)}
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
                <td colSpan={5} style={{ padding: '9px 10px', textAlign: 'right', fontSize: '0.85rem', color: 'var(--fg-muted)' }}>Total ({filtered.length} entries) :</td>
                <td style={{ padding: '9px 10px', textAlign: 'right', color: '#16a34a', fontSize: '0.95rem' }}>₹{fmt(totalPaise)}</td>
                <td></td>
                <td colSpan={3}></td>
              </tr>
            </tfoot>
          </table>
        )}

        {categoryTotals.length > 1 && (
          <div style={{ marginTop: 20, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 16px' }}>
            <div style={{ fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--fg-muted)', marginBottom: 10 }}>Category Breakdown</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {categoryTotals.map(cat => {
                const pct = totalPaise > 0 ? (cat.paise / totalPaise) * 100 : 0
                return (
                  <div key={cat.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: 500 }}>{cat.name}</span>
                      <span style={{ fontSize: '0.82rem', fontWeight: 700 }}>₹{fmt(cat.paise)} <span style={{ color: 'var(--fg-muted)', fontWeight: 400 }}>({pct.toFixed(1)}%)</span></span>
                    </div>
                    <div style={{ height: 5, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: '#16a34a', borderRadius: 3, transition: 'width 0.4s' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Date range picker (F2) */}
      {showDatePicker && (
        <DateRangePicker initialFrom={from} initialTo={to}
          onApply={(f, t) => { setFrom(f); setTo(t); setShowDatePicker(false) }}
          onClose={() => setShowDatePicker(false)} />
      )}

      {/* Delete confirmation */}
      {pendingDelete && (
        <div onClick={() => setPendingDelete(null)}
          onKeyDown={e => { if (e.key === 'Escape') setPendingDelete(null); if (e.key === 'Enter') confirmDelete() }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '22px 24px', width: 390, maxWidth: '90vw', boxShadow: '0 12px 40px rgba(0,0,0,0.35)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#ef444418', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <FiTrash2 size={18} color="#ef4444" />
              </div>
              <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--fg-bright)' }}>Delete this income?</div>
            </div>
            <div style={{ fontSize: '0.88rem', color: 'var(--fg)', marginBottom: 4 }}>
              <strong>{typeName(pendingDelete.incomeId)}</strong> — ₹{fmt(pendingDelete.amountPaise)}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--fg-muted)', marginBottom: 18 }}>
              {pendingDelete.narration || 'No narration'} · {pendingDelete.entryDate} · This entry will be moved to the Recycle Bin (you can restore it later).
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setPendingDelete(null)}
                style={{ padding: '8px 16px', background: 'var(--bg-input)', color: 'var(--fg)', border: '1px solid var(--border)', borderRadius: 7, cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>Cancel</button>
              <button onClick={confirmDelete} autoFocus
                style={{ padding: '8px 18px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: '0.85rem', fontWeight: 700 }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
