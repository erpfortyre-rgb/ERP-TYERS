import { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'
import { GSTR3B, SaveCSVFile } from '../../wailsjs/go/main/App'
import DateRangePicker from '../components/DateRangePicker'

const today = () => new Date().toISOString().slice(0, 10)
const firstOfMonth = () => { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10) }
const fmt = (p: number) => '₹' + ((p || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })
const num = (p: number) => ((p || 0) / 100).toFixed(2)

const th = (align: 'left' | 'right' = 'right'): React.CSSProperties => ({ padding: '8px 10px', textAlign: align, fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '2px solid var(--border)', whiteSpace: 'nowrap' })
const td = (align: 'left' | 'right' = 'right'): React.CSSProperties => ({ padding: '8px 10px', textAlign: align, fontVariantNumeric: 'tabular-nums' })
const btn: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 6, cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }
const secTitle: React.CSSProperties = { fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--fg-muted)', margin: '20px 0 8px' }

export default function GSTR3BPage() {
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
    try { setData(await GSTR3B(from, to)) }
    catch (e: any) { toast.error(e?.message || 'Failed to load'); setData(null) }
  }, [from, to])
  useEffect(() => { load() }, [load])

  const outward: any[] = data?.outward || []
  const itc: any[] = data?.itc || []
  const taxPayable: any[] = data?.taxPayable || []
  const checks: any[] = data?.healthChecks || []

  const exportCSV = async () => {
    const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`
    const head = ['Description', 'Taxable', 'IGST', 'CGST', 'SGST', 'Total']
    const toRows = (a: any[]) => a.map(r => [r.description, num(r.taxablePaise), num(r.igstPaise), num(r.cgstPaise), num(r.sgstPaise), num(r.totalPaise)])
    const lines: string[][] = [
      ['GSTR-3B', `${from} to ${to}`],
      ['Output Tax', num(data?.outputTaxPaise)], ['ITC Available', num(data?.itcAvailablePaise)], ['Net Payable', num(data?.netPayablePaise)], [],
      ['3.1 Outward Supplies'], head, ...toRows(outward), [],
      ['Inward Supplies / ITC'], head, ...toRows(itc), [],
      ['Payment of Tax'], head, ...toRows(taxPayable),
    ]
    const csv = lines.map(r => r.map(esc).join(',')).join('\n')
    try { const p = await SaveCSVFile(csv, `GSTR3B_${from}_${to}.csv`); if (p) toast.success(`Saved: ${p}`) }
    catch (e: any) { toast.error(e?.message || 'Export failed') }
  }

  const cards = [
    { label: 'Output Tax', value: data?.outputTaxPaise, color: '#ef4444' },
    { label: 'ITC Available', value: data?.itcAvailablePaise, color: '#16a34a' },
    { label: 'Net Payable', value: data?.netPayablePaise, color: 'var(--accent)' },
    { label: 'Taxable Sales', value: outward[0]?.taxablePaise, color: '#0891b2' },
  ]

  const renderTable = (title: string, rows: any[]) => (
    <>
      <div style={secTitle}>{title}</div>
      {rows.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--fg-muted)', fontSize: '0.9rem' }}>No data for this period</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
          <thead>
            <tr style={{ background: 'var(--bg-sidebar)' }}>
              <th style={th('left')}>Description</th><th style={th()}>Taxable</th><th style={th()}>IGST</th>
              <th style={th()}>CGST</th><th style={th()}>SGST</th><th style={th()}>Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={td('left')}>{r.description}</td><td style={td()}>{fmt(r.taxablePaise)}</td>
                <td style={td()}>{fmt(r.igstPaise)}</td><td style={td()}>{fmt(r.cgstPaise)}</td>
                <td style={td()}>{fmt(r.sgstPaise)}</td><td style={{ ...td(), fontWeight: 600 }}>{fmt(r.totalPaise)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  )

  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column', gap: 0, padding: 0, height: '100%' }}>
      <div style={{ background: 'var(--accent)', color: '#fff', padding: '10px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <span style={{ fontWeight: 700, fontSize: '1rem' }}>GSTR-3B</span>
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
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {cards.map(c => (
            <div key={c.label} style={{ flex: '1 1 160px', background: 'var(--bg-card)', border: `1px solid ${c.color}33`, borderRadius: 8, padding: '10px 14px' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--fg-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{c.label}</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: c.color, marginTop: 2 }}>{fmt(c.value)}</div>
            </div>
          ))}
        </div>

        <div style={secTitle}>Accounting Health Check</div>
        {checks.length === 0 ? (
          <div style={{ color: 'var(--fg-muted)', fontSize: '0.85rem' }}>No data for this period</div>
        ) : (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {checks.map((c, i) => {
              const col = c.ok ? '#16a34a' : '#d97706'
              return (
                <div key={i} style={{ flex: '1 1 200px', background: col + '15', border: `1px solid ${col}55`, borderRadius: 8, padding: '8px 12px' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.82rem', color: col }}>{c.ok ? '✔' : '⚠'} {c.label}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--fg-muted)', marginTop: 2 }}>{c.detail}</div>
                </div>
              )
            })}
          </div>
        )}

        {renderTable('3.1 Outward Supplies', outward)}
        {renderTable('Inward Supplies / Input Tax Credit', itc)}
        {renderTable('Payment of Tax', taxPayable)}
      </div>

      {showPicker && <DateRangePicker initialFrom={from} initialTo={to} onApply={(f, t) => { setFrom(f); setTo(t); setShowPicker(false) }} onClose={() => setShowPicker(false)} />}
    </div>
  )
}
