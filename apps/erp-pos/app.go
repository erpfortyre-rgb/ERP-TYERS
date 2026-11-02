package main

import (
	"context"
	"database/sql"
	"encoding/csv"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"

	"erp-pos/internal/accounts"
	"erp-pos/internal/auth"
	"erp-pos/internal/billing"
	"erp-pos/internal/database"
	"erp-pos/internal/inventory"
	"erp-pos/internal/masters"
	"erp-pos/internal/models"
	"erp-pos/internal/printing"
	"erp-pos/internal/reports"
	"erp-pos/internal/tools"

	"github.com/google/uuid"
)

type App struct {
	ctx       context.Context
	db        *sql.DB
	auth      *auth.Service
	engine    *billing.Engine
	masters   *masters.Service
	inventory *inventory.Service
	accounts  *accounts.Service
	tools     *tools.Service
	reports   *reports.Service
	printing  *printing.Service
}

func NewApp() *App {
	return &App{}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx

	dataDir, err := os.UserConfigDir()
	if err != nil {
		dataDir = "."
	}
	dbPath := filepath.Join(dataDir, "ShivShankarTyres", "pos.db")

	db, err := database.Open(dbPath)
	if err != nil {
		fmt.Printf("Database error: %v\n", err)
		return
	}

	a.db = db
	a.auth = auth.NewService(db)
	a.engine = billing.NewEngine(db)
	a.masters = masters.NewService(db)
	a.inventory = inventory.NewService(db)
	a.accounts = accounts.NewService(db)
	a.tools = tools.NewService(db)
	a.reports = reports.NewService(db)
	a.printing = printing.NewService(db)
	a.printing.LoadConfig()
	a.printing.SetContext(ctx)

	a.ensureDefaults()
}

func (a *App) shutdown(ctx context.Context) {
	if a.printing != nil {
		a.printing.Shutdown()
	}
	if a.db != nil {
		a.db.Close()
	}
}

func (a *App) ensureDefaults() {
	if a.db == nil {
		return
	}

	var count int
	a.db.QueryRow("SELECT COUNT(*) FROM tenants").Scan(&count)

	var tenantID string
	if count > 0 {
		a.db.QueryRow("SELECT COALESCE((SELECT t.id FROM tenants t WHERE t.id=(SELECT value FROM settings WHERE key='active_tenant_id')), (SELECT id FROM tenants LIMIT 1))").Scan(&tenantID)
	} else {
		tenantID = uuid.New().String()
		storeID := uuid.New().String()
		deviceID := uuid.New().String()

		a.db.Exec(`INSERT INTO tenants (id, name, phone) VALUES (?, 'Shiv Shankar Tyres', '+91 7877288109')`, tenantID)
		a.db.Exec(`INSERT INTO stores (id, tenant_id, name, code, address) VALUES (?, ?, 'Main Store', 'SST', 'Mancherial, Telangana')`, storeID, tenantID)
		a.db.Exec(`INSERT INTO device_identity (id, store_id, device_name, invoice_prefix, next_invoice_seq) VALUES (?, ?, 'Counter 1', 'SST-1', 1)`, deviceID, storeID)

		for _, u := range []struct{ name, short string }{
			{"Piece", "Pcs"}, {"Set", "Set"}, {"Kilogram", "Kg"}, {"Litre", "Ltr"}, {"Metre", "Mtr"}, {"Number", "Nos"},
		} {
			a.db.Exec(`INSERT INTO units (id, tenant_id, name, short_name) VALUES (?, ?, ?, ?)`, uuid.New().String(), tenantID, u.name, u.short)
		}

		for _, c := range []string{"Tyres", "Tubes", "Flaps", "Batteries", "Lubricants", "Accessories", "Services"} {
			a.db.Exec(`INSERT INTO categories (id, tenant_id, name) VALUES (?, ?, ?)`, uuid.New().String(), tenantID, c)
		}
	}

	// Roles and users — always ensure these exist (INSERT OR IGNORE is safe)
	for _, role := range []struct{ name, perms string }{
		{"Owner", `{"all":true}`},
		{"Manager", `{"billing":true,"inventory":true,"reports":true,"masters":true}`},
		{"Cashier", `{"billing":true,"inventory_view":true}`},
		{"Demo", `{"demo":true}`},
	} {
		a.db.Exec(`INSERT OR IGNORE INTO roles (id, tenant_id, name, permissions) VALUES (?, ?, ?, ?)`,
			"role-"+strings.ToLower(role.name), tenantID, role.name, role.perms)
	}

	ownerPinHash := auth.HashPIN("1234")
	ownerPwHash := auth.HashPassword("admin")
	a.db.Exec(`INSERT OR IGNORE INTO users (id, tenant_id, role_id, name, email, pin_hash, password_hash, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
		"user-owner", tenantID, "role-owner", "Nilesh", "owner@sst.local", ownerPinHash, ownerPwHash)

	mgrPinHash := auth.HashPIN("5678")
	mgrPwHash := auth.HashPassword("manager")
	a.db.Exec(`INSERT OR IGNORE INTO users (id, tenant_id, role_id, name, email, pin_hash, password_hash, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
		"user-manager", tenantID, "role-manager", "Rajesh", "manager@sst.local", mgrPinHash, mgrPwHash)

	cashierPinHash := auth.HashPIN("0000")
	cashierPwHash := auth.HashPassword("cashier")
	a.db.Exec(`INSERT OR IGNORE INTO users (id, tenant_id, role_id, name, email, pin_hash, password_hash, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
		"user-cashier", tenantID, "role-cashier", "Ravi", "cashier@sst.local", cashierPinHash, cashierPwHash)

	// Demo login — restricted view for client demos (only Expense/Income modules).
	// Upsert so existing installs get the updated name/email/password.
	demoPinHash := auth.HashPIN("1111")
	demoPwHash := auth.HashPassword("prem")
	a.db.Exec(`INSERT INTO users (id, tenant_id, role_id, name, email, pin_hash, password_hash, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, 1)
		ON CONFLICT(id) DO UPDATE SET name=excluded.name, email=excluded.email, password_hash=excluded.password_hash, is_active=1`,
		"user-demo", tenantID, "role-demo", "Chaturbhuj", "chaturbhuj@gmail.com", demoPinHash, demoPwHash)
}

// --- Wails bindings exposed to React ---

func (a *App) GetDashboardStats() (*models.DashboardStats, error) {
	return a.engine.GetDashboardStats()
}

func (a *App) SearchProducts(query string) ([]models.ProductWithPrices, error) {
	return a.engine.SearchProducts(query, 50)
}

func (a *App) FindByBarcode(barcode string) (*models.ProductWithPrices, error) {
	return a.engine.FindByBarcode(barcode)
}

func (a *App) FinalizeSale(draft models.SaleDraft) (*models.InvoiceWithDetails, error) {
	return a.engine.FinalizeSale(draft)
}

func (a *App) GetInvoices() ([]models.Invoice, error) {
	return a.engine.GetInvoices(100)
}

func (a *App) GetInvoiceDetails(invoiceID string) (*models.InvoiceWithDetails, error) {
	return a.engine.GetInvoiceDetails(invoiceID)
}

// ─── Invoice print data (assembled for the InvoiceTemplate) ──────────────────

type InvoicePrintItem struct {
	Name           string `json:"name"`
	HSN            string `json:"hsn"`
	QtyMillis      int64  `json:"qtyMillis"`
	UnitPricePaise int64  `json:"unitPricePaise"`
	MRPPaise       int64  `json:"mrpPaise"`
	GSTRate        int    `json:"gstRate"`
	GSTPaise       int64  `json:"gstPaise"`
	AmountPaise    int64  `json:"amountPaise"`
}

type InvoicePrintHSN struct {
	HSN          string `json:"hsn"`
	TaxablePaise int64  `json:"taxablePaise"`
	Rate         int    `json:"rate"`
	TaxPaise     int64  `json:"taxPaise"`
}

type InvoicePrintData struct {
	FirmName      string `json:"firmName"`
	FirmGSTIN     string `json:"firmGstin"`
	FirmAddress   string `json:"firmAddress"`
	FirmPhone     string `json:"firmPhone"`
	FirmEmail     string `json:"firmEmail"`
	FirmStateCode string `json:"firmStateCode"`

	BillToName    string `json:"billToName"`
	BillToGSTIN   string `json:"billToGstin"`
	BillToAddress string `json:"billToAddress"`
	BillToPhone   string `json:"billToPhone"`

	InvoiceNo     string `json:"invoiceNo"`
	Date          string `json:"date"`
	PlaceOfSupply string `json:"placeOfSupply"`
	ReverseCharge bool   `json:"reverseCharge"`

	Items             []InvoicePrintItem `json:"items"`
	SubtotalPaise     int64              `json:"subtotalPaise"`
	DiscountPaise     int64              `json:"discountPaise"`
	IsInterState      bool               `json:"isInterState"`
	IGSTPaise         int64              `json:"igstPaise"`
	CGSTPaise         int64              `json:"cgstPaise"`
	SGSTPaise         int64              `json:"sgstPaise"`
	RoundoffPaise     int64              `json:"roundoffPaise"`
	TotalPaise        int64              `json:"totalPaise"`
	ReceivedPaise     int64              `json:"receivedPaise"`
	BalancePaise      int64              `json:"balancePaise"`
	AmountInWords     string             `json:"amountInWords"`
	PaymentMode       string             `json:"paymentMode"`
	HSNSummary        []InvoicePrintHSN  `json:"hsnSummary"`
	Terms             string             `json:"terms"`
}

func (a *App) GetInvoicePrintData(invoiceID string) (*InvoicePrintData, error) {
	inv, err := a.engine.GetInvoiceDetails(invoiceID)
	if err != nil {
		return nil, err
	}
	firm, _ := a.GetFirmProfile()
	d := &InvoicePrintData{}
	// Per-invoice terms (empty → frontend falls back to global Settings terms).
	a.db.QueryRow(`SELECT COALESCE(terms, '') FROM invoices WHERE id = ?`, invoiceID).Scan(&d.Terms)
	if firm != nil {
		d.FirmName, d.FirmGSTIN, d.FirmAddress, d.FirmPhone, d.FirmEmail = firm.Name, firm.GSTIN, firm.Address, firm.Phone, firm.Email
		if len(firm.GSTIN) >= 2 {
			d.FirmStateCode = firm.GSTIN[:2]
		}
	}
	if d.FirmStateCode == "" {
		d.FirmStateCode = "36"
	}

	// Customer details (GSTIN / address / phone / state)
	d.BillToName = inv.CustomerName
	custState := ""
	if inv.CustomerID != "" {
		var g, ad, ph, st sql.NullString
		a.db.QueryRow(`SELECT COALESCE(gstin,''), COALESCE(address,''), COALESCE(phone,''), COALESCE(state_code,'') FROM customers WHERE id=?`, inv.CustomerID).Scan(&g, &ad, &ph, &st)
		d.BillToGSTIN, d.BillToAddress, d.BillToPhone = g.String, ad.String, ph.String
		custState = st.String
		if custState == "" && len(g.String) >= 2 {
			custState = g.String[:2]
		}
	}

	d.InvoiceNo = inv.InvoiceNumber
	d.Date = inv.CreatedAt
	d.IsInterState = custState != "" && custState != d.FirmStateCode
	if custState != "" {
		d.PlaceOfSupply = custState
	} else {
		d.PlaceOfSupply = d.FirmStateCode
	}

	// Items + HSN summary (group by hsn + rate)
	hsnMap := map[string]*InvoicePrintHSN{}
	for _, it := range inv.Items {
		taxable := it.TotalPaise - it.TaxPaise
		d.Items = append(d.Items, InvoicePrintItem{
			Name: it.ProductName, HSN: it.HSNCode, QtyMillis: it.QuantityMillis,
			UnitPricePaise: it.UnitPricePaise, MRPPaise: it.UnitPricePaise,
			GSTRate: it.TaxPercent, GSTPaise: it.TaxPaise, AmountPaise: it.TotalPaise,
		})
		key := fmt.Sprintf("%s|%d", it.HSNCode, it.TaxPercent)
		if h, ok := hsnMap[key]; ok {
			h.TaxablePaise += taxable
			h.TaxPaise += it.TaxPaise
		} else {
			hsnMap[key] = &InvoicePrintHSN{HSN: it.HSNCode, Rate: it.TaxPercent, TaxablePaise: taxable, TaxPaise: it.TaxPaise}
		}
	}
	for _, h := range hsnMap {
		d.HSNSummary = append(d.HSNSummary, *h)
	}

	d.SubtotalPaise = inv.SubtotalPaise
	d.DiscountPaise = inv.DiscountPaise
	d.RoundoffPaise = inv.RoundoffPaise
	d.TotalPaise = inv.TotalPaise
	// Tax split
	if d.IsInterState {
		d.IGSTPaise = inv.TaxPaise
	} else {
		d.CGSTPaise = inv.TaxPaise / 2
		d.SGSTPaise = inv.TaxPaise - inv.TaxPaise/2
	}
	// Payments
	var received int64
	for _, p := range inv.Payments {
		received += p.AmountPaise
		if d.PaymentMode == "" {
			d.PaymentMode = p.Method
		}
	}
	d.ReceivedPaise = received
	d.BalancePaise = inv.TotalPaise - received
	d.AmountInWords = rupeesInWords(inv.TotalPaise)
	return d, nil
}

// rupeesInWords converts paise to an Indian-format amount in words,
// e.g. 435400 → "Rupees Four Thousand Three Hundred Fifty Four Only".
func rupeesInWords(paise int64) string {
	rupees := paise / 100
	p := paise % 100
	words := "Rupees " + intToIndianWords(rupees)
	if p > 0 {
		words += " and " + intToIndianWords(p) + " Paise"
	}
	return words + " Only"
}

func intToIndianWords(n int64) string {
	if n == 0 {
		return "Zero"
	}
	ones := []string{"", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
		"Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"}
	tens := []string{"", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"}
	var twoDigits func(x int64) string
	twoDigits = func(x int64) string {
		if x < 20 {
			return ones[x]
		}
		w := tens[x/10]
		if x%10 > 0 {
			w += " " + ones[x%10]
		}
		return w
	}
	threeDigits := func(x int64) string {
		w := ""
		if x >= 100 {
			w = ones[x/100] + " Hundred"
			if x%100 > 0 {
				w += " " + twoDigits(x%100)
			}
		} else {
			w = twoDigits(x)
		}
		return w
	}
	parts := []string{}
	crore := n / 10000000
	n %= 10000000
	lakh := n / 100000
	n %= 100000
	thousand := n / 1000
	n %= 1000
	hundred := n
	if crore > 0 {
		parts = append(parts, threeDigits(crore)+" Crore")
	}
	if lakh > 0 {
		parts = append(parts, twoDigits(lakh)+" Lakh")
	}
	if thousand > 0 {
		parts = append(parts, twoDigits(thousand)+" Thousand")
	}
	if hundred > 0 {
		parts = append(parts, threeDigits(hundred))
	}
	return strings.Join(parts, " ")
}

func (a *App) GetDeviceConfig() (*models.DeviceIdentity, error) {
	return a.engine.GetDeviceConfig()
}

// ─── Auth bindings ────────────────────────────────────────────────────────

func (a *App) LoginByPIN(pin string) (*auth.UserInfo, error) {
	return a.auth.LoginByPIN(pin)
}

func (a *App) LoginByPassword(email, password string) (*auth.UserInfo, error) {
	return a.auth.LoginByPassword(email, password)
}

func (a *App) GetCurrentUser(userID string) (*auth.UserInfo, error) {
	return a.auth.GetCurrentUser(userID)
}

func (a *App) ListUsers() ([]auth.UserInfo, error) {
	return a.auth.ListUsers()
}

// ChangePassword updates a user's login password.
func (a *App) ChangePassword(userID, newPassword string) error {
	if strings.TrimSpace(newPassword) == "" {
		return fmt.Errorf("password cannot be empty")
	}
	_, err := a.db.Exec(`UPDATE users SET password_hash=? WHERE id=?`, auth.HashPassword(newPassword), userID)
	return err
}

// CreateUser adds a new login user with a role. roleName: Owner/Manager/Cashier.
// New users get a default PIN of 0000 (change later). Admin-only in the UI.
func (a *App) CreateUser(name, email, password, roleName string) error {
	if strings.TrimSpace(name) == "" || strings.TrimSpace(password) == "" {
		return fmt.Errorf("name and password are required")
	}
	return a.CreateEmployee(name, email, password, "0000", roleName)
}

// CreateEmployee hires a staff member for the ACTIVE company with their own
// login (email+password) and counter PIN, on a chosen role. The role is
// resolved within the active company so each company keeps its own roles.
func (a *App) CreateEmployee(name, email, password, pin, roleName string) error {
	if strings.TrimSpace(name) == "" || strings.TrimSpace(password) == "" {
		return fmt.Errorf("name and password are required")
	}
	if strings.TrimSpace(pin) == "" {
		pin = "0000"
	}
	tenantID := a.activeTenantID()
	roleID := a.resolveRoleID(tenantID, roleName)
	if roleID == "" {
		return fmt.Errorf("role %q not found in this company", roleName)
	}
	_, err := a.db.Exec(`INSERT INTO users (id, tenant_id, role_id, name, email, pin_hash, password_hash, is_active)
		VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
		uuid.New().String(), tenantID, roleID, name, nullStr(email), auth.HashPIN(pin), auth.HashPassword(password))
	if err != nil {
		return fmt.Errorf("create user: %w", err)
	}
	return nil
}

// resolveRoleID finds a role id by name within a company, falling back to the
// legacy shared "role-<name>" id used by the first company.
func (a *App) resolveRoleID(tenantID, roleName string) string {
	var id string
	a.db.QueryRow(`SELECT id FROM roles WHERE tenant_id=? AND lower(name)=lower(?)`,
		tenantID, strings.TrimSpace(roleName)).Scan(&id)
	if id == "" {
		legacy := "role-" + strings.ToLower(strings.TrimSpace(roleName))
		var cnt int
		a.db.QueryRow(`SELECT COUNT(*) FROM roles WHERE id=? AND tenant_id=?`, legacy, tenantID).Scan(&cnt)
		if cnt > 0 {
			id = legacy
		}
	}
	return id
}

// Product CRUD

func (a *App) SaveProduct(p models.Product, prices []models.ProductPrice, subItems []models.ProductSubItem, rawMaterials []models.ProductRawMaterial) error {
	tx, err := a.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	isNew := p.ID == ""
	if isNew {
		p.ID = uuid.New().String()
	}

	var tenantID string
	tx.QueryRow("SELECT COALESCE((SELECT t.id FROM tenants t WHERE t.id=(SELECT value FROM settings WHERE key='active_tenant_id')), (SELECT id FROM tenants LIMIT 1))").Scan(&tenantID)
	p.TenantID = tenantID

	_, err = tx.Exec(`INSERT INTO products (id, tenant_id, name, sku, barcode, hsn_code, category_id, brand_id, unit_id, tax_percent, is_active, is_kit, description, alert_quantity_millis, purchase_price_paise,
			product_code, gst_applicable, group_code, group_name, auto_qty_millis, opening_qty_millis, reorder_qty_millis, is_service, size, colour, expiry_month, location, terms, product_tags,
			created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,  ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,  datetime('now'), datetime('now'))
		ON CONFLICT(id) DO UPDATE SET
			name=excluded.name, sku=excluded.sku, barcode=excluded.barcode, hsn_code=excluded.hsn_code,
			category_id=excluded.category_id, brand_id=excluded.brand_id, unit_id=excluded.unit_id,
			tax_percent=excluded.tax_percent, is_active=excluded.is_active, is_kit=excluded.is_kit,
			description=excluded.description, alert_quantity_millis=excluded.alert_quantity_millis,
			purchase_price_paise=excluded.purchase_price_paise,
			product_code=excluded.product_code, gst_applicable=excluded.gst_applicable,
			group_code=excluded.group_code, group_name=excluded.group_name,
			auto_qty_millis=excluded.auto_qty_millis, opening_qty_millis=excluded.opening_qty_millis,
			reorder_qty_millis=excluded.reorder_qty_millis, is_service=excluded.is_service,
			size=excluded.size, colour=excluded.colour, expiry_month=excluded.expiry_month,
			location=excluded.location, terms=excluded.terms, product_tags=excluded.product_tags,
			updated_at=datetime('now')`,
		p.ID, p.TenantID, p.Name, nullStr(p.SKU), nullStr(p.Barcode), nullStr(p.HSNCode),
		nullStr(p.CategoryID), nullStr(p.BrandID), nullStr(p.UnitID),
		p.TaxPercent, p.IsActive, p.IsKit, nullStr(p.Description),
		p.AlertQuantityMillis, p.PurchasePricePaise,
		nullStr(p.ProductCode), p.GSTApplicable, nullStr(p.GroupCode), nullStr(p.GroupName),
		p.AutoQtyMillis, p.OpeningQtyMillis, p.ReorderQtyMillis, p.IsService,
		nullStr(p.Size), nullStr(p.Colour), nullStr(p.ExpiryMonth), nullStr(p.Location), nullStr(p.Terms), nullStr(p.ProductTags))
	if err != nil {
		return fmt.Errorf("save product: %w", err)
	}

	// Seed opening stock into local_stock for a NEW product (so Opening Qty
	// actually reflects in available stock, not just a product field).
	if isNew && p.OpeningQtyMillis > 0 {
		var storeID string
		tx.QueryRow(`SELECT id FROM stores LIMIT 1`).Scan(&storeID)
		if storeID != "" {
			if _, err = tx.Exec(`INSERT INTO local_stock (product_id, store_id, quantity_millis, updated_at)
				VALUES (?, ?, ?, datetime('now'))
				ON CONFLICT(product_id) DO UPDATE SET quantity_millis=excluded.quantity_millis, updated_at=datetime('now')`,
				p.ID, storeID, p.OpeningQtyMillis); err != nil {
				return fmt.Errorf("seed opening stock: %w", err)
			}
		}
	}

	// Delete old prices first so upsert doesn't hit UNIQUE constraint on the existing IDs
	if _, err = tx.Exec(`DELETE FROM product_prices WHERE product_id = ?`, p.ID); err != nil {
		return fmt.Errorf("delete old prices: %w", err)
	}
	for _, price := range prices {
		price.ID = uuid.New().String()
		_, err = tx.Exec(`INSERT INTO product_prices (id, product_id, tier, price_paise, valid_from, created_at)
			VALUES (?, ?, ?, ?, ?, datetime('now'))`,
			price.ID, p.ID, price.Tier, price.PricePaise, price.ValidFrom)
		if err != nil {
			return fmt.Errorf("save price: %w", err)
		}
	}

	// Sub Items — replace all for this product
	if _, err = tx.Exec(`DELETE FROM product_sub_items WHERE product_id = ?`, p.ID); err != nil {
		return fmt.Errorf("delete old sub items: %w", err)
	}
	for i, si := range subItems {
		if strings.TrimSpace(si.Name) == "" {
			continue
		}
		if _, err = tx.Exec(`INSERT INTO product_sub_items (id, product_id, name, value, sort_order) VALUES (?, ?, ?, ?, ?)`,
			uuid.New().String(), p.ID, si.Name, nullStr(si.Value), i); err != nil {
			return fmt.Errorf("save sub item: %w", err)
		}
	}

	// Raw Materials — replace all for this product
	if _, err = tx.Exec(`DELETE FROM product_raw_materials WHERE product_id = ?`, p.ID); err != nil {
		return fmt.Errorf("delete old raw materials: %w", err)
	}
	for i, rm := range rawMaterials {
		if strings.TrimSpace(rm.Name) == "" {
			continue
		}
		if _, err = tx.Exec(`INSERT INTO product_raw_materials (id, product_id, name, qty_millis, unit, sort_order) VALUES (?, ?, ?, ?, ?, ?)`,
			uuid.New().String(), p.ID, rm.Name, rm.QtyMillis, nullStr(rm.Unit), i); err != nil {
			return fmt.Errorf("save raw material: %w", err)
		}
	}

	return tx.Commit()
}

// GetProductSubItems returns the Sub Items for a product (for the edit form).
func (a *App) GetProductSubItems(productID string) ([]models.ProductSubItem, error) {
	rows, err := a.db.Query(`SELECT id, product_id, name, COALESCE(value,''), sort_order FROM product_sub_items WHERE product_id = ? ORDER BY sort_order`, productID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	list := make([]models.ProductSubItem, 0)
	for rows.Next() {
		var s models.ProductSubItem
		if err := rows.Scan(&s.ID, &s.ProductID, &s.Name, &s.Value, &s.SortOrder); err != nil {
			return nil, err
		}
		list = append(list, s)
	}
	return list, nil
}

// GetProductRawMaterials returns the Raw Materials for a product (for the edit form).
func (a *App) GetProductRawMaterials(productID string) ([]models.ProductRawMaterial, error) {
	rows, err := a.db.Query(`SELECT id, product_id, name, qty_millis, COALESCE(unit,''), sort_order FROM product_raw_materials WHERE product_id = ? ORDER BY sort_order`, productID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	list := make([]models.ProductRawMaterial, 0)
	for rows.Next() {
		var r models.ProductRawMaterial
		if err := rows.Scan(&r.ID, &r.ProductID, &r.Name, &r.QtyMillis, &r.Unit, &r.SortOrder); err != nil {
			return nil, err
		}
		list = append(list, r)
	}
	return list, nil
}

func (a *App) DeleteProduct(id string) error {
	_, err := a.db.Exec(`UPDATE products SET is_active = 0, updated_at = datetime('now') WHERE id = ?`, id)
	return err
}

func (a *App) GetCategories() ([]models.Category, error) {
	rows, err := a.db.Query(`SELECT id, tenant_id, name, COALESCE(parent_id, ''),
		COALESCE(purchase_discount_percent, 0), COALESCE(sale_discount_percent, 0)
		FROM categories ORDER BY name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var cats []models.Category
	for rows.Next() {
		var c models.Category
		if err := rows.Scan(&c.ID, &c.TenantID, &c.Name, &c.ParentID,
			&c.PurchaseDiscountPercent, &c.SaleDiscountPercent); err != nil {
			return nil, err
		}
		cats = append(cats, c)
	}
	return cats, nil
}

func (a *App) GetBrands() ([]models.Brand, error) {
	rows, err := a.db.Query(`SELECT id, tenant_id, name FROM brands ORDER BY name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var brands []models.Brand
	for rows.Next() {
		var b models.Brand
		if err := rows.Scan(&b.ID, &b.TenantID, &b.Name); err != nil {
			return nil, err
		}
		brands = append(brands, b)
	}
	return brands, nil
}

func (a *App) SearchCustomers(query string) ([]models.Customer, error) {
	pattern := "%" + query + "%"
	rows, err := a.db.Query(`SELECT id, tenant_id, name, COALESCE(phone,''), COALESCE(email,''),
		COALESCE(gstin,''), COALESCE(address,''), credit_limit_paise, is_active,
		COALESCE(business_name,''), COALESCE(contact_id,''), COALESCE(group_id,''), COALESCE(contact_type,'individual'),
		COALESCE(alternate_phone,''), COALESCE(landline,''), COALESCE(pay_term_days,0), COALESCE(opening_balance_paise,0),
		COALESCE(city,''), COALESCE(state_code,'')
		FROM customers WHERE is_active = 1 AND (name LIKE ? OR phone LIKE ? OR business_name LIKE ? OR contact_id LIKE ?)
		ORDER BY name LIMIT 1000`,
		pattern, pattern, pattern, pattern)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var customers []models.Customer
	for rows.Next() {
		var c models.Customer
		if err := rows.Scan(&c.ID, &c.TenantID, &c.Name, &c.Phone, &c.Email, &c.GSTIN,
			&c.Address, &c.CreditLimitPaise, &c.IsActive,
			&c.BusinessName, &c.ContactID, &c.GroupID, &c.ContactType,
			&c.AlternatePhone, &c.Landline, &c.PayTermDays, &c.OpeningBalancePaise,
			&c.City, &c.StateCode); err != nil {
			return nil, err
		}
		customers = append(customers, c)
	}
	return customers, nil
}

func (a *App) SaveCustomer(c models.Customer) (string, error) {
	isNew := c.ID == ""
	if isNew {
		c.ID = uuid.New().String()
	}

	var tenantID string
	a.db.QueryRow("SELECT COALESCE((SELECT t.id FROM tenants t WHERE t.id=(SELECT value FROM settings WHERE key='active_tenant_id')), (SELECT id FROM tenants LIMIT 1))").Scan(&tenantID)

	// Auto-generate a readable Contact ID (CUST0001) for new customers.
	if isNew && strings.TrimSpace(c.ContactID) == "" {
		var n int
		a.db.QueryRow("SELECT COUNT(*) FROM customers").Scan(&n)
		c.ContactID = fmt.Sprintf("CUST%04d", n+1)
	}
	// Derive state code from GSTIN if not set.
	if c.StateCode == "" && len(c.GSTIN) >= 2 {
		c.StateCode = c.GSTIN[:2]
	}
	if c.ContactType == "" {
		c.ContactType = "individual"
	}

	_, err := a.db.Exec(`INSERT INTO customers (id, tenant_id, name, phone, email, gstin, address, state_code, credit_limit_paise, is_active,
			business_name, contact_id, group_id, contact_type, alternate_phone, landline, pay_term_days, opening_balance_paise, city,
			created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1,  ?, ?, ?, ?, ?, ?, ?, ?, ?,  datetime('now'), datetime('now'))
		ON CONFLICT(id) DO UPDATE SET
			name=excluded.name, phone=excluded.phone, email=excluded.email,
			gstin=excluded.gstin, address=excluded.address, state_code=excluded.state_code,
			credit_limit_paise=excluded.credit_limit_paise,
			business_name=excluded.business_name, group_id=excluded.group_id, contact_type=excluded.contact_type,
			alternate_phone=excluded.alternate_phone, landline=excluded.landline, pay_term_days=excluded.pay_term_days,
			opening_balance_paise=excluded.opening_balance_paise, city=excluded.city, updated_at=datetime('now')`,
		c.ID, tenantID, c.Name, nullStr(c.Phone), nullStr(c.Email), nullStr(c.GSTIN), nullStr(c.Address), nullStr(c.StateCode), c.CreditLimitPaise,
		nullStr(c.BusinessName), nullStr(c.ContactID), nullStr(c.GroupID), c.ContactType, nullStr(c.AlternatePhone), nullStr(c.Landline), c.PayTermDays, c.OpeningBalancePaise, nullStr(c.City))
	if err != nil {
		return "", err
	}
	return c.ID, nil
}

// ─── Customer Groups (Parties → group-wise pricing) ──────────────────────────

func (a *App) ListCustomerGroups() ([]models.CustomerGroup, error) {
	rows, err := a.db.Query(`SELECT id, tenant_id, name, calc_percent, COALESCE(selling_price_group,''), is_active FROM customer_groups ORDER BY name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	list := make([]models.CustomerGroup, 0)
	for rows.Next() {
		var g models.CustomerGroup
		var active int
		if err := rows.Scan(&g.ID, &g.TenantID, &g.Name, &g.CalcPercent, &g.SellingPriceGroup, &active); err != nil {
			return nil, err
		}
		g.IsActive = active == 1
		list = append(list, g)
	}
	return list, nil
}

func (a *App) SaveCustomerGroup(g models.CustomerGroup) (string, error) {
	isNew := g.ID == ""
	if isNew {
		g.ID = uuid.New().String()
	}
	var tenantID string
	a.db.QueryRow("SELECT COALESCE((SELECT t.id FROM tenants t WHERE t.id=(SELECT value FROM settings WHERE key='active_tenant_id')), (SELECT id FROM tenants LIMIT 1))").Scan(&tenantID)
	active := 0
	if g.IsActive || isNew {
		active = 1
	}
	_, err := a.db.Exec(`INSERT INTO customer_groups (id, tenant_id, name, calc_percent, selling_price_group, is_active)
		VALUES (?, ?, ?, ?, ?, ?)
		ON CONFLICT(id) DO UPDATE SET name=excluded.name, calc_percent=excluded.calc_percent,
			selling_price_group=excluded.selling_price_group, is_active=excluded.is_active`,
		g.ID, tenantID, g.Name, g.CalcPercent, nullStr(g.SellingPriceGroup), active)
	return g.ID, err
}

func (a *App) DeleteCustomerGroup(id string) error {
	_, err := a.db.Exec(`UPDATE customer_groups SET is_active=0 WHERE id=?`, id)
	return err
}

// ImportResult reports how many rows were imported and any per-row errors.
type ImportResult struct {
	Imported int      `json:"imported"`
	Errors   []string `json:"errors"`
}

// ImportCustomersCSV bulk-imports customers from CSV text. Column order (a
// header row is optional and skipped if the first cell is "name"):
// Name, Business Name, Phone, Email, GSTIN, Address, City, State Code, Opening Balance(₹), Credit Limit(₹), Pay Term(days)
func (a *App) ImportCustomersCSV(content string) (*ImportResult, error) {
	r := csv.NewReader(strings.NewReader(content))
	r.FieldsPerRecord = -1
	rows, err := r.ReadAll()
	if err != nil {
		return nil, fmt.Errorf("parse csv: %w", err)
	}
	res := &ImportResult{Errors: []string{}}
	for i, row := range rows {
		if len(row) == 0 {
			continue
		}
		if i == 0 && strings.EqualFold(strings.TrimSpace(row[0]), "name") {
			continue // header
		}
		get := func(idx int) string {
			if idx < len(row) {
				return strings.TrimSpace(row[idx])
			}
			return ""
		}
		money := func(s string) int64 {
			f, _ := strconv.ParseFloat(strings.ReplaceAll(s, ",", ""), 64)
			return int64(f * 100)
		}
		if get(0) == "" {
			continue
		}
		c := models.Customer{
			Name: get(0), BusinessName: get(1), Phone: get(2), Email: get(3), GSTIN: get(4),
			Address: get(5), City: get(6), StateCode: get(7),
			OpeningBalancePaise: money(get(8)), CreditLimitPaise: money(get(9)),
			ContactType: "individual", IsActive: true,
		}
		if pt := get(10); pt != "" {
			c.PayTermDays, _ = strconv.Atoi(pt)
		}
		if _, err := a.SaveCustomer(c); err != nil {
			res.Errors = append(res.Errors, fmt.Sprintf("row %d (%s): %v", i+1, c.Name, err))
			continue
		}
		res.Imported++
	}
	return res, nil
}

func (a *App) GetStockList() ([]models.StockEntry, error) {
	rows, err := a.db.Query(`
		SELECT p.id, p.name, COALESCE(p.sku,''), COALESCE(p.barcode,''),
			COALESCE(c.name,''), COALESCE(b.name,''),
			COALESCE(ls.quantity_millis, 0),
			COALESCE((SELECT pp.price_paise FROM product_prices pp WHERE pp.product_id = p.id AND pp.tier = 'MRP' AND pp.valid_from <= date('now') ORDER BY pp.valid_from DESC LIMIT 1), 0)
		FROM products p
		LEFT JOIN categories c ON p.category_id = c.id
		LEFT JOIN brands b ON p.brand_id = b.id
		LEFT JOIN local_stock ls ON p.id = ls.product_id
		WHERE p.is_active = 1
		ORDER BY p.name
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var entries []models.StockEntry
	for rows.Next() {
		var e models.StockEntry
		if err := rows.Scan(&e.ProductID, &e.ProductName, &e.SKU, &e.Barcode,
			&e.CategoryName, &e.BrandName, &e.QuantityMillis, &e.MRPPaise); err != nil {
			return nil, err
		}
		entries = append(entries, e)
	}
	return entries, nil
}

func nullStr(s string) interface{} {
	if s == "" {
		return nil
	}
	return s
}

// ─── Masters bindings ──────────────────────────────────────────────────────

func (a *App) ListCompanies(query string) ([]models.Company, error) {
	return a.masters.ListCompanies(query)
}

func (a *App) GetCompany(id string) (*models.Company, error) {
	return a.masters.GetCompany(id)
}

func (a *App) SaveCompany(c models.Company) (string, error) {
	return a.masters.SaveCompany(c)
}

func (a *App) DeleteCompany(id string) error {
	return a.masters.DeleteCompany(id)
}

func (a *App) ListBanks() ([]models.BankMaster, error) {
	return a.masters.ListBanks()
}

func (a *App) SaveBank(b models.BankMaster) (string, error) {
	return a.masters.SaveBank(b)
}

func (a *App) DeleteBank(id string) error {
	return a.masters.DeleteBank(id)
}

func (a *App) ListEmployees(query string) ([]models.Employee, error) {
	return a.masters.ListEmployees(query)
}

func (a *App) SaveEmployee(e models.Employee) (string, error) {
	return a.masters.SaveEmployee(e)
}

func (a *App) DeleteEmployee(id string) error {
	return a.masters.DeleteEmployee(id)
}

func (a *App) ListExpenseTypes() ([]models.ExpenseMaster, error) {
	return a.masters.ListExpenseTypes()
}

func (a *App) SaveExpenseType(e models.ExpenseMaster) (string, error) {
	return a.masters.SaveExpenseType(e)
}

func (a *App) DeleteExpenseType(id string) error {
	return a.masters.DeleteExpenseType(id)
}

func (a *App) ListIncomeTypes() ([]models.IncomeMaster, error) {
	return a.masters.ListIncomeTypes()
}

func (a *App) SaveIncomeType(e models.IncomeMaster) (string, error) {
	return a.masters.SaveIncomeType(e)
}

func (a *App) DeleteIncomeType(id string) error {
	return a.masters.DeleteIncomeType(id)
}

func (a *App) ListPaymentTypes() ([]models.PaymentMaster, error) {
	return a.masters.ListPaymentTypes()
}

func (a *App) SavePaymentType(e models.PaymentMaster) (string, error) {
	return a.masters.SavePaymentType(e)
}

func (a *App) DeletePaymentType(id string) error {
	return a.masters.DeletePaymentType(id)
}

func (a *App) SaveCategory(c models.Category) (string, error) {
	return a.masters.SaveCategory(c)
}

func (a *App) DeleteCategory(id string) error {
	return a.masters.DeleteCategory(id)
}

func (a *App) SaveBrand(b models.Brand) (string, error) {
	return a.masters.SaveBrand(b)
}

func (a *App) DeleteBrand(id string) error {
	return a.masters.DeleteBrand(id)
}

func (a *App) ListUnits() ([]masters.Unit, error) {
	return a.masters.ListUnits()
}

func (a *App) SaveUnit(u masters.Unit) (string, error) {
	return a.masters.SaveUnit(u)
}

func (a *App) DeleteUnit(id string) error {
	return a.masters.DeleteUnit(id)
}

// ─── Inventory bindings ────────────────────────────────────────────────────

func (a *App) ListPurchaseOrders(status string) ([]models.PurchaseOrder, error) {
	return a.inventory.ListPurchaseOrders(status)
}

func (a *App) SavePurchaseOrder(po models.PurchaseOrder, items []models.PurchaseOrderItem) (string, error) {
	return a.inventory.SavePurchaseOrder(po, items)
}

func (a *App) ListSaleOrders(status string) ([]models.SaleOrder, error) {
	return a.inventory.ListSaleOrders(status)
}

func (a *App) SaveSaleOrder(so models.SaleOrder, items []models.SaleOrderItem) (string, error) {
	return a.inventory.SaveSaleOrder(so, items)
}

func (a *App) ListSalesReturns() ([]models.SalesReturn, error) {
	return a.inventory.ListSalesReturns()
}

func (a *App) SaveSalesReturn(sr models.SalesReturn, items []models.SalesReturnItem) (string, error) {
	return a.inventory.SaveSalesReturn(sr, items)
}

func (a *App) ListPurchaseReturns() ([]models.PurchaseReturn, error) {
	return a.inventory.ListPurchaseReturns()
}

func (a *App) DeletePurchaseOrder(id string) error {
	return a.inventory.DeletePurchaseOrder(id)
}

func (a *App) DeleteSaleOrder(id string) error {
	return a.inventory.DeleteSaleOrder(id)
}

func (a *App) DeleteQuotation(id string) error {
	return a.inventory.DeleteQuotation(id)
}

func (a *App) DeleteChallan(id string) error {
	return a.inventory.DeleteChallan(id)
}

func (a *App) SavePurchaseReturn(pr models.PurchaseReturn, items []models.PurchaseReturnItem) (string, error) {
	return a.inventory.SavePurchaseReturn(pr, items)
}

func (a *App) DeleteSalesReturn(id string) error  { return a.inventory.DeleteSalesReturn(id) }
func (a *App) DeletePurchaseReturn(id string) error { return a.inventory.DeletePurchaseReturn(id) }

func (a *App) ListDebitNotes() ([]models.DebitNote, error) {
	return a.inventory.ListDebitNotes()
}

func (a *App) SaveDebitNote(n models.DebitNote) (string, error) {
	return a.inventory.SaveDebitNote(n)
}

func (a *App) DeleteDebitNote(id string) error { return a.inventory.DeleteDebitNote(id) }

func (a *App) ListCreditNotes() ([]models.CreditNote, error) {
	return a.inventory.ListCreditNotes()
}

func (a *App) SaveCreditNote(n models.CreditNote) (string, error) {
	return a.inventory.SaveCreditNote(n)
}

func (a *App) DeleteCreditNote(id string) error { return a.inventory.DeleteCreditNote(id) }

func (a *App) ListChallans(status string) ([]models.CustomerChallan, error) {
	return a.inventory.ListChallans(status)
}

func (a *App) SaveChallan(ch models.CustomerChallan, items []models.CustomerChallanItem) (string, error) {
	return a.inventory.SaveChallan(ch, items)
}

func (a *App) ListQuotations(status string) ([]models.Quotation, error) {
	return a.inventory.ListQuotations(status)
}

func (a *App) SaveQuotation(qt models.Quotation, items []models.QuotationItem) (string, error) {
	return a.inventory.SaveQuotation(qt, items)
}

func (a *App) ListCheques(status string) ([]models.Cheque, error) {
	return a.inventory.ListCheques(status)
}

func (a *App) SaveCheque(c models.Cheque) (string, error) {
	return a.inventory.SaveCheque(c)
}

func (a *App) UpdateChequeStatus(id string, status string, clearedDate string) error {
	return a.inventory.UpdateChequeStatus(id, status, clearedDate)
}

// ─── Account bindings ──────────────────────────────────────────────────────

func (a *App) ListExpenseEntries(from, to string) ([]models.ExpenseEntry, error) {
	return a.accounts.ListExpenseEntries(from, to)
}

func (a *App) SaveExpenseEntry(e models.ExpenseEntry) (string, error) {
	return a.accounts.SaveExpenseEntry(e)
}

func (a *App) DeleteExpenseEntry(id, deletedBy, deletedByEmail string) error {
	return a.accounts.DeleteExpenseEntry(id, deletedBy, deletedByEmail)
}

func (a *App) ListIncomeEntries(from, to string) ([]models.IncomeEntry, error) {
	return a.accounts.ListIncomeEntries(from, to)
}

func (a *App) SaveIncomeEntry(e models.IncomeEntry) (string, error) {
	return a.accounts.SaveIncomeEntry(e)
}

func (a *App) DeleteIncomeEntry(id, deletedBy, deletedByEmail string) error {
	return a.accounts.DeleteIncomeEntry(id, deletedBy, deletedByEmail)
}

func (a *App) ListRecycleBin() ([]accounts.RecycleEntry, error) {
	return a.accounts.ListRecycleBin()
}

func (a *App) RestoreEntry(kind, id string) error {
	if kind == "invoice" {
		return a.engine.RestoreInvoice(id)
	}
	return a.accounts.RestoreEntry(kind, id)
}

// PurgeEntry permanently removes an entry from the Recycle Bin.
// Only an Owner/Admin may do this; other roles can soft-delete (move to bin)
// and restore, but never permanently delete. The role is passed from the
// logged-in user; this is a server-side guard in addition to hiding the UI.
func (a *App) PurgeEntry(kind, id, role string) error {
	if strings.ToLower(strings.TrimSpace(role)) != "owner" {
		return fmt.Errorf("permission denied: only Admin can permanently delete")
	}
	if kind == "invoice" {
		return a.engine.PurgeInvoice(id)
	}
	return a.accounts.PurgeEntry(kind, id)
}

// DeleteInvoice soft-deletes a sale into the Recycle Bin (reverses stock; all
// reports/ledgers/GST exclude it). deletedBy/email come from the logged-in user.
func (a *App) DeleteInvoice(invoiceID, deletedBy, deletedByEmail string) error {
	return a.engine.DeleteInvoice(invoiceID, deletedBy, deletedByEmail)
}

func (a *App) ListPaymentEntries(from, to string) ([]models.PaymentEntry, error) {
	return a.accounts.ListPaymentEntries(from, to)
}

func (a *App) SavePaymentEntry(e models.PaymentEntry) (string, error) {
	return a.accounts.SavePaymentEntry(e)
}

func (a *App) DeletePaymentEntry(id string) error {
	return a.accounts.DeletePaymentEntry(id)
}

func (a *App) ListAttendance(employeeID string, from, to string) ([]models.EmployeeAttendance, error) {
	return a.accounts.ListAttendance(employeeID, from, to)
}

func (a *App) SaveAttendance(att models.EmployeeAttendance) (string, error) {
	return a.accounts.SaveAttendance(att)
}

func (a *App) CustomerLedger(customerID string, from, to string) ([]accounts.LedgerEntry, error) {
	return a.accounts.CustomerLedger(customerID, from, to)
}

func (a *App) CompanyLedger(companyID string, from, to string) ([]accounts.LedgerEntry, error) {
	return a.accounts.CompanyLedger(companyID, from, to)
}

func (a *App) DayBook(date string) ([]accounts.DayBookEntry, error) {
	return a.accounts.DayBook(date)
}

func (a *App) ExpenseSummary(from, to string) ([]accounts.SummaryRow, error) {
	return a.accounts.ExpenseSummary(from, to)
}

func (a *App) IncomeSummary(from, to string) ([]accounts.SummaryRow, error) {
	return a.accounts.IncomeSummary(from, to)
}

func (a *App) CashBankSummary() ([]accounts.SummaryRow, error) {
	return a.accounts.CashBankSummary()
}

// ─── Tools bindings ───────────────────────────────────────────────────────

func (a *App) ListComplaints(status string) ([]models.Complaint, error) {
	return a.tools.ListComplaints(status)
}

func (a *App) SaveComplaint(c models.Complaint) (string, error) {
	return a.tools.SaveComplaint(c)
}

func (a *App) DeleteComplaint(id string) error {
	return a.tools.DeleteComplaint(id)
}

func (a *App) ListServiceReminders(status string) ([]models.ServiceReminder, error) {
	return a.tools.ListServiceReminders(status)
}

func (a *App) SaveServiceReminder(r models.ServiceReminder) (string, error) {
	return a.tools.SaveServiceReminder(r)
}

func (a *App) DeleteServiceReminder(id string) error {
	return a.tools.DeleteServiceReminder(id)
}

func (a *App) ListMessageTemplates() ([]models.MessageTemplate, error) {
	return a.tools.ListMessageTemplates()
}

func (a *App) SaveMessageTemplate(t models.MessageTemplate) (string, error) {
	return a.tools.SaveMessageTemplate(t)
}

func (a *App) DeleteMessageTemplate(id string) error {
	return a.tools.DeleteMessageTemplate(id)
}

func (a *App) AdjustStock(productID string, newQtyMillis int64, reason string) error {
	return a.tools.AdjustStock(productID, newQtyMillis, reason)
}

func (a *App) ListStockTransfers(status string) ([]models.StockTransfer, error) {
	return a.tools.ListStockTransfers(status)
}

func (a *App) SaveStockTransfer(t models.StockTransfer, items []models.StockTransferItem) (string, error) {
	return a.tools.SaveStockTransfer(t, items)
}

func (a *App) ListVouchers(vtype string) ([]models.Voucher, error) {
	return a.tools.ListVouchers(vtype)
}

func (a *App) SaveVoucher(v models.Voucher) (string, error) {
	return a.tools.SaveVoucher(v)
}

func (a *App) DeleteVoucher(id string) error {
	return a.tools.DeleteVoucher(id)
}

func (a *App) ListBOMKits() ([]models.BOMKit, error) {
	return a.tools.ListBOMKits()
}

func (a *App) SaveBOMKit(kit models.BOMKit, components []models.BOMComponent) (string, error) {
	return a.tools.SaveBOMKit(kit, components)
}

func (a *App) DeleteBOMKit(id string) error {
	return a.tools.DeleteBOMKit(id)
}

func (a *App) UpdateProductPrice(productID string, tier string, newPricePaise int64) error {
	return a.tools.UpdateProductPrice(productID, tier, newPricePaise)
}

func (a *App) GetSettings() (map[string]string, error) {
	return a.tools.GetSettings()
}

func (a *App) SaveSetting(key, value string) error {
	return a.tools.SaveSetting(key, value)
}

// FirmProfile is the shop's own details — shown on invoices and used to decide
// the GST store state (GSTIN first 2 digits) for inter-state vs intra-state tax.
type FirmProfile struct {
	Name    string `json:"name"`
	GSTIN   string `json:"gstin"`
	Address string `json:"address"`
	Phone   string `json:"phone"`
	Email   string `json:"email"`
}

// activeTenantID returns the id of the company the user is currently working in
// (settings key 'active_tenant_id'), falling back to the first tenant when no
// active company is set or the stored id no longer exists.
func (a *App) activeTenantID() string {
	var id string
	a.db.QueryRow("SELECT COALESCE((SELECT t.id FROM tenants t WHERE t.id=(SELECT value FROM settings WHERE key='active_tenant_id')), (SELECT id FROM tenants LIMIT 1))").Scan(&id)
	return id
}

// ─── Multi-company (firms the owner can add and switch between) ──────────────

// CompanyInfo is one firm the owner owns; IsActive marks the one in use now.
type CompanyInfo struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	GSTIN    string `json:"gstin"`
	Phone    string `json:"phone"`
	Address  string `json:"address"`
	IsActive bool   `json:"isActive"`
}

// ListCompanies returns every company, marking the currently active one.
func (a *App) ListFirms() ([]CompanyInfo, error) {
	active := a.activeTenantID()
	rows, err := a.db.Query(`SELECT id, name, COALESCE(gstin,''), COALESCE(phone,''), COALESCE(address,'') FROM tenants ORDER BY created_at, name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []CompanyInfo{}
	for rows.Next() {
		var c CompanyInfo
		if err := rows.Scan(&c.ID, &c.Name, &c.GSTIN, &c.Phone, &c.Address); err != nil {
			return nil, err
		}
		c.IsActive = c.ID == active
		out = append(out, c)
	}
	return out, nil
}

// SetActiveCompany switches the working company. All data reads/writes follow
// this (products, sales, reports, employees) — each company is isolated.
func (a *App) SetActiveCompany(tenantID string) error {
	var cnt int
	a.db.QueryRow(`SELECT COUNT(*) FROM tenants WHERE id=?`, tenantID).Scan(&cnt)
	if cnt == 0 {
		return fmt.Errorf("company not found")
	}
	_, err := a.db.Exec(`INSERT INTO settings (key, value) VALUES ('active_tenant_id', ?)
		ON CONFLICT(key) DO UPDATE SET value=excluded.value`, tenantID)
	return err
}

// CreateCompany adds a new firm with its own store, invoice series, default
// roles (Owner/Manager/Cashier) and makes it the active company. The new firm
// starts empty (no products/parties) and is fully isolated by tenant_id.
func (a *App) CreateFirm(f FirmProfile) (string, error) {
	if strings.TrimSpace(f.Name) == "" {
		return "", fmt.Errorf("company name required")
	}
	tx, err := a.db.Begin()
	if err != nil {
		return "", err
	}
	defer tx.Rollback()

	tenantID := uuid.New().String()
	storeID := uuid.New().String()
	deviceID := uuid.New().String()
	prefix := invoicePrefixFromName(f.Name)

	if _, err := tx.Exec(`INSERT INTO tenants (id, name, gstin, address, phone, email) VALUES (?, ?, ?, ?, ?, ?)`,
		tenantID, f.Name, nullStr(f.GSTIN), nullStr(f.Address), nullStr(f.Phone), nullStr(f.Email)); err != nil {
		return "", fmt.Errorf("create company: %w", err)
	}
	if _, err := tx.Exec(`INSERT INTO stores (id, tenant_id, name, code, address) VALUES (?, ?, 'Main Store', ?, ?)`,
		storeID, tenantID, prefix, nullStr(f.Address)); err != nil {
		return "", fmt.Errorf("create store: %w", err)
	}
	if _, err := tx.Exec(`INSERT INTO device_identity (id, store_id, device_name, invoice_prefix, next_invoice_seq) VALUES (?, ?, 'Counter 1', ?, 1)`,
		deviceID, storeID, prefix); err != nil {
		return "", fmt.Errorf("create device: %w", err)
	}
	for _, role := range []struct{ name, perms string }{
		{"Owner", `{"all":true}`},
		{"Manager", `{"billing":true,"inventory":true,"reports":true,"masters":true}`},
		{"Cashier", `{"billing":true,"inventory_view":true}`},
	} {
		if _, err := tx.Exec(`INSERT INTO roles (id, tenant_id, name, permissions) VALUES (?, ?, ?, ?)`,
			uuid.New().String(), tenantID, role.name, role.perms); err != nil {
			return "", fmt.Errorf("create role: %w", err)
		}
	}
	// default units + categories so the new firm is usable immediately
	for _, u := range []struct{ name, short string }{
		{"Piece", "Pcs"}, {"Set", "Set"}, {"Kilogram", "Kg"}, {"Litre", "Ltr"}, {"Metre", "Mtr"}, {"Number", "Nos"},
	} {
		tx.Exec(`INSERT INTO units (id, tenant_id, name, short_name) VALUES (?, ?, ?, ?)`, uuid.New().String(), tenantID, u.name, u.short)
	}
	for _, c := range []string{"Tyres", "Tubes", "Flaps", "Batteries", "Lubricants", "Accessories", "Services"} {
		tx.Exec(`INSERT INTO categories (id, tenant_id, name) VALUES (?, ?, ?)`, uuid.New().String(), tenantID, c)
	}
	if err := tx.Commit(); err != nil {
		return "", err
	}
	// make the new company active
	a.db.Exec(`INSERT INTO settings (key, value) VALUES ('active_tenant_id', ?)
		ON CONFLICT(key) DO UPDATE SET value=excluded.value`, tenantID)
	return tenantID, nil
}

// invoicePrefixFromName derives a short invoice/store prefix from a company name
// (up to 4 uppercase letters), falling back to "CMP".
func invoicePrefixFromName(name string) string {
	var b strings.Builder
	for _, r := range strings.ToUpper(name) {
		if r >= 'A' && r <= 'Z' {
			b.WriteRune(r)
			if b.Len() >= 4 {
				break
			}
		}
	}
	if b.Len() == 0 {
		return "CMP"
	}
	return b.String()
}

// ─── Roles & permissions (per company) ───────────────────────────────────────

// RoleInfo is a role within the active company. Permissions is a JSON object:
// {"all":true} for full access, otherwise {"paths":["/billing","/reports/..."]}
// listing the page paths that role may open.
type RoleInfo struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Permissions string `json:"permissions"`
	UserCount   int    `json:"userCount"`
}

// ListRoles returns the active company's roles with how many staff use each.
func (a *App) ListRoles() ([]RoleInfo, error) {
	tenantID := a.activeTenantID()
	rows, err := a.db.Query(`
		SELECT r.id, r.name, COALESCE(r.permissions,'{}'),
		       (SELECT COUNT(*) FROM users u WHERE u.role_id = r.id) AS user_count
		FROM roles r WHERE r.tenant_id = ? ORDER BY r.name`, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []RoleInfo{}
	for rows.Next() {
		var r RoleInfo
		if err := rows.Scan(&r.ID, &r.Name, &r.Permissions, &r.UserCount); err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, nil
}

// SaveRole creates or updates a role in the active company. An empty id creates
// a new role; a non-empty id updates that role's name and permissions.
func (a *App) SaveRole(r RoleInfo) (string, error) {
	if strings.TrimSpace(r.Name) == "" {
		return "", fmt.Errorf("role name required")
	}
	perms := strings.TrimSpace(r.Permissions)
	if perms == "" {
		perms = "{}"
	}
	tenantID := a.activeTenantID()
	if strings.TrimSpace(r.ID) == "" {
		id := uuid.New().String()
		_, err := a.db.Exec(`INSERT INTO roles (id, tenant_id, name, permissions) VALUES (?, ?, ?, ?)`,
			id, tenantID, r.Name, perms)
		return id, err
	}
	_, err := a.db.Exec(`UPDATE roles SET name=?, permissions=? WHERE id=? AND tenant_id=?`,
		r.Name, perms, r.ID, tenantID)
	return r.ID, err
}

// DeleteRole removes a role if no staff are assigned to it.
func (a *App) DeleteRole(roleID string) error {
	var cnt int
	a.db.QueryRow(`SELECT COUNT(*) FROM users WHERE role_id=?`, roleID).Scan(&cnt)
	if cnt > 0 {
		return fmt.Errorf("cannot delete: %d staff still use this role", cnt)
	}
	_, err := a.db.Exec(`DELETE FROM roles WHERE id=? AND tenant_id=?`, roleID, a.activeTenantID())
	return err
}

func (a *App) GetFirmProfile() (*FirmProfile, error) {
	var f FirmProfile
	var g, ad, ph, em sql.NullString
	if err := a.db.QueryRow(`SELECT name, gstin, address, phone, email FROM tenants WHERE id=?`, a.activeTenantID()).Scan(&f.Name, &g, &ad, &ph, &em); err != nil {
		return nil, err
	}
	f.GSTIN, f.Address, f.Phone, f.Email = g.String, ad.String, ph.String, em.String
	return &f, nil
}

func (a *App) SaveFirmProfile(f FirmProfile) error {
	_, err := a.db.Exec(`UPDATE tenants SET name=?, gstin=?, address=?, phone=?, email=?, updated_at=datetime('now')
		WHERE id=?`,
		f.Name, nullStr(f.GSTIN), nullStr(f.Address), nullStr(f.Phone), nullStr(f.Email), a.activeTenantID())
	return err
}

// InvoiceScheme is the active company's invoice-numbering setup. Invoice numbers
// are generated as PREFIX-YY-NNNNNN (6 digits) by the billing engine; this lets
// the owner set the prefix and the next running number (Point 15a).
type InvoiceScheme struct {
	Prefix  string `json:"prefix"`
	NextSeq int    `json:"nextSeq"`
}

func (a *App) GetInvoiceScheme() (*InvoiceScheme, error) {
	var s InvoiceScheme
	err := a.db.QueryRow(`SELECT d.invoice_prefix, d.next_invoice_seq
		FROM device_identity d JOIN stores st ON st.id = d.store_id
		WHERE st.tenant_id = ? LIMIT 1`, a.activeTenantID()).Scan(&s.Prefix, &s.NextSeq)
	if err == sql.ErrNoRows {
		err = a.db.QueryRow(`SELECT invoice_prefix, next_invoice_seq FROM device_identity LIMIT 1`).Scan(&s.Prefix, &s.NextSeq)
	}
	if err != nil {
		return nil, err
	}
	return &s, nil
}

// SaveInvoiceScheme updates the active company's invoice prefix and next number.
// The format (PREFIX-YY-6 digits) is fixed in the engine; only prefix and the
// next sequence are editable. The engine still skips any number already taken,
// so this can't create a duplicate.
func (a *App) SaveInvoiceScheme(prefix string, nextSeq int) error {
	prefix = strings.TrimSpace(prefix)
	if prefix == "" {
		return fmt.Errorf("invoice prefix is required")
	}
	if nextSeq < 1 {
		nextSeq = 1
	}
	res, err := a.db.Exec(`UPDATE device_identity SET invoice_prefix=?, next_invoice_seq=?
		WHERE store_id IN (SELECT id FROM stores WHERE tenant_id=?)`, prefix, nextSeq, a.activeTenantID())
	if err != nil {
		return fmt.Errorf("save invoice scheme: %w", err)
	}
	if n, _ := res.RowsAffected(); n == 0 {
		// Fallback for older single-company installs where the store link is missing.
		_, err = a.db.Exec(`UPDATE device_identity SET invoice_prefix=?, next_invoice_seq=? WHERE id=(SELECT id FROM device_identity LIMIT 1)`, prefix, nextSeq)
	}
	return err
}

func (a *App) SaveCSVFile(csvContent, defaultFilename string) (string, error) {
	path, err := wailsruntime.SaveFileDialog(a.ctx, wailsruntime.SaveDialogOptions{
		DefaultFilename: defaultFilename,
		Title:           "Save CSV File",
		Filters: []wailsruntime.FileFilter{
			{DisplayName: "CSV Files", Pattern: "*.csv"},
			{DisplayName: "All Files", Pattern: "*.*"},
		},
	})
	if err != nil || path == "" {
		return "", err
	}
	if !strings.HasSuffix(strings.ToLower(path), ".csv") {
		path += ".csv"
	}
	// Prepend UTF-8 BOM so Excel reads the file as UTF-8 (otherwise ₹ and other
	// non-ASCII characters are mangled under the system ANSI codepage).
	data := append([]byte{0xEF, 0xBB, 0xBF}, []byte(csvContent)...)
	if err := os.WriteFile(path, data, 0644); err != nil {
		return "", fmt.Errorf("write csv: %w", err)
	}
	return path, nil
}

// ─── Reports bindings ─────────────────────────────────────────────────────

func (a *App) BankBook(bankID, from, to string) ([]reports.BankBookEntry, error) {
	return a.reports.BankBook(bankID, from, to)
}

func (a *App) EmployeeLedger(employeeID, from, to string) ([]reports.LedgerRow, error) {
	return a.reports.EmployeeLedger(employeeID, from, to)
}

func (a *App) CustomerOutstanding() ([]reports.OutstandingRow, error) {
	return a.reports.CustomerOutstanding()
}

func (a *App) CompanyOutstanding() ([]reports.OutstandingRow, error) {
	return a.reports.CompanyOutstanding()
}

func (a *App) SaleSummary(from, to string) ([]reports.SaleSummaryRow, error) {
	return a.reports.SaleSummary(from, to)
}

func (a *App) PurchaseSummary(from, to string) ([]reports.PurchaseSummaryRow, error) {
	return a.reports.PurchaseSummary(from, to)
}

func (a *App) PaymentDetails(from, to string) ([]reports.PaymentDetailRow, error) {
	return a.reports.PaymentDetails(from, to)
}

func (a *App) OrderList(status string) ([]reports.OrderRow, error) {
	return a.reports.OrderList(status)
}

func (a *App) CustomerInvoices(customerID string) ([]models.Invoice, error) {
	return a.reports.CustomerInvoices(customerID)
}

func (a *App) InvoicesReport(from, to string) ([]models.Invoice, error) {
	return a.reports.InvoicesReport(from, to)
}

// Group 1 — Inventory Summary
func (a *App) BrandwiseSummary(from, to string) ([]reports.BrandSummaryRow, error) {
	return a.reports.BrandwiseSummary(from, to)
}
func (a *App) PartywiseSummary(from, to string) ([]reports.PartySummaryRow, error) {
	return a.reports.PartywiseSummary(from, to)
}
func (a *App) CategorywiseSummary(from, to string) ([]reports.CategorySummaryRow, error) {
	return a.reports.CategorywiseSummary(from, to)
}
func (a *App) ItemwiseSummary(from, to string) ([]reports.ItemSummaryRow, error) {
	return a.reports.ItemwiseSummary(from, to)
}
func (a *App) ItemSaleQty(from, to string) ([]reports.ItemSaleQtyRow, error) {
	return a.reports.ItemSaleQty(from, to)
}
func (a *App) EmployeewiseSale(from, to string) ([]reports.EmployeeSaleRow, error) {
	return a.reports.EmployeewiseSale(from, to)
}

// Group 2 — Final Accounts
func (a *App) TradingAccount(from, to string) (*reports.TradingAccountResult, error) {
	return a.reports.TradingAccount(from, to)
}
func (a *App) ProfitLoss(from, to string) (*reports.ProfitLossResult, error) {
	return a.reports.ProfitLoss(from, to)
}
func (a *App) TrialBalance(asOfDate string) ([]reports.TrialBalanceRow, error) {
	return a.reports.TrialBalance(asOfDate)
}
func (a *App) BalanceSheet(asOfDate string) (*reports.BalanceSheetResult, error) {
	return a.reports.BalanceSheet(asOfDate)
}
func (a *App) Rojmel(date string) (*reports.RojmelResult, error) {
	return a.reports.Rojmel(date)
}
func (a *App) TCSReport(from, to string) ([]reports.TCSReportRow, error) {
	return a.reports.TCSReport(from, to)
}

// Group 3 — GSTR Summary
func (a *App) GSTR1(from, to string) ([]reports.GSTInvoiceRow, error) {
	return a.reports.GSTR1(from, to)
}
func (a *App) GSTR2(from, to string) ([]reports.GSTInvoiceRow, error) {
	return a.reports.GSTR2(from, to)
}
func (a *App) GSTR3B(from, to string) (*reports.GSTR3BResult, error) {
	return a.reports.GSTR3B(from, to)
}
func (a *App) GSTR1Summary(from, to string) (*reports.GSTR1SummaryResult, error) {
	return a.reports.GSTR1Summary(from, to)
}
func (a *App) GSTR2B(from, to string) (*reports.GSTR2BResult, error) {
	return a.reports.GSTR2B(from, to)
}
func (a *App) PaymentReminders() ([]reports.UdhaarRow, error) {
	return a.reports.PaymentReminders()
}
func (a *App) GSTSaleSummary(from, to string) ([]reports.GSTRateSummaryRow, error) {
	return a.reports.GSTSaleSummary(from, to)
}
func (a *App) GSTPurchaseSummary(from, to string) ([]reports.GSTRateSummaryRow, error) {
	return a.reports.GSTPurchaseSummary(from, to)
}
func (a *App) GSTWiseSummary(from, to string) ([]reports.GSTWiseRow, error) {
	return a.reports.GSTWiseSummary(from, to)
}
func (a *App) HSNWiseSummary(from, to string) ([]reports.HSNSummaryRow, error) {
	return a.reports.HSNWiseSummary(from, to)
}

// ─── Printing bindings ───────────────────────────────────────────────────

func (a *App) PrintReceipt(invoiceID string) (*printing.PrintResult, error) {
	inv, err := a.engine.GetInvoiceDetails(invoiceID)
	if err != nil {
		return nil, err
	}
	return a.printing.PrintReceipt(inv)
}

func (a *App) TestPrint() (*printing.PrintResult, error) {
	return a.printing.TestPrint()
}

func (a *App) GetPrinterConfig() *printing.PrinterConfig {
	return a.printing.GetConfig()
}

func (a *App) UpdatePrinterConfig(cfg printing.PrinterConfig) {
	a.printing.UpdateConfig(cfg)
}

func (a *App) GetPrintQueueStatus() printing.QueueStatus {
	return a.printing.GetQueueStatus()
}
