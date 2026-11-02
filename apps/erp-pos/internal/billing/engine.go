package billing

import (
	"database/sql"
	"fmt"
	"math"
	"strings"
	"time"

	"erp-pos/internal/models"

	"github.com/google/uuid"
)

type Engine struct {
	db *sql.DB
}

func NewEngine(db *sql.DB) *Engine {
	return &Engine{db: db}
}

// activeTenantID resolves the company the user is currently working in
// (settings key 'active_tenant_id'), falling back to the first tenant. Keeps
// billing/stock scoped to the active company when multiple companies exist.
func (e *Engine) activeTenantID() string {
	var id string
	e.db.QueryRow("SELECT COALESCE((SELECT t.id FROM tenants t WHERE t.id=(SELECT value FROM settings WHERE key='active_tenant_id')), (SELECT id FROM tenants LIMIT 1))").Scan(&id)
	return id
}

func (e *Engine) GetDeviceConfig() (*models.DeviceIdentity, error) {
	var d models.DeviceIdentity
	// Pick the device belonging to the ACTIVE company's store, so sales get the
	// right tenant + invoice series when multiple companies exist.
	err := e.db.QueryRow(`SELECT d.id, d.store_id, d.device_name, d.invoice_prefix, d.next_invoice_seq
		FROM device_identity d JOIN stores s ON s.id = d.store_id
		WHERE s.tenant_id = ? LIMIT 1`, e.activeTenantID()).
		Scan(&d.ID, &d.StoreID, &d.DeviceName, &d.InvoicePrefix, &d.NextInvoiceSeq)
	if err == sql.ErrNoRows {
		// Fallback for older single-company installs (device not yet tenant-linkable).
		err = e.db.QueryRow(`SELECT id, store_id, device_name, invoice_prefix, next_invoice_seq FROM device_identity LIMIT 1`).
			Scan(&d.ID, &d.StoreID, &d.DeviceName, &d.InvoicePrefix, &d.NextInvoiceSeq)
	}
	if err != nil {
		return nil, fmt.Errorf("no device configured: %w", err)
	}
	return &d, nil
}

func (e *Engine) SearchProducts(query string, limit int) ([]models.ProductWithPrices, error) {
	if limit <= 0 {
		limit = 50
	}
	pattern := "%" + query + "%"
	rows, err := e.db.Query(`
		SELECT p.id, p.name, p.sku, p.barcode, p.hsn_code, p.tax_percent, p.is_kit,
			COALESCE(p.category_id, '') as category_id, COALESCE(p.brand_id, '') as brand_id,
			COALESCE(p.unit_id, '') as unit_id, COALESCE(p.description, '') as description,
			COALESCE(c.name, '') as category_name, COALESCE(b.name, '') as brand_name,
			COALESCE(ls.quantity_millis, 0) as stock_qty,
			COALESCE(p.alert_quantity_millis, 0) as alert_qty,
			COALESCE(p.purchase_price_paise, 0) as purchase_price,
			COALESCE(p.product_code, ''), COALESCE(p.gst_applicable, 1),
			COALESCE(p.group_code, ''), COALESCE(p.group_name, ''),
			COALESCE(p.auto_qty_millis, 0), COALESCE(p.opening_qty_millis, 0), COALESCE(p.reorder_qty_millis, 0),
			COALESCE(p.is_service, 0),
			COALESCE(p.size, ''), COALESCE(p.colour, ''), COALESCE(p.expiry_month, ''),
			COALESCE(p.location, ''), COALESCE(p.terms, ''), COALESCE(p.product_tags, '')
		FROM products p
		LEFT JOIN categories c ON p.category_id = c.id
		LEFT JOIN brands b ON p.brand_id = b.id
		LEFT JOIN local_stock ls ON p.id = ls.product_id
		WHERE p.is_active = 1 AND p.tenant_id = ? AND (p.name LIKE ? OR p.sku LIKE ? OR p.barcode LIKE ?)
		ORDER BY p.name LIMIT ?
	`, e.activeTenantID(), pattern, pattern, pattern, limit)
	if err != nil {
		return nil, err
	}

	// Collect all products first, close rows BEFORE any nested query (MaxOpenConns=1 deadlock prevention)
	var results []models.ProductWithPrices
	for rows.Next() {
		var p models.ProductWithPrices
		var sku, barcode, hsn sql.NullString
		var gstApplicable, isService int
		if err := rows.Scan(&p.ID, &p.Name, &sku, &barcode, &hsn, &p.TaxPercent, &p.IsKit,
			&p.CategoryID, &p.BrandID, &p.UnitID, &p.Description,
			&p.CategoryName, &p.BrandName, &p.StockQtyMillis,
			&p.AlertQuantityMillis, &p.PurchasePricePaise,
			&p.ProductCode, &gstApplicable, &p.GroupCode, &p.GroupName,
			&p.AutoQtyMillis, &p.OpeningQtyMillis, &p.ReorderQtyMillis, &isService,
			&p.Size, &p.Colour, &p.ExpiryMonth, &p.Location, &p.Terms, &p.ProductTags); err != nil {
			rows.Close()
			return nil, err
		}
		p.SKU = sku.String
		p.Barcode = barcode.String
		p.HSNCode = hsn.String
		p.GSTApplicable = gstApplicable == 1
		p.IsService = isService == 1
		results = append(results, p)
	}
	rows.Close() // explicitly close before fetching prices

	if len(results) == 0 {
		return results, nil
	}

	// Fetch all prices in ONE batch query — no nested calls while rows are open
	priceMap, err := e.getProductPricesBatch(results)
	if err != nil {
		return nil, err
	}
	for i := range results {
		results[i].Prices = priceMap[results[i].ID]
	}
	return results, nil
}

func (e *Engine) FindByBarcode(barcode string) (*models.ProductWithPrices, error) {
	var p models.ProductWithPrices
	var sku, bc, hsn sql.NullString
	err := e.db.QueryRow(`
		SELECT p.id, p.name, p.sku, p.barcode, p.hsn_code, p.tax_percent, p.is_kit,
			COALESCE(p.category_id, '') as category_id, COALESCE(p.brand_id, '') as brand_id,
			COALESCE(p.unit_id, '') as unit_id, COALESCE(p.description, '') as description,
			COALESCE(c.name, '') as category_name, COALESCE(b.name, '') as brand_name,
			COALESCE(ls.quantity_millis, 0) as stock_qty
		FROM products p
		LEFT JOIN categories c ON p.category_id = c.id
		LEFT JOIN brands b ON p.brand_id = b.id
		LEFT JOIN local_stock ls ON p.id = ls.product_id
		WHERE p.is_active = 1 AND p.tenant_id = ? AND p.barcode = ?
	`, e.activeTenantID(), barcode).Scan(&p.ID, &p.Name, &sku, &bc, &hsn, &p.TaxPercent, &p.IsKit,
		&p.CategoryID, &p.BrandID, &p.UnitID, &p.Description,
		&p.CategoryName, &p.BrandName, &p.StockQtyMillis)
	if err != nil {
		return nil, fmt.Errorf("product not found for barcode %s: %w", barcode, err)
	}
	p.SKU = sku.String
	p.Barcode = bc.String
	p.HSNCode = hsn.String

	prices, err := e.getProductPrices(p.ID)
	if err != nil {
		return nil, err
	}
	p.Prices = prices
	return &p, nil
}

// getProductPricesBatch fetches prices for multiple products in one query (avoids nested-query deadlock with MaxOpenConns=1)
func (e *Engine) getProductPricesBatch(products []models.ProductWithPrices) (map[string][]models.ProductPrice, error) {
	if len(products) == 0 {
		return map[string][]models.ProductPrice{}, nil
	}
	// Build IN clause
	placeholders := make([]string, len(products))
	args := make([]interface{}, len(products))
	for i, p := range products {
		placeholders[i] = "?"
		args[i] = p.ID
	}
	inClause := strings.Join(placeholders, ",")
	query := fmt.Sprintf(`
		SELECT id, product_id, tier, price_paise, valid_from
		FROM product_prices
		WHERE product_id IN (%s) AND valid_from <= date('now')
		ORDER BY product_id, tier, valid_from DESC
	`, inClause)

	rows, err := e.db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := map[string][]models.ProductPrice{}
	seen := map[string]bool{} // key: productID+tier
	for rows.Next() {
		var pp models.ProductPrice
		if err := rows.Scan(&pp.ID, &pp.ProductID, &pp.Tier, &pp.PricePaise, &pp.ValidFrom); err != nil {
			return nil, err
		}
		key := pp.ProductID + "|" + pp.Tier
		if !seen[key] {
			seen[key] = true
			result[pp.ProductID] = append(result[pp.ProductID], pp)
		}
	}
	return result, nil
}

func (e *Engine) getProductPrices(productID string) ([]models.ProductPrice, error) {
	rows, err := e.db.Query(`
		SELECT id, product_id, tier, price_paise, valid_from
		FROM product_prices
		WHERE product_id = ? AND valid_from <= date('now')
		ORDER BY tier, valid_from DESC
	`, productID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	seen := map[string]bool{}
	var prices []models.ProductPrice
	for rows.Next() {
		var pp models.ProductPrice
		if err := rows.Scan(&pp.ID, &pp.ProductID, &pp.Tier, &pp.PricePaise, &pp.ValidFrom); err != nil {
			return nil, err
		}
		if !seen[pp.Tier] {
			seen[pp.Tier] = true
			prices = append(prices, pp)
		}
	}
	return prices, nil
}

func (e *Engine) FinalizeSale(draft models.SaleDraft) (*models.InvoiceWithDetails, error) {
	device, err := e.GetDeviceConfig()
	if err != nil {
		return nil, err
	}

	// Check period freeze
	frozen, err := e.isPeriodFrozen(time.Now())
	if err != nil {
		return nil, err
	}
	if frozen {
		return nil, fmt.Errorf("billing is frozen for the current period")
	}

	tx, err := e.db.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	invoiceID := uuid.New().String()
	idempotencyKey := uuid.New().String()
	// Pick the first free invoice number: the stored sequence can lag behind existing invoices
	// (e.g. after demo-data seeding), which would otherwise fail with a UNIQUE constraint error.
	seq := device.NextInvoiceSeq
	if seq < 1 {
		seq = 1
	}
	// Invoice-number style: "simple" → PREFIX/n (OS-Books style, e.g. SSTM/10),
	// otherwise the default PREFIX-YY-000001 (prefix + 2-digit year + 6 digits).
	var numFmt string
	tx.QueryRow(`SELECT value FROM settings WHERE key='invoice_number_format'`).Scan(&numFmt)
	yy := time.Now().Format("06")
	var invoiceNumber string
	for {
		if numFmt == "simple" {
			invoiceNumber = fmt.Sprintf("%s/%d", device.InvoicePrefix, seq)
		} else {
			invoiceNumber = fmt.Sprintf("%s-%s-%06d", device.InvoicePrefix, yy, seq)
		}
		var taken int
		if err := tx.QueryRow(`SELECT 1 FROM invoices WHERE invoice_number = ? AND deleted_at IS NULL`, invoiceNumber).Scan(&taken); err != nil {
			break // no existing invoice with this number
		}
		seq++
	}

	var subtotal, totalDiscount, totalTax int64
	var items []models.InvoiceItem

	for i, line := range draft.Lines {
		qty := line.QuantityMillis
		gross := (line.UnitPricePaise * qty) / 1000
		disc := line.DiscountPaise
		afterDisc := gross - disc
		// MRP is tax-inclusive in India — back-calculate taxable value
		tax := afterDisc - (afterDisc * 100 / int64(100+line.TaxPercent))
		lineTotal := afterDisc

		itemID := uuid.New().String()
		item := models.InvoiceItem{
			ID:             itemID,
			InvoiceID:      invoiceID,
			ProductID:      line.ProductID,
			ProductName:    line.ProductName,
			HSNCode:        line.HSNCode,
			QuantityMillis: qty,
			PriceTier:      line.PriceTier,
			UnitPricePaise: line.UnitPricePaise,
			DiscountPaise:  disc,
			TaxPercent:     line.TaxPercent,
			TaxPaise:       tax,
			TotalPaise:     lineTotal,
		}

		_, err = tx.Exec(`INSERT INTO invoice_items (id, invoice_id, product_id, product_name, hsn_code,
			quantity_millis, price_tier, unit_price_paise, discount_paise, tax_percent, tax_paise, total_paise, sort_order)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			item.ID, item.InvoiceID, item.ProductID, item.ProductName, item.HSNCode,
			item.QuantityMillis, item.PriceTier, item.UnitPricePaise, item.DiscountPaise,
			item.TaxPercent, item.TaxPaise, item.TotalPaise, i)
		if err != nil {
			return nil, fmt.Errorf("insert item: %w", err)
		}

		// Deduct stock locally
		_, err = tx.Exec(`
			INSERT INTO local_stock (product_id, store_id, quantity_millis, updated_at)
			VALUES (?, ?, -?, datetime('now'))
			ON CONFLICT(product_id) DO UPDATE SET
				quantity_millis = quantity_millis - ?,
				updated_at = datetime('now')
		`, line.ProductID, device.StoreID, qty, qty)
		if err != nil {
			return nil, fmt.Errorf("deduct stock: %w", err)
		}

		// Record stock movement
		_, err = tx.Exec(`INSERT INTO stock_movements (id, product_id, store_id, movement_type, quantity_millis, reference_type, reference_id, created_at)
			VALUES (?, ?, ?, 'SALE', ?, 'INVOICE', ?, datetime('now'))`,
			uuid.New().String(), line.ProductID, device.StoreID, -qty, invoiceID)
		if err != nil {
			return nil, fmt.Errorf("stock movement: %w", err)
		}

		items = append(items, item)
		subtotal += gross
		totalDiscount += disc
		totalTax += tax
	}

	// subtotal is MRP-inclusive (already contains tax), so don't add tax again
	grandTotal := subtotal - totalDiscount
	roundoff := roundToNearest(grandTotal) - grandTotal
	finalTotal := grandTotal + roundoff

	// Credit (udhaar) needs a customer to bill the outstanding to — otherwise the
	// receivable can't be tracked against anyone.
	for _, p := range draft.Payments {
		if p.Method == "CREDIT" && draft.CustomerID == "" {
			return nil, fmt.Errorf("credit (udhaar) sale needs a customer — please select or add one")
		}
	}

	// Validate payments balance
	var totalPaid int64
	var payments []models.InvoicePayment
	for _, p := range draft.Payments {
		payID := uuid.New().String()
		payment := models.InvoicePayment{
			ID:              payID,
			InvoiceID:       invoiceID,
			Method:          p.Method,
			AmountPaise:     p.AmountPaise,
			ReferenceNumber: p.ReferenceNumber,
			IsVerified:      p.Method == "CASH",
		}

		_, err = tx.Exec(`INSERT INTO invoice_payments (id, invoice_id, method, amount_paise, reference_number, is_verified, created_at)
			VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
			payment.ID, payment.InvoiceID, payment.Method, payment.AmountPaise, payment.ReferenceNumber, payment.IsVerified)
		if err != nil {
			return nil, fmt.Errorf("insert payment: %w", err)
		}

		payments = append(payments, payment)
		totalPaid += p.AmountPaise
	}

	status := "FINAL"
	if totalPaid < finalTotal {
		status = "DRAFT"
	}

	// Determine customer name
	customerName := ""
	if draft.CustomerID != "" {
		tx.QueryRow(`SELECT name FROM customers WHERE id = ?`, draft.CustomerID).Scan(&customerName)
	}

	invoice := models.Invoice{
		ID:            invoiceID,
		StoreID:       device.StoreID,
		DeviceID:      device.ID,
		InvoiceNumber: invoiceNumber,
		CustomerID:    draft.CustomerID,
		CustomerName:  customerName,
		Status:        status,
		SubtotalPaise: subtotal,
		DiscountPaise: totalDiscount,
		TaxPaise:      totalTax,
		RoundoffPaise: roundoff,
		TotalPaise:    finalTotal,
		Notes:         draft.Notes,
	}

	// Get tenant_id from device → store → tenant
	var tenantID string
	err = tx.QueryRow(`SELECT s.tenant_id FROM stores s JOIN device_identity d ON s.id = d.store_id WHERE d.id = ?`, device.ID).Scan(&tenantID)
	if err != nil {
		return nil, fmt.Errorf("get tenant: %w", err)
	}
	invoice.TenantID = tenantID

	_, err = tx.Exec(`INSERT INTO invoices (id, tenant_id, store_id, device_id, invoice_number, customer_id,
		status, subtotal_paise, discount_paise, tax_paise, roundoff_paise, total_paise, notes, terms, created_by, created_by_email, idempotency_key, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
		invoice.ID, invoice.TenantID, invoice.StoreID, invoice.DeviceID, invoice.InvoiceNumber,
		nullIfEmpty(invoice.CustomerID), invoice.Status, invoice.SubtotalPaise, invoice.DiscountPaise,
		invoice.TaxPaise, invoice.RoundoffPaise, invoice.TotalPaise, invoice.Notes, nullIfEmpty(draft.Terms),
		nullIfEmpty(draft.CreatedBy), nullIfEmpty(draft.CreatedByEmail), idempotencyKey)
	if err != nil {
		return nil, fmt.Errorf("insert invoice: %w", err)
	}

	// Increment device sequence
	_, err = tx.Exec(`UPDATE device_identity SET next_invoice_seq = ? WHERE id = ?`, seq+1, device.ID)
	if err != nil {
		return nil, fmt.Errorf("increment seq: %w", err)
	}

	// Add to sync outbox
	_, err = tx.Exec(`INSERT INTO sync_outbox (id, entity_type, entity_id, action, payload, idempotency_key, status, created_at)
		VALUES (?, 'INVOICE', ?, 'CREATE', '{}', ?, 'PENDING', datetime('now'))`,
		uuid.New().String(), invoiceID, idempotencyKey)
	if err != nil {
		return nil, fmt.Errorf("sync outbox: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("commit: %w", err)
	}

	invoice.CreatedAt = time.Now().Format("2006-01-02 15:04:05")
	return &models.InvoiceWithDetails{
		Invoice:  invoice,
		Items:    items,
		Payments: payments,
	}, nil
}

// DeleteInvoice soft-deletes a sale into the Recycle Bin (like OS-Books): it
// stamps deleted_at/by and adds the sold quantities back to stock. All reports,
// ledgers and GST returns exclude invoices where deleted_at IS NOT NULL, so the
// customer ledger, outstanding, dashboard and GST figures reverse automatically.
func (e *Engine) DeleteInvoice(invoiceID, deletedBy, deletedByEmail string) error {
	tx, err := e.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	var already string
	if err := tx.QueryRow(`SELECT COALESCE(deleted_at,'') FROM invoices WHERE id = ?`, invoiceID).Scan(&already); err != nil {
		return fmt.Errorf("invoice not found: %w", err)
	}
	if already != "" {
		return fmt.Errorf("invoice already deleted")
	}
	if err := e.adjustStockForInvoice(tx, invoiceID, +1); err != nil {
		return err
	}
	if _, err := tx.Exec(`UPDATE invoices SET deleted_at = datetime('now'), deleted_by = ?, deleted_by_email = ? WHERE id = ?`,
		deletedBy, deletedByEmail, invoiceID); err != nil {
		return fmt.Errorf("soft delete invoice: %w", err)
	}
	return tx.Commit()
}

// RestoreInvoice brings a soft-deleted sale back and re-deducts its stock.
func (e *Engine) RestoreInvoice(invoiceID string) error {
	tx, err := e.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	var del string
	if err := tx.QueryRow(`SELECT COALESCE(deleted_at,'') FROM invoices WHERE id = ?`, invoiceID).Scan(&del); err != nil {
		return fmt.Errorf("invoice not found: %w", err)
	}
	if del == "" {
		return fmt.Errorf("invoice is not deleted")
	}
	if err := e.adjustStockForInvoice(tx, invoiceID, -1); err != nil {
		return err
	}
	if _, err := tx.Exec(`UPDATE invoices SET deleted_at = NULL, deleted_by = NULL, deleted_by_email = NULL WHERE id = ?`, invoiceID); err != nil {
		return fmt.Errorf("restore invoice: %w", err)
	}
	return tx.Commit()
}

// PurgeInvoice permanently removes a soft-deleted sale (admin-only, irreversible).
func (e *Engine) PurgeInvoice(invoiceID string) error {
	tx, err := e.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	var del string
	if err := tx.QueryRow(`SELECT COALESCE(deleted_at,'') FROM invoices WHERE id = ?`, invoiceID).Scan(&del); err != nil {
		return fmt.Errorf("invoice not found: %w", err)
	}
	if del == "" {
		return fmt.Errorf("only recycled invoices can be permanently deleted")
	}
	for _, q := range []string{
		`DELETE FROM invoice_payments WHERE invoice_id = ?`,
		`DELETE FROM invoice_items WHERE invoice_id = ?`,
		`DELETE FROM invoices WHERE id = ?`,
	} {
		if _, err := tx.Exec(q, invoiceID); err != nil {
			return fmt.Errorf("purge invoice: %w", err)
		}
	}
	return tx.Commit()
}

// adjustStockForInvoice adds (dir=+1) or removes (dir=-1) each line's quantity
// from local_stock — used to reverse a sale on delete and re-apply it on restore.
func (e *Engine) adjustStockForInvoice(tx *sql.Tx, invoiceID string, dir int) error {
	rows, err := tx.Query(`SELECT product_id, quantity_millis FROM invoice_items WHERE invoice_id = ?`, invoiceID)
	if err != nil {
		return fmt.Errorf("read items: %w", err)
	}
	type it struct {
		pid string
		qty int64
	}
	var items []it
	for rows.Next() {
		var i it
		if err := rows.Scan(&i.pid, &i.qty); err != nil {
			rows.Close()
			return err
		}
		items = append(items, i)
	}
	rows.Close()
	for _, i := range items {
		delta := i.qty * int64(dir)
		if _, err := tx.Exec(`UPDATE local_stock SET quantity_millis = quantity_millis + ?, updated_at = datetime('now') WHERE product_id = ?`, delta, i.pid); err != nil {
			return fmt.Errorf("adjust stock: %w", err)
		}
	}
	return nil
}

func (e *Engine) isPeriodFrozen(date time.Time) (bool, error) {
	dateStr := date.Format("2006-01-02")
	var count int
	err := e.db.QueryRow(`
		SELECT COUNT(*) FROM period_freezes
		WHERE (scope = 'ALL' OR scope = 'SALES')
		AND start_date <= ? AND end_date >= ?
	`, dateStr, dateStr).Scan(&count)
	if err != nil {
		return false, err
	}
	return count > 0, nil
}

func (e *Engine) GetInvoices(limit int) ([]models.Invoice, error) {
	if limit <= 0 {
		limit = 50
	}
	rows, err := e.db.Query(`
		SELECT i.id, i.tenant_id, i.store_id, i.device_id, i.invoice_number,
			COALESCE(i.customer_id, ''), COALESCE(c.name, 'Walk-in'),
			i.status, i.subtotal_paise, i.discount_paise, i.tax_paise,
			i.roundoff_paise, i.total_paise, COALESCE(i.notes, ''), i.created_at
		FROM invoices i
		LEFT JOIN customers c ON i.customer_id = c.id
		WHERE i.tenant_id = ? AND i.deleted_at IS NULL
		ORDER BY i.created_at DESC LIMIT ?
	`, e.activeTenantID(), limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var invoices []models.Invoice
	for rows.Next() {
		var inv models.Invoice
		if err := rows.Scan(&inv.ID, &inv.TenantID, &inv.StoreID, &inv.DeviceID,
			&inv.InvoiceNumber, &inv.CustomerID, &inv.CustomerName, &inv.Status,
			&inv.SubtotalPaise, &inv.DiscountPaise, &inv.TaxPaise,
			&inv.RoundoffPaise, &inv.TotalPaise, &inv.Notes, &inv.CreatedAt); err != nil {
			return nil, err
		}
		invoices = append(invoices, inv)
	}
	return invoices, nil
}

func (e *Engine) GetInvoiceDetails(invoiceID string) (*models.InvoiceWithDetails, error) {
	inv := &models.InvoiceWithDetails{}
	err := e.db.QueryRow(`
		SELECT i.id, i.tenant_id, i.store_id, i.device_id, i.invoice_number,
			COALESCE(i.customer_id, ''), COALESCE(c.name, 'Walk-in'),
			i.status, i.subtotal_paise, i.discount_paise, i.tax_paise,
			i.roundoff_paise, i.total_paise, COALESCE(i.notes, ''), i.created_at
		FROM invoices i
		LEFT JOIN customers c ON i.customer_id = c.id
		WHERE i.id = ?
	`, invoiceID).Scan(&inv.ID, &inv.TenantID, &inv.StoreID, &inv.DeviceID,
		&inv.InvoiceNumber, &inv.CustomerID, &inv.CustomerName, &inv.Status,
		&inv.SubtotalPaise, &inv.DiscountPaise, &inv.TaxPaise,
		&inv.RoundoffPaise, &inv.TotalPaise, &inv.Notes, &inv.CreatedAt)
	if err != nil {
		return nil, err
	}

	// Items
	itemRows, err := e.db.Query(`SELECT id, invoice_id, product_id, product_name, COALESCE(hsn_code,''),
		quantity_millis, price_tier, unit_price_paise, discount_paise, tax_percent, tax_paise, total_paise
		FROM invoice_items WHERE invoice_id = ? ORDER BY sort_order`, invoiceID)
	if err != nil {
		return nil, err
	}
	defer itemRows.Close()
	for itemRows.Next() {
		var item models.InvoiceItem
		if err := itemRows.Scan(&item.ID, &item.InvoiceID, &item.ProductID, &item.ProductName,
			&item.HSNCode, &item.QuantityMillis, &item.PriceTier, &item.UnitPricePaise,
			&item.DiscountPaise, &item.TaxPercent, &item.TaxPaise, &item.TotalPaise); err != nil {
			return nil, err
		}
		inv.Items = append(inv.Items, item)
	}

	// Payments
	payRows, err := e.db.Query(`SELECT id, invoice_id, method, amount_paise, COALESCE(reference_number,''), is_verified
		FROM invoice_payments WHERE invoice_id = ?`, invoiceID)
	if err != nil {
		return nil, err
	}
	defer payRows.Close()
	for payRows.Next() {
		var pay models.InvoicePayment
		if err := payRows.Scan(&pay.ID, &pay.InvoiceID, &pay.Method, &pay.AmountPaise,
			&pay.ReferenceNumber, &pay.IsVerified); err != nil {
			return nil, err
		}
		inv.Payments = append(inv.Payments, pay)
	}

	return inv, nil
}

func (e *Engine) GetDashboardStats() (*models.DashboardStats, error) {
	stats := &models.DashboardStats{}
	now := time.Now()
	today := now.Format("2006-01-02")
	thisMonth := now.Format("2006-01")
	prevMonth := now.AddDate(0, -1, 0).Format("2006-01")
	tid := e.activeTenantID() // scope all dashboard figures to the active company

	// Today: sales count + total
	e.db.QueryRow(`SELECT COUNT(*), COALESCE(SUM(total_paise),0) FROM invoices
		WHERE status = 'FINAL' AND deleted_at IS NULL AND tenant_id = ? AND date(created_at) = ?`, tid, today).
		Scan(&stats.TodaySalesCount, &stats.TodaySalesPaise)

	// Today: payment mode breakdown
	for _, row := range []struct {
		method string
		dest   *int64
	}{
		{"CASH", &stats.TodayCashPaise},
		{"UPI", &stats.TodayUPIPaise},
		{"CARD", &stats.TodayCardPaise},
		{"CREDIT", &stats.TodayCreditPaise},
		{"CHEQUE", &stats.TodayChequePaise},
	} {
		e.db.QueryRow(`SELECT COALESCE(SUM(ip.amount_paise),0) FROM invoice_payments ip
			JOIN invoices i ON ip.invoice_id = i.id
			WHERE i.status = 'FINAL' AND i.deleted_at IS NULL AND i.tenant_id = ? AND date(i.created_at) = ? AND ip.method = ?`,
			tid, today, row.method).Scan(row.dest)
	}
	// TodayBankPaise: no BANK method in invoice_payments, stays 0

	// Month: sales
	e.db.QueryRow(`SELECT COUNT(*), COALESCE(SUM(total_paise),0) FROM invoices
		WHERE status = 'FINAL' AND deleted_at IS NULL AND tenant_id = ? AND strftime('%Y-%m', created_at) = ?`, tid, thisMonth).
		Scan(&stats.MonthSalesCount, &stats.MonthSalesPaise)

	// Previous month sales (for % comparison)
	e.db.QueryRow(`SELECT COALESCE(SUM(total_paise),0) FROM invoices
		WHERE status = 'FINAL' AND deleted_at IS NULL AND tenant_id = ? AND strftime('%Y-%m', created_at) = ?`, tid, prevMonth).
		Scan(&stats.PrevMonthSalesPaise)

	// Month: purchase bills
	e.db.QueryRow(`SELECT COALESCE(SUM(total_paise),0) FROM purchase_bills
		WHERE status = 'FINAL' AND tenant_id = ? AND strftime('%Y-%m', created_at) = ?`, tid, thisMonth).
		Scan(&stats.MonthPurchasePaise)

	// Month: expenses
	e.db.QueryRow(`SELECT COALESCE(SUM(amount_paise),0) FROM expense_entries
		WHERE tenant_id = ? AND strftime('%Y-%m', entry_date) = ?`, tid, thisMonth).
		Scan(&stats.MonthExpensePaise)

	// Outstanding receivable: total CREDIT tender on all FINAL invoices
	e.db.QueryRow(`SELECT COALESCE(SUM(ip.amount_paise),0) FROM invoice_payments ip
		JOIN invoices i ON ip.invoice_id = i.id
		WHERE i.status = 'FINAL' AND i.deleted_at IS NULL AND i.tenant_id = ? AND ip.method = 'CREDIT'`, tid).
		Scan(&stats.TotalReceivablePaise)

	// Outstanding payable: purchase_bills marked RECEIVED (not yet paid via payment_entries)
	// Simplified: total purchase bills - supplier payments
	e.db.QueryRow(`SELECT COALESCE(SUM(total_paise),0) FROM purchase_bills WHERE status = 'FINAL' AND tenant_id = ?`, tid).
		Scan(&stats.TotalPayablePaise)

	// Stock (active company only)
	e.db.QueryRow(`SELECT COUNT(*) FROM products WHERE is_active = 1 AND tenant_id = ?`, tid).Scan(&stats.TotalProducts)
	e.db.QueryRow(`SELECT COUNT(*) FROM local_stock ls JOIN products p ON p.id = ls.product_id
		WHERE p.is_active = 1 AND p.tenant_id = ? AND ls.quantity_millis <= 5000`, tid).Scan(&stats.LowStockCount)

	// Sales by day: last 30 days
	rows, err := e.db.Query(`SELECT date(created_at) as d, COALESCE(SUM(total_paise),0)
		FROM invoices WHERE status = 'FINAL' AND deleted_at IS NULL AND tenant_id = ? AND date(created_at) >= date('now','-29 days')
		GROUP BY d ORDER BY d`, tid)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var day models.DashboardSaleDay
			rows.Scan(&day.Date, &day.SalePaise)
			stats.SalesByDay = append(stats.SalesByDay, day)
		}
	}

	// Top 5 selling items this month by quantity
	rows2, err := e.db.Query(`SELECT ii.product_name,
		COALESCE(SUM(ii.quantity_millis),0) as qty,
		COALESCE(SUM(ii.total_paise),0) as amt
		FROM invoice_items ii
		JOIN invoices i ON ii.invoice_id = i.id
		WHERE i.status = 'FINAL' AND i.deleted_at IS NULL AND i.tenant_id = ? AND strftime('%Y-%m', i.created_at) = ?
		GROUP BY ii.product_name ORDER BY qty DESC LIMIT 5`, tid, thisMonth)
	if err == nil {
		defer rows2.Close()
		for rows2.Next() {
			var item models.DashboardTopItem
			rows2.Scan(&item.Name, &item.Qty, &item.AmtPaise)
			stats.TopItems = append(stats.TopItems, item)
		}
	}

	return stats, nil
}

func roundToNearest(paise int64) int64 {
	rupees := float64(paise) / 100.0
	rounded := math.Round(rupees)
	return int64(rounded * 100)
}

func nullIfEmpty(s string) interface{} {
	if s == "" {
		return nil
	}
	return s
}
