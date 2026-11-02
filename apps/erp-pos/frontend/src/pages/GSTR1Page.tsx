import { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'
import { GSTR1Summary, SaveCSVFile } from '../../wailsjs/go/main/App'
import DateRangePicker from '../components/DateRangePicker'

const today = () => new Date().toISOString().slice(0, 10)
const firstOfMonth = () => { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10) }
const fmt = (p: number) => '₹' + ((p || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })
const num = (p: number) => ((p || 0) / 100).toFixed(2)

const th = (align: 'left' | 'right' = 'right'): React.CSSProperties => ({ padding: '8px 10px', textAlign: align, fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '2px solid var(--border)', whiteSpace: 'nowrap' })
const td = (align: 'left' | 'right' = 'right'): React.CSSProperties => ({ padding: '8px 10px', textAlign: align, fontVariantNumeric: 'tabular-nums' })
const btn: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 6, cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }

export default function GSTR1Page() {
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
    try { setData(await GSTR1Summary(from, to)) }
    catch (e: any) { toast.error(e?.message || 'Failed to load'); setData(null) }
  }, [from, to])
  useEffect(() => { load() }, [load])

  const sections: any[] = data?.sections || []
  const hsn: any[] = data?.hsn || []
  const taxOf = (s: any) => (s.igstPaise || 0) + (s.cgstPaise || 0) + (s.sgstPaise || 0)
  const sum = (k: string) => sections.reduce((a, s) => a + (s[k] || 0), 0)

  const exportCSV = async () => {
    const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`
    const lines: string[][] = [
      ['GSTR-1 Summary', `${from} to ${to}`], [],
      ['Particular', 'No. of Vouchers', 'Taxable Values', 'IGST', 'CGST', 'SGST', 'Cess', 'Tax Amount', 'Invoice Amount'],
      ...sections.map(s => [s.section, String(s.records), num(s.taxablePaise), num(s.igstPaise), num(s.cgstPaise), num(s.sgstPaise), '0.00', num(taxOf(s)), num(s.invoicePaise)]),
      ['Total', String(sum('records')), num(data?.totalTaxablePaise), num(sum('igstPaise')), num(sum('cgstPaise')), num(sum('sgstPaise')), '0.00', num(data?.totalTaxPaise), num(sum('invoicePaise'))],
      [], ['HSN/SAC Summary'],
      ['HSN/SAC', 'Description', 'Quantity', 'Taxable Value', 'Tax Amount', 'Total'],
      ...hsn.map(h => [h.hsnCode, h.description, String((h.qtyMillis || 0) / 1000), num(h.taxablePaise), num(h.taxPaise), num(h.totalPaise)]),
    ]
    const csv = lines.map(r => r.map(esc).join(',')).join('\n')
    try { const p = await SaveCSVFile(csv, `GSTR1_Summary_${from}_${to}.csv`); if (p) toast.success(`Saved: ${p}`) }
    catch (e: any) { toast.error(e?.message || 'Export failed') }
  }

  const empty = <div style={{ textAlign: 'center', padding: '28px 0', color: 'var(--fg-muted)', fontSize: '0.9rem' }}>No data for this period</div>

  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column', gap: 0, padding: 0, height: '100%' }}>
      <div style={{ background: 'var(--accent)', color: '#fff', padding: '10px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <span style={{ fontWeight: 700, fontSize: '1rem' }}>GSTR-1 Summary</span>
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
        <div style={{ fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--fg-muted)', marginBottom: 8 }}>GSTR-1 Summary</div>
        {sections.length === 0 ? empty : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: 'var(--bg-sidebar)' }}>
                <th style={th('left')}>Particular</th><th style={th()}>No. of Vouchers</th><th style={th()}>Taxable Values</th>
                <th style={th()}>IGST</th><th style={th()}>CGST</th><th style={th()}>SGST</th><th style={th()}>Cess</th>
                <th style={th()}>Tax Amount</th><th style={th()}>Invoice Amount</th>
              </tr>
            </thead>
            <tbody>
              {sections.map((s, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={td('left')}>{s.section}</td><td style={td()}>{s.records}</td><td style={td()}>{fmt(s.taxablePaise)}</td>
                  <td style={td()}>{fmt(s.igstPaise)}</td><td style={td()}>{fmt(s.cgstPaise)}</td><td style={td()}>{fmt(s.sgstPaise)}</td>
                  <td style={td()}>{fmt(0)}</td><td style={td()}>{fmt(taxOf(s))}</td><td style={{ ...td(), fontWeight: 600 }}>{fmt(s.invoicePaise)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: 'var(--bg-sidebar)', fontWeight: 700, borderTop: '2px solid var(--border)' }}>
                <td style={td('left')}>Total</td><td style={td()}>{sum('records')}</td><td style={td()}>{fmt(data?.totalTaxablePaise)}</td>
                <td style={td()}>{fmt(sum('igstPaise'))}</td><td style={td()}>{fmt(sum('cgstPaise'))}</td><td style={td()}>{fmt(sum('sgstPaise'))}</td>
                <td style={td()}>{fmt(0)}</td><td style={td()}>{fmt(data?.totalTaxPaise)}</td>
                <td style={{ ...td(), color: 'var(--accent)' }}>{fmt(sum('invoicePaise'))}</td>
              </tr>
            </tfoot>
          </table>
        )}

        <div style={{ fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--fg-muted)', margin: '24px 0 8px' }}>HSN/SAC Summary</div>
        {hsn.length === 0 ? empty : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: 'var(--bg-sidebar)' }}>
                <th style={th('left')}>HSN/SAC</th><th style={th('left')}>Description</th><th style={th()}>Quantity</th>
                <th style={th()}>Taxable Value</th><th style={th()}>Tax Amount</th><th style={th()}>Total</th>
              </tr>
            </thead>
            <tbody>
              {hsn.map((h, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={td('left')}>{h.hsnCode}</td><td style={td('left')}>{h.description}</td>
                  <td style={td()}>{((h.qtyMillis || 0) / 1000).toLocaleString('en-IN')}</td>
                  <td style={td()}>{fmt(h.taxablePaise)}</td><td style={td()}>{fmt(h.taxPaise)}</td><td style={{ ...td(), fontWeight: 600 }}>{fmt(h.totalPaise)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showPicker && <DateRangePicker initialFrom={from} initialTo={to} onApply={(f, t) => { setFrom(f); setTo(t); setShowPicker(false) }} onClose={() => setShowPicker(false)} />}
    </div>
  )
}
