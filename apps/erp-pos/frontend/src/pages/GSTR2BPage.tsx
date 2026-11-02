import { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'
import { GSTR2B, SaveCSVFile } from '../../wailsjs/go/main/App'
import DateRangePicker from '../components/DateRangePicker'

const today = () => new Date().toISOString().slice(0, 10)
const firstOfMonth = () => { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10) }
const fmt = (p: number) => '₹' + ((p || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })
const num = (p: number) => ((p || 0) / 100).toFixed(2)

const th = (align: 'left' | 'right' = 'right'): React.CSSProperties => ({ padding: '8px 10px', textAlign: align, fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '2px solid var(--border)', whiteSpace: 'nowrap' })
const td = (align: 'left' | 'right' = 'right'): React.CSSProperties => ({ padding: '8px 10px', textAlign: align, fontVariantNumeric: 'tabular-nums' })
const btn: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 6, cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }

export default function GSTR2BPage() {
  const [from, setFrom] = useState(firstOfMonth())
  const [to, setTo] = useState(today())
  const [showPicker, setShowPicker] = useState(false)
  const [data, setData] = useState<any>(null)

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'F2' && !showPicker) { e.preventDefault(); setShowPicker(true) } }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [showPicker])

  const load = useCallback(async () => {
    try { setData(await GSTR2B(from, to)) }
    catch (e: any) { toast.error(e?.message || 'Failed to load'); setData(null) }
  }, [from, to])
  useEffect(() => { load() }, [load])

  const rows: any[] = data ? [data.registered, data.unregistered, data.totalEligible].filter(Boolean) : []

  const exportCSV = async () => {
    const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`
    const lines: string[][] = [
      ['GSTR-2B ITC Availability Statement', `${from} to ${to}`], [],
      ['Category', 'Invoices', 'Taxable Value', 'IGST', 'CGST', 'SGST', 'Total ITC'],
      ...rows.map(r => [r.category, String(r.invoices), num(r.taxablePaise), num(r.igstPaise), num(r.cgstPaise), num(r.sgstPaise), num(r.totalItcPaise)]),
    ]
    const csv = lines.map(r => r.map(esc).join(',')).join('\n')
    try { const p = await SaveCSVFile(csv, `GSTR2B_${from}_${to}.csv`); if (p) toast.success(`Saved: ${p}`) }
    catch (e: any) { toast.error(e?.message || 'Export failed') }
  }

  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column', gap: 0, padding: 0, height: '100%' }}>
      <div style={{ background: 'var(--accent)', color: '#fff', padding: '10px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <span style={{ fontWeight: 700, fontSize: '1rem' }}>GSTR-2B</span>
        <button onClick={exportCSV} style={btn}>Export CSV</button>
      </div>

      <div style={{ padding: '10px 20px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', flexShrink: 0 }}>
        <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Shiv Shankar Tyres</span>
        <span style={{ fontSize: '0.85rem', color: 'var(--fg-muted)' }}>Period: {from} to {to}</span>
        <button onClick={() => setShowPicker(true)} title="Pick date range (F2)"
          style={{ padding: '5px 12px', borderRadius: 5, fontSize: '0.8rem', fontWeight: 600, background: 'var(--accent)15', color: 'var(--accent)', border: '1px solid var(--accent)44', cursor: 'pointer' }}>
          📅 Range (F2)
        </button>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '12px 20px 16px' }}>
        <div style={{ fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--fg-muted)', marginBottom: 8 }}>ITC Availability Summary</div>
        {rows.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '28px 0', color: 'var(--fg-muted)', fontSize: '0.9rem' }}>No data for this period</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: 'var(--bg-sidebar)' }}>
                <th style={th('left')}>Category</th><th style={th()}>Invoices</th><th style={th()}>Taxable Value</th>
                <th style={th()}>IGST</th><th style={th()}>CGST</th><th style={th()}>SGST</th><th style={th()}>Total ITC</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const last = r === data?.totalEligible
                return (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)', background: last ? 'var(--bg-sidebar)' : 'transparent', fontWeight: last ? 700 : 400 }}>
                    <td style={td('left')}>{r.category}</td><td style={td()}>{r.invoices}</td><td style={td()}>{fmt(r.taxablePaise)}</td>
                    <td style={td()}>{fmt(r.igstPaise)}</td><td style={td()}>{fmt(r.cgstPaise)}</td><td style={td()}>{fmt(r.sgstPaise)}</td>
                    <td style={{ ...td(), fontWeight: 700, color: last ? 'var(--accent)' : 'var(--fg)' }}>{fmt(r.totalItcPaise)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
        <div style={{ marginTop: 14, fontSize: '0.82rem', color: 'var(--fg-muted)' }}>
          Reconcile with the portal GSTR-2B download before claiming ITC.
        </div>
      </div>

      {showPicker && <DateRangePicker initialFrom={from} initialTo={to} onApply={(f, t) => { setFrom(f); setTo(t); setShowPicker(false) }} onClose={() => setShowPicker(false)} />}
    </div>
  )
}
