import { useEffect, useState, useCallback } from 'react'
import toast from 'react-hot-toast'
import { CompanyLedger, ListCompanies } from '../../wailsjs/go/main/App'

interface LedgerEntry {
  date: string; description: string; debitPaise: number; creditPaise: number; balancePaise: number
}
interface Company { id: string; name: string }

const fmt = (p: number) => (p / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })

export default function CompanyLedgerPage() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [entries, setEntries] = useState<LedgerEntry[]>([])
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  useEffect(() => {
    ListCompanies('').then(c => setCompanies(c || [])).catch(e => { console.error(e); toast.error('Failed to load companies') })
  }, [])

  const load = useCallback(async () => {
    if (!selectedId) { setEntries([]); return }
    try {
      const list = await CompanyLedger(selectedId, from, to)
      setEntries(list || [])
    } catch (e: any) { toast.error(e?.message || 'Failed to load ledger'); console.error(e) }
  }, [selectedId, from, to])

  useEffect(() => { load() }, [load])

  const totalBill = entries.reduce((s, e) => s + e.debitPaise, 0)
  const totalPayOut = entries.reduce((s, e) => s + e.creditPaise, 0)
  const balance = entries.length > 0 ? entries[entries.length - 1].balancePaise : 0

  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column', gap: 0, padding: 0 }}>
      <div style={{ background: 'var(--accent)', color: '#fff', padding: '10px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 600, fontSize: '1rem' }}>Company Ledger</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-sm" style={{ background: 'var(--bg-card)', color: 'var(--fg)' }}>Filter</button>
          <button className="btn btn-sm" style={{ background: 'var(--bg-card)', color: 'var(--fg)' }}>Print</button>
          <button className="btn btn-sm" style={{ background: 'var(--success)', color: '#fff' }}>Export</button>
        </div>
      </div>

      <div style={{ padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20 }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: 4, display: 'block' }}>Company Name</label>
          <select className="form-input" value={selectedId}
            onChange={e => setSelectedId(e.target.value)}
            style={{ background: 'var(--bg-input)', borderColor: 'var(--accent)' }}>
            <option value="">Select Name</option>
            {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span style={{ color: 'var(--accent)', fontWeight: 700, fontSize: '1rem' }}>
            Account Balance : {fmt(balance)}
          </span>
        </div>
      </div>

      <div style={{ padding: '0 20px 12px', display: 'flex', gap: 8, alignItems: 'center' }}>
        <label style={{ fontSize: '0.8rem' }}>From:</label>
        <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={{ width: 140, padding: '4px 8px' }} />
        <label style={{ fontSize: '0.8rem' }}>To:</label>
        <input type="date" value={to} onChange={e => setTo(e.target.value)} style={{ width: 140, padding: '4px 8px' }} />
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '0 20px' }}>
        <table>
          <thead>
            <tr>
              <th style={{ width: 40 }}>#</th>
              <th style={{ width: 120 }}>DATE</th>
              <th>Other Information</th>
              <th style={{ width: 110 }}>Voucher No</th>
              <th style={{ textAlign: 'right', width: 120 }}>Bill Amount</th>
              <th style={{ textAlign: 'right', width: 120 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--error)', display: 'inline-block' }}></span>
                  Payment Out
                </span>
              </th>
              <th style={{ textAlign: 'right', width: 60 }}>Dis.</th>
              <th style={{ textAlign: 'right', width: 110 }}>Balance</th>
              <th style={{ width: 70 }}>ACTION</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><input type="checkbox" style={{ width: 14, height: 14 }} /></td>
              <td><input type="date" defaultValue={new Date().toISOString().slice(0, 10)} style={{ width: '100%', padding: '4px 6px', border: '1px solid var(--border)', borderRadius: 4 }} /></td>
              <td><input placeholder="Enter Other Information" style={{ width: '100%', padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 4, background: 'transparent' }} /></td>
              <td><input style={{ width: '100%', padding: '4px 6px', border: '1px solid var(--border)', borderRadius: 4 }} /></td>
              <td><input type="number" placeholder="0" style={{ width: '100%', padding: '4px 6px', textAlign: 'right', border: '1px solid var(--border)', borderRadius: 4 }} /></td>
              <td><input type="number" placeholder="0" style={{ width: '100%', padding: '4px 6px', textAlign: 'right', border: '1px solid var(--border)', borderRadius: 4 }} /></td>
              <td><input type="number" placeholder="0" style={{ width: '100%', padding: '4px 6px', textAlign: 'right', border: '1px solid var(--border)', borderRadius: 4 }} /></td>
              <td style={{ textAlign: 'right', color: 'var(--fg-muted)' }}>0</td>
              <td>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button style={{ padding: 4, border: 'none', background: 'none', cursor: 'pointer' }} onClick={() => toast('To edit entries, use Debit/Credit Note from the menu')}>✏️</button>
                  <button onClick={() => toast('To add manual entries, use Debit/Credit Note from the menu')} style={{ padding: '2px 8px', background: 'var(--success)', color: '#fff', border: 'none', borderRadius: 4, fontWeight: 700, fontSize: '1rem', cursor: 'pointer' }}>+</button>
                </div>
              </td>
            </tr>

            {entries.map((entry, i) => (
              <tr key={i}>
                <td>{i + 1}</td>
                <td>{entry.date}</td>
                <td>{entry.description}</td>
                <td></td>
                <td style={{ textAlign: 'right' }}>{entry.debitPaise > 0 ? fmt(entry.debitPaise) : ''}</td>
                <td style={{ textAlign: 'right', color: 'var(--error)' }}>{entry.creditPaise > 0 ? fmt(entry.creditPaise) : ''}</td>
                <td style={{ textAlign: 'right' }}>0</td>
                <td style={{ textAlign: 'right', fontWeight: 500 }}>{fmt(entry.balancePaise)}</td>
                <td></td>
              </tr>
            ))}

            {entries.length === 0 && (
              <tr><td colSpan={9} style={{ textAlign: 'center', padding: 40, color: 'var(--fg-muted)' }}>
                {selectedId ? 'No ledger entries' : 'Select a company to view ledger'}
              </td></tr>
            )}
          </tbody>
          <tfoot>
            <tr style={{ fontWeight: 700, background: 'var(--bg-sidebar)' }}>
              <td colSpan={4} style={{ textAlign: 'right' }}>Total</td>
              <td style={{ textAlign: 'right' }}>{fmt(totalBill)}</td>
              <td style={{ textAlign: 'right' }}>{fmt(totalPayOut)}</td>
              <td style={{ textAlign: 'right' }}>0</td>
              <td style={{ textAlign: 'right' }}>{fmt(balance)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
