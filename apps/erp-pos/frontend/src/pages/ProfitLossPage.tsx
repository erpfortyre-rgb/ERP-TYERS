import { useState, useCallback, useEffect } from 'react'
import toast from 'react-hot-toast'
import { ProfitLoss } from '../../wailsjs/go/main/App'
import DateRangePicker from '../components/DateRangePicker'

interface Item { account: string; amountPaise: number }

const today = () => new Date().toISOString().slice(0, 10)
const firstOfMonth = () => { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10) }
const fmtAmt = (p: number) => (p / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })

const th: React.CSSProperties = { padding: '8px 10px', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '2px solid var(--border)', background: 'var(--bg-sidebar)' }
const td: React.CSSProperties = { padding: '7px 10px', borderBottom: '1px solid var(--border)', fontSize: '0.85rem' }

function Section({ title, items, total, color }: { title: string; items: Item[]; total: number; color: string }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid var(--border)', marginBottom: 16 }}>
      <thead>
        <tr>
          <th style={{ ...th, textAlign: 'left' }}>{title}</th>
          <th style={{ ...th, textAlign: 'right', width: 160 }}>Amount (₹)</th>
        </tr>
      </thead>
      <tbody>
        {items.length === 0 && <tr><td colSpan={2} style={{ ...td, textAlign: 'center', color: 'var(--fg-muted)' }}>No entries</td></tr>}
        {items.map((it, i) => (
          <tr key={i}>
            <td style={td}>{it.account}</td>
            <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmtAmt(it.amountPaise)}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr style={{ background: 'var(--bg-sidebar)', fontWeight: 700, borderTop: '2px solid var(--border)' }}>
          <td style={{ padding: '9px 10px' }}>Total {title}</td>
          <td style={{ padding: '9px 10px', textAlign: 'right', color }}>{fmtAmt(total)}</td>
        </tr>
      </tfoot>
    </table>
  )
}

export default function ProfitLossPage() {
  const [from, setFrom] = useState(firstOfMonth())
  const [to, setTo] = useState(today())
  const [showPicker, setShowPicker] = useState(false)
  const [expenses, setExpenses] = useState<Item[]>([])
  const [income, setIncome] = useState<Item[]>([])

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'F2' && !showPicker) { e.preventDefault(); setShowPicker(true) } }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [showPicker])

  const load = useCallback(async () => {
    try {
      const d: any = await ProfitLoss(from, to)
      setExpenses(d?.expenses || [])
      setIncome(d?.income || [])
    } catch (e: any) { toast.error(e?.message || 'Failed to load'); console.error(e) }
  }, [from, to])

  useEffect(() => { load() }, [load])

  const totalExp = expenses.reduce((s, i) => s + (i.amountPaise || 0), 0)
  const totalInc = income.reduce((s, i) => s + (i.amountPaise || 0), 0)
  const net = totalInc - totalExp
  const isEmpty = expenses.length === 0 && income.length === 0

  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column', gap: 0, padding: 0, height: '100%' }}>
      <div style={{ background: 'var(--accent)', color: '#fff', padding: '10px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <span style={{ fontWeight: 700, fontSize: '1rem' }}>Profit &amp; Loss Account</span>
        <button onClick={() => window.print()} style={{ padding: '5px 12px', background: '#fff', color: 'var(--accent)', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700 }}>Print</button>
      </div>

      <div style={{ padding: '10px 20px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', flexShrink: 0 }}>
        <label style={{ fontSize: '0.8rem', color: 'var(--fg-muted)', fontWeight: 600 }}>From</label>
        <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={{ padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 5, fontSize: '0.82rem', background: 'var(--bg-input)', color: 'var(--fg)' }} />
        <label style={{ fontSize: '0.8rem', color: 'var(--fg-muted)', fontWeight: 600 }}>To</label>
        <input type="date" value={to} onChange={e => setTo(e.target.value)} style={{ padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 5, fontSize: '0.82rem', background: 'var(--bg-input)', color: 'var(--fg)' }} />
        <button onClick={() => setShowPicker(true)} title="Pick date range (F2)"
          style={{ padding: '5px 12px', borderRadius: 5, fontSize: '0.8rem', fontWeight: 600, background: 'var(--accent)15', color: 'var(--accent)', border: '1px solid var(--accent)44', cursor: 'pointer' }}>
          📅 Range (F2)
        </button>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px' }}>
        <div style={{ textAlign: 'center', marginBottom: 14 }}>
          <div style={{ fontWeight: 700, fontSize: '1.15rem', color: 'var(--fg-bright)' }}>Shiv Shankar Tyres</div>
          <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Profit &amp; Loss Account</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--fg-muted)' }}>For the period {from} to {to}</div>
        </div>

        {isEmpty ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--fg-muted)', fontSize: '0.9rem' }}>No data for this period.</div>
        ) : (
          <>
            <Section title="Expenses" items={expenses} total={totalExp} color="#ef4444" />
            <Section title="Income" items={income} total={totalInc} color="#16a34a" />
            <div style={{ padding: '12px 16px', background: 'var(--bg-card)', border: `1px solid ${net >= 0 ? '#16a34a55' : '#ef444455'}`, borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, color: 'var(--fg-bright)' }}>{net >= 0 ? 'Net Profit' : 'Net Loss'} (Income − Expenses)</span>
              <span style={{ fontWeight: 700, fontSize: '1.15rem', color: net >= 0 ? '#16a34a' : '#ef4444' }}>₹{fmtAmt(Math.abs(net))}</span>
            </div>
          </>
        )}
      </div>

      {showPicker && <DateRangePicker initialFrom={from} initialTo={to} onApply={(f, t) => { setFrom(f); setTo(t); setShowPicker(false) }} onClose={() => setShowPicker(false)} />}
    </div>
  )
}
