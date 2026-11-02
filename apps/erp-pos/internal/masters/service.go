package masters

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

func nullStr(v string) interface{} {
	if v == "" {
		return nil
	}
	return v
}

// ─── Company ────────────────────────────────────────────────────────────────

func (s *Service) ListCompanies(query string) ([]models.Company, error) {
	q := `SELECT id, tenant_id, name, COALESCE(contact_person,''), COALESCE(phone,''),
		COALESCE(email,''), COALESCE(gstin,''), COALESCE(pan,''), COALESCE(address,''),
		COALESCE(city,''), COALESCE(state,''), COALESCE(state_code,''), COALESCE(pincode,''),
		opening_balance_paise, is_active, created_at, updated_at
		FROM companies WHERE tenant_id = ?`
	args := []interface{}{s.tenantID()}

	if query != "" {
		q += ` AND (name LIKE ? OR phone LIKE ? OR gstin LIKE ?)`
		p := "%" + query + "%"
		args = append(args, p, p, p)
	}
	q += ` ORDER BY name`

	rows, err := s.db.Query(q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []models.Company
	for rows.Next() {
		var c models.Company
		if err := rows.Scan(&c.ID, &c.TenantID, &c.Name, &c.ContactPerson, &c.Phone,
			&c.Email, &c.GSTIN, &c.PAN, &c.Address, &c.City, &c.State, &c.StateCode,
			&c.Pincode, &c.OpeningBalPaise, &c.IsActive, &c.CreatedAt, &c.UpdatedAt); err != nil {
			return nil, err
		}
		list = append(list, c)
	}
	return list, nil
}

func (s *Service) GetCompany(id string) (*models.Company, error) {
	var c models.Company
	err := s.db.QueryRow(`SELECT id, tenant_id, name, COALESCE(contact_person,''), COALESCE(phone,''),
		COALESCE(email,''), COALESCE(gstin,''), COALESCE(pan,''), COALESCE(address,''),
		COALESCE(city,''), COALESCE(state,''), COALESCE(state_code,''), COALESCE(pincode,''),
		opening_balance_paise, is_active, created_at, updated_at
		FROM companies WHERE id = ?`, id).Scan(&c.ID, &c.TenantID, &c.Name, &c.ContactPerson, &c.Phone,
		&c.Email, &c.GSTIN, &c.PAN, &c.Address, &c.City, &c.State, &c.StateCode,
		&c.Pincode, &c.OpeningBalPaise, &c.IsActive, &c.CreatedAt, &c.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &c, nil
}

func (s *Service) SaveCompany(c models.Company) (string, error) {
	if c.ID == "" {
		c.ID = uuid.New().String()
	}
	c.TenantID = s.tenantID()

	_, err := s.db.Exec(`INSERT INTO companies (id, tenant_id, name, contact_person, phone, email, gstin, pan,
		address, city, state, state_code, pincode, opening_balance_paise, is_active, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
		ON CONFLICT(id) DO UPDATE SET
			name=excluded.name, contact_person=excluded.contact_person, phone=excluded.phone,
			email=excluded.email, gstin=excluded.gstin, pan=excluded.pan, address=excluded.address,
			city=excluded.city, state=excluded.state, state_code=excluded.state_code, pincode=excluded.pincode,
			opening_balance_paise=excluded.opening_balance_paise, is_active=excluded.is_active, updated_at=datetime('now')`,
		c.ID, c.TenantID, c.Name, nullStr(c.ContactPerson), nullStr(c.Phone), nullStr(c.Email),
		nullStr(c.GSTIN), nullStr(c.PAN), nullStr(c.Address), nullStr(c.City), nullStr(c.State),
		nullStr(c.StateCode), nullStr(c.Pincode), c.OpeningBalPaise, c.IsActive)
	if err != nil {
		return "", fmt.Errorf("save company: %w", err)
	}
	return c.ID, nil
}

func (s *Service) DeleteCompany(id string) error {
	_, err := s.db.Exec(`UPDATE companies SET is_active = 0, updated_at = datetime('now') WHERE id = ?`, id)
	return err
}

// ─── Bank Master ────────────────────────────────────────────────────────────

func (s *Service) ListBanks() ([]models.BankMaster, error) {
	rows, err := s.db.Query(`SELECT id, tenant_id, bank_name, COALESCE(account_number,''),
		COALESCE(ifsc_code,''), COALESCE(branch,''), opening_balance_paise,
		COALESCE(book_type,'BANK_BOOK'), COALESCE(note,''), is_active
		FROM bank_master WHERE tenant_id = ? ORDER BY bank_name`, s.tenantID())
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []models.BankMaster
	for rows.Next() {
		var b models.BankMaster
		if err := rows.Scan(&b.ID, &b.TenantID, &b.BankName, &b.AccountNumber,
			&b.IFSCCode, &b.Branch, &b.OpeningBalPaise, &b.BookType, &b.Note, &b.IsActive); err != nil {
			return nil, err
		}
		list = append(list, b)
	}
	return list, nil
}

func (s *Service) SaveBank(b models.BankMaster) (string, error) {
	if b.ID == "" {
		b.ID = uuid.New().String()
	}
	b.TenantID = s.tenantID()
	if b.BookType == "" {
		b.BookType = "BANK_BOOK"
	}

	_, err := s.db.Exec(`INSERT INTO bank_master (id, tenant_id, bank_name, account_number, ifsc_code, branch, opening_balance_paise, book_type, note, is_active, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
		ON CONFLICT(id) DO UPDATE SET
			bank_name=excluded.bank_name, account_number=excluded.account_number, ifsc_code=excluded.ifsc_code,
			branch=excluded.branch, opening_balance_paise=excluded.opening_balance_paise,
			book_type=excluded.book_type, note=excluded.note, is_active=excluded.is_active`,
		b.ID, b.TenantID, b.BankName, nullStr(b.AccountNumber), nullStr(b.IFSCCode),
		nullStr(b.Branch), b.OpeningBalPaise, b.BookType, nullStr(b.Note), b.IsActive)
	if err != nil {
		return "", fmt.Errorf("save bank: %w", err)
	}
	return b.ID, nil
}

func (s *Service) DeleteBank(id string) error {
	_, err := s.db.Exec(`UPDATE bank_master SET is_active = 0 WHERE id = ?`, id)
	return err
}

// ─── Employee ───────────────────────────────────────────────────────────────

func (s *Service) ListEmployees(query string) ([]models.Employee, error) {
	q := `SELECT id, tenant_id, name, COALESCE(phone,''), COALESCE(email,''),
		COALESCE(address,''), COALESCE(designation,''), salary_paise,
		COALESCE(joining_date,''), COALESCE(paid_holiday_count,0), is_active
		FROM employees WHERE tenant_id = ?`
	args := []interface{}{s.tenantID()}

	if query != "" {
		q += ` AND (name LIKE ? OR phone LIKE ?)`
		p := "%" + query + "%"
		args = append(args, p, p)
	}
	q += ` ORDER BY name`

	rows, err := s.db.Query(q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []models.Employee
	for rows.Next() {
		var e models.Employee
		if err := rows.Scan(&e.ID, &e.TenantID, &e.Name, &e.Phone, &e.Email,
			&e.Address, &e.Designation, &e.SalaryPaise, &e.JoiningDate, &e.PaidHolidayCount, &e.IsActive); err != nil {
			return nil, err
		}
		list = append(list, e)
	}
	return list, nil
}

func (s *Service) SaveEmployee(e models.Employee) (string, error) {
	if e.ID == "" {
		e.ID = uuid.New().String()
	}
	e.TenantID = s.tenantID()

	_, err := s.db.Exec(`INSERT INTO employees (id, tenant_id, name, phone, email, address, designation, salary_paise, joining_date, paid_holiday_count, is_active, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
		ON CONFLICT(id) DO UPDATE SET
			name=excluded.name, phone=excluded.phone, email=excluded.email, address=excluded.address,
			designation=excluded.designation, salary_paise=excluded.salary_paise, joining_date=excluded.joining_date,
			paid_holiday_count=excluded.paid_holiday_count, is_active=excluded.is_active, updated_at=datetime('now')`,
		e.ID, e.TenantID, e.Name, nullStr(e.Phone), nullStr(e.Email),
		nullStr(e.Address), nullStr(e.Designation), e.SalaryPaise, nullStr(e.JoiningDate), e.PaidHolidayCount, e.IsActive)
	if err != nil {
		return "", fmt.Errorf("save employee: %w", err)
	}
	return e.ID, nil
}

func (s *Service) DeleteEmployee(id string) error {
	_, err := s.db.Exec(`UPDATE employees SET is_active = 0, updated_at = datetime('now') WHERE id = ?`, id)
	return err
}

// ─── Expense Master ─────────────────────────────────────────────────────────

func (s *Service) ListExpenseTypes() ([]models.ExpenseMaster, error) {
	rows, err := s.db.Query(`SELECT id, tenant_id, name, is_active
		FROM expense_master WHERE tenant_id = ? ORDER BY name`, s.tenantID())
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []models.ExpenseMaster
	for rows.Next() {
		var e models.ExpenseMaster
		if err := rows.Scan(&e.ID, &e.TenantID, &e.Name, &e.IsActive); err != nil {
			return nil, err
		}
		list = append(list, e)
	}
	return list, nil
}

func (s *Service) SaveExpenseType(e models.ExpenseMaster) (string, error) {
	if e.ID == "" {
		e.ID = uuid.New().String()
	}
	e.TenantID = s.tenantID()

	_, err := s.db.Exec(`INSERT INTO expense_master (id, tenant_id, name, is_active, created_at)
		VALUES (?, ?, ?, ?, datetime('now'))
		ON CONFLICT(id) DO UPDATE SET name=excluded.name, is_active=excluded.is_active`,
		e.ID, e.TenantID, e.Name, e.IsActive)
	if err != nil {
		return "", fmt.Errorf("save expense type: %w", err)
	}
	return e.ID, nil
}

func (s *Service) DeleteExpenseType(id string) error {
	_, err := s.db.Exec(`UPDATE expense_master SET is_active = 0 WHERE id = ?`, id)
	return err
}

// ─── Income Master ──────────────────────────────────────────────────────────

func (s *Service) ListIncomeTypes() ([]models.IncomeMaster, error) {
	rows, err := s.db.Query(`SELECT id, tenant_id, name, is_active
		FROM income_master WHERE tenant_id = ? ORDER BY name`, s.tenantID())
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []models.IncomeMaster
	for rows.Next() {
		var e models.IncomeMaster
		if err := rows.Scan(&e.ID, &e.TenantID, &e.Name, &e.IsActive); err != nil {
			return nil, err
		}
		list = append(list, e)
	}
	return list, nil
}

func (s *Service) SaveIncomeType(e models.IncomeMaster) (string, error) {
	if e.ID == "" {
		e.ID = uuid.New().String()
	}
	e.TenantID = s.tenantID()

	_, err := s.db.Exec(`INSERT INTO income_master (id, tenant_id, name, is_active, created_at)
		VALUES (?, ?, ?, ?, datetime('now'))
		ON CONFLICT(id) DO UPDATE SET name=excluded.name, is_active=excluded.is_active`,
		e.ID, e.TenantID, e.Name, e.IsActive)
	if err != nil {
		return "", fmt.Errorf("save income type: %w", err)
	}
	return e.ID, nil
}

func (s *Service) DeleteIncomeType(id string) error {
	_, err := s.db.Exec(`UPDATE income_master SET is_active = 0 WHERE id = ?`, id)
	return err
}

// ─── Payment Master ─────────────────────────────────────────────────────────

func (s *Service) ListPaymentTypes() ([]models.PaymentMaster, error) {
	rows, err := s.db.Query(`SELECT id, tenant_id, name, is_active
		FROM payment_master WHERE tenant_id = ? ORDER BY name`, s.tenantID())
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []models.PaymentMaster
	for rows.Next() {
		var e models.PaymentMaster
		if err := rows.Scan(&e.ID, &e.TenantID, &e.Name, &e.IsActive); err != nil {
			return nil, err
		}
		list = append(list, e)
	}
	return list, nil
}

func (s *Service) SavePaymentType(e models.PaymentMaster) (string, error) {
	if e.ID == "" {
		e.ID = uuid.New().String()
	}
	e.TenantID = s.tenantID()

	_, err := s.db.Exec(`INSERT INTO payment_master (id, tenant_id, name, is_active, created_at)
		VALUES (?, ?, ?, ?, datetime('now'))
		ON CONFLICT(id) DO UPDATE SET name=excluded.name, is_active=excluded.is_active`,
		e.ID, e.TenantID, e.Name, e.IsActive)
	if err != nil {
		return "", fmt.Errorf("save payment type: %w", err)
	}
	return e.ID, nil
}

func (s *Service) DeletePaymentType(id string) error {
	_, err := s.db.Exec(`UPDATE payment_master SET is_active = 0 WHERE id = ?`, id)
	return err
}

// ─── Category (enhanced) ───────────────────────────────────────────────────

func (s *Service) SaveCategory(c models.Category) (string, error) {
	if c.ID == "" {
		c.ID = uuid.New().String()
	}
	c.TenantID = s.tenantID()

	_, err := s.db.Exec(`INSERT INTO categories (id, tenant_id, name, parent_id, purchase_discount_percent, sale_discount_percent, created_at)
		VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
		ON CONFLICT(id) DO UPDATE SET name=excluded.name, parent_id=excluded.parent_id,
			purchase_discount_percent=excluded.purchase_discount_percent, sale_discount_percent=excluded.sale_discount_percent`,
		c.ID, c.TenantID, c.Name, nullStr(c.ParentID), c.PurchaseDiscountPercent, c.SaleDiscountPercent)
	if err != nil {
		return "", fmt.Errorf("save category: %w", err)
	}
	return c.ID, nil
}

func (s *Service) DeleteCategory(id string) error {
	_, err := s.db.Exec(`DELETE FROM categories WHERE id = ?`, id)
	return err
}

// ─── Brand (enhanced) ──────────────────────────────────────────────────────

func (s *Service) SaveBrand(b models.Brand) (string, error) {
	if b.ID == "" {
		b.ID = uuid.New().String()
	}
	b.TenantID = s.tenantID()

	_, err := s.db.Exec(`INSERT INTO brands (id, tenant_id, name, created_at)
		VALUES (?, ?, ?, datetime('now'))
		ON CONFLICT(id) DO UPDATE SET name=excluded.name`,
		b.ID, b.TenantID, b.Name)
	if err != nil {
		return "", fmt.Errorf("save brand: %w", err)
	}
	return b.ID, nil
}

func (s *Service) DeleteBrand(id string) error {
	_, err := s.db.Exec(`DELETE FROM brands WHERE id = ?`, id)
	return err
}

// ─── Units ─────────────────────────────────────────────────────────────────

type Unit struct {
	ID        string `json:"id"`
	TenantID  string `json:"tenantId"`
	Name      string `json:"name"`
	ShortName string `json:"shortName"`
}

func (s *Service) ListUnits() ([]Unit, error) {
	rows, err := s.db.Query(`SELECT id, tenant_id, name, short_name FROM units WHERE tenant_id = ? ORDER BY name`, s.tenantID())
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []Unit
	for rows.Next() {
		var u Unit
		if err := rows.Scan(&u.ID, &u.TenantID, &u.Name, &u.ShortName); err != nil {
			return nil, err
		}
		list = append(list, u)
	}
	return list, nil
}

func (s *Service) SaveUnit(u Unit) (string, error) {
	if u.ID == "" {
		u.ID = uuid.New().String()
	}
	u.TenantID = s.tenantID()

	_, err := s.db.Exec(`INSERT INTO units (id, tenant_id, name, short_name, created_at)
		VALUES (?, ?, ?, ?, datetime('now'))
		ON CONFLICT(id) DO UPDATE SET name=excluded.name, short_name=excluded.short_name`,
		u.ID, u.TenantID, u.Name, u.ShortName)
	if err != nil {
		return "", fmt.Errorf("save unit: %w", err)
	}
	return u.ID, nil
}

func (s *Service) DeleteUnit(id string) error {
	_, err := s.db.Exec(`DELETE FROM units WHERE id = ?`, id)
	return err
}
