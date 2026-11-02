package printing

import (
	"context"
	"database/sql"
	"fmt"
	"sync"

	"erp-pos/internal/models"

	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

type ConnectionType string

const (
	ConnUSB    ConnectionType = "USB"
	ConnTCP    ConnectionType = "TCP"
	ConnWinRAW ConnectionType = "WIN_RAW"
)

type PrinterConfig struct {
	Name           string         `json:"name"`
	ConnectionType ConnectionType `json:"connectionType"`
	Address        string         `json:"address"`
	Port           int            `json:"port"`
	PaperWidth     int            `json:"paperWidth"`
	IsDefault      bool           `json:"isDefault"`
}

type Service struct {
	db     *sql.DB
	ctx    context.Context
	queue  *Queue
	config *PrinterConfig
	mu     sync.RWMutex
}

func NewService(db *sql.DB) *Service {
	s := &Service{
		db: db,
		config: &PrinterConfig{
			Name:           "Default Thermal",
			ConnectionType: ConnWinRAW,
			PaperWidth:     80,
			IsDefault:      true,
		},
	}
	s.queue = NewQueue(s)
	return s
}

func (s *Service) SetContext(ctx context.Context) {
	s.ctx = ctx
	s.queue.Start(ctx)
}

func (s *Service) Shutdown() {
	s.queue.Stop()
}

func (s *Service) emitEvent(event string, data interface{}) {
	if s.ctx != nil {
		wailsRuntime.EventsEmit(s.ctx, event, data)
	}
}

func (s *Service) GetConfig() *PrinterConfig {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.config
}

func (s *Service) UpdateConfig(cfg PrinterConfig) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.config = &cfg
	if s.db != nil {
		s.db.Exec(`INSERT INTO settings (key, value, updated_at) VALUES ('printer_name', ?, datetime('now'))
			ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=datetime('now')`, cfg.Name)
		s.db.Exec(`INSERT INTO settings (key, value, updated_at) VALUES ('printer_conn_type', ?, datetime('now'))
			ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=datetime('now')`, string(cfg.ConnectionType))
		s.db.Exec(`INSERT INTO settings (key, value, updated_at) VALUES ('printer_address', ?, datetime('now'))
			ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=datetime('now')`, cfg.Address)
	}
}

func (s *Service) LoadConfig() {
	if s.db == nil {
		return
	}
	var name, connType, addr string
	s.db.QueryRow(`SELECT value FROM settings WHERE key = 'printer_name'`).Scan(&name)
	s.db.QueryRow(`SELECT value FROM settings WHERE key = 'printer_conn_type'`).Scan(&connType)
	s.db.QueryRow(`SELECT value FROM settings WHERE key = 'printer_address'`).Scan(&addr)

	s.mu.Lock()
	defer s.mu.Unlock()
	if name != "" {
		s.config.Name = name
	}
	if connType != "" {
		s.config.ConnectionType = ConnectionType(connType)
	}
	if addr != "" {
		s.config.Address = addr
	}
}

type PrintResult struct {
	JobID   string `json:"jobId"`
	Success bool   `json:"success"`
	Error   string `json:"error,omitempty"`
}

func (s *Service) PrintReceipt(invoice *models.InvoiceWithDetails) (*PrintResult, error) {
	if invoice == nil {
		return nil, fmt.Errorf("invoice is nil")
	}

	storeName := "Shiv Shankar Tyres"
	storeAddr := "Mancherial, Telangana"
	storePhone := "+91 7877288109"
	if s.db != nil {
		s.db.QueryRow(`SELECT t.name FROM tenants t LIMIT 1`).Scan(&storeName)
		s.db.QueryRow(`SELECT COALESCE(t.address,'') FROM tenants t LIMIT 1`).Scan(&storeAddr)
		s.db.QueryRow(`SELECT COALESCE(t.phone,'') FROM tenants t LIMIT 1`).Scan(&storePhone)
	}

	builder := NewESCPOSBuilder(s.config.PaperWidth)
	builder.Init()
	builder.CenterBold(storeName)
	builder.CenterText(storeAddr)
	if storePhone != "" {
		builder.CenterText("Ph: " + storePhone)
	}
	builder.LineFeed()
	builder.Separator('-')
	builder.LeftRight("Invoice:", invoice.InvoiceNumber)
	builder.LeftRight("Date:", invoice.CreatedAt)
	if invoice.CustomerName != "" && invoice.CustomerName != "Walk-in" {
		builder.LeftRight("Customer:", invoice.CustomerName)
	}
	builder.Separator('-')

	builder.ItemHeader()
	for _, item := range invoice.Items {
		qty := float64(item.QuantityMillis) / 1000.0
		price := float64(item.UnitPricePaise) / 100.0
		total := float64(item.TotalPaise) / 100.0
		builder.ItemLine(item.ProductName, qty, price, total)
	}
	builder.Separator('-')

	builder.LeftRight("Subtotal:", formatRupees(invoice.SubtotalPaise))
	if invoice.DiscountPaise > 0 {
		builder.LeftRight("Discount:", "-"+formatRupees(invoice.DiscountPaise))
	}
	if invoice.TaxPaise > 0 {
		builder.LeftRight("GST:", formatRupees(invoice.TaxPaise))
	}
	if invoice.RoundoffPaise != 0 {
		builder.LeftRight("Round Off:", formatRupees(invoice.RoundoffPaise))
	}
	builder.Separator('=')
	builder.LeftRightBold("TOTAL:", formatRupees(invoice.TotalPaise))
	builder.Separator('=')

	for _, pay := range invoice.Payments {
		builder.LeftRight("Paid ("+pay.Method+"):", formatRupees(pay.AmountPaise))
	}

	builder.LineFeed()
	builder.CenterText("Thank you for your business!")
	builder.CenterText("Visit again!")
	builder.LineFeed()
	builder.Cut()

	data := builder.Bytes()

	job := &PrintJob{
		ID:       invoice.ID,
		Type:     JobReceipt,
		Data:     data,
		Callback: s.onJobComplete,
	}

	s.queue.Enqueue(job)

	return &PrintResult{
		JobID:   job.ID,
		Success: true,
	}, nil
}

func (s *Service) TestPrint() (*PrintResult, error) {
	builder := NewESCPOSBuilder(s.config.PaperWidth)
	builder.Init()
	builder.CenterBold("*** TEST PRINT ***")
	builder.LineFeed()
	builder.CenterText("Shiv Shankar Tyres")
	builder.CenterText("ERP System")
	builder.LineFeed()
	builder.LeftRight("Printer:", s.config.Name)
	builder.LeftRight("Connection:", string(s.config.ConnectionType))
	builder.LeftRight("Paper Width:", fmt.Sprintf("%dmm", s.config.PaperWidth))
	builder.LineFeed()
	builder.CenterText("Printer is working correctly!")
	builder.LineFeed()
	builder.Cut()

	data := builder.Bytes()

	job := &PrintJob{
		ID:       "test-print",
		Type:     JobReceipt,
		Data:     data,
		Callback: s.onJobComplete,
	}

	s.queue.Enqueue(job)

	return &PrintResult{
		JobID:   job.ID,
		Success: true,
	}, nil
}

func (s *Service) GetQueueStatus() QueueStatus {
	return s.queue.Status()
}

func (s *Service) onJobComplete(job *PrintJob, err error) {
	result := PrintResult{
		JobID:   job.ID,
		Success: err == nil,
	}
	if err != nil {
		result.Error = err.Error()
	}
	s.emitEvent("print:complete", result)
}

func formatRupees(paise int64) string {
	sign := ""
	if paise < 0 {
		sign = "-"
		paise = -paise
	}
	rupees := paise / 100
	p := paise % 100
	return fmt.Sprintf("%s₹%d.%02d", sign, rupees, p)
}
