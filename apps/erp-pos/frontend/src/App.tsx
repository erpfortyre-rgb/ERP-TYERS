import { Routes, Route, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useState, useCallback, useRef } from 'react'
import {
  FiHome, FiShoppingCart, FiFileText, FiPackage, FiBox, FiUsers,
  FiTruck, FiClipboard, FiDollarSign, FiBarChart2, FiSettings,
  FiLock, FiChevronDown, FiChevronRight, FiTool, FiBookOpen,
  FiGrid, FiCreditCard, FiRepeat, FiStar, FiAlertCircle, FiCalendar,
  FiCheckSquare, FiPieChart, FiBook, FiPhone, FiMessageSquare,
  FiMenu, FiMaximize, FiMinimize, FiLogOut, FiUser, FiTrash2,
  FiSearch, FiRefreshCw, FiX
} from 'react-icons/fi'
import { TbCurrencyRupee, TbCalculator } from 'react-icons/tb'
import Dashboard from './pages/Dashboard'
import BusinessOverview from './pages/BusinessOverview'
import Billing from './pages/Billing'
import Invoices from './pages/Invoices'
import AddSalePage from './pages/AddSalePage'
import AdminPage from './pages/AdminPage'
import Products from './pages/Products'
import Stock from './pages/Stock'
import CompanyMaster from './pages/CompanyMaster'
import CustomerMaster from './pages/CustomerMaster'
import CustomerGroupsPage from './pages/CustomerGroupsPage'
import ImportPartiesPage from './pages/ImportPartiesPage'
import SimpleMaster from './pages/SimpleMaster'
import ExpensesLedger from './pages/ExpensesLedger'
import IncomesLedger from './pages/IncomesLedger'
import PaymentLedger from './pages/PaymentLedger'
import PaymentRemindersPage from './pages/PaymentRemindersPage'
import RecycleBin from './pages/RecycleBin'
import CustomerLedgerPage from './pages/CustomerLedgerPage'
import CompanyLedgerPage from './pages/CompanyLedgerPage'
import DayBookPage from './pages/DayBookPage'
import PurchaseInvoice from './pages/PurchaseInvoice'
import SalesReturnPage from './pages/SalesReturnPage'
import CashBankSummaryPage from './pages/CashBankSummary'
import AttendancePage from './pages/AttendancePage'
import ExpenseSummaryPage from './pages/ExpenseSummaryPage'
import ExpenseMasterPage from './pages/ExpenseMasterPage'
import IncomeMasterPage from './pages/IncomeMasterPage'
import PurchaseReturnPage from './pages/PurchaseReturnPage'
import DebitNotePage from './pages/DebitNotePage'
import CreditNotePage from './pages/CreditNotePage'
import ChequeStatusPage from './pages/ChequeStatusPage'
import PurchaseOrderPage from './pages/PurchaseOrderPage'
import SaleOrderPage from './pages/SaleOrderPage'
import QuotationPage from './pages/QuotationPage'
import ChallanPage from './pages/ChallanPage'
import BankBookPage from './pages/BankBookPage'
import EmployeeLedgerPage from './pages/EmployeeLedgerPage'
import CustomerOutstandingPage from './pages/CustomerOutstandingPage'
import CompanyOutstandingPage from './pages/CompanyOutstandingPage'
import SaleSummaryPage from './pages/SaleSummaryPage'
import PurchaseSummaryPage from './pages/PurchaseSummaryPage'
import PaymentDetailsPage from './pages/PaymentDetailsPage'
import OrderListPage from './pages/OrderListPage'
import CustomerInvoicePage from './pages/CustomerInvoicePage'
import StockAdjustmentPage from './pages/StockAdjustmentPage'
import StockInPage from './pages/StockInPage'
import StockOutPage from './pages/StockOutPage'
import StockCorrectionPage from './pages/StockCorrectionPage'
import ComplaintPage from './pages/ComplaintPage'
import ServiceReminderPage from './pages/ServiceReminderPage'
import MessageTemplatePage from './pages/MessageTemplatePage'
import BarcodePage from './pages/BarcodePage'
import StockPriceUpdatePage from './pages/StockPriceUpdatePage'
import SettingsPage from './pages/SettingsPage'
import BOMPage from './pages/BOMPage'
import VoucherPage from './pages/VoucherPage'
import InvoicesReportPage from './pages/InvoicesReportPage'
import BrandwiseSummaryPage from './pages/BrandwiseSummaryPage'
import PartywiseSummaryPage from './pages/PartywiseSummaryPage'
import CategorywiseSummaryPage from './pages/CategorywiseSummaryPage'
import ItemwiseSummaryPage from './pages/ItemwiseSummaryPage'
import ItemSaleQtyPage from './pages/ItemSaleQtyPage'
import EmployeewiseSalePage from './pages/EmployeewiseSalePage'
import TradingAccountPage from './pages/TradingAccountPage'
import ProfitLossPage from './pages/ProfitLossPage'
import TrialBalancePage from './pages/TrialBalancePage'
import BalanceSheetPage from './pages/BalanceSheetPage'
import RojmelPage from './pages/RojmelPage'
import TCSReportPage from './pages/TCSReportPage'
import GSTR1Page from './pages/GSTR1Page'
import GSTR2Page from './pages/GSTR2Page'
import GSTR2BPage from './pages/GSTR2BPage'
import GSTR3BPage from './pages/GSTR3BPage'
import GSTSaleSummaryPage from './pages/GSTSaleSummaryPage'
import GSTPurchaseSummaryPage from './pages/GSTPurchaseSummaryPage'
import GSTWiseSummaryPage from './pages/GSTWiseSummaryPage'
import HSNWiseSummaryPage from './pages/HSNWiseSummaryPage'
import InvoicePrintPage from './pages/InvoicePrintPage'
import LoginPage, { UserInfo } from './pages/LoginPage'
import Calculator from './components/Calculator'
import { ConfirmHost } from './components/ConfirmDialog'
import ProfileMenu from './components/ProfileMenu'
import {
  GetCurrentUser,
  ListBanks, SaveBank, DeleteBank,
  ListEmployees, SaveEmployee, DeleteEmployee,
  ListExpenseTypes, SaveExpenseType, DeleteExpenseType,
  ListIncomeTypes, SaveIncomeType, DeleteIncomeType,
  ListPaymentTypes, SavePaymentType, DeletePaymentType,
  ListRecycleBin,
  ListUnits, SaveUnit, DeleteUnit,
  GetCategories, SaveCategory, DeleteCategory,
  GetBrands, SaveBrand, DeleteBrand,
} from '../wailsjs/go/main/App'

interface NavSection {
  label: string
  icon: React.ComponentType<{ size?: number }>
  items: { path: string; label: string; shortcut?: string }[]
}

const sections: NavSection[] = [
  {
    label: 'Dashboard',
    icon: FiHome,
    items: [{ path: '/', label: 'Dashboard' }],
  },
  {
    label: 'Overview',
    icon: FiBarChart2,
    items: [{ path: '/overview', label: 'Overview' }],
  },
  {
    label: 'Masters',
    icon: FiGrid,
    items: [
      { path: '/masters/bank', label: 'Bank' },
      { path: '/masters/company', label: 'Company' },
      { path: '/masters/customer', label: 'Customer' },
      { path: '/masters/customer-group', label: 'Customer Group' },
      { path: '/masters/import-parties', label: 'Import Parties' },
      { path: '/masters/brand', label: 'Brand' },
      { path: '/masters/category', label: 'Category' },
      { path: '/masters/employee', label: 'Employee' },
      { path: '/masters/expense', label: 'Expense' },
      { path: '/masters/income', label: 'Income' },
      { path: '/masters/payment', label: 'Payment' },
      { path: '/masters/product', label: 'Product' },
      { path: '/masters/unit', label: 'Unit Catalog' },
      { path: '/masters/bom', label: 'BOM' },
      { path: '/masters/voucher', label: 'Voucher' },
    ],
  },
  {
    label: 'Inventory',
    icon: FiPackage,
    items: [
      { path: '/inventory/purchase-order', label: 'Purchase Order' },
      { path: '/inventory/purchase', label: 'Purchase', shortcut: 'Ctrl+P' },
      { path: '/inventory/purchase-return', label: 'Purchase Return' },
      { path: '/inventory/sale-order', label: 'Sale Order' },
      { path: '/inventory/sales', label: 'Sales', shortcut: 'Ctrl+S' },
      { path: '/inventory/add-sale', label: 'Add Sale (Invoice)' },
      { path: '/inventory/pos', label: 'POS Billing', shortcut: 'Alt+F3' },
      { path: '/inventory/sales-return', label: 'Sales Return' },
      { path: '/inventory/debit-note', label: 'Debit Note' },
      { path: '/inventory/credit-note', label: 'Credit Note' },
      { path: '/inventory/challan', label: 'Customer Challan' },
      { path: '/inventory/customer-invoice', label: 'Customer Invoice' },
      { path: '/inventory/quotation', label: 'Quotation' },
      { path: '/inventory/stock-adjustment', label: 'Stock Adjustment' },
      { path: '/inventory/stock-inventory', label: 'Stock Inventory' },
    ],
  },
  {
    label: 'Branch',
    icon: FiRepeat,
    items: [
      { path: '/branch/stock-in', label: 'Stock In' },
      { path: '/branch/stock-out', label: 'Stock Out' },
    ],
  },
  {
    label: 'Account',
    icon: TbCurrencyRupee,
    items: [
      { path: '/account/customer-ledger', label: 'Customer Ledger', shortcut: 'Ctrl+Shift+C' },
      { path: '/account/company-ledger', label: 'Company Ledger', shortcut: 'Ctrl+Shift+M' },
      { path: '/account/bank-book', label: 'Bank Book' },
      { path: '/account/employee-ledger', label: 'Employee Ledger' },
      { path: '/account/expenses', label: 'Expenses Ledger', shortcut: 'Ctrl+E' },
      { path: '/account/incomes', label: 'Incomes Ledger', shortcut: 'Ctrl+I' },
      { path: '/account/payments', label: 'Payment Ledger' },
      { path: '/account/payment-reminders', label: 'Payment Reminders (Udhaar)' },
      { path: '/account/attendance', label: 'Employee Attendance' },
    ],
  },
  {
    label: 'Account Summary',
    icon: FiPieChart,
    items: [
      { path: '/summary/customer-outstanding', label: 'Customer Outstanding' },
      { path: '/summary/company-outstanding', label: 'Company Outstanding' },
      { path: '/summary/stock', label: 'Stock Summary', shortcut: 'F1' },
      { path: '/summary/sale', label: 'Sale Summary' },
      { path: '/summary/purchase', label: 'Purchase Summary' },
      { path: '/summary/cash-bank', label: 'Cash & Bank Summary' },
      { path: '/summary/expenses', label: 'Expenses Summary' },
      { path: '/summary/day-book', label: 'Day Book Summary' },
      { path: '/summary/payment-details', label: 'Payment Details Report' },
      { path: '/summary/order-list', label: 'Order List' },
    ],
  },
  {
    label: 'Inventory Summary',
    icon: FiBarChart2,
    items: [
      { path: '/inv-summary/brandwise', label: 'Brandwise Sale/Purchase' },
      { path: '/inv-summary/partywise', label: 'Partywise Sale/Purchase' },
      { path: '/inv-summary/categorywise', label: 'Categorywise Sale/Purchase' },
      { path: '/inv-summary/itemwise', label: 'Item wise Sale/Purchase' },
      { path: '/inv-summary/item-sale-qty', label: 'Item Sale Qty' },
      { path: '/inv-summary/employeewise', label: 'Employeewise Sale' },
      { path: '/inv-summary/invoices-report', label: 'Invoices Report' },
    ],
  },
  {
    label: 'Final Accounts',
    icon: FiBook,
    items: [
      { path: '/final/trading', label: 'Trading Account' },
      { path: '/final/pnl', label: 'Profit and Loss' },
      { path: '/final/trial-balance', label: 'Trial Balance' },
      { path: '/final/balance-sheet', label: 'Balance Sheet' },
      { path: '/final/rojmel', label: 'Daily Cash / Rojmel' },
      { path: '/final/tcs', label: 'TCS Report' },
    ],
  },
  {
    label: "GSTR's Summary",
    icon: FiBookOpen,
    items: [
      { path: '/gstr/gstr1', label: 'GSTR-1' },
      { path: '/gstr/gstr2', label: 'GSTR-2 / 2A' },
      { path: '/gstr/gstr2b', label: 'GSTR-2B' },
      { path: '/gstr/gstr3b', label: 'GSTR-3B' },
      { path: '/gstr/sale-summary', label: 'Sale Summary' },
      { path: '/gstr/purchase-summary', label: 'Purchase Summary' },
      { path: '/gstr/gst-wise', label: 'GST-WISE Summary' },
      { path: '/gstr/hsn-wise', label: 'HSN-WISE Summary' },
    ],
  },
  {
    label: 'Tools',
    icon: FiTool,
    items: [
      { path: '/tools/complaint', label: 'Complaint', shortcut: 'Alt+C' },
      { path: '/tools/service-reminder', label: 'Service Reminder' },
      { path: '/tools/message-template', label: 'Message Template' },
      { path: '/tools/barcode', label: 'BarCode' },
      { path: '/tools/cheques', label: 'Cheque Status' },
      { path: '/tools/stock-correction', label: 'Stock Correction' },
      { path: '/tools/stock-price-update', label: 'Stock Price Update' },
      { path: '/tools/settings', label: 'Settings' },
    ],
  },
]

const hotkeyHints = [
  { key: 'F2', label: 'Save' },
  { key: '↓', label: 'Save' },
  { key: 'F4', label: 'Payment' },
  { key: 'F6', label: 'Focus' },
  { key: 'F8', label: 'Search' },
  { key: 'F9', label: 'Barcode' },
  { key: 'Esc', label: 'Close' },
]

const roleAllowedSections: Record<string, string[] | null> = {
  owner: null,
  manager: ['Dashboard', 'Masters', 'Inventory', 'Branch', 'Account', 'Account Summary', 'Inventory Summary', 'Final Accounts', "GSTR's Summary", 'Tools'],
  cashier: ['Dashboard', 'Inventory', 'Tools'],
  demo: ['Overview', 'Masters', 'Account'],
}

const cashierAllowedPaths = new Set([
  '/',
  '/inventory/pos', '/inventory/sales', '/inventory/sales-return',
  '/inventory/customer-invoice', '/inventory/stock-inventory',
  '/tools/complaint', '/tools/barcode', '/tools/cheques',
])

// Demo login: only the Overview + Expense & Income modules are shown to the client.
const demoAllowedPaths = new Set([
  '/overview',
  '/masters/expense', '/masters/income',
  '/account/expenses', '/account/incomes', '/account/recycle-bin',
])

function getAllowedPaths(role: string): Set<string> | null {
  const allowed = roleAllowedSections[role]
  if (!allowed) return null
  const paths = new Set<string>()
  for (const sec of sections) {
    if (!allowed.includes(sec.label)) continue
    for (const item of sec.items) {
      if (role === 'cashier' && !cashierAllowedPaths.has(item.path)) continue
      if (role === 'demo' && !demoAllowedPaths.has(item.path)) continue
      if (role === 'manager' && item.path === '/tools/settings') continue
      paths.add(item.path)
    }
  }
  // Demo lands on /overview, not the sales Dashboard.
  if (role !== 'demo') paths.add('/')
  // Recycle Bin is a standalone sidebar-footer link, available to every role.
  paths.add('/account/recycle-bin')
  return paths
}

// Dynamic RBAC: a role's `permissions` JSON decides which pages it may open.
//   {"all":true}            → full access (owner)
//   {"paths":["/x","/y"]}   → only these page paths (custom roles / employees)
// When neither key is present we fall back to the legacy hardcoded role maps so
// the built-in owner/manager/cashier/demo roles keep their exact behaviour.
function parsePermissions(json?: string): { all?: boolean; paths?: string[] } {
  if (!json) return {}
  try {
    const p = JSON.parse(json)
    return p && typeof p === 'object' ? p : {}
  } catch { return {} }
}

function getAllowedPathsForUser(user: { roleName?: string; permissions?: string } | null): Set<string> | null {
  if (!user) return null
  const perms = parsePermissions(user.permissions)
  if (perms.all) return null
  if (Array.isArray(perms.paths)) {
    const s = new Set<string>(perms.paths)
    s.add('/')
    s.add('/account/recycle-bin')
    return s
  }
  return getAllowedPaths(user.roleName?.toLowerCase() || 'owner')
}

// Flat list of every page (path + label) for the customizable header tab bar.
const ALL_PAGES = sections.flatMap(s => s.items.map(i => ({ path: i.path, label: i.label })))
const defaultTabsFor = (role: string): string[] =>
  role === 'demo'
    ? ['/account/expenses', '/account/incomes']
    : ['/inventory/sales', '/inventory/purchase', '/account/expenses', '/account/incomes']

function App() {
  const location = useLocation()
  const navigate = useNavigate()
  const [currentUser, setCurrentUser] = useState<UserInfo | null>(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [calcVisible, setCalcVisible] = useState(false)
  const calcTargetRef = useRef<HTMLInputElement | null>(null)
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    Dashboard: true,
  })
  const [tabs, setTabs] = useState<string[]>([])
  const [showTabPicker, setShowTabPicker] = useState(false)
  const [search, setSearch] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchIdx, setSearchIdx] = useState(0)
  const tabsLoaded = useRef(false)
  const [recycleCount, setRecycleCount] = useState(0)

  // Check saved session on mount
  useEffect(() => {
    const saved = localStorage.getItem('sst_user')
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as UserInfo
        GetCurrentUser(parsed.id)
          .then((user: any) => {
            setCurrentUser(user)
            try { localStorage.setItem('sst_user', JSON.stringify(user)) } catch { /* ignore */ }
          })
          .catch(() => {
            localStorage.removeItem('sst_user')
          })
          .finally(() => setAuthChecked(true))
      } catch {
        localStorage.removeItem('sst_user')
        setAuthChecked(true)
      }
    } else {
      setAuthChecked(true)
    }
  }, [])

  const handleLogin = useCallback((user: UserInfo) => {
    setCurrentUser(user)
    localStorage.setItem('sst_user', JSON.stringify(user))
  }, [])

  const handleLogout = useCallback(() => {
    setCurrentUser(null)
    localStorage.removeItem('sst_user')
  }, [])

  // Load / persist the customizable header tabs per role.
  useEffect(() => {
    if (!currentUser) return
    const role = currentUser.roleName?.toLowerCase() || 'owner'
    try {
      const saved = localStorage.getItem(`sst_tabs_${role}`)
      setTabs(saved ? JSON.parse(saved) : defaultTabsFor(role))
    } catch { setTabs(defaultTabsFor(role)) }
    tabsLoaded.current = true
  }, [currentUser])

  useEffect(() => {
    if (!currentUser || !tabsLoaded.current) return
    const role = currentUser.roleName?.toLowerCase() || 'owner'
    try { localStorage.setItem(`sst_tabs_${role}`, JSON.stringify(tabs)) } catch { /* ignore */ }
  }, [tabs, currentUser])

  // Recycle Bin count badge — refreshes on mount, route change, and on delete/restore events.
  useEffect(() => {
    if (!currentUser) return
    const refresh = () => { ListRecycleBin().then((r: any) => setRecycleCount((r || []).length)).catch(() => {}) }
    refresh()
    window.addEventListener('recyclebin:changed', refresh)
    return () => window.removeEventListener('recyclebin:changed', refresh)
  }, [currentUser, location.pathname])

  const [isOnline, setIsOnline] = useState(navigator.onLine)

  useEffect(() => {
    const goOnline = () => setIsOnline(true)
    const goOffline = () => setIsOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  const [currentDate] = useState(
    new Date().toLocaleDateString('en-IN', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  )

  // Effective page access for the logged-in user (dynamic role permissions,
  // falling back to the legacy role maps). null = full access (owner).
  const allowedPaths = getAllowedPathsForUser(currentUser)

  const currentPage = (() => {
    if (location.pathname === '/account/recycle-bin') return 'Recycle Bin'
    for (const sec of sections) {
      for (const item of sec.items) {
        if (item.path === location.pathname) return item.label
      }
    }
    return 'Dashboard'
  })()

  const toggleSection = useCallback((label: string) => {
    setOpenSections(prev => ({ ...prev, [label]: !prev[label] }))
  }, [])

  // Calculator opens from the header button. If a text/number input is focused,
  // remember it as the target so the calc result can be pushed back into it.
  const openCalculator = useCallback(() => {
    const active = document.activeElement
    if (active && active instanceof HTMLInputElement && (active.type === 'text' || active.type === 'number')) {
      calcTargetRef.current = active
    } else {
      calcTargetRef.current = null
    }
    setCalcVisible(true)
  }, [])

  const [isFullscreen, setIsFullscreen] = useState(false)
  const toggleFullscreen = useCallback(() => {
    // Prefer the Wails native window fullscreen (the HTML Fullscreen API does not
    // control the native WebView2 window); fall back to the HTML API if missing.
    const rt: any = (window as any).runtime
    if (rt && rt.WindowIsFullscreen) {
      rt.WindowIsFullscreen().then((fs: boolean) => {
        if (fs) { rt.WindowUnfullscreen?.(); setIsFullscreen(false) }
        else { rt.WindowFullscreen?.(); setIsFullscreen(true) }
      }).catch(() => {})
      return
    }
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().then(() => setIsFullscreen(true)).catch(() => {})
    } else {
      document.exitFullscreen?.().then(() => setIsFullscreen(false)).catch(() => {})
    }
  }, [])

  // Auto-expand section containing current route
  useEffect(() => {
    for (const sec of sections) {
      if (sec.items.some(i => i.path === location.pathname)) {
        setOpenSections(prev => ({ ...prev, [sec.label]: true }))
        break
      }
    }
  }, [location.pathname])

  // Route-level RBAC guard: redirect unauthorized URL access
  useEffect(() => {
    if (!currentUser) return
    const role = currentUser.roleName?.toLowerCase() || ''
    if (allowedPaths && !allowedPaths.has(location.pathname)) {
      navigate(role === 'demo' ? '/overview' : '/', { replace: true })
    }
  }, [location.pathname, currentUser, navigate])

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // On the POS/Billing page, F4 (payment) belongs to that page's own handler.
      const onPOS = location.pathname === '/inventory/pos' || location.pathname === '/billing'
      // Calculator now opens from the header button (Ctrl+M still works).
      // F2 is intentionally NOT bound globally: it is contextual — when a date
      // calendar or a form is open, that component handles F2 (apply / save);
      // elsewhere F2 does nothing global.
      if (e.ctrlKey && e.key === 'm') {
        e.preventDefault()
        openCalculator()
        return
      }
      if (e.altKey && e.key === 'F3') {
        e.preventDefault()
        navigate('/inventory/pos')
      } else if (e.ctrlKey && e.key === 'p') {
        e.preventDefault()
        navigate('/inventory/purchase')
      } else if (e.ctrlKey && !e.shiftKey && e.key === 's') {
        e.preventDefault()
        navigate('/inventory/sales')
      } else if (e.ctrlKey && e.key === 'e') {
        e.preventDefault()
        navigate('/account/expenses')
      } else if (e.ctrlKey && e.key === 'i') {
        e.preventDefault()
        navigate('/account/incomes')
      } else if (e.ctrlKey && e.shiftKey && e.key === 'C') {
        e.preventDefault()
        navigate('/account/customer-ledger')
      } else if (e.ctrlKey && e.shiftKey && e.key === 'M') {
        e.preventDefault()
        navigate('/account/company-ledger')
      } else if (e.altKey && e.key === 'c') {
        e.preventDefault()
        navigate('/tools/complaint')
      } else if (e.key === 'F1') {
        e.preventDefault()
        navigate('/summary/stock')
      } else if (e.key === 'F4' && !onPOS) {
        e.preventDefault()
        // F4 = Payment — navigate to POS billing for quick pay (POS page handles its own F4)
        navigate('/inventory/pos')
      } else if (e.key === 'F6') {
        e.preventDefault()
        // F6 = Focus Toggle — collapse/expand sidebar
        setSidebarCollapsed(prev => !prev)
      } else if (e.key === 'F8') {
        e.preventDefault()
        // F8 = Global search — focus any visible search input
        const searchInput = document.querySelector('input[type="text"][placeholder*="earch"]') as HTMLInputElement
        if (searchInput) { searchInput.focus(); searchInput.select() }
      } else if (e.key === 'F9') {
        e.preventDefault()
        // F9 = Barcode — navigate to barcode tool
        navigate('/tools/barcode')
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [navigate, location.pathname, openCalculator])

  // Show nothing until auth check completes, then login or app
  if (!authChecked) {
    return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--fg-muted)' }}>Loading...</div>
  }

  if (!currentUser) {
    return <LoginPage onLogin={handleLogin} />
  }

  return (
    <div className="app-layout">
      <aside className={`sidebar${sidebarCollapsed ? ' collapsed' : ''}`}>
        <div className="sidebar-brand">
          <h1>SHIV SHANKAR TYRES</h1>
          <div className="sub">ERP System</div>
        </div>
        <nav className="sidebar-nav">
          {sections.map(sec => {
            const filteredItems = allowedPaths
              ? sec.items.filter(i => allowedPaths.has(i.path))
              : sec.items
            if (filteredItems.length === 0) return null
            const secWithItems = { ...sec, items: filteredItems }
            return secWithItems
          }).filter((x): x is NavSection => x !== null).map(sec => {
            const isOpen = openSections[sec.label]
            const isSingle = sec.items.length === 1
            const hasActive = sec.items.some(i => i.path === location.pathname)

            if (isSingle) {
              const item = sec.items[0]
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) =>
                    `nav-item${isActive ? ' active' : ''}`
                  }
                  end
                >
                  <sec.icon size={16} />
                  {item.label}
                </NavLink>
              )
            }

            return (
              <div key={sec.label} className="nav-section">
                <button
                  className={`nav-section-header${hasActive ? ' has-active' : ''}`}
                  onClick={() => toggleSection(sec.label)}
                >
                  <sec.icon size={16} />
                  <span>{sec.label}</span>
                  {isOpen ? (
                    <FiChevronDown size={14} />
                  ) : (
                    <FiChevronRight size={14} />
                  )}
                </button>
                {isOpen && (
                  <div className="nav-section-items">
                    {sec.items.map(item => (
                      <NavLink
                        key={item.path}
                        to={item.path}
                        className={({ isActive }) =>
                          `nav-sub-item${isActive ? ' active' : ''}`
                        }
                      >
                        <span>{item.label}</span>
                        {item.shortcut && (
                          <span className="nav-shortcut">{item.shortcut}</span>
                        )}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </nav>
        <NavLink to="/account/recycle-bin"
          className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          style={{ margin: '0 8px 8px', justifyContent: 'space-between' }}
          title="Recycle Bin — deleted entries">
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FiTrash2 size={16} /> Recycle Bin
          </span>
          {recycleCount > 0 && (
            <span style={{ minWidth: 20, height: 20, padding: '0 6px', borderRadius: 10, background: '#ef4444', color: '#fff', fontSize: '0.72rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>
              {recycleCount}
            </span>
          )}
        </NavLink>
        <div className="sidebar-footer">Counter 1 &middot; SST-1</div>
      </aside>

      <div className="main-content">
        <header className="header">
          <div className="header-left">
            <button
              className="sidebar-toggle-btn"
              onClick={() => setSidebarCollapsed(prev => !prev)}
              title={sidebarCollapsed ? 'Show Sidebar' : 'Hide Sidebar'}
            >
              <FiMenu size={18} />
            </button>
            <span className="header-title">{currentPage}</span>
            <span className="badge badge-info">SST-1</span>

            {/* Global page search (OS-Books / Suvidha style) */}
            {(() => {
              const q = search.trim().toLowerCase()
              const results = q
                ? ALL_PAGES.filter(p => (!allowedPaths || allowedPaths.has(p.path)) &&
                    (p.label.toLowerCase().includes(q) || p.path.toLowerCase().includes(q))).slice(0, 8)
                : []
              const go = (path: string) => { navigate(path); setSearch(''); setSearchOpen(false); setSearchIdx(0) }
              return (
                <div style={{ position: 'relative', marginLeft: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-input)', border: `1px solid ${searchOpen ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 8, padding: '5px 10px', width: searchOpen || search ? 260 : 190, transition: 'width .15s' }}>
                    <FiSearch size={14} style={{ color: 'var(--fg-muted)', flexShrink: 0 }} />
                    <input
                      value={search}
                      onChange={e => { setSearch(e.target.value); setSearchOpen(true); setSearchIdx(0) }}
                      onFocus={() => setSearchOpen(true)}
                      onKeyDown={e => {
                        if (e.key === 'ArrowDown') { e.preventDefault(); setSearchIdx(i => Math.min(i + 1, results.length - 1)) }
                        else if (e.key === 'ArrowUp') { e.preventDefault(); setSearchIdx(i => Math.max(i - 1, 0)) }
                        else if (e.key === 'Enter' && results[searchIdx]) { e.preventDefault(); go(results[searchIdx].path) }
                        else if (e.key === 'Escape') { setSearch(''); setSearchOpen(false); (e.target as HTMLInputElement).blur() }
                      }}
                      placeholder="Search pages…  (F8)"
                      style={{ border: 'none', outline: 'none', background: 'transparent', color: 'var(--fg)', fontSize: '0.82rem', width: '100%' }}
                    />
                    {search && <FiX size={13} style={{ color: 'var(--fg-muted)', cursor: 'pointer', flexShrink: 0 }} onClick={() => { setSearch(''); setSearchIdx(0) }} />}
                  </div>
                  {searchOpen && results.length > 0 && (
                    <>
                      <div onClick={() => setSearchOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
                      <div style={{ position: 'absolute', top: '112%', left: 0, zIndex: 41, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.18)', minWidth: 260, overflow: 'hidden', padding: 5 }}>
                        {results.map((p, i) => (
                          <div key={p.path} onMouseEnter={() => setSearchIdx(i)} onClick={() => go(p.path)}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '8px 10px', borderRadius: 6, cursor: 'pointer', background: i === searchIdx ? 'var(--bg-sidebar)' : 'transparent' }}>
                            <span style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--fg)' }}>{p.label}</span>
                            <span style={{ fontSize: '0.68rem', color: 'var(--fg-muted)' }}>{p.path}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )
            })()}
          </div>

          {/* Customizable quick-access tabs */}
          {(() => {
            const canAccess = (p: string) => !allowedPaths || allowedPaths.has(p)
            const pageLabel = (p: string) => ALL_PAGES.find(x => x.path === p)?.label || p
            const visibleTabs = tabs.filter(canAccess)
            const addablePages = ALL_PAGES.filter(p => canAccess(p.path) && !tabs.includes(p.path))
            const addTab = (p: string) => { setTabs(prev => prev.includes(p) ? prev : [...prev, p]); setShowTabPicker(false) }
            const removeTab = (p: string) => setTabs(prev => prev.filter(t => t !== p))
            return (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', position: 'relative' }}>
                {visibleTabs.map(path => {
                  const active = location.pathname === path
                  return (
                    <div key={path} style={{ display: 'flex', alignItems: 'center', background: active ? 'var(--accent)' : 'var(--bg-card)', border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 6, overflow: 'hidden' }}>
                      <button onClick={() => navigate(path)} title={pageLabel(path)}
                        style={{ padding: '5px 6px 5px 10px', background: 'transparent', color: active ? '#fff' : 'var(--fg)', border: 'none', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
                        {pageLabel(path)}
                      </button>
                      <span onClick={() => removeTab(path)} title="Remove tab"
                        style={{ padding: '0 7px', cursor: 'pointer', color: active ? '#fff' : 'var(--fg-muted)', fontSize: '1rem', lineHeight: 1 }}>×</span>
                    </div>
                  )
                })}
                <button onClick={() => setShowTabPicker(v => !v)} title="Add a page tab"
                  style={{ padding: '5px 10px', background: 'var(--bg-card)', color: 'var(--accent)', border: '1px dashed var(--accent)', borderRadius: 6, cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                  + Tab
                </button>
                {showTabPicker && (
                  <>
                    <div onClick={() => setShowTabPicker(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
                    <div style={{ position: 'absolute', top: '112%', left: 0, zIndex: 41, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.18)', minWidth: 220, maxHeight: 360, overflowY: 'auto', padding: 6 }}>
                      {addablePages.length === 0 ? (
                        <div style={{ padding: 10, fontSize: '0.8rem', color: 'var(--fg-muted)' }}>All pages already added</div>
                      ) : addablePages.map(p => (
                        <div key={p.path} onClick={() => addTab(p.path)}
                          style={{ padding: '7px 10px', fontSize: '0.82rem', cursor: 'pointer', borderRadius: 5, whiteSpace: 'nowrap' }}
                          onMouseEnter={e => ((e.currentTarget as HTMLDivElement).style.background = 'var(--bg-sidebar)')}
                          onMouseLeave={e => ((e.currentTarget as HTMLDivElement).style.background = 'transparent')}>
                          {p.label}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )
          })()}

          {/* Quick actions (OS-Books / Suvidha style): calculator, quick-add, POS, fullscreen */}
          {(() => {
            const canAccess = (p: string) => !allowedPaths || allowedPaths.has(p)
            const qaBtn: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', background: 'var(--bg-card)', color: 'var(--fg)', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, whiteSpace: 'nowrap' }
            return (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginRight: 8 }}>
                <button style={qaBtn} onClick={openCalculator} title="Calculator (Ctrl+M)">
                  <TbCalculator size={15} /> Calc
                </button>
                {canAccess('/inventory/sales') && (
                  <button style={{ ...qaBtn, color: '#ef4444', borderColor: '#ef444455' }} onClick={() => navigate('/inventory/add-sale')} title="New Sale Invoice">
                    <FiFileText size={14} /> Sale
                  </button>
                )}
                {canAccess('/inventory/purchase') && (
                  <button style={{ ...qaBtn, color: 'var(--accent)', borderColor: 'var(--accent)' }} onClick={() => navigate('/inventory/purchase')} title="New Purchase (Ctrl+P)">
                    <FiShoppingCart size={14} /> Purchase
                  </button>
                )}
                {canAccess('/inventory/pos') && (
                  <button style={qaBtn} onClick={() => navigate('/inventory/pos')} title="POS Billing (Alt+F3)">
                    <FiGrid size={14} /> POS
                  </button>
                )}
                {canAccess('/tools/settings') && (
                  <button style={qaBtn} onClick={() => navigate('/tools/settings')} title="Settings">
                    <FiSettings size={15} />
                  </button>
                )}
                <button style={qaBtn} onClick={() => window.location.reload()} title="Refresh">
                  <FiRefreshCw size={15} />
                </button>
                <button style={qaBtn} onClick={toggleFullscreen} title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
                  {isFullscreen ? <FiMinimize size={15} /> : <FiMaximize size={15} />}
                </button>
              </div>
            )
          })()}

          <div className="header-right">
            <span className={`badge ${isOnline ? 'badge-success' : 'badge-warning'}`}>
              {isOnline ? 'Online' : 'Offline'}
            </span>
            <span>{currentDate}</span>
            <ProfileMenu user={currentUser} onLogout={handleLogout} />
          </div>
        </header>

        <Routes>
          {/* Dashboard */}
          <Route path="/" element={<Dashboard />} />
          <Route path="/overview" element={<BusinessOverview />} />
          <Route path="/admin" element={<AdminPage />} />

          {/* Masters */}
          <Route path="/masters/bank" element={
            <SimpleMaster title="Bank" listFn={ListBanks} saveFn={SaveBank} deleteFn={DeleteBank}
              fields={[
                { key: 'bankName', label: 'Bank Name', required: true },
                { key: 'bookType', label: 'Book Type', type: 'select' as any,
                  options: [{ value: 'BANK_BOOK', label: 'Bank Book' }, { value: 'CASH_BOOK', label: 'Cash Book' }, { value: 'NON_PAYMENT', label: 'Non-Payment Book' }] as any },
                { key: 'accountNumber', label: 'Account Number', placeholder: '9-18 digits', inputFilter: /\d/, maxLength: 18,
                  validate: (v: string) => v && (v.length < 9 || v.length > 18) ? 'Account number: 9-18 digits' : null },
                { key: 'ifscCode', label: 'IFSC Code', placeholder: 'e.g. SBIN0001234', maxLength: 11,
                  transform: (v: string) => v.toUpperCase(), inputFilter: /[A-Za-z0-9]/,
                  validate: (v: string) => v && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(v) ? 'IFSC format: 4 letters + 0 + 6 characters (e.g. SBIN0001234)' : null },
                { key: 'branch', label: 'Branch' },
                { key: 'openingBalancePaise', label: 'Opening Balance', type: 'rupees' },
                { key: 'note', label: 'Note / Description', placeholder: 'e.g. Main business account, UPI settles here' },
              ]} />
          } />
          <Route path="/masters/company" element={<CompanyMaster />} />
          <Route path="/masters/customer" element={<CustomerMaster />} />
          <Route path="/masters/customer-group" element={<CustomerGroupsPage />} />
          <Route path="/masters/import-parties" element={<ImportPartiesPage />} />
          <Route path="/masters/brand" element={
            <SimpleMaster title="Brand" listFn={GetBrands} saveFn={SaveBrand} deleteFn={DeleteBrand}
              fields={[
                { key: 'name', label: 'Brand Name', required: true },
              ]} />
          } />
          <Route path="/masters/category" element={
            <SimpleMaster title="Category" listFn={GetCategories} saveFn={SaveCategory} deleteFn={DeleteCategory}
              fields={[
                { key: 'name', label: 'Category Name', required: true },
                { key: 'purchaseDiscountPercent', label: 'Purchase Discount %', type: 'number', placeholder: '0' },
                { key: 'saleDiscountPercent', label: 'Sale Discount %', type: 'number', placeholder: '0' },
              ]} />
          } />
          <Route path="/masters/employee" element={
            <SimpleMaster title="Employee" listFn={() => ListEmployees('')} saveFn={SaveEmployee} deleteFn={DeleteEmployee}
              fields={[
                { key: 'name', label: 'Name', required: true },
                { key: 'phone', label: 'Phone', placeholder: '10 digit number', inputFilter: /\d/, maxLength: 10,
                  validate: (v: string) => v && v.length !== 10 ? 'Phone: exactly 10 digits' : null },
                { key: 'email', label: 'Email',
                  validate: (v: string) => v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? 'Invalid email format' : null },
                { key: 'designation', label: 'Designation' },
                { key: 'address', label: 'Address' },
                { key: 'salaryPaise', label: 'Monthly Salary', type: 'rupees' },
                { key: 'joiningDate', label: 'Joining Date' },
                { key: 'paidHolidayCount', label: 'Paid Holidays/Month', type: 'number', placeholder: '0' },
              ]} />
          } />
          <Route path="/masters/expense" element={<ExpenseMasterPage />} />
          <Route path="/masters/income" element={<IncomeMasterPage />} />
          <Route path="/masters/payment" element={
            <SimpleMaster title="Payment Type" listFn={ListPaymentTypes} saveFn={SavePaymentType} deleteFn={DeletePaymentType}
              fields={[{ key: 'name', label: 'Payment Name', required: true }]} />
          } />
          <Route path="/masters/product" element={<Products />} />
          <Route path="/masters/unit" element={
            <SimpleMaster title="Unit" listFn={ListUnits} saveFn={SaveUnit} deleteFn={DeleteUnit}
              fields={[
                { key: 'name', label: 'Unit Name', required: true },
                { key: 'shortName', label: 'Short Name' },
              ]} />
          } />
          <Route path="/masters/bom" element={<BOMPage />} />
          <Route path="/masters/voucher" element={<VoucherPage />} />

          {/* Inventory */}
          <Route path="/inventory/purchase-order" element={<PurchaseOrderPage />} />
          <Route path="/inventory/purchase" element={<PurchaseInvoice />} />
          <Route path="/inventory/purchase-return" element={<PurchaseReturnPage />} />
          <Route path="/inventory/sale-order" element={<SaleOrderPage />} />
          <Route path="/inventory/sales" element={<Invoices />} />
          <Route path="/inventory/add-sale" element={<AddSalePage />} />
          <Route path="/inventory/pos" element={<Billing />} />
          <Route path="/inventory/sales-return" element={<SalesReturnPage />} />
          <Route path="/inventory/debit-note" element={<DebitNotePage />} />
          <Route path="/inventory/credit-note" element={<CreditNotePage />} />
          <Route path="/inventory/challan" element={<ChallanPage />} />
          <Route path="/inventory/customer-invoice" element={<CustomerInvoicePage />} />
          <Route path="/inventory/quotation" element={<QuotationPage />} />
          <Route path="/inventory/stock-adjustment" element={<StockAdjustmentPage />} />
          <Route path="/inventory/stock-inventory" element={<Stock />} />

          {/* Branch */}
          <Route path="/branch/stock-in" element={<StockInPage />} />
          <Route path="/branch/stock-out" element={<StockOutPage />} />

          {/* Account */}
          <Route path="/account/customer-ledger" element={<CustomerLedgerPage />} />
          <Route path="/account/company-ledger" element={<CompanyLedgerPage />} />
          <Route path="/account/bank-book" element={<BankBookPage />} />
          <Route path="/account/employee-ledger" element={<EmployeeLedgerPage />} />
          <Route path="/account/expenses" element={<ExpensesLedger />} />
          <Route path="/account/incomes" element={<IncomesLedger />} />
          <Route path="/account/payments" element={<PaymentLedger />} />
          <Route path="/account/payment-reminders" element={<PaymentRemindersPage />} />
          <Route path="/account/recycle-bin" element={<RecycleBin />} />
          <Route path="/account/attendance" element={<AttendancePage />} />

          {/* Account Summary */}
          <Route path="/summary/customer-outstanding" element={<CustomerOutstandingPage />} />
          <Route path="/summary/company-outstanding" element={<CompanyOutstandingPage />} />
          <Route path="/summary/stock" element={<Stock />} />
          <Route path="/summary/sale" element={<SaleSummaryPage />} />
          <Route path="/summary/purchase" element={<PurchaseSummaryPage />} />
          <Route path="/summary/cash-bank" element={<CashBankSummaryPage />} />
          <Route path="/summary/expenses" element={<ExpenseSummaryPage />} />
          <Route path="/summary/day-book" element={<DayBookPage />} />
          <Route path="/summary/payment-details" element={<PaymentDetailsPage />} />
          <Route path="/summary/order-list" element={<OrderListPage />} />

          {/* Inventory Summary */}
          <Route path="/inv-summary/brandwise" element={<BrandwiseSummaryPage />} />
          <Route path="/inv-summary/partywise" element={<PartywiseSummaryPage />} />
          <Route path="/inv-summary/categorywise" element={<CategorywiseSummaryPage />} />
          <Route path="/inv-summary/itemwise" element={<ItemwiseSummaryPage />} />
          <Route path="/inv-summary/item-sale-qty" element={<ItemSaleQtyPage />} />
          <Route path="/inv-summary/employeewise" element={<EmployeewiseSalePage />} />
          <Route path="/inv-summary/invoices-report" element={<InvoicesReportPage />} />

          {/* Final Accounts */}
          <Route path="/final/trading" element={<TradingAccountPage />} />
          <Route path="/final/pnl" element={<ProfitLossPage />} />
          <Route path="/final/trial-balance" element={<TrialBalancePage />} />
          <Route path="/final/balance-sheet" element={<BalanceSheetPage />} />
          <Route path="/final/rojmel" element={<RojmelPage />} />
          <Route path="/final/tcs" element={<TCSReportPage />} />

          {/* GSTR */}
          <Route path="/gstr/gstr1" element={<GSTR1Page />} />
          <Route path="/gstr/gstr2" element={<GSTR2Page />} />
          <Route path="/gstr/gstr2b" element={<GSTR2BPage />} />
          <Route path="/gstr/gstr3b" element={<GSTR3BPage />} />
          <Route path="/gstr/sale-summary" element={<GSTSaleSummaryPage />} />
          <Route path="/gstr/purchase-summary" element={<GSTPurchaseSummaryPage />} />
          <Route path="/gstr/gst-wise" element={<GSTWiseSummaryPage />} />
          <Route path="/gstr/hsn-wise" element={<HSNWiseSummaryPage />} />

          {/* Tools */}
          <Route path="/tools/complaint" element={<ComplaintPage />} />
          <Route path="/tools/service-reminder" element={<ServiceReminderPage />} />
          <Route path="/tools/message-template" element={<MessageTemplatePage />} />
          <Route path="/tools/barcode" element={<BarcodePage />} />
          <Route path="/tools/cheques" element={<ChequeStatusPage />} />
          <Route path="/tools/stock-correction" element={<StockCorrectionPage />} />
          <Route path="/tools/stock-price-update" element={<StockPriceUpdatePage />} />
          <Route path="/tools/settings" element={<SettingsPage />} />

          {/* Invoice print (GST tax invoice) */}
          <Route path="/print/invoice/:id" element={<InvoicePrintPage />} />

          {/* Legacy routes redirect */}
          <Route path="/billing" element={<Billing />} />
          <Route path="/invoices" element={<Invoices />} />
          <Route path="/products" element={<Products />} />
          <Route path="/stock" element={<Stock />} />
        </Routes>

        <div className="hotkey-bar">
          {hotkeyHints.map(h => (
            <div key={h.key} className="hotkey-item">
              <span className="hotkey-key">{h.key}</span>
              <span>{h.label}</span>
            </div>
          ))}
        </div>
      </div>

      <Calculator
        visible={calcVisible}
        onClose={() => setCalcVisible(false)}
        targetRef={calcTargetRef}
      />
      <ConfirmHost />
    </div>
  )
}

export default App
