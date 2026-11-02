import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { CompanyOutstanding } from '../../wailsjs/go/main/App'

interface OutstandingRow { partyId: string; partyName: string; totalPaise: number; paidPaise: number; balancePaise: number }

const fmt = (p: number) => (p / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })

export default function CompanyOutstandingPage() {
  const [rows, setRows] = useState<OutstandingRow[]>([])
  const [search, setSearch] = useState('')

  useEffect(() => {
    (async () => {
      try {
        const data = await CompanyOutstanding()
        setRows((data || []) as OutstandingRow[])
      } catch (e: any) { toast.error(e?.message || 'Failed to load outstanding'); console.error(e) }
    })()
  }, [])

  const filtered = search
    ? rows.filter(r => r.partyName.toLowerCase().includes(search.toLowerCase()))
    : rows

  const totalOutstanding = filtered.reduce((s, r) => s + (r.balancePaise || 0), 0)

  const handlePrint = () => { toast('Print: use Ctrl+P or ESC/POS printer from Settings') }

  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column', gap: 0, padding: 0 }}>
      <div style={{ background: 'var(--accent)', color: '#fff', padding: '10px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 600, fontSize: '1rem' }}>Company / Supplier Outstanding</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-sm" onClick={handlePrint} style={{ background: 'var(--bg-card)', color: 'var(--fg)' }}>Print</button>
          <button className="btn btn-sm" style={{ background: 'var(--bg-card)', color: 'var(--fg)' }}>Export</button>
        </div>
      </div>

      <div style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
        <input
          placeholder="Search company by name or phone..."
          value={search} onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, padding: '8px 12px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--fg)' }}
        />
        <span style={{ fontWeight: 700, color: 'var(--accent)', whiteSpace: 'nowrap' }}>
          Total Outstanding: {fmt(totalOutstanding)}
        </span>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '0 20px' }}>
        <table>
          <thead>
            <tr>
              <th style={{ width: 40 }}>#</th>
              <th>Company Name</th>
              <th style={{ textAlign: 'right', width: 140 }}>Total</th>
              <th style={{ textAlign: 'right', width: 140 }}>Paid</th>
              <th style={{ textAlign: 'right', width: 160 }}>Outstanding</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={5} style={{ textAlign: 'center', padding: 40, color: 'var(--fg-muted)' }}>No companies found</td></tr>
            )}
            {filtered.map((r, i) => (
              <tr key={r.partyId}>
                <td>{i + 1}</td>
                <td style={{ fontWeight: 500 }}>{r.partyName}</td>
                <td style={{ textAlign: 'right' }}>{fmt(r.totalPaise || 0)}</td>
                <td style={{ textAlign: 'right' }}>{fmt(r.paidPaise || 0)}</td>
                <td style={{
                  textAlign: 'right', fontWeight: 600,
                  color: (r.balancePaise || 0) > 0 ? 'var(--error)' : (r.balancePaise || 0) < 0 ? 'var(--success)' : 'var(--fg)'
                }}>
                  {fmt(r.balancePaise || 0)}
                </td>
              </tr>
            ))}
          </tbody>
          {filtered.length > 0 && (
            <tfoot>
              <tr style={{ fontWeight: 700, background: 'var(--bg-sidebar)' }}>
                <td colSpan={4} style={{ textAlign: 'right' }}>TOTAL OUTSTANDING</td>
                <td style={{ textAlign: 'right' }}>{fmt(totalOutstanding)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}
