import { useEffect, useState, useCallback } from 'react'
import toast from 'react-hot-toast'
import { BankBook, ListBanks } from '../../wailsjs/go/main/App'

interface BankMaster { id: string; tenantId: string; bankName: string; accountNumber: string; ifscCode: string; branch: string; openingBalancePaise: number; isActive: boolean }
interface BankBookEntry {
  date: string; description: string; debit: number; credit: number; balance: number
}

const today = () => new Date().toISOString().slice(0, 10)
const fmt = (p: number) => (p / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })

export default function BankBookPage() {
  const [banks, setBanks] = useState<BankMaster[]>([])
  const [selectedBank, setSelectedBank] = useState('')
  const [from, setFrom] = useState(today())
  const [to, setTo] = useState(today())
  const [entries, setEntries] = useState<BankBookEntry[]>([])

  useEffect(() => {
    (async () => {
      try { const b = await ListBanks() as any; setBanks(b || []) } catch (e: any) { console.error(e); toast.error(e?.message || 'Failed to load banks') }
    })()
  }, [])

  const load = useCallback(async () => {
    if (!selectedBank) return
    try {
      const list = await BankBook(selectedBank, from, to) as any
      setEntries(list || [])
    } catch (e: any) { toast.error(e?.message || 'Failed to load'); console.error(e) }
  }, [selectedBank, from, to])

  useEffect(() => { load() }, [load])

  const totalDebit = entries.reduce((s, e) => s + e.debit, 0)
  const totalCredit = entries.reduce((s, e) => s + e.credit, 0)
  const finalBalance = entries.length > 0 ? entries[entries.length - 1].balance : 0

  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column', gap: 0, padding: 0 }}>
      <div style={{ background: 'var(--accent)', color: '#fff', padding: '10px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 600, fontSize: '1rem' }}>Bank Book</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-sm" style={{ background: 'var(--bg-card)', color: 'var(--fg)' }}>Print</button>
          <button className="btn btn-sm" style={{ background: 'var(--bg-card)', color: 'var(--fg)' }}>Export</button>
        </div>
      </div>

      <div style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <label style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: 4, display: 'block' }}>Bank Account</label>
          <select className="form-input" value={selectedBank} onChange={e => setSelectedBank(e.target.value)}
            style={{ background: 'var(--bg-input)', minWidth: 200 }}>
            <option value="">-- Select Bank --</option>
            {banks.map(b => <option key={b.id} value={b.id}>{b.bankName}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: 4, display: 'block' }}>From</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)}
            style={{ background: 'var(--bg-input)', padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 4 }} />
        </div>
        <div>
          <label style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: 4, display: 'block' }}>To</label>
          <input type="date" value={to} onChange={e => setTo(e.target.value)}
            style={{ background: 'var(--bg-input)', padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 4 }} />
        </div>
        <button className="btn btn-primary btn-sm" onClick={load} style={{ alignSelf: 'flex-end' }}>Search</button>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '0 20px' }}>
        <table>
          <thead>
            <tr>
              <th style={{ width: 100 }}>Date</th>
              <th>Particulars</th>
              <th style={{ width: 120 }}>Voucher Type</th>
              <th style={{ textAlign: 'right', width: 120 }}>Debit</th>
              <th style={{ textAlign: 'right', width: 120 }}>Credit</th>
              <th style={{ textAlign: 'right', width: 130 }}>Balance</th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--fg-muted)' }}>
                {selectedBank ? 'No entries found' : 'Select a bank account'}
              </td></tr>
            )}
            {entries.map((e, i) => (
              <tr key={i}>
                <td>{e.date}</td>
                <td>{e.description || '-'}</td>
                <td><span className="badge badge-info">{e.debit ? 'Debit' : 'Credit'}</span></td>
                <td style={{ textAlign: 'right', color: e.debit ? 'var(--error)' : undefined }}>{e.debit ? fmt(e.debit) : ''}</td>
                <td style={{ textAlign: 'right', color: e.credit ? 'var(--success)' : undefined }}>{e.credit ? fmt(e.credit) : ''}</td>
                <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(e.balance)}</td>
              </tr>
            ))}
          </tbody>
          {entries.length > 0 && (
            <tfoot>
              <tr style={{ fontWeight: 700, background: 'var(--bg-sidebar)' }}>
                <td colSpan={3} style={{ textAlign: 'right' }}>TOTAL</td>
                <td style={{ textAlign: 'right' }}>{fmt(totalDebit)}</td>
                <td style={{ textAlign: 'right' }}>{fmt(totalCredit)}</td>
                <td style={{ textAlign: 'right' }}>{fmt(finalBalance)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}
