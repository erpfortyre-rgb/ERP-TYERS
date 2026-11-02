import { useState, useCallback, useEffect } from 'react'
import toast from 'react-hot-toast'
import { EmployeewiseSale } from '../../wailsjs/go/main/App'

const today = () => new Date().toISOString().slice(0, 10)
const fmtAmt = (p: number) => (p / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })

export default function EmployeewiseSalePage() {
  const [from, setFrom] = useState(today())
  const [to, setTo] = useState(today())
  const [data, setData] = useState<any[]>([])

  const load = useCallback(async () => {
    try {
      const d = await EmployeewiseSale(from, to); setData(d || [])
    } catch (e: any) { toast.error(e?.message || 'Failed to load'); console.error(e) }
  }, [from, to])

  useEffect(() => { load() }, [load])

  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column', gap: 0, padding: 0 }}>
      <div style={{ background: 'var(--accent)', color: '#fff', padding: '10px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 600, fontSize: '1rem' }}>Employeewise Sale</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-sm" style={{ background: 'var(--bg-card)', color: 'var(--fg)' }}>Print</button>
          <button className="btn btn-sm" style={{ background: 'var(--success)', color: '#fff' }}>Export</button>
        </div>
      </div>

      <div style={{ padding: '12px 20px', display: 'flex', gap: 12, alignItems: 'center' }}>
        <label style={{ fontSize: '0.85rem', fontWeight: 500 }}>From:</label>
        <input type="date" value={from} onChange={e => setFrom(e.target.value)}
          style={{ padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--bg-input)', color: 'var(--fg)' }} />
        <label style={{ fontSize: '0.85rem', fontWeight: 500 }}>To:</label>
        <input type="date" value={to} onChange={e => setTo(e.target.value)}
          style={{ padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--bg-input)', color: 'var(--fg)' }} />
        <button className="btn btn-primary btn-sm" onClick={load}>Search</button>
      </div>

      <div style={{ padding: '8px 20px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', fontSize: '0.85rem', color: 'var(--fg-muted)' }}>
        Note: Invoices do not currently track the salesperson. This report will populate once a salesperson field is added to invoices.
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '0 20px' }}>
        <table>
          <thead>
            <tr>
              <th>Employee</th>
              <th style={{ textAlign: 'right' }}>Sale Count</th>
              <th style={{ textAlign: 'right' }}>Sale Amount</th>
              <th style={{ textAlign: 'right' }}>Returns</th>
              <th style={{ textAlign: 'right' }}>Net Amount</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row: any, i: number) => (
              <tr key={i}>
                <td>{row.employeeName}</td>
                <td style={{ textAlign: 'right' }}>{row.saleCount}</td>
                <td style={{ textAlign: 'right' }}>{fmtAmt(row.saleAmountPaise)}</td>
                <td style={{ textAlign: 'right' }}>{fmtAmt(row.returnsPaise)}</td>
                <td style={{ textAlign: 'right', fontWeight: 500 }}>{fmtAmt(row.netAmountPaise)}</td>
              </tr>
            ))}
            {data.length === 0 && (
              <tr><td colSpan={5} style={{ textAlign: 'center', padding: 40, color: 'var(--fg-muted)' }}>No data available</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
