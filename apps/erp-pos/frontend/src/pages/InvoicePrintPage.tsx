import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { FiPrinter, FiArrowLeft } from 'react-icons/fi'
import { GetInvoicePrintData, GetSettings } from '../../wailsjs/go/main/App'
import InvoiceTemplate, { InvoiceData, InvoiceTheme } from '../components/InvoiceTemplate'

const THEME_KEY = 'sst_invoice_theme'
const THEME_OPTIONS: { value: InvoiceTheme; label: string }[] = [
  { value: 'a4', label: 'GST Tax Invoice (A4)' },
  { value: 'thermal80', label: 'Thermal 80mm' },
  { value: 'thermal58', label: 'Thermal 58mm' },
]
function loadTheme(): InvoiceTheme {
  try {
    const t = localStorage.getItem(THEME_KEY)
    if (t === 'a4' || t === 'thermal80' || t === 'thermal58') return t
  } catch { /* ignore */ }
  return 'a4'
}

// Maps the backend InvoicePrintData (paise/millis) into the InvoiceTemplate's
// rupee-based InvoiceData props.
// Stored invoice times are UTC ("YYYY-MM-DD HH:MM:SS"); show them in local time.
function localDateTime(s: string): string {
  if (!s) return ''
  const d = new Date(s.replace(' ', 'T') + (s.endsWith('Z') ? '' : 'Z'))
  if (isNaN(d.getTime())) return s
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function toInvoiceData(d: any, terms: string[], logo?: string, stamp?: string): InvoiceData {
  const r = (p: number) => (p || 0) / 100
  return {
    firmName: d.firmName || 'Shiv Shankar Tyres',
    firmGstin: d.firmGstin || '',
    firmAddress: d.firmAddress || '',
    firmPhone: d.firmPhone || '',
    firmEmail: d.firmEmail || '',
    firmStateCode: d.firmStateCode || '',
    logoDataUrl: logo || undefined,
    stampDataUrl: stamp || undefined,
    billToName: d.billToName || 'Walk-in Customer',
    billToAddress: d.billToAddress || '',
    billToGstin: d.billToGstin || '',
    billToPhone: d.billToPhone || '',
    invoiceNo: d.invoiceNo || '',
    date: localDateTime(d.date || ''),
    placeOfSupply: d.placeOfSupply || '',
    reverseCharge: !!d.reverseCharge,
    items: (d.items || []).map((it: any) => ({
      name: it.name,
      hsn: it.hsn,
      mrp: r(it.mrpPaise),
      qty: (it.qtyMillis || 0) / 1000,
      unit: '',
      pricePerUnit: r(it.unitPricePaise),
      gstRate: it.gstRate,
      gstAmount: r(it.gstPaise),
      amount: r(it.amountPaise),
    })),
    amountInWords: d.amountInWords || '',
    paymentMode: d.paymentMode || '',
    terms,
    subTotal: r(d.subtotalPaise),
    isInterState: !!d.isInterState,
    igst: r(d.igstPaise),
    cgst: r(d.cgstPaise),
    sgst: r(d.sgstPaise),
    total: r(d.totalPaise),
    received: r(d.receivedPaise),
    balance: r(d.balancePaise),
    hsnSummary: (d.hsnSummary || []).map((h: any) => ({
      hsn: h.hsn, taxable: r(h.taxablePaise), rate: h.rate, taxAmount: r(h.taxPaise),
    })),
  }
}

export default function InvoicePrintPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [data, setData] = useState<InvoiceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [theme, setTheme] = useState<InvoiceTheme>(loadTheme)

  const changeTheme = (t: InvoiceTheme) => {
    setTheme(t)
    try { localStorage.setItem(THEME_KEY, t) } catch { /* ignore */ }
  }

  const load = useCallback(async () => {
    if (!id) return
    try {
      const [d, settings] = await Promise.all([GetInvoicePrintData(id), GetSettings().catch(() => ({} as any))])
      // Prefer this invoice's own terms; fall back to the global Settings terms.
      const invTerms = (d && (d as any).terms && String((d as any).terms).trim()) ? String((d as any).terms) : ''
      const termsRaw = invTerms || (settings && (settings as any).terms_conditions) || '1. Goods once sold will not be taken back.\n2. Subject to local jurisdiction.'
      // Strip any leading "1." / "2)" so the template's own numbering isn't doubled.
      const terms = String(termsRaw).split('\n').map(s => s.trim().replace(/^\d+[.)]\s*/, '')).filter(Boolean)
      const logo = (settings && (settings as any).firm_logo) || ''
      const stamp = (settings && (settings as any).firm_stamp) || ''
      setData(toInvoiceData(d, terms, logo, stamp))
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load invoice')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  const handlePrint = () => {
    // WebView2's window.print() is unreliable; attempt it and fall back to a hint.
    try { window.print() } catch { /* ignore */ }
  }

  return (
    <div className="page" style={{ padding: 0, height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Print rules: hide the toolbar/chrome and print only the selected invoice. */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          #invoice-print-area { padding: 0 !important; background: #fff !important; }
        }
      `}</style>
      {/* Toolbar (hidden when printing) */}
      <div className="no-print" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <button onClick={() => navigate(-1)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: 'var(--bg-input)', color: 'var(--fg)', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>
          <FiArrowLeft size={14} /> Back
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontWeight: 700, color: 'var(--fg-bright)' }}>Tax Invoice {data?.invoiceNo ? '#' + data.invoiceNo : ''}</span>
          <select
            value={theme}
            onChange={(e) => changeTheme(e.target.value as InvoiceTheme)}
            title="Invoice layout"
            style={{ padding: '6px 10px', background: 'var(--bg-input)', color: 'var(--fg)', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}
          >
            {THEME_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <button onClick={handlePrint} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: '0.85rem', fontWeight: 700 }}>
          <FiPrinter size={14} /> Print
        </button>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 20, background: '#f1f5f9', display: 'flex', justifyContent: 'center' }}>
        {loading ? (
          <div style={{ color: 'var(--fg-muted)', padding: 40 }}>Loading invoice…</div>
        ) : data ? (
          <div id="invoice-print-area">
            <InvoiceTemplate data={data} theme={theme} />
          </div>
        ) : (
          <div style={{ color: 'var(--fg-muted)', padding: 40 }}>Invoice not found.</div>
        )}
      </div>
    </div>
  )
}
