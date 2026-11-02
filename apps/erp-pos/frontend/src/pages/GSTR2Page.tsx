import { useEffect, useState, useCallback, useMemo } from 'react'
import toast from 'react-hot-toast'
import { FiDownload, FiCalendar } from 'react-icons/fi'
import { GSTR2, SaveCSVFile } from '../../wailsjs/go/main/App'
import DateRangePicker from '../components/DateRangePicker'

interface Row {
  gstin: string; invoiceNo: string; date: string
  taxablePaise: number; cgstPaise: number; sgstPaise: number; igstPaise: number; totalPaise: number
}

const today = () => new Date().toISOString().slice(0, 10)
const firstOfMonth = () => { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10) }
const fmt = (p: number) => (p / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const thBase: React.CSSProperties = { padding: '8px 10px', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '2px solid var(--border)' }

export default function GSTR2Page() {
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
    try { setRows((await GSTR2(from, to)) || []) }
    catch (e: any) { toast.error(e?.message || 'Failed to load') }
  }, [from, to])
  useEffect(() => { load() }, [load])

  const tot = useMemo(() => rows.reduce((a, r) => ({
    taxable: a.taxable + r.taxablePaise, igst: a.igst + r.igstPaise, cgst: a.cgst + r.cgstPaise,
    sgst: a.sgst + r.sgstPaise, total: a.total + r.totalPaise,
  }), { taxable: 0, igst: 0, cgst: 0, sgst: 0, total: 0 }), [rows])
  const itc = tot.igst + tot.cgst + tot.sgst

  const exportCSV = async () => {
    if (rows.length === 0) { toast.error('No data to export'); return }
    const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`
    const headers = ['#', 'Date', 'Voucher/Bill No', 'Supplier GSTIN', 'Taxable', 'IGST', 'CGST', 'SGST', 'Total']
    const body = rows.map((r, i) => [String(i + 1), r.date, r.invoiceNo, r.gstin || '', (r.taxablePaise / 100).toFixed(2), (r.igstPaise / 100).toFixed(2), (r.cgstPaise / 100).toFixed(2), (r.sgstPaise / 100).toFixed(2), (r.totalPaise / 100).toFixed(2)])
    body.push(['', '', 'Total', '', (tot.taxable / 100).toFixed(2), (tot.igst / 100).toFixed(2), (tot.cgst / 100).toFixed(2), (tot.sgst / 100).toFixed(2), (tot.total / 100).toFixed(2)])
    const csv = [headers, ...body].map(r => r.map(esc).join(',')).join('\n')
    try {
      const path = await SaveCSVFile(csv, `GSTR2_${from}_to_${to}.csv`)
      if (path) toast.success(`Saved: ${path}`)
    } catch (e: any) { toast.error(e?.message || 'Export failed') }
  }

  const cards = [
    { label: 'Total Taxable', value: tot.taxable, color: 'var(--accent)' },
    { label: 'Total ITC (IGST + CGST + SGST)', value: itc, color: '#16a34a' },
  ]

  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column', gap: 0, padding: 0, height: '100%' }}>
      <div style={{ background: 'var(--accent)', color: '#fff', padding: '10px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <span style={{ fontWeight: 700, fontSize: '1rem' }}>GSTR-2 / 2A — Purchase Register (ITC)</span>
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

      <div style={{ display: 'flex', gap: 12, padding: '12px 20px', flexShrink: 0, flexWrap: 'wrap' }}>
        {cards.map(c => (
          <div key={c.label} style={{ flex: '1 1 200px', background: 'var(--bg-card)', border: `1px solid ${c.color}33`, borderRadius: 8, padding: '10px 14px' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--fg-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{c.label}</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: c.color, marginTop: 2 }}>₹{fmt(c.value)}</div>
          </div>
        ))}
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '0 20px 16px', scrollbarGutter: 'stable' }}>
        {rows.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--fg-muted)', fontSize: '0.9rem' }}>No data for this period.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: 'var(--bg-sidebar)', position: 'sticky', top: 0, zIndex: 1 }}>
                <th style={{ ...thBase, textAlign: 'left', width: 40 }}>#</th>
                <th style={{ ...thBase, textAlign: 'left', width: 100 }}>Date</th>
                <th style={{ ...thBase, textAlign: 'left' }}>Voucher/Bill No</th>
                <th style={{ ...thBase, textAlign: 'left' }}>Supplier GSTIN</th>
                <th style={{ ...thBase, textAlign: 'right' }}>Taxable</th>
                <th style={{ ...thBase, textAlign: 'right' }}>IGST</th>
                <th style={{ ...thBase, textAlign: 'right' }}>CGST</th>
                <th style={{ ...thBase, textAlign: 'right' }}>SGST</th>
                <th style={{ ...thBase, textAlign: 'right' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}
                  onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = 'var(--bg-card)'}
                  onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'}>
                  <td style={{ padding: '8px 10px', color: 'var(--fg-muted)', fontSize: '0.78rem' }}>{i + 1}</td>
                  <td style={{ padding: '8px 10px', fontVariantNumeric: 'tabular-nums', fontSize: '0.82rem' }}>{r.date}</td>
                  <td style={{ padding: '8px 10px' }}>{r.invoiceNo}</td>
                  <td style={{ padding: '8px 10px', color: r.gstin ? 'var(--fg)' : 'var(--fg-muted)' }}>{r.gstin || '—'}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmt(r.taxablePaise)}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmt(r.igstPaise)}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmt(r.cgstPaise)}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmt(r.sgstPaise)}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmt(r.totalPaise)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: 'var(--bg-sidebar)', fontWeight: 700, borderTop: '2px solid var(--border)' }}>
                <td colSpan={4} style={{ padding: '9px 10px', textAlign: 'right', color: 'var(--fg-muted)' }}>Total ({rows.length} invoices) :</td>
                <td style={{ padding: '9px 10px', textAlign: 'right' }}>₹{fmt(tot.taxable)}</td>
                <td style={{ padding: '9px 10px', textAlign: 'right' }}>₹{fmt(tot.igst)}</td>
                <td style={{ padding: '9px 10px', textAlign: 'right' }}>₹{fmt(tot.cgst)}</td>
                <td style={{ padding: '9px 10px', textAlign: 'right' }}>₹{fmt(tot.sgst)}</td>
                <td style={{ padding: '9px 10px', textAlign: 'right', color: 'var(--accent)' }}>₹{fmt(tot.total)}</td>
              </tr>
            </tfoot>
          </table>
        )}
        <div style={{ marginTop: 14, fontSize: '0.78rem', color: 'var(--fg-muted)' }}>Note: Reconcile with supplier GSTR-1 on the portal.</div>
      </div>

      {showPicker && (
        <DateRangePicker initialFrom={from} initialTo={to}
          onApply={(f, t) => { setFrom(f); setTo(t); setShowPicker(false) }}
          onClose={() => setShowPicker(false)} />
      )}
    </div>
  )
}
