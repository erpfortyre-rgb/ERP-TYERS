package accounts

import (
	"database/sql"
	"fmt"

	"erp-pos/internal/models"

	"github.com/google/uuid"
)

type Service struct {
	db *sql.DB
}

func NewService(db *sql.DB) *Service {
	return &Service{db: db}
}

func (s *Service) tenantID() string {
	var id string
	s.db.QueryRow("SELECT COALESCE((SELECT t.id FROM tenants t WHERE t.id=(SELECT value FROM settings WHERE key='active_tenant_id')), (SELECT id FROM tenants LIMIT 1))").Scan(&id)
	return id
}

func (s *Service) storeID() string {
	var id string
	s.db.QueryRow("SELECT id FROM stores LIMIT 1").Scan(&id)
	return id
}

func nullStr(v string) interface{} {
	if v == "" {
		return nil
	}
	return v
}

// ─── Expense Entries ────────────────────────────────────────────────────────

func (s *Service) ListExpenseEntries(from, to string) ([]models.ExpenseEntry, error) {
	q := `SELECT id, tenant_id, store_id, expense_id, quantity_millis, rate_paise, amount_paise, payment_method,
		COALESCE(reference_number,''), COALESCE(narration,''), entry_date, COALESCE(created_at,'')
		FROM expense_entries WHERE tenant_id = ? AND deleted_at IS NULL`
	args := []interface{}{s.tenantID()}

	if from != "" && to != "" {
		q += ` AND entry_date BETWEEN ? AND ?`
		args = append(args, from, to)
	}
	q += ` ORDER BY entry_date DESC, created_at DESC`

	rows, err := s.db.Query(q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []models.ExpenseEntry
	for rows.Next() {
		var e models.ExpenseEntry
		if err := rows.Scan(&e.ID, &e.TenantID, &e.StoreID, &e.ExpenseID, &e.QuantityMillis, &e.RatePaise, &e.AmountPaise,
			&e.PaymentMethod, &e.ReferenceNumber, &e.Narration, &e.EntryDate, &e.CreatedAt); err != nil {
			return nil, err
		}
		list = append(list, e)
	}
	return list, nil
}

func (s *Service) SaveExpenseEntry(e models.ExpenseEntry) (string, error) {
	if e.ID == "" {
		e.ID = uuid.New().String()
	}
	e.TenantID = s.tenantID()
	e.StoreID = s.storeID()

	_, err := s.db.Exec(`INSERT INTO expense_entries (id, tenant_id, store_id, expense_id, quantity_millis, rate_paise, amount_paise, payment_method, reference_number, narration, entry_date, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
		ON CONFLICT(id) DO UPDATE SET
			expense_id=excluded.expense_id, quantity_millis=excluded.quantity_millis, rate_paise=excluded.rate_paise,
			amount_paise=excluded.amount_paise, payment_method=excluded.payment_method,
			reference_number=excluded.reference_number, narration=excluded.narration, entry_date=excluded.entry_date`,
		e.ID, e.TenantID, e.StoreID, e.ExpenseID, e.QuantityMillis, e.RatePaise, e.AmountPaise, e.PaymentMethod,
		nullStr(e.ReferenceNumber), nullStr(e.Narration), e.EntryDate)
	if err != nil {
		return "", fmt.Errorf("save expense entry: %w", err)
	}
	return e.ID, nil
}

func (s *Service) DeleteExpenseEntry(id, deletedBy, deletedByEmail string) error {
	_, err := s.db.Exec(`UPDATE expense_entries SET deleted_at = datetime('now'), deleted_by = ?, deleted_by_email = ?
		WHERE id = ? AND tenant_id = ?`, nullStr(deletedBy), nullStr(deletedByEmail), id, s.tenantID())
	return err
}

// ─── Income Entries ─────────────────────────────────────────────────────────

func (s *Service) ListIncomeEntries(from, to string) ([]models.IncomeEntry, error) {
	q := `SELECT id, tenant_id, store_id, income_id, quantity_millis, rate_paise, amount_paise, payment_method,
		COALESCE(reference_number,''), COALESCE(narration,''), entry_date, COALESCE(created_at,'')
		FROM income_entries WHERE tenant_id = ? AND deleted_at IS NULL`
	args := []interface{}{s.tenantID()}

	if from != "" && to != "" {
		q += ` AND entry_date BETWEEN ? AND ?`
		args = append(args, from, to)
	}
	q += ` ORDER BY entry_date DESC, created_at DESC`

	rows, err := s.db.Query(q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []models.IncomeEntry
	for rows.Next() {
		var e models.IncomeEntry
		if err := rows.Scan(&e.ID, &e.TenantID, &e.StoreID, &e.IncomeID, &e.QuantityMillis, &e.RatePaise, &e.AmountPaise,
			&e.PaymentMethod, &e.ReferenceNumber, &e.Narration, &e.EntryDate, &e.CreatedAt); err != nil {
			return nil, err
		}
		list = append(list, e)
	}
	return list, nil
}

func (s *Service) SaveIncomeEntry(e models.IncomeEntry) (string, error) {
	if e.ID == "" {
		e.ID = uuid.New().String()
	}
	e.TenantID = s.tenantID()
	e.StoreID = s.storeID()

	_, err := s.db.Exec(`INSERT INTO income_entries (id, tenant_id, store_id, income_id, quantity_millis, rate_paise, amount_paise, payment_method, reference_number, narration, entry_date, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
		ON CONFLICT(id) DO UPDATE SET
			income_id=excluded.income_id, quantity_millis=excluded.quantity_millis, rate_paise=excluded.rate_paise,
			amount_paise=excluded.amount_paise, payment_method=excluded.payment_method,
			reference_number=excluded.reference_number, narration=excluded.narration, entry_date=excluded.entry_date`,
		e.ID, e.TenantID, e.StoreID, e.IncomeID, e.QuantityMillis, e.RatePaise, e.AmountPaise, e.PaymentMethod,
		nullStr(e.ReferenceNumber), nullStr(e.Narration), e.EntryDate)
	if err != nil {
		return "", fmt.Errorf("save income entry: %w", err)
	}
	return e.ID, nil
}

func (s *Service) DeleteIncomeEntry(id, deletedBy, deletedByEmail string) error {
	_, err := s.db.Exec(`UPDATE income_entries SET deleted_at = datetime('now'), deleted_by = ?, deleted_by_email = ?
		WHERE id = ? AND tenant_id = ?`, nullStr(deletedBy), nullStr(deletedByEmail), id, s.tenantID())
	return err
}

// ─── Recycle Bin (soft-deleted expense/income entries) ────────────────────────

type RecycleEntry struct {
	ID             string `json:"id"`
	Kind           string `json:"kind"` // "expense" or "income"
	Category       string `json:"category"`
	Narration      string `json:"narration"`
	AmountPaise    int64  `json:"amountPaise"`
	EntryDate      string `json:"entryDate"`
	DeletedBy      string `json:"deletedBy"`
	DeletedByEmail string `json:"deletedByEmail"`
	DeletedAt      string `json:"deletedAt"`
}

func (s *Service) ListRecycleBin() ([]RecycleEntry, error) {
	tid := s.tenantID()
	q := `
		SELECT ee.id, 'expense', COALESCE(em.name,''), COALESCE(ee.narration,''), ee.amount_paise, ee.entry_date,
			COALESCE(ee.deleted_by,''), COALESCE(ee.deleted_by_email,''), COALESCE(ee.deleted_at,'')
		FROM expense_entries ee JOIN expense_master em ON ee.expense_id = em.id
		WHERE ee.tenant_id = ? AND ee.deleted_at IS NOT NULL
		UNION ALL
		SELECT ie.id, 'income', COALESCE(im.name,''), COALESCE(ie.narration,''), ie.amount_paise, ie.entry_date,
			COALESCE(ie.deleted_by,''), COALESCE(ie.deleted_by_email,''), COALESCE(ie.deleted_at,'')
		FROM income_entries ie JOIN income_master im ON ie.income_id = im.id
		WHERE ie.tenant_id = ? AND ie.deleted_at IS NOT NULL
		UNION ALL
		SELECT i.id, 'invoice', i.invoice_number, COALESCE(c.name,'Walk-in'), i.total_paise, date(i.created_at),
			COALESCE(i.deleted_by,''), COALESCE(i.deleted_by_email,''), COALESCE(i.deleted_at,'')
		FROM invoices i LEFT JOIN customers c ON i.customer_id = c.id
		WHERE i.tenant_id = ? AND i.deleted_at IS NOT NULL
		ORDER BY 9 DESC`
	rows, err := s.db.Query(q, tid, tid, tid)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []RecycleEntry
	for rows.Next() {
		var r RecycleEntry
		if err := rows.Scan(&r.ID, &r.Kind, &r.Category, &r.Narration, &r.AmountPaise, &r.EntryDate,
			&r.DeletedBy, &r.DeletedByEmail, &r.DeletedAt); err != nil {
			return nil, err
		}
		list = append(list, r)
	}
	return list, nil
}

func (s *Service) RestoreEntry(kind, id string) error {
	table := "expense_entries"
	if kind == "income" {
		table = "income_entries"
	}
	_, err := s.db.Exec(`UPDATE `+table+` SET deleted_at = NULL, deleted_by = NULL, deleted_by_email = NULL
		WHERE id = ? AND tenant_id = ?`, id, s.tenantID())
	return err
}

func (s *Service) PurgeEntry(kind, id string) error {
	table := "expense_entries"
	if kind == "income" {
		table = "income_entries"
	}
	_, err := s.db.Exec(`DELETE FROM `+table+` WHERE id = ? AND tenant_id = ? AND deleted_at IS NOT NULL`, id, s.tenantID())
	return err
}

// ─── Payment Entries ────────────────────────────────────────────────────────

func (s *Service) ListPaymentEntries(from, to string) ([]models.PaymentEntry, error) {
	q := `SELECT id, tenant_id, store_id, payment_type_id, COALESCE(party_type,''),
		COALESCE(party_id,''), amount_paise, payment_method,
		COALESCE(reference_number,''), COALESCE(narration,''), entry_date
		FROM payment_entries WHERE tenant_id = ?`
	args := []interface{}{s.tenantID()}

	if from != "" && to != "" {
		q += ` AND entry_date BETWEEN ? AND ?`
		args = append(args, from, to)
	}
	q += ` ORDER BY entry_date DESC`

	rows, err := s.db.Query(q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []models.PaymentEntry
	for rows.Next() {
		var e models.PaymentEntry
		if err := rows.Scan(&e.ID, &e.TenantID, &e.StoreID, &e.PaymentTypeID, &e.PartyType,
			&e.PartyID, &e.AmountPaise, &e.PaymentMethod,
			&e.ReferenceNumber, &e.Narration, &e.EntryDate); err != nil {
			return nil, err
		}
		list = append(list, e)
	}
	return list, nil
}

func (s *Service) SavePaymentEntry(e models.PaymentEntry) (string, error) {
	if e.ID == "" {
		e.ID = uuid.New().String()
	}
	e.TenantID = s.tenantID()
	e.StoreID = s.storeID()

	_, err := s.db.Exec(`INSERT INTO payment_entries (id, tenant_id, store_id, payment_type_id, party_type, party_id, amount_paise, payment_method, reference_number, narration, entry_date, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
		ON CONFLICT(id) DO UPDATE SET
			payment_type_id=excluded.payment_type_id, party_type=excluded.party_type, party_id=excluded.party_id,
			amount_paise=excluded.amount_paise, payment_method=excluded.payment_method,
			reference_number=excluded.reference_number, narration=excluded.narration, entry_date=excluded.entry_date`,
		e.ID, e.TenantID, e.StoreID, e.PaymentTypeID, nullStr(e.PartyType), nullStr(e.PartyID),
		e.AmountPaise, e.PaymentMethod, nullStr(e.ReferenceNumber), nullStr(e.Narration), e.EntryDate)
	if err != nil {
		return "", fmt.Errorf("save payment entry: %w", err)
	}
	return e.ID, nil
}

func (s *Service) DeletePaymentEntry(id string) error {
	_, err := s.db.Exec(`DELETE FROM payment_entries WHERE id = ?`, id)
	return err
}

// ─── Employee Attendance ────────────────────────────────────────────────────

func (s *Service) ListAttendance(employeeID string, from, to string) ([]models.EmployeeAttendance, error) {
	q := `SELECT id, tenant_id, employee_id, attendance_date, status,
		COALESCE(in_time,''), COALESCE(out_time,''), COALESCE(notes,'')
		FROM employee_attendance WHERE tenant_id = ?`
	args := []interface{}{s.tenantID()}

	if employeeID != "" {
		q += ` AND employee_id = ?`
		args = append(args, employeeID)
	}
	if from != "" && to != "" {
		q += ` AND attendance_date BETWEEN ? AND ?`
		args = append(args, from, to)
	}
	q += ` ORDER BY attendance_date DESC`

	rows, err := s.db.Query(q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []models.EmployeeAttendance
	for rows.Next() {
		var a models.EmployeeAttendance
		if err := rows.Scan(&a.ID, &a.TenantID, &a.EmployeeID, &a.AttendanceDate,
			&a.Status, &a.InTime, &a.OutTime, &a.Notes); err != nil {
			return nil, err
		}
		list = append(list, a)
	}
	return list, nil
}

func (s *Service) SaveAttendance(a models.EmployeeAttendance) (string, error) {
	if a.ID == "" {
		a.ID = uuid.New().String()
	}
	a.TenantID = s.tenantID()

	_, err := s.db.Exec(`INSERT INTO employee_attendance (id, tenant_id, employee_id, attendance_date, status, in_time, out_time, notes, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
		ON CONFLICT(employee_id, attendance_date) DO UPDATE SET
			status=excluded.status, in_time=excluded.in_time, out_time=excluded.out_time, notes=excluded.notes`,
		a.ID, a.TenantID, a.EmployeeID, a.AttendanceDate, a.Status,
		nullStr(a.InTime), nullStr(a.OutTime), nullStr(a.Notes))
	if err != nil {
		return "", fmt.Errorf("save attendance: %w", err)
	}
	return a.ID, nil
}

// ─── Reports (Ledger summaries) ─────────────────────────────────────────────

type LedgerEntry struct {
	Date        string `json:"date"`
	Description string `json:"description"`
	DebitPaise  int64  `json:"debitPaise"`
	CreditPaise int64  `json:"creditPaise"`
	BalancePaise int64 `json:"balancePaise"`
}

func (s *Service) CustomerLedger(customerID string, from, to string) ([]LedgerEntry, error) {
	q := `
		SELECT date, description, debit_paise, credit_paise FROM (
			SELECT date(i.created_at) as date,
				'Invoice ' || i.invoice_number as description,
				i.total_paise as debit_paise, 0 as credit_paise
			FROM invoices i WHERE i.customer_id = ? AND i.status = 'FINAL' AND i.deleted_at IS NULL
			UNION ALL
			SELECT date(ip.created_at) as date,
				ip.method || ' payment' as description,
				0 as debit_paise, ip.amount_paise as credit_paise
			FROM invoice_payments ip
			JOIN invoices i ON ip.invoice_id = i.id
			WHERE i.customer_id = ? AND i.status = 'FINAL' AND i.deleted_at IS NULL AND ip.method <> 'CREDIT'
			UNION ALL
			SELECT sr.return_date as date,
				'Sales Return ' || sr.return_number as description,
				0 as debit_paise, sr.total_paise as credit_paise
			FROM sales_returns sr WHERE sr.customer_id = ?
			UNION ALL
			SELECT cn.note_date as date,
				'Credit Note ' || cn.note_number as description,
				0 as debit_paise, cn.total_paise as credit_paise
			FROM credit_notes cn WHERE cn.customer_id = ?
		) ledger`
	args := []interface{}{customerID, customerID, customerID, customerID}

	if from != "" && to != "" {
		q += ` WHERE date BETWEEN ? AND ?`
		args = append(args, from, to)
	}
	q += ` ORDER BY date, description`

	rows, err := s.db.Query(q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []LedgerEntry
	var running int64
	for rows.Next() {
		var e LedgerEntry
		if err := rows.Scan(&e.Date, &e.Description, &e.DebitPaise, &e.CreditPaise); err != nil {
			return nil, err
		}
		running += e.DebitPaise - e.CreditPaise
		e.BalancePaise = running
		list = append(list, e)
	}
	return list, nil
}

func (s *Service) CompanyLedger(companyID string, from, to string) ([]LedgerEntry, error) {
	q := `
		SELECT date, description, debit_paise, credit_paise FROM (
			SELECT date(pb.order_date) as date,
				'Purchase ' || pb.order_number as description,
				pb.total_paise as debit_paise, 0 as credit_paise
			FROM purchase_orders pb WHERE pb.company_id = ? AND pb.status = 'RECEIVED'
			UNION ALL
			SELECT pr.return_date as date,
				'Purchase Return ' || pr.return_number as description,
				0 as debit_paise, pr.total_paise as credit_paise
			FROM purchase_returns pr WHERE pr.company_id = ?
			UNION ALL
			SELECT dn.note_date as date,
				'Debit Note ' || dn.note_number as description,
				0 as debit_paise, dn.total_paise as credit_paise
			FROM debit_notes dn WHERE dn.company_id = ?
		) ledger`
	args := []interface{}{companyID, companyID, companyID}

	if from != "" && to != "" {
		q += ` WHERE date BETWEEN ? AND ?`
		args = append(args, from, to)
	}
	q += ` ORDER BY date, description`

	rows, err := s.db.Query(q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []LedgerEntry
	var running int64
	for rows.Next() {
		var e LedgerEntry
		if err := rows.Scan(&e.Date, &e.Description, &e.DebitPaise, &e.CreditPaise); err != nil {
			return nil, err
		}
		running += e.DebitPaise - e.CreditPaise
		e.BalancePaise = running
		list = append(list, e)
	}
	return list, nil
}

type DayBookEntry struct {
	Date        string `json:"date"`
	Type        string `json:"type"`
	Number      string `json:"number"`
	PartyName   string `json:"partyName"`
	AmountPaise int64  `json:"amountPaise"`
}

func (s *Service) DayBook(date string) ([]DayBookEntry, error) {
	useNow := date == ""

	q := `
		SELECT type, number, party_name, amount_paise FROM (
			SELECT 'SALE' as type, i.invoice_number as number,
				COALESCE(c.name, 'Walk-in') as party_name, i.total_paise as amount_paise
			FROM invoices i
			LEFT JOIN customers c ON i.customer_id = c.id
			WHERE i.status = 'FINAL' AND i.deleted_at IS NULL AND date(i.created_at) = ?
			UNION ALL
			SELECT 'EXPENSE' as type, em.name as number,
				COALESCE(ee.narration,'') as party_name, ee.amount_paise
			FROM expense_entries ee
			JOIN expense_master em ON ee.expense_id = em.id
			WHERE ee.entry_date = ?
			UNION ALL
			SELECT 'INCOME' as type, im.name as number,
				COALESCE(ie.narration,'') as party_name, ie.amount_paise
			FROM income_entries ie
			JOIN income_master im ON ie.income_id = im.id
			WHERE ie.entry_date = ?
		) daybook ORDER BY type, number`

	var dateArg interface{}
	if useNow {
		dateArg = sql.Named("", nil)
		q = `
		SELECT type, number, party_name, amount_paise FROM (
			SELECT 'SALE' as type, i.invoice_number as number,
				COALESCE(c.name, 'Walk-in') as party_name, i.total_paise as amount_paise
			FROM invoices i
			LEFT JOIN customers c ON i.customer_id = c.id
			WHERE i.status = 'FINAL' AND i.deleted_at IS NULL AND date(i.created_at) = date('now', 'localtime')
			UNION ALL
			SELECT 'EXPENSE' as type, em.name as number,
				COALESCE(ee.narration,'') as party_name, ee.amount_paise
			FROM expense_entries ee
			JOIN expense_master em ON ee.expense_id = em.id
			WHERE ee.entry_date = date('now', 'localtime')
			UNION ALL
			SELECT 'INCOME' as type, im.name as number,
				COALESCE(ie.narration,'') as party_name, ie.amount_paise
			FROM income_entries ie
			JOIN income_master im ON ie.income_id = im.id
			WHERE ie.entry_date = date('now', 'localtime')
		) daybook ORDER BY type, number`
		rows, err := s.db.Query(q)
		if err != nil {
			return nil, err
		}
		defer rows.Close()

		var list []DayBookEntry
		for rows.Next() {
			var e DayBookEntry
			if err := rows.Scan(&e.Type, &e.Number, &e.PartyName, &e.AmountPaise); err != nil {
				return nil, err
			}
			list = append(list, e)
		}
		return list, nil
	}

	dateArg = date
	rows, err := s.db.Query(q, dateArg, dateArg, dateArg)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []DayBookEntry
	for rows.Next() {
		var e DayBookEntry
		if err := rows.Scan(&e.Type, &e.Number, &e.PartyName, &e.AmountPaise); err != nil {
			return nil, err
		}
		list = append(list, e)
	}
	return list, nil
}

type SummaryRow struct {
	ID          string `json:"id"`
	Label       string `json:"label"`
	CountOrQty  int64  `json:"countOrQty"`
	AmountPaise int64  `json:"amountPaise"`
}

func (s *Service) ExpenseSummary(from, to string) ([]SummaryRow, error) {
	q := `SELECT em.id, em.name, COUNT(*), SUM(ee.amount_paise)
		FROM expense_entries ee
		JOIN expense_master em ON ee.expense_id = em.id AND em.is_active = 1
		WHERE ee.tenant_id = ? AND ee.deleted_at IS NULL`
	args := []interface{}{s.tenantID()}

	if from != "" && to != "" {
		q += ` AND ee.entry_date BETWEEN ? AND ?`
		args = append(args, from, to)
	}
	q += ` GROUP BY em.id ORDER BY SUM(ee.amount_paise) DESC`

	rows, err := s.db.Query(q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []SummaryRow
	for rows.Next() {
		var r SummaryRow
		if err := rows.Scan(&r.ID, &r.Label, &r.CountOrQty, &r.AmountPaise); err != nil {
			return nil, err
		}
		list = append(list, r)
	}
	return list, nil
}

func (s *Service) IncomeSummary(from, to string) ([]SummaryRow, error) {
	q := `SELECT im.id, im.name, COUNT(*), SUM(ie.amount_paise)
		FROM income_entries ie
		JOIN income_master im ON ie.income_id = im.id AND im.is_active = 1
		WHERE ie.tenant_id = ? AND ie.deleted_at IS NULL`
	args := []interface{}{s.tenantID()}

	if from != "" && to != "" {
		q += ` AND ie.entry_date BETWEEN ? AND ?`
		args = append(args, from, to)
	}
	q += ` GROUP BY im.id ORDER BY SUM(ie.amount_paise) DESC`

	rows, err := s.db.Query(q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []SummaryRow
	for rows.Next() {
		var r SummaryRow
		if err := rows.Scan(&r.ID, &r.Label, &r.CountOrQty, &r.AmountPaise); err != nil {
			return nil, err
		}
		list = append(list, r)
	}
	return list, nil
}

func (s *Service) CashBankSummary() ([]SummaryRow, error) {
	tid := s.tenantID()
	var list []SummaryRow

	var cashIn int64
	s.db.QueryRow(`SELECT COALESCE(SUM(amount_paise),0) FROM invoice_payments ip
		JOIN invoices i ON ip.invoice_id = i.id
		WHERE i.tenant_id = ? AND ip.method = 'CASH' AND i.status = 'FINAL' AND i.deleted_at IS NULL
		AND date(i.created_at) = date('now', 'localtime')`, tid).Scan(&cashIn)

	var cashOut int64
	s.db.QueryRow(`SELECT COALESCE(SUM(amount_paise),0) FROM expense_entries
		WHERE tenant_id = ? AND payment_method = 'CASH' AND entry_date = date('now', 'localtime')`, tid).Scan(&cashOut)

	list = append(list, SummaryRow{Label: "Cash In (Today)", AmountPaise: cashIn})
	list = append(list, SummaryRow{Label: "Cash Out (Today)", AmountPaise: cashOut})
	list = append(list, SummaryRow{Label: "Net Cash (Today)", AmountPaise: cashIn - cashOut})

	bankRows, err := s.db.Query(`SELECT bank_name, opening_balance_paise FROM bank_master WHERE tenant_id = ? AND is_active = 1`, tid)
	if err == nil {
		defer bankRows.Close()
		for bankRows.Next() {
			var r SummaryRow
			if err := bankRows.Scan(&r.Label, &r.AmountPaise); err == nil {
				list = append(list, r)
			}
		}
	}

	return list, nil
}
