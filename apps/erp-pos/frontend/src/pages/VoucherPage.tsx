import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { ListVouchers, SaveVoucher, DeleteVoucher, SearchCustomers, ListCompanies } from '../../wailsjs/go/main/App'

interface Voucher {
  id: string; voucherType: string; voucherNumber: string; createdAt: string; partyType: string
  partyId: string; amountPaise: number; method: string; referenceNumber: string; narration: string
}

const today = () => new Date().toISOString().slice(0, 10)

const fmt = (p: number) => (p / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })

export default function VoucherPage() {
  const [vouchers, setVouchers] = useState<Voucher[]>([])
  const [filterType, setFilterType] = useState('')
  const [draft, setDraft] = useState({
    voucherType: 'PAYMENT', createdAt: today(), partyType: 'CUSTOMER',
    partyId: '', amountPaise: 0, narration: '', method: 'CASH'
  })
  const [editId, setEditId] = useState<string | null>(null)
  const [partyOptions, setPartyOptions] = useState<{ id: string; name: string }[]>([])
  const [allParties, setAllParties] = useState<{ id: string; name: string }[]>([])
  const [partySearch, setPartySearch] = useState('')

  useEffect(() => { loadVouchers() }, [filterType])

  useEffect(() => {
    Promise.all([
      SearchCustomers('').catch(() => []),
      ListCompanies('').catch(() => []),
    ]).then(([custs, comps]: any) => {
      setAllParties([
        ...(custs || []).map((c: any) => ({ id: c.id, name: c.name })),
        ...(comps || []).map((c: any) => ({ id: c.id, name: c.name })),
      ])
    })
  }, [])

  useEffect(() => {
    const loadParties = async () => {
      try {
        if (draft.partyType === 'CUSTOMER') {
          const res = await SearchCustomers(partySearch) as any
          setPartyOptions((res || []).map((c: any) => ({ id: c.id, name: c.name + (c.phone ? ` (${c.phone})` : '') })))
        } else {
          const res = await ListCompanies(partySearch) as any
          setPartyOptions((res || []).map((c: any) => ({ id: c.id, name: c.name })))
        }
      } catch { setPartyOptions([]) }
    }
    loadParties()
  }, [draft.partyType, partySearch])

  const loadVouchers = async () => {
    try {
      const data = await ListVouchers(filterType) as any
      setVouchers(data || [])
    } catch (e: any) { toast.error(e?.message || 'Failed to load vouchers'); console.error(e) }
  }

  const handleAdd = async () => {
    if (!draft.partyId) { toast.error('Select a party'); return }
    if (draft.amountPaise <= 0) { toast.error('Enter amount'); return }
    try {
      await SaveVoucher({ ...draft, id: editId || '' } as any)
      toast.success(editId ? 'Voucher updated' : 'Voucher saved')
      setDraft({ voucherType: 'PAYMENT', createdAt: today(), partyType: 'CUSTOMER', partyId: '', amountPaise: 0, narration: '', method: 'CASH' })
      setEditId(null)
      loadVouchers()
    } catch (e: any) { toast.error(e?.message || 'Failed to save'); console.error(e) }
  }

  const handleEdit = (v: Voucher) => {
    setDraft({ voucherType: v.voucherType, createdAt: v.createdAt?.slice(0, 10) || today(), partyType: v.partyType, partyId: v.partyId, amountPaise: v.amountPaise, narration: v.narration, method: v.method || 'CASH' })
    setEditId(v.id)
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this voucher? This cannot be undone.')) return
    try {
      await DeleteVoucher(id)
      toast.success('Voucher deleted')
      loadVouchers()
    } catch (e: any) { toast.error(e?.message || 'Failed to delete'); console.error(e) }
  }

  const typeColors: Record<string, string> = {
    PAYMENT: 'var(--error)', RECEIPT: 'var(--success)'
  }

  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column', gap: 0, padding: 0 }}>
      <div style={{ background: 'var(--accent)', color: '#fff', padding: '10px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 600, fontSize: '1rem' }}>Voucher Entry</span>
        <span style={{ fontSize: '0.85rem' }}>{vouchers.length} voucher(s)</span>
      </div>

      <div style={{ padding: '12px 20px', display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'flex-end', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <label style={{ fontSize: '0.75rem', color: 'var(--fg-muted)' }}>Voucher Type</label>
          <select value={draft.voucherType} onChange={e => setDraft({ ...draft, voucherType: e.target.value })}
            style={{ padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--bg-input)', color: 'var(--fg)' }}>
            <option value="PAYMENT">Payment</option>
            <option value="RECEIPT">Receipt</option>
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <label style={{ fontSize: '0.75rem', color: 'var(--fg-muted)' }}>Date</label>
          <input type="date" value={draft.createdAt} onChange={e => setDraft({ ...draft, createdAt: e.target.value })}
            style={{ padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--bg-input)', color: 'var(--fg)' }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <label style={{ fontSize: '0.75rem', color: 'var(--fg-muted)' }}>Party Type</label>
          <select value={draft.partyType} onChange={e => setDraft({ ...draft, partyType: e.target.value })}
            style={{ padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--bg-input)', color: 'var(--fg)' }}>
            <option value="CUSTOMER">Customer</option>
            <option value="SUPPLIER">Supplier</option>
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 200 }}>
          <label style={{ fontSize: '0.75rem', color: 'var(--fg-muted)' }}>
            {draft.partyType === 'CUSTOMER' ? 'Customer' : 'Supplier'} *
          </label>
          <select value={draft.partyId} onChange={e => setDraft({ ...draft, partyId: e.target.value })}
            style={{ padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--bg-input)', color: 'var(--fg)' }}>
            <option value="">— Select —</option>
            {partyOptions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <label style={{ fontSize: '0.75rem', color: 'var(--fg-muted)' }}>Amount *</label>
          <input type="number" value={draft.amountPaise ? draft.amountPaise / 100 : ''} placeholder="0.00"
            onChange={e => setDraft({ ...draft, amountPaise: Math.round(parseFloat(e.target.value || '0') * 100) })}
            style={{ padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 4, width: 120, background: 'var(--bg-input)', color: 'var(--fg)' }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <label style={{ fontSize: '0.75rem', color: 'var(--fg-muted)' }}>Method</label>
          <select value={draft.method} onChange={e => setDraft({ ...draft, method: e.target.value })}
            style={{ padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--bg-input)', color: 'var(--fg)' }}>
            <option value="CASH">Cash</option>
            <option value="UPI">UPI</option>
            <option value="CARD">Card</option>
            <option value="CHEQUE">Cheque</option>
            <option value="BANK_TRANSFER">Bank Transfer</option>
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 150 }}>
          <label style={{ fontSize: '0.75rem', color: 'var(--fg-muted)' }}>Narration</label>
          <input value={draft.narration} onChange={e => setDraft({ ...draft, narration: e.target.value })}
            placeholder="Narration" style={{ padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--bg-input)', color: 'var(--fg)' }} />
        </div>
        {editId && (
          <button onClick={() => { setEditId(null); setDraft({ voucherType: 'PAYMENT', createdAt: today(), partyType: 'CUSTOMER', partyId: '', amountPaise: 0, narration: '', method: 'CASH' }) }}
            style={{ padding: '6px 16px', background: 'var(--bg-card)', color: 'var(--fg)', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}>
            Cancel
          </button>
        )}
        <button onClick={handleAdd}
          style={{ padding: '6px 20px', background: editId ? 'var(--accent)' : 'var(--success)', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}>
          {editId ? 'Update' : '+ Add'}
        </button>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '0 20px' }}>
        <table>
          <thead>
            <tr>
              <th style={{ width: 40 }}>#</th>
              <th style={{ width: 90 }}>Type</th>
              <th style={{ width: 100 }}>Date</th>
              <th>Party Type</th>
              <th>Party ID</th>
              <th style={{ textAlign: 'right', width: 130 }}>Amount</th>
              <th style={{ width: 100 }}>Method</th>
              <th>Narration</th>
              <th style={{ width: 110 }}></th>
            </tr>
          </thead>
          <tbody>
            {vouchers.map((v, i) => (
              <tr key={v.id} style={{ background: editId === v.id ? 'rgba(var(--accent-rgb, 59,130,246),0.08)' : undefined }}>
                <td>{i + 1}</td>
                <td>
                  <span style={{
                    padding: '2px 10px', borderRadius: 12, fontSize: '0.78rem', fontWeight: 600,
                    background: typeColors[v.voucherType] || '#ccc', color: '#fff'
                  }}>
                    {v.voucherType}
                  </span>
                </td>
                <td>{v.createdAt?.slice(0, 10) || '—'}</td>
                <td style={{ fontWeight: 500 }}>{v.partyType}</td>
                <td style={{ fontWeight: 500 }}>{allParties.find(p => p.id === v.partyId)?.name || v.partyId}</td>
                <td style={{ textAlign: 'right', fontWeight: 500 }}>{fmt(v.amountPaise)}</td>
                <td style={{ fontSize: '0.8rem' }}>{v.method || 'CASH'}</td>
                <td style={{ fontSize: '0.85rem', color: 'var(--fg-muted)' }}>{v.narration || '-'}</td>
                <td>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={() => handleEdit(v)}
                      style={{ padding: '2px 8px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.75rem' }}>
                      Edit
                    </button>
                    <button onClick={() => handleDelete(v.id)}
                      style={{ padding: '2px 8px', background: 'var(--error)', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.75rem' }}>
                      Del
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {vouchers.length === 0 && (
              <tr><td colSpan={9} style={{ textAlign: 'center', padding: 40, color: 'var(--fg-muted)' }}>No vouchers added</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
