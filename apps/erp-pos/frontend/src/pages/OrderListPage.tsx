import { useEffect, useState, useCallback } from 'react'
import toast from 'react-hot-toast'
import { ListPurchaseOrders, ListSaleOrders, ListQuotations, ListCompanies } from '../../wailsjs/go/main/App'

interface OrderRow {
  id: string
  orderNumber: string
  date: string
  partyName: string
  totalPaise: number
  status: string
}

type Tab = 'purchase' | 'sale' | 'quotation'

const fmt = (p: number) => (p / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })

export default function OrderListPage() {
  const [tab, setTab] = useState<Tab>('purchase')
  const [search, setSearch] = useState('')
  const [rows, setRows] = useState<OrderRow[]>([])
  const [counts, setCounts] = useState({ purchase: 0, sale: 0, quotation: 0 })
  const [companyMap, setCompanyMap] = useState<Record<string, string>>({})

  useEffect(() => {
    ListCompanies('').then((c: any) => {
      const map: Record<string, string> = {}
      for (const co of (c || [])) map[co.id] = co.name
      setCompanyMap(map)
    }).catch(console.error)
  }, [])

  const load = useCallback(async () => {
    try {
      const [po, so, qt] = await Promise.all([
        ListPurchaseOrders(search).catch(() => []),
        ListSaleOrders(search).catch(() => []),
        ListQuotations(search).catch(() => []),
      ])
      const poList = (po || []).map((o: any) => ({ id: o.id, orderNumber: o.orderNumber || '', date: o.orderDate?.slice(0, 10) || '', partyName: (companyMap as any)[o.companyId] || '—', totalPaise: o.totalPaise || 0, status: o.status || '' }))
      const soList = (so || []).map((o: any) => ({ id: o.id, orderNumber: o.orderNumber || '', date: o.orderDate?.slice(0, 10) || o.createdAt?.slice(0, 10) || '', partyName: o.customerName || o.customerId || '', totalPaise: o.totalPaise || 0, status: o.status || '' }))
      const qtList = (qt || []).map((o: any) => ({ id: o.id, orderNumber: o.quotationNumber || '', date: o.quotationDate?.slice(0, 10) || o.createdAt?.slice(0, 10) || '', partyName: o.customerName || o.customerId || '', totalPaise: o.totalPaise || 0, status: o.status || '' }))

      setCounts({ purchase: poList.length, sale: soList.length, quotation: qtList.length })

      if (tab === 'purchase') setRows(poList)
      else if (tab === 'sale') setRows(soList)
      else setRows(qtList)
    } catch (e: any) { toast.error(e?.message || 'Failed to load orders'); console.error(e) }
  }, [search, tab, companyMap])

  useEffect(() => { load() }, [load])

  const tabs: { key: Tab; label: string }[] = [
    { key: 'purchase', label: 'Purchase Orders' },
    { key: 'sale', label: 'Sale Orders' },
    { key: 'quotation', label: 'Quotations' },
  ]

  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column', gap: 0, padding: 0 }}>
      <div style={{ background: 'var(--accent)', color: '#fff', padding: '10px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 600, fontSize: '1rem' }}>Orders &amp; Quotations</span>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)' }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{
              padding: '10px 20px', background: tab === t.key ? 'var(--bg-card)' : 'transparent',
              color: tab === t.key ? 'var(--accent)' : 'var(--fg-muted)',
              border: 'none', borderBottom: tab === t.key ? '2px solid var(--accent)' : '2px solid transparent',
              cursor: 'pointer', fontWeight: tab === t.key ? 600 : 400, fontSize: '0.9rem',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
            {t.label}
            <span style={{
              background: tab === t.key ? 'var(--accent)' : 'var(--border)',
              color: tab === t.key ? '#fff' : 'var(--fg-muted)',
              borderRadius: 10, padding: '1px 8px', fontSize: '0.75rem', fontWeight: 600,
            }}>
              {counts[t.key]}
            </span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div style={{ padding: '12px 20px' }}>
        <input type="text" placeholder="Search..." value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ padding: '6px 12px', border: '1px solid var(--border)', borderRadius: 4, width: 260, background: 'var(--bg-input)', color: 'var(--fg)' }} />
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '0 20px' }}>
        <table>
          <thead>
            <tr>
              <th style={{ width: 50 }}>#</th>
              <th>Order #</th>
              <th>Date</th>
              <th>Party</th>
              <th style={{ textAlign: 'right' }}>Amount</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id}>
                <td>{i + 1}</td>
                <td style={{ fontWeight: 500 }}>{r.orderNumber || '-'}</td>
                <td>{r.date}</td>
                <td style={{ fontWeight: 500 }}>{r.partyName}</td>
                <td style={{ textAlign: 'right', fontWeight: 500 }}>{fmt(r.totalPaise)}</td>
                <td><span style={{ padding: '2px 8px', borderRadius: 4, fontSize: '0.8rem', background: r.status === 'RECEIVED' || r.status === 'DELIVERED' || r.status === 'ACCEPTED' ? 'var(--success)' : r.status === 'CANCELLED' || r.status === 'REJECTED' ? 'var(--error)' : 'var(--accent)', color: '#fff' }}>{r.status}</span></td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--fg-muted)' }}>No records found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
