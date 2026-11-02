import { useState } from 'react'
import toast from 'react-hot-toast'
import { FiUploadCloud, FiDownload, FiCheckCircle, FiAlertTriangle } from 'react-icons/fi'
import { ImportCustomersCSV, SaveCSVFile } from '../../wailsjs/go/main/App'

interface ImportResult { imported: number; errors: string[] }

const COLUMNS = ['Name', 'Business Name', 'Phone', 'Email', 'GSTIN', 'Address', 'City', 'State Code', 'Opening Balance (₹)', 'Credit Limit (₹)', 'Pay Term (days)']

export default function ImportPartiesPage() {
  const [result, setResult] = useState<ImportResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [fileName, setFileName] = useState('')

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFileName(f.name)
    setBusy(true)
    const reader = new FileReader()
    reader.onload = async () => {
      try {
        const text = String(reader.result || '')
        const res = (await ImportCustomersCSV(text)) as any as ImportResult
        setResult(res)
        if (res.imported > 0) toast.success(`${res.imported} customers imported`)
        if (res.errors?.length) toast.error(`${res.errors.length} rows had errors`)
      } catch (err: any) {
        toast.error(err?.message || 'Import failed')
      } finally {
        setBusy(false)
      }
    }
    reader.onerror = () => { toast.error('Could not read file'); setBusy(false) }
    reader.readAsText(f)
    e.target.value = ''
  }

  const downloadTemplate = async () => {
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`
    const header = COLUMNS.map(esc).join(',')
    const example = ['Ramesh Traders', 'Ramesh Traders', '9876543210', 'ramesh@example.com', '36ABCDE1234F1Z5', '12 Market Rd', 'Mancherial', '36', '0', '50000', '15'].map(esc).join(',')
    try {
      const path = await SaveCSVFile(header + '\n' + example + '\n', 'Customers_Import_Template.csv')
      if (path) toast.success('Template saved: ' + path)
    } catch (e: any) { toast.error(e?.message || 'Could not save template') }
  }

  return (
    <div className="page">
      <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--fg-bright)', marginBottom: 2 }}>Import Parties</h2>
      <div style={{ fontSize: '0.78rem', color: 'var(--fg-muted)', marginBottom: 16 }}>Bulk-add customers from a CSV file.</div>

      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 18 }}>
        <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '28px 36px', border: '2px dashed var(--accent)', borderRadius: 10, background: 'var(--accent)10', cursor: busy ? 'wait' : 'pointer', minWidth: 260 }}>
          <FiUploadCloud size={28} color="var(--accent)" />
          <span style={{ fontWeight: 700, color: 'var(--accent)' }}>{busy ? 'Importing…' : 'Choose CSV file'}</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--fg-muted)' }}>{fileName || 'Click to select a .csv'}</span>
          <input type="file" accept=".csv,text/csv" onChange={onFile} disabled={busy} style={{ display: 'none' }} />
        </label>

        <button onClick={downloadTemplate} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '12px 18px', alignSelf: 'flex-start', background: 'var(--bg-card)', color: 'var(--fg)', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>
          <FiDownload size={15} /> Download template
        </button>
      </div>

      {/* Column reference */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 16px', marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: '0.8rem', marginBottom: 8, color: 'var(--fg-bright)' }}>CSV column order</div>
        <div style={{ fontSize: '0.8rem', color: 'var(--fg-muted)', lineHeight: 1.8 }}>
          {COLUMNS.map((c, i) => (
            <span key={c} style={{ display: 'inline-block', marginRight: 8 }}>
              <span style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 4, padding: '1px 7px', fontWeight: 600 }}>{i + 1}. {c}</span>
            </span>
          ))}
          <div style={{ marginTop: 6 }}>Only <strong>Name</strong> is required. A header row is optional (skipped if the first cell is "name").</div>
        </div>
      </div>

      {/* Result */}
      {result && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, color: '#16a34a', marginBottom: result.errors?.length ? 10 : 0 }}>
            <FiCheckCircle size={16} /> {result.imported} customers imported successfully
          </div>
          {result.errors?.length > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, color: '#d97706', margin: '4px 0 6px' }}>
                <FiAlertTriangle size={15} /> {result.errors.length} rows had errors:
              </div>
              <div style={{ maxHeight: 220, overflow: 'auto', fontSize: '0.8rem', color: 'var(--fg-muted)', fontFamily: 'monospace' }}>
                {result.errors.map((e, i) => <div key={i}>{e}</div>)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
