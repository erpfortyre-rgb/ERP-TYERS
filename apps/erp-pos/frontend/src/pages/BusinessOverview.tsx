import { useEffect, useState, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { FiTrendingUp, FiTrendingDown, FiActivity, FiArrowUpRight, FiArrowDownRight, FiBarChart2, FiShoppingCart } from 'react-icons/fi'
import {
  ListExpenseEntries, ListIncomeEntries, ListExpenseTypes, ListIncomeTypes, GetDashboardStats,
} from '../../wailsjs/go/main/App'

interface Entry { id: string; typeId: string; category: string; amountPaise: number; narration: string; entryDate: string; createdAt: string; kind: 'income' | 'expense' }
interface NamedType { id: string; name: string }

const GREEN = '#16a34a'
const RED = '#ef4444'

const fmt = (p: number) => {
  const v = p / 100
  if (v >= 10000000) return '₹' + (v / 10000000).toFixed(2) + ' Cr'
  if (v >= 100000) return '₹' + (v / 100000).toFixed(2) + ' L'
  return '₹' + v.toLocaleString('en-IN', { maximumFractionDigits: 0 })
}
const fmtFull = (p: number) => '₹' + (p / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

type Period = 'today' | 'week' | 'month' | 'year' | 'all' | 'custom'
const PERIODS: { key: Period; label: string }[] = [
  { key: 'today', label: 'Today' }, { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' }, { key: 'year', label: 'This Year' }, { key: 'all', label: 'All Time' },
  { key: 'custom', label: 'Custom' },
]

const iso = (d: Date) => d.toISOString().slice(0, 10)
function periodStart(p: Period): string {
  const d = new Date()
  if (p === 'today') return iso(d)
  if (p === 'week') { const w = new Date(d); w.setDate(d.getDate() - d.getDay()); return iso(w) }
  if (p === 'month') { d.setDate(1); return iso(d) }
  if (p === 'year') return `${d.getFullYear()}-01-01`
  return '0000-01-01'
}
function Donut({ income, expense }: { income: number; expense: number }) {
  const total = income + expense
  const r = 52, c = 2 * Math.PI * r
  if (total === 0) {
    return (
      <svg width={130} height={130} viewBox="0 0 130 130">
        <circle cx={65} cy={65} r={r} fill="none" stroke="var(--border)" strokeWidth={16} />
        <text x={65} y={62} textAnchor="middle" fontSize={18} fontWeight={800} fill="var(--fg-muted)">—</text>
        <text x={65} y={80} textAnchor="middle" fontSize={10} fill="var(--fg-muted)">No data</text>
      </svg>
    )
  }
  const incPct = (income / total) * 100
  const incLen = (incPct / 100) * c
  return (
    <svg width={130} height={130} viewBox="0 0 130 130">
      <circle cx={65} cy={65} r={r} fill="none" stroke={RED} strokeWidth={16} />
      <circle cx={65} cy={65} r={r} fill="none" stroke={GREEN} strokeWidth={16}
        strokeDasharray={`${incLen} ${c - incLen}`} strokeDashoffset={c / 4} transform="rotate(-90 65 65)" strokeLinecap="round" />
      <text x={65} y={60} textAnchor="middle" fontSize={20} fontWeight={800} fill="var(--fg-bright)">{Math.round(incPct)}%</text>
      <text x={65} y={78} textAnchor="middle" fontSize={11} fill="var(--fg-muted)">Income</text>
    </svg>
  )
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return <div style={{ height: 36 }} />
  const max = Math.max(...data, 1), min = Math.min(...data, 0)
  const range = max - min || 1
  const w = 110, h = 36
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`).join(' ')
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ overflow: 'visible' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function KpiCard({ label, value, full, color, pct, spark, icon, invert }: {
  label: string; value: string; full: string; color: string; pct: number | null; spark: number[]; icon: React.ReactNode; invert?: boolean
}) {
  const good = pct === null ? true : (invert ? pct < 0 : pct >= 0)
  return (
    <div className="card" style={{ padding: '18px 20px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div style={{ width: 38, height: 38, borderRadius: '50%', background: color + '1a', display: 'flex', alignItems: 'center', justifyContent: 'center', color }}>{icon}</div>
        <span style={{ fontSize: '0.72rem', color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{label}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <div style={{ fontSize: '1.9rem', fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
          <div style={{ fontSize: '0.76rem', color: 'var(--fg-muted)', marginTop: 4 }}>{full}</div>
        </div>
        <Sparkline data={spark} color={color} />
      </div>
      {pct !== null && (
        <div style={{ marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.74rem', fontWeight: 700, padding: '3px 8px', borderRadius: 12, background: (good ? GREEN : RED) + '18', color: good ? GREEN : RED }}>
          {pct >= 0 ? <FiArrowUpRight size={12} /> : <FiArrowDownRight size={12} />}{Math.abs(pct).toFixed(1)}% <span style={{ fontWeight: 400, color: 'var(--fg-muted)' }}>vs last month</span>
        </div>
      )}
    </div>
  )
}

export default function BusinessOverview() {
  const navigate = useNavigate()
  const [all, setAll] = useState<Entry[]>([])
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  // Demo logins only see income/expense (sales data stays confidential in demos).
  const isDemo = (() => { try { return ((JSON.parse(localStorage.getItem('sst_user') || '{}').roleName) || '').toLowerCase() === 'demo' } catch { return false } })()
  const [period, setPeriod] = useState<Period>(() => {
    try { return (localStorage.getItem('sst_overview_period') as Period) || 'today' } catch { return 'today' }
  })
  useEffect(() => { try { localStorage.setItem('sst_overview_period', period) } catch { /* ignore */ } }, [period])

  const defFrom = (() => { const d = new Date(); d.setDate(1); return iso(d) })()
  const [customFrom, setCustomFrom] = useState<string>(() => { try { return localStorage.getItem('sst_overview_from') || defFrom } catch { return defFrom } })
  const [customTo, setCustomTo] = useState<string>(() => { try { return localStorage.getItem('sst_overview_to') || iso(new Date()) } catch { return iso(new Date()) } })
  useEffect(() => { try { localStorage.setItem('sst_overview_from', customFrom); localStorage.setItem('sst_overview_to', customTo) } catch { /* ignore */ } }, [customFrom, customTo])
  const [hoverMonth, setHoverMonth] = useState<number | null>(null)

  const load = useCallback(async () => {
    try {
      const [ee, ie, et, it] = await Promise.all([
        ListExpenseEntries('', ''), ListIncomeEntries('', ''), ListExpenseTypes(), ListIncomeTypes(),
      ])
      const eName = new Map((et || []).map((t: NamedType) => [t.id, t.name]))
      const iName = new Map((it || []).map((t: NamedType) => [t.id, t.name]))
      const merged: Entry[] = [
        ...(ee || []).map((e: any) => ({ id: e.id, typeId: e.expenseId, category: eName.get(e.expenseId) || 'Uncategorized', amountPaise: e.amountPaise, narration: e.narration || eName.get(e.expenseId) || 'Expense', entryDate: e.entryDate, createdAt: e.createdAt || e.entryDate, kind: 'expense' as const })),
        ...(ie || []).map((e: any) => ({ id: e.id, typeId: e.incomeId, category: iName.get(e.incomeId) || 'Uncategorized', amountPaise: e.amountPaise, narration: e.narration || iName.get(e.incomeId) || 'Income', entryDate: e.entryDate, createdAt: e.createdAt || e.entryDate, kind: 'income' as const })),
      ]
      setAll(merged)
      if (!isDemo) {
        try { setStats(await GetDashboardStats()) } catch { /* business snapshot optional */ }
      }
    } catch (err: any) { toast.error(err?.message || 'Failed to load overview') }
    finally { setLoading(false) }
  }, [isDemo])
  useEffect(() => { load() }, [load])

  const inRange = (d: string) => {
    if (period === 'all') return true
    if (period === 'custom') return (!customFrom || d >= customFrom) && (!customTo || d <= customTo)
    return d >= periodStart(period)
  }
  const filtered = useMemo(() => all.filter(e => inRange(e.entryDate)), [all, period, customFrom, customTo])

  const totalIncome = filtered.filter(e => e.kind === 'income').reduce((s, e) => s + e.amountPaise, 0)
  const totalExpense = filtered.filter(e => e.kind === 'expense').reduce((s, e) => s + e.amountPaise, 0)
  const net = totalIncome - totalExpense
  const compareMax = Math.max(totalIncome, totalExpense, 1)

  // % vs last month
  const now = new Date()
  const thisYM = iso(now).slice(0, 7)
  const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const lastYM = iso(lm).slice(0, 7)
  const sumBy = (kind: string, ym: string) => all.filter(e => e.kind === kind && e.entryDate.slice(0, 7) === ym).reduce((s, e) => s + e.amountPaise, 0)
  const pctChange = (kind: string) => { const cur = sumBy(kind, thisYM), prev = sumBy(kind, lastYM); return prev > 0 ? ((cur - prev) / prev) * 100 : null }

  // sparklines: last 6 months
  const last6 = Array.from({ length: 6 }, (_, k) => { const d = new Date(now.getFullYear(), now.getMonth() - 5 + k, 1); return iso(d).slice(0, 7) })
  const sparkOf = (kind: string) => last6.map(ym => all.filter(e => e.kind === kind && e.entryDate.slice(0, 7) === ym).reduce((s, e) => s + e.amountPaise, 0))

  // trend: current year by month
  const year = now.getFullYear()
  const trend = MONTHS.map((_, m) => {
    const ym = `${year}-${String(m + 1).padStart(2, '0')}`
    return {
      inc: all.filter(e => e.kind === 'income' && e.entryDate.slice(0, 7) === ym).reduce((s, e) => s + e.amountPaise, 0),
      exp: all.filter(e => e.kind === 'expense' && e.entryDate.slice(0, 7) === ym).reduce((s, e) => s + e.amountPaise, 0),
    }
  })
  const trendMax = Math.max(...trend.flatMap(t => [t.inc, t.exp]), 1)

  // category breakdown
  const catAgg = (kind: string) => {
    const map: Record<string, number> = {}
    filtered.filter(e => e.kind === kind).forEach(e => { map[e.category] = (map[e.category] || 0) + e.amountPaise })
    return Object.entries(map).map(([label, amt]) => ({ label, amt })).sort((a, b) => b.amt - a.amt)
  }

  // recent
  const recent = [...filtered].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6)

  if (loading) return <div className="page"><p style={{ color: 'var(--fg-muted)' }}>Loading overview...</p></div>

  return (
    <div className="page" style={{ gap: 14, display: 'flex', flexDirection: 'column' }}>
      {/* Header + period */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, paddingBottom: 14, borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
          <div style={{ width: 46, height: 46, borderRadius: 13, background: 'color-mix(in srgb, var(--accent) 12%, transparent)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <FiBarChart2 size={23} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--fg-bright)', margin: 0, letterSpacing: '-0.01em' }}>Business Overview</h2>
            <div style={{ fontSize: '0.8rem', color: 'var(--fg-muted)', marginTop: 3 }}>Income, expense &amp; net performance &middot; {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {period === 'custom' && (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input type="date" value={customFrom} max={customTo || undefined} onChange={e => setCustomFrom(e.target.value)}
                style={{ padding: '5px 8px', border: '1px solid var(--border)', borderRadius: 6, fontSize: '0.8rem', background: 'var(--bg-input)', color: 'var(--fg)' }} />
              <span style={{ color: 'var(--fg-muted)', fontSize: '0.8rem' }}>to</span>
              <input type="date" value={customTo} min={customFrom || undefined} onChange={e => setCustomTo(e.target.value)}
                style={{ padding: '5px 8px', border: '1px solid var(--border)', borderRadius: 6, fontSize: '0.8rem', background: 'var(--bg-input)', color: 'var(--fg)' }} />
            </div>
          )}
          <div style={{ display: 'flex', gap: 4, background: 'var(--bg-card)', padding: 4, borderRadius: 10, border: '1px solid var(--border)', flexWrap: 'wrap' }}>
            {PERIODS.map(p => (
              <button key={p.key} onClick={() => setPeriod(p.key)}
                style={{ padding: '5px 12px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, background: period === p.key ? 'var(--accent)' : 'transparent', color: period === p.key ? '#fff' : 'var(--fg-muted)' }}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Business snapshot (sales/stock/udhaar) — hidden for demo logins ─── */}
      {!isDemo && stats && (
        <>
          <div style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sales &amp; Business</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            <KpiCard label="This Month Sales" value={fmt(stats.monthSalesPaise)} full={`${stats.monthSalesCount || 0} invoices`} color="var(--accent)"
              pct={stats.prevMonthSalesPaise > 0 ? ((stats.monthSalesPaise - stats.prevMonthSalesPaise) / stats.prevMonthSalesPaise) * 100 : null}
              spark={(stats.salesByDay || []).map((d: any) => d.salePaise).slice(-8)} icon={<FiShoppingCart size={18} />} />
            <KpiCard label="Today's Sales" value={fmt(stats.todaySalesPaise)} full={`${stats.todaySalesCount || 0} bills today`} color={GREEN} pct={null} spark={[]} icon={<FiTrendingUp size={18} />} />
            <KpiCard label="To Receive (Udhaar)" value={fmt(stats.totalReceivablePaise)} full="Outstanding from customers" color="#f59e0b" pct={null} spark={[]} icon={<FiArrowDownRight size={18} />} />
            <KpiCard label="To Pay (Suppliers)" value={fmt(stats.totalPayablePaise)} full="Payable to suppliers" color={RED} pct={null} spark={[]} icon={<FiArrowUpRight size={18} />} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 12 }}>
            <div className="card" style={{ padding: '18px 20px' }}>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--fg-bright)', marginBottom: 10 }}>Inventory</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid var(--border)', fontSize: '0.84rem' }}><span style={{ color: 'var(--fg-muted)' }}>Active Products</span><strong>{stats.totalProducts || 0}</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid var(--border)', fontSize: '0.84rem' }}><span style={{ color: 'var(--fg-muted)' }}>Low Stock Items</span><strong style={{ color: stats.lowStockCount > 0 ? '#f59e0b' : 'var(--fg)' }}>{stats.lowStockCount || 0}</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', fontSize: '0.84rem' }}><span style={{ color: 'var(--fg-muted)' }}>Month Purchase</span><strong>{fmt(stats.monthPurchasePaise)}</strong></div>
            </div>
            <div className="card">
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--fg-bright)', marginBottom: 10 }}>Top Selling Products (this month)</div>
              {(!stats.topItems || stats.topItems.length === 0) ? (
                <div style={{ color: 'var(--fg-muted)', fontSize: '0.82rem', padding: '16px 0', textAlign: 'center' }}>No sales yet this month</div>
              ) : stats.topItems.map((t: any, i: number) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: i < stats.topItems.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <span style={{ width: 22, height: 22, borderRadius: 6, background: 'color-mix(in srgb, var(--accent) 14%, transparent)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 800, flexShrink: 0 }}>{i + 1}</span>
                  <span style={{ flex: 1, minWidth: 0, fontSize: '0.84rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.name}</span>
                  <span style={{ fontSize: '0.76rem', color: 'var(--fg-muted)', whiteSpace: 'nowrap' }}>{(t.qty / 1000).toLocaleString('en-IN')} pcs</span>
                  <strong style={{ fontSize: '0.84rem', minWidth: 72, textAlign: 'right' }}>{fmt(t.amtPaise)}</strong>
                </div>
              ))}
            </div>
          </div>
          <div style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 4 }}>Income &amp; Expense</div>
        </>
      )}

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        <KpiCard label="Total Income" value={fmt(totalIncome)} full={fmtFull(totalIncome)} color={GREEN} pct={pctChange('income')} spark={sparkOf('income')} icon={<FiTrendingUp size={18} />} />
        <KpiCard label="Total Expenses" value={fmt(totalExpense)} full={fmtFull(totalExpense)} color={RED} pct={pctChange('expense')} spark={sparkOf('expense')} icon={<FiTrendingDown size={18} />} invert />
        <div className="card" style={{ padding: '18px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <div style={{ width: 34, height: 34, borderRadius: '50%', background: (net >= 0 ? GREEN : RED) + '1a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: net >= 0 ? GREEN : RED }}><FiActivity size={16} /></div>
              <span style={{ fontSize: '0.72rem', color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Net {net >= 0 ? 'Surplus' : 'Deficit'}</span>
            </div>
            <div style={{ fontSize: '1.7rem', fontWeight: 800, color: net >= 0 ? GREEN : RED, lineHeight: 1 }}>{fmt(Math.abs(net))}</div>
            <div style={{ fontSize: '0.74rem', color: 'var(--fg-muted)', marginTop: 4 }}>Income − Expense</div>
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.74rem' }}>
              <span style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 9, height: 9, borderRadius: '50%', background: GREEN }} />Income</span><strong>{fmtFull(totalIncome)}</strong></span>
              <span style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 9, height: 9, borderRadius: '50%', background: RED }} />Expense</span><strong>{fmtFull(totalExpense)}</strong></span>
            </div>
          </div>
          <Donut income={totalIncome} expense={totalExpense} />
        </div>
      </div>

      {/* Income vs Expense + Quick Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 12 }}>
        <div className="card">
          <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--fg-bright)', marginBottom: 16 }}>Income vs Expense</div>
          {[{ l: 'Income', v: totalIncome, c: GREEN }, { l: 'Expense', v: totalExpense, c: RED }].map(row => (
            <div key={row.l} style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: '0.82rem' }}>
                <span style={{ color: row.c, fontWeight: 700 }}>{row.l}</span>
                <span style={{ fontWeight: 700 }}>{fmtFull(row.v)}</span>
              </div>
              <div style={{ height: 14, background: 'var(--border)', borderRadius: 7, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${(row.v / compareMax) * 100}%`, background: row.c, borderRadius: 7, transition: 'width 0.5s ease' }} />
              </div>
            </div>
          ))}
        </div>
        <div className="card">
          <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--fg-bright)', marginBottom: 14 }}>Quick Stats</div>
          {[
            { l: 'Total Income', v: fmt(totalIncome), c: GREEN, i: <FiArrowUpRight size={14} /> },
            { l: 'Total Expense', v: fmt(totalExpense), c: RED, i: <FiArrowDownRight size={14} /> },
            { l: `Net ${net >= 0 ? 'Surplus' : 'Deficit'}`, v: fmt(Math.abs(net)), c: net >= 0 ? GREEN : RED, i: <FiActivity size={14} /> },
          ].map(s => (
            <div key={s.l} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: s.c + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', color: s.c }}>{s.i}</div>
              <span style={{ flex: 1, fontSize: '0.82rem', color: 'var(--fg-muted)' }}>{s.l}</span>
              <strong style={{ fontSize: '0.9rem', color: s.c }}>{s.v}</strong>
            </div>
          ))}
        </div>
      </div>

      {/* Monthly Trend + Recent */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 12 }}>
        <div className="card" style={{ position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--fg-bright)' }}>Monthly Trend</div>
            <div style={{ display: 'flex', gap: 14, fontSize: '0.75rem', alignItems: 'center' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: GREEN }} /> Income</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: RED }} /> Expense</span>
              <span style={{ fontWeight: 700, color: 'var(--fg)' }}>{year}</span>
            </div>
          </div>
          {hoverMonth !== null && (
            <div style={{ position: 'absolute', top: 44, right: 16, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontSize: '0.75rem', boxShadow: '0 4px 14px rgba(0,0,0,0.12)', zIndex: 2 }}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>{MONTHS[hoverMonth]} {year}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14 }}><span style={{ color: GREEN }}>Income</span><strong>{fmt(trend[hoverMonth].inc)}</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14 }}><span style={{ color: RED }}>Expense</span><strong>{fmt(trend[hoverMonth].exp)}</strong></div>
            </div>
          )}
          <svg viewBox="0 0 720 200" style={{ width: '100%', height: 210 }}>
            {[0, 0.25, 0.5, 0.75, 1].map(g => (
              <g key={g}>
                <line x1={44} y1={10 + (1 - g) * 160} x2={715} y2={10 + (1 - g) * 160} stroke="var(--border)" strokeWidth={1} />
                <text x={38} y={14 + (1 - g) * 160} textAnchor="end" fontSize={9} fill="var(--fg-muted)">{fmt(trendMax * g)}</text>
              </g>
            ))}
            {trend.map((t, m) => {
              const gw = (715 - 44) / 12, cx = 44 + m * gw + gw / 2
              const bw = Math.min(11, gw / 2 - 3)
              const ih = (t.inc / trendMax) * 160, eh = (t.exp / trendMax) * 160
              return (
                <g key={m} onMouseEnter={() => setHoverMonth(m)} onMouseLeave={() => setHoverMonth(null)} style={{ cursor: 'pointer' }}>
                  <rect x={cx - bw - 1.5} y={170 - ih} width={bw} height={Math.max(0, ih)} fill={GREEN} rx={2} />
                  <rect x={cx + 1.5} y={170 - eh} width={bw} height={Math.max(0, eh)} fill={RED} rx={2} />
                  <rect x={cx - gw / 2} y={10} width={gw} height={160} fill={hoverMonth === m ? 'var(--accent)' : 'transparent'} opacity={0.06} />
                  <text x={cx} y={186} textAnchor="middle" fontSize={9} fill="var(--fg-muted)">{MONTHS[m]}</text>
                </g>
              )
            })}
          </svg>
        </div>

        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--fg-bright)' }}>Recent Transactions</div>
            <button onClick={() => navigate('/account/incomes')} style={{ fontSize: '0.74rem', color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>View All →</button>
          </div>
          {recent.length === 0 ? (
            <div style={{ color: 'var(--fg-muted)', fontSize: '0.82rem', padding: '20px 0', textAlign: 'center' }}>No transactions yet</div>
          ) : recent.map(t => (
            <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ width: 30, height: 30, borderRadius: '50%', background: (t.kind === 'income' ? GREEN : RED) + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.kind === 'income' ? GREEN : RED }}>
                {t.kind === 'income' ? <FiArrowUpRight size={14} /> : <FiArrowDownRight size={14} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.narration}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--fg-muted)' }}>{t.entryDate}</div>
              </div>
              <strong style={{ fontSize: '0.84rem', color: t.kind === 'income' ? GREEN : RED, whiteSpace: 'nowrap' }}>
                {t.kind === 'income' ? '+' : '−'}{fmt(t.amountPaise)}
              </strong>
            </div>
          ))}
        </div>
      </div>

      {/* Category breakdowns */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {[{ title: 'Expenses by Category', rows: catAgg('expense'), color: RED, empty: 'No expenses in this period' },
          { title: 'Income by Category', rows: catAgg('income'), color: GREEN, empty: 'No income in this period' }].map(block => {
          const max = Math.max(...block.rows.map(r => r.amt), 1)
          return (
            <div key={block.title} className="card">
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--fg-bright)', marginBottom: 14 }}>{block.title}</div>
              {block.rows.length === 0 ? (
                <div style={{ color: 'var(--fg-muted)', fontSize: '0.82rem', padding: '16px 0', textAlign: 'center' }}>{block.empty}</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {block.rows.map(r => (
                    <div key={r.label}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3, fontSize: '0.8rem' }}>
                        <span style={{ fontWeight: 500 }}>{r.label}</span>
                        <span style={{ fontWeight: 700, color: block.color }}>{fmtFull(r.amt)}</span>
                      </div>
                      <div style={{ height: 7, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${(r.amt / max) * 100}%`, background: block.color, borderRadius: 4, transition: 'width 0.5s ease' }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
