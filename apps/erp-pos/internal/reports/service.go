package reports

import (
	"database/sql"
	"fmt"

	"erp-pos/internal/models"
)

type Service struct {
	db *sql.DB
}

func NewService(db *sql.DB) *Service {
	return &Service{db: db}
}

// stockValueAtCostQuery values closing stock at cost for the active company.
// Cost per unit = purchase price if entered, else the cheapest cost/wholesale
// tier (CMP), else MRP as a last resort. Oversold (negative) quantities are
// floored at 0 so a data anomaly can't push the asset value negative.
// Takes one arg: the active tenant id.
const stockValueAtCostQuery = `
	SELECT COALESCE(SUM(
		MAX(ls.quantity_millis, 0) * COALESCE(
			NULLIF(p.purchase_price_paise, 0),
			(SELECT pp.price_paise FROM product_prices pp WHERE pp.product_id = p.id AND pp.tier IN ('CMP_B','CMP_A','CMP_C','CMP_D') ORDER BY pp.price_paise ASC LIMIT 1),
			(SELECT pp.price_paise FROM product_prices pp WHERE pp.product_id = p.id AND pp.tier = 'MRP' ORDER BY pp.valid_from DESC LIMIT 1),
			0
		) / 1000
	), 0)
	FROM local_stock ls JOIN products p ON p.id = ls.product_id
	WHERE p.tenant_id = ? AND p.is_active = 1`

func (s *Service) tenantID() string {
	var id string
	s.db.QueryRow("SELECT COALESCE((SELECT t.id FROM tenants t WHERE t.id=(SELECT value FROM settings WHERE key='active_tenant_id')), (SELECT id FROM tenants LIMIT 1))").Scan(&id)
	return id
}

// storeStateCode returns the 2-digit GST state code of the shop, taken from the
// firm's GSTIN (first 2 chars). Falls back to "36" (Telangana — Shiv Shankar
// Tyres) when the GSTIN is not set. Used to decide inter-state (IGST) vs
// intra-state (CGST+SGST) on GST returns.
func (s *Service) storeStateCode() string {
	var gstin sql.NullString
	s.db.QueryRow("SELECT gstin FROM tenants WHERE id=?", s.tenantID()).Scan(&gstin)
	if gstin.Valid && len(gstin.String) >= 2 {
		return gstin.String[:2]
	}
	return "36"
}

// splitTax decides how a tax amount splits given the counter-party's GSTIN.
// Inter-state (party in a different state, by GSTIN first 2 digits) → all IGST.
// Intra-state or unregistered (no GSTIN = local B2C) → CGST + SGST (half each).
func splitTax(taxPaise int64, partyGSTIN, storeState string) (cgst, sgst, igst int64) {
	ps := ""
	if len(partyGSTIN) >= 2 {
		ps = partyGSTIN[:2]
	}
	if ps != "" && ps != storeState {
		return 0, 0, taxPaise
	}
	return taxPaise / 2, taxPaise - taxPaise/2, 0
}

// ─── Result Types ──────────────────────────────────────────────────────────

type BankBookEntry struct {
	Date        string `json:"date"`
	Description string `json:"description"`
	Debit       int64  `json:"debit"`
	Credit      int64  `json:"credit"`
	Balance     int64  `json:"balance"`
}

type LedgerRow struct {
	Date          string `json:"date"`
	Description   string `json:"description"`
	Amount        int64  `json:"amount"`
	PaymentMethod string `json:"paymentMethod"`
	Reference     string `json:"reference"`
}

type OutstandingRow struct {
	PartyID     string `json:"partyId"`
	PartyName   string `json:"partyName"`
	TotalPaise  int64  `json:"totalPaise"`
	PaidPaise   int64  `json:"paidPaise"`
	BalancePaise int64 `json:"balancePaise"`
}

type SaleSummaryRow struct {
	Date         string `json:"date"`
	InvoiceCount int    `json:"invoiceCount"`
	TotalPaise   int64  `json:"totalPaise"`
	CashPaise    int64  `json:"cashPaise"`
	UPIPaise     int64  `json:"upiPaise"`
	CardPaise    int64  `json:"cardPaise"`
	CreditPaise  int64  `json:"creditPaise"`
}

type PurchaseSummaryRow struct {
	Date       string `json:"date"`
	OrderCount int    `json:"orderCount"`
	TotalPaise int64  `json:"totalPaise"`
}

type PaymentDetailRow struct {
	ID            string `json:"id"`
	Date          string `json:"date"`
	PartyType     string `json:"partyType"`
	PartyName     string `json:"partyName"`
	PaymentMethod string `json:"paymentMethod"`
	AmountPaise   int64  `json:"amountPaise"`
	Reference     string `json:"reference"`
	Narration     string `json:"narration"`
}

type OrderRow struct {
	ID          string `json:"id"`
	OrderType   string `json:"orderType"`
	OrderNumber string `json:"orderNumber"`
	Date        string `json:"date"`
	PartyName   string `json:"partyName"`
	Status      string `json:"status"`
	TotalPaise  int64  `json:"totalPaise"`
}

// ─── 1. BankBook ───────────────────────────────────────────────────────────

func (s *Service) BankBook(bankID, from, to string) ([]BankBookEntry, error) {
	// Get opening balance from bank_master for the selected account
	var openingBalance int64
	if bankID != "" {
		s.db.QueryRow(`SELECT opening_balance_paise FROM bank_master WHERE id = ?`, bankID).Scan(&openingBalance)
	}

	// UNION all transaction types: expense_entries (debit), income_entries (credit), payment_entries (mixed)
	dateFilter := ""
	var dateArgs []interface{}
	if from != "" && to != "" {
		dateFilter = ` AND entry_date >= ? AND date(entry_date) <= ?`
		dateArgs = []interface{}{from, to}
	}

	q := `SELECT * FROM (
		SELECT entry_date,
			COALESCE(ee.narration, em.name, 'Expense') as description,
			amount_paise as debit, 0 as credit
		FROM expense_entries ee
		LEFT JOIN expense_master em ON ee.expense_id = em.id
		WHERE ee.tenant_id = ?` + dateFilter + `
		UNION ALL
		SELECT entry_date,
			COALESCE(ie.narration, im.name, 'Income') as description,
			0 as debit, amount_paise as credit
		FROM income_entries ie
		LEFT JOIN income_master im ON ie.income_id = im.id
		WHERE ie.tenant_id = ?` + dateFilter + `
		UNION ALL
		SELECT entry_date,
			COALESCE(pe.narration, pm.name, 'Payment') as description,
			CASE WHEN pe.party_type != 'CUSTOMER' THEN pe.amount_paise ELSE 0 END as debit,
			CASE WHEN pe.party_type = 'CUSTOMER' THEN pe.amount_paise ELSE 0 END as credit
		FROM payment_entries pe
		LEFT JOIN payment_master pm ON pe.payment_type_id = pm.id
		WHERE pe.tenant_id = ?` + dateFilter + `
	) t ORDER BY entry_date`

	args := []interface{}{s.tenantID()}
	args = append(args, dateArgs...)
	args = append(args, s.tenantID())
	args = append(args, dateArgs...)
	args = append(args, s.tenantID())
	args = append(args, dateArgs...)

	rows, err := s.db.Query(q, args...)
	if err != nil {
		return nil, fmt.Errorf("bank book query: %w", err)
	}
	defer rows.Close()

	list := make([]BankBookEntry, 0)
	running := openingBalance
	for rows.Next() {
		var e BankBookEntry
		if err := rows.Scan(&e.Date, &e.Description, &e.Debit, &e.Credit); err != nil {
			return nil, err
		}
		running += e.Credit - e.Debit
		e.Balance = running
		list = append(list, e)
	}
	return list, nil
}

// ─── 2. EmployeeLedger ────────────────────────────────────────────────────

func (s *Service) EmployeeLedger(employeeID, from, to string) ([]LedgerRow, error) {
	q := `SELECT pe.entry_date, COALESCE(pe.narration,''), pe.amount_paise,
		pe.payment_method, COALESCE(pe.reference_number,'')
		FROM payment_entries pe
		WHERE pe.tenant_id = ? AND pe.party_type = 'EMPLOYEE' AND pe.party_id = ?`
	args := []interface{}{s.tenantID(), employeeID}

	if from != "" && to != "" {
		q += ` AND pe.entry_date >= ? AND pe.entry_date <= ?`
		args = append(args, from, to)
	}
	q += ` ORDER BY pe.entry_date DESC`

	rows, err := s.db.Query(q, args...)
	if err != nil {
		return nil, fmt.Errorf("employee ledger query: %w", err)
	}
	defer rows.Close()

	list := make([]LedgerRow, 0)
	for rows.Next() {
		var r LedgerRow
		if err := rows.Scan(&r.Date, &r.Description, &r.Amount, &r.PaymentMethod, &r.Reference); err != nil {
			return nil, err
		}
		list = append(list, r)
	}
	return list, nil
}

// ─── 3. CustomerOutstanding ────────────────────────────────────────────────

func (s *Service) CustomerOutstanding() ([]OutstandingRow, error) {
	q := `SELECT c.id, c.name,
		COALESCE(inv.total, 0) as total_paise,
		COALESCE(paid.total, 0) as paid_paise,
		COALESCE(inv.total, 0) - COALESCE(paid.total, 0) as balance_paise
		FROM customers c
		LEFT JOIN (
			SELECT customer_id, SUM(total_paise) as total
			FROM invoices WHERE status = 'FINAL' AND deleted_at IS NULL AND tenant_id = ?
			GROUP BY customer_id
		) inv ON inv.customer_id = c.id
		LEFT JOIN (
			SELECT i.customer_id, SUM(ip.amount_paise) as total
			FROM invoice_payments ip
			JOIN invoices i ON ip.invoice_id = i.id
			WHERE i.status = 'FINAL' AND i.deleted_at IS NULL AND i.tenant_id = ? AND ip.method <> 'CREDIT'
			GROUP BY i.customer_id
		) paid ON paid.customer_id = c.id
		WHERE c.tenant_id = ? AND (COALESCE(inv.total, 0) - COALESCE(paid.total, 0)) != 0
		ORDER BY balance_paise DESC`

	tid := s.tenantID()
	rows, err := s.db.Query(q, tid, tid, tid)
	if err != nil {
		return nil, fmt.Errorf("customer outstanding query: %w", err)
	}
	defer rows.Close()

	list := make([]OutstandingRow, 0)
	for rows.Next() {
		var r OutstandingRow
		if err := rows.Scan(&r.PartyID, &r.PartyName, &r.TotalPaise, &r.PaidPaise, &r.BalancePaise); err != nil {
			return nil, err
		}
		list = append(list, r)
	}
	return list, nil
}

// ─── 4. CompanyOutstanding ─────────────────────────────────────────────────

func (s *Service) CompanyOutstanding() ([]OutstandingRow, error) {
	q := `SELECT co.id, co.name,
		COALESCE(po.total, 0) as total_paise,
		COALESCE(paid.total, 0) as paid_paise,
		COALESCE(po.total, 0) - COALESCE(paid.total, 0) as balance_paise
		FROM companies co
		LEFT JOIN (
			SELECT company_id, SUM(total_paise) as total
			FROM purchase_orders WHERE tenant_id = ?
			GROUP BY company_id
		) po ON po.company_id = co.id
		LEFT JOIN (
			SELECT pe.party_id, SUM(pe.amount_paise) as total
			FROM payment_entries pe
			WHERE pe.tenant_id = ? AND pe.party_type = 'COMPANY'
			GROUP BY pe.party_id
		) paid ON paid.party_id = co.id
		WHERE co.tenant_id = ? AND (COALESCE(po.total, 0) - COALESCE(paid.total, 0)) != 0
		ORDER BY balance_paise DESC`

	tid := s.tenantID()
	rows, err := s.db.Query(q, tid, tid, tid)
	if err != nil {
		return nil, fmt.Errorf("company outstanding query: %w", err)
	}
	defer rows.Close()

	list := make([]OutstandingRow, 0)
	for rows.Next() {
		var r OutstandingRow
		if err := rows.Scan(&r.PartyID, &r.PartyName, &r.TotalPaise, &r.PaidPaise, &r.BalancePaise); err != nil {
			return nil, err
		}
		list = append(list, r)
	}
	return list, nil
}

// ─── 5. SaleSummary ────────────────────────────────────────────────────────

func (s *Service) SaleSummary(from, to string) ([]SaleSummaryRow, error) {
	q := `SELECT sale_date,
		COUNT(*) as invoice_count,
		SUM(total_paise) as total_paise,
		SUM(cash_paise) as cash_paise,
		SUM(upi_paise) as upi_paise,
		SUM(card_paise) as card_paise,
		SUM(credit_paise) as credit_paise
		FROM (
			SELECT date(i.created_at) as sale_date, i.total_paise,
				COALESCE(SUM(CASE WHEN ip.method = 'CASH' THEN ip.amount_paise ELSE 0 END), 0) as cash_paise,
				COALESCE(SUM(CASE WHEN ip.method = 'UPI' THEN ip.amount_paise ELSE 0 END), 0) as upi_paise,
				COALESCE(SUM(CASE WHEN ip.method = 'CARD' THEN ip.amount_paise ELSE 0 END), 0) as card_paise,
				COALESCE(SUM(CASE WHEN ip.method = 'CREDIT' THEN ip.amount_paise ELSE 0 END), 0) as credit_paise
			FROM invoices i
			LEFT JOIN invoice_payments ip ON ip.invoice_id = i.id
			WHERE i.tenant_id = ? AND i.status = 'FINAL' AND i.deleted_at IS NULL`
	args := []interface{}{s.tenantID()}

	if from != "" && to != "" {
		q += ` AND i.created_at >= ? AND date(i.created_at) <= ?`
		args = append(args, from, to)
	}
	q += ` GROUP BY i.id) sub GROUP BY sale_date ORDER BY sale_date DESC`

	rows, err := s.db.Query(q, args...)
	if err != nil {
		return nil, fmt.Errorf("sale summary query: %w", err)
	}
	defer rows.Close()

	list := make([]SaleSummaryRow, 0)
	for rows.Next() {
		var r SaleSummaryRow
		if err := rows.Scan(&r.Date, &r.InvoiceCount, &r.TotalPaise,
			&r.CashPaise, &r.UPIPaise, &r.CardPaise, &r.CreditPaise); err != nil {
			return nil, err
		}
		list = append(list, r)
	}
	return list, nil
}

// ─── 6. PurchaseSummary ────────────────────────────────────────────────────

func (s *Service) PurchaseSummary(from, to string) ([]PurchaseSummaryRow, error) {
	q := `SELECT po.order_date,
		COUNT(*) as order_count,
		SUM(po.total_paise) as total_paise
		FROM purchase_orders po
		WHERE po.tenant_id = ?`
	args := []interface{}{s.tenantID()}

	if from != "" && to != "" {
		q += ` AND po.order_date >= ? AND date(po.order_date) <= ?`
		args = append(args, from, to)
	}
	q += ` GROUP BY po.order_date ORDER BY po.order_date DESC`

	rows, err := s.db.Query(q, args...)
	if err != nil {
		return nil, fmt.Errorf("purchase summary query: %w", err)
	}
	defer rows.Close()

	list := make([]PurchaseSummaryRow, 0)
	for rows.Next() {
		var r PurchaseSummaryRow
		if err := rows.Scan(&r.Date, &r.OrderCount, &r.TotalPaise); err != nil {
			return nil, err
		}
		list = append(list, r)
	}
	return list, nil
}

// ─── 7. PaymentDetails ────────────────────────────────────────────────────

func (s *Service) PaymentDetails(from, to string) ([]PaymentDetailRow, error) {
	q := `SELECT pe.id, pe.entry_date, COALESCE(pe.party_type,''),
		COALESCE(
			CASE pe.party_type
				WHEN 'CUSTOMER' THEN c.name
				WHEN 'COMPANY' THEN co.name
				WHEN 'EMPLOYEE' THEN emp.name
				ELSE ''
			END, ''
		) as party_name,
		pe.payment_method, pe.amount_paise,
		COALESCE(pe.reference_number,''), COALESCE(pe.narration,'')
		FROM payment_entries pe
		LEFT JOIN customers c ON pe.party_type = 'CUSTOMER' AND pe.party_id = c.id
		LEFT JOIN companies co ON pe.party_type = 'COMPANY' AND pe.party_id = co.id
		LEFT JOIN employees emp ON pe.party_type = 'EMPLOYEE' AND pe.party_id = emp.id
		WHERE pe.tenant_id = ?`
	args := []interface{}{s.tenantID()}

	if from != "" && to != "" {
		q += ` AND pe.entry_date >= ? AND date(pe.entry_date) <= ?`
		args = append(args, from, to)
	}
	q += ` ORDER BY pe.entry_date DESC`

	rows, err := s.db.Query(q, args...)
	if err != nil {
		return nil, fmt.Errorf("payment details query: %w", err)
	}
	defer rows.Close()

	list := make([]PaymentDetailRow, 0)
	for rows.Next() {
		var r PaymentDetailRow
		if err := rows.Scan(&r.ID, &r.Date, &r.PartyType, &r.PartyName,
			&r.PaymentMethod, &r.AmountPaise, &r.Reference, &r.Narration); err != nil {
			return nil, err
		}
		list = append(list, r)
	}
	return list, nil
}

// ─── 8. OrderList ──────────────────────────────────────────────────────────

func (s *Service) OrderList(status string) ([]OrderRow, error) {
	q := `SELECT id, order_type, order_number, date, party_name, status, total_paise FROM (
		SELECT po.id, 'PURCHASE' as order_type, po.order_number, po.order_date as date,
			COALESCE(co.name,'') as party_name, po.status, po.total_paise
		FROM purchase_orders po
		LEFT JOIN companies co ON po.company_id = co.id
		WHERE po.tenant_id = ?
		UNION ALL
		SELECT so.id, 'SALE' as order_type, so.order_number, so.order_date as date,
			COALESCE(c.name,'') as party_name, so.status, so.total_paise
		FROM sale_orders so
		LEFT JOIN customers c ON so.customer_id = c.id
		WHERE so.tenant_id = ?
	) combined`
	tid := s.tenantID()
	args := []interface{}{tid, tid}

	if status != "" {
		q += ` WHERE status = ?`
		args = append(args, status)
	}
	q += ` ORDER BY date DESC`

	rows, err := s.db.Query(q, args...)
	if err != nil {
		return nil, fmt.Errorf("order list query: %w", err)
	}
	defer rows.Close()

	list := make([]OrderRow, 0)
	for rows.Next() {
		var r OrderRow
		if err := rows.Scan(&r.ID, &r.OrderType, &r.OrderNumber, &r.Date,
			&r.PartyName, &r.Status, &r.TotalPaise); err != nil {
			return nil, err
		}
		list = append(list, r)
	}
	return list, nil
}

// ─── 9. CustomerInvoices ───────────────────────────────────────────────────

func (s *Service) CustomerInvoices(customerID string) ([]models.Invoice, error) {
	q := `SELECT i.id, i.tenant_id, i.store_id, COALESCE(i.device_id,''), i.invoice_number,
		COALESCE(i.customer_id,''), COALESCE(c.name,''), i.status,
		i.subtotal_paise, i.discount_paise, i.tax_paise, i.roundoff_paise, i.total_paise,
		COALESCE(i.notes,''), i.created_at
		FROM invoices i
		LEFT JOIN customers c ON c.id = i.customer_id
		WHERE i.tenant_id = ? AND i.customer_id = ? AND i.status = 'FINAL' AND i.deleted_at IS NULL
		ORDER BY i.created_at DESC`

	rows, err := s.db.Query(q, s.tenantID(), customerID)
	if err != nil {
		return nil, fmt.Errorf("customer invoices query: %w", err)
	}
	defer rows.Close()

	list := make([]models.Invoice, 0)
	for rows.Next() {
		var inv models.Invoice
		if err := rows.Scan(&inv.ID, &inv.TenantID, &inv.StoreID, &inv.DeviceID,
			&inv.InvoiceNumber, &inv.CustomerID, &inv.CustomerName, &inv.Status,
			&inv.SubtotalPaise, &inv.DiscountPaise, &inv.TaxPaise, &inv.RoundoffPaise,
			&inv.TotalPaise, &inv.Notes, &inv.CreatedAt); err != nil {
			return nil, err
		}
		list = append(list, inv)
	}
	return list, nil
}

// ─── 10. InvoicesReport ────────────────────────────────────────────────────

func (s *Service) InvoicesReport(from, to string) ([]models.Invoice, error) {
	q := `SELECT i.id, i.tenant_id, i.store_id, COALESCE(i.device_id,''), i.invoice_number,
		COALESCE(i.customer_id,''), COALESCE(c.name,''), i.status,
		i.subtotal_paise, i.discount_paise, i.tax_paise, i.roundoff_paise, i.total_paise,
		COALESCE(i.notes,''), i.created_at
		FROM invoices i
		LEFT JOIN customers c ON c.id = i.customer_id
		WHERE i.tenant_id = ? AND i.status = 'FINAL' AND i.deleted_at IS NULL`
	args := []interface{}{s.tenantID()}

	if from != "" && to != "" {
		q += ` AND i.created_at >= ? AND date(i.created_at) <= ?`
		args = append(args, from, to)
	}
	q += ` ORDER BY i.created_at DESC`

	rows, err := s.db.Query(q, args...)
	if err != nil {
		return nil, fmt.Errorf("invoices report query: %w", err)
	}
	defer rows.Close()

	list := make([]models.Invoice, 0)
	for rows.Next() {
		var inv models.Invoice
		if err := rows.Scan(&inv.ID, &inv.TenantID, &inv.StoreID, &inv.DeviceID,
			&inv.InvoiceNumber, &inv.CustomerID, &inv.CustomerName, &inv.Status,
			&inv.SubtotalPaise, &inv.DiscountPaise, &inv.TaxPaise, &inv.RoundoffPaise,
			&inv.TotalPaise, &inv.Notes, &inv.CreatedAt); err != nil {
			return nil, err
		}
		list = append(list, inv)
	}
	return list, nil
}

// ═══════════════════════════════════════════════════════════════════════════
// GROUP 1 — Inventory Summary Reports
// ═══════════════════════════════════════════════════════════════════════════

type BrandSummaryRow struct {
	BrandName        string `json:"brandName"`
	SaleQtyMillis    int64  `json:"saleQtyMillis"`
	SaleAmountPaise  int64  `json:"saleAmountPaise"`
	PurchQtyMillis   int64  `json:"purchQtyMillis"`
	PurchAmountPaise int64  `json:"purchAmountPaise"`
}

type PartySummaryRow struct {
	PartyName        string `json:"partyName"`
	PartyType        string `json:"partyType"`
	SaleAmountPaise  int64  `json:"saleAmountPaise"`
	PurchAmountPaise int64  `json:"purchAmountPaise"`
	BalancePaise     int64  `json:"balancePaise"`
}

type CategorySummaryRow struct {
	CategoryName     string `json:"categoryName"`
	SaleQtyMillis    int64  `json:"saleQtyMillis"`
	SaleAmountPaise  int64  `json:"saleAmountPaise"`
	PurchQtyMillis   int64  `json:"purchQtyMillis"`
	PurchAmountPaise int64  `json:"purchAmountPaise"`
}

type ItemSummaryRow struct {
	ItemName         string `json:"itemName"`
	SKU              string `json:"sku"`
	SaleQtyMillis    int64  `json:"saleQtyMillis"`
	SaleAmountPaise  int64  `json:"saleAmountPaise"`
	PurchQtyMillis   int64  `json:"purchQtyMillis"`
	PurchAmountPaise int64  `json:"purchAmountPaise"`
}

type ItemSaleQtyRow struct {
	ItemName        string `json:"itemName"`
	SKU             string `json:"sku"`
	CategoryName    string `json:"categoryName"`
	BrandName       string `json:"brandName"`
	QtySoldMillis   int64  `json:"qtySoldMillis"`
	SaleAmountPaise int64  `json:"saleAmountPaise"`
}

type EmployeeSaleRow struct {
	EmployeeName    string `json:"employeeName"`
	SaleCount       int    `json:"saleCount"`
	SaleAmountPaise int64  `json:"saleAmountPaise"`
	ReturnsPaise    int64  `json:"returnsPaise"`
	NetAmountPaise  int64  `json:"netAmountPaise"`
}

type AccountLineItem struct {
	Account     string `json:"account"`
	AmountPaise int64  `json:"amountPaise"`
}

type TradingAccountResult struct {
	DebitItems  []AccountLineItem `json:"debitItems"`
	CreditItems []AccountLineItem `json:"creditItems"`
}

type ProfitLossResult struct {
	Expenses []AccountLineItem `json:"expenses"`
	Income   []AccountLineItem `json:"income"`
}

type TrialBalanceRow struct {
	AccountName string `json:"accountName"`
	DebitPaise  int64  `json:"debitPaise"`
	CreditPaise int64  `json:"creditPaise"`
}

type BalanceSheetResult struct {
	Liabilities []AccountLineItem `json:"liabilities"`
	Assets      []AccountLineItem `json:"assets"`
}

type RojmelEntry struct {
	Date         string `json:"date"`
	Particulars  string `json:"particulars"`
	VoucherNo    string `json:"voucherNo"`
	ReceiptPaise int64  `json:"receiptPaise"`
	PaymentPaise int64  `json:"paymentPaise"`
	BalancePaise int64  `json:"balancePaise"`
}

type RojmelResult struct {
	OpeningBalancePaise int64         `json:"openingBalancePaise"`
	Entries             []RojmelEntry `json:"entries"`
}

type TCSReportRow struct {
	InvoiceNo      string `json:"invoiceNo"`
	Date           string `json:"date"`
	CustomerName   string `json:"customerName"`
	AmountPaise    int64  `json:"amountPaise"`
	TaxPercent     int    `json:"taxPercent"`
	TaxAmountPaise int64  `json:"taxAmountPaise"`
}

type GSTInvoiceRow struct {
	GSTIN        string `json:"gstin"`
	InvoiceNo    string `json:"invoiceNo"`
	Date         string `json:"date"`
	TaxablePaise int64  `json:"taxablePaise"`
	CGSTPaise    int64  `json:"cgstPaise"`
	SGSTPaise    int64  `json:"sgstPaise"`
	IGSTPaise    int64  `json:"igstPaise"`
	TotalPaise   int64  `json:"totalPaise"`
}

type GSTRateSummaryRow struct {
	RatePercent  int   `json:"ratePercent"`
	TaxablePaise int64 `json:"taxablePaise"`
	CGSTPaise    int64 `json:"cgstPaise"`
	SGSTPaise    int64 `json:"sgstPaise"`
	IGSTPaise    int64 `json:"igstPaise"`
	TotalPaise   int64 `json:"totalPaise"`
}

type GSTR3BSectionRow struct {
	Description  string `json:"description"`
	TaxablePaise int64  `json:"taxablePaise"`
	CGSTPaise    int64  `json:"cgstPaise"`
	SGSTPaise    int64  `json:"sgstPaise"`
	IGSTPaise    int64  `json:"igstPaise"`
	TotalPaise   int64  `json:"totalPaise"`
}

type GSTR3BResult struct {
	Outward    []GSTR3BSectionRow `json:"outward"`
	Inward     []GSTR3BSectionRow `json:"inward"`
	ITC        []GSTR3BSectionRow `json:"itc"`
	TaxPayable []GSTR3BSectionRow `json:"taxPayable"`
	// Summary cards (OS-Books style)
	OutputTaxPaise    int64 `json:"outputTaxPaise"`
	ITCAvailablePaise int64 `json:"itcAvailablePaise"`
	NetPayablePaise   int64 `json:"netPayablePaise"`
	// Accounting Health Check: each item is a cross-check with ok/warn status.
	HealthChecks []HealthCheck `json:"healthChecks"`
}

type HealthCheck struct {
	Label  string `json:"label"`
	Detail string `json:"detail"`
	OK     bool   `json:"ok"`
}

// ── GSTR-1 section summary (OS-Books "GSTR1 Summary") ──
type GSTR1Section struct {
	Section      string `json:"section"`
	Records      int    `json:"records"`
	InvoicePaise int64  `json:"invoicePaise"`
	TaxablePaise int64  `json:"taxablePaise"`
	IGSTPaise    int64  `json:"igstPaise"`
	CGSTPaise    int64  `json:"cgstPaise"`
	SGSTPaise    int64  `json:"sgstPaise"`
}

type GSTR1SummaryResult struct {
	Sections          []GSTR1Section  `json:"sections"`
	HSN               []HSNSummaryRow `json:"hsn"`
	TotalTaxablePaise int64           `json:"totalTaxablePaise"`
	TotalTaxPaise     int64           `json:"totalTaxPaise"`
}

// ── GSTR-2B ITC availability ──
type GSTR2BCategory struct {
	Category      string `json:"category"`
	Invoices      int    `json:"invoices"`
	TaxablePaise  int64  `json:"taxablePaise"`
	IGSTPaise     int64  `json:"igstPaise"`
	CGSTPaise     int64  `json:"cgstPaise"`
	SGSTPaise     int64  `json:"sgstPaise"`
	TotalITCPaise int64  `json:"totalItcPaise"`
}

type GSTR2BResult struct {
	Registered    GSTR2BCategory `json:"registered"`
	Unregistered  GSTR2BCategory `json:"unregistered"`
	TotalEligible GSTR2BCategory `json:"totalEligible"`
}

type GSTWiseRow struct {
	RatePercent       int   `json:"ratePercent"`
	SaleTaxablePaise  int64 `json:"saleTaxablePaise"`
	SaleTaxPaise      int64 `json:"saleTaxPaise"`
	PurchTaxablePaise int64 `json:"purchTaxablePaise"`
	PurchTaxPaise     int64 `json:"purchTaxPaise"`
}

type HSNSummaryRow struct {
	HSNCode      string `json:"hsnCode"`
	Description  string `json:"description"`
	QtyMillis    int64  `json:"qtyMillis"`
	TaxablePaise int64  `json:"taxablePaise"`
	TaxPaise     int64  `json:"taxPaise"`
	TotalPaise   int64  `json:"totalPaise"`
}

// ─── 11. BrandwiseSummary ─────────────────────────────────────────────────

func (s *Service) BrandwiseSummary(from, to string) ([]BrandSummaryRow, error) {
	tid := s.tenantID()
	q := `SELECT COALESCE(b.name, 'No Brand'), COALESCE(SUM(ii.quantity_millis), 0), COALESCE(SUM(ii.total_paise), 0)
		FROM invoice_items ii JOIN invoices i ON ii.invoice_id = i.id
		JOIN products p ON ii.product_id = p.id LEFT JOIN brands b ON p.brand_id = b.id
		WHERE i.tenant_id = ? AND i.status = 'FINAL' AND i.deleted_at IS NULL`
	args := []interface{}{tid}
	if from != "" && to != "" {
		q += ` AND i.created_at >= ? AND date(i.created_at) <= ?`
		args = append(args, from, to)
	}
	q += ` GROUP BY COALESCE(b.name, 'No Brand') ORDER BY 3 DESC`
	rows, err := s.db.Query(q, args...)
	if err != nil {
		return nil, fmt.Errorf("brandwise summary: %w", err)
	}
	defer rows.Close()
	bm := map[string]*BrandSummaryRow{}
	var order []string
	for rows.Next() {
		var r BrandSummaryRow
		if err := rows.Scan(&r.BrandName, &r.SaleQtyMillis, &r.SaleAmountPaise); err != nil {
			return nil, err
		}
		bm[r.BrandName] = &r
		order = append(order, r.BrandName)
	}
	q2 := `SELECT COALESCE(b.name, 'No Brand'), COALESCE(SUM(pi.quantity_millis), 0), COALESCE(SUM(pi.total_paise), 0)
		FROM purchase_order_items pi JOIN purchase_orders pb ON pi.order_id = pb.id
		JOIN products p ON pi.product_id = p.id LEFT JOIN brands b ON p.brand_id = b.id
		WHERE pb.tenant_id = ? AND pb.status = 'RECEIVED'`
	args2 := []interface{}{tid}
	if from != "" && to != "" {
		q2 += ` AND date(pb.order_date) >= ? AND date(pb.order_date) <= ?`
		args2 = append(args2, from, to)
	}
	q2 += ` GROUP BY COALESCE(b.name, 'No Brand')`
	rows2, err := s.db.Query(q2, args2...)
	if err != nil {
		return nil, fmt.Errorf("brandwise purch: %w", err)
	}
	defer rows2.Close()
	for rows2.Next() {
		var nm string
		var qty, amt int64
		if err := rows2.Scan(&nm, &qty, &amt); err != nil {
			return nil, err
		}
		if r, ok := bm[nm]; ok {
			r.PurchQtyMillis = qty
			r.PurchAmountPaise = amt
		} else {
			bm[nm] = &BrandSummaryRow{BrandName: nm, PurchQtyMillis: qty, PurchAmountPaise: amt}
			order = append(order, nm)
		}
	}
	out := make([]BrandSummaryRow, 0, len(order))
	for _, n := range order {
		out = append(out, *bm[n])
	}
	return out, nil
}

// ─── 12. PartywiseSummary ─────────────────────────────────────────────────

func (s *Service) PartywiseSummary(from, to string) ([]PartySummaryRow, error) {
	tid := s.tenantID()
	list := make([]PartySummaryRow, 0)
	q := `SELECT COALESCE(c.name, 'Walk-in'), 'Customer', COALESCE(SUM(i.total_paise), 0)
		FROM invoices i LEFT JOIN customers c ON i.customer_id = c.id
		WHERE i.tenant_id = ? AND i.status = 'FINAL' AND i.deleted_at IS NULL`
	args := []interface{}{tid}
	if from != "" && to != "" {
		q += ` AND i.created_at >= ? AND date(i.created_at) <= ?`
		args = append(args, from, to)
	}
	q += ` GROUP BY 1 ORDER BY 3 DESC`
	rows, err := s.db.Query(q, args...)
	if err != nil {
		return nil, fmt.Errorf("partywise customers: %w", err)
	}
	defer rows.Close()
	for rows.Next() {
		var r PartySummaryRow
		if err := rows.Scan(&r.PartyName, &r.PartyType, &r.SaleAmountPaise); err != nil {
			return nil, err
		}
		r.BalancePaise = r.SaleAmountPaise
		list = append(list, r)
	}
	q2 := `SELECT COALESCE(co.name, 'Unknown'), 'Company', COALESCE(SUM(po.total_paise), 0)
		FROM purchase_orders po LEFT JOIN companies co ON po.company_id = co.id
		WHERE po.tenant_id = ?`
	args2 := []interface{}{tid}
	if from != "" && to != "" {
		q2 += ` AND po.order_date >= ? AND date(po.order_date) <= ?`
		args2 = append(args2, from, to)
	}
	q2 += ` GROUP BY 1 ORDER BY 3 DESC`
	rows2, err := s.db.Query(q2, args2...)
	if err != nil {
		return nil, fmt.Errorf("partywise companies: %w", err)
	}
	defer rows2.Close()
	for rows2.Next() {
		var r PartySummaryRow
		if err := rows2.Scan(&r.PartyName, &r.PartyType, &r.PurchAmountPaise); err != nil {
			return nil, err
		}
		r.BalancePaise = -r.PurchAmountPaise
		list = append(list, r)
	}
	return list, nil
}

// ─── 13. CategorywiseSummary ──────────────────────────────────────────────

func (s *Service) CategorywiseSummary(from, to string) ([]CategorySummaryRow, error) {
	tid := s.tenantID()
	q := `SELECT COALESCE(cat.name, 'Uncategorized'), COALESCE(SUM(ii.quantity_millis), 0), COALESCE(SUM(ii.total_paise), 0)
		FROM invoice_items ii JOIN invoices i ON ii.invoice_id = i.id
		JOIN products p ON ii.product_id = p.id LEFT JOIN categories cat ON p.category_id = cat.id
		WHERE i.tenant_id = ? AND i.status = 'FINAL' AND i.deleted_at IS NULL`
	args := []interface{}{tid}
	if from != "" && to != "" {
		q += ` AND i.created_at >= ? AND date(i.created_at) <= ?`
		args = append(args, from, to)
	}
	q += ` GROUP BY 1 ORDER BY 3 DESC`
	rows, err := s.db.Query(q, args...)
	if err != nil {
		return nil, fmt.Errorf("categorywise summary: %w", err)
	}
	defer rows.Close()
	cm := map[string]*CategorySummaryRow{}
	var order []string
	for rows.Next() {
		var r CategorySummaryRow
		if err := rows.Scan(&r.CategoryName, &r.SaleQtyMillis, &r.SaleAmountPaise); err != nil {
			return nil, err
		}
		cm[r.CategoryName] = &r
		order = append(order, r.CategoryName)
	}
	q2 := `SELECT COALESCE(cat.name, 'Uncategorized'), COALESCE(SUM(pi.quantity_millis), 0), COALESCE(SUM(pi.total_paise), 0)
		FROM purchase_order_items pi JOIN purchase_orders pb ON pi.order_id = pb.id
		JOIN products p ON pi.product_id = p.id LEFT JOIN categories cat ON p.category_id = cat.id
		WHERE pb.tenant_id = ? AND pb.status = 'RECEIVED'`
	args2 := []interface{}{tid}
	if from != "" && to != "" {
		q2 += ` AND date(pb.order_date) >= ? AND date(pb.order_date) <= ?`
		args2 = append(args2, from, to)
	}
	q2 += ` GROUP BY 1`
	rows2, err := s.db.Query(q2, args2...)
	if err != nil {
		return nil, fmt.Errorf("categorywise purch: %w", err)
	}
	defer rows2.Close()
	for rows2.Next() {
		var nm string
		var qty, amt int64
		if err := rows2.Scan(&nm, &qty, &amt); err != nil {
			return nil, err
		}
		if r, ok := cm[nm]; ok {
			r.PurchQtyMillis = qty
			r.PurchAmountPaise = amt
		} else {
			cm[nm] = &CategorySummaryRow{CategoryName: nm, PurchQtyMillis: qty, PurchAmountPaise: amt}
			order = append(order, nm)
		}
	}
	out := make([]CategorySummaryRow, 0, len(order))
	for _, n := range order {
		out = append(out, *cm[n])
	}
	return out, nil
}

// ─── 14. ItemwiseSummary ──────────────────────────────────────────────────

func (s *Service) ItemwiseSummary(from, to string) ([]ItemSummaryRow, error) {
	tid := s.tenantID()
	q := `SELECT p.name, COALESCE(p.sku, ''), COALESCE(SUM(ii.quantity_millis), 0), COALESCE(SUM(ii.total_paise), 0)
		FROM invoice_items ii JOIN invoices i ON ii.invoice_id = i.id
		JOIN products p ON ii.product_id = p.id
		WHERE i.tenant_id = ? AND i.status = 'FINAL' AND i.deleted_at IS NULL`
	args := []interface{}{tid}
	if from != "" && to != "" {
		q += ` AND i.created_at >= ? AND date(i.created_at) <= ?`
		args = append(args, from, to)
	}
	q += ` GROUP BY p.id, p.name, p.sku ORDER BY 4 DESC`
	rows, err := s.db.Query(q, args...)
	if err != nil {
		return nil, fmt.Errorf("itemwise summary: %w", err)
	}
	defer rows.Close()
	im := map[string]*ItemSummaryRow{}
	var order []string
	for rows.Next() {
		var r ItemSummaryRow
		if err := rows.Scan(&r.ItemName, &r.SKU, &r.SaleQtyMillis, &r.SaleAmountPaise); err != nil {
			return nil, err
		}
		k := r.ItemName + "|" + r.SKU
		im[k] = &r
		order = append(order, k)
	}
	q2 := `SELECT p.name, COALESCE(p.sku, ''), COALESCE(SUM(pi.quantity_millis), 0), COALESCE(SUM(pi.total_paise), 0)
		FROM purchase_order_items pi JOIN purchase_orders pb ON pi.order_id = pb.id
		JOIN products p ON pi.product_id = p.id
		WHERE pb.tenant_id = ? AND pb.status = 'RECEIVED'`
	args2 := []interface{}{tid}
	if from != "" && to != "" {
		q2 += ` AND date(pb.order_date) >= ? AND date(pb.order_date) <= ?`
		args2 = append(args2, from, to)
	}
	q2 += ` GROUP BY p.id, p.name, p.sku`
	rows2, err := s.db.Query(q2, args2...)
	if err != nil {
		return nil, fmt.Errorf("itemwise purch: %w", err)
	}
	defer rows2.Close()
	for rows2.Next() {
		var nm, sku string
		var qty, amt int64
		if err := rows2.Scan(&nm, &sku, &qty, &amt); err != nil {
			return nil, err
		}
		k := nm + "|" + sku
		if r, ok := im[k]; ok {
			r.PurchQtyMillis = qty
			r.PurchAmountPaise = amt
		} else {
			im[k] = &ItemSummaryRow{ItemName: nm, SKU: sku, PurchQtyMillis: qty, PurchAmountPaise: amt}
			order = append(order, k)
		}
	}
	out := make([]ItemSummaryRow, 0, len(order))
	for _, k := range order {
		out = append(out, *im[k])
	}
	return out, nil
}

// ─── 15. ItemSaleQty ──────────────────────────────────────────────────────

func (s *Service) ItemSaleQty(from, to string) ([]ItemSaleQtyRow, error) {
	tid := s.tenantID()
	q := `SELECT p.name, COALESCE(p.sku, ''), COALESCE(cat.name, ''), COALESCE(b.name, ''),
		COALESCE(SUM(ii.quantity_millis), 0), COALESCE(SUM(ii.total_paise), 0)
		FROM invoice_items ii JOIN invoices i ON ii.invoice_id = i.id
		JOIN products p ON ii.product_id = p.id
		LEFT JOIN categories cat ON p.category_id = cat.id LEFT JOIN brands b ON p.brand_id = b.id
		WHERE i.tenant_id = ? AND i.status = 'FINAL' AND i.deleted_at IS NULL`
	args := []interface{}{tid}
	if from != "" && to != "" {
		q += ` AND i.created_at >= ? AND date(i.created_at) <= ?`
		args = append(args, from, to)
	}
	q += ` GROUP BY p.id, p.name, p.sku, cat.name, b.name ORDER BY 5 DESC`
	rows, err := s.db.Query(q, args...)
	if err != nil {
		return nil, fmt.Errorf("item sale qty: %w", err)
	}
	defer rows.Close()
	list := make([]ItemSaleQtyRow, 0)
	for rows.Next() {
		var r ItemSaleQtyRow
		if err := rows.Scan(&r.ItemName, &r.SKU, &r.CategoryName, &r.BrandName, &r.QtySoldMillis, &r.SaleAmountPaise); err != nil {
			return nil, err
		}
		list = append(list, r)
	}
	return list, nil
}

// ─── 16. EmployeewiseSale ─────────────────────────────────────────────────
// Note: invoices don't have a salesperson field; returns empty until added.

func (s *Service) EmployeewiseSale(from, to string) ([]EmployeeSaleRow, error) {
	return []EmployeeSaleRow{}, nil
}

// ─── 17. TradingAccount ──────────────────────────────────────────────────

func (s *Service) TradingAccount(from, to string) (*TradingAccountResult, error) {
	tid := s.tenantID()
	res := &TradingAccountResult{DebitItems: make([]AccountLineItem, 0), CreditItems: make([]AccountLineItem, 0)}
	var purchTotal int64
	q := `SELECT COALESCE(SUM(total_paise), 0) FROM purchase_orders WHERE tenant_id = ? AND status = 'RECEIVED'`
	a := []interface{}{tid}
	if from != "" && to != "" {
		q += ` AND date(order_date) >= ? AND date(order_date) <= ?`
		a = append(a, from, to)
	}
	s.db.QueryRow(q, a...).Scan(&purchTotal)
	res.DebitItems = append(res.DebitItems, AccountLineItem{Account: "Purchases", AmountPaise: purchTotal})
	var stockVal int64
	// Closing stock valued at COST (standard accounting), not MRP. Cost per unit =
	// purchase price if entered, else a cost/wholesale price tier (CMP), else MRP.
	// Negative (oversold) quantities are floored at 0 so they can't subtract value.
	s.db.QueryRow(stockValueAtCostQuery, s.tenantID()).Scan(&stockVal)
	res.DebitItems = append(res.DebitItems, AccountLineItem{Account: "Opening Stock", AmountPaise: stockVal})
	var salesTotal int64
	q3 := `SELECT COALESCE(SUM(total_paise), 0) FROM invoices WHERE tenant_id = ? AND status = 'FINAL' AND deleted_at IS NULL`
	a3 := []interface{}{tid}
	if from != "" && to != "" {
		q3 += ` AND created_at >= ? AND date(created_at) <= ?`
		a3 = append(a3, from, to)
	}
	s.db.QueryRow(q3, a3...).Scan(&salesTotal)
	res.CreditItems = append(res.CreditItems, AccountLineItem{Account: "Sales", AmountPaise: salesTotal})
	res.CreditItems = append(res.CreditItems, AccountLineItem{Account: "Closing Stock", AmountPaise: stockVal})
	return res, nil
}

// ─── 18. ProfitLoss ──────────────────────────────────────────────────────

func (s *Service) ProfitLoss(from, to string) (*ProfitLossResult, error) {
	tid := s.tenantID()
	res := &ProfitLossResult{Expenses: make([]AccountLineItem, 0), Income: make([]AccountLineItem, 0)}
	trading, err := s.TradingAccount(from, to)
	if err != nil {
		return nil, err
	}
	var td, tc int64
	for _, d := range trading.DebitItems {
		td += d.AmountPaise
	}
	for _, c := range trading.CreditItems {
		tc += c.AmountPaise
	}
	gp := tc - td
	if gp > 0 {
		res.Income = append(res.Income, AccountLineItem{Account: "Gross Profit b/f", AmountPaise: gp})
	} else {
		res.Expenses = append(res.Expenses, AccountLineItem{Account: "Gross Loss b/f", AmountPaise: -gp})
	}
	q := `SELECT COALESCE(em.name, 'Other Expenses'), SUM(ee.amount_paise) FROM expense_entries ee LEFT JOIN expense_master em ON ee.expense_id = em.id WHERE ee.tenant_id = ?`
	a := []interface{}{tid}
	if from != "" && to != "" {
		q += ` AND ee.entry_date >= ? AND date(ee.entry_date) <= ?`
		a = append(a, from, to)
	}
	q += ` GROUP BY em.name ORDER BY 2 DESC`
	rows, err := s.db.Query(q, a...)
	if err != nil {
		return nil, fmt.Errorf("pnl expenses: %w", err)
	}
	defer rows.Close()
	for rows.Next() {
		var li AccountLineItem
		if err := rows.Scan(&li.Account, &li.AmountPaise); err != nil {
			return nil, err
		}
		res.Expenses = append(res.Expenses, li)
	}
	q2 := `SELECT COALESCE(im.name, 'Other Income'), SUM(ie.amount_paise) FROM income_entries ie LEFT JOIN income_master im ON ie.income_id = im.id WHERE ie.tenant_id = ?`
	a2 := []interface{}{tid}
	if from != "" && to != "" {
		q2 += ` AND ie.entry_date >= ? AND date(ie.entry_date) <= ?`
		a2 = append(a2, from, to)
	}
	q2 += ` GROUP BY im.name ORDER BY 2 DESC`
	rows2, err := s.db.Query(q2, a2...)
	if err != nil {
		return nil, fmt.Errorf("pnl income: %w", err)
	}
	defer rows2.Close()
	for rows2.Next() {
		var li AccountLineItem
		if err := rows2.Scan(&li.Account, &li.AmountPaise); err != nil {
			return nil, err
		}
		res.Income = append(res.Income, li)
	}
	return res, nil
}

// ─── 19. TrialBalance ────────────────────────────────────────────────────

func (s *Service) TrialBalance(asOfDate string) ([]TrialBalanceRow, error) {
	tid := s.tenantID()
	list := make([]TrialBalanceRow, 0)
	dt := asOfDate
	if dt == "" {
		dt = "9999-12-31"
	}
	// Customer receivables
	r1, _ := s.db.Query(`SELECT 'Customers - ' || c.name,
		COALESCE(inv.t, 0) - COALESCE(paid.t, 0) FROM customers c
		LEFT JOIN (SELECT customer_id, SUM(total_paise) t FROM invoices WHERE status='FINAL' AND deleted_at IS NULL AND tenant_id=? AND date(created_at)<=? GROUP BY customer_id) inv ON inv.customer_id=c.id
		LEFT JOIN (SELECT i.customer_id, SUM(ip.amount_paise) t FROM invoice_payments ip JOIN invoices i ON ip.invoice_id=i.id WHERE i.status='FINAL' AND i.deleted_at IS NULL AND i.tenant_id=? AND date(i.created_at)<=? GROUP BY i.customer_id) paid ON paid.customer_id=c.id
		WHERE c.tenant_id=? AND (COALESCE(inv.t,0)-COALESCE(paid.t,0))!=0`, tid, dt, tid, dt, tid)
	if r1 != nil {
		defer r1.Close()
		for r1.Next() {
			var nm string
			var bal int64
			r1.Scan(&nm, &bal)
			row := TrialBalanceRow{AccountName: nm}
			if bal > 0 {
				row.DebitPaise = bal
			} else {
				row.CreditPaise = -bal
			}
			list = append(list, row)
		}
	}
	// Company payables
	r2, _ := s.db.Query(`SELECT 'Companies - ' || co.name,
		COALESCE(po.t, 0) - COALESCE(paid.t, 0) FROM companies co
		LEFT JOIN (SELECT company_id, SUM(total_paise) t FROM purchase_orders WHERE tenant_id=? AND date(order_date)<=? GROUP BY company_id) po ON po.company_id=co.id
		LEFT JOIN (SELECT party_id, SUM(amount_paise) t FROM payment_entries WHERE tenant_id=? AND party_type='COMPANY' AND date(entry_date)<=? GROUP BY party_id) paid ON paid.party_id=co.id
		WHERE co.tenant_id=? AND (COALESCE(po.t,0)-COALESCE(paid.t,0))!=0`, tid, dt, tid, dt, tid)
	if r2 != nil {
		defer r2.Close()
		for r2.Next() {
			var nm string
			var bal int64
			r2.Scan(&nm, &bal)
			row := TrialBalanceRow{AccountName: nm}
			if bal > 0 {
				row.CreditPaise = bal
			} else {
				row.DebitPaise = -bal
			}
			list = append(list, row)
		}
	}
	// Banks
	r3, _ := s.db.Query(`SELECT 'Bank - ' || bank_name, opening_balance_paise FROM bank_master WHERE tenant_id=?`, tid)
	if r3 != nil {
		defer r3.Close()
		for r3.Next() {
			var nm string
			var bal int64
			r3.Scan(&nm, &bal)
			row := TrialBalanceRow{AccountName: nm}
			if bal >= 0 {
				row.DebitPaise = bal
			} else {
				row.CreditPaise = -bal
			}
			list = append(list, row)
		}
	}
	// Expenses
	r4, _ := s.db.Query(`SELECT 'Expense - ' || COALESCE(em.name,'Other'), SUM(ee.amount_paise) FROM expense_entries ee LEFT JOIN expense_master em ON ee.expense_id=em.id WHERE ee.tenant_id=? AND date(ee.entry_date)<=? GROUP BY em.name`, tid, dt)
	if r4 != nil {
		defer r4.Close()
		for r4.Next() {
			var nm string
			var amt int64
			r4.Scan(&nm, &amt)
			list = append(list, TrialBalanceRow{AccountName: nm, DebitPaise: amt})
		}
	}
	// Income
	r5, _ := s.db.Query(`SELECT 'Income - ' || COALESCE(im.name,'Other'), SUM(ie.amount_paise) FROM income_entries ie LEFT JOIN income_master im ON ie.income_id=im.id WHERE ie.tenant_id=? AND date(ie.entry_date)<=? GROUP BY im.name`, tid, dt)
	if r5 != nil {
		defer r5.Close()
		for r5.Next() {
			var nm string
			var amt int64
			r5.Scan(&nm, &amt)
			list = append(list, TrialBalanceRow{AccountName: nm, CreditPaise: amt})
		}
	}
	// Sales
	var st int64
	s.db.QueryRow(`SELECT COALESCE(SUM(total_paise),0) FROM invoices WHERE tenant_id=? AND status='FINAL' AND deleted_at IS NULL AND date(created_at)<=?`, tid, dt).Scan(&st)
	if st > 0 {
		list = append(list, TrialBalanceRow{AccountName: "Sales", CreditPaise: st})
	}
	// Purchases
	var pt int64
	s.db.QueryRow(`SELECT COALESCE(SUM(total_paise),0) FROM purchase_orders WHERE tenant_id=? AND status='RECEIVED' AND date(order_date)<=date(?)`, tid, dt).Scan(&pt)
	if pt > 0 {
		list = append(list, TrialBalanceRow{AccountName: "Purchases", DebitPaise: pt})
	}
	return list, nil
}

// ─── 20. BalanceSheet ────────────────────────────────────────────────────

func (s *Service) BalanceSheet(asOfDate string) (*BalanceSheetResult, error) {
	tid := s.tenantID()
	res := &BalanceSheetResult{Liabilities: make([]AccountLineItem, 0), Assets: make([]AccountLineItem, 0)}
	dt := asOfDate
	if dt == "" {
		dt = "9999-12-31"
	}
	// Banks
	r1, _ := s.db.Query(`SELECT bank_name, opening_balance_paise FROM bank_master WHERE tenant_id=? AND is_active=1`, tid)
	if r1 != nil {
		defer r1.Close()
		for r1.Next() {
			var nm string
			var bal int64
			r1.Scan(&nm, &bal)
			res.Assets = append(res.Assets, AccountLineItem{Account: "Bank - " + nm, AmountPaise: bal})
		}
	}
	// Stock
	var sv int64
	// Closing stock valued at COST (see stockValueAtCostQuery).
	s.db.QueryRow(stockValueAtCostQuery, s.tenantID()).Scan(&sv)
	res.Assets = append(res.Assets, AccountLineItem{Account: "Stock in Hand", AmountPaise: sv})
	// Receivables
	var recv int64
	s.db.QueryRow(`SELECT COALESCE(SUM(COALESCE(inv.t,0)-COALESCE(paid.t,0)),0) FROM customers c
		LEFT JOIN (SELECT customer_id, SUM(total_paise) t FROM invoices WHERE status='FINAL' AND deleted_at IS NULL AND tenant_id=? AND date(created_at)<=? GROUP BY customer_id) inv ON inv.customer_id=c.id
		LEFT JOIN (SELECT i.customer_id, SUM(ip.amount_paise) t FROM invoice_payments ip JOIN invoices i ON ip.invoice_id=i.id WHERE i.status='FINAL' AND i.deleted_at IS NULL AND i.tenant_id=? AND date(i.created_at)<=? GROUP BY i.customer_id) paid ON paid.customer_id=c.id
		WHERE c.tenant_id=?`, tid, dt, tid, dt, tid).Scan(&recv)
	if recv > 0 {
		res.Assets = append(res.Assets, AccountLineItem{Account: "Sundry Debtors", AmountPaise: recv})
	}
	// Payables
	var pay int64
	s.db.QueryRow(`SELECT COALESCE(SUM(COALESCE(po.t,0)-COALESCE(paid.t,0)),0) FROM companies co
		LEFT JOIN (SELECT company_id, SUM(total_paise) t FROM purchase_orders WHERE tenant_id=? AND date(order_date)<=? GROUP BY company_id) po ON po.company_id=co.id
		LEFT JOIN (SELECT party_id, SUM(amount_paise) t FROM payment_entries WHERE tenant_id=? AND party_type='COMPANY' AND date(entry_date)<=? GROUP BY party_id) paid ON paid.party_id=co.id
		WHERE co.tenant_id=?`, tid, dt, tid, dt, tid).Scan(&pay)
	if pay > 0 {
		res.Liabilities = append(res.Liabilities, AccountLineItem{Account: "Sundry Creditors", AmountPaise: pay})
	}
	var ta, tl int64
	for _, a := range res.Assets {
		ta += a.AmountPaise
	}
	for _, l := range res.Liabilities {
		tl += l.AmountPaise
	}
	cap := ta - tl
	if cap > 0 {
		res.Liabilities = append(res.Liabilities, AccountLineItem{Account: "Capital Account", AmountPaise: cap})
	}
	return res, nil
}

// ─── 21. Rojmel ──────────────────────────────────────────────────────────

func (s *Service) Rojmel(date string) (*RojmelResult, error) {
	tid := s.tenantID()
	res := &RojmelResult{Entries: make([]RojmelEntry, 0)}
	// Cash sales
	r1, _ := s.db.Query(`SELECT i.invoice_number, 'Sale - ' || COALESCE(c.name,'Walk-in'), ip.amount_paise
		FROM invoice_payments ip JOIN invoices i ON ip.invoice_id=i.id
		LEFT JOIN customers c ON c.id = i.customer_id
		WHERE i.tenant_id=? AND ip.method='CASH' AND i.status='FINAL' AND i.deleted_at IS NULL AND date(i.created_at)=?`, tid, date)
	if r1 != nil {
		defer r1.Close()
		for r1.Next() {
			var vno, desc string
			var amt int64
			r1.Scan(&vno, &desc, &amt)
			res.Entries = append(res.Entries, RojmelEntry{Date: date, Particulars: desc, VoucherNo: vno, ReceiptPaise: amt})
		}
	}
	// Cash income
	r2, _ := s.db.Query(`SELECT COALESCE(im.name,'Income'), ie.amount_paise FROM income_entries ie LEFT JOIN income_master im ON ie.income_id=im.id WHERE ie.tenant_id=? AND ie.payment_method='CASH' AND ie.entry_date=?`, tid, date)
	if r2 != nil {
		defer r2.Close()
		for r2.Next() {
			var desc string
			var amt int64
			r2.Scan(&desc, &amt)
			res.Entries = append(res.Entries, RojmelEntry{Date: date, Particulars: desc, ReceiptPaise: amt})
		}
	}
	// Cash expenses
	r3, _ := s.db.Query(`SELECT COALESCE(em.name,'Expense'), ee.amount_paise FROM expense_entries ee LEFT JOIN expense_master em ON ee.expense_id=em.id WHERE ee.tenant_id=? AND ee.payment_method='CASH' AND ee.entry_date=?`, tid, date)
	if r3 != nil {
		defer r3.Close()
		for r3.Next() {
			var desc string
			var amt int64
			r3.Scan(&desc, &amt)
			res.Entries = append(res.Entries, RojmelEntry{Date: date, Particulars: desc, PaymentPaise: amt})
		}
	}
	// Cash payment entries
	r4, _ := s.db.Query(`SELECT COALESCE(pe.narration, pe.party_type || ' payment'), pe.amount_paise FROM payment_entries pe WHERE pe.tenant_id=? AND pe.payment_method='CASH' AND pe.entry_date=?`, tid, date)
	if r4 != nil {
		defer r4.Close()
		for r4.Next() {
			var desc string
			var amt int64
			r4.Scan(&desc, &amt)
			res.Entries = append(res.Entries, RojmelEntry{Date: date, Particulars: desc, PaymentPaise: amt})
		}
	}
	var running int64
	for i := range res.Entries {
		running += res.Entries[i].ReceiptPaise - res.Entries[i].PaymentPaise
		res.Entries[i].BalancePaise = running
	}
	return res, nil
}

// ─── 22. TCSReport ───────────────────────────────────────────────────────

// TCSReport — Tax Collected at Source u/s 206C(1H): a seller collects 0.1% TCS
// from a buyer once total sales to that buyer cross ₹50,00,000 in the period,
// on the amount above the threshold. For a small shop this is usually empty.
func (s *Service) TCSReport(from, to string) ([]TCSReportRow, error) {
	tid := s.tenantID()
	const thresholdPaise = int64(5000000) * 100 // ₹50,00,000
	q := `SELECT COALESCE(c.name,'Walk-in'), COALESCE(SUM(i.total_paise),0)
		FROM invoices i JOIN customers c ON i.customer_id = c.id
		WHERE i.tenant_id=? AND i.status='FINAL' AND i.deleted_at IS NULL`
	a := []interface{}{tid}
	if from != "" && to != "" {
		q += ` AND i.created_at >= ? AND date(i.created_at) <= ?`
		a = append(a, from, to)
	}
	q += ` GROUP BY c.id, c.name HAVING SUM(i.total_paise) > ? ORDER BY 2 DESC`
	a = append(a, thresholdPaise)
	rows, err := s.db.Query(q, a...)
	if err != nil {
		return nil, fmt.Errorf("tcs report: %w", err)
	}
	defer rows.Close()
	list := make([]TCSReportRow, 0)
	for rows.Next() {
		var name string
		var total int64
		if err := rows.Scan(&name, &total); err != nil {
			return nil, err
		}
		above := total - thresholdPaise
		list = append(list, TCSReportRow{
			CustomerName:   name,
			AmountPaise:    total,
			TaxPercent:     0,            // rate is 0.1% (shown as a fixed label in the UI)
			TaxAmountPaise: above / 1000, // 0.1% of the amount above ₹50L
		})
	}
	return list, nil
}

// ─── 23. GSTR1 ───────────────────────────────────────────────────────────

func (s *Service) GSTR1(from, to string) ([]GSTInvoiceRow, error) {
	tid := s.tenantID()
	store := s.storeStateCode()
	q := `SELECT COALESCE(c.gstin,''), i.invoice_number, date(i.created_at),
		(i.total_paise - i.tax_paise), i.tax_paise, i.total_paise
		FROM invoices i LEFT JOIN customers c ON i.customer_id=c.id
		WHERE i.tenant_id=? AND i.status='FINAL' AND i.deleted_at IS NULL`
	a := []interface{}{tid}
	if from != "" && to != "" {
		q += ` AND i.created_at >= ? AND date(i.created_at) <= ?`
		a = append(a, from, to)
	}
	q += ` ORDER BY i.created_at DESC`
	rows, err := s.db.Query(q, a...)
	if err != nil {
		return nil, fmt.Errorf("gstr1: %w", err)
	}
	defer rows.Close()
	list := make([]GSTInvoiceRow, 0)
	for rows.Next() {
		var r GSTInvoiceRow
		var taxPaise int64
		if err := rows.Scan(&r.GSTIN, &r.InvoiceNo, &r.Date, &r.TaxablePaise, &taxPaise, &r.TotalPaise); err != nil {
			return nil, err
		}
		r.CGSTPaise, r.SGSTPaise, r.IGSTPaise = splitTax(taxPaise, r.GSTIN, store)
		list = append(list, r)
	}
	return list, nil
}

// ─── 24. GSTR2 ───────────────────────────────────────────────────────────

func (s *Service) GSTR2(from, to string) ([]GSTInvoiceRow, error) {
	tid := s.tenantID()
	store := s.storeStateCode()
	q := `SELECT COALESCE(co.gstin,''), pb.order_number, date(pb.order_date),
		(pb.total_paise - pb.tax_paise), pb.tax_paise, pb.total_paise
		FROM purchase_orders pb LEFT JOIN companies co ON pb.company_id=co.id
		WHERE pb.tenant_id=? AND pb.status='RECEIVED'`
	a := []interface{}{tid}
	if from != "" && to != "" {
		q += ` AND date(pb.order_date) >= ? AND date(pb.order_date) <= ?`
		a = append(a, from, to)
	}
	q += ` ORDER BY pb.order_date DESC`
	rows, err := s.db.Query(q, a...)
	if err != nil {
		return nil, fmt.Errorf("gstr2: %w", err)
	}
	defer rows.Close()
	list := make([]GSTInvoiceRow, 0)
	for rows.Next() {
		var r GSTInvoiceRow
		var taxPaise int64
		if err := rows.Scan(&r.GSTIN, &r.InvoiceNo, &r.Date, &r.TaxablePaise, &taxPaise, &r.TotalPaise); err != nil {
			return nil, err
		}
		r.CGSTPaise, r.SGSTPaise, r.IGSTPaise = splitTax(taxPaise, r.GSTIN, store)
		list = append(list, r)
	}
	return list, nil
}

// ─── 25. GSTR3B ──────────────────────────────────────────────────────────

func (s *Service) GSTR3B(from, to string) (*GSTR3BResult, error) {
	tid := s.tenantID()
	res := &GSTR3BResult{
		Outward: make([]GSTR3BSectionRow, 0), Inward: make([]GSTR3BSectionRow, 0),
		ITC: make([]GSTR3BSectionRow, 0), TaxPayable: make([]GSTR3BSectionRow, 0),
	}
	store := s.storeStateCode()

	// Outward (sales) — split tax into IGST (inter-state) vs CGST+SGST (local).
	// Taxable value is tax-EXCLUSIVE (prices are MRP-inclusive): taxable = total − tax.
	var sSub, sIGST, sLocal int64
	q := `SELECT COALESCE(SUM(i.total_paise - i.tax_paise),0),
		COALESCE(SUM(CASE WHEN c.gstin IS NOT NULL AND c.gstin<>'' AND substr(c.gstin,1,2)<>? THEN i.tax_paise ELSE 0 END),0),
		COALESCE(SUM(CASE WHEN c.gstin IS NULL OR c.gstin='' OR substr(c.gstin,1,2)=? THEN i.tax_paise ELSE 0 END),0)
		FROM invoices i LEFT JOIN customers c ON i.customer_id=c.id
		WHERE i.tenant_id=? AND i.status='FINAL' AND i.deleted_at IS NULL`
	a := []interface{}{store, store, tid}
	if from != "" && to != "" {
		q += ` AND i.created_at >= ? AND date(i.created_at) <= ?`
		a = append(a, from, to)
	}
	s.db.QueryRow(q, a...).Scan(&sSub, &sIGST, &sLocal)
	sCGST, sSGST := sLocal/2, sLocal-sLocal/2
	res.Outward = append(res.Outward, GSTR3BSectionRow{Description: "Outward taxable supplies (other than zero/nil/exempt)", TaxablePaise: sSub, CGSTPaise: sCGST, SGSTPaise: sSGST, IGSTPaise: sIGST, TotalPaise: sSub + sIGST + sLocal})

	// Inward (purchases) — same split by supplier GSTIN; taxable = total − tax
	var pSub, pIGST, pLocal int64
	q2 := `SELECT COALESCE(SUM(pb.total_paise - pb.tax_paise),0),
		COALESCE(SUM(CASE WHEN co.gstin IS NOT NULL AND co.gstin<>'' AND substr(co.gstin,1,2)<>? THEN pb.tax_paise ELSE 0 END),0),
		COALESCE(SUM(CASE WHEN co.gstin IS NULL OR co.gstin='' OR substr(co.gstin,1,2)=? THEN pb.tax_paise ELSE 0 END),0)
		FROM purchase_orders pb LEFT JOIN companies co ON pb.company_id=co.id
		WHERE pb.tenant_id=? AND pb.status='RECEIVED'`
	a2 := []interface{}{store, store, tid}
	if from != "" && to != "" {
		q2 += ` AND date(pb.order_date) >= ? AND date(pb.order_date) <= ?`
		a2 = append(a2, from, to)
	}
	s.db.QueryRow(q2, a2...).Scan(&pSub, &pIGST, &pLocal)
	pCGST, pSGST := pLocal/2, pLocal-pLocal/2
	res.Inward = append(res.Inward, GSTR3BSectionRow{Description: "Inward supplies (liable to reverse charge)", TaxablePaise: pSub, CGSTPaise: pCGST, SGSTPaise: pSGST, IGSTPaise: pIGST, TotalPaise: pSub + pIGST + pLocal})

	// Eligible ITC = input tax on purchases
	res.ITC = append(res.ITC, GSTR3BSectionRow{Description: "ITC Available (all other ITC)", CGSTPaise: pCGST, SGSTPaise: pSGST, IGSTPaise: pIGST, TotalPaise: pIGST + pLocal})

	// Net tax payable (cash) — apply ITC set-off per GST Rule 88A:
	//  IGST credit → IGST, then CGST, then SGST
	//  CGST credit → CGST, then IGST
	//  SGST credit → SGST, then IGST
	li, lc, ls := sIGST, sCGST, sSGST // liabilities
	ci, cc, cs := pIGST, pCGST, pSGST // credits (ITC)
	use := func(credit, liab *int64) {
		u := *credit
		if u > *liab {
			u = *liab
		}
		*credit -= u
		*liab -= u
	}
	use(&ci, &li)
	use(&ci, &lc)
	use(&ci, &ls)
	use(&cc, &lc)
	use(&cc, &li)
	use(&cs, &ls)
	use(&cs, &li)
	nI, nC, nS := li, lc, ls
	res.TaxPayable = append(res.TaxPayable, GSTR3BSectionRow{Description: "Net Tax Payable (cash)", CGSTPaise: nC, SGSTPaise: nS, IGSTPaise: nI, TotalPaise: nI + nC + nS})

	// Summary cards
	outputTax := sIGST + sLocal
	itc := pIGST + pLocal
	res.OutputTaxPaise = outputTax
	res.ITCAvailablePaise = itc
	res.NetPayablePaise = nI + nC + nS

	// Accounting Health Check (cross-checks, OS-Books style)
	rupee := func(p int64) string { return fmt.Sprintf("₹%.2f", float64(p)/100) }
	saleSum, _ := s.GSTSaleSummary(from, to)
	var saleTaxFromItems int64
	for _, sr := range saleSum {
		saleTaxFromItems += sr.CGSTPaise + sr.SGSTPaise + sr.IGSTPaise
	}
	res.HealthChecks = []HealthCheck{
		{Label: "3.1(a) Outward taxable", Detail: rupee(sSub) + " taxable sales", OK: true},
		{Label: "Output tax vs GST-wise", Detail: "3B " + rupee(outputTax) + " vs items " + rupee(saleTaxFromItems) + " — diff " + rupee(outputTax-saleTaxFromItems), OK: outputTax == saleTaxFromItems},
		{Label: "ITC utilization", Detail: "ITC " + rupee(itc) + ", net payable " + rupee(nI+nC+nS), OK: true},
		{Label: "Cash tax payable", Detail: rupee(nI+nC+nS), OK: (nI + nC + nS) >= 0},
	}
	return res, nil
}

// ─── 26. GSTSaleSummary ──────────────────────────────────────────────────

func (s *Service) GSTSaleSummary(from, to string) ([]GSTRateSummaryRow, error) {
	tid := s.tenantID()
	store := s.storeStateCode()
	q := `SELECT ii.tax_percent,
		COALESCE(SUM(ii.total_paise-ii.tax_paise),0) AS taxable,
		COALESCE(SUM(CASE WHEN c.gstin IS NOT NULL AND c.gstin<>'' AND substr(c.gstin,1,2)<>? THEN ii.tax_paise ELSE 0 END),0) AS igst,
		COALESCE(SUM(CASE WHEN c.gstin IS NULL OR c.gstin='' OR substr(c.gstin,1,2)=? THEN ii.tax_paise ELSE 0 END),0) AS local_tax,
		COALESCE(SUM(ii.total_paise),0) AS total
		FROM invoice_items ii JOIN invoices i ON ii.invoice_id=i.id LEFT JOIN customers c ON i.customer_id=c.id
		WHERE i.tenant_id=? AND i.status='FINAL' AND i.deleted_at IS NULL`
	a := []interface{}{store, store, tid}
	if from != "" && to != "" {
		q += ` AND i.created_at >= ? AND date(i.created_at) <= ?`
		a = append(a, from, to)
	}
	q += ` GROUP BY ii.tax_percent ORDER BY ii.tax_percent`
	rows, err := s.db.Query(q, a...)
	if err != nil {
		return nil, fmt.Errorf("gst sale summary: %w", err)
	}
	defer rows.Close()
	list := make([]GSTRateSummaryRow, 0)
	for rows.Next() {
		var r GSTRateSummaryRow
		var igst, localTax int64
		if err := rows.Scan(&r.RatePercent, &r.TaxablePaise, &igst, &localTax, &r.TotalPaise); err != nil {
			return nil, err
		}
		r.CGSTPaise, r.SGSTPaise, r.IGSTPaise = localTax/2, localTax-localTax/2, igst
		list = append(list, r)
	}
	return list, nil
}

// ─── 27. GSTPurchaseSummary ──────────────────────────────────────────────

func (s *Service) GSTPurchaseSummary(from, to string) ([]GSTRateSummaryRow, error) {
	tid := s.tenantID()
	store := s.storeStateCode()
	q := `SELECT pi.tax_percent,
		COALESCE(SUM(pi.total_paise*100/(100+pi.tax_percent)),0) AS taxable,
		COALESCE(SUM(CASE WHEN co.gstin IS NOT NULL AND co.gstin<>'' AND substr(co.gstin,1,2)<>? THEN (pi.total_paise - pi.total_paise*100/(100+pi.tax_percent)) ELSE 0 END),0) AS igst,
		COALESCE(SUM(CASE WHEN co.gstin IS NULL OR co.gstin='' OR substr(co.gstin,1,2)=? THEN (pi.total_paise - pi.total_paise*100/(100+pi.tax_percent)) ELSE 0 END),0) AS local_tax,
		COALESCE(SUM(pi.total_paise),0) AS total
		FROM purchase_order_items pi JOIN purchase_orders pb ON pi.order_id=pb.id LEFT JOIN companies co ON pb.company_id=co.id
		WHERE pb.tenant_id=? AND pb.status='RECEIVED'`
	a := []interface{}{store, store, tid}
	if from != "" && to != "" {
		q += ` AND date(pb.order_date) >= ? AND date(pb.order_date) <= ?`
		a = append(a, from, to)
	}
	q += ` GROUP BY pi.tax_percent ORDER BY pi.tax_percent`
	rows, err := s.db.Query(q, a...)
	if err != nil {
		return nil, fmt.Errorf("gst purchase summary: %w", err)
	}
	defer rows.Close()
	list := make([]GSTRateSummaryRow, 0)
	for rows.Next() {
		var r GSTRateSummaryRow
		var igst, localTax int64
		if err := rows.Scan(&r.RatePercent, &r.TaxablePaise, &igst, &localTax, &r.TotalPaise); err != nil {
			return nil, err
		}
		r.CGSTPaise, r.SGSTPaise, r.IGSTPaise = localTax/2, localTax-localTax/2, igst
		list = append(list, r)
	}
	return list, nil
}

// ─── 28. GSTWiseSummary ──────────────────────────────────────────────────

func (s *Service) GSTWiseSummary(from, to string) ([]GSTWiseRow, error) {
	sl, err := s.GSTSaleSummary(from, to)
	if err != nil {
		return nil, err
	}
	pl, err := s.GSTPurchaseSummary(from, to)
	if err != nil {
		return nil, err
	}
	rm := map[int]*GSTWiseRow{}
	var rates []int
	for _, sr := range sl {
		rm[sr.RatePercent] = &GSTWiseRow{RatePercent: sr.RatePercent, SaleTaxablePaise: sr.TaxablePaise, SaleTaxPaise: sr.CGSTPaise + sr.SGSTPaise + sr.IGSTPaise}
		rates = append(rates, sr.RatePercent)
	}
	for _, pr := range pl {
		if r, ok := rm[pr.RatePercent]; ok {
			r.PurchTaxablePaise = pr.TaxablePaise
			r.PurchTaxPaise = pr.CGSTPaise + pr.SGSTPaise + pr.IGSTPaise
		} else {
			rm[pr.RatePercent] = &GSTWiseRow{RatePercent: pr.RatePercent, PurchTaxablePaise: pr.TaxablePaise, PurchTaxPaise: pr.CGSTPaise + pr.SGSTPaise + pr.IGSTPaise}
			rates = append(rates, pr.RatePercent)
		}
	}
	list := make([]GSTWiseRow, 0, len(rates))
	seen := map[int]bool{}
	for _, r := range rates {
		if !seen[r] {
			list = append(list, *rm[r])
			seen[r] = true
		}
	}
	return list, nil
}

// ─── 29. HSNWiseSummary ──────────────────────────────────────────────────

func (s *Service) HSNWiseSummary(from, to string) ([]HSNSummaryRow, error) {
	tid := s.tenantID()
	q := `SELECT COALESCE(ii.hsn_code, COALESCE(p.hsn_code,'')), p.name,
		COALESCE(SUM(ii.quantity_millis),0), COALESCE(SUM(ii.total_paise-ii.tax_paise),0),
		COALESCE(SUM(ii.tax_paise),0), COALESCE(SUM(ii.total_paise),0)
		FROM invoice_items ii JOIN invoices i ON ii.invoice_id=i.id JOIN products p ON ii.product_id=p.id
		WHERE i.tenant_id=? AND i.status='FINAL' AND i.deleted_at IS NULL`
	a := []interface{}{tid}
	if from != "" && to != "" {
		q += ` AND i.created_at >= ? AND date(i.created_at) <= ?`
		a = append(a, from, to)
	}
	q += ` GROUP BY 1, 2 ORDER BY 6 DESC`
	rows, err := s.db.Query(q, a...)
	if err != nil {
		return nil, fmt.Errorf("hsn summary: %w", err)
	}
	defer rows.Close()
	list := make([]HSNSummaryRow, 0)
	for rows.Next() {
		var r HSNSummaryRow
		if err := rows.Scan(&r.HSNCode, &r.Description, &r.QtyMillis, &r.TaxablePaise, &r.TaxPaise, &r.TotalPaise); err != nil {
			return nil, err
		}
		list = append(list, r)
	}
	return list, nil
}

// ─── 30. GSTR1Summary (section-wise, OS-Books style) ─────────────────────────

func (s *Service) GSTR1Summary(from, to string) (*GSTR1SummaryResult, error) {
	tid := s.tenantID()
	store := s.storeStateCode()
	res := &GSTR1SummaryResult{Sections: make([]GSTR1Section, 0)}
	dateInv := ""
	argsDate := []interface{}{}
	if from != "" && to != "" {
		dateInv = ` AND i.created_at >= ? AND date(i.created_at) <= ?`
		argsDate = []interface{}{from, to}
	}

	// 4A — B2B Invoices (registered customers with GSTIN)
	{
		var rec int
		var inv, sub, igst, local int64
		// Taxable value is tax-EXCLUSIVE: prices/subtotal are MRP-inclusive, so taxable = total − tax.
		q := `SELECT COUNT(DISTINCT i.id), COALESCE(SUM(i.total_paise),0), COALESCE(SUM(i.total_paise - i.tax_paise),0),
			COALESCE(SUM(CASE WHEN substr(c.gstin,1,2)<>? THEN i.tax_paise ELSE 0 END),0),
			COALESCE(SUM(CASE WHEN substr(c.gstin,1,2)=? THEN i.tax_paise ELSE 0 END),0)
			FROM invoices i JOIN customers c ON i.customer_id=c.id
			WHERE i.tenant_id=? AND i.status='FINAL' AND i.deleted_at IS NULL AND c.gstin IS NOT NULL AND c.gstin<>''` + dateInv
		a := append([]interface{}{store, store, tid}, argsDate...)
		s.db.QueryRow(q, a...).Scan(&rec, &inv, &sub, &igst, &local)
		res.Sections = append(res.Sections, GSTR1Section{Section: "4A - B2B Invoices", Records: rec, InvoicePaise: inv, TaxablePaise: sub, IGSTPaise: igst, CGSTPaise: local / 2, SGSTPaise: local - local/2})
	}

	// 7 — B2C (Others): customers without GSTIN / walk-in (always local)
	{
		var rec int
		var inv, sub, tax int64
		// taxable = total − tax (prices are MRP-inclusive)
		q := `SELECT COUNT(DISTINCT i.id), COALESCE(SUM(i.total_paise),0), COALESCE(SUM(i.total_paise - i.tax_paise),0), COALESCE(SUM(i.tax_paise),0)
			FROM invoices i LEFT JOIN customers c ON i.customer_id=c.id
			WHERE i.tenant_id=? AND i.status='FINAL' AND i.deleted_at IS NULL AND (c.gstin IS NULL OR c.gstin='')` + dateInv
		a := append([]interface{}{tid}, argsDate...)
		s.db.QueryRow(q, a...).Scan(&rec, &inv, &sub, &tax)
		res.Sections = append(res.Sections, GSTR1Section{Section: "7 - B2C (Others)", Records: rec, InvoicePaise: inv, TaxablePaise: sub, CGSTPaise: tax / 2, SGSTPaise: tax - tax/2})
	}

	// 8 — Nil Rated / Exempted (items taxed at 0%)
	{
		var rec int
		var taxable int64
		q := `SELECT COUNT(DISTINCT i.id), COALESCE(SUM(ii.total_paise),0)
			FROM invoice_items ii JOIN invoices i ON ii.invoice_id=i.id
			WHERE i.tenant_id=? AND i.status='FINAL' AND i.deleted_at IS NULL AND ii.tax_percent=0` + dateInv
		a := append([]interface{}{tid}, argsDate...)
		s.db.QueryRow(q, a...).Scan(&rec, &taxable)
		res.Sections = append(res.Sections, GSTR1Section{Section: "8 - Nil Rated / Exempted", Records: rec, TaxablePaise: taxable})
	}

	for _, sec := range res.Sections {
		res.TotalTaxablePaise += sec.TaxablePaise
		res.TotalTaxPaise += sec.IGSTPaise + sec.CGSTPaise + sec.SGSTPaise
	}

	hsn, err := s.HSNWiseSummary(from, to)
	if err == nil {
		res.HSN = hsn
	} else {
		res.HSN = make([]HSNSummaryRow, 0)
	}
	return res, nil
}

// ─── 31. GSTR2B (ITC availability, OS-Books style) ───────────────────────────

func (s *Service) GSTR2B(from, to string) (*GSTR2BResult, error) {
	tid := s.tenantID()
	store := s.storeStateCode()
	res := &GSTR2BResult{}
	dateP := ""
	argsDate := []interface{}{}
	if from != "" && to != "" {
		dateP = ` AND date(pb.order_date) >= ? AND date(pb.order_date) <= ?`
		argsDate = []interface{}{from, to}
	}

	// Registered suppliers (GSTIN present) — ITC eligible
	{
		var rec int
		var sub, igst, local int64
		q := `SELECT COUNT(DISTINCT pb.id), COALESCE(SUM(pb.total_paise - pb.tax_paise),0),
			COALESCE(SUM(CASE WHEN substr(co.gstin,1,2)<>? THEN pb.tax_paise ELSE 0 END),0),
			COALESCE(SUM(CASE WHEN substr(co.gstin,1,2)=? THEN pb.tax_paise ELSE 0 END),0)
			FROM purchase_orders pb JOIN companies co ON pb.company_id=co.id
			WHERE pb.tenant_id=? AND pb.status='RECEIVED' AND co.gstin IS NOT NULL AND co.gstin<>''` + dateP
		a := append([]interface{}{store, store, tid}, argsDate...)
		s.db.QueryRow(q, a...).Scan(&rec, &sub, &igst, &local)
		res.Registered = GSTR2BCategory{Category: "B2B - Registered Suppliers", Invoices: rec, TaxablePaise: sub, IGSTPaise: igst, CGSTPaise: local / 2, SGSTPaise: local - local/2, TotalITCPaise: igst + local}
	}

	// Unregistered suppliers (no GSTIN) — ITC generally ineligible
	{
		var rec int
		var sub, tax int64
		q := `SELECT COUNT(DISTINCT pb.id), COALESCE(SUM(pb.total_paise - pb.tax_paise),0), COALESCE(SUM(pb.tax_paise),0)
			FROM purchase_orders pb LEFT JOIN companies co ON pb.company_id=co.id
			WHERE pb.tenant_id=? AND pb.status='RECEIVED' AND (co.gstin IS NULL OR co.gstin='')` + dateP
		a := append([]interface{}{tid}, argsDate...)
		s.db.QueryRow(q, a...).Scan(&rec, &sub, &tax)
		res.Unregistered = GSTR2BCategory{Category: "B2BUR - Unregistered Suppliers", Invoices: rec, TaxablePaise: sub, CGSTPaise: tax / 2, SGSTPaise: tax - tax/2, TotalITCPaise: 0}
	}

	// Total eligible = registered only
	res.TotalEligible = GSTR2BCategory{
		Category: "(A) Total ITC Available (Eligible)", Invoices: res.Registered.Invoices,
		TaxablePaise: res.Registered.TaxablePaise, IGSTPaise: res.Registered.IGSTPaise,
		CGSTPaise: res.Registered.CGSTPaise, SGSTPaise: res.Registered.SGSTPaise, TotalITCPaise: res.Registered.TotalITCPaise,
	}
	return res, nil
}

// ─── 32. PaymentReminders (Udhaar — customers with dues + aging) ─────────────

type UdhaarRow struct {
	CustomerID      string `json:"customerId"`
	Name            string `json:"name"`
	Phone           string `json:"phone"`
	Bills           int    `json:"bills"`
	Days0_30Paise   int64  `json:"days0_30Paise"`
	Days31_60Paise  int64  `json:"days31_60Paise"`
	Days61_90Paise  int64  `json:"days61_90Paise"`
	Days90PlusPaise int64  `json:"days90PlusPaise"`
	TotalDuePaise   int64  `json:"totalDuePaise"`
	OldestDays      int    `json:"oldestDays"`
}

// PaymentReminders lists customers who owe money, bucketed by how old the dues
// are (0-30 / 31-60 / 61-90 / 90+ days). Per-invoice balance = invoice total
// minus its received (non-CREDIT) payments; age is from the invoice date.
func (s *Service) PaymentReminders() ([]UdhaarRow, error) {
	tid := s.tenantID()
	q := `SELECT c.id, c.name, COALESCE(c.phone,''),
			COUNT(*) AS bills,
			COALESCE(SUM(CASE WHEN x.age <= 30 THEN x.bal ELSE 0 END),0),
			COALESCE(SUM(CASE WHEN x.age > 30 AND x.age <= 60 THEN x.bal ELSE 0 END),0),
			COALESCE(SUM(CASE WHEN x.age > 60 AND x.age <= 90 THEN x.bal ELSE 0 END),0),
			COALESCE(SUM(CASE WHEN x.age > 90 THEN x.bal ELSE 0 END),0),
			COALESCE(SUM(x.bal),0),
			COALESCE(MAX(x.age),0)
		FROM (
			SELECT i.customer_id AS cid, i.id,
				(i.total_paise - COALESCE((SELECT SUM(ip.amount_paise) FROM invoice_payments ip WHERE ip.invoice_id=i.id AND ip.method<>'CREDIT'),0)) AS bal,
				CAST(julianday('now') - julianday(i.created_at) AS INTEGER) AS age
			FROM invoices i
			WHERE i.status='FINAL' AND i.deleted_at IS NULL AND i.tenant_id=? AND i.customer_id IS NOT NULL
		) x
		JOIN customers c ON c.id = x.cid
		WHERE x.bal > 0
		GROUP BY c.id, c.name, c.phone
		ORDER BY SUM(x.bal) DESC`
	rows, err := s.db.Query(q, tid)
	if err != nil {
		return nil, fmt.Errorf("payment reminders: %w", err)
	}
	defer rows.Close()
	list := make([]UdhaarRow, 0)
	for rows.Next() {
		var r UdhaarRow
		if err := rows.Scan(&r.CustomerID, &r.Name, &r.Phone, &r.Bills,
			&r.Days0_30Paise, &r.Days31_60Paise, &r.Days61_90Paise, &r.Days90PlusPaise,
			&r.TotalDuePaise, &r.OldestDays); err != nil {
			return nil, err
		}
		list = append(list, r)
	}
	return list, nil
}
