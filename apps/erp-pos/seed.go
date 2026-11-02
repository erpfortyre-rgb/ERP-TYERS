package main

import (
	"erp-pos/internal/masters"
	"erp-pos/internal/models"
	"fmt"

	"github.com/google/uuid"
)

func (a *App) SeedDemoData() (string, error) {
	fmt.Println("[SEED] SeedDemoData called")

	if a.db == nil {
		return "", fmt.Errorf("database not initialized")
	}

	var tenantID string
	err := a.db.QueryRow("SELECT id FROM tenants LIMIT 1").Scan(&tenantID)
	fmt.Printf("[SEED] tenantID=%s err=%v\n", tenantID, err)
	if tenantID == "" {
		return "", fmt.Errorf("no tenant found — run initial setup first")
	}

	var seedStoreID string
	a.db.QueryRow("SELECT id FROM stores WHERE tenant_id = ? LIMIT 1", tenantID).Scan(&seedStoreID)

	var count int
	a.db.QueryRow("SELECT COUNT(*) FROM products").Scan(&count)
	fmt.Printf("[SEED] existing products=%d\n", count)

	var existingInvoices int
	a.db.QueryRow("SELECT COUNT(*) FROM invoices").Scan(&existingInvoices)

	if count > 5 && existingInvoices > 0 {
		return fmt.Sprintf("Demo data already loaded (%d products, %d invoices exist).", count, existingInvoices), nil
	}

	results := []string{}
	errs := []string{}

	// ─── Units ──────────────────────────────────────────────────────
	units := []masters.Unit{
		{Name: "Piece", ShortName: "Pcs"},
		{Name: "Set", ShortName: "Set"},
		{Name: "Pair", ShortName: "Pr"},
		{Name: "Litre", ShortName: "Ltr"},
		{Name: "Kg", ShortName: "Kg"},
	}
	unitIDs := map[string]string{}
	for _, u := range units {
		u.ID = uuid.New().String()
		u.TenantID = tenantID
		id, err := a.masters.SaveUnit(u)
		if err != nil {
			errs = append(errs, "Unit "+u.Name+": "+err.Error())
		} else {
			unitIDs[u.Name] = id
		}
	}
	results = append(results, fmt.Sprintf("Units: %d added", len(units)-len(errs)))

	// ─── Categories ─────────────────────────────────────────────────
	categories := []string{
		"Car Tyres", "Bike Tyres", "Truck Tyres", "SUV Tyres",
		"Tubes", "Flaps", "Alloy Wheels", "Batteries",
		"Lubricants", "Accessories",
	}
	catIDs := map[string]string{}
	catErrs := 0
	for _, name := range categories {
		c := models.Category{ID: uuid.New().String(), TenantID: tenantID, Name: name}
		id, err := a.masters.SaveCategory(c)
		if err != nil {
			errs = append(errs, "Category "+name+": "+err.Error())
			catErrs++
		} else {
			catIDs[name] = id
		}
	}
	results = append(results, fmt.Sprintf("Categories: %d added", len(categories)-catErrs))

	// ─── Brands ─────────────────────────────────────────────────────
	brands := []string{
		"MRF", "CEAT", "Apollo", "JK Tyre", "Bridgestone",
		"Yokohama", "Michelin", "Continental", "Goodyear", "TVS",
		"Amaron", "Exide", "Bosch",
	}
	brandIDs := map[string]string{}
	brandErrs := 0
	for _, name := range brands {
		b := models.Brand{ID: uuid.New().String(), TenantID: tenantID, Name: name}
		id, err := a.masters.SaveBrand(b)
		if err != nil {
			errs = append(errs, "Brand "+name+": "+err.Error())
			brandErrs++
		} else {
			brandIDs[name] = id
		}
	}
	results = append(results, fmt.Sprintf("Brands: %d added", len(brands)-brandErrs))

	// ─── Products (Tyres) ───────────────────────────────────────────
	type productDef struct {
		name     string
		sku      string
		barcode  string
		hsn      string
		cat      string
		brand    string
		tax      int
		mrp      int64
		cmpA     int64
		cmpB     int64
	}

	products := []productDef{
		// Car Tyres
		{"MRF ZVTV 155/65 R14", "MRF-ZVTV-15565R14", "8901012345601", "4011", "Car Tyres", "MRF", 28, 385000, 350000, 340000},
		{"MRF ZVTS 165/80 R14", "MRF-ZVTS-16580R14", "8901012345602", "4011", "Car Tyres", "MRF", 28, 420000, 380000, 370000},
		{"MRF Wanderer 185/65 R15", "MRF-WDR-18565R15", "8901012345603", "4011", "Car Tyres", "MRF", 28, 520000, 475000, 460000},
		{"MRF ZSPORT 205/55 R16", "MRF-ZSPT-20555R16", "8901012345604", "4011", "Car Tyres", "MRF", 28, 680000, 620000, 600000},
		{"CEAT Milaze 155/80 R13", "CEAT-MLZ-15580R13", "8901012345605", "4011", "Car Tyres", "CEAT", 28, 320000, 290000, 280000},
		{"CEAT SecuraDrive 185/65 R15", "CEAT-SD-18565R15", "8901012345606", "4011", "Car Tyres", "CEAT", 28, 495000, 450000, 440000},
		{"Apollo Amazer 4G Life 155/65 R14", "APL-4GL-15565R14", "8901012345607", "4011", "Car Tyres", "Apollo", 28, 360000, 330000, 320000},
		{"Apollo Alnac 4GS 185/65 R15", "APL-4GS-18565R15", "8901012345608", "4011", "Car Tyres", "Apollo", 28, 510000, 465000, 450000},
		{"JK Tyre UX Royale 175/65 R14", "JK-UXR-17565R14", "8901012345609", "4011", "Car Tyres", "JK Tyre", 28, 400000, 365000, 355000},
		{"Bridgestone B290 155/80 R13", "BS-B290-15580R13", "8901012345610", "4011", "Car Tyres", "Bridgestone", 28, 350000, 320000, 310000},
		// SUV Tyres
		{"MRF Wanderer Sport 215/60 R17", "MRF-WS-21560R17", "8901012345611", "4011", "SUV Tyres", "MRF", 28, 850000, 780000, 760000},
		{"CEAT CrossDrive AT 215/75 R15", "CEAT-CDAT-21575R15", "8901012345612", "4011", "SUV Tyres", "CEAT", 28, 680000, 620000, 600000},
		{"Apollo Apterra HT2 235/65 R17", "APL-HT2-23565R17", "8901012345613", "4011", "SUV Tyres", "Apollo", 28, 920000, 850000, 830000},
		// Bike Tyres
		{"MRF Zapper FS 100/90-17", "MRF-ZFS-10090-17", "8901012345614", "4011", "Bike Tyres", "MRF", 28, 180000, 160000, 155000},
		{"MRF Revz FC 130/70-17", "MRF-RVZ-13070-17", "8901012345615", "4011", "Bike Tyres", "MRF", 28, 280000, 255000, 245000},
		{"CEAT Zoom Rad X1 120/80-17", "CEAT-ZRX1-12080-17", "8901012345616", "4011", "Bike Tyres", "CEAT", 28, 220000, 200000, 195000},
		{"TVS Eurogrip 90/90-12", "TVS-EG-9090-12", "8901012345617", "4011", "Bike Tyres", "TVS", 28, 95000, 85000, 82000},
		// Truck Tyres
		{"MRF S1M4 10.00R20", "MRF-S1M4-1000R20", "8901012345618", "4011", "Truck Tyres", "MRF", 28, 2200000, 2050000, 2000000},
		{"JK Tyre Jet Steel 295/80R22.5", "JK-JS-29580R225", "8901012345619", "4011", "Truck Tyres", "JK Tyre", 28, 1800000, 1680000, 1650000},
		// Tubes
		{"MRF Tube 155/65 R14", "MRF-TUBE-15565R14", "8901012345620", "4013", "Tubes", "MRF", 28, 45000, 40000, 38000},
		{"MRF Tube 185/65 R15", "MRF-TUBE-18565R15", "8901012345621", "4013", "Tubes", "MRF", 28, 55000, 50000, 48000},
		{"CEAT Tube 90/90-12", "CEAT-TUBE-9090-12", "8901012345622", "4013", "Tubes", "CEAT", 28, 25000, 22000, 21000},
		// Flaps
		{"MRF Flap 10.00R20", "MRF-FLAP-1000R20", "8901012345623", "4013", "Flaps", "MRF", 28, 35000, 32000, 30000},
		// Batteries
		{"Amaron PRO 55B24LS", "AMR-PRO-55B24LS", "8901012345624", "8507", "Batteries", "Amaron", 28, 650000, 580000, 560000},
		{"Exide Mileage ML75D23LBH", "EXD-ML-75D23L", "8901012345625", "8507", "Batteries", "Exide", 28, 720000, 650000, 630000},
		// Alloy Wheels
		{"Neo 15-inch Alloy Wheel Silver", "NEO-15-SLV", "8901012345626", "8708", "Alloy Wheels", "Bosch", 28, 350000, 320000, 310000},
		{"Neo 16-inch Alloy Wheel Black", "NEO-16-BLK", "8901012345627", "8708", "Alloy Wheels", "Bosch", 28, 420000, 385000, 375000},
		// Lubricants
		{"Castrol MAGNATEC 5W-30 1L", "CSTRL-MAG-5W30-1L", "8901012345628", "2710", "Lubricants", "Bosch", 18, 55000, 48000, 46000},
		{"Mobil Super 3000 5W-40 1L", "MBL-3000-5W40-1L", "8901012345629", "2710", "Lubricants", "Bosch", 18, 62000, 55000, 53000},
		// Accessories
		{"Tyre Pressure Gauge Digital", "ACC-TPG-DIG", "8901012345630", "9026", "Accessories", "Bosch", 18, 35000, 30000, 28000},
		{"Wheel Alignment Sticker Set", "ACC-WAS-SET", "8901012345631", "4821", "Accessories", "Bosch", 18, 5000, 4000, 3800},
	}

	prodErrs := 0
	for _, pd := range products {
		p := models.Product{
			ID:         uuid.New().String(),
			TenantID:   tenantID,
			Name:       pd.name,
			SKU:        pd.sku,
			Barcode:    pd.barcode,
			HSNCode:    pd.hsn,
			CategoryID: catIDs[pd.cat],
			BrandID:    brandIDs[pd.brand],
			UnitID:     unitIDs["Piece"],
			TaxPercent: pd.tax,
			IsActive:   true,
			IsKit:      false,
		}
		today := "2026-10-28"
		prices := []models.ProductPrice{
			{ID: uuid.New().String(), Tier: "MRP", PricePaise: int(pd.mrp), ValidFrom: today},
			{ID: uuid.New().String(), Tier: "CMP_A", PricePaise: int(pd.cmpA), ValidFrom: today},
			{ID: uuid.New().String(), Tier: "CMP_B", PricePaise: int(pd.cmpB), ValidFrom: today},
		}
		err := a.SaveProduct(p, prices, nil, nil)
		if err != nil {
			errs = append(errs, "Product "+pd.name+": "+err.Error())
			prodErrs++
		} else {
			a.db.Exec(`INSERT INTO local_stock (product_id, store_id, quantity_millis, updated_at) VALUES (?, ?, ?, datetime('now'))
				ON CONFLICT(product_id) DO UPDATE SET quantity_millis = excluded.quantity_millis, updated_at = excluded.updated_at`,
				p.ID, seedStoreID, 10000)
		}
	}
	results = append(results, fmt.Sprintf("Products: %d added (with prices & stock)", len(products)-prodErrs))

	// ─── Companies (Suppliers) ──────────────────────────────────────
	companies := []models.Company{
		{Name: "MRF Limited", ContactPerson: "Rajesh Menon", Phone: "9876543001", Email: "sales@mrf.co.in", GSTIN: "33AAACM1234A1Z5", Address: "124 Greams Rd", City: "Chennai", State: "Tamil Nadu", StateCode: "33", Pincode: "600006", IsActive: true},
		{Name: "CEAT Limited", ContactPerson: "Sunil Deshmukh", Phone: "9876543002", Email: "dealer@ceat.com", GSTIN: "27AAACCE1234A1Z5", Address: "RPG House, Worli", City: "Mumbai", State: "Maharashtra", StateCode: "27", Pincode: "400030", IsActive: true},
		{Name: "Apollo Tyres Ltd", ContactPerson: "Vikram Singh", Phone: "9876543003", Email: "dealer@apollotyres.com", GSTIN: "24AABCA1234A1Z5", Address: "Apollo House, BKC", City: "Gurgaon", State: "Haryana", StateCode: "06", Pincode: "122001", IsActive: true},
		{Name: "JK Tyre & Industries", ContactPerson: "Anand Gupta", Phone: "9876543004", Email: "sales@jktyre.com", GSTIN: "09AAACJ1234A1Z5", Address: "Vikrant Tower", City: "New Delhi", State: "Delhi", StateCode: "07", Pincode: "110001", IsActive: true},
		{Name: "Bridgestone India Pvt Ltd", ContactPerson: "Kenta Tanaka", Phone: "9876543005", Email: "sales@bridgestone.co.in", GSTIN: "29AABCB1234A1Z5", Address: "Prestige Tech Park", City: "Pune", State: "Maharashtra", StateCode: "27", Pincode: "411045", IsActive: true},
		{Name: "Amaron Batteries", ContactPerson: "Deepak Rao", Phone: "9876543006", Email: "dist@amaron.com", GSTIN: "36AAACA1234A1Z5", Address: "Shamshabad", City: "Hyderabad", State: "Telangana", StateCode: "36", Pincode: "501218", IsActive: true},
	}
	compErrs := 0
	for i := range companies {
		companies[i].ID = uuid.New().String()
		companies[i].TenantID = tenantID
		_, err := a.masters.SaveCompany(companies[i])
		if err != nil {
			errs = append(errs, "Company "+companies[i].Name+": "+err.Error())
			compErrs++
		}
	}
	results = append(results, fmt.Sprintf("Companies (Suppliers): %d added", len(companies)-compErrs))

	// ─── Customers ──────────────────────────────────────────────────
	customers := []models.Customer{
		{Name: "Walk-in Customer", Phone: "0000000000", IsActive: true, CreditLimitPaise: 0},
		{Name: "Raj Auto Works", Phone: "9988776601", Email: "rajauto@gmail.com", GSTIN: "36AABCR1234A1Z5", Address: "Main Road, Mancherial", IsActive: true, CreditLimitPaise: 10000000},
		{Name: "Sai Tyre Centre", Phone: "9988776602", Email: "saityre@gmail.com", GSTIN: "36AABCS1234A1Z5", Address: "Bus Stand Road, Mancherial", IsActive: true, CreditLimitPaise: 5000000},
		{Name: "Krishna Motors", Phone: "9988776603", Address: "NH-63, Mancherial", IsActive: true, CreditLimitPaise: 8000000},
		{Name: "Balaji Transport", Phone: "9988776604", GSTIN: "36AABCB5678A1Z5", Address: "Transport Nagar, Mancherial", IsActive: true, CreditLimitPaise: 15000000},
		{Name: "Ganesh Automobiles", Phone: "9988776605", Address: "Gandhi Chowk, Mancherial", IsActive: true, CreditLimitPaise: 3000000},
		{Name: "Mahesh Kumar", Phone: "9988776606", Address: "Bellampalli Rd, Mancherial", IsActive: true, CreditLimitPaise: 0},
		{Name: "Suresh Reddy", Phone: "9988776607", Address: "Jaipur Colony, Mancherial", IsActive: true, CreditLimitPaise: 0},
	}
	custErrs := 0
	for i := range customers {
		customers[i].ID = uuid.New().String()
		customers[i].TenantID = tenantID
		_, err := a.SaveCustomer(customers[i])
		if err != nil {
			errs = append(errs, "Customer "+customers[i].Name+": "+err.Error())
			custErrs++
		}
	}
	results = append(results, fmt.Sprintf("Customers: %d added", len(customers)-custErrs))

	// ─── Banks ──────────────────────────────────────────────────────
	banks := []models.BankMaster{
		{BankName: "State Bank of India", AccountNumber: "38765432101", IFSCCode: "SBIN0001234", Branch: "Mancherial Branch", OpeningBalPaise: 50000000, IsActive: true},
		{BankName: "HDFC Bank", AccountNumber: "50100456789012", IFSCCode: "HDFC0001234", Branch: "Mancherial Branch", OpeningBalPaise: 30000000, IsActive: true},
		{BankName: "ICICI Bank", AccountNumber: "123456789012", IFSCCode: "ICIC0001234", Branch: "Mancherial Branch", OpeningBalPaise: 20000000, IsActive: true},
	}
	bankErrs := 0
	for i := range banks {
		banks[i].ID = uuid.New().String()
		banks[i].TenantID = tenantID
		_, err := a.masters.SaveBank(banks[i])
		if err != nil {
			errs = append(errs, "Bank "+banks[i].BankName+": "+err.Error())
			bankErrs++
		}
	}
	results = append(results, fmt.Sprintf("Banks: %d added", len(banks)-bankErrs))

	// ─── Employees ──────────────────────────────────────────────────
	employees := []models.Employee{
		{Name: "Nilesh S. Chotiya", Phone: "9876500001", Designation: "Owner", SalaryPaise: 0, JoiningDate: "2020-01-01", IsActive: true},
		{Name: "Ramesh Kumar", Phone: "9876500002", Designation: "Manager", SalaryPaise: 2500000, JoiningDate: "2021-03-15", IsActive: true},
		{Name: "Sunil Yadav", Phone: "9876500003", Designation: "Cashier", SalaryPaise: 1500000, JoiningDate: "2022-06-01", IsActive: true},
		{Name: "Anil Singh", Phone: "9876500004", Designation: "Mechanic", SalaryPaise: 1800000, JoiningDate: "2021-07-10", IsActive: true},
		{Name: "Raju Prasad", Phone: "9876500005", Designation: "Helper", SalaryPaise: 1200000, JoiningDate: "2023-01-20", IsActive: true},
	}
	empErrs := 0
	for i := range employees {
		employees[i].ID = uuid.New().String()
		employees[i].TenantID = tenantID
		_, err := a.masters.SaveEmployee(employees[i])
		if err != nil {
			errs = append(errs, "Employee "+employees[i].Name+": "+err.Error())
			empErrs++
		}
	}
	results = append(results, fmt.Sprintf("Employees: %d added", len(employees)-empErrs))

	// ─── Expense Types ──────────────────────────────────────────────
	expenseTypes := []string{"Rent", "Electricity", "Salary", "Transport/Freight", "Office Supplies", "Shop Maintenance", "Telephone/Internet", "Insurance", "Miscellaneous"}
	expErrs := 0
	for _, name := range expenseTypes {
		e := models.ExpenseMaster{ID: uuid.New().String(), TenantID: tenantID, Name: name, IsActive: true}
		_, err := a.masters.SaveExpenseType(e)
		if err != nil {
			errs = append(errs, "ExpenseType "+name+": "+err.Error())
			expErrs++
		}
	}
	results = append(results, fmt.Sprintf("Expense Types: %d added", len(expenseTypes)-expErrs))

	// ─── Income Types ───────────────────────────────────────────────
	incomeTypes := []string{"Tyre Service Charge", "Wheel Alignment", "Wheel Balancing", "Puncture Repair", "Tyre Fitting Charge", "Old Tyre Sale", "Scrap Sale"}
	incErrs := 0
	for _, name := range incomeTypes {
		e := models.IncomeMaster{ID: uuid.New().String(), TenantID: tenantID, Name: name, IsActive: true}
		_, err := a.masters.SaveIncomeType(e)
		if err != nil {
			errs = append(errs, "IncomeType "+name+": "+err.Error())
			incErrs++
		}
	}
	results = append(results, fmt.Sprintf("Income Types: %d added", len(incomeTypes)-incErrs))

	// ─── Payment Types ──────────────────────────────────────────────
	paymentTypes := []string{"Advance Payment", "Partial Payment", "Full Settlement", "EMI Payment", "Refund"}
	payErrs := 0
	for _, name := range paymentTypes {
		e := models.PaymentMaster{ID: uuid.New().String(), TenantID: tenantID, Name: name, IsActive: true}
		_, err := a.masters.SavePaymentType(e)
		if err != nil {
			errs = append(errs, "PaymentType "+name+": "+err.Error())
			payErrs++
		}
	}
	results = append(results, fmt.Sprintf("Payment Types: %d added", len(paymentTypes)-payErrs))

	// ─── Sample Stock (add 10 units per product) ────────────────────
	stockAdded := 0
	prodRows, _ := a.db.Query("SELECT id FROM products WHERE tenant_id = ?", tenantID)
	if prodRows != nil {
		for prodRows.Next() {
			var pid string
			prodRows.Scan(&pid)
			a.db.Exec(`INSERT INTO local_stock (product_id, store_id, quantity_millis, updated_at) VALUES (?, ?, ?, datetime('now'))
				ON CONFLICT(product_id) DO UPDATE SET quantity_millis = excluded.quantity_millis, updated_at = excluded.updated_at`,
				pid, seedStoreID, 10000)
			stockAdded++
		}
		prodRows.Close()
	}
	results = append(results, fmt.Sprintf("Stock: %d products set to 10 units each", stockAdded))

	// ─── Sample Invoices (today's sales) ────────────────────────────
	var deviceID, invoicePrefix string
	var nextSeq int
	a.db.QueryRow("SELECT id, invoice_prefix, next_invoice_seq FROM device_identity LIMIT 1").Scan(&deviceID, &invoicePrefix, &nextSeq)

	type sampleSale struct {
		custIdx   int
		prodName  string
		qty       int64
		method    string
		reference string
	}
	sampleSales := []sampleSale{
		{1, "MRF ZVTV 155/65 R14", 2000, "CASH", ""},
		{2, "CEAT Milaze X3 155/80 R13", 4000, "UPI", "UPI-REF-001"},
		{3, "Apollo Amazer 4G Life 165/80 R14", 2000, "CARD", "CARD-001"},
		{0, "Exide Battery 45Ah", 1000, "CASH", ""},
		{4, "JK UX Royale 185/65 R15", 2000, "UPI", "UPI-REF-002"},
		{0, "MRF ZVTS 165/80 R14", 1000, "CASH", ""},
	}

	invoiceCount := 0
	for si, sale := range sampleSales {
		var prodID, hsnCode string
		var pricePaise int64
		var taxPercent int
		err := a.db.QueryRow("SELECT p.id, p.hsn_code, p.tax_percent, pp.price_paise FROM products p JOIN product_prices pp ON pp.product_id = p.id AND pp.tier = 'MRP' WHERE p.name = ? AND p.tenant_id = ?", sale.prodName, tenantID).Scan(&prodID, &hsnCode, &taxPercent, &pricePaise)
		if err != nil {
			continue
		}

		var custID interface{}
		if sale.custIdx > 0 {
			var cid string
			a.db.QueryRow("SELECT id FROM customers WHERE tenant_id = ? AND name != 'Walk-in Customer' ORDER BY name LIMIT 1 OFFSET ?", tenantID, sale.custIdx-1).Scan(&cid)
			if cid != "" {
				custID = cid
			}
		}

		invID := uuid.New().String()
		itemID := uuid.New().String()
		payID := uuid.New().String()

		gross := (pricePaise * sale.qty) / 1000
		tax := gross - (gross * 100 / int64(100+taxPercent))
		total := gross

		invNum := fmt.Sprintf("%s-26-%06d", invoicePrefix, nextSeq+si)

		a.db.Exec(`INSERT INTO invoices (id, tenant_id, store_id, device_id, invoice_number, customer_id, status, subtotal_paise, discount_paise, tax_paise, roundoff_paise, total_paise, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'FINAL', ?, 0, ?, 0, ?, 'Demo sale', datetime('now'), datetime('now'))`,
			invID, tenantID, seedStoreID, deviceID, invNum, custID, gross, tax, total)

		a.db.Exec(`INSERT INTO invoice_items (id, invoice_id, product_id, product_name, hsn_code, quantity_millis, price_tier, unit_price_paise, discount_paise, tax_percent, tax_paise, total_paise, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			itemID, invID, prodID, sale.prodName, hsnCode, sale.qty, "MRP", pricePaise, 0, taxPercent, tax, total, 0)

		a.db.Exec(`INSERT INTO invoice_payments (id, invoice_id, method, amount_paise, reference_number, is_verified) VALUES (?, ?, ?, ?, ?, ?)`,
			payID, invID, sale.method, total, sale.reference, 1)

		// Deduct stock
		a.db.Exec(`UPDATE local_stock SET quantity_millis = quantity_millis - ?, updated_at = datetime('now') WHERE product_id = ?`, sale.qty, prodID)

		invoiceCount++
	}
	// Update device sequence
	a.db.Exec("UPDATE device_identity SET next_invoice_seq = next_invoice_seq + ?", invoiceCount)
	results = append(results, fmt.Sprintf("Sample Invoices: %d created (today's sales)", invoiceCount))

	// ─── Sample Expense Entries ─────────────────────────────────────
	var rentExpID, elecExpID, salExpID string
	a.db.QueryRow("SELECT id FROM expense_master WHERE tenant_id = ? AND name = 'Rent'", tenantID).Scan(&rentExpID)
	a.db.QueryRow("SELECT id FROM expense_master WHERE tenant_id = ? AND name = 'Electricity'", tenantID).Scan(&elecExpID)
	a.db.QueryRow("SELECT id FROM expense_master WHERE tenant_id = ? AND name = 'Salary'", tenantID).Scan(&salExpID)

	expEntries := 0
	if rentExpID != "" {
		a.db.Exec(`INSERT INTO expense_entries (id, tenant_id, store_id, expense_id, amount_paise, payment_method, narration, entry_date) VALUES (?, ?, ?, ?, ?, ?, ?, date('now'))`,
			uuid.New().String(), tenantID, seedStoreID, rentExpID, 2500000, "BANK_TRANSFER", "Monthly shop rent")
		expEntries++
	}
	if elecExpID != "" {
		a.db.Exec(`INSERT INTO expense_entries (id, tenant_id, store_id, expense_id, amount_paise, payment_method, narration, entry_date) VALUES (?, ?, ?, ?, ?, ?, ?, date('now'))`,
			uuid.New().String(), tenantID, seedStoreID, elecExpID, 450000, "UPI", "Electricity bill")
		expEntries++
	}
	if salExpID != "" {
		a.db.Exec(`INSERT INTO expense_entries (id, tenant_id, store_id, expense_id, amount_paise, payment_method, narration, entry_date) VALUES (?, ?, ?, ?, ?, ?, ?, date('now'))`,
			uuid.New().String(), tenantID, seedStoreID, salExpID, 7000000, "BANK_TRANSFER", "Staff salaries")
		expEntries++
	}
	results = append(results, fmt.Sprintf("Expense Entries: %d added", expEntries))

	// ─── Sample Income Entries ──────────────────────────────────────
	var alignIncID, punctureIncID string
	a.db.QueryRow("SELECT id FROM income_master WHERE tenant_id = ? AND name = 'Wheel Alignment'", tenantID).Scan(&alignIncID)
	a.db.QueryRow("SELECT id FROM income_master WHERE tenant_id = ? AND name = 'Puncture Repair'", tenantID).Scan(&punctureIncID)

	incEntries := 0
	if alignIncID != "" {
		a.db.Exec(`INSERT INTO income_entries (id, tenant_id, store_id, income_id, amount_paise, payment_method, narration, entry_date) VALUES (?, ?, ?, ?, ?, ?, ?, date('now'))`,
			uuid.New().String(), tenantID, seedStoreID, alignIncID, 80000, "CASH", "Wheel alignment x2 cars")
		incEntries++
	}
	if punctureIncID != "" {
		a.db.Exec(`INSERT INTO income_entries (id, tenant_id, store_id, income_id, amount_paise, payment_method, narration, entry_date) VALUES (?, ?, ?, ?, ?, ?, ?, date('now'))`,
			uuid.New().String(), tenantID, seedStoreID, punctureIncID, 30000, "CASH", "Puncture repair x3")
		incEntries++
	}
	results = append(results, fmt.Sprintf("Income Entries: %d added", incEntries))

	// ─── Build summary ──────────────────────────────────────────────
	summary := "Demo data loaded!\n"
	for _, r := range results {
		summary += "  - " + r + "\n"
	}
	if len(errs) > 0 {
		summary += fmt.Sprintf("\n%d errors:\n", len(errs))
		for _, e := range errs {
			summary += "  ! " + e + "\n"
		}
	}
	fmt.Printf("[SEED] Done. Summary:\n%s\n", summary)
	return summary, nil
}
