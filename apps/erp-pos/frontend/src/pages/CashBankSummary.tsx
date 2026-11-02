import { useEffect, useState, useCallback } from 'react'
import toast from 'react-hot-toast'
import { CashBankSummary as FetchCashBank } from '../../wailsjs/go/main/App'

interface SummaryRow { label: string; countOrQty: number; amountPaise: number }

const fmt = (p: number) => p === 0 ? '0' : (p / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })

export default function CashBankSummaryPage() {
  const [rows, setRows] = useState<SummaryRow[]>([])

  const load = useCallback(async () => {
    try {
      const list = await FetchCashBank()
      setRows(list || [])
    } catch (e: any) { toast.error(e?.message || 'Failed to load'); console.error(e) }
  }, [])

  useEffect(() => { load() }, [load])

  const total = rows.reduce((s, r) => s + r.amountPaise, 0)

  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column', gap: 0, padding: 0 }}>
      <div style={{ background: 'var(--accent)', color: '#fff', padding: '10px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 600, fontSize: '1rem' }}>Cash & Bank Summary (Today)</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-sm" style={{ background: 'var(--bg-card)', color: 'var(--fg)' }} onClick={load}>Refresh</button>
          <button className="btn btn-sm" style={{ background: 'var(--bg-card)', color: 'var(--fg)' }}>Print</button>
          <button className="btn btn-sm" style={{ background: 'var(--success)', color: '#fff' }}>Export</button>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '0 20px' }}>
        <table>
          <thead>
            <tr>
              <th style={{ width: 50 }}>#</th>
              <th>Particular</th>
              <th style={{ textAlign: 'right', width: 160 }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                <td>{i + 1}</td>
                <td style={{ fontWeight: 500 }}>{row.label}</td>
                <td style={{ textAlign: 'right', fontWeight: 500, color: row.amountPaise >= 0 ? 'var(--success)' : 'var(--error)' }}>
                  {fmt(Math.abs(row.amountPaise))}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={3} style={{ textAlign: 'center', padding: 40, color: 'var(--fg-muted)' }}>No data for selected period</td></tr>
            )}
          </tbody>
          <tfoot>
            <tr style={{ fontWeight: 700, background: 'var(--bg-sidebar)' }}>
              <td colSpan={2} style={{ textAlign: 'right' }}>Total</td>
              <td style={{ textAlign: 'right', color: total >= 0 ? 'var(--success)' : 'var(--error)' }}>{fmt(Math.abs(total))}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
