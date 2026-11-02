import { useEffect, useState, useCallback } from 'react'
import toast from 'react-hot-toast'
import { GetFirmProfile, SaveFirmProfile, GetSettings, SaveSetting, GetInvoiceScheme, SaveInvoiceScheme } from '../../wailsjs/go/main/App'
import HistoryPickerField from '../components/HistoryPickerField'

interface Firm { name: string; gstin: string; address: string; phone: string; email: string }

const DEFAULT_FIRM: Firm = { name: '', gstin: '', address: '', phone: '', email: '' }

const DEFAULTS: Record<string, string> = {
  gst_scheme: 'REGULAR',
  state_code: '',
  upi_id: '',
  payee_name: '',
  print_upi_qr: '1',
  bank_name: '',
  account_holder: '',
  account_number: '',
  ifsc: '',
  invoice_layout: 'GST Tax Invoice',
  invoice_theme: 'GST Theme (A4)',
  invoice_copies: 'Original only',
  show_mrp: '1',
  show_you_saved: '0',
  show_hsn_summary: '1',
  show_authorized_signatory: '1',
  terms_conditions: '',
  whatsapp_number: '',
  invoice_share_message: '',
  payment_reminder_message: '',
}

const SETTING_KEYS = Object.keys(DEFAULTS)

const inputStyle: React.CSSProperties = {
  padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 4,
  background: 'var(--bg-input)', color: 'var(--fg)', fontSize: '0.85rem', width: '100%', boxSizing: 'border-box',
  fontFamily: 'inherit',
}

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 16, background: 'var(--bg-card)' }}>
    <h3 style={{ margin: '0 0 12px 0', fontSize: '0.95rem', color: 'var(--accent)', borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>{title}</h3>
    {children}
  </div>
)

const Grid = ({ children }: { children: React.ReactNode }) => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>{children}</div>
)

const Label = ({ text, hint }: { text: string; hint?: string }) => (
  <div style={{ marginBottom: 4 }}>
    <span style={{ color: 'var(--fg-muted)', fontSize: '0.8rem', fontWeight: 600 }}>{text}</span>
    {hint && <span style={{ color: 'var(--fg-muted)', fontSize: '0.72rem', marginLeft: 6 }}>({hint})</span>}
  </div>
)

const TextField = ({ label, value, onChange, placeholder, hint }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; hint?: string }) => (
  <div>
    <Label text={label} hint={hint} />
    <input type="text" value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)} style={inputStyle} />
  </div>
)

const TextArea = ({ label, value, onChange, placeholder, hint, rows = 3 }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; hint?: string; rows?: number }) => (
  <div style={{ gridColumn: '1 / -1' }}>
    <Label text={label} />
    <textarea value={value} rows={rows} placeholder={placeholder} onChange={e => onChange(e.target.value)} style={{ ...inputStyle, resize: 'vertical' }} />
    {hint && <div style={{ fontSize: '0.72rem', color: 'var(--fg-muted)', marginTop: 4 }}>Placeholders: <code>{hint}</code></div>}
  </div>
)

const Select = ({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) => (
  <div>
    <Label text={label} />
    <select value={value} onChange={e => onChange(e.target.value)} style={inputStyle}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  </div>
)

const Toggle = ({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) => (
  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', color: 'var(--fg)', cursor: 'pointer', padding: '6px 0' }}>
    <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} style={{ width: 16, height: 16, accentColor: 'var(--accent)', cursor: 'pointer' }} />
    {label}
  </label>
)

// Firm branding (Point 4c) — logo + stamp/signature, stored as base64 data URLs
// in the per-company settings table and printed on the GST invoice.
function FirmBrandingSection() {
  const [logo, setLogo] = useState('')
  const [stamp, setStamp] = useState('')

  useEffect(() => {
    GetSettings().then((s: any) => { if (s) { setLogo(s.firm_logo || ''); setStamp(s.firm_stamp || '') } }).catch(() => {})
  }, [])

  const pick = (key: 'firm_logo' | 'firm_stamp', setter: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) { toast.error('Please choose an image file'); return }
    if (file.size > 800 * 1024) { toast.error('Image too large — keep under 800 KB'); return }
    const reader = new FileReader()
    reader.onload = () => {
      const data = String(reader.result || '')
      setter(data)
      SaveSetting(key, data).then(() => toast.success('Saved')).catch((err: any) => toast.error(String(err?.message || err)))
    }
    reader.readAsDataURL(file)
  }
  const clear = (key: 'firm_logo' | 'firm_stamp', setter: (v: string) => void) => () => { setter(''); SaveSetting(key, '').then(() => toast.success('Removed')).catch(() => {}) }

  const box: React.CSSProperties = { border: '1px dashed var(--border)', borderRadius: 8, padding: 14, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, background: 'var(--bg-input)' }
  const previewWrap: React.CSSProperties = { height: 90, display: 'flex', alignItems: 'center', justifyContent: 'center' }

  const uploader = (label: string, hint: string, value: string, key: 'firm_logo' | 'firm_stamp', setter: (v: string) => void) => (
    <div>
      <Label text={label} hint={hint} />
      <div style={box}>
        <div style={previewWrap}>
          {value
            ? <img src={value} alt={label} style={{ maxHeight: 88, maxWidth: '100%', objectFit: 'contain' }} />
            : <span style={{ color: 'var(--fg-muted)', fontSize: '0.8rem' }}>No {label.toLowerCase()} yet</span>}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <label style={{ padding: '6px 12px', background: 'var(--accent)', color: '#fff', borderRadius: 6, cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700 }}>
            {value ? 'Change' : 'Upload'}
            <input type="file" accept="image/*" onChange={pick(key, setter)} style={{ display: 'none' }} />
          </label>
          {value && <button onClick={clear(key, setter)} style={{ padding: '6px 12px', background: 'var(--bg-card)', color: '#ef4444', border: '1px solid #ef444455', borderRadius: 6, cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>Remove</button>}
        </div>
      </div>
    </div>
  )

  return (
    <Section title="Logo & Stamp (printed on invoice)">
      <Grid>
        {uploader('Firm Logo', 'top of the bill', logo, 'firm_logo', setLogo)}
        {uploader('Stamp / Signature', 'near Authorized Signatory', stamp, 'firm_stamp', setStamp)}
      </Grid>
      <p style={{ margin: '10px 0 0', fontSize: '0.74rem', color: 'var(--fg-muted)' }}>
        PNG/JPG, under 800 KB. Logo shows in the invoice header; stamp shows above the Authorized Signatory line.
      </p>
    </Section>
  )
}

// Invoice numbering (Point 15a) — edit prefix + next running number for the
// active company. Format PREFIX-YY-NNNNNN is fixed in the billing engine.
function InvoiceSchemeSection() {
  const [prefix, setPrefix] = useState('')
  const [nextSeq, setNextSeq] = useState(1)
  const [format, setFormat] = useState('year') // 'year' | 'simple'
  const [saving, setSaving] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    GetInvoiceScheme().then((s: any) => { if (s) { setPrefix(s.prefix || ''); setNextSeq(s.nextSeq || 1) } setLoaded(true) }).catch(() => setLoaded(true))
    GetSettings().then((s: any) => { if (s && s.invoice_number_format) setFormat(s.invoice_number_format) }).catch(() => {})
  }, [])

  const yy = String(new Date().getFullYear()).slice(-2)
  const sample = format === 'simple'
    ? `${prefix || 'SSTM'}/${nextSeq || 1}`
    : `${prefix || 'SST-1'}-${yy}-${String(nextSeq || 1).padStart(6, '0')}`

  const save = async () => {
    if (!prefix.trim()) { toast.error('Invoice prefix is required'); return }
    setSaving(true)
    try {
      await SaveInvoiceScheme(prefix.trim(), Math.max(1, Math.floor(nextSeq || 1)))
      await SaveSetting('invoice_number_format', format)
      toast.success('Invoice numbering saved')
    }
    catch (e: any) { toast.error(String(e?.message || e)) }
    finally { setSaving(false) }
  }

  return (
    <Section title="Invoice Numbering (Scheme)">
      <Grid>
        <TextField label="Invoice Prefix" value={prefix} onChange={setPrefix} placeholder="e.g. SST-1 or SSTM" />
        <div>
          <Label text="Next Invoice Number" hint="running number" />
          <input type="number" min={1} style={inputStyle} value={nextSeq}
            onChange={e => setNextSeq(parseInt(e.target.value || '1', 10))} />
        </div>
        <div>
          <Label text="Number Format" />
          <select style={inputStyle} value={format} onChange={e => setFormat(e.target.value)}>
            <option value="year">With year — PREFIX-YY-000001</option>
            <option value="simple">Simple (OS-Books style) — PREFIX/n</option>
          </select>
        </div>
      </Grid>
      <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ fontSize: '0.8rem', color: 'var(--fg-muted)' }}>
          Next bill will be: <strong style={{ color: 'var(--fg)', fontFamily: 'monospace', fontSize: '0.92rem' }}>{sample}</strong>
        </div>
        <button onClick={save} disabled={saving || !loaded}
          style={{ padding: '7px 16px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 700, fontSize: '0.84rem' }}>
          {saving ? 'Saving…' : 'Save Numbering'}
        </button>
      </div>
      <p style={{ margin: '10px 0 0', fontSize: '0.74rem', color: 'var(--fg-muted)' }}>
        The system never reuses a number already taken, so a gap is kept rather than duplicating. Changing format only affects new bills.
      </p>
    </Section>
  )
}

export default function SettingsPage() {
  const [firm, setFirm] = useState<Firm>(DEFAULT_FIRM)
  const [s, setS] = useState<Record<string, string>>(DEFAULTS)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      const [f, st] = await Promise.all([GetFirmProfile() as any, GetSettings() as any])
      if (f) setFirm({ ...DEFAULT_FIRM, ...f })
      const merged: Record<string, string> = { ...DEFAULTS }
      if (st) for (const k of SETTING_KEYS) { if (st[k] !== undefined && st[k] !== null) merged[k] = String(st[k]) }
      setS(merged)
    } catch (e: any) { console.error(e); toast.error(e?.message || 'Failed to load settings') }
  }, [])

  useEffect(() => { load() }, [load])

  const set = (k: string, v: string) => setS(p => ({ ...p, [k]: v }))
  const on = (k: string) => s[k] === '1'
  const setBool = (k: string, v: boolean) => set(k, v ? '1' : '0')
  const setF = (k: keyof Firm, v: string) => setFirm(p => ({ ...p, [k]: v }))

  const save = async () => {
    setSaving(true)
    try {
      await SaveFirmProfile(firm as any)
      for (const k of SETTING_KEYS) await SaveSetting(k, s[k] ?? '')
      toast.success('Settings saved')
    } catch (e: any) {
      console.error(e); toast.error(e?.message || 'Failed to save settings')
    } finally { setSaving(false) }
  }

  return (
    <div className="page">
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--fg-bright)', marginBottom: 2 }}>GST, UPI &amp; Print Settings</h2>
        <div style={{ fontSize: '0.78rem', color: 'var(--fg-muted)' }}>Business details, taxes, payment info and invoice printing preferences.</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Section title="Business / Firm">
          <Grid>
            <TextField label="Firm Name" value={firm.name} onChange={v => setF('name', v)} placeholder="Shiv Shankar Tyres" />
            <TextField label="GSTIN" value={firm.gstin} onChange={v => setF('gstin', v.toUpperCase())} placeholder="36XXXXX0000X1ZX" hint="used for GST tax calc & invoices" />
            <TextField label="Phone" value={firm.phone} onChange={v => setF('phone', v)} placeholder="9999999999" />
            <TextField label="Email" value={firm.email} onChange={v => setF('email', v)} placeholder="info@example.com" />
            <TextArea label="Address" value={firm.address} onChange={v => setF('address', v)} placeholder="Shop No, Street, City, State, Pincode" rows={2} />
          </Grid>
        </Section>

        <Section title="Taxes & GST">
          <Grid>
            <Select label="GST Scheme" value={s.gst_scheme} onChange={v => set('gst_scheme', v)} options={[
              { value: 'REGULAR', label: 'Regular – print "Tax Invoice"' },
              { value: 'COMPOSITION', label: 'Composition – Bill of Supply' },
            ]} />
            <TextField label="State Code" value={s.state_code} onChange={v => set('state_code', v)} placeholder="36-Telangana" />
          </Grid>
          <div style={{ fontSize: '0.75rem', color: 'var(--fg-muted)', marginTop: 10 }}>
            CGST+SGST within your state, IGST for other states. GST 2.0 slabs: 0/0.25/3/5/18/40%.
          </div>
        </Section>

        <InvoiceSchemeSection />

        <FirmBrandingSection />

        <Section title="UPI & Bank (shown on invoice)">
          <Grid>
            <TextField label="UPI ID" value={s.upi_id} onChange={v => set('upi_id', v)} placeholder="shop@upi" />
            <TextField label="Payee Name" value={s.payee_name} onChange={v => set('payee_name', v)} placeholder="Shiv Shankar Tyres" />
            <div style={{ gridColumn: '1 / -1' }}>
              <Toggle label="Print Scan & Pay UPI QR with exact bill amount" checked={on('print_upi_qr')} onChange={v => setBool('print_upi_qr', v)} />
            </div>
            <TextField label="Bank Name & Branch" value={s.bank_name} onChange={v => set('bank_name', v)} placeholder="State Bank of India, Mancherial" />
            <TextField label="Account Holder" value={s.account_holder} onChange={v => set('account_holder', v)} />
            <TextField label="Account Number" value={s.account_number} onChange={v => set('account_number', v)} />
            <TextField label="IFSC" value={s.ifsc} onChange={v => set('ifsc', v.toUpperCase())} placeholder="SBIN0000001" />
          </Grid>
        </Section>

        <Section title="Print / Invoice">
          <Grid>
            <Select label="Invoice Layout" value={s.invoice_layout} onChange={v => set('invoice_layout', v)} options={[
              { value: 'GST Tax Invoice', label: 'GST Tax Invoice' },
            ]} />
            <Select label="Theme" value={s.invoice_theme} onChange={v => set('invoice_theme', v)} options={[
              { value: 'GST Theme (A4)', label: 'GST Theme (A4)' },
              { value: 'Thermal 80mm', label: 'Thermal 80mm' },
              { value: 'Thermal 58mm', label: 'Thermal 58mm' },
              { value: 'Tally (A4)', label: 'Tally (A4)' },
            ]} />
            <Select label="Copies" value={s.invoice_copies} onChange={v => set('invoice_copies', v)} options={[
              { value: 'Original only', label: 'Original only' },
              { value: 'Original + Duplicate', label: 'Original + Duplicate' },
            ]} />
          </Grid>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 0, marginTop: 10 }}>
            <Toggle label="Show MRP column" checked={on('show_mrp')} onChange={v => setBool('show_mrp', v)} />
            <Toggle label='Show "You Saved"' checked={on('show_you_saved')} onChange={v => setBool('show_you_saved', v)} />
            <Toggle label="Show HSN-wise tax summary" checked={on('show_hsn_summary')} onChange={v => setBool('show_hsn_summary', v)} />
            <Toggle label='Show "Authorized Signatory" box' checked={on('show_authorized_signatory')} onChange={v => setBool('show_authorized_signatory', v)} />
          </div>
          <div style={{ marginTop: 10 }}>
            <HistoryPickerField kind="terms" label="Terms & Conditions" value={s.terms_conditions} onChange={v => set('terms_conditions', v)} rows={4}
              placeholder="Type, or press F4 to pick from saved terms…" />
          </div>
        </Section>

        <Section title="WhatsApp Messages">
          <Grid>
            <TextField label="Business WhatsApp Number" value={s.whatsapp_number} onChange={v => set('whatsapp_number', v)} placeholder="919999999999" />
            <TextArea label="Invoice Share Message" value={s.invoice_share_message} onChange={v => set('invoice_share_message', v)}
              placeholder="Hello {name}, thank you for shopping at {business}. Invoice {invoice_no} dated {date}: {amount}. {upi_line}"
              hint="{name} {business} {invoice_no} {amount} {balance} {date} {invoice_link} {upi_line}" />
            <TextArea label="Payment Reminder Message" value={s.payment_reminder_message} onChange={v => set('payment_reminder_message', v)}
              placeholder="Dear {name}, a payment of {due} is pending at {business}. Pay here: {upi_link}. Call {phone}."
              hint="{name} {business} {due} {upi_link} {phone}" />
          </Grid>
        </Section>

        <div style={{ textAlign: 'right', paddingBottom: 16 }}>
          <button onClick={save} disabled={saving}
            style={{ padding: '8px 24px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 4, cursor: saving ? 'default' : 'pointer', fontWeight: 600, opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  )
}
