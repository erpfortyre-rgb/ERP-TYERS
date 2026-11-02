package tools

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

// ─── Complaints ────────────────────────────────────────────────────────────

func (s *Service) ListComplaints(status string) ([]models.Complaint, error) {
	q := `SELECT id, tenant_id, store_id, COALESCE(customer_id,''), COALESCE(customer_name,''),
		COALESCE(phone,''), COALESCE(vehicle_number,''), COALESCE(complaint_type,''),
		COALESCE(description,''), status, COALESCE(resolution,''), created_at, updated_at
		FROM complaints WHERE tenant_id = ?`
	args := []interface{}{s.tenantID()}

	if status != "" {
		q += ` AND status = ?`
		args = append(args, status)
	}
	q += ` ORDER BY created_at DESC`

	rows, err := s.db.Query(q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []models.Complaint
	for rows.Next() {
		var c models.Complaint
		if err := rows.Scan(&c.ID, &c.TenantID, &c.StoreID, &c.CustomerID, &c.CustomerName,
			&c.Phone, &c.VehicleNumber, &c.ComplaintType, &c.Description, &c.Status,
			&c.Resolution, &c.CreatedAt, &c.UpdatedAt); err != nil {
			return nil, err
		}
		list = append(list, c)
	}
	return list, nil
}

func (s *Service) SaveComplaint(c models.Complaint) (string, error) {
	if c.ID == "" {
		c.ID = uuid.New().String()
	}
	c.TenantID = s.tenantID()
	c.StoreID = s.storeID()

	_, err := s.db.Exec(`INSERT INTO complaints (id, tenant_id, store_id, customer_id, customer_name, phone, vehicle_number, complaint_type, description, status, resolution, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
		ON CONFLICT(id) DO UPDATE SET
			customer_id=excluded.customer_id, customer_name=excluded.customer_name, phone=excluded.phone,
			vehicle_number=excluded.vehicle_number, complaint_type=excluded.complaint_type,
			description=excluded.description, status=excluded.status, resolution=excluded.resolution,
			updated_at=datetime('now')`,
		c.ID, c.TenantID, c.StoreID, nullStr(c.CustomerID), nullStr(c.CustomerName),
		nullStr(c.Phone), nullStr(c.VehicleNumber), nullStr(c.ComplaintType),
		nullStr(c.Description), c.Status, nullStr(c.Resolution))
	if err != nil {
		return "", fmt.Errorf("save complaint: %w", err)
	}
	return c.ID, nil
}

func (s *Service) DeleteComplaint(id string) error {
	_, err := s.db.Exec(`DELETE FROM complaints WHERE id = ?`, id)
	return err
}

// ─── Service Reminders ─────────────────────────────────────────────────────

func (s *Service) ListServiceReminders(status string) ([]models.ServiceReminder, error) {
	q := `SELECT id, tenant_id, COALESCE(customer_id,''), COALESCE(customer_name,''),
		COALESCE(phone,''), COALESCE(vehicle_number,''), COALESCE(service_type,''),
		reminder_date, status, COALESCE(notes,'')
		FROM service_reminders WHERE tenant_id = ?`
	args := []interface{}{s.tenantID()}

	if status != "" {
		q += ` AND status = ?`
		args = append(args, status)
	}
	q += ` ORDER BY reminder_date DESC`

	rows, err := s.db.Query(q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []models.ServiceReminder
	for rows.Next() {
		var r models.ServiceReminder
		if err := rows.Scan(&r.ID, &r.TenantID, &r.CustomerID, &r.CustomerName,
			&r.Phone, &r.VehicleNumber, &r.ServiceType, &r.ReminderDate, &r.Status, &r.Notes); err != nil {
			return nil, err
		}
		list = append(list, r)
	}
	return list, nil
}

func (s *Service) SaveServiceReminder(r models.ServiceReminder) (string, error) {
	if r.ID == "" {
		r.ID = uuid.New().String()
	}
	r.TenantID = s.tenantID()

	_, err := s.db.Exec(`INSERT INTO service_reminders (id, tenant_id, customer_id, customer_name, phone, vehicle_number, service_type, reminder_date, status, notes, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
		ON CONFLICT(id) DO UPDATE SET
			customer_id=excluded.customer_id, customer_name=excluded.customer_name, phone=excluded.phone,
			vehicle_number=excluded.vehicle_number, service_type=excluded.service_type,
			reminder_date=excluded.reminder_date, status=excluded.status, notes=excluded.notes`,
		r.ID, r.TenantID, nullStr(r.CustomerID), nullStr(r.CustomerName),
		nullStr(r.Phone), nullStr(r.VehicleNumber), nullStr(r.ServiceType),
		r.ReminderDate, r.Status, nullStr(r.Notes))
	if err != nil {
		return "", fmt.Errorf("save service reminder: %w", err)
	}
	return r.ID, nil
}

func (s *Service) DeleteServiceReminder(id string) error {
	_, err := s.db.Exec(`DELETE FROM service_reminders WHERE id = ?`, id)
	return err
}

// ─── Message Templates ─────────────────────────────────────────────────────

func (s *Service) ListMessageTemplates() ([]models.MessageTemplate, error) {
	rows, err := s.db.Query(`SELECT id, tenant_id, name, template_type, content, is_active
		FROM message_templates WHERE tenant_id = ? ORDER BY name`, s.tenantID())
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []models.MessageTemplate
	for rows.Next() {
		var t models.MessageTemplate
		if err := rows.Scan(&t.ID, &t.TenantID, &t.Name, &t.TemplateType, &t.Content, &t.IsActive); err != nil {
			return nil, err
		}
		list = append(list, t)
	}
	return list, nil
}

func (s *Service) SaveMessageTemplate(t models.MessageTemplate) (string, error) {
	if t.ID == "" {
		t.ID = uuid.New().String()
	}
	t.TenantID = s.tenantID()

	_, err := s.db.Exec(`INSERT INTO message_templates (id, tenant_id, name, template_type, content, is_active, created_at)
		VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
		ON CONFLICT(id) DO UPDATE SET
			name=excluded.name, template_type=excluded.template_type, content=excluded.content, is_active=excluded.is_active`,
		t.ID, t.TenantID, t.Name, t.TemplateType, t.Content, t.IsActive)
	if err != nil {
		return "", fmt.Errorf("save message template: %w", err)
	}
	return t.ID, nil
}

func (s *Service) DeleteMessageTemplate(id string) error {
	_, err := s.db.Exec(`DELETE FROM message_templates WHERE id = ?`, id)
	return err
}

// ─── Stock Adjustment ──────────────────────────────────────────────────────

func (s *Service) AdjustStock(productID string, newQtyMillis int64, reason string) error {
	storeID := s.storeID()

	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	var currentQty int64
	err = tx.QueryRow(`SELECT COALESCE(quantity_millis, 0) FROM local_stock WHERE product_id = ?`, productID).Scan(&currentQty)
	if err != nil && err != sql.ErrNoRows {
		return fmt.Errorf("read current stock: %w", err)
	}

	diff := newQtyMillis - currentQty

	_, err = tx.Exec(`INSERT INTO local_stock (product_id, store_id, quantity_millis, updated_at)
		VALUES (?, ?, ?, datetime('now'))
		ON CONFLICT(product_id) DO UPDATE SET quantity_millis = ?, updated_at = datetime('now')`,
		productID, storeID, newQtyMillis, newQtyMillis)
	if err != nil {
		return fmt.Errorf("update local stock: %w", err)
	}

	_, err = tx.Exec(`INSERT INTO stock_movements (id, product_id, store_id, movement_type, quantity_millis, reference_type, reference_id, created_at)
		VALUES (?, ?, ?, 'ADJUSTMENT', ?, 'ADJUSTMENT', ?, datetime('now'))`,
		uuid.New().String(), productID, storeID, diff, reason)
	if err != nil {
		return fmt.Errorf("insert stock movement: %w", err)
	}

	return tx.Commit()
}

// ─── Stock Transfer ────────────────────────────────────────────────────────

func (s *Service) ListStockTransfers(status string) ([]models.StockTransfer, error) {
	q := `SELECT id, tenant_id, from_store_id, to_store_id, transfer_number, transfer_date,
		status, COALESCE(notes,'')
		FROM stock_transfers WHERE tenant_id = ?`
	args := []interface{}{s.tenantID()}

	if status != "" {
		q += ` AND status = ?`
		args = append(args, status)
	}
	q += ` ORDER BY transfer_date DESC`

	rows, err := s.db.Query(q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []models.StockTransfer
	for rows.Next() {
		var t models.StockTransfer
		if err := rows.Scan(&t.ID, &t.TenantID, &t.FromStoreID, &t.ToStoreID,
			&t.TransferNumber, &t.TransferDate, &t.Status, &t.Notes); err != nil {
			return nil, err
		}
		list = append(list, t)
	}
	return list, nil
}

func (s *Service) SaveStockTransfer(t models.StockTransfer, items []models.StockTransferItem) (string, error) {
	tenantID := s.tenantID()
	storeID := s.storeID()

	tx, err := s.db.Begin()
	if err != nil {
		return "", err
	}
	defer tx.Rollback()

	if t.ID == "" {
		t.ID = uuid.New().String()
		var count int
		tx.QueryRow(fmt.Sprintf("SELECT COUNT(*) + 1 FROM stock_transfers WHERE tenant_id = ?"), tenantID).Scan(&count)
		t.TransferNumber = fmt.Sprintf("ST-%s-%06d", time.Now().Format("0601"), count)
	}
	t.TenantID = tenantID
	if t.FromStoreID == "" {
		t.FromStoreID = storeID
	}
	if t.ToStoreID == "" {
		t.ToStoreID = storeID
	}
	if t.Status == "" {
		t.Status = "DRAFT"
	}
	if t.TransferDate == "" {
		t.TransferDate = time.Now().Format("2006-01-02")
	}

	_, err = tx.Exec(`INSERT INTO stock_transfers (id, tenant_id, from_store_id, to_store_id, transfer_number, transfer_date, status, notes, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
		ON CONFLICT(id) DO UPDATE SET
			from_store_id=excluded.from_store_id, to_store_id=excluded.to_store_id,
			transfer_date=excluded.transfer_date, status=excluded.status, notes=excluded.notes`,
		t.ID, t.TenantID, t.FromStoreID, t.ToStoreID, t.TransferNumber,
		t.TransferDate, t.Status, nullStr(t.Notes))
	if err != nil {
		return "", fmt.Errorf("save stock transfer: %w", err)
	}

	tx.Exec(`DELETE FROM stock_transfer_items WHERE transfer_id = ?`, t.ID)
	for _, item := range items {
		if item.ID == "" {
			item.ID = uuid.New().String()
		}
		_, err = tx.Exec(`INSERT INTO stock_transfer_items (id, transfer_id, product_id, quantity_millis)
			VALUES (?, ?, ?, ?)`,
			item.ID, t.ID, item.ProductID, item.QuantityMillis)
		if err != nil {
			return "", fmt.Errorf("save transfer item: %w", err)
		}
	}

	return t.ID, tx.Commit()
}

// ─── Vouchers ──────────────────────────────────────────────────────────────

func (s *Service) ListVouchers(vtype string) ([]models.Voucher, error) {
	q := `SELECT id, tenant_id, store_id, voucher_type, voucher_number,
		COALESCE(party_type,''), COALESCE(party_id,''), amount_paise, method,
		COALESCE(reference_number,''), COALESCE(narration,''), COALESCE(register_id,''), created_at
		FROM vouchers WHERE tenant_id = ?`
	args := []interface{}{s.tenantID()}

	if vtype != "" {
		q += ` AND voucher_type = ?`
		args = append(args, vtype)
	}
	q += ` ORDER BY created_at DESC`

	rows, err := s.db.Query(q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []models.Voucher
	for rows.Next() {
		var v models.Voucher
		if err := rows.Scan(&v.ID, &v.TenantID, &v.StoreID, &v.VoucherType, &v.VoucherNumber,
			&v.PartyType, &v.PartyID, &v.AmountPaise, &v.Method,
			&v.ReferenceNumber, &v.Narration, &v.RegisterID, &v.CreatedAt); err != nil {
			return nil, err
		}
		list = append(list, v)
	}
	return list, nil
}

func (s *Service) SaveVoucher(v models.Voucher) (string, error) {
	if v.ID == "" {
		v.ID = uuid.New().String()
		prefix := "RV"
		if v.VoucherType == "PAYMENT" {
			prefix = "PV"
		}
		v.VoucherNumber = fmt.Sprintf("%s-%s-%06d", prefix, time.Now().Format("0601"), s.nextSeqSimple("vouchers"))
	}
	v.TenantID = s.tenantID()
	v.StoreID = s.storeID()

	_, err := s.db.Exec(`INSERT INTO vouchers (id, tenant_id, store_id, voucher_type, voucher_number, party_type, party_id, amount_paise, method, reference_number, narration, register_id, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
		ON CONFLICT(id) DO UPDATE SET
			voucher_type=excluded.voucher_type, party_type=excluded.party_type, party_id=excluded.party_id,
			amount_paise=excluded.amount_paise, method=excluded.method,
			reference_number=excluded.reference_number, narration=excluded.narration, register_id=excluded.register_id`,
		v.ID, v.TenantID, v.StoreID, v.VoucherType, v.VoucherNumber,
		nullStr(v.PartyType), nullStr(v.PartyID), v.AmountPaise, v.Method,
		nullStr(v.ReferenceNumber), nullStr(v.Narration), nullStr(v.RegisterID))
	if err != nil {
		return "", fmt.Errorf("save voucher: %w", err)
	}
	return v.ID, nil
}

func (s *Service) DeleteVoucher(id string) error {
	_, err := s.db.Exec(`DELETE FROM vouchers WHERE id = ?`, id)
	return err
}

// ─── BOM Kits ──────────────────────────────────────────────────────────────

func (s *Service) ListBOMKits() ([]models.BOMKit, error) {
	rows, err := s.db.Query(`SELECT id, parent_product_id, name, is_active, created_at
		FROM bom_kits ORDER BY name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []models.BOMKit
	for rows.Next() {
		var k models.BOMKit
		if err := rows.Scan(&k.ID, &k.ParentProductID, &k.Name, &k.IsActive, &k.CreatedAt); err != nil {
			return nil, err
		}
		list = append(list, k)
	}
	return list, nil
}

func (s *Service) SaveBOMKit(kit models.BOMKit, components []models.BOMComponent) (string, error) {
	tx, err := s.db.Begin()
	if err != nil {
		return "", err
	}
	defer tx.Rollback()

	if kit.ID == "" {
		kit.ID = uuid.New().String()
	}

	_, err = tx.Exec(`INSERT INTO bom_kits (id, parent_product_id, name, is_active, created_at)
		VALUES (?, ?, ?, ?, datetime('now'))
		ON CONFLICT(id) DO UPDATE SET
			parent_product_id=excluded.parent_product_id, name=excluded.name, is_active=excluded.is_active`,
		kit.ID, kit.ParentProductID, kit.Name, kit.IsActive)
	if err != nil {
		return "", fmt.Errorf("save bom kit: %w", err)
	}

	tx.Exec(`DELETE FROM bom_components WHERE kit_id = ?`, kit.ID)
	for _, comp := range components {
		if comp.ID == "" {
			comp.ID = uuid.New().String()
		}
		_, err = tx.Exec(`INSERT INTO bom_components (id, kit_id, product_id, quantity_millis, price_tier, sort_order)
			VALUES (?, ?, ?, ?, ?, ?)`,
			comp.ID, kit.ID, comp.ProductID, comp.QuantityMillis, comp.PriceTier, comp.SortOrder)
		if err != nil {
			return "", fmt.Errorf("save bom component: %w", err)
		}
	}

	return kit.ID, tx.Commit()
}

func (s *Service) DeleteBOMKit(id string) error {
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	tx.Exec(`DELETE FROM bom_components WHERE kit_id = ?`, id)
	_, err = tx.Exec(`DELETE FROM bom_kits WHERE id = ?`, id)
	if err != nil {
		return err
	}
	return tx.Commit()
}

// ─── Stock Price Update ────────────────────────────────────────────────────

func (s *Service) UpdateProductPrice(productID string, tier string, newPricePaise int64) error {
	_, err := s.db.Exec(`INSERT INTO product_prices (id, product_id, tier, price_paise, valid_from, created_at)
		VALUES (?, ?, ?, ?, date('now'), datetime('now'))`,
		uuid.New().String(), productID, tier, newPricePaise)
	if err != nil {
		return fmt.Errorf("update product price: %w", err)
	}
	return nil
}

// ─── Settings ──────────────────────────────────────────────────────────────

func (s *Service) GetSettings() (map[string]string, error) {
	rows, err := s.db.Query(`SELECT key, value FROM settings`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make(map[string]string)
	for rows.Next() {
		var key, value string
		if err := rows.Scan(&key, &value); err != nil {
			return nil, err
		}
		result[key] = value
	}
	return result, nil
}

func (s *Service) SaveSetting(key, value string) error {
	_, err := s.db.Exec(`INSERT INTO settings (key, value, updated_at)
		VALUES (?, ?, datetime('now'))
		ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=datetime('now')`,
		key, value)
	if err != nil {
		return fmt.Errorf("save setting: %w", err)
	}
	return nil
}

// ─── Helpers ───────────────────────────────────────────────────────────────

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
