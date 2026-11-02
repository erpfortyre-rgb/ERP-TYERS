import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { FiShoppingCart, FiPackage, FiAlertTriangle, FiTrendingUp, FiTrendingDown, FiArrowRight } from 'react-icons/fi'
import toast from 'react-hot-toast'
import { GetDashboardStats } from '../../wailsjs/go/main/App'

interface SaleDay { date: string; salePaise: number }
interface TopItem { name: string; qty: number; amtPaise: number }

interface Stats {
  todaySalesCount: number
  todaySalesPaise: number
  todayCashPaise: number
  todayUpiPaise: number
  todayCardPaise: number
  todayCreditPaise: number
  todayChequePaise: number
  todayBankPaise: number
  monthSalesPaise: number
  monthSalesCount: number
  prevMonthSalesPaise: number
  monthPurchasePaise: number
  monthExpensePaise: number
  totalReceivablePaise: number
  totalPayablePaise: number
  lowStockCount: number
  totalProducts: number
  salesByDay: SaleDay[]
  topItems: TopItem[]
}

function fmt(paise: number): string {
  const v = paise / 100
  if (v >= 100000) return '₹' + (v / 100000).toFixed(1) + 'L'
  if (v >= 1000) return '₹' + (v / 1000).toFixed(1) + 'K'
  return '₹' + v.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function fmtFull(paise: number): string {
  return '₹' + (paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function pct(curr: number, prev: number): { val: number; up: boolean } | null {
  if (!prev) return null
  const v = ((curr - prev) / prev) * 100
  return { val: Math.abs(v), up: v >= 0 }
}

function SaleBarChart({ data }: { data: SaleDay[] }) {
  if (!data || data.length === 0) {
    return (
      <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--fg-muted)', fontSize: '0.8rem' }}>
        No sales data yet
      </div>
    )
  }
  const maxVal = Math.max(...data.map(d => d.salePaise), 1)
  const w = 560
  const h = 100
  const barW = Math.max(4, Math.floor((w - 20) / data.length) - 2)
  const step = (w - 20) / data.length

  return (
    <svg viewBox={`0 0 ${w} ${h + 20}`} style={{ width: '100%', height: 130 }}>
      {data.map((d, i) => {
        const barH = Math.max(2, (d.salePaise / maxVal) * h)
        const x = 10 + i * step + (step - barW) / 2
        const y = h - barH
        const isToday = i === data.length - 1
        return (
          <g key={d.date}>
            <rect x={x} y={y} width={barW} height={barH}
              fill={isToday ? 'var(--accent)' : 'var(--accent-muted,rgba(99,102,241,0.35))'}
              rx={2} />
            {isToday && (
              <text x={x + barW / 2} y={y - 4} textAnchor="middle"
                fill="var(--accent)" fontSize={9} fontWeight={600}>
                {fmt(d.salePaise)}
              </text>
            )}
          </g>
        )
      })}
      {/* X axis labels: first, mid, last */}
      {data.length > 0 && (
        <>
          <text x={10} y={h + 18} fill="var(--fg-muted)" fontSize={9}>{data[0].date.slice(5)}</text>
          {data.length > 2 && (
            <text x={w / 2} y={h + 18} textAnchor="middle" fill="var(--fg-muted)" fontSize={9}>
              {data[Math.floor(data.length / 2)].date.slice(5)}
            </text>
          )}
          <text x={w - 10} y={h + 18} textAnchor="end" fill="var(--fg-muted)" fontSize={9}>
            {data[data.length - 1].date.slice(5)}
          </text>
        </>
      )}
    </svg>
  )
}

function PayBar({ label, paise, total, color }: { label: string; paise: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((paise / total) * 100) : 0
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3, fontSize: '0.78rem' }}>
        <span style={{ color: 'var(--fg-muted)' }}>{label}</span>
        <span style={{ fontWeight: 600, color: 'var(--fg)' }}>{fmtFull(paise)}</span>
      </div>
      <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3, transition: 'width 0.4s ease' }} />
      </div>
    </div>
  )
}

const emptyStats: Stats = {
  todaySalesCount: 0, todaySalesPaise: 0, todayCashPaise: 0, todayUpiPaise: 0,
  todayCardPaise: 0, todayCreditPaise: 0, todayChequePaise: 0, todayBankPaise: 0,
  monthSalesPaise: 0, monthSalesCount: 0, prevMonthSalesPaise: 0,
  monthPurchasePaise: 0, monthExpensePaise: 0,
  totalReceivablePaise: 0, totalPayablePaise: 0,
  lowStockCount: 0, totalProducts: 0,
  salesByDay: [], topItems: [],
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    GetDashboardStats()
      .then((s: any) => setStats(s || emptyStats))
      .catch((e: any) => { console.error(e); toast.error('Dashboard load failed'); setStats(emptyStats) })
  }, [])

  if (!stats) {
    return <div className="page"><p style={{ color: 'var(--fg-muted)' }}>Loading dashboard...</p></div>
  }

  const monthChange = pct(stats.monthSalesPaise, stats.prevMonthSalesPaise)
  const todayPayTotal = stats.todayCashPaise + stats.todayUpiPaise + stats.todayCardPaise + stats.todayCreditPaise + stats.todayChequePaise

  return (
    <div className="page" style={{ gap: 16, display: 'flex', flexDirection: 'column' }}>

      {/* ── Row 1: 4 primary KPIs ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>

        {/* Today Sale */}
        <div className="card" style={{ padding: '14px 16px' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Today's Sale</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--fg-bright)', lineHeight: 1 }}>{fmt(stats.todaySalesPaise)}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--fg-muted)', marginTop: 4 }}>
            {stats.todaySalesCount} invoice{stats.todaySalesCount !== 1 ? 's' : ''}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--fg-muted)', marginTop: 2 }}>Cash: {fmt(stats.todayCashPaise)}</div>
        </div>

        {/* Month Sale */}
        <div className="card" style={{ padding: '14px 16px' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>This Month Sale</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--fg-bright)', lineHeight: 1 }}>{fmt(stats.monthSalesPaise)}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--fg-muted)', marginTop: 4 }}>{stats.monthSalesCount} invoices</div>
          {monthChange && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: '0.72rem', marginTop: 2, color: monthChange.up ? 'var(--success)' : 'var(--error)' }}>
              {monthChange.up ? <FiTrendingUp size={11} /> : <FiTrendingDown size={11} />}
              {monthChange.val.toFixed(1)}% vs last month
            </div>
          )}
        </div>

        {/* Receivable */}
        <div className="card" style={{ padding: '14px 16px' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Customer Receivable</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: stats.totalReceivablePaise > 0 ? '#f59e0b' : 'var(--fg-bright)', lineHeight: 1 }}>
            {fmt(stats.totalReceivablePaise)}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--fg-muted)', marginTop: 6 }}>Credit sales outstanding</div>
        </div>

        {/* Payable */}
        <div className="card" style={{ padding: '14px 16px' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Supplier Payable</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: stats.totalPayablePaise > 0 ? '#ef4444' : 'var(--fg-bright)', lineHeight: 1 }}>
            {fmt(stats.totalPayablePaise)}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--fg-muted)', marginTop: 6 }}>Total purchase bills</div>
        </div>
      </div>

      {/* ── Row 2: 3 secondary KPIs ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        <div className="card" style={{ padding: '12px 16px', display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(99,102,241,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FiPackage size={18} color="var(--accent)" />
          </div>
          <div>
            <div style={{ fontSize: '0.7rem', color: 'var(--fg-muted)' }}>Month Purchase</div>
            <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--fg-bright)' }}>{fmt(stats.monthPurchasePaise)}</div>
          </div>
        </div>
        <div className="card" style={{ padding: '12px 16px', display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FiTrendingDown size={18} color="#ef4444" />
          </div>
          <div>
            <div style={{ fontSize: '0.7rem', color: 'var(--fg-muted)' }}>Month Expenses</div>
            <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--fg-bright)' }}>{fmt(stats.monthExpensePaise)}</div>
          </div>
        </div>
        <div className="card" style={{ padding: '12px 16px', display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: stats.lowStockCount > 0 ? 'rgba(245,158,11,0.12)' : 'rgba(34,197,94,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FiAlertTriangle size={18} color={stats.lowStockCount > 0 ? '#f59e0b' : '#22c55e'} />
          </div>
          <div>
            <div style={{ fontSize: '0.7rem', color: 'var(--fg-muted)' }}>Low Stock Items</div>
            <div style={{ fontWeight: 700, fontSize: '1rem', color: stats.lowStockCount > 0 ? '#f59e0b' : 'var(--fg-bright)' }}>
              {stats.lowStockCount} / {stats.totalProducts}
            </div>
          </div>
        </div>
      </div>

      {/* ── Row 3: Chart + Payment modes ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 12 }}>

        {/* Sales trend chart */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--fg-bright)' }}>Sales Trend — Last 30 Days</div>
            <FiTrendingUp size={16} color="var(--accent)" />
          </div>
          <SaleBarChart data={stats.salesByDay} />
        </div>

        {/* Today payment breakdown */}
        <div className="card">
          <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--fg-bright)', marginBottom: 12 }}>
            Today Payment Modes
          </div>
          <PayBar label="Cash" paise={stats.todayCashPaise} total={todayPayTotal} color="#22c55e" />
          <PayBar label="UPI" paise={stats.todayUpiPaise} total={todayPayTotal} color="var(--accent)" />
          <PayBar label="Card" paise={stats.todayCardPaise} total={todayPayTotal} color="#3b82f6" />
          <PayBar label="Cheque" paise={stats.todayChequePaise} total={todayPayTotal} color="#8b5cf6" />
          <PayBar label="Credit" paise={stats.todayCreditPaise} total={todayPayTotal} color="#f59e0b" />
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, marginTop: 4, display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
            <span style={{ color: 'var(--fg-muted)' }}>Collected (money received)</span>
            <span style={{ fontWeight: 700, color: '#22c55e' }}>{fmtFull(stats.todayCashPaise + stats.todayUpiPaise + stats.todayCardPaise + stats.todayChequePaise)}</span>
          </div>
          {stats.todayCreditPaise > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginTop: 4 }}>
              <span style={{ color: 'var(--fg-muted)' }}>On Credit (Udhaar)</span>
              <span style={{ fontWeight: 700, color: '#f59e0b' }}>{fmtFull(stats.todayCreditPaise)}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Row 4: Top items + Quick actions ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 240px', gap: 12 }}>

        {/* Top selling items */}
        <div className="card">
          <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--fg-bright)', marginBottom: 12 }}>
            Top Selling This Month
          </div>
          {stats.topItems && stats.topItems.length > 0 ? (
            <table style={{ fontSize: '0.82rem' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', paddingBottom: 6, color: 'var(--fg-muted)', fontWeight: 500 }}>#</th>
                  <th style={{ textAlign: 'left', paddingBottom: 6, color: 'var(--fg-muted)', fontWeight: 500 }}>Product</th>
                  <th style={{ textAlign: 'right', paddingBottom: 6, color: 'var(--fg-muted)', fontWeight: 500 }}>Qty</th>
                  <th style={{ textAlign: 'right', paddingBottom: 6, color: 'var(--fg-muted)', fontWeight: 500 }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {stats.topItems.map((item, i) => (
                  <tr key={item.name}>
                    <td style={{ padding: '4px 0', color: 'var(--fg-muted)' }}>{i + 1}</td>
                    <td style={{ padding: '4px 8px 4px 0', fontWeight: 500, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.name}
                    </td>
                    <td style={{ textAlign: 'right', color: 'var(--fg-muted)' }}>{(item.qty / 1000).toFixed(0)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--accent)' }}>{fmt(item.amtPaise)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ color: 'var(--fg-muted)', fontSize: '0.82rem', padding: '20px 0' }}>No sales this month yet</div>
          )}
        </div>

        {/* Quick actions */}
        <div className="card">
          <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--fg-bright)', marginBottom: 12 }}>
            Quick Actions
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Link to="/inventory/pos" className="btn btn-primary" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span><FiShoppingCart style={{ marginRight: 6 }} />New Sale</span>
              <FiArrowRight size={14} />
            </Link>
            <Link to="/purchase/invoice" className="btn btn-ghost" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span><FiPackage style={{ marginRight: 6 }} />Purchase Entry</span>
              <FiArrowRight size={14} />
            </Link>
            <Link to="/masters/product" className="btn btn-ghost" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>Products</span>
              <FiArrowRight size={14} />
            </Link>
            <Link to="/reports/stock" className="btn btn-ghost" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span><FiAlertTriangle style={{ marginRight: 6 }} />Stock Report</span>
              <FiArrowRight size={14} />
            </Link>
          </div>
        </div>
      </div>

    </div>
  )
}
