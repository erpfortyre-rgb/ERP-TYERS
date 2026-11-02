// Page catalog used by the Admin → Roles permission matrix. Mirrors the sidebar
// `sections` in App.tsx (path + label only, no icons). Keep in sync when pages
// are added so the owner can grant/deny each page per role.
export interface PageGroup {
  label: string
  items: { path: string; label: string }[]
}

export const PAGE_GROUPS: PageGroup[] = [
  { label: 'Dashboard', items: [{ path: '/', label: 'Dashboard' }] },
  { label: 'Overview', items: [{ path: '/overview', label: 'Overview' }] },
  {
    label: 'Masters',
    items: [
      { path: '/masters/bank', label: 'Bank' },
      { path: '/masters/company', label: 'Company (Supplier)' },
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
    items: [
      { path: '/inventory/purchase-order', label: 'Purchase Order' },
      { path: '/inventory/purchase', label: 'Purchase' },
      { path: '/inventory/purchase-return', label: 'Purchase Return' },
      { path: '/inventory/sale-order', label: 'Sale Order' },
      { path: '/inventory/sales', label: 'Sales' },
      { path: '/inventory/add-sale', label: 'Add Sale (Invoice)' },
      { path: '/inventory/pos', label: 'POS Billing' },
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
    items: [
      { path: '/branch/stock-in', label: 'Stock In' },
      { path: '/branch/stock-out', label: 'Stock Out' },
    ],
  },
  {
    label: 'Account',
    items: [
      { path: '/account/customer-ledger', label: 'Customer Ledger' },
      { path: '/account/company-ledger', label: 'Company Ledger' },
      { path: '/account/bank-book', label: 'Bank Book' },
      { path: '/account/employee-ledger', label: 'Employee Ledger' },
      { path: '/account/expenses', label: 'Expenses Ledger' },
      { path: '/account/incomes', label: 'Incomes Ledger' },
      { path: '/account/payments', label: 'Payment Ledger' },
      { path: '/account/payment-reminders', label: 'Payment Reminders (Udhaar)' },
      { path: '/account/attendance', label: 'Employee Attendance' },
    ],
  },
  {
    label: 'Account Summary',
    items: [
      { path: '/summary/customer-outstanding', label: 'Customer Outstanding' },
      { path: '/summary/company-outstanding', label: 'Company Outstanding' },
      { path: '/summary/stock', label: 'Stock Summary' },
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
    items: [
      { path: '/tools/complaint', label: 'Complaint' },
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

export const ALL_PATHS: string[] = PAGE_GROUPS.flatMap(g => g.items.map(i => i.path))
