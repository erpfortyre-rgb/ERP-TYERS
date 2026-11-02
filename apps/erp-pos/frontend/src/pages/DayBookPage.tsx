import { useEffect, useState, useCallback } from 'react'
import toast from 'react-hot-toast'
import { DayBook } from '../../wailsjs/go/main/App'

interface DayBookEntry {
  date: string; type: string; number: string; partyName: string; amountPaise: number
}

const today = () => new Date().toISOString().slice(0, 10)
const fmt = (p: number) => p === 0 ? '0.00' : (p / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })

export default function DayBookPage() {
  const [entries, setEntries] = useState<DayBookEntry[]>([])
  const [date, setDate] = useState(today())
  const [voucherType, setVoucherType] = useState('')
  const [withItems, setWithItems] = useState(false)

  const load = useCallback(async () => {
    try {
      const list = await DayBook(date)
      let filtered = list || []
      if (voucherType) {
        filtered = filtered.filter((e: DayBookEntry) => e.type === voucherType)
      }
      setEntries(filtered)
    } catch (e: any) { toast.error(e?.message || 'Failed to load day book'); console.error(e) }
  }, [date, voucherType])

  useEffect(() => { load() }, [load])

  const totalDebit = entries.filter(e => e.type === 'SALE').reduce((s, e) => s + e.amountPaise, 0)
  const totalPayIn = entries.filter(e => e.type === 'INCOME').reduce((s, e) => s + e.amountPaise, 0)
  const totalPayOut = entries.filter(e => e.type === 'EXPENSE').reduce((s, e) => s + e.amountPaise, 0)

  const voucherTypeLabel = (type: string) => {
    switch (type) {
      case 'SALE': return 'Sale'
      case 'EXPENSE': return 'Expense'
      case 'INCOME': return 'Income'
      default: return type
    }
  }

  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column', gap: 0, padding: 0 }}>
      {/* Title */}
      <div style={{ textAlign: 'center', padding: '20px 20px 12px' }}>
        <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--fg-bright)' }}>DAY BOOK SUMMARY</h2>
      </div>

      {/* Filter bar */}
      <div style={{ padding: '0 20px 16px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        {/* Voucher Type toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => setVoucherType(voucherType ? '' : 'SALE')}
            style={{
              width: 36, height: 20, borderRadius: 10, position: 'relative', cursor: 'pointer',
              background: voucherType ? 'var(--accent)' : '#ccc', border: 'none', transition: 'background 0.2s'
            }}>
            <span style={{
              position: 'absolute', top: 2, width: 16, height: 16, borderRadius: '50%', background: 'var(--bg-card)',
              left: voucherType ? 18 : 2, transition: 'left 0.2s',
            }} />
          </button>
          <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>Search by Voucher Type :</span>
        </div>

        {voucherType && (
          <select className="form-input" value={voucherType} onChange={e => setVoucherType(e.target.value)}
            style={{ width: 160, padding: '6px 10px' }}>
            <option value="SALE">Sale</option>
            <option value="EXPENSE">Expense</option>
            <option value="INCOME">Income</option>
          </select>
        )}

        {/* Date Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>Date Filter :</span>
          <select className="form-input" style={{ width: 160, padding: '6px 10px' }}>
            <option>Transaction Date</option>
          </select>
        </div>

        {/* Today / Date picker */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button className="btn btn-sm" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', padding: '6px 14px' }}
            onClick={() => setDate(today())}>
            Today
          </button>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            style={{ padding: '5px 8px', border: '1px solid var(--border)', borderRadius: 4 }} />
        </div>

        {/* With Items toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            onClick={() => setWithItems(!withItems)}
            style={{
              width: 36, height: 20, borderRadius: 10, position: 'relative', cursor: 'pointer',
              background: withItems ? 'var(--accent)' : '#ccc', border: 'none', transition: 'background 0.2s'
            }}>
            <span style={{
              position: 'absolute', top: 2, width: 16, height: 16, borderRadius: '50%', background: 'var(--bg-card)',
              left: withItems ? 18 : 2, transition: 'left 0.2s',
            }} />
          </button>
          <span style={{ fontSize: '0.85rem' }}>With Items</span>
        </div>

        <button className="btn btn-primary btn-sm" onClick={load}>Search</button>
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflow: 'auto', padding: '0 20px' }}>
        <table>
          <thead>
            <tr>
              <th style={{ width: 90 }}>Date</th>
              <th style={{ width: 110 }}>Voucher No</th>
              <th>Particular</th>
              <th style={{ width: 110 }}>Voucher Type</th>
              <th style={{ textAlign: 'right', width: 100 }}>Debit</th>
              <th style={{ textAlign: 'right', width: 110 }}>Payment In</th>
              <th style={{ textAlign: 'right', width: 110 }}>Payment Out</th>
              <th style={{ textAlign: 'right', width: 90 }}>Discount</th>
              <th style={{ width: 60 }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry, i) => (
              <tr key={i}>
                <td>{entry.date || date}</td>
                <td>{entry.number}</td>
                <td>{entry.partyName}</td>
                <td>
                  <span className={`badge ${entry.type === 'SALE' ? 'badge-info' : entry.type === 'INCOME' ? 'badge-success' : 'badge-error'}`}>
                    {voucherTypeLabel(entry.type)}
                  </span>
                </td>
                <td style={{ textAlign: 'right' }}>{entry.type === 'SALE' ? fmt(entry.amountPaise) : ''}</td>
                <td style={{ textAlign: 'right', color: 'var(--success)' }}>{entry.type === 'INCOME' ? fmt(entry.amountPaise) : ''}</td>
                <td style={{ textAlign: 'right', color: 'var(--error)' }}>{entry.type === 'EXPENSE' ? fmt(entry.amountPaise) : ''}</td>
                <td style={{ textAlign: 'right' }}>0</td>
                <td></td>
              </tr>
            ))}
            {entries.length === 0 && (
              <tr><td colSpan={9} style={{ textAlign: 'center', padding: 40, color: 'var(--fg-muted)' }}>No entries for this date</td></tr>
            )}
          </tbody>
          <tfoot>
            <tr style={{ fontWeight: 700, background: 'var(--bg-sidebar)' }}>
              <td colSpan={4} style={{ textAlign: 'right' }}>TOTAL</td>
              <td style={{ textAlign: 'right' }}>{fmt(totalDebit)}</td>
              <td style={{ textAlign: 'right' }}>{fmt(totalPayIn)}</td>
              <td style={{ textAlign: 'right' }}>{fmt(totalPayOut)}</td>
              <td style={{ textAlign: 'right' }}>0</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
