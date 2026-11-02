import { useEffect, useState, useCallback } from 'react'
import toast from 'react-hot-toast'
import { PaymentDetails } from '../../wailsjs/go/main/App'

interface PaymentDetailRow {
  id: string
  date: string
  partyType: string
  partyName: string
  paymentMethod: string
  amountPaise: number
  reference: string
  narration: string
}

const today = () => new Date().toISOString().slice(0, 10)
const fmt = (p: number) => (p / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })

export default function PaymentDetailsPage() {
  const [entries, setEntries] = useState<PaymentDetailRow[]>([])
  const [from, setFrom] = useState(today())
  const [to, setTo] = useState(today())

  const load = useCallback(async () => {
    try {
      const data = await PaymentDetails(from, to) as any
      setEntries(data || [])
    } catch (e: any) { toast.error(e?.message || 'Failed to load'); console.error(e) }
  }, [from, to])

  useEffect(() => { load() }, [load])

  const total = entries.reduce((s, e) => s + e.amountPaise, 0)

  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column', gap: 0, padding: 0 }}>
      <div style={{ background: 'var(--accent)', color: '#fff', padding: '10px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 600, fontSize: '1rem' }}>Payment Details</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-sm" style={{ background: 'var(--bg-card)', color: 'var(--fg)' }}>Print</button>
          <button className="btn btn-sm" style={{ background: 'var(--success)', color: '#fff' }}>Export</button>
        </div>
      </div>

      <div style={{ padding: '12px 20px', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <label style={{ fontSize: '0.85rem', fontWeight: 500 }}>From:</label>
        <input type="date" value={from} onChange={e => setFrom(e.target.value)}
          style={{ padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--bg-input)', color: 'var(--fg)' }} />
        <label style={{ fontSize: '0.85rem', fontWeight: 500 }}>To:</label>
        <input type="date" value={to} onChange={e => setTo(e.target.value)}
          style={{ padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--bg-input)', color: 'var(--fg)' }} />
        <button className="btn btn-primary btn-sm" onClick={load}>Search</button>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '0 20px' }}>
        <table>
          <thead>
            <tr>
              <th style={{ width: 50 }}>#</th>
              <th>Date</th>
              <th>Party Type</th>
              <th>Party Name</th>
              <th>Method</th>
              <th style={{ textAlign: 'right' }}>Amount</th>
              <th>Reference</th>
              <th>Remark</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e, i) => (
              <tr key={e.id}>
                <td>{i + 1}</td>
                <td>{e.date}</td>
                <td>{e.partyType}</td>
                <td style={{ fontWeight: 500 }}>{e.partyName}</td>
                <td>{e.paymentMethod}</td>
                <td style={{ textAlign: 'right', fontWeight: 500 }}>{fmt(e.amountPaise)}</td>
                <td>{e.reference}</td>
                <td style={{ color: 'var(--fg-muted)' }}>{e.narration}</td>
              </tr>
            ))}
            {entries.length === 0 && (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--fg-muted)' }}>No payment entries found</td></tr>
            )}
          </tbody>
          <tfoot>
            <tr style={{ fontWeight: 700, background: 'var(--bg-card)' }}>
              <td colSpan={5} style={{ textAlign: 'right' }}>Total</td>
              <td style={{ textAlign: 'right', color: 'var(--accent)' }}>{fmt(total)}</td>
              <td colSpan={2}></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
