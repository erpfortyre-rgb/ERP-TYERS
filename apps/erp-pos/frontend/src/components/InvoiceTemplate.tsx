import type { CSSProperties } from 'react'

export interface InvoiceItem {
  name: string
  warranty?: string
  hsn: string
  mrp: number
  qty: number
  unit?: string
  pricePerUnit: number
  gstRate: number
  gstAmount: number
  amount: number
}
export interface InvoiceHsnSummary { hsn: string; taxable: number; rate: number; taxAmount: number }
export interface InvoiceData {
  firmName: string
  firmGstin?: string
  firmAddress: string
  firmPhone: string
  firmEmail: string
  firmStateCode: string
  logoDataUrl?: string
  stampDataUrl?: string
  billToName: string
  billToAddress?: string
  billToGstin?: string
  billToPhone?: string
  invoiceNo: string
  date: string
  placeOfSupply: string
  reverseCharge?: boolean
  items: InvoiceItem[]
  amountInWords: string
  paymentMode?: string
  terms?: string[]
  subTotal: number
  isInterState: boolean
  igst?: number
  cgst?: number
  sgst?: number
  total: number
  received?: number
  balance?: number
  hsnSummary: InvoiceHsnSummary[]
}
export type InvoiceTheme = 'a4' | 'thermal80' | 'thermal58'
export interface InvoiceTemplateProps { data: InvoiceData; theme?: InvoiceTheme }

const ACCENT = '#3730a3'
const BORDER = '1px solid #d1d5db'
const HEAD_BG = '#eef2ff'
const TEXT = '#111827'
const MUTED = '#6b7280'

const money = (n: number | undefined) =>
  '₹' + (n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const num = (n: number) =>
  n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const table: CSSProperties = { width: '100%', borderCollapse: 'collapse', tableLayout: 'auto' }
const th: CSSProperties = {
  border: BORDER, background: HEAD_BG, color: ACCENT, padding: '6px 6px',
  fontSize: 11, fontWeight: 700, textAlign: 'left',
}
const td: CSSProperties = { border: BORDER, padding: '6px 6px', fontSize: 12, verticalAlign: 'top', color: TEXT }
const right: CSSProperties = { textAlign: 'right' }
const boxTitle: CSSProperties = {
  background: HEAD_BG, color: ACCENT, fontSize: 11, fontWeight: 700, padding: '5px 8px',
  borderBottom: BORDER, letterSpacing: 0.5,
}
const boxBody: CSSProperties = { padding: '6px 8px', fontSize: 12, color: TEXT, lineHeight: 1.5 }

export default function InvoiceTemplate({ data, theme = 'a4' }: InvoiceTemplateProps) {
  if (theme === 'thermal80' || theme === 'thermal58') {
    return <ThermalInvoice data={data} widthPx={theme === 'thermal80' ? 302 : 219} />
  }

  const totalQty = data.items.reduce((s, i) => s + i.qty, 0)
  const totalGst = data.items.reduce((s, i) => s + i.gstAmount, 0)
  const totalAmt = data.items.reduce((s, i) => s + i.amount, 0)
  const hsnTaxable = data.hsnSummary.reduce((s, h) => s + h.taxable, 0)
  const hsnTax = data.hsnSummary.reduce((s, h) => s + h.taxAmount, 0)

  const sumRow = (label: string, value: string, strong?: boolean) => (
    <tr>
      <td style={{
        ...td, border: 'none', borderBottom: BORDER, fontWeight: strong ? 700 : 400,
        background: strong ? ACCENT : undefined, color: strong ? '#ffffff' : TEXT, fontSize: strong ? 13 : 12,
      }}>{label}</td>
      <td style={{
        ...td, ...right, border: 'none', borderBottom: BORDER, fontWeight: strong ? 700 : 400,
        background: strong ? ACCENT : undefined, color: strong ? '#ffffff' : TEXT, fontSize: strong ? 13 : 12,
      }}>{value}</td>
    </tr>
  )

  return (
    <div style={{
      maxWidth: 800, margin: '0 auto', background: '#ffffff', color: TEXT, padding: 24,
      boxSizing: 'border-box', fontFamily: 'Arial, Helvetica, sans-serif',
    }}>
      {/* Title row */}
      <table style={{ ...table, marginBottom: 8 }}>
        <tbody>
          <tr>
            <td style={{ border: 'none', padding: 0, fontSize: 22, fontWeight: 700, color: ACCENT }}>TAX INVOICE</td>
            <td style={{ border: 'none', padding: 0, textAlign: 'right' }}>
              <span style={{
                display: 'inline-block', border: `1px solid ${ACCENT}`, color: ACCENT, fontSize: 10,
                fontWeight: 700, padding: '3px 8px', letterSpacing: 0.5,
              }}>ORIGINAL FOR RECIPIENT</span>
            </td>
          </tr>
        </tbody>
      </table>

      {/* Firm header */}
      <table style={table}>
        <tbody>
          <tr>
            {data.logoDataUrl && (
              <td style={{ ...td, width: 90, textAlign: 'center', verticalAlign: 'middle' }}>
                <img src={data.logoDataUrl} alt="Logo" style={{ maxWidth: 80, maxHeight: 80 }} />
              </td>
            )}
            <td style={{ ...td, padding: '10px 10px' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: TEXT }}>{data.firmName}</div>
              <div style={{ fontSize: 12, marginTop: 3 }}>{data.firmAddress}</div>
              <div style={{ fontSize: 12 }}>Phone: {data.firmPhone}</div>
              <div style={{ fontSize: 12 }}>Email: {data.firmEmail}</div>
              {data.firmGstin && <div style={{ fontSize: 12, fontWeight: 700 }}>GSTIN: {data.firmGstin}</div>}
              <div style={{ fontSize: 12 }}>State: {data.firmStateCode}</div>
            </td>
          </tr>
        </tbody>
      </table>

      {/* Bill to / invoice details */}
      <table style={{ ...table, tableLayout: 'fixed' }}>
        <tbody>
          <tr>
            <td style={{ ...td, padding: 0, width: '50%' }}>
              <div style={boxTitle}>BILL TO</div>
              <div style={boxBody}>
                <div style={{ fontWeight: 700 }}>{data.billToName}</div>
                {data.billToAddress && <div>{data.billToAddress}</div>}
                {data.billToGstin && <div>GSTIN: {data.billToGstin}</div>}
                {data.billToPhone && <div>Phone: {data.billToPhone}</div>}
              </div>
            </td>
            <td style={{ ...td, padding: 0, width: '50%' }}>
              <div style={boxTitle}>INVOICE DETAILS</div>
              <div style={boxBody}>
                <div>Invoice No: <b>{data.invoiceNo}</b></div>
                <div>Date: {data.date}</div>
                <div>Place of Supply: {data.placeOfSupply}</div>
                <div>Reverse Charge: {data.reverseCharge ? 'Yes' : 'No'}</div>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      {/* Items */}
      <table style={table}>
        <thead>
          <tr>
            <th style={{ ...th, width: 28 }}>#</th>
            <th style={th}>Item name</th>
            <th style={th}>HSN/SAC</th>
            <th style={{ ...th, ...right }}>MRP</th>
            <th style={{ ...th, ...right }}>Quantity</th>
            <th style={{ ...th, ...right }}>Price/Unit (&#8377;)</th>
            <th style={{ ...th, ...right }}>GST (&#8377;)</th>
            <th style={{ ...th, ...right }}>Amount (&#8377;)</th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((it, idx) => (
            <tr key={idx} style={{ pageBreakInside: 'avoid' }}>
              <td style={td}>{idx + 1}</td>
              <td style={td}>
                <div style={{ fontWeight: 600 }}>{it.name}</div>
                {it.warranty && <div style={{ fontSize: 10, color: MUTED }}>Warranty: {it.warranty}</div>}
              </td>
              <td style={td}>{it.hsn}</td>
              <td style={{ ...td, ...right }}>{num(it.mrp)}</td>
              <td style={{ ...td, ...right }}>{it.qty}{it.unit ? ` ${it.unit}` : ''}</td>
              <td style={{ ...td, ...right }}>{num(it.pricePerUnit)}</td>
              <td style={{ ...td, ...right }}>
                {num(it.gstAmount)}
                <div style={{ fontSize: 10, color: MUTED }}>({it.gstRate}%)</div>
              </td>
              <td style={{ ...td, ...right }}>{num(it.amount)}</td>
            </tr>
          ))}
          <tr style={{ background: HEAD_BG }}>
            <td style={{ ...td, fontWeight: 700 }} colSpan={4}>Total</td>
            <td style={{ ...td, ...right, fontWeight: 700 }}>{totalQty}</td>
            <td style={td}></td>
            <td style={{ ...td, ...right, fontWeight: 700 }}>{num(totalGst)}</td>
            <td style={{ ...td, ...right, fontWeight: 700 }}>{num(totalAmt)}</td>
          </tr>
        </tbody>
      </table>

      {/* Words / payment / terms + summary */}
      <table style={{ ...table, tableLayout: 'fixed' }}>
        <tbody>
          <tr>
            <td style={{ ...td, padding: 0, width: '58%' }}>
              <div style={boxTitle}>INVOICE AMOUNT IN WORDS</div>
              <div style={boxBody}>{data.amountInWords}</div>
              <div style={{ ...boxTitle, borderTop: BORDER }}>PAYMENT MODE</div>
              <div style={boxBody}>{data.paymentMode || '-'}</div>
              <div style={{ ...boxTitle, borderTop: BORDER }}>TERMS AND CONDITIONS</div>
              <div style={boxBody}>
                {data.terms && data.terms.length > 0
                  ? data.terms.map((t, i) => <div key={i}>{i + 1}. {t}</div>)
                  : '-'}
              </div>
            </td>
            <td style={{ ...td, padding: 0, width: '42%', verticalAlign: 'top' }}>
              <table style={table}>
                <tbody>
                  {sumRow('Sub Total', money(data.subTotal))}
                  {data.isInterState
                    ? sumRow('IGST', money(data.igst))
                    : (
                      <>
                        {sumRow('CGST', money(data.cgst))}
                        {sumRow('SGST', money(data.sgst))}
                      </>
                    )}
                  {sumRow('Total', money(data.total), true)}
                  {sumRow('Received', money(data.received))}
                  {sumRow('Balance', money(data.balance))}
                </tbody>
              </table>
            </td>
          </tr>
        </tbody>
      </table>

      {/* HSN summary */}
      <table style={{ ...table, marginTop: 10 }}>
        <thead>
          <tr>
            <th style={th}>HSN/SAC</th>
            <th style={{ ...th, ...right }}>Taxable amount (&#8377;)</th>
            <th style={{ ...th, ...right }}>Rate</th>
            <th style={{ ...th, ...right }}>Tax Amt (&#8377;)</th>
            <th style={{ ...th, ...right }}>Total Tax (&#8377;)</th>
          </tr>
        </thead>
        <tbody>
          {data.hsnSummary.map((h, i) => (
            <tr key={i}>
              <td style={td}>{h.hsn}</td>
              <td style={{ ...td, ...right }}>{num(h.taxable)}</td>
              <td style={{ ...td, ...right }}>{h.rate}%</td>
              <td style={{ ...td, ...right }}>{num(h.taxAmount)}</td>
              <td style={{ ...td, ...right }}>{num(h.taxAmount)}</td>
            </tr>
          ))}
          <tr style={{ background: HEAD_BG }}>
            <td style={{ ...td, fontWeight: 700 }}>Total</td>
            <td style={{ ...td, ...right, fontWeight: 700 }}>{num(hsnTaxable)}</td>
            <td style={td}></td>
            <td style={{ ...td, ...right, fontWeight: 700 }}>{num(hsnTax)}</td>
            <td style={{ ...td, ...right, fontWeight: 700 }}>{num(hsnTax)}</td>
          </tr>
        </tbody>
      </table>

      {/* Footer */}
      <table style={{ ...table, marginTop: 16, pageBreakInside: 'avoid' }}>
        <tbody>
          <tr>
            <td style={{ border: 'none' }}></td>
            <td style={{ border: 'none', width: 260, textAlign: 'right', fontSize: 12, fontWeight: 700, paddingBottom: data.stampDataUrl ? 6 : 48 }}>
              For: {data.firmName}
              {data.stampDataUrl && (
                <div style={{ marginTop: 4 }}>
                  <img src={data.stampDataUrl} alt="Stamp" style={{ maxHeight: 70, maxWidth: 160, objectFit: 'contain' }} />
                </div>
              )}
            </td>
          </tr>
          <tr>
            <td style={{ border: 'none' }}></td>
            <td style={{ border: 'none', textAlign: 'right' }}>
              <div style={{ borderTop: '1px solid #111827', display: 'inline-block', minWidth: 180, paddingTop: 3, fontSize: 11, textAlign: 'center' }}>
                Authorized Signatory
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      <div style={{ textAlign: 'center', fontSize: 10, color: MUTED, marginTop: 14 }}>
        This is a computer generated invoice. Thank you for shopping with us! Visit again.
      </div>
    </div>
  )
}

// Thermal receipt layout (80mm ≈ 302px, 58mm ≈ 219px). Narrow single-column,
// monospace, black-on-white. Reuses the exact same InvoiceData amounts as the
// A4 template — presentation only, no recomputation of money.
function ThermalInvoice({ data, widthPx }: { data: InvoiceData; widthPx: number }) {
  const small = widthPx < 260
  const base = small ? 10 : 11
  const totalQty = data.items.reduce((s, i) => s + i.qty, 0)

  const dashed: CSSProperties = { borderTop: '1px dashed #000', margin: '4px 0' }
  const row: CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: 6 }
  const center: CSSProperties = { textAlign: 'center' }

  return (
    <div style={{
      width: widthPx, margin: '0 auto', background: '#ffffff', color: '#000000',
      padding: small ? '8px 6px' : '10px 8px', boxSizing: 'border-box',
      fontFamily: '"Courier New", Courier, monospace', fontSize: base, lineHeight: 1.35,
    }}>
      {/* Firm header */}
      <div style={{ ...center, fontSize: small ? 13 : 15, fontWeight: 700 }}>{data.firmName}</div>
      {data.firmAddress && <div style={{ ...center, fontSize: base }}>{data.firmAddress}</div>}
      {data.firmPhone && <div style={{ ...center, fontSize: base }}>Ph: {data.firmPhone}</div>}
      {data.firmGstin && <div style={{ ...center, fontSize: base }}>GSTIN: {data.firmGstin}</div>}

      <div style={dashed} />
      <div style={{ ...center, fontWeight: 700 }}>TAX INVOICE</div>
      <div style={dashed} />

      {/* Invoice / customer meta */}
      <div style={row}><span>Invoice:</span><span>{data.invoiceNo}</span></div>
      <div style={row}><span>Date:</span><span>{data.date}</span></div>
      <div style={row}><span>Customer:</span><span style={{ textAlign: 'right' }}>{data.billToName}</span></div>
      {data.billToPhone && <div style={row}><span>Phone:</span><span>{data.billToPhone}</span></div>}
      {data.billToGstin && <div style={row}><span>GSTIN:</span><span>{data.billToGstin}</span></div>}
      {data.placeOfSupply && <div style={row}><span>Place:</span><span style={{ textAlign: 'right' }}>{data.placeOfSupply}</span></div>}

      <div style={dashed} />

      {/* Items: name on one line, qty x rate / amount on next */}
      {data.items.map((it, idx) => (
        <div key={idx} style={{ marginBottom: 3 }}>
          <div style={{ fontWeight: 700 }}>{idx + 1}. {it.name}</div>
          <div style={row}>
            <span>{it.qty}{it.unit ? ` ${it.unit}` : ''} x {num(it.pricePerUnit)}{it.gstRate ? ` (GST ${it.gstRate}%)` : ''}</span>
            <span>{num(it.amount)}</span>
          </div>
        </div>
      ))}

      <div style={dashed} />
      <div style={row}><span>Items / Qty:</span><span>{data.items.length} / {totalQty}</span></div>
      <div style={row}><span>Sub Total:</span><span>{money(data.subTotal)}</span></div>
      {data.isInterState
        ? <div style={row}><span>IGST:</span><span>{money(data.igst)}</span></div>
        : (
          <>
            <div style={row}><span>CGST:</span><span>{money(data.cgst)}</span></div>
            <div style={row}><span>SGST:</span><span>{money(data.sgst)}</span></div>
          </>
        )}
      <div style={dashed} />
      <div style={{ ...row, fontWeight: 700, fontSize: base + 2 }}><span>TOTAL:</span><span>{money(data.total)}</span></div>
      {(data.received ?? 0) > 0 && <div style={row}><span>Received:</span><span>{money(data.received)}</span></div>}
      {(data.balance ?? 0) > 0 && <div style={row}><span>Balance:</span><span>{money(data.balance)}</span></div>}
      {data.paymentMode && <div style={row}><span>Mode:</span><span>{data.paymentMode}</span></div>}

      {data.amountInWords && (
        <>
          <div style={dashed} />
          <div style={{ fontSize: base }}><b>In words:</b> {data.amountInWords}</div>
        </>
      )}

      {/* Condensed GST / HSN summary */}
      {data.hsnSummary.length > 0 && (
        <>
          <div style={dashed} />
          <div style={{ fontWeight: 700 }}>HSN Tax Summary</div>
          {data.hsnSummary.map((h, i) => (
            <div key={i} style={row}>
              <span>{h.hsn} @{h.rate}%</span>
              <span>{num(h.taxAmount)}</span>
            </div>
          ))}
        </>
      )}

      <div style={dashed} />
      <div style={{ ...center, fontWeight: 700 }}>Thank you!</div>
      <div style={{ ...center, fontSize: small ? 9 : 10 }}>Visit again.</div>
    </div>
  )
}
