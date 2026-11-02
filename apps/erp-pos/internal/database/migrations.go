package database

import (
	"database/sql"
	"fmt"
)

const currentVersion = 12

func Migrate(db *sql.DB) error {
	var version int
	err := db.QueryRow("PRAGMA user_version").Scan(&version)
	if err != nil {
		return fmt.Errorf("read version: %w", err)
	}

	if version < 1 {
		if err := migrateV1(db); err != nil {
			return fmt.Errorf("v1: %w", err)
		}
	}

	if version < 2 {
		if err := migrateV2(db); err != nil {
			return fmt.Errorf("v2: %w", err)
		}
	}

	if version < 3 {
		if err := migrateV3(db); err != nil {
			return fmt.Errorf("v3: %w", err)
		}
	}

	if version < 4 {
		if err := migrateV4(db); err != nil {
			return fmt.Errorf("v4: %w", err)
		}
	}

	if version < 5 {
		if err := migrateV5(db); err != nil {
			return fmt.Errorf("v5: %w", err)
		}
	}

	if version < 6 {
		if err := migrateV6(db); err != nil {
			return fmt.Errorf("v6: %w", err)
		}
	}

	if version < 7 {
		if err := migrateV7(db); err != nil {
			return fmt.Errorf("v7: %w", err)
		}
	}

	if version < 8 {
		if err := migrateV8(db); err != nil {
			return fmt.Errorf("v8: %w", err)
		}
	}

	if version < 9 {
		if err := migrateV9(db); err != nil {
			return fmt.Errorf("v9: %w", err)
		}
	}

	if version < 10 {
		if err := migrateV10(db); err != nil {
			return fmt.Errorf("v10: %w", err)
		}
	}

	if version < 11 {
		if err := migrateV11(db); err != nil {
			return fmt.Errorf("v11: %w", err)
		}
	}

	if version < 12 {
		if err := migrateV12(db); err != nil {
			return fmt.Errorf("v12: %w", err)
		}
	}

	return nil
}

// migrateV12 adds "created by" audit columns to invoices, so every sale records
// which user (and email) made it — shown in the Day Book / invoice, like OS-Books
// stamps user+time on each entry.
func migrateV12(db *sql.DB) error {
	stmts := []string{
		`ALTER TABLE invoices ADD COLUMN created_by TEXT`,
		`ALTER TABLE invoices ADD COLUMN created_by_email TEXT`,
		`PRAGMA user_version = 12`,
	}
	for _, stmt := range stmts {
		if _, err := db.Exec(stmt); err != nil {
			if isAlterColumnExists(err) {
				continue
			}
			return fmt.Errorf("v12 exec %q: %w", stmt[:min(len(stmt), 60)], err)
		}
	}
	return nil
}

// migrateV11 adds soft-delete + audit columns to invoices so a sale can be moved
// to the Recycle Bin (reversing stock) and restored, like OS-Books. All reports
// and ledgers must exclude rows where deleted_at IS NOT NULL.
func migrateV11(db *sql.DB) error {
	stmts := []string{
		`ALTER TABLE invoices ADD COLUMN deleted_at TEXT`,
		`ALTER TABLE invoices ADD COLUMN deleted_by TEXT`,
		`ALTER TABLE invoices ADD COLUMN deleted_by_email TEXT`,
		`PRAGMA user_version = 11`,
	}
	for _, stmt := range stmts {
		if _, err := db.Exec(stmt); err != nil {
			if isAlterColumnExists(err) {
				continue
			}
			return fmt.Errorf("v11 exec %q: %w", stmt[:min(len(stmt), 60)], err)
		}
	}
	return nil
}

// migrateV10 adds a per-invoice Terms & Conditions column, so each bill can
// carry its own terms (falling back to the global Settings terms on print).
func migrateV10(db *sql.DB) error {
	stmts := []string{
		`ALTER TABLE invoices ADD COLUMN terms TEXT`,
		`PRAGMA user_version = 10`,
	}
	for _, stmt := range stmts {
		if _, err := db.Exec(stmt); err != nil {
			if isAlterColumnExists(err) {
				continue
			}
			return fmt.Errorf("v10 exec %q: %w", stmt[:min(len(stmt), 60)], err)
		}
	}
	return nil
}

// migrateV9 repairs the bank_master.note column. On some installs migrateV3
// aborted before adding `note` (its earlier `ADD COLUMN book_type` hit a
// duplicate-column error on DBs where book_type already existed), so ListBanks
// — which selects `note` — failed with "no such column: note". This re-adds the
// column idempotently (tolerating "duplicate column" where it is already there).
func migrateV9(db *sql.DB) error {
	stmts := []string{
		`ALTER TABLE bank_master ADD COLUMN note TEXT`,
		`PRAGMA user_version = 9`,
	}
	for _, stmt := range stmts {
		if _, err := db.Exec(stmt); err != nil {
			if isAlterColumnExists(err) {
				continue
			}
			return fmt.Errorf("v9 exec %q: %w", stmt[:min(len(stmt), 60)], err)
		}
	}
	return nil
}

// migrateV8 remaps products from the old GST slabs (12%, 28%) to GST 2.0
// (effective 22-Sep-2025): 12% and 28% were abolished → move to 18%.
// Past invoices keep their own recorded rates; only the product master changes.
func migrateV8(db *sql.DB) error {
	stmts := []string{
		`UPDATE products SET tax_percent = 18 WHERE tax_percent IN (12, 28)`,
		// Backfill readable Contact IDs for customers that don't have one.
		`UPDATE customers SET contact_id = printf('CUST%04d', rowid) WHERE contact_id IS NULL OR contact_id = ''`,
		`PRAGMA user_version = 8`,
	}
	for _, stmt := range stmts {
		if _, err := db.Exec(stmt); err != nil {
			return fmt.Errorf("v8 exec %q: %w", stmt[:min(len(stmt), 60)], err)
		}
	}
	return nil
}

func migrateV1(db *sql.DB) error {
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	stmts := []string{
		// Tenant & Store
		`CREATE TABLE IF NOT EXISTS tenants (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			gstin TEXT,
			address TEXT,
			phone TEXT,
			email TEXT,
			created_at TEXT NOT NULL DEFAULT (datetime('now')),
			updated_at TEXT NOT NULL DEFAULT (datetime('now'))
		)`,

		`CREATE TABLE IF NOT EXISTS stores (
			id TEXT PRIMARY KEY,
			tenant_id TEXT NOT NULL REFERENCES tenants(id),
			name TEXT NOT NULL,
			code TEXT NOT NULL,
			address TEXT,
			phone TEXT,
			gstin TEXT,
			is_active INTEGER NOT NULL DEFAULT 1,
			created_at TEXT NOT NULL DEFAULT (datetime('now')),
			updated_at TEXT NOT NULL DEFAULT (datetime('now'))
		)`,

		// Device identity
		`CREATE TABLE IF NOT EXISTS device_identity (
			id TEXT PRIMARY KEY,
			store_id TEXT NOT NULL REFERENCES stores(id),
			device_name TEXT,
			invoice_prefix TEXT NOT NULL,
			next_invoice_seq INTEGER NOT NULL DEFAULT 1,
			mac_address TEXT,
			registered_at TEXT NOT NULL DEFAULT (datetime('now'))
		)`,

		// Users & Roles
		`CREATE TABLE IF NOT EXISTS roles (
			id TEXT PRIMARY KEY,
			tenant_id TEXT NOT NULL REFERENCES tenants(id),
			name TEXT NOT NULL,
			permissions TEXT NOT NULL DEFAULT '{}',
			created_at TEXT NOT NULL DEFAULT (datetime('now'))
		)`,

		`CREATE TABLE IF NOT EXISTS users (
			id TEXT PRIMARY KEY,
			tenant_id TEXT NOT NULL REFERENCES tenants(id),
			store_id TEXT REFERENCES stores(id),
			role_id TEXT REFERENCES roles(id),
			name TEXT NOT NULL,
			email TEXT,
			phone TEXT,
			pin_hash TEXT,
			password_hash TEXT,
			is_active INTEGER NOT NULL DEFAULT 1,
			created_at TEXT NOT NULL DEFAULT (datetime('now')),
			updated_at TEXT NOT NULL DEFAULT (datetime('now'))
		)`,

		// Categories & Brands
		`CREATE TABLE IF NOT EXISTS categories (
			id TEXT PRIMARY KEY,
			tenant_id TEXT NOT NULL REFERENCES tenants(id),
			name TEXT NOT NULL,
			parent_id TEXT REFERENCES categories(id),
			sort_order INTEGER NOT NULL DEFAULT 0,
			created_at TEXT NOT NULL DEFAULT (datetime('now'))
		)`,

		`CREATE TABLE IF NOT EXISTS brands (
			id TEXT PRIMARY KEY,
			tenant_id TEXT NOT NULL REFERENCES tenants(id),
			name TEXT NOT NULL,
			created_at TEXT NOT NULL DEFAULT (datetime('now'))
		)`,

		`CREATE TABLE IF NOT EXISTS units (
			id TEXT PRIMARY KEY,
			tenant_id TEXT NOT NULL REFERENCES tenants(id),
			name TEXT NOT NULL,
			short_name TEXT NOT NULL,
			created_at TEXT NOT NULL DEFAULT (datetime('now'))
		)`,

		// Products with 5-tier pricing
		`CREATE TABLE IF NOT EXISTS products (
			id TEXT PRIMARY KEY,
			tenant_id TEXT NOT NULL REFERENCES tenants(id),
			name TEXT NOT NULL,
			sku TEXT,
			barcode TEXT,
			hsn_code TEXT,
			category_id TEXT REFERENCES categories(id),
			brand_id TEXT REFERENCES brands(id),
			unit_id TEXT REFERENCES units(id),
			tax_percent INTEGER NOT NULL DEFAULT 0,
			is_active INTEGER NOT NULL DEFAULT 1,
			is_kit INTEGER NOT NULL DEFAULT 0,
			description TEXT,
			created_at TEXT NOT NULL DEFAULT (datetime('now')),
			updated_at TEXT NOT NULL DEFAULT (datetime('now'))
		)`,

		`CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode) WHERE barcode IS NOT NULL`,
		`CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku) WHERE sku IS NOT NULL`,
		`CREATE INDEX IF NOT EXISTS idx_products_name ON products(tenant_id, name)`,

		// Product prices — 5 tiers: MRP, CMP_A, CMP_B, CMP_C, CMP_D
		// price stored in paise (integer)
		`CREATE TABLE IF NOT EXISTS product_prices (
			id TEXT PRIMARY KEY,
			product_id TEXT NOT NULL REFERENCES products(id),
			tier TEXT NOT NULL CHECK(tier IN ('MRP','CMP_A','CMP_B','CMP_C','CMP_D')),
			price_paise INTEGER NOT NULL,
			valid_from TEXT NOT NULL DEFAULT (date('now')),
			created_at TEXT NOT NULL DEFAULT (datetime('now'))
		)`,

		`CREATE INDEX IF NOT EXISTS idx_product_prices_lookup ON product_prices(product_id, tier, valid_from DESC)`,

		// BOM Kits
		`CREATE TABLE IF NOT EXISTS bom_kits (
			id TEXT PRIMARY KEY,
			parent_product_id TEXT NOT NULL REFERENCES products(id),
			name TEXT NOT NULL,
			is_active INTEGER NOT NULL DEFAULT 1,
			created_at TEXT NOT NULL DEFAULT (datetime('now'))
		)`,

		`CREATE TABLE IF NOT EXISTS bom_components (
			id TEXT PRIMARY KEY,
			kit_id TEXT NOT NULL REFERENCES bom_kits(id),
			product_id TEXT NOT NULL REFERENCES products(id),
			quantity_millis INTEGER NOT NULL DEFAULT 1000,
			price_tier TEXT NOT NULL DEFAULT 'MRP' CHECK(price_tier IN ('MRP','CMP_A','CMP_B','CMP_C','CMP_D')),
			sort_order INTEGER NOT NULL DEFAULT 0
		)`,

		// Customers
		`CREATE TABLE IF NOT EXISTS customers (
			id TEXT PRIMARY KEY,
			tenant_id TEXT NOT NULL REFERENCES tenants(id),
			name TEXT NOT NULL,
			phone TEXT,
			email TEXT,
			gstin TEXT,
			address TEXT,
			state_code TEXT,
			credit_limit_paise INTEGER NOT NULL DEFAULT 0,
			is_active INTEGER NOT NULL DEFAULT 1,
			created_at TEXT NOT NULL DEFAULT (datetime('now')),
			updated_at TEXT NOT NULL DEFAULT (datetime('now'))
		)`,

		`CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone) WHERE phone IS NOT NULL`,

		// Suppliers
		`CREATE TABLE IF NOT EXISTS suppliers (
			id TEXT PRIMARY KEY,
			tenant_id TEXT NOT NULL REFERENCES tenants(id),
			code TEXT NOT NULL,
			name TEXT NOT NULL,
			contact_person TEXT,
			phone TEXT,
			email TEXT,
			gstin TEXT,
			address TEXT,
			state_code TEXT,
			is_active INTEGER NOT NULL DEFAULT 1,
			created_at TEXT NOT NULL DEFAULT (datetime('now')),
			updated_at TEXT NOT NULL DEFAULT (datetime('now'))
		)`,

		// Local stock
		`CREATE TABLE IF NOT EXISTS local_stock (
			product_id TEXT PRIMARY KEY REFERENCES products(id),
			store_id TEXT NOT NULL REFERENCES stores(id),
			quantity_millis INTEGER NOT NULL DEFAULT 0,
			updated_at TEXT NOT NULL DEFAULT (datetime('now'))
		)`,

		// Stock movements
		`CREATE TABLE IF NOT EXISTS stock_movements (
			id TEXT PRIMARY KEY,
			product_id TEXT NOT NULL REFERENCES products(id),
			store_id TEXT NOT NULL REFERENCES stores(id),
			movement_type TEXT NOT NULL CHECK(movement_type IN ('SALE','PURCHASE','RETURN','ADJUSTMENT','TRANSFER_IN','TRANSFER_OUT','OPENING')),
			quantity_millis INTEGER NOT NULL,
			reference_type TEXT,
			reference_id TEXT,
			created_at TEXT NOT NULL DEFAULT (datetime('now'))
		)`,

		`CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(product_id, created_at DESC)`,

		// Invoices
		`CREATE TABLE IF NOT EXISTS invoices (
			id TEXT PRIMARY KEY,
			tenant_id TEXT NOT NULL REFERENCES tenants(id),
			store_id TEXT NOT NULL REFERENCES stores(id),
			device_id TEXT NOT NULL REFERENCES device_identity(id),
			invoice_number TEXT NOT NULL,
			customer_id TEXT REFERENCES customers(id),
			status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','FINAL','CANCELLED','RETURNED')),
			subtotal_paise INTEGER NOT NULL DEFAULT 0,
			discount_paise INTEGER NOT NULL DEFAULT 0,
			tax_paise INTEGER NOT NULL DEFAULT 0,
			roundoff_paise INTEGER NOT NULL DEFAULT 0,
			total_paise INTEGER NOT NULL DEFAULT 0,
			notes TEXT,
			idempotency_key TEXT UNIQUE,
			created_at TEXT NOT NULL DEFAULT (datetime('now')),
			updated_at TEXT NOT NULL DEFAULT (datetime('now'))
		)`,

		`CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_number ON invoices(tenant_id, invoice_number)`,

		// Invoice items
		`CREATE TABLE IF NOT EXISTS invoice_items (
			id TEXT PRIMARY KEY,
			invoice_id TEXT NOT NULL REFERENCES invoices(id),
			product_id TEXT NOT NULL REFERENCES products(id),
			product_name TEXT NOT NULL,
			hsn_code TEXT,
			quantity_millis INTEGER NOT NULL,
			price_tier TEXT NOT NULL DEFAULT 'MRP',
			unit_price_paise INTEGER NOT NULL,
			discount_paise INTEGER NOT NULL DEFAULT 0,
			tax_percent INTEGER NOT NULL DEFAULT 0,
			tax_paise INTEGER NOT NULL DEFAULT 0,
			total_paise INTEGER NOT NULL DEFAULT 0,
			sort_order INTEGER NOT NULL DEFAULT 0
		)`,

		// Invoice payments — split payment support
		`CREATE TABLE IF NOT EXISTS invoice_payments (
			id TEXT PRIMARY KEY,
			invoice_id TEXT NOT NULL REFERENCES invoices(id),
			method TEXT NOT NULL CHECK(method IN ('CASH','UPI','CARD','CREDIT','CHEQUE')),
			amount_paise INTEGER NOT NULL,
			reference_number TEXT,
			is_verified INTEGER NOT NULL DEFAULT 0,
			created_at TEXT NOT NULL DEFAULT (datetime('now'))
		)`,

		// Purchase bills
		`CREATE TABLE IF NOT EXISTS purchase_bills (
			id TEXT PRIMARY KEY,
			tenant_id TEXT NOT NULL REFERENCES tenants(id),
			store_id TEXT NOT NULL REFERENCES stores(id),
			supplier_id TEXT NOT NULL REFERENCES suppliers(id),
			bill_number TEXT NOT NULL,
			bill_date TEXT NOT NULL,
			status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','FINAL','CANCELLED')),
			subtotal_paise INTEGER NOT NULL DEFAULT 0,
			tax_paise INTEGER NOT NULL DEFAULT 0,
			total_paise INTEGER NOT NULL DEFAULT 0,
			notes TEXT,
			created_at TEXT NOT NULL DEFAULT (datetime('now')),
			updated_at TEXT NOT NULL DEFAULT (datetime('now'))
		)`,

		`CREATE TABLE IF NOT EXISTS purchase_items (
			id TEXT PRIMARY KEY,
			purchase_id TEXT NOT NULL REFERENCES purchase_bills(id),
			product_id TEXT NOT NULL REFERENCES products(id),
			quantity_millis INTEGER NOT NULL,
			unit_price_paise INTEGER NOT NULL,
			tax_percent INTEGER NOT NULL DEFAULT 0,
			tax_paise INTEGER NOT NULL DEFAULT 0,
			total_paise INTEGER NOT NULL DEFAULT 0
		)`,

		// Stock audit with 3-edit rule
		`CREATE TABLE IF NOT EXISTS stock_audit_sessions (
			id TEXT PRIMARY KEY,
			store_id TEXT NOT NULL REFERENCES stores(id),
			name TEXT NOT NULL,
			status TEXT NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','CLOSED')),
			created_at TEXT NOT NULL DEFAULT (datetime('now')),
			closed_at TEXT
		)`,

		`CREATE TABLE IF NOT EXISTS stock_audit_rows (
			id TEXT PRIMARY KEY,
			session_id TEXT NOT NULL REFERENCES stock_audit_sessions(id),
			product_id TEXT NOT NULL REFERENCES products(id),
			book_quantity_millis INTEGER NOT NULL,
			physical_quantity_millis INTEGER,
			edit_count INTEGER NOT NULL DEFAULT 0,
			updated_at TEXT NOT NULL DEFAULT (datetime('now'))
		)`,

		// Period freeze
		`CREATE TABLE IF NOT EXISTS period_freezes (
			id TEXT PRIMARY KEY,
			tenant_id TEXT NOT NULL REFERENCES tenants(id),
			scope TEXT NOT NULL DEFAULT 'ALL' CHECK(scope IN ('ALL','SALES','PURCHASES')),
			start_date TEXT NOT NULL,
			end_date TEXT NOT NULL,
			reason TEXT,
			created_at TEXT NOT NULL DEFAULT (datetime('now'))
		)`,

		// Finance quotation (tyre loan)
		`CREATE TABLE IF NOT EXISTS finance_master_values (
			id TEXT PRIMARY KEY,
			tenant_id TEXT NOT NULL REFERENCES tenants(id),
			category TEXT NOT NULL CHECK(category IN ('FITMENT_TYPE','MAKE','PLY_RATING','FIELD_OFFICE')),
			label TEXT NOT NULL,
			sort_order INTEGER NOT NULL DEFAULT 0,
			is_active INTEGER NOT NULL DEFAULT 1
		)`,

		`CREATE TABLE IF NOT EXISTS finance_quotations (
			id TEXT PRIMARY KEY,
			tenant_id TEXT NOT NULL REFERENCES tenants(id),
			store_id TEXT NOT NULL REFERENCES stores(id),
			vehicle_number TEXT NOT NULL,
			fitment_type TEXT,
			make TEXT,
			ply_rating TEXT,
			field_office TEXT,
			delivery_date TEXT,
			bill_amount_paise INTEGER NOT NULL DEFAULT 0,
			margin_money_paise INTEGER NOT NULL DEFAULT 0,
			loan_period_months INTEGER NOT NULL DEFAULT 0,
			loan_amount_paise INTEGER NOT NULL DEFAULT 0,
			processing_fee_paise INTEGER NOT NULL DEFAULT 0,
			total_receivable_paise INTEGER NOT NULL DEFAULT 0,
			status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','SENT','APPROVED','REJECTED')),
			notes TEXT,
			created_at TEXT NOT NULL DEFAULT (datetime('now')),
			updated_at TEXT NOT NULL DEFAULT (datetime('now'))
		)`,

		// Management registers
		`CREATE TABLE IF NOT EXISTS management_registers (
			id TEXT PRIMARY KEY,
			tenant_id TEXT NOT NULL REFERENCES tenants(id),
			name TEXT NOT NULL,
			is_active INTEGER NOT NULL DEFAULT 1,
			created_at TEXT NOT NULL DEFAULT (datetime('now'))
		)`,

		// Vouchers (receipt/payment)
		`CREATE TABLE IF NOT EXISTS vouchers (
			id TEXT PRIMARY KEY,
			tenant_id TEXT NOT NULL REFERENCES tenants(id),
			store_id TEXT NOT NULL REFERENCES stores(id),
			voucher_type TEXT NOT NULL CHECK(voucher_type IN ('RECEIPT','PAYMENT')),
			voucher_number TEXT NOT NULL,
			party_type TEXT CHECK(party_type IN ('CUSTOMER','SUPPLIER')),
			party_id TEXT,
			amount_paise INTEGER NOT NULL,
			method TEXT NOT NULL CHECK(method IN ('CASH','UPI','CARD','CHEQUE','BANK_TRANSFER')),
			reference_number TEXT,
			narration TEXT,
			register_id TEXT REFERENCES management_registers(id),
			created_at TEXT NOT NULL DEFAULT (datetime('now'))
		)`,

		// Sync outbox
		`CREATE TABLE IF NOT EXISTS sync_outbox (
			id TEXT PRIMARY KEY,
			entity_type TEXT NOT NULL,
			entity_id TEXT NOT NULL,
			action TEXT NOT NULL CHECK(action IN ('CREATE','UPDATE','DELETE')),
			payload TEXT NOT NULL,
			idempotency_key TEXT NOT NULL UNIQUE,
			status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','SENT','CONFIRMED','FAILED')),
			retry_count INTEGER NOT NULL DEFAULT 0,
			created_at TEXT NOT NULL DEFAULT (datetime('now')),
			sent_at TEXT
		)`,

		`CREATE INDEX IF NOT EXISTS idx_sync_outbox_status ON sync_outbox(status, created_at)`,

		// Activity log
		`CREATE TABLE IF NOT EXISTS activity_log (
			id TEXT PRIMARY KEY,
			tenant_id TEXT NOT NULL,
			user_id TEXT,
			action TEXT NOT NULL,
			entity_type TEXT,
			entity_id TEXT,
			details TEXT,
			created_at TEXT NOT NULL DEFAULT (datetime('now'))
		)`,

		// Settings
		`CREATE TABLE IF NOT EXISTS settings (
			key TEXT PRIMARY KEY,
			value TEXT NOT NULL,
			updated_at TEXT NOT NULL DEFAULT (datetime('now'))
		)`,

		// 3-edit rule trigger
		`CREATE TRIGGER IF NOT EXISTS enforce_three_edit_rule
		BEFORE UPDATE OF physical_quantity_millis ON stock_audit_rows
		WHEN OLD.edit_count >= 3
		BEGIN
			SELECT RAISE(ABORT, 'Maximum 3 edits allowed per audit row');
		END`,

		// Auto-increment edit count
		`CREATE TRIGGER IF NOT EXISTS increment_audit_edit_count
		AFTER UPDATE OF physical_quantity_millis ON stock_audit_rows
		BEGIN
			UPDATE stock_audit_rows SET edit_count = edit_count + 1, updated_at = datetime('now') WHERE id = NEW.id;
		END`,

		fmt.Sprintf("PRAGMA user_version = %d", currentVersion),
	}

	for _, stmt := range stmts {
		if _, err := tx.Exec(stmt); err != nil {
			return fmt.Errorf("exec %q: %w", stmt[:min(len(stmt), 60)], err)
		}
	}

	return tx.Commit()
}

func migrateV2(db *sql.DB) error {
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	stmts := []string{
		// Company Master (Suppliers with extra fields matching OS-Books "Company Master")
		`CREATE TABLE IF NOT EXISTS companies (
			id TEXT PRIMARY KEY,
			tenant_id TEXT NOT NULL REFERENCES tenants(id),
			name TEXT NOT NULL,
			contact_person TEXT,
			phone TEXT,
			email TEXT,
			gstin TEXT,
			pan TEXT,
			address TEXT,
			city TEXT,
			state TEXT,
			state_code TEXT,
			pincode TEXT,
			opening_balance_paise INTEGER NOT NULL DEFAULT 0,
			is_active INTEGER NOT NULL DEFAULT 1,
			created_at TEXT NOT NULL DEFAULT (datetime('now')),
			updated_at TEXT NOT NULL DEFAULT (datetime('now'))
		)`,

		`CREATE INDEX IF NOT EXISTS idx_companies_name ON companies(tenant_id, name)`,

		// Bank Master
		`CREATE TABLE IF NOT EXISTS bank_master (
			id TEXT PRIMARY KEY,
			tenant_id TEXT NOT NULL REFERENCES tenants(id),
			bank_name TEXT NOT NULL,
			account_number TEXT,
			ifsc_code TEXT,
			branch TEXT,
			opening_balance_paise INTEGER NOT NULL DEFAULT 0,
			is_active INTEGER NOT NULL DEFAULT 1,
			created_at TEXT NOT NULL DEFAULT (datetime('now'))
		)`,

		// Employee Master
		`CREATE TABLE IF NOT EXISTS employees (
			id TEXT PRIMARY KEY,
			tenant_id TEXT NOT NULL REFERENCES tenants(id),
			name TEXT NOT NULL,
			phone TEXT,
			email TEXT,
			address TEXT,
			designation TEXT,
			salary_paise INTEGER NOT NULL DEFAULT 0,
			joining_date TEXT,
			is_active INTEGER NOT NULL DEFAULT 1,
			created_at TEXT NOT NULL DEFAULT (datetime('now')),
			updated_at TEXT NOT NULL DEFAULT (datetime('now'))
		)`,

		// Expense Master
		`CREATE TABLE IF NOT EXISTS expense_master (
			id TEXT PRIMARY KEY,
			tenant_id TEXT NOT NULL REFERENCES tenants(id),
			name TEXT NOT NULL,
			is_active INTEGER NOT NULL DEFAULT 1,
			created_at TEXT NOT NULL DEFAULT (datetime('now'))
		)`,

		// Income Master
		`CREATE TABLE IF NOT EXISTS income_master (
			id TEXT PRIMARY KEY,
			tenant_id TEXT NOT NULL REFERENCES tenants(id),
			name TEXT NOT NULL,
			is_active INTEGER NOT NULL DEFAULT 1,
			created_at TEXT NOT NULL DEFAULT (datetime('now'))
		)`,

		// Payment Master
		`CREATE TABLE IF NOT EXISTS payment_master (
			id TEXT PRIMARY KEY,
			tenant_id TEXT NOT NULL REFERENCES tenants(id),
			name TEXT NOT NULL,
			is_active INTEGER NOT NULL DEFAULT 1,
			created_at TEXT NOT NULL DEFAULT (datetime('now'))
		)`,

		// Expense Ledger entries
		`CREATE TABLE IF NOT EXISTS expense_entries (
			id TEXT PRIMARY KEY,
			tenant_id TEXT NOT NULL REFERENCES tenants(id),
			store_id TEXT NOT NULL REFERENCES stores(id),
			expense_id TEXT NOT NULL REFERENCES expense_master(id),
			amount_paise INTEGER NOT NULL,
			payment_method TEXT NOT NULL DEFAULT 'CASH' CHECK(payment_method IN ('CASH','UPI','CARD','CHEQUE','BANK_TRANSFER')),
			reference_number TEXT,
			narration TEXT,
			entry_date TEXT NOT NULL DEFAULT (date('now')),
			created_at TEXT NOT NULL DEFAULT (datetime('now'))
		)`,

		// Income Ledger entries
		`CREATE TABLE IF NOT EXISTS income_entries (
			id TEXT PRIMARY KEY,
			tenant_id TEXT NOT NULL REFERENCES tenants(id),
			store_id TEXT NOT NULL REFERENCES stores(id),
			income_id TEXT NOT NULL REFERENCES income_master(id),
			amount_paise INTEGER NOT NULL,
			payment_method TEXT NOT NULL DEFAULT 'CASH' CHECK(payment_method IN ('CASH','UPI','CARD','CHEQUE','BANK_TRANSFER')),
			reference_number TEXT,
			narration TEXT,
			entry_date TEXT NOT NULL DEFAULT (date('now')),
			created_at TEXT NOT NULL DEFAULT (datetime('now'))
		)`,

		// Payment Ledger entries
		`CREATE TABLE IF NOT EXISTS payment_entries (
			id TEXT PRIMARY KEY,
			tenant_id TEXT NOT NULL REFERENCES tenants(id),
			store_id TEXT NOT NULL REFERENCES stores(id),
			payment_type_id TEXT NOT NULL REFERENCES payment_master(id),
			party_type TEXT CHECK(party_type IN ('CUSTOMER','COMPANY','EMPLOYEE')),
			party_id TEXT,
			amount_paise INTEGER NOT NULL,
			payment_method TEXT NOT NULL DEFAULT 'CASH',
			reference_number TEXT,
			narration TEXT,
			entry_date TEXT NOT NULL DEFAULT (date('now')),
			created_at TEXT NOT NULL DEFAULT (datetime('now'))
		)`,

		// Purchase Orders
		`CREATE TABLE IF NOT EXISTS purchase_orders (
			id TEXT PRIMARY KEY,
			tenant_id TEXT NOT NULL REFERENCES tenants(id),
			store_id TEXT NOT NULL REFERENCES stores(id),
			company_id TEXT REFERENCES companies(id),
			order_number TEXT NOT NULL,
			order_date TEXT NOT NULL DEFAULT (date('now')),
			status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','SENT','PARTIAL','RECEIVED','CANCELLED')),
			subtotal_paise INTEGER NOT NULL DEFAULT 0,
			tax_paise INTEGER NOT NULL DEFAULT 0,
			total_paise INTEGER NOT NULL DEFAULT 0,
			notes TEXT,
			created_at TEXT NOT NULL DEFAULT (datetime('now')),
			updated_at TEXT NOT NULL DEFAULT (datetime('now'))
		)`,

		`CREATE TABLE IF NOT EXISTS purchase_order_items (
			id TEXT PRIMARY KEY,
			order_id TEXT NOT NULL REFERENCES purchase_orders(id),
			product_id TEXT NOT NULL REFERENCES products(id),
			quantity_millis INTEGER NOT NULL,
			unit_price_paise INTEGER NOT NULL,
			tax_percent INTEGER NOT NULL DEFAULT 0,
			total_paise INTEGER NOT NULL DEFAULT 0,
			received_millis INTEGER NOT NULL DEFAULT 0
		)`,

		// Purchase Returns
		`CREATE TABLE IF NOT EXISTS purchase_returns (
			id TEXT PRIMARY KEY,
			tenant_id TEXT NOT NULL REFERENCES tenants(id),
			store_id TEXT NOT NULL REFERENCES stores(id),
			purchase_id TEXT REFERENCES purchase_bills(id),
			company_id TEXT REFERENCES companies(id),
			return_number TEXT NOT NULL,
			return_date TEXT NOT NULL DEFAULT (date('now')),
			subtotal_paise INTEGER NOT NULL DEFAULT 0,
			tax_paise INTEGER NOT NULL DEFAULT 0,
			total_paise INTEGER NOT NULL DEFAULT 0,
			notes TEXT,
			created_at TEXT NOT NULL DEFAULT (datetime('now'))
		)`,

		`CREATE TABLE IF NOT EXISTS purchase_return_items (
			id TEXT PRIMARY KEY,
			return_id TEXT NOT NULL REFERENCES purchase_returns(id),
			product_id TEXT NOT NULL REFERENCES products(id),
			quantity_millis INTEGER NOT NULL,
			unit_price_paise INTEGER NOT NULL,
			tax_percent INTEGER NOT NULL DEFAULT 0,
			total_paise INTEGER NOT NULL DEFAULT 0
		)`,

		// Sale Orders
		`CREATE TABLE IF NOT EXISTS sale_orders (
			id TEXT PRIMARY KEY,
			tenant_id TEXT NOT NULL REFERENCES tenants(id),
			store_id TEXT NOT NULL REFERENCES stores(id),
			customer_id TEXT REFERENCES customers(id),
			order_number TEXT NOT NULL,
			order_date TEXT NOT NULL DEFAULT (date('now')),
			status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','CONFIRMED','PARTIAL','DELIVERED','CANCELLED')),
			subtotal_paise INTEGER NOT NULL DEFAULT 0,
			tax_paise INTEGER NOT NULL DEFAULT 0,
			total_paise INTEGER NOT NULL DEFAULT 0,
			notes TEXT,
			created_at TEXT NOT NULL DEFAULT (datetime('now')),
			updated_at TEXT NOT NULL DEFAULT (datetime('now'))
		)`,

		`CREATE TABLE IF NOT EXISTS sale_order_items (
			id TEXT PRIMARY KEY,
			order_id TEXT NOT NULL REFERENCES sale_orders(id),
			product_id TEXT NOT NULL REFERENCES products(id),
			quantity_millis INTEGER NOT NULL,
			unit_price_paise INTEGER NOT NULL,
			tax_percent INTEGER NOT NULL DEFAULT 0,
			total_paise INTEGER NOT NULL DEFAULT 0,
			delivered_millis INTEGER NOT NULL DEFAULT 0
		)`,

		// Sales Returns
		`CREATE TABLE IF NOT EXISTS sales_returns (
			id TEXT PRIMARY KEY,
			tenant_id TEXT NOT NULL REFERENCES tenants(id),
			store_id TEXT NOT NULL REFERENCES stores(id),
			invoice_id TEXT REFERENCES invoices(id),
			customer_id TEXT REFERENCES customers(id),
			return_number TEXT NOT NULL,
			return_date TEXT NOT NULL DEFAULT (date('now')),
			subtotal_paise INTEGER NOT NULL DEFAULT 0,
			tax_paise INTEGER NOT NULL DEFAULT 0,
			total_paise INTEGER NOT NULL DEFAULT 0,
			notes TEXT,
			created_at TEXT NOT NULL DEFAULT (datetime('now'))
		)`,

		`CREATE TABLE IF NOT EXISTS sales_return_items (
			id TEXT PRIMARY KEY,
			return_id TEXT NOT NULL REFERENCES sales_returns(id),
			product_id TEXT NOT NULL REFERENCES products(id),
			quantity_millis INTEGER NOT NULL,
			unit_price_paise INTEGER NOT NULL,
			tax_percent INTEGER NOT NULL DEFAULT 0,
			total_paise INTEGER NOT NULL DEFAULT 0
		)`,

		// Debit Notes
		`CREATE TABLE IF NOT EXISTS debit_notes (
			id TEXT PRIMARY KEY,
			tenant_id TEXT NOT NULL REFERENCES tenants(id),
			store_id TEXT NOT NULL REFERENCES stores(id),
			company_id TEXT REFERENCES companies(id),
			note_number TEXT NOT NULL,
			note_date TEXT NOT NULL DEFAULT (date('now')),
			amount_paise INTEGER NOT NULL DEFAULT 0,
			tax_paise INTEGER NOT NULL DEFAULT 0,
			total_paise INTEGER NOT NULL DEFAULT 0,
			reason TEXT,
			created_at TEXT NOT NULL DEFAULT (datetime('now'))
		)`,

		// Credit Notes
		`CREATE TABLE IF NOT EXISTS credit_notes (
			id TEXT PRIMARY KEY,
			tenant_id TEXT NOT NULL REFERENCES tenants(id),
			store_id TEXT NOT NULL REFERENCES stores(id),
			customer_id TEXT REFERENCES customers(id),
			note_number TEXT NOT NULL,
			note_date TEXT NOT NULL DEFAULT (date('now')),
			amount_paise INTEGER NOT NULL DEFAULT 0,
			tax_paise INTEGER NOT NULL DEFAULT 0,
			total_paise INTEGER NOT NULL DEFAULT 0,
			reason TEXT,
			created_at TEXT NOT NULL DEFAULT (datetime('now'))
		)`,

		// Customer Challan (delivery without invoice)
		`CREATE TABLE IF NOT EXISTS customer_challans (
			id TEXT PRIMARY KEY,
			tenant_id TEXT NOT NULL REFERENCES tenants(id),
			store_id TEXT NOT NULL REFERENCES stores(id),
			customer_id TEXT REFERENCES customers(id),
			challan_number TEXT NOT NULL,
			challan_date TEXT NOT NULL DEFAULT (date('now')),
			status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','INVOICED','CANCELLED')),
			invoice_id TEXT REFERENCES invoices(id),
			notes TEXT,
			created_at TEXT NOT NULL DEFAULT (datetime('now'))
		)`,

		`CREATE TABLE IF NOT EXISTS customer_challan_items (
			id TEXT PRIMARY KEY,
			challan_id TEXT NOT NULL REFERENCES customer_challans(id),
			product_id TEXT NOT NULL REFERENCES products(id),
			quantity_millis INTEGER NOT NULL,
			unit_price_paise INTEGER NOT NULL DEFAULT 0
		)`,

		// Quotations
		`CREATE TABLE IF NOT EXISTS quotations (
			id TEXT PRIMARY KEY,
			tenant_id TEXT NOT NULL REFERENCES tenants(id),
			store_id TEXT NOT NULL REFERENCES stores(id),
			customer_id TEXT REFERENCES customers(id),
			quotation_number TEXT NOT NULL,
			quotation_date TEXT NOT NULL DEFAULT (date('now')),
			valid_until TEXT,
			status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','SENT','ACCEPTED','REJECTED','EXPIRED')),
			subtotal_paise INTEGER NOT NULL DEFAULT 0,
			discount_paise INTEGER NOT NULL DEFAULT 0,
			tax_paise INTEGER NOT NULL DEFAULT 0,
			total_paise INTEGER NOT NULL DEFAULT 0,
			notes TEXT,
			created_at TEXT NOT NULL DEFAULT (datetime('now')),
			updated_at TEXT NOT NULL DEFAULT (datetime('now'))
		)`,

		`CREATE TABLE IF NOT EXISTS quotation_items (
			id TEXT PRIMARY KEY,
			quotation_id TEXT NOT NULL REFERENCES quotations(id),
			product_id TEXT NOT NULL REFERENCES products(id),
			quantity_millis INTEGER NOT NULL,
			unit_price_paise INTEGER NOT NULL,
			discount_paise INTEGER NOT NULL DEFAULT 0,
			tax_percent INTEGER NOT NULL DEFAULT 0,
			total_paise INTEGER NOT NULL DEFAULT 0
		)`,

		// Cheque tracking
		`CREATE TABLE IF NOT EXISTS cheques (
			id TEXT PRIMARY KEY,
			tenant_id TEXT NOT NULL REFERENCES tenants(id),
			cheque_number TEXT NOT NULL,
			cheque_date TEXT NOT NULL,
			bank_name TEXT,
			party_type TEXT CHECK(party_type IN ('CUSTOMER','COMPANY')),
			party_id TEXT,
			party_name TEXT,
			direction TEXT NOT NULL CHECK(direction IN ('IN','OUT')),
			amount_paise INTEGER NOT NULL,
			status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','CLEARED','RETURNED','CANCELLED')),
			reference_type TEXT,
			reference_id TEXT,
			cleared_date TEXT,
			notes TEXT,
			created_at TEXT NOT NULL DEFAULT (datetime('now')),
			updated_at TEXT NOT NULL DEFAULT (datetime('now'))
		)`,

		`CREATE INDEX IF NOT EXISTS idx_cheques_status ON cheques(status, cheque_date)`,

		// Stock transfer between branches
		`CREATE TABLE IF NOT EXISTS stock_transfers (
			id TEXT PRIMARY KEY,
			tenant_id TEXT NOT NULL REFERENCES tenants(id),
			from_store_id TEXT NOT NULL REFERENCES stores(id),
			to_store_id TEXT NOT NULL REFERENCES stores(id),
			transfer_number TEXT NOT NULL,
			transfer_date TEXT NOT NULL DEFAULT (date('now')),
			status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','IN_TRANSIT','RECEIVED','CANCELLED')),
			notes TEXT,
			created_at TEXT NOT NULL DEFAULT (datetime('now'))
		)`,

		`CREATE TABLE IF NOT EXISTS stock_transfer_items (
			id TEXT PRIMARY KEY,
			transfer_id TEXT NOT NULL REFERENCES stock_transfers(id),
			product_id TEXT NOT NULL REFERENCES products(id),
			quantity_millis INTEGER NOT NULL
		)`,

		// Employee attendance
		`CREATE TABLE IF NOT EXISTS employee_attendance (
			id TEXT PRIMARY KEY,
			tenant_id TEXT NOT NULL REFERENCES tenants(id),
			employee_id TEXT NOT NULL REFERENCES employees(id),
			attendance_date TEXT NOT NULL,
			status TEXT NOT NULL DEFAULT 'PRESENT' CHECK(status IN ('PRESENT','ABSENT','HALF_DAY','LEAVE')),
			in_time TEXT,
			out_time TEXT,
			notes TEXT,
			created_at TEXT NOT NULL DEFAULT (datetime('now'))
		)`,

		`CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_unique ON employee_attendance(employee_id, attendance_date)`,

		// Complaints / Service
		`CREATE TABLE IF NOT EXISTS complaints (
			id TEXT PRIMARY KEY,
			tenant_id TEXT NOT NULL REFERENCES tenants(id),
			store_id TEXT NOT NULL REFERENCES stores(id),
			customer_id TEXT REFERENCES customers(id),
			customer_name TEXT,
			phone TEXT,
			vehicle_number TEXT,
			complaint_type TEXT,
			description TEXT,
			status TEXT NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','IN_PROGRESS','RESOLVED','CLOSED')),
			resolution TEXT,
			created_at TEXT NOT NULL DEFAULT (datetime('now')),
			updated_at TEXT NOT NULL DEFAULT (datetime('now'))
		)`,

		// Service reminders
		`CREATE TABLE IF NOT EXISTS service_reminders (
			id TEXT PRIMARY KEY,
			tenant_id TEXT NOT NULL REFERENCES tenants(id),
			customer_id TEXT REFERENCES customers(id),
			customer_name TEXT,
			phone TEXT,
			vehicle_number TEXT,
			service_type TEXT,
			reminder_date TEXT NOT NULL,
			status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','SENT','COMPLETED','CANCELLED')),
			notes TEXT,
			created_at TEXT NOT NULL DEFAULT (datetime('now'))
		)`,

		// Message templates (WhatsApp/SMS)
		`CREATE TABLE IF NOT EXISTS message_templates (
			id TEXT PRIMARY KEY,
			tenant_id TEXT NOT NULL REFERENCES tenants(id),
			name TEXT NOT NULL,
			template_type TEXT NOT NULL DEFAULT 'WHATSAPP' CHECK(template_type IN ('WHATSAPP','SMS')),
			content TEXT NOT NULL,
			is_active INTEGER NOT NULL DEFAULT 1,
			created_at TEXT NOT NULL DEFAULT (datetime('now'))
		)`,

		// Add freight and discount fields to invoices
		`ALTER TABLE invoices ADD COLUMN freight_paise INTEGER NOT NULL DEFAULT 0`,
		`ALTER TABLE invoices ADD COLUMN freight_gst_percent INTEGER NOT NULL DEFAULT 0`,
		`ALTER TABLE invoices ADD COLUMN discount_percent INTEGER NOT NULL DEFAULT 0`,
		`ALTER TABLE invoices ADD COLUMN invoice_type TEXT NOT NULL DEFAULT 'CASH' CHECK(invoice_type IN ('CASH','CREDIT'))`,
		`ALTER TABLE invoices ADD COLUMN due_amount_paise INTEGER NOT NULL DEFAULT 0`,

		// Add company_id to purchase_bills (link to companies table)
		`ALTER TABLE purchase_bills ADD COLUMN company_id_v2 TEXT REFERENCES companies(id)`,

		// Customer party tags
		`ALTER TABLE customers ADD COLUMN party_tags TEXT`,

		// Bank book type (CASH_BOOK / BANK_BOOK / NON_PAYMENT)
		`ALTER TABLE bank_master ADD COLUMN book_type TEXT NOT NULL DEFAULT 'BANK_BOOK' CHECK(book_type IN ('CASH_BOOK','BANK_BOOK','NON_PAYMENT'))`,

		// Category purchase/sale discounts
		`ALTER TABLE categories ADD COLUMN purchase_discount_percent REAL NOT NULL DEFAULT 0`,
		`ALTER TABLE categories ADD COLUMN sale_discount_percent REAL NOT NULL DEFAULT 0`,

		// Employee paid holiday count
		`ALTER TABLE employees ADD COLUMN paid_holiday_count INTEGER NOT NULL DEFAULT 0`,

		// Product: alert quantity (low stock threshold) and default purchase price
		`ALTER TABLE products ADD COLUMN alert_quantity_millis INTEGER NOT NULL DEFAULT 0`,
		`ALTER TABLE products ADD COLUMN purchase_price_paise INTEGER NOT NULL DEFAULT 0`,

		fmt.Sprintf("PRAGMA user_version = %d", currentVersion),
	}

	for _, stmt := range stmts {
		if _, err := tx.Exec(stmt); err != nil {
			if isAlterColumnExists(err) {
				continue
			}
			return fmt.Errorf("exec %q: %w", stmt[:min(len(stmt), 60)], err)
		}
	}

	return tx.Commit()
}

func isAlterColumnExists(err error) bool {
	if err == nil {
		return false
	}
	msg := err.Error()
	return len(msg) > 0 && (contains(msg, "duplicate column") || contains(msg, "already exists"))
}

func contains(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func migrateV3(db *sql.DB) error {
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	stmts := []string{
		// Bank book type and note
		`ALTER TABLE bank_master ADD COLUMN book_type TEXT NOT NULL DEFAULT 'BANK_BOOK' CHECK(book_type IN ('CASH_BOOK','BANK_BOOK','NON_PAYMENT'))`,
		`ALTER TABLE bank_master ADD COLUMN note TEXT`,
		// Category discounts
		`ALTER TABLE categories ADD COLUMN purchase_discount_percent REAL NOT NULL DEFAULT 0`,
		`ALTER TABLE categories ADD COLUMN sale_discount_percent REAL NOT NULL DEFAULT 0`,
		// Employee paid holidays
		`ALTER TABLE employees ADD COLUMN paid_holiday_count INTEGER NOT NULL DEFAULT 0`,
		// Product alert quantity and purchase price
		`ALTER TABLE products ADD COLUMN alert_quantity_millis INTEGER NOT NULL DEFAULT 0`,
		`ALTER TABLE products ADD COLUMN purchase_price_paise INTEGER NOT NULL DEFAULT 0`,

		`PRAGMA user_version = 3`,
	}

	for _, stmt := range stmts {
		if _, err := tx.Exec(stmt); err != nil {
			if isAlterColumnExists(err) {
				continue
			}
			return fmt.Errorf("v3 exec %q: %w", stmt[:min(len(stmt), 60)], err)
		}
	}

	return tx.Commit()
}

func migrateV4(db *sql.DB) error {
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	stmts := []string{
		// Quantity (×1000) and per-unit rate (paise) for expense/income entries
		`ALTER TABLE expense_entries ADD COLUMN quantity_millis INTEGER NOT NULL DEFAULT 0`,
		`ALTER TABLE expense_entries ADD COLUMN rate_paise INTEGER NOT NULL DEFAULT 0`,
		`ALTER TABLE income_entries ADD COLUMN quantity_millis INTEGER NOT NULL DEFAULT 0`,
		`ALTER TABLE income_entries ADD COLUMN rate_paise INTEGER NOT NULL DEFAULT 0`,

		`PRAGMA user_version = 4`,
	}

	for _, stmt := range stmts {
		if _, err := tx.Exec(stmt); err != nil {
			if isAlterColumnExists(err) {
				continue
			}
			return fmt.Errorf("v4 exec %q: %w", stmt[:min(len(stmt), 60)], err)
		}
	}

	return tx.Commit()
}

func migrateV5(db *sql.DB) error {
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	stmts := []string{
		// Soft-delete / Recycle Bin: who deleted, when (NULL deleted_at = active)
		`ALTER TABLE expense_entries ADD COLUMN deleted_at TEXT`,
		`ALTER TABLE expense_entries ADD COLUMN deleted_by TEXT`,
		`ALTER TABLE expense_entries ADD COLUMN deleted_by_email TEXT`,
		`ALTER TABLE income_entries ADD COLUMN deleted_at TEXT`,
		`ALTER TABLE income_entries ADD COLUMN deleted_by TEXT`,
		`ALTER TABLE income_entries ADD COLUMN deleted_by_email TEXT`,

		`PRAGMA user_version = 5`,
	}

	for _, stmt := range stmts {
		if _, err := tx.Exec(stmt); err != nil {
			if isAlterColumnExists(err) {
				continue
			}
			return fmt.Errorf("v5 exec %q: %w", stmt[:min(len(stmt), 60)], err)
		}
	}

	return tx.Commit()
}

// migrateV6 extends products to an OS-Books-style Product Master:
// extra header fields, "More Info" fields, and child tables for Sub Items
// and Raw Materials.
func migrateV6(db *sql.DB) error {
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	stmts := []string{
		// Product Master extra header fields
		`ALTER TABLE products ADD COLUMN product_code TEXT`,
		`ALTER TABLE products ADD COLUMN gst_applicable INTEGER NOT NULL DEFAULT 1`,
		`ALTER TABLE products ADD COLUMN group_code TEXT`,
		`ALTER TABLE products ADD COLUMN group_name TEXT`,
		`ALTER TABLE products ADD COLUMN auto_qty_millis INTEGER NOT NULL DEFAULT 0`,
		`ALTER TABLE products ADD COLUMN opening_qty_millis INTEGER NOT NULL DEFAULT 0`,
		`ALTER TABLE products ADD COLUMN reorder_qty_millis INTEGER NOT NULL DEFAULT 0`,
		`ALTER TABLE products ADD COLUMN is_service INTEGER NOT NULL DEFAULT 0`,
		// "More Info" fields
		`ALTER TABLE products ADD COLUMN size TEXT`,
		`ALTER TABLE products ADD COLUMN colour TEXT`,
		`ALTER TABLE products ADD COLUMN expiry_month TEXT`,
		`ALTER TABLE products ADD COLUMN location TEXT`,
		`ALTER TABLE products ADD COLUMN terms TEXT`,
		`ALTER TABLE products ADD COLUMN product_tags TEXT`,

		// Sub Items: components/variants listed under a product
		`CREATE TABLE IF NOT EXISTS product_sub_items (
			id TEXT PRIMARY KEY,
			product_id TEXT NOT NULL REFERENCES products(id),
			name TEXT NOT NULL,
			value TEXT,
			sort_order INTEGER NOT NULL DEFAULT 0
		)`,
		`CREATE INDEX IF NOT EXISTS idx_product_sub_items ON product_sub_items(product_id)`,

		// Raw Materials: BOM-style inputs for a product
		`CREATE TABLE IF NOT EXISTS product_raw_materials (
			id TEXT PRIMARY KEY,
			product_id TEXT NOT NULL REFERENCES products(id),
			name TEXT NOT NULL,
			qty_millis INTEGER NOT NULL DEFAULT 0,
			unit TEXT,
			sort_order INTEGER NOT NULL DEFAULT 0
		)`,
		`CREATE INDEX IF NOT EXISTS idx_product_raw_materials ON product_raw_materials(product_id)`,

		`PRAGMA user_version = 6`,
	}

	for _, stmt := range stmts {
		if _, err := tx.Exec(stmt); err != nil {
			if isAlterColumnExists(err) {
				continue
			}
			return fmt.Errorf("v6 exec %q: %w", stmt[:min(len(stmt), 60)], err)
		}
	}

	return tx.Commit()
}

// migrateV7 extends customers & companies to a Suvidha-style "Parties" module
// and adds customer groups (group-wise pricing).
func migrateV7(db *sql.DB) error {
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	stmts := []string{
		// Customers — Parties fields
		`ALTER TABLE customers ADD COLUMN business_name TEXT`,
		`ALTER TABLE customers ADD COLUMN contact_id TEXT`,
		`ALTER TABLE customers ADD COLUMN group_id TEXT`,
		`ALTER TABLE customers ADD COLUMN contact_type TEXT NOT NULL DEFAULT 'individual'`,
		`ALTER TABLE customers ADD COLUMN alternate_phone TEXT`,
		`ALTER TABLE customers ADD COLUMN landline TEXT`,
		`ALTER TABLE customers ADD COLUMN pay_term_days INTEGER NOT NULL DEFAULT 0`,
		`ALTER TABLE customers ADD COLUMN opening_balance_paise INTEGER NOT NULL DEFAULT 0`,
		`ALTER TABLE customers ADD COLUMN city TEXT`,

		// Companies (suppliers) — same Parties fields
		`ALTER TABLE companies ADD COLUMN business_name TEXT`,
		`ALTER TABLE companies ADD COLUMN contact_id TEXT`,
		`ALTER TABLE companies ADD COLUMN contact_type TEXT NOT NULL DEFAULT 'business'`,
		`ALTER TABLE companies ADD COLUMN alternate_phone TEXT`,
		`ALTER TABLE companies ADD COLUMN pay_term_days INTEGER NOT NULL DEFAULT 0`,
		`ALTER TABLE companies ADD COLUMN opening_balance_paise INTEGER NOT NULL DEFAULT 0`,
		`ALTER TABLE companies ADD COLUMN city TEXT`,

		// Customer / Party Groups (group-wise pricing & discount)
		`CREATE TABLE IF NOT EXISTS customer_groups (
			id TEXT PRIMARY KEY,
			tenant_id TEXT NOT NULL REFERENCES tenants(id),
			name TEXT NOT NULL,
			calc_percent REAL NOT NULL DEFAULT 0,
			selling_price_group TEXT,
			is_active INTEGER NOT NULL DEFAULT 1,
			created_at TEXT NOT NULL DEFAULT (datetime('now'))
		)`,

		`PRAGMA user_version = 7`,
	}

	for _, stmt := range stmts {
		if _, err := tx.Exec(stmt); err != nil {
			if isAlterColumnExists(err) {
				continue
			}
			return fmt.Errorf("v7 exec %q: %w", stmt[:min(len(stmt), 60)], err)
		}
	}

	return tx.Commit()
}
