package inventory

import (
	"database/sql"
	"fmt"
	"time"

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

// ─── Purchase Order ─────────────────────────────────────────────────────────

func (s *Service) ListPurchaseOrders(status string) ([]models.PurchaseOrder, error) {
	q := `SELECT id, tenant_id, store_id, COALESCE(company_id,''), order_number, order_date,
		status, subtotal_paise, tax_paise, total_paise, COALESCE(notes,'')
		FROM purchase_orders WHERE tenant_id = ?`
	args := []interface{}{s.tenantID()}

	if status != "" {
		q += ` AND status = ?`
		args = append(args, status)
	}
	q += ` ORDER BY order_date DESC`

	rows, err := s.db.Query(q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []models.PurchaseOrder
	for rows.Next() {
		var o models.PurchaseOrder
		if err := rows.Scan(&o.ID, &o.TenantID, &o.StoreID, &o.CompanyID, &o.OrderNumber,
			&o.OrderDate, &o.Status, &o.SubtotalPaise, &o.TaxPaise, &o.TotalPaise, &o.Notes); err != nil {
			return nil, err
		}
		list = append(list, o)
	}
	return list, nil
}

func (s *Service) SavePurchaseOrder(po models.PurchaseOrder, items []models.PurchaseOrderItem) (string, error) {
	tenantID := s.tenantID()
	storeID := s.storeID()

	tx, err := s.db.Begin()
	if err != nil {
		return "", err
	}
	defer tx.Rollback()

	if po.ID == "" {
		po.ID = uuid.New().String()
		// Keep the invoice number typed by the user; auto-generate only when blank.
		if po.OrderNumber == "" {
			po.OrderNumber = fmt.Sprintf("PO-%s-%06d", time.Now().Format("0601"), s.nextSeq(tx, "purchase_orders", tenantID))
		}
	}
	po.TenantID = tenantID
	po.StoreID = storeID

	// Editing an already-received purchase: take its old quantities back out of stock first.
	var oldStatus string
	if err := tx.QueryRow(`SELECT status FROM purchase_orders WHERE id = ?`, po.ID).Scan(&oldStatus); err == nil && oldStatus == "RECEIVED" {
		if err := s.adjustPurchaseStock(tx, po.ID, storeID, -1); err != nil {
			return "", err
		}
	}

	_, err = tx.Exec(`INSERT INTO purchase_orders (id, tenant_id, store_id, company_id, order_number, order_date, status, subtotal_paise, tax_paise, total_paise, notes, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
		ON CONFLICT(id) DO UPDATE SET
			company_id=excluded.company_id, order_date=excluded.order_date, status=excluded.status,
			order_number=CASE WHEN excluded.order_number <> '' THEN excluded.order_number ELSE purchase_orders.order_number END,
			subtotal_paise=excluded.subtotal_paise, tax_paise=excluded.tax_paise, total_paise=excluded.total_paise,
			notes=excluded.notes, updated_at=datetime('now')`,
		po.ID, po.TenantID, po.StoreID, nullStr(po.CompanyID), po.OrderNumber, po.OrderDate,
		po.Status, po.SubtotalPaise, po.TaxPaise, po.TotalPaise, nullStr(po.Notes))
	if err != nil {
		return "", fmt.Errorf("save po: %w", err)
	}

	tx.Exec(`DELETE FROM purchase_order_items WHERE order_id = ?`, po.ID)
	for _, item := range items {
		if item.ID == "" {
			item.ID = uuid.New().String()
		}
		_, err = tx.Exec(`INSERT INTO purchase_order_items (id, order_id, product_id, quantity_millis, unit_price_paise, tax_percent, total_paise, received_millis)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
			item.ID, po.ID, item.ProductID, item.QuantityMillis, item.UnitPricePaise, item.TaxPercent, item.TotalPaise, item.ReceivedMillis)
		if err != nil {
			return "", fmt.Errorf("save po item: %w", err)
		}
	}

	// A RECEIVED purchase (purchase invoice) adds the goods to stock.
	if po.Status == "RECEIVED" {
		if err := s.adjustPurchaseStock(tx, po.ID, storeID, 1); err != nil {
			return "", err
		}
	}

	return po.ID, tx.Commit()
}

// adjustPurchaseStock adds (sign=+1) or removes (sign=-1) the quantities of a purchase order's items.
func (s *Service) adjustPurchaseStock(tx *sql.Tx, orderID, storeID string, sign int64) error {
	return s.adjustStockForItems(tx, "purchase_order_items", "order_id", orderID, storeID, "PURCHASE", "PURCHASE_ORDER", sign)
}

// adjustStockForItems applies sign*quantity of every item of a document (read from itemTable where
// fkCol = docID) to local_stock and records a stock movement. Runs inside the caller's transaction.
// Lines are collected first and the rows closed before any further statement (single DB connection).
// itemTable / fkCol / movementType / refType are internal constants, never user input.
func (s *Service) adjustStockForItems(tx *sql.Tx, itemTable, fkCol, docID, storeID, movementType, refType string, sign int64) error {
	type line struct {
		productID string
		qty       int64
	}
	rows, err := tx.Query(fmt.Sprintf(`SELECT product_id, quantity_millis FROM %s WHERE %s = ?`, itemTable, fkCol), docID)
	if err != nil {
		return fmt.Errorf("load items: %w", err)
	}
	var lines []line
	for rows.Next() {
		var l line
		if err := rows.Scan(&l.productID, &l.qty); err != nil {
			rows.Close()
			return err
		}
		lines = append(lines, l)
	}
	rows.Close()

	for _, l := range lines {
		d := sign * l.qty
		if _, err := tx.Exec(`INSERT INTO local_stock (product_id, store_id, quantity_millis, updated_at)
			VALUES (?, ?, ?, datetime('now'))
			ON CONFLICT(product_id) DO UPDATE SET quantity_millis = quantity_millis + ?, updated_at = datetime('now')`,
			l.productID, storeID, d, d); err != nil {
			return fmt.Errorf("update stock: %w", err)
		}
		if _, err := tx.Exec(`INSERT INTO stock_movements (id, product_id, store_id, movement_type, quantity_millis, reference_type, reference_id, created_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
			uuid.New().String(), l.productID, storeID, movementType, d, refType, docID); err != nil {
			return fmt.Errorf("stock movement: %w", err)
		}
	}
	return nil
}

func (s *Service) DeletePurchaseOrder(id string) error {
	storeID := s.storeID() // read before the transaction starts (single DB connection)
	var status string
	s.db.QueryRow(`SELECT status FROM purchase_orders WHERE id = ?`, id).Scan(&status)

	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	if status == "RECEIVED" {
		if err := s.adjustPurchaseStock(tx, id, storeID, -1); err != nil {
			tx.Rollback()
			return err
		}
	}
	if _, err = tx.Exec(`DELETE FROM purchase_order_items WHERE order_id = ?`, id); err != nil {
		tx.Rollback()
		return err
	}
	if _, err = tx.Exec(`DELETE FROM purchase_orders WHERE id = ?`, id); err != nil {
		tx.Rollback()
		return err
	}
	return tx.Commit()
}

// ─── Sale Order ─────────────────────────────────────────────────────────────

func (s *Service) ListSaleOrders(status string) ([]models.SaleOrder, error) {
	q := `SELECT id, tenant_id, store_id, COALESCE(customer_id,''), order_number, order_date,
		status, subtotal_paise, tax_paise, total_paise, COALESCE(notes,'')
		FROM sale_orders WHERE tenant_id = ?`
	args := []interface{}{s.tenantID()}

	if status != "" {
		q += ` AND status = ?`
		args = append(args, status)
	}
	q += ` ORDER BY order_date DESC`

	rows, err := s.db.Query(q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []models.SaleOrder
	for rows.Next() {
		var o models.SaleOrder
		if err := rows.Scan(&o.ID, &o.TenantID, &o.StoreID, &o.CustomerID, &o.OrderNumber,
			&o.OrderDate, &o.Status, &o.SubtotalPaise, &o.TaxPaise, &o.TotalPaise, &o.Notes); err != nil {
			return nil, err
		}
		list = append(list, o)
	}
	return list, nil
}

func (s *Service) SaveSaleOrder(so models.SaleOrder, items []models.SaleOrderItem) (string, error) {
	tenantID := s.tenantID()
	storeID := s.storeID()

	tx, err := s.db.Begin()
	if err != nil {
		return "", err
	}
	defer tx.Rollback()

	if so.ID == "" {
		so.ID = uuid.New().String()
		so.OrderNumber = fmt.Sprintf("SO-%s-%06d", time.Now().Format("0601"), s.nextSeq(tx, "sale_orders", tenantID))
	}
	so.TenantID = tenantID
	so.StoreID = storeID

	_, err = tx.Exec(`INSERT INTO sale_orders (id, tenant_id, store_id, customer_id, order_number, order_date, status, subtotal_paise, tax_paise, total_paise, notes, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
		ON CONFLICT(id) DO UPDATE SET
			customer_id=excluded.customer_id, order_date=excluded.order_date, status=excluded.status,
			subtotal_paise=excluded.subtotal_paise, tax_paise=excluded.tax_paise, total_paise=excluded.total_paise,
			notes=excluded.notes, updated_at=datetime('now')`,
		so.ID, so.TenantID, so.StoreID, nullStr(so.CustomerID), so.OrderNumber, so.OrderDate,
		so.Status, so.SubtotalPaise, so.TaxPaise, so.TotalPaise, nullStr(so.Notes))
	if err != nil {
		return "", fmt.Errorf("save so: %w", err)
	}

	tx.Exec(`DELETE FROM sale_order_items WHERE order_id = ?`, so.ID)
	for _, item := range items {
		if item.ID == "" {
			item.ID = uuid.New().String()
		}
		_, err = tx.Exec(`INSERT INTO sale_order_items (id, order_id, product_id, quantity_millis, unit_price_paise, tax_percent, total_paise, delivered_millis)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
			item.ID, so.ID, item.ProductID, item.QuantityMillis, item.UnitPricePaise, item.TaxPercent, item.TotalPaise, item.DeliveredMillis)
		if err != nil {
			return "", fmt.Errorf("save so item: %w", err)
		}
	}

	return so.ID, tx.Commit()
}

func (s *Service) DeleteSaleOrder(id string) error {
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	if _, err = tx.Exec(`DELETE FROM sale_order_items WHERE order_id = ?`, id); err != nil {
		tx.Rollback()
		return err
	}
	if _, err = tx.Exec(`DELETE FROM sale_orders WHERE id = ?`, id); err != nil {
		tx.Rollback()
		return err
	}
	return tx.Commit()
}

// ─── Sales Return ───────────────────────────────────────────────────────────

func (s *Service) ListSalesReturns() ([]models.SalesReturn, error) {
	rows, err := s.db.Query(`SELECT id, tenant_id, store_id, COALESCE(invoice_id,''),
		COALESCE(customer_id,''), return_number, return_date, subtotal_paise, tax_paise, total_paise,
		COALESCE(notes,'') FROM sales_returns WHERE tenant_id = ? ORDER BY return_date DESC`, s.tenantID())
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []models.SalesReturn
	for rows.Next() {
		var r models.SalesReturn
		if err := rows.Scan(&r.ID, &r.TenantID, &r.StoreID, &r.InvoiceID, &r.CustomerID,
			&r.ReturnNumber, &r.ReturnDate, &r.SubtotalPaise, &r.TaxPaise, &r.TotalPaise, &r.Notes); err != nil {
			return nil, err
		}
		list = append(list, r)
	}
	return list, nil
}

func (s *Service) SaveSalesReturn(sr models.SalesReturn, items []models.SalesReturnItem) (string, error) {
	tenantID := s.tenantID()
	storeID := s.storeID()

	tx, err := s.db.Begin()
	if err != nil {
		return "", err
	}
	defer tx.Rollback()

	if sr.ID == "" {
		sr.ID = uuid.New().String()
		sr.ReturnNumber = fmt.Sprintf("SR-%s-%06d", time.Now().Format("0601"), s.nextSeq(tx, "sales_returns", tenantID))
	}
	sr.TenantID = tenantID
	sr.StoreID = storeID

	// Editing an existing return: undo its earlier stock effect first (it is re-applied below).
	var existing int
	if err := tx.QueryRow(`SELECT 1 FROM sales_returns WHERE id = ?`, sr.ID).Scan(&existing); err == nil {
		if err := s.adjustStockForItems(tx, "sales_return_items", "return_id", sr.ID, storeID, "RETURN", "SALES_RETURN", -1); err != nil {
			return "", err
		}
	}

	_, err = tx.Exec(`INSERT INTO sales_returns (id, tenant_id, store_id, invoice_id, customer_id, return_number, return_date, subtotal_paise, tax_paise, total_paise, notes, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
		ON CONFLICT(id) DO UPDATE SET
			invoice_id=excluded.invoice_id, customer_id=excluded.customer_id, return_date=excluded.return_date,
			subtotal_paise=excluded.subtotal_paise, tax_paise=excluded.tax_paise, total_paise=excluded.total_paise, notes=excluded.notes`,
		sr.ID, sr.TenantID, sr.StoreID, nullStr(sr.InvoiceID), nullStr(sr.CustomerID),
		sr.ReturnNumber, sr.ReturnDate, sr.SubtotalPaise, sr.TaxPaise, sr.TotalPaise, nullStr(sr.Notes))
	if err != nil {
		return "", fmt.Errorf("save sales return: %w", err)
	}

	tx.Exec(`DELETE FROM sales_return_items WHERE return_id = ?`, sr.ID)
	for _, item := range items {
		if item.ID == "" {
			item.ID = uuid.New().String()
		}
		_, err = tx.Exec(`INSERT INTO sales_return_items (id, return_id, product_id, quantity_millis, unit_price_paise, tax_percent, total_paise)
			VALUES (?, ?, ?, ?, ?, ?, ?)`,
			item.ID, sr.ID, item.ProductID, item.QuantityMillis, item.UnitPricePaise, item.TaxPercent, item.TotalPaise)
		if err != nil {
			return "", fmt.Errorf("save sr item: %w", err)
		}
	}

	// Returned goods come back into stock.
	if err := s.adjustStockForItems(tx, "sales_return_items", "return_id", sr.ID, storeID, "RETURN", "SALES_RETURN", 1); err != nil {
		return "", err
	}

	return sr.ID, tx.Commit()
}

func (s *Service) DeleteSalesReturn(id string) error {
	storeID := s.storeID() // read before the transaction starts (single DB connection)
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	var existing int
	if err := tx.QueryRow(`SELECT 1 FROM sales_returns WHERE id = ?`, id).Scan(&existing); err == nil {
		if err := s.adjustStockForItems(tx, "sales_return_items", "return_id", id, storeID, "RETURN", "SALES_RETURN", -1); err != nil {
			tx.Rollback()
			return err
		}
	}
	if _, err = tx.Exec(`DELETE FROM sales_return_items WHERE return_id = ?`, id); err != nil {
		tx.Rollback()
		return err
	}
	if _, err = tx.Exec(`DELETE FROM sales_returns WHERE id = ?`, id); err != nil {
		tx.Rollback()
		return err
	}
	return tx.Commit()
}

// ─── Purchase Return ────────────────────────────────────────────────────────

func (s *Service) ListPurchaseReturns() ([]models.PurchaseReturn, error) {
	rows, err := s.db.Query(`SELECT id, tenant_id, store_id, COALESCE(purchase_id,''),
		COALESCE(company_id,''), return_number, return_date, subtotal_paise, tax_paise, total_paise,
		COALESCE(notes,'') FROM purchase_returns WHERE tenant_id = ? ORDER BY return_date DESC`, s.tenantID())
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []models.PurchaseReturn
	for rows.Next() {
		var r models.PurchaseReturn
		if err := rows.Scan(&r.ID, &r.TenantID, &r.StoreID, &r.PurchaseID, &r.CompanyID,
			&r.ReturnNumber, &r.ReturnDate, &r.SubtotalPaise, &r.TaxPaise, &r.TotalPaise, &r.Notes); err != nil {
			return nil, err
		}
		list = append(list, r)
	}
	return list, nil
}

func (s *Service) SavePurchaseReturn(pr models.PurchaseReturn, items []models.PurchaseReturnItem) (string, error) {
	tenantID := s.tenantID()
	storeID := s.storeID()

	tx, err := s.db.Begin()
	if err != nil {
		return "", err
	}
	defer tx.Rollback()

	if pr.ID == "" {
		pr.ID = uuid.New().String()
		pr.ReturnNumber = fmt.Sprintf("PR-%s-%06d", time.Now().Format("0601"), s.nextSeq(tx, "purchase_returns", tenantID))
	}
	pr.TenantID = tenantID
	pr.StoreID = storeID

	// Editing an existing return: undo its earlier stock effect first (it is re-applied below).
	var existing int
	if err := tx.QueryRow(`SELECT 1 FROM purchase_returns WHERE id = ?`, pr.ID).Scan(&existing); err == nil {
		if err := s.adjustStockForItems(tx, "purchase_return_items", "return_id", pr.ID, storeID, "RETURN", "PURCHASE_RETURN", 1); err != nil {
			return "", err
		}
	}

	_, err = tx.Exec(`INSERT INTO purchase_returns (id, tenant_id, store_id, purchase_id, company_id, return_number, return_date, subtotal_paise, tax_paise, total_paise, notes, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
		ON CONFLICT(id) DO UPDATE SET
			purchase_id=excluded.purchase_id, company_id=excluded.company_id, return_date=excluded.return_date,
			subtotal_paise=excluded.subtotal_paise, tax_paise=excluded.tax_paise, total_paise=excluded.total_paise, notes=excluded.notes`,
		pr.ID, pr.TenantID, pr.StoreID, nullStr(pr.PurchaseID), nullStr(pr.CompanyID),
		pr.ReturnNumber, pr.ReturnDate, pr.SubtotalPaise, pr.TaxPaise, pr.TotalPaise, nullStr(pr.Notes))
	if err != nil {
		return "", fmt.Errorf("save purchase return: %w", err)
	}

	tx.Exec(`DELETE FROM purchase_return_items WHERE return_id = ?`, pr.ID)
	for _, item := range items {
		if item.ID == "" {
			item.ID = uuid.New().String()
		}
		_, err = tx.Exec(`INSERT INTO purchase_return_items (id, return_id, product_id, quantity_millis, unit_price_paise, tax_percent, total_paise)
			VALUES (?, ?, ?, ?, ?, ?, ?)`,
			item.ID, pr.ID, item.ProductID, item.QuantityMillis, item.UnitPricePaise, item.TaxPercent, item.TotalPaise)
		if err != nil {
			return "", fmt.Errorf("save pr item: %w", err)
		}
	}

	// Goods returned to the supplier leave stock.
	if err := s.adjustStockForItems(tx, "purchase_return_items", "return_id", pr.ID, storeID, "RETURN", "PURCHASE_RETURN", -1); err != nil {
		return "", err
	}

	return pr.ID, tx.Commit()
}

func (s *Service) DeletePurchaseReturn(id string) error {
	storeID := s.storeID() // read before the transaction starts (single DB connection)
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	var existing int
	if err := tx.QueryRow(`SELECT 1 FROM purchase_returns WHERE id = ?`, id).Scan(&existing); err == nil {
		if err := s.adjustStockForItems(tx, "purchase_return_items", "return_id", id, storeID, "RETURN", "PURCHASE_RETURN", 1); err != nil {
			tx.Rollback()
			return err
		}
	}
	if _, err = tx.Exec(`DELETE FROM purchase_return_items WHERE return_id = ?`, id); err != nil {
		tx.Rollback()
		return err
	}
	if _, err = tx.Exec(`DELETE FROM purchase_returns WHERE id = ?`, id); err != nil {
		tx.Rollback()
		return err
	}
	return tx.Commit()
}

// ─── Debit Note ─────────────────────────────────────────────────────────────

func (s *Service) ListDebitNotes() ([]models.DebitNote, error) {
	rows, err := s.db.Query(`SELECT id, tenant_id, store_id, COALESCE(company_id,''),
		note_number, note_date, amount_paise, tax_paise, total_paise, COALESCE(reason,'')
		FROM debit_notes WHERE tenant_id = ? ORDER BY note_date DESC`, s.tenantID())
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []models.DebitNote
	for rows.Next() {
		var n models.DebitNote
		if err := rows.Scan(&n.ID, &n.TenantID, &n.StoreID, &n.CompanyID, &n.NoteNumber,
			&n.NoteDate, &n.AmountPaise, &n.TaxPaise, &n.TotalPaise, &n.Reason); err != nil {
			return nil, err
		}
		list = append(list, n)
	}
	return list, nil
}

func (s *Service) SaveDebitNote(n models.DebitNote) (string, error) {
	if n.ID == "" {
		n.ID = uuid.New().String()
		n.NoteNumber = fmt.Sprintf("DN-%s-%06d", time.Now().Format("0601"), s.nextSeqSimple("debit_notes"))
	}
	n.TenantID = s.tenantID()
	n.StoreID = s.storeID()

	_, err := s.db.Exec(`INSERT INTO debit_notes (id, tenant_id, store_id, company_id, note_number, note_date, amount_paise, tax_paise, total_paise, reason, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
		ON CONFLICT(id) DO UPDATE SET
			company_id=excluded.company_id, note_date=excluded.note_date, amount_paise=excluded.amount_paise,
			tax_paise=excluded.tax_paise, total_paise=excluded.total_paise, reason=excluded.reason`,
		n.ID, n.TenantID, n.StoreID, nullStr(n.CompanyID), n.NoteNumber, n.NoteDate,
		n.AmountPaise, n.TaxPaise, n.TotalPaise, nullStr(n.Reason))
	if err != nil {
		return "", fmt.Errorf("save debit note: %w", err)
	}
	return n.ID, nil
}

func (s *Service) DeleteDebitNote(id string) error {
	_, err := s.db.Exec(`DELETE FROM debit_notes WHERE id = ?`, id)
	return err
}

// ─── Credit Note ────────────────────────────────────────────────────────────

func (s *Service) ListCreditNotes() ([]models.CreditNote, error) {
	rows, err := s.db.Query(`SELECT id, tenant_id, store_id, COALESCE(customer_id,''),
		note_number, note_date, amount_paise, tax_paise, total_paise, COALESCE(reason,'')
		FROM credit_notes WHERE tenant_id = ? ORDER BY note_date DESC`, s.tenantID())
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []models.CreditNote
	for rows.Next() {
		var n models.CreditNote
		if err := rows.Scan(&n.ID, &n.TenantID, &n.StoreID, &n.CustomerID, &n.NoteNumber,
			&n.NoteDate, &n.AmountPaise, &n.TaxPaise, &n.TotalPaise, &n.Reason); err != nil {
			return nil, err
		}
		list = append(list, n)
	}
	return list, nil
}

func (s *Service) SaveCreditNote(n models.CreditNote) (string, error) {
	if n.ID == "" {
		n.ID = uuid.New().String()
		n.NoteNumber = fmt.Sprintf("CN-%s-%06d", time.Now().Format("0601"), s.nextSeqSimple("credit_notes"))
	}
	n.TenantID = s.tenantID()
	n.StoreID = s.storeID()

	_, err := s.db.Exec(`INSERT INTO credit_notes (id, tenant_id, store_id, customer_id, note_number, note_date, amount_paise, tax_paise, total_paise, reason, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
		ON CONFLICT(id) DO UPDATE SET
			customer_id=excluded.customer_id, note_date=excluded.note_date, amount_paise=excluded.amount_paise,
			tax_paise=excluded.tax_paise, total_paise=excluded.total_paise, reason=excluded.reason`,
		n.ID, n.TenantID, n.StoreID, nullStr(n.CustomerID), n.NoteNumber, n.NoteDate,
		n.AmountPaise, n.TaxPaise, n.TotalPaise, nullStr(n.Reason))
	if err != nil {
		return "", fmt.Errorf("save credit note: %w", err)
	}
	return n.ID, nil
}

func (s *Service) DeleteCreditNote(id string) error {
	_, err := s.db.Exec(`DELETE FROM credit_notes WHERE id = ?`, id)
	return err
}

// ─── Customer Challan ───────────────────────────────────────────────────────

func (s *Service) ListChallans(status string) ([]models.CustomerChallan, error) {
	q := `SELECT id, tenant_id, store_id, COALESCE(customer_id,''), challan_number, challan_date,
		status, COALESCE(invoice_id,''), COALESCE(notes,'')
		FROM customer_challans WHERE tenant_id = ?`
	args := []interface{}{s.tenantID()}

	if status != "" {
		q += ` AND status = ?`
		args = append(args, status)
	}
	q += ` ORDER BY challan_date DESC`

	rows, err := s.db.Query(q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []models.CustomerChallan
	for rows.Next() {
		var c models.CustomerChallan
		if err := rows.Scan(&c.ID, &c.TenantID, &c.StoreID, &c.CustomerID, &c.ChallanNumber,
			&c.ChallanDate, &c.Status, &c.InvoiceID, &c.Notes); err != nil {
			return nil, err
		}
		list = append(list, c)
	}
	return list, nil
}

func (s *Service) SaveChallan(ch models.CustomerChallan, items []models.CustomerChallanItem) (string, error) {
	tenantID := s.tenantID()
	storeID := s.storeID()

	tx, err := s.db.Begin()
	if err != nil {
		return "", err
	}
	defer tx.Rollback()

	if ch.ID == "" {
		ch.ID = uuid.New().String()
		ch.ChallanNumber = fmt.Sprintf("DC-%s-%06d", time.Now().Format("0601"), s.nextSeq(tx, "customer_challans", tenantID))
	}
	ch.TenantID = tenantID
	ch.StoreID = storeID

	_, err = tx.Exec(`INSERT INTO customer_challans (id, tenant_id, store_id, customer_id, challan_number, challan_date, status, invoice_id, notes, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
		ON CONFLICT(id) DO UPDATE SET
			customer_id=excluded.customer_id, challan_date=excluded.challan_date, status=excluded.status,
			invoice_id=excluded.invoice_id, notes=excluded.notes`,
		ch.ID, ch.TenantID, ch.StoreID, nullStr(ch.CustomerID), ch.ChallanNumber,
		ch.ChallanDate, ch.Status, nullStr(ch.InvoiceID), nullStr(ch.Notes))
	if err != nil {
		return "", fmt.Errorf("save challan: %w", err)
	}

	tx.Exec(`DELETE FROM customer_challan_items WHERE challan_id = ?`, ch.ID)
	for _, item := range items {
		if item.ID == "" {
			item.ID = uuid.New().String()
		}
		_, err = tx.Exec(`INSERT INTO customer_challan_items (id, challan_id, product_id, quantity_millis, unit_price_paise)
			VALUES (?, ?, ?, ?, ?)`,
			item.ID, ch.ID, item.ProductID, item.QuantityMillis, item.UnitPricePaise)
		if err != nil {
			return "", fmt.Errorf("save challan item: %w", err)
		}
	}

	return ch.ID, tx.Commit()
}

func (s *Service) DeleteChallan(id string) error {
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	if _, err = tx.Exec(`DELETE FROM customer_challan_items WHERE challan_id = ?`, id); err != nil {
		tx.Rollback()
		return err
	}
	if _, err = tx.Exec(`DELETE FROM customer_challans WHERE id = ?`, id); err != nil {
		tx.Rollback()
		return err
	}
	return tx.Commit()
}

// ─── Quotation ──────────────────────────────────────────────────────────────

func (s *Service) ListQuotations(status string) ([]models.Quotation, error) {
	q := `SELECT id, tenant_id, store_id, COALESCE(customer_id,''), quotation_number, quotation_date,
		COALESCE(valid_until,''), status, subtotal_paise, discount_paise, tax_paise, total_paise, COALESCE(notes,'')
		FROM quotations WHERE tenant_id = ?`
	args := []interface{}{s.tenantID()}

	if status != "" {
		q += ` AND status = ?`
		args = append(args, status)
	}
	q += ` ORDER BY quotation_date DESC`

	rows, err := s.db.Query(q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []models.Quotation
	for rows.Next() {
		var qt models.Quotation
		if err := rows.Scan(&qt.ID, &qt.TenantID, &qt.StoreID, &qt.CustomerID, &qt.QuotationNumber,
			&qt.QuotationDate, &qt.ValidUntil, &qt.Status, &qt.SubtotalPaise, &qt.DiscountPaise,
			&qt.TaxPaise, &qt.TotalPaise, &qt.Notes); err != nil {
			return nil, err
		}
		list = append(list, qt)
	}
	return list, nil
}

func (s *Service) SaveQuotation(qt models.Quotation, items []models.QuotationItem) (string, error) {
	tenantID := s.tenantID()
	storeID := s.storeID()

	tx, err := s.db.Begin()
	if err != nil {
		return "", err
	}
	defer tx.Rollback()

	if qt.ID == "" {
		qt.ID = uuid.New().String()
		qt.QuotationNumber = fmt.Sprintf("QT-%s-%06d", time.Now().Format("0601"), s.nextSeq(tx, "quotations", tenantID))
	}
	qt.TenantID = tenantID
	qt.StoreID = storeID

	_, err = tx.Exec(`INSERT INTO quotations (id, tenant_id, store_id, customer_id, quotation_number, quotation_date, valid_until, status, subtotal_paise, discount_paise, tax_paise, total_paise, notes, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
		ON CONFLICT(id) DO UPDATE SET
			customer_id=excluded.customer_id, quotation_date=excluded.quotation_date, valid_until=excluded.valid_until,
			status=excluded.status, subtotal_paise=excluded.subtotal_paise, discount_paise=excluded.discount_paise,
			tax_paise=excluded.tax_paise, total_paise=excluded.total_paise, notes=excluded.notes, updated_at=datetime('now')`,
		qt.ID, qt.TenantID, qt.StoreID, nullStr(qt.CustomerID), qt.QuotationNumber,
		qt.QuotationDate, nullStr(qt.ValidUntil), qt.Status, qt.SubtotalPaise, qt.DiscountPaise,
		qt.TaxPaise, qt.TotalPaise, nullStr(qt.Notes))
	if err != nil {
		return "", fmt.Errorf("save quotation: %w", err)
	}

	tx.Exec(`DELETE FROM quotation_items WHERE quotation_id = ?`, qt.ID)
	for _, item := range items {
		if item.ID == "" {
			item.ID = uuid.New().String()
		}
		_, err = tx.Exec(`INSERT INTO quotation_items (id, quotation_id, product_id, quantity_millis, unit_price_paise, discount_paise, tax_percent, total_paise)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
			item.ID, qt.ID, item.ProductID, item.QuantityMillis, item.UnitPricePaise, item.DiscountPaise, item.TaxPercent, item.TotalPaise)
		if err != nil {
			return "", fmt.Errorf("save quotation item: %w", err)
		}
	}

	return qt.ID, tx.Commit()
}

func (s *Service) DeleteQuotation(id string) error {
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	if _, err = tx.Exec(`DELETE FROM quotation_items WHERE quotation_id = ?`, id); err != nil {
		tx.Rollback()
		return err
	}
	if _, err = tx.Exec(`DELETE FROM quotations WHERE id = ?`, id); err != nil {
		tx.Rollback()
		return err
	}
	return tx.Commit()
}

// ─── Cheque Tracking ────────────────────────────────────────────────────────

func (s *Service) ListCheques(status string) ([]models.Cheque, error) {
	q := `SELECT id, tenant_id, cheque_number, cheque_date, COALESCE(bank_name,''),
		COALESCE(party_type,''), COALESCE(party_id,''), COALESCE(party_name,''),
		direction, amount_paise, status, COALESCE(reference_type,''), COALESCE(reference_id,''),
		COALESCE(cleared_date,''), COALESCE(notes,'')
		FROM cheques WHERE tenant_id = ?`
	args := []interface{}{s.tenantID()}

	if status != "" {
		q += ` AND status = ?`
		args = append(args, status)
	}
	q += ` ORDER BY cheque_date DESC`

	rows, err := s.db.Query(q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []models.Cheque
	for rows.Next() {
		var c models.Cheque
		if err := rows.Scan(&c.ID, &c.TenantID, &c.ChequeNumber, &c.ChequeDate, &c.BankName,
			&c.PartyType, &c.PartyID, &c.PartyName, &c.Direction, &c.AmountPaise, &c.Status,
			&c.ReferenceType, &c.ReferenceID, &c.ClearedDate, &c.Notes); err != nil {
			return nil, err
		}
		list = append(list, c)
	}
	return list, nil
}

func (s *Service) SaveCheque(c models.Cheque) (string, error) {
	if c.ID == "" {
		c.ID = uuid.New().String()
	}
	c.TenantID = s.tenantID()

	_, err := s.db.Exec(`INSERT INTO cheques (id, tenant_id, cheque_number, cheque_date, bank_name, party_type, party_id, party_name, direction, amount_paise, status, reference_type, reference_id, cleared_date, notes, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
		ON CONFLICT(id) DO UPDATE SET
			cheque_number=excluded.cheque_number, cheque_date=excluded.cheque_date, bank_name=excluded.bank_name,
			party_type=excluded.party_type, party_id=excluded.party_id, party_name=excluded.party_name,
			direction=excluded.direction, amount_paise=excluded.amount_paise, status=excluded.status,
			reference_type=excluded.reference_type, reference_id=excluded.reference_id,
			cleared_date=excluded.cleared_date, notes=excluded.notes, updated_at=datetime('now')`,
		c.ID, c.TenantID, c.ChequeNumber, c.ChequeDate, nullStr(c.BankName),
		nullStr(c.PartyType), nullStr(c.PartyID), nullStr(c.PartyName), c.Direction,
		c.AmountPaise, c.Status, nullStr(c.ReferenceType), nullStr(c.ReferenceID),
		nullStr(c.ClearedDate), nullStr(c.Notes))
	if err != nil {
		return "", fmt.Errorf("save cheque: %w", err)
	}
	return c.ID, nil
}

func (s *Service) UpdateChequeStatus(id string, status string, clearedDate string) error {
	_, err := s.db.Exec(`UPDATE cheques SET status = ?, cleared_date = ?, updated_at = datetime('now') WHERE id = ?`,
		status, nullStr(clearedDate), id)
	return err
}

// ─── Helpers ────────────────────────────────────────────────────────────────

func (s *Service) nextSeq(tx *sql.Tx, table string, tenantID string) int {
	var count int
	tx.QueryRow(fmt.Sprintf("SELECT COUNT(*) + 1 FROM %s WHERE tenant_id = ?", table), tenantID).Scan(&count)
	return count
}

func (s *Service) nextSeqSimple(table string) int {
	var count int
	s.db.QueryRow(fmt.Sprintf("SELECT COUNT(*) + 1 FROM %s WHERE tenant_id = ?", table), s.tenantID()).Scan(&count)
	return count
}
