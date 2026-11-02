import { useState, useEffect, useCallback } from 'react'
import type { CSSProperties, ReactElement } from 'react'

export interface DateRangePickerProps {
  initialFrom?: string // YYYY-MM-DD
  initialTo?: string // YYYY-MM-DD
  onApply: (from: string, to: string) => void
  onClose: () => void
}

type TabId = 'daily' | 'monthly' | 'quarterly' | 'fy'
type QuickItem = { key: string; label: string }

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const TABS: { id: TabId; label: string }[] = [
  { id: 'daily', label: 'Daily' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'quarterly', label: 'Quarterly' },
  { id: 'fy', label: 'FY & Custom' },
]

const QUICK: Record<TabId, QuickItem[]> = {
  daily: [
    { key: 'today', label: 'Today' },
    { key: 'yesterday', label: 'Yesterday' },
    { key: '7days', label: '7 Days' },
    { key: '14days', label: 'Last 2W' },
    { key: '20days', label: '20 Days' },
    { key: '30days', label: '30 Days' },
  ],
  monthly: MONTH_NAMES.map((m, i) => ({ key: 'm' + i, label: `${m}-${i + 1}` })),
  quarterly: [
    { key: 'thisQ', label: 'This Quarter' },
    { key: 'lastQ', label: 'Last Quarter' },
    { key: 'q1', label: 'Q1 (Apr-Jun)' },
    { key: 'q2', label: 'Q2 (Jul-Sep)' },
    { key: 'q3', label: 'Q3 (Oct-Dec)' },
    { key: 'q4', label: 'Q4 (Jan-Mar)' },
  ],
  fy: [
    { key: 'currentFY', label: 'Current FY' },
    { key: 'lastFY', label: 'Last FY' },
    { key: 'custom', label: 'Custom' },
  ],
}

const pad = (n: number) => String(n).padStart(2, '0')

function normalizeDate(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function formatDateISO(d: Date | null): string {
  if (!d) return ''
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function formatDate(d: Date | null): string {
  if (!d) return 'Select'
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`
}

function parseISO(s?: string): Date | null {
  if (!s) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  if (!m) return null
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

function computeQuickRange(type: string): { from: Date; to: Date } {
  const today = new Date()
  let from = new Date(today)
  let to = new Date(today)
  const cYear = today.getFullYear()
  const cMonth = today.getMonth()

  if (type === 'today') {
    // default
  } else if (type === 'yesterday') {
    from.setDate(today.getDate() - 1)
    to.setDate(today.getDate() - 1)
  } else if (type === '7days') from.setDate(today.getDate() - 7)
  else if (type === '14days') from.setDate(today.getDate() - 14)
  else if (type === '20days') from.setDate(today.getDate() - 20)
  else if (type === '30days') from.setDate(today.getDate() - 30)
  else if (type.startsWith('m')) {
    const mi = parseInt(type.substring(1), 10)
    from = new Date(cYear, mi, 1)
    to = new Date(cYear, mi + 1, 0)
  } else if (type === 'thisQ') {
    const qStart = Math.floor(cMonth / 3) * 3
    from = new Date(cYear, qStart, 1)
    to = new Date(cYear, qStart + 3, 0)
  } else if (type === 'lastQ') {
    const qStart = Math.floor(cMonth / 3) * 3
    let lqStart = qStart - 3
    let lqYear = cYear
    if (lqStart < 0) {
      lqStart += 12
      lqYear -= 1
    }
    from = new Date(lqYear, lqStart, 1)
    to = new Date(lqYear, lqStart + 3, 0)
  } else if (type === 'q1') {
    from = new Date(cYear, 3, 1)
    to = new Date(cYear, 6, 0)
  } else if (type === 'q2') {
    from = new Date(cYear, 6, 1)
    to = new Date(cYear, 9, 0)
  } else if (type === 'q3') {
    from = new Date(cYear, 9, 1)
    to = new Date(cYear, 12, 0)
  } else if (type === 'q4') {
    from = new Date(cYear, 0, 1)
    to = new Date(cYear, 3, 0)
  } else if (type === 'currentFY') {
    if (cMonth < 3) {
      from = new Date(cYear - 1, 3, 1)
      to = new Date(cYear, 2, 31)
    } else {
      from = new Date(cYear, 3, 1)
      to = new Date(cYear + 1, 2, 31)
    }
  } else if (type === 'lastFY') {
    if (cMonth < 3) {
      from = new Date(cYear - 2, 3, 1)
      to = new Date(cYear - 1, 2, 31)
    } else {
      from = new Date(cYear - 1, 3, 1)
      to = new Date(cYear, 2, 31)
    }
  }
  return { from: normalizeDate(from), to: normalizeDate(to) }
}

export default function DateRangePicker({ initialFrom, initialTo, onApply, onClose }: DateRangePickerProps) {
  const [from, setFrom] = useState<Date | null>(() => parseISO(initialFrom))
  const [to, setTo] = useState<Date | null>(() => parseISO(initialTo))
  const [viewMonth, setViewMonth] = useState<Date>(() => {
    const f = parseISO(initialFrom) ?? new Date()
    return new Date(f.getFullYear(), f.getMonth(), 1)
  })
  const [tab, setTab] = useState<TabId>('daily')
  const [activeQuick, setActiveQuick] = useState<string | null>(null)
  const [error, setError] = useState('')

  const apply = useCallback(() => {
    if (!from || !to) {
      setError('Select both dates')
      return
    }
    onApply(formatDateISO(from), formatDateISO(to))
  }, [from, to, onApply])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'F2' || e.key === 'PageDown') {
        e.preventDefault()
        apply()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [apply, onClose])

  const setQuick = (key: string) => {
    setActiveQuick(key)
    setError('')
    if (key === 'custom') return
    const r = computeQuickRange(key)
    setFrom(r.from)
    setTo(r.to)
    setViewMonth(new Date(r.from.getFullYear(), r.from.getMonth(), 1))
  }

  const handleDateClick = (d: Date) => {
    setActiveQuick(null)
    setError('')
    if (!from || (from && to)) {
      setFrom(d)
      setTo(null)
    } else if (d < from) {
      setFrom(d)
    } else {
      setTo(d)
    }
  }

  const reset = () => {
    setFrom(null)
    setTo(null)
    setActiveQuick(null)
    setError('')
  }

  const swap = () => {
    if (from && to) {
      setFrom(to)
      setTo(from)
    }
  }

  const changeMonth = (offset: number) =>
    setViewMonth((v) => new Date(v.getFullYear(), v.getMonth() + offset, 1))

  const duration =
    from && to ? Math.round(Math.abs(normalizeDate(to).getTime() - normalizeDate(from).getTime()) / 86400000) + 1 : 0

  const summary = from && to ? `${formatDate(from)} to ${formatDate(to)}` : from ? `${formatDate(from)} to Select...` : ''

  const renderCalendar = (monthDate: Date) => {
    const year = monthDate.getFullYear()
    const month = monthDate.getMonth()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const firstDay = new Date(year, month, 1).getDay()
    const fromT = from ? normalizeDate(from).getTime() : null
    const toT = to ? normalizeDate(to).getTime() : null

    const cells: ReactElement[] = []
    for (let i = 0; i < firstDay; i++) cells.push(<div key={'e' + i} />)
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day)
      const t = date.getTime()
      let style: CSSProperties = { ...dayBase, color: 'var(--fg)' }
      if (fromT !== null && toT !== null) {
        if (t >= fromT && t <= toT) {
          style = { ...dayBase, color: 'var(--fg-bright)', background: 'var(--bg-input)', outline: '1px solid var(--accent)', outlineOffset: -1 }
        }
        if (t === fromT || t === toT) {
          style = { ...dayBase, background: 'var(--accent)', color: '#fff', fontWeight: 700 }
        }
      } else if (fromT !== null && t === fromT) {
        style = { ...dayBase, background: 'var(--accent)', color: '#fff', fontWeight: 700 }
      }
      cells.push(
        <button key={day} type="button" style={style} onClick={() => handleDateClick(date)}>
          {day}
        </button>
      )
    }

    return (
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ textAlign: 'center', fontSize: 12, fontWeight: 600, color: 'var(--fg-bright)', marginBottom: 4 }}>
          {MONTH_NAMES[month]} {year}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 2 }}>
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
            <div key={i} style={{ textAlign: 'center', fontSize: 10, color: 'var(--fg-muted)' }}>
              {d}
            </div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>{cells}</div>
      </div>
    )
  }

  const nextMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1)
  const gridCols = tab === 'monthly' ? 6 : 3

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 500,
          maxWidth: '95vw',
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          boxShadow: '0 10px 40px rgba(0,0,0,0.4)',
          overflow: 'hidden',
          color: 'var(--fg)',
          fontSize: 12,
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '8px 12px',
            borderBottom: '1px solid var(--border)',
            background: 'var(--bg-sidebar)',
          }}
        >
          <span style={{ fontWeight: 600, color: 'var(--accent)' }}>Select Date Range</span>
          <button type="button" onClick={onClose} title="Close (Esc)" style={{ ...plainBtn, color: 'var(--fg-muted)', fontSize: 16 }}>
            &times;
          </button>
        </div>

        {/* Tabs + quick buttons */}
        <div style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-sidebar)' }}>
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                style={{
                  ...plainBtn,
                  flex: 1,
                  padding: '6px 4px',
                  fontSize: 11,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                  fontWeight: tab === t.id ? 600 : 400,
                  color: tab === t.id ? 'var(--accent)' : 'var(--fg-muted)',
                  borderBottom: `2px solid ${tab === t.id ? 'var(--accent)' : 'transparent'}`,
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div style={{ padding: 6 }}>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${gridCols}, 1fr)`, gap: 4 }}>
              {QUICK[tab].map((q) => {
                const active = activeQuick === q.key
                return (
                  <button
                    key={q.key}
                    type="button"
                    onClick={() => setQuick(q.key)}
                    style={{
                      padding: '5px 2px',
                      fontSize: 10,
                      textTransform: 'uppercase',
                      cursor: 'pointer',
                      borderRadius: 4,
                      border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                      background: active ? 'var(--accent)' : 'var(--bg-input)',
                      color: active ? '#fff' : 'var(--fg)',
                      fontWeight: active ? 700 : 400,
                    }}
                  >
                    {q.label}
                  </button>
                )
              })}
            </div>
            <div style={{ textAlign: 'center', height: 20, marginTop: 6, fontSize: 12, fontWeight: 700, color: 'var(--fg-bright)' }}>
              {activeQuick === 'custom' && !from ? 'Select from Calendar' : summary}
            </div>
          </div>
        </div>

        {/* From / To inputs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', borderBottom: '1px solid var(--border)' }}>
          <div style={dateBox}>
            <div style={dateLabel}>From</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-bright)' }}>{formatDate(from)}</div>
          </div>
          <button type="button" onClick={swap} title="Swap" style={{ ...smallBtn, padding: '4px 8px' }}>
            &#8644;
          </button>
          <div style={dateBox}>
            <div style={dateLabel}>To</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-bright)' }}>{formatDate(to)}</div>
          </div>
        </div>

        {/* Dual calendar */}
        <div style={{ display: 'flex', gap: 6, padding: '8px', alignItems: 'stretch' }}>
          <button type="button" onClick={() => changeMonth(-1)} style={{ ...plainBtn, color: 'var(--fg-muted)', fontSize: 16, alignSelf: 'flex-start' }}>
            &#8249;
          </button>
          {renderCalendar(viewMonth)}
          <div style={{ width: 1, background: 'var(--border)' }} />
          {renderCalendar(nextMonth)}
          <button type="button" onClick={() => changeMonth(1)} style={{ ...plainBtn, color: 'var(--fg-muted)', fontSize: 16, alignSelf: 'flex-start' }}>
            &#8250;
          </button>
          <div
            style={{
              width: 56,
              border: '1px solid var(--border)',
              background: 'var(--bg-input)',
              borderRadius: 6,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent)',
              marginLeft: 2,
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.1 }}>{duration}</div>
            <div style={{ fontSize: 9, textTransform: 'uppercase', textAlign: 'center', lineHeight: 1.2 }}>
              Days
              <br />
              Duration
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '6px 8px',
            borderTop: '1px solid var(--border)',
            background: 'var(--bg-sidebar)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button type="button" onClick={reset} style={smallBtn}>
              Reset
            </button>
            {error && <span style={{ fontSize: 11, color: '#ef4444', fontWeight: 500 }}>{error}</span>}
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button type="button" onClick={onClose} style={{ ...plainBtn, color: 'var(--fg-muted)', fontSize: 12, padding: '4px 8px' }}>
              Cancel
            </button>
            <button
              type="button"
              onClick={apply}
              style={{
                ...plainBtn,
                background: 'var(--accent)',
                color: '#fff',
                borderRadius: 4,
                padding: '4px 10px',
                fontSize: 12,
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              Apply
              <span style={{ fontSize: 9, fontWeight: 400, background: 'rgba(0,0,0,0.25)', padding: '1px 4px', borderRadius: 3, letterSpacing: 1 }}>
                F2/PgDn
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

const plainBtn: CSSProperties = {
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  padding: '2px 6px',
  color: 'var(--fg)',
}

const smallBtn: CSSProperties = {
  background: 'var(--bg-input)',
  border: '1px solid var(--border)',
  color: 'var(--fg)',
  borderRadius: 4,
  padding: '3px 10px',
  fontSize: 12,
  cursor: 'pointer',
}

const dateBox: CSSProperties = {
  flex: 1,
  background: 'var(--bg-input)',
  border: '1px solid var(--border)',
  borderRadius: 4,
  padding: '4px 8px',
}

const dateLabel: CSSProperties = {
  fontSize: 9,
  textTransform: 'uppercase',
  letterSpacing: 0.5,
  color: 'var(--fg-muted)',
}

const dayBase: CSSProperties = {
  height: 24,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 11,
  borderRadius: 4,
  cursor: 'pointer',
  border: 'none',
  background: 'transparent',
  padding: 0,
}
