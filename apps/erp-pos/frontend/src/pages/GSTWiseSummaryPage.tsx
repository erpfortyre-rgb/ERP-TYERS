import { useEffect, useState, useCallback, useMemo } from 'react'
import toast from 'react-hot-toast'
import { FiDownload, FiCalendar } from 'react-icons/fi'
import { GSTWiseSummary, SaveCSVFile } from '../../wailsjs/go/main/App'
import DateRangePicker from '../components/DateRangePicker'

interface Row { ratePercent: number; saleTaxablePaise: number; saleTaxPaise: number; purchTaxablePaise: number; purchTaxPaise: number }

const today = () => new Date().toISOString().slice(0, 10)
const firstOfMonth = () => { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10) }
const fmt = (p: number) => (p / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const thBase: React.CSSProperties = { padding: '8px 10px', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '2px solid var(--border)' }
const num: React.CSSProperties = { padding: '8px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }

export default function GSTWiseSummaryPage() {
  const [from, setFrom] = useState(firstOfMonth())
  const [to, setTo] = useState(today())
  const [showPicker, setShowPicker] = useState(false)
  const [rows, setRows] = useState<Row[]>([])

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'F2' && !showPicker) { e.preventDefault(); setShowPicker(true) } }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [showPicker])

  const load = useCallback(async () => {
    try { setRows((await GSTWiseSummary(from, to)) || []) }
    catch (e: any) { toast.error(e?.message || 'Failed to load') }
  }, [from, to])
  useEffect(() => { load() }, [load])

  const tot = useMemo(() => rows.reduce((a, r) => ({
    st: a.st + r.saleTaxablePaise, sx: a.sx + r.saleTaxPaise, pt: a.pt + r.purchTaxablePaise, px: a.px + r.purchTaxPaise,
  }), { st: 0, sx: 0, pt: 0, px: 0 }), [rows])

  const exportCSV = async () => {
    if (rows.length === 0) { toast.error('No data to export'); return }
    const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`
    const headers = ['GST Rate', 'Sale Taxable', 'Sale Tax', 'Purchase Taxable', 'Purchase Tax']
    const c = (p: number) => (p / 100).toFixed(2)
    const body = rows.map(r => [`${r.ratePercent}%`, c(r.saleTaxablePaise), c(r.saleTaxPaise), c(r.purchTaxablePaise), c(r.purchTaxPaise)])
    body.push(['Total', c(tot.st), c(tot.sx), c(tot.pt), c(tot.px)])
    const csv = [headers, ...body].map(r => r.map(esc).join(',')).join('\n')
    try {
      const path = await SaveCSVFile(csv, `GST_Wise_Summary_${from}_to_${to}.csv`)
      if (path) toast.success(`Saved: ${path}`)
    } catch (e: any) { toast.error(e?.message || 'Export failed') }
  }

  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column', gap: 0, padding: 0, height: '100%' }}>
      <div style={{ background: 'var(--accent)', color: '#fff', padding: '10px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <span style={{ fontWeight: 700, fontSize: '1rem' }}>GST-Wise Summary</span>
        <button onClick={exportCSV} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 6, cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}>
          <FiDownload size={13} /> Export CSV
        </button>
      </div>

      <div style={{ padding: '10px 20px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', flexShrink: 0 }}>
        <button onClick={() => setShowPicker(true)} title="Pick date range (F2)"
          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 5, fontSize: '0.8rem', fontWeight: 600, background: 'var(--accent)15', color: 'var(--accent)', border: '1px solid var(--accent)44', cursor: 'pointer' }}>
          <FiCalendar size={13} /> 📅 Range (F2)
        </button>
        <span style={{ fontSize: '0.82rem', color: 'var(--fg-muted)' }}>{from} to {to}</span>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '12px 20px 16px', scrollbarGutter: 'stable' }}>
        {rows.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--fg-muted)', fontSize: '0.9rem' }}>No data for this period.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: 'var(--bg-sidebar)', position: 'sticky', top: 0, zIndex: 1 }}>
                <th style={{ ...thBase, textAlign: 'left' }}>GST Rate</th>
                <th style={{ ...thBase, textAlign: 'right' }}>Sale Taxable</th>
                <th style={{ ...thBase, textAlign: 'right' }}>Sale Tax</th>
                <th style={{ ...thBase, textAlign: 'right' }}>Purchase Taxable</th>
                <th style={{ ...thBase, textAlign: 'right' }}>Purchase Tax</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}
                  onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = 'var(--bg-card)'}
                  onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'}>
                  <td style={{ padding: '8px 10px', fontWeight: 600 }}>{r.ratePercent}%</td>
                  <td style={num}>{fmt(r.saleTaxablePaise)}</td>
                  <td style={num}>{fmt(r.saleTaxPaise)}</td>
                  <td style={num}>{fmt(r.purchTaxablePaise)}</td>
                  <td style={num}>{fmt(r.purchTaxPaise)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: 'var(--bg-sidebar)', fontWeight: 700, borderTop: '2px solid var(--border)' }}>
                <td style={{ padding: '9px 10px' }}>Total</td>
                <td style={num}>₹{fmt(tot.st)}</td>
                <td style={{ ...num, color: 'var(--accent)' }}>₹{fmt(tot.sx)}</td>
                <td style={num}>₹{fmt(tot.pt)}</td>
                <td style={{ ...num, color: 'var(--accent)' }}>₹{fmt(tot.px)}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      {showPicker && (
        <DateRangePicker initialFrom={from} initialTo={to}
          onApply={(f, t) => { setFrom(f); setTo(t); setShowPicker(false) }}
          onClose={() => setShowPicker(false)} />
      )}
    </div>
  )
}
