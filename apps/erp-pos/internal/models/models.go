package models

type Tenant struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	GSTIN   string `json:"gstin"`
	Address string `json:"address"`
	Phone   string `json:"phone"`
	Email   string `json:"email"`
}

type Store struct {
	ID       string `json:"id"`
	TenantID string `json:"tenantId"`
	Name     string `json:"name"`
	Code     string `json:"code"`
	Address  string `json:"address"`
	Phone    string `json:"phone"`
	GSTIN    string `json:"gstin"`
	IsActive bool   `json:"isActive"`
}

type DeviceIdentity struct {
	ID             string `json:"id"`
	StoreID        string `json:"storeId"`
	DeviceName     string `json:"deviceName"`
	InvoicePrefix  string `json:"invoicePrefix"`
	NextInvoiceSeq int    `json:"nextInvoiceSeq"`
}

type User struct {
	ID       string `json:"id"`
	TenantID string `json:"tenantId"`
	StoreID  string `json:"storeId"`
	RoleID   string `json:"roleId"`
	Name     string `json:"name"`
	Email    string `json:"email"`
	Phone    string `json:"phone"`
	IsActive bool   `json:"isActive"`
}

type Category struct {
	ID                      string  `json:"id"`
	TenantID                string  `json:"tenantId"`
	Name                    string  `json:"name"`
	ParentID                string  `json:"parentId"`
	PurchaseDiscountPercent float64 `json:"purchaseDiscountPercent"`
	SaleDiscountPercent     float64 `json:"saleDiscountPercent"`
}

type Brand struct {
	ID       string `json:"id"`
	TenantID string `json:"tenantId"`
	Name     string `json:"name"`
}

type Product struct {
	ID          string `json:"id"`
	TenantID    string `json:"tenantId"`
	Name        string `json:"name"`
	SKU         string `json:"sku"`
	Barcode     string `json:"barcode"`
	HSNCode     string `json:"hsnCode"`
	CategoryID  string `json:"categoryId"`
	BrandID     string `json:"brandId"`
	UnitID      string `json:"unitId"`
	TaxPercent  int    `json:"taxPercent"`
	IsActive    bool   `json:"isActive"`
	IsKit                bool   `json:"isKit"`
	Description          string `json:"description"`
	AlertQuantityMillis  int64  `json:"alertQuantityMillis"`
	PurchasePricePaise   int64  `json:"purchasePricePaise"`
	// OS-Books-style Product Master (migrateV6)
	ProductCode      string `json:"productCode"`
	GSTApplicable    bool   `json:"gstApplicable"`
	GroupCode        string `json:"groupCode"`
	GroupName        string `json:"groupName"`
	AutoQtyMillis    int64  `json:"autoQtyMillis"`
	OpeningQtyMillis int64  `json:"openingQtyMillis"`
	ReorderQtyMillis int64  `json:"reorderQtyMillis"`
	IsService        bool   `json:"isService"`
	// "More Info" section
	Size        string `json:"size"`
	Colour      string `json:"colour"`
	ExpiryMonth string `json:"expiryMonth"`
	Location    string `json:"location"`
	Terms       string `json:"terms"`
	ProductTags string `json:"productTags"`
}

type ProductSubItem struct {
	ID        string `json:"id"`
	ProductID string `json:"productId"`
	Name      string `json:"name"`
	Value     string `json:"value"`
	SortOrder int    `json:"sortOrder"`
}

type ProductRawMaterial struct {
	ID        string `json:"id"`
	ProductID string `json:"productId"`
	Name      string `json:"name"`
	QtyMillis int64  `json:"qtyMillis"`
	Unit      string `json:"unit"`
	SortOrder int    `json:"sortOrder"`
}

type ProductPrice struct {
	ID        string `json:"id"`
	ProductID string `json:"productId"`
	Tier      string `json:"tier"`
	PricePaise int   `json:"pricePaise"`
	ValidFrom string `json:"validFrom"`
}

type ProductWithPrices struct {
	Product
	Prices       []ProductPrice `json:"prices"`
	StockQtyMillis int64        `json:"stockQtyMillis"`
	CategoryName string         `json:"categoryName"`
	BrandName    string         `json:"brandName"`
	SubItems     []ProductSubItem     `json:"subItems"`
	RawMaterials []ProductRawMaterial `json:"rawMaterials"`
}

type Customer struct {
	ID               string `json:"id"`
	TenantID         string `json:"tenantId"`
	Name             string `json:"name"`
	Phone            string `json:"phone"`
	Email            string `json:"email"`
	GSTIN            string `json:"gstin"`
	Address          string `json:"address"`
	CreditLimitPaise int64  `json:"creditLimitPaise"`
	IsActive         bool   `json:"isActive"`
	// Parties module (migrateV7)
	BusinessName        string `json:"businessName"`
	ContactID           string `json:"contactId"`
	GroupID             string `json:"groupId"`
	ContactType         string `json:"contactType"`
	AlternatePhone      string `json:"alternatePhone"`
	Landline            string `json:"landline"`
	PayTermDays         int    `json:"payTermDays"`
	OpeningBalancePaise int64  `json:"openingBalancePaise"`
	City                string `json:"city"`
	StateCode           string `json:"stateCode"`
}

type CustomerGroup struct {
	ID                string  `json:"id"`
	TenantID          string  `json:"tenantId"`
	Name              string  `json:"name"`
	CalcPercent       float64 `json:"calcPercent"`
	SellingPriceGroup string  `json:"sellingPriceGroup"`
	IsActive          bool    `json:"isActive"`
}

type Supplier struct {
	ID            string `json:"id"`
	TenantID      string `json:"tenantId"`
	Code          string `json:"code"`
	Name          string `json:"name"`
	ContactPerson string `json:"contactPerson"`
	Phone         string `json:"phone"`
	Email         string `json:"email"`
	GSTIN         string `json:"gstin"`
	Address       string `json:"address"`
	IsActive      bool   `json:"isActive"`
}

type Invoice struct {
	ID             string `json:"id"`
	TenantID       string `json:"tenantId"`
	StoreID        string `json:"storeId"`
	DeviceID       string `json:"deviceId"`
	InvoiceNumber  string `json:"invoiceNumber"`
	CustomerID     string `json:"customerId"`
	CustomerName   string `json:"customerName"`
	Status         string `json:"status"`
	SubtotalPaise  int64  `json:"subtotalPaise"`
	DiscountPaise  int64  `json:"discountPaise"`
	TaxPaise       int64  `json:"taxPaise"`
	RoundoffPaise  int64  `json:"roundoffPaise"`
	TotalPaise     int64  `json:"totalPaise"`
	Notes          string `json:"notes"`
	CreatedAt      string `json:"createdAt"`
}

type InvoiceItem struct {
	ID             string `json:"id"`
	InvoiceID      string `json:"invoiceId"`
	ProductID      string `json:"productId"`
	ProductName    string `json:"productName"`
	HSNCode        string `json:"hsnCode"`
	QuantityMillis int64  `json:"quantityMillis"`
	PriceTier      string `json:"priceTier"`
	UnitPricePaise int64  `json:"unitPricePaise"`
	DiscountPaise  int64  `json:"discountPaise"`
	TaxPercent     int    `json:"taxPercent"`
	TaxPaise       int64  `json:"taxPaise"`
	TotalPaise     int64  `json:"totalPaise"`
}

type InvoicePayment struct {
	ID              string `json:"id"`
	InvoiceID       string `json:"invoiceId"`
	Method          string `json:"method"`
	AmountPaise     int64  `json:"amountPaise"`
	ReferenceNumber string `json:"referenceNumber"`
	IsVerified      bool   `json:"isVerified"`
}

type InvoiceWithDetails struct {
	Invoice
	Items    []InvoiceItem    `json:"items"`
	Payments []InvoicePayment `json:"payments"`
}

type SaleLineInput struct {
	ProductID      string `json:"productId"`
	ProductName    string `json:"productName"`
	HSNCode        string `json:"hsnCode"`
	QuantityMillis int64  `json:"quantityMillis"`
	PriceTier      string `json:"priceTier"`
	UnitPricePaise int64  `json:"unitPricePaise"`
	DiscountPaise  int64  `json:"discountPaise"`
	TaxPercent     int    `json:"taxPercent"`
}

type PaymentInput struct {
	Method          string `json:"method"`
	AmountPaise     int64  `json:"amountPaise"`
	ReferenceNumber string `json:"referenceNumber"`
}

type SaleDraft struct {
	CustomerID     string          `json:"customerId"`
	Lines          []SaleLineInput `json:"lines"`
	Payments       []PaymentInput  `json:"payments"`
	Notes          string          `json:"notes"`
	Terms          string          `json:"terms"`
	CreatedBy      string          `json:"createdBy"`
	CreatedByEmail string          `json:"createdByEmail"`
}

type DashboardSaleDay struct {
	Date      string `json:"date"`
	SalePaise int64  `json:"salePaise"`
}

type DashboardTopItem struct {
	Name     string `json:"name"`
	Qty      int64  `json:"qty"`
	AmtPaise int64  `json:"amtPaise"`
}

type DashboardStats struct {
	// Today
	TodaySalesCount  int   `json:"todaySalesCount"`
	TodaySalesPaise  int64 `json:"todaySalesPaise"`
	TodayCashPaise   int64 `json:"todayCashPaise"`
	TodayUPIPaise    int64 `json:"todayUpiPaise"`
	TodayCardPaise   int64 `json:"todayCardPaise"`
	TodayCreditPaise int64 `json:"todayCreditPaise"`
	TodayChequePaise int64 `json:"todayChequePaise"`
	TodayBankPaise   int64 `json:"todayBankPaise"`
	// Month
	MonthSalesPaise     int64 `json:"monthSalesPaise"`
	MonthSalesCount     int   `json:"monthSalesCount"`
	PrevMonthSalesPaise int64 `json:"prevMonthSalesPaise"`
	MonthPurchasePaise  int64 `json:"monthPurchasePaise"`
	MonthExpensePaise   int64 `json:"monthExpensePaise"`
	// Outstanding
	TotalReceivablePaise int64 `json:"totalReceivablePaise"`
	TotalPayablePaise    int64 `json:"totalPayablePaise"`
	// Stock
	LowStockCount int `json:"lowStockCount"`
	TotalProducts int `json:"totalProducts"`
	// Chart data (last 30 days)
	SalesByDay []DashboardSaleDay `json:"salesByDay"`
	// Top selling (this month)
	TopItems []DashboardTopItem `json:"topItems"`
}

type StockEntry struct {
	ProductID      string `json:"productId"`
	ProductName    string `json:"productName"`
	SKU            string `json:"sku"`
	Barcode        string `json:"barcode"`
	CategoryName   string `json:"categoryName"`
	BrandName      string `json:"brandName"`
	QuantityMillis int64  `json:"quantityMillis"`
	MRPPaise       int64  `json:"mrpPaise"`
}

// --- V2 Models ---

type Company struct {
	ID              string `json:"id"`
	TenantID        string `json:"tenantId"`
	Name            string `json:"name"`
	ContactPerson   string `json:"contactPerson"`
	Phone           string `json:"phone"`
	Email           string `json:"email"`
	GSTIN           string `json:"gstin"`
	PAN             string `json:"pan"`
	Address         string `json:"address"`
	City            string `json:"city"`
	State           string `json:"state"`
	StateCode       string `json:"stateCode"`
	Pincode         string `json:"pincode"`
	OpeningBalPaise int64  `json:"openingBalancePaise"`
	IsActive        bool   `json:"isActive"`
	CreatedAt       string `json:"createdAt"`
	UpdatedAt       string `json:"updatedAt"`
}

type BankMaster struct {
	ID              string `json:"id"`
	TenantID        string `json:"tenantId"`
	BankName        string `json:"bankName"`
	AccountNumber   string `json:"accountNumber"`
	IFSCCode        string `json:"ifscCode"`
	Branch          string `json:"branch"`
	OpeningBalPaise int64  `json:"openingBalancePaise"`
	BookType        string `json:"bookType"`
	Note            string `json:"note"`
	IsActive        bool   `json:"isActive"`
}

type Employee struct {
	ID               string `json:"id"`
	TenantID         string `json:"tenantId"`
	Name             string `json:"name"`
	Phone            string `json:"phone"`
	Email            string `json:"email"`
	Address          string `json:"address"`
	Designation      string `json:"designation"`
	SalaryPaise      int64  `json:"salaryPaise"`
	JoiningDate      string `json:"joiningDate"`
	PaidHolidayCount int    `json:"paidHolidayCount"`
	IsActive         bool   `json:"isActive"`
}

type ExpenseMaster struct {
	ID       string `json:"id"`
	TenantID string `json:"tenantId"`
	Name     string `json:"name"`
	IsActive bool   `json:"isActive"`
}

type IncomeMaster struct {
	ID       string `json:"id"`
	TenantID string `json:"tenantId"`
	Name     string `json:"name"`
	IsActive bool   `json:"isActive"`
}

type PaymentMaster struct {
	ID       string `json:"id"`
	TenantID string `json:"tenantId"`
	Name     string `json:"name"`
	IsActive bool   `json:"isActive"`
}

type ExpenseEntry struct {
	ID              string `json:"id"`
	TenantID        string `json:"tenantId"`
	StoreID         string `json:"storeId"`
	ExpenseID       string `json:"expenseId"`
	QuantityMillis  int64  `json:"quantityMillis"`
	RatePaise       int64  `json:"ratePaise"`
	AmountPaise     int64  `json:"amountPaise"`
	PaymentMethod   string `json:"paymentMethod"`
	ReferenceNumber string `json:"referenceNumber"`
	Narration       string `json:"narration"`
	EntryDate       string `json:"entryDate"`
	CreatedAt       string `json:"createdAt"`
}

type IncomeEntry struct {
	ID              string `json:"id"`
	TenantID        string `json:"tenantId"`
	StoreID         string `json:"storeId"`
	IncomeID        string `json:"incomeId"`
	QuantityMillis  int64  `json:"quantityMillis"`
	RatePaise       int64  `json:"ratePaise"`
	AmountPaise     int64  `json:"amountPaise"`
	PaymentMethod   string `json:"paymentMethod"`
	ReferenceNumber string `json:"referenceNumber"`
	Narration       string `json:"narration"`
	EntryDate       string `json:"entryDate"`
	CreatedAt       string `json:"createdAt"`
}

type PaymentEntry struct {
	ID              string `json:"id"`
	TenantID        string `json:"tenantId"`
	StoreID         string `json:"storeId"`
	PaymentTypeID   string `json:"paymentTypeId"`
	PartyType       string `json:"partyType"`
	PartyID         string `json:"partyId"`
	AmountPaise     int64  `json:"amountPaise"`
	PaymentMethod   string `json:"paymentMethod"`
	ReferenceNumber string `json:"referenceNumber"`
	Narration       string `json:"narration"`
	EntryDate       string `json:"entryDate"`
}

type PurchaseOrder struct {
	ID            string `json:"id"`
	TenantID      string `json:"tenantId"`
	StoreID       string `json:"storeId"`
	CompanyID     string `json:"companyId"`
	OrderNumber   string `json:"orderNumber"`
	OrderDate     string `json:"orderDate"`
	Status        string `json:"status"`
	SubtotalPaise int64  `json:"subtotalPaise"`
	TaxPaise      int64  `json:"taxPaise"`
	TotalPaise    int64  `json:"totalPaise"`
	Notes         string `json:"notes"`
}

type PurchaseOrderItem struct {
	ID             string `json:"id"`
	OrderID        string `json:"orderId"`
	ProductID      string `json:"productId"`
	QuantityMillis int64  `json:"quantityMillis"`
	UnitPricePaise int64  `json:"unitPricePaise"`
	TaxPercent     int    `json:"taxPercent"`
	TotalPaise     int64  `json:"totalPaise"`
	ReceivedMillis int64  `json:"receivedMillis"`
}

type PurchaseReturn struct {
	ID            string `json:"id"`
	TenantID      string `json:"tenantId"`
	StoreID       string `json:"storeId"`
	PurchaseID    string `json:"purchaseId"`
	CompanyID     string `json:"companyId"`
	ReturnNumber  string `json:"returnNumber"`
	ReturnDate    string `json:"returnDate"`
	SubtotalPaise int64  `json:"subtotalPaise"`
	TaxPaise      int64  `json:"taxPaise"`
	TotalPaise    int64  `json:"totalPaise"`
	Notes         string `json:"notes"`
}

type PurchaseReturnItem struct {
	ID             string `json:"id"`
	ReturnID       string `json:"returnId"`
	ProductID      string `json:"productId"`
	QuantityMillis int64  `json:"quantityMillis"`
	UnitPricePaise int64  `json:"unitPricePaise"`
	TaxPercent     int    `json:"taxPercent"`
	TotalPaise     int64  `json:"totalPaise"`
}

type SaleOrder struct {
	ID            string `json:"id"`
	TenantID      string `json:"tenantId"`
	StoreID       string `json:"storeId"`
	CustomerID    string `json:"customerId"`
	OrderNumber   string `json:"orderNumber"`
	OrderDate     string `json:"orderDate"`
	Status        string `json:"status"`
	SubtotalPaise int64  `json:"subtotalPaise"`
	TaxPaise      int64  `json:"taxPaise"`
	TotalPaise    int64  `json:"totalPaise"`
	Notes         string `json:"notes"`
}

type SaleOrderItem struct {
	ID              string `json:"id"`
	OrderID         string `json:"orderId"`
	ProductID       string `json:"productId"`
	QuantityMillis  int64  `json:"quantityMillis"`
	UnitPricePaise  int64  `json:"unitPricePaise"`
	TaxPercent      int    `json:"taxPercent"`
	TotalPaise      int64  `json:"totalPaise"`
	DeliveredMillis int64  `json:"deliveredMillis"`
}

type SalesReturn struct {
	ID            string `json:"id"`
	TenantID      string `json:"tenantId"`
	StoreID       string `json:"storeId"`
	InvoiceID     string `json:"invoiceId"`
	CustomerID    string `json:"customerId"`
	ReturnNumber  string `json:"returnNumber"`
	ReturnDate    string `json:"returnDate"`
	SubtotalPaise int64  `json:"subtotalPaise"`
	TaxPaise      int64  `json:"taxPaise"`
	TotalPaise    int64  `json:"totalPaise"`
	Notes         string `json:"notes"`
}

type SalesReturnItem struct {
	ID             string `json:"id"`
	ReturnID       string `json:"returnId"`
	ProductID      string `json:"productId"`
	QuantityMillis int64  `json:"quantityMillis"`
	UnitPricePaise int64  `json:"unitPricePaise"`
	TaxPercent     int    `json:"taxPercent"`
	TotalPaise     int64  `json:"totalPaise"`
}

type DebitNote struct {
	ID         string `json:"id"`
	TenantID   string `json:"tenantId"`
	StoreID    string `json:"storeId"`
	CompanyID  string `json:"companyId"`
	NoteNumber string `json:"noteNumber"`
	NoteDate   string `json:"noteDate"`
	AmountPaise int64 `json:"amountPaise"`
	TaxPaise   int64  `json:"taxPaise"`
	TotalPaise int64  `json:"totalPaise"`
	Reason     string `json:"reason"`
}

type CreditNote struct {
	ID         string `json:"id"`
	TenantID   string `json:"tenantId"`
	StoreID    string `json:"storeId"`
	CustomerID string `json:"customerId"`
	NoteNumber string `json:"noteNumber"`
	NoteDate   string `json:"noteDate"`
	AmountPaise int64 `json:"amountPaise"`
	TaxPaise   int64  `json:"taxPaise"`
	TotalPaise int64  `json:"totalPaise"`
	Reason     string `json:"reason"`
}

type CustomerChallan struct {
	ID            string `json:"id"`
	TenantID      string `json:"tenantId"`
	StoreID       string `json:"storeId"`
	CustomerID    string `json:"customerId"`
	ChallanNumber string `json:"challanNumber"`
	ChallanDate   string `json:"challanDate"`
	Status        string `json:"status"`
	InvoiceID     string `json:"invoiceId"`
	Notes         string `json:"notes"`
}

type CustomerChallanItem struct {
	ID             string `json:"id"`
	ChallanID      string `json:"challanId"`
	ProductID      string `json:"productId"`
	QuantityMillis int64  `json:"quantityMillis"`
	UnitPricePaise int64  `json:"unitPricePaise"`
}

type Quotation struct {
	ID              string `json:"id"`
	TenantID        string `json:"tenantId"`
	StoreID         string `json:"storeId"`
	CustomerID      string `json:"customerId"`
	QuotationNumber string `json:"quotationNumber"`
	QuotationDate   string `json:"quotationDate"`
	ValidUntil      string `json:"validUntil"`
	Status          string `json:"status"`
	SubtotalPaise   int64  `json:"subtotalPaise"`
	DiscountPaise   int64  `json:"discountPaise"`
	TaxPaise        int64  `json:"taxPaise"`
	TotalPaise      int64  `json:"totalPaise"`
	Notes           string `json:"notes"`
}

type QuotationItem struct {
	ID             string `json:"id"`
	QuotationID    string `json:"quotationId"`
	ProductID      string `json:"productId"`
	QuantityMillis int64  `json:"quantityMillis"`
	UnitPricePaise int64  `json:"unitPricePaise"`
	DiscountPaise  int64  `json:"discountPaise"`
	TaxPercent     int    `json:"taxPercent"`
	TotalPaise     int64  `json:"totalPaise"`
}

type Cheque struct {
	ID              string `json:"id"`
	TenantID        string `json:"tenantId"`
	ChequeNumber    string `json:"chequeNumber"`
	ChequeDate      string `json:"chequeDate"`
	BankName        string `json:"bankName"`
	PartyType       string `json:"partyType"`
	PartyID         string `json:"partyId"`
	PartyName       string `json:"partyName"`
	Direction       string `json:"direction"`
	AmountPaise     int64  `json:"amountPaise"`
	Status          string `json:"status"`
	ReferenceType   string `json:"referenceType"`
	ReferenceID     string `json:"referenceId"`
	ClearedDate     string `json:"clearedDate"`
	Notes           string `json:"notes"`
}

type StockTransfer struct {
	ID             string `json:"id"`
	TenantID       string `json:"tenantId"`
	FromStoreID    string `json:"fromStoreId"`
	ToStoreID      string `json:"toStoreId"`
	TransferNumber string `json:"transferNumber"`
	TransferDate   string `json:"transferDate"`
	Status         string `json:"status"`
	Notes          string `json:"notes"`
}

type StockTransferItem struct {
	ID             string `json:"id"`
	TransferID     string `json:"transferId"`
	ProductID      string `json:"productId"`
	QuantityMillis int64  `json:"quantityMillis"`
}

type EmployeeAttendance struct {
	ID             string `json:"id"`
	TenantID       string `json:"tenantId"`
	EmployeeID     string `json:"employeeId"`
	AttendanceDate string `json:"attendanceDate"`
	Status         string `json:"status"`
	InTime         string `json:"inTime"`
	OutTime        string `json:"outTime"`
	Notes          string `json:"notes"`
}

type Complaint struct {
	ID             string `json:"id"`
	TenantID       string `json:"tenantId"`
	StoreID        string `json:"storeId"`
	CustomerID     string `json:"customerId"`
	CustomerName   string `json:"customerName"`
	Phone          string `json:"phone"`
	VehicleNumber  string `json:"vehicleNumber"`
	ComplaintType  string `json:"complaintType"`
	Description    string `json:"description"`
	Status         string `json:"status"`
	Resolution     string `json:"resolution"`
	CreatedAt      string `json:"createdAt"`
	UpdatedAt      string `json:"updatedAt"`
}

type ServiceReminder struct {
	ID            string `json:"id"`
	TenantID      string `json:"tenantId"`
	CustomerID    string `json:"customerId"`
	CustomerName  string `json:"customerName"`
	Phone         string `json:"phone"`
	VehicleNumber string `json:"vehicleNumber"`
	ServiceType   string `json:"serviceType"`
	ReminderDate  string `json:"reminderDate"`
	Status        string `json:"status"`
	Notes         string `json:"notes"`
}

type MessageTemplate struct {
	ID           string `json:"id"`
	TenantID     string `json:"tenantId"`
	Name         string `json:"name"`
	TemplateType string `json:"templateType"`
	Content      string `json:"content"`
	IsActive     bool   `json:"isActive"`
}

type Voucher struct {
	ID              string `json:"id"`
	TenantID        string `json:"tenantId"`
	StoreID         string `json:"storeId"`
	VoucherType     string `json:"voucherType"`
	VoucherNumber   string `json:"voucherNumber"`
	PartyType       string `json:"partyType"`
	PartyID         string `json:"partyId"`
	AmountPaise     int64  `json:"amountPaise"`
	Method          string `json:"method"`
	ReferenceNumber string `json:"referenceNumber"`
	Narration       string `json:"narration"`
	RegisterID      string `json:"registerId"`
	CreatedAt       string `json:"createdAt"`
}

type BOMKit struct {
	ID              string `json:"id"`
	ParentProductID string `json:"parentProductId"`
	Name            string `json:"name"`
	IsActive        bool   `json:"isActive"`
	CreatedAt       string `json:"createdAt"`
}

type BOMComponent struct {
	ID             string `json:"id"`
	KitID          string `json:"kitId"`
	ProductID      string `json:"productId"`
	QuantityMillis int64  `json:"quantityMillis"`
	PriceTier      string `json:"priceTier"`
	SortOrder      int    `json:"sortOrder"`
}
