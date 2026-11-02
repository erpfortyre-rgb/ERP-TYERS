import { useEffect, useState, useCallback } from 'react'
import toast from 'react-hot-toast'
import { EmployeeLedger, ListEmployees } from '../../wailsjs/go/main/App'

interface Employee { id: string; name: string; phone: string; designation: string; salaryPaise: number }
interface LedgerRow {
  date: string; description: string; amount: number; paymentMethod: string; reference: string
}

const today = () => new Date().toISOString().slice(0, 10)
const fmt = (p: number) => (p / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })

export default function EmployeeLedgerPage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [selectedEmp, setSelectedEmp] = useState('')
  const [from, setFrom] = useState(today())
  const [to, setTo] = useState(today())
  const [entries, setEntries] = useState<LedgerRow[]>([])

  useEffect(() => {
    (async () => {
      try { const e = await ListEmployees('') as any; setEmployees(e || []) } catch (e: any) { console.error(e); toast.error(e?.message || 'Failed to load employees') }
    })()
  }, [])

  const load = useCallback(async () => {
    if (!selectedEmp) return
    try {
      const list = await EmployeeLedger(selectedEmp, from, to) as any
      setEntries(list || [])
    } catch (e: any) { toast.error(e?.message || 'Failed to load'); console.error(e) }
  }, [selectedEmp, from, to])

  useEffect(() => { load() }, [load])

  const totalPaid = entries.reduce((s, e) => s + e.amount, 0)
  const emp = employees.find(e => e.id === selectedEmp)

  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column', gap: 0, padding: 0 }}>
      <div style={{ background: 'var(--accent)', color: '#fff', padding: '10px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 600, fontSize: '1rem' }}>Employee Ledger</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-sm" style={{ background: 'var(--bg-card)', color: 'var(--fg)' }}>Print</button>
          <button className="btn btn-sm" style={{ background: 'var(--bg-card)', color: 'var(--fg)' }}>Export</button>
        </div>
      </div>

      <div style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <label style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: 4, display: 'block' }}>Employee</label>
          <select className="form-input" value={selectedEmp} onChange={e => setSelectedEmp(e.target.value)}
            style={{ background: 'var(--bg-input)', minWidth: 220 }}>
            <option value="">-- Select Employee --</option>
            {employees.map(e => <option key={e.id} value={e.id}>{e.name} ({e.designation})</option>)}
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

      {emp && (
        <div style={{ padding: '0 20px 8px', display: 'flex', gap: 24, fontSize: '0.85rem', color: 'var(--fg-muted)' }}>
          <span>Phone: {emp.phone || '-'}</span>
          <span>Designation: {emp.designation || '-'}</span>
          <span>Salary: {fmt(emp.salaryPaise)}</span>
        </div>
      )}

      <div style={{ flex: 1, overflow: 'auto', padding: '0 20px' }}>
        <table>
          <thead>
            <tr>
              <th style={{ width: 40 }}>#</th>
              <th style={{ width: 110 }}>Date</th>
              <th style={{ width: 140 }}>Type</th>
              <th style={{ textAlign: 'right', width: 130 }}>Amount</th>
              <th style={{ width: 140 }}>Reference</th>
              <th>Remark</th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--fg-muted)' }}>
                {selectedEmp ? 'No payments found' : 'Select an employee'}
              </td></tr>
            )}
            {entries.map((e, i) => (
              <tr key={i}>
                <td>{i + 1}</td>
                <td>{e.date}</td>
                <td><span className="badge badge-info">{e.paymentMethod}</span></td>
                <td style={{ textAlign: 'right', fontWeight: 500 }}>{fmt(e.amount)}</td>
                <td>{e.reference || '-'}</td>
                <td>{e.description || '-'}</td>
              </tr>
            ))}
          </tbody>
          {entries.length > 0 && (
            <tfoot>
              <tr style={{ fontWeight: 700, background: 'var(--bg-sidebar)' }}>
                <td colSpan={3} style={{ textAlign: 'right' }}>TOTAL PAID</td>
                <td style={{ textAlign: 'right' }}>{fmt(totalPaid)}</td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}
