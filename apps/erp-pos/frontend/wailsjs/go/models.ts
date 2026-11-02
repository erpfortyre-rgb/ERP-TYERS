export namespace accounts {
	
	export class DayBookEntry {
	    date: string;
	    type: string;
	    number: string;
	    partyName: string;
	    amountPaise: number;
	
	    static createFrom(source: any = {}) {
	        return new DayBookEntry(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.date = source["date"];
	        this.type = source["type"];
	        this.number = source["number"];
	        this.partyName = source["partyName"];
	        this.amountPaise = source["amountPaise"];
	    }
	}
	export class LedgerEntry {
	    date: string;
	    description: string;
	    debitPaise: number;
	    creditPaise: number;
	    balancePaise: number;
	
	    static createFrom(source: any = {}) {
	        return new LedgerEntry(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.date = source["date"];
	        this.description = source["description"];
	        this.debitPaise = source["debitPaise"];
	        this.creditPaise = source["creditPaise"];
	        this.balancePaise = source["balancePaise"];
	    }
	}
	export class RecycleEntry {
	    id: string;
	    kind: string;
	    category: string;
	    narration: string;
	    amountPaise: number;
	    entryDate: string;
	    deletedBy: string;
	    deletedByEmail: string;
	    deletedAt: string;
	
	    static createFrom(source: any = {}) {
	        return new RecycleEntry(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.kind = source["kind"];
	        this.category = source["category"];
	        this.narration = source["narration"];
	        this.amountPaise = source["amountPaise"];
	        this.entryDate = source["entryDate"];
	        this.deletedBy = source["deletedBy"];
	        this.deletedByEmail = source["deletedByEmail"];
	        this.deletedAt = source["deletedAt"];
	    }
	}
	export class SummaryRow {
	    id: string;
	    label: string;
	    countOrQty: number;
	    amountPaise: number;
	
	    static createFrom(source: any = {}) {
	        return new SummaryRow(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.label = source["label"];
	        this.countOrQty = source["countOrQty"];
	        this.amountPaise = source["amountPaise"];
	    }
	}

}

export namespace auth {
	
	export class UserInfo {
	    id: string;
	    name: string;
	    email: string;
	    roleName: string;
	    permissions: string;
	
	    static createFrom(source: any = {}) {
	        return new UserInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.email = source["email"];
	        this.roleName = source["roleName"];
	        this.permissions = source["permissions"];
	    }
	}

}

export namespace main {
	
	export class CompanyInfo {
	    id: string;
	    name: string;
	    gstin: string;
	    phone: string;
	    address: string;
	    isActive: boolean;
	
	    static createFrom(source: any = {}) {
	        return new CompanyInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.gstin = source["gstin"];
	        this.phone = source["phone"];
	        this.address = source["address"];
	        this.isActive = source["isActive"];
	    }
	}
	export class FirmProfile {
	    name: string;
	    gstin: string;
	    address: string;
	    phone: string;
	    email: string;
	
	    static createFrom(source: any = {}) {
	        return new FirmProfile(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.gstin = source["gstin"];
	        this.address = source["address"];
	        this.phone = source["phone"];
	        this.email = source["email"];
	    }
	}
	export class ImportResult {
	    imported: number;
	    errors: string[];
	
	    static createFrom(source: any = {}) {
	        return new ImportResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.imported = source["imported"];
	        this.errors = source["errors"];
	    }
	}
	export class InvoicePrintHSN {
	    hsn: string;
	    taxablePaise: number;
	    rate: number;
	    taxPaise: number;
	
	    static createFrom(source: any = {}) {
	        return new InvoicePrintHSN(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.hsn = source["hsn"];
	        this.taxablePaise = source["taxablePaise"];
	        this.rate = source["rate"];
	        this.taxPaise = source["taxPaise"];
	    }
	}
	export class InvoicePrintItem {
	    name: string;
	    hsn: string;
	    qtyMillis: number;
	    unitPricePaise: number;
	    mrpPaise: number;
	    gstRate: number;
	    gstPaise: number;
	    amountPaise: number;
	
	    static createFrom(source: any = {}) {
	        return new InvoicePrintItem(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.hsn = source["hsn"];
	        this.qtyMillis = source["qtyMillis"];
	        this.unitPricePaise = source["unitPricePaise"];
	        this.mrpPaise = source["mrpPaise"];
	        this.gstRate = source["gstRate"];
	        this.gstPaise = source["gstPaise"];
	        this.amountPaise = source["amountPaise"];
	    }
	}
	export class InvoicePrintData {
	    firmName: string;
	    firmGstin: string;
	    firmAddress: string;
	    firmPhone: string;
	    firmEmail: string;
	    firmStateCode: string;
	    billToName: string;
	    billToGstin: string;
	    billToAddress: string;
	    billToPhone: string;
	    invoiceNo: string;
	    date: string;
	    placeOfSupply: string;
	    reverseCharge: boolean;
	    items: InvoicePrintItem[];
	    subtotalPaise: number;
	    discountPaise: number;
	    isInterState: boolean;
	    igstPaise: number;
	    cgstPaise: number;
	    sgstPaise: number;
	    roundoffPaise: number;
	    totalPaise: number;
	    receivedPaise: number;
	    balancePaise: number;
	    amountInWords: string;
	    paymentMode: string;
	    hsnSummary: InvoicePrintHSN[];
	    terms: string;
	
	    static createFrom(source: any = {}) {
	        return new InvoicePrintData(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.firmName = source["firmName"];
	        this.firmGstin = source["firmGstin"];
	        this.firmAddress = source["firmAddress"];
	        this.firmPhone = source["firmPhone"];
	        this.firmEmail = source["firmEmail"];
	        this.firmStateCode = source["firmStateCode"];
	        this.billToName = source["billToName"];
	        this.billToGstin = source["billToGstin"];
	        this.billToAddress = source["billToAddress"];
	        this.billToPhone = source["billToPhone"];
	        this.invoiceNo = source["invoiceNo"];
	        this.date = source["date"];
	        this.placeOfSupply = source["placeOfSupply"];
	        this.reverseCharge = source["reverseCharge"];
	        this.items = this.convertValues(source["items"], InvoicePrintItem);
	        this.subtotalPaise = source["subtotalPaise"];
	        this.discountPaise = source["discountPaise"];
	        this.isInterState = source["isInterState"];
	        this.igstPaise = source["igstPaise"];
	        this.cgstPaise = source["cgstPaise"];
	        this.sgstPaise = source["sgstPaise"];
	        this.roundoffPaise = source["roundoffPaise"];
	        this.totalPaise = source["totalPaise"];
	        this.receivedPaise = source["receivedPaise"];
	        this.balancePaise = source["balancePaise"];
	        this.amountInWords = source["amountInWords"];
	        this.paymentMode = source["paymentMode"];
	        this.hsnSummary = this.convertValues(source["hsnSummary"], InvoicePrintHSN);
	        this.terms = source["terms"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	
	export class InvoiceScheme {
	    prefix: string;
	    nextSeq: number;
	
	    static createFrom(source: any = {}) {
	        return new InvoiceScheme(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.prefix = source["prefix"];
	        this.nextSeq = source["nextSeq"];
	    }
	}
	export class RoleInfo {
	    id: string;
	    name: string;
	    permissions: string;
	    userCount: number;
	
	    static createFrom(source: any = {}) {
	        return new RoleInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.permissions = source["permissions"];
	        this.userCount = source["userCount"];
	    }
	}

}

export namespace masters {
	
	export class Unit {
	    id: string;
	    tenantId: string;
	    name: string;
	    shortName: string;
	
	    static createFrom(source: any = {}) {
	        return new Unit(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.tenantId = source["tenantId"];
	        this.name = source["name"];
	        this.shortName = source["shortName"];
	    }
	}

}

export namespace models {
	
	export class BOMComponent {
	    id: string;
	    kitId: string;
	    productId: string;
	    quantityMillis: number;
	    priceTier: string;
	    sortOrder: number;
	
	    static createFrom(source: any = {}) {
	        return new BOMComponent(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.kitId = source["kitId"];
	        this.productId = source["productId"];
	        this.quantityMillis = source["quantityMillis"];
	        this.priceTier = source["priceTier"];
	        this.sortOrder = source["sortOrder"];
	    }
	}
	export class BOMKit {
	    id: string;
	    parentProductId: string;
	    name: string;
	    isActive: boolean;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new BOMKit(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.parentProductId = source["parentProductId"];
	        this.name = source["name"];
	        this.isActive = source["isActive"];
	        this.createdAt = source["createdAt"];
	    }
	}
	export class BankMaster {
	    id: string;
	    tenantId: string;
	    bankName: string;
	    accountNumber: string;
	    ifscCode: string;
	    branch: string;
	    openingBalancePaise: number;
	    bookType: string;
	    note: string;
	    isActive: boolean;
	
	    static createFrom(source: any = {}) {
	        return new BankMaster(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.tenantId = source["tenantId"];
	        this.bankName = source["bankName"];
	        this.accountNumber = source["accountNumber"];
	        this.ifscCode = source["ifscCode"];
	        this.branch = source["branch"];
	        this.openingBalancePaise = source["openingBalancePaise"];
	        this.bookType = source["bookType"];
	        this.note = source["note"];
	        this.isActive = source["isActive"];
	    }
	}
	export class Brand {
	    id: string;
	    tenantId: string;
	    name: string;
	
	    static createFrom(source: any = {}) {
	        return new Brand(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.tenantId = source["tenantId"];
	        this.name = source["name"];
	    }
	}
	export class Category {
	    id: string;
	    tenantId: string;
	    name: string;
	    parentId: string;
	    purchaseDiscountPercent: number;
	    saleDiscountPercent: number;
	
	    static createFrom(source: any = {}) {
	        return new Category(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.tenantId = source["tenantId"];
	        this.name = source["name"];
	        this.parentId = source["parentId"];
	        this.purchaseDiscountPercent = source["purchaseDiscountPercent"];
	        this.saleDiscountPercent = source["saleDiscountPercent"];
	    }
	}
	export class Cheque {
	    id: string;
	    tenantId: string;
	    chequeNumber: string;
	    chequeDate: string;
	    bankName: string;
	    partyType: string;
	    partyId: string;
	    partyName: string;
	    direction: string;
	    amountPaise: number;
	    status: string;
	    referenceType: string;
	    referenceId: string;
	    clearedDate: string;
	    notes: string;
	
	    static createFrom(source: any = {}) {
	        return new Cheque(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.tenantId = source["tenantId"];
	        this.chequeNumber = source["chequeNumber"];
	        this.chequeDate = source["chequeDate"];
	        this.bankName = source["bankName"];
	        this.partyType = source["partyType"];
	        this.partyId = source["partyId"];
	        this.partyName = source["partyName"];
	        this.direction = source["direction"];
	        this.amountPaise = source["amountPaise"];
	        this.status = source["status"];
	        this.referenceType = source["referenceType"];
	        this.referenceId = source["referenceId"];
	        this.clearedDate = source["clearedDate"];
	        this.notes = source["notes"];
	    }
	}
	export class Company {
	    id: string;
	    tenantId: string;
	    name: string;
	    contactPerson: string;
	    phone: string;
	    email: string;
	    gstin: string;
	    pan: string;
	    address: string;
	    city: string;
	    state: string;
	    stateCode: string;
	    pincode: string;
	    openingBalancePaise: number;
	    isActive: boolean;
	    createdAt: string;
	    updatedAt: string;
	
	    static createFrom(source: any = {}) {
	        return new Company(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.tenantId = source["tenantId"];
	        this.name = source["name"];
	        this.contactPerson = source["contactPerson"];
	        this.phone = source["phone"];
	        this.email = source["email"];
	        this.gstin = source["gstin"];
	        this.pan = source["pan"];
	        this.address = source["address"];
	        this.city = source["city"];
	        this.state = source["state"];
	        this.stateCode = source["stateCode"];
	        this.pincode = source["pincode"];
	        this.openingBalancePaise = source["openingBalancePaise"];
	        this.isActive = source["isActive"];
	        this.createdAt = source["createdAt"];
	        this.updatedAt = source["updatedAt"];
	    }
	}
	export class Complaint {
	    id: string;
	    tenantId: string;
	    storeId: string;
	    customerId: string;
	    customerName: string;
	    phone: string;
	    vehicleNumber: string;
	    complaintType: string;
	    description: string;
	    status: string;
	    resolution: string;
	    createdAt: string;
	    updatedAt: string;
	
	    static createFrom(source: any = {}) {
	        return new Complaint(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.tenantId = source["tenantId"];
	        this.storeId = source["storeId"];
	        this.customerId = source["customerId"];
	        this.customerName = source["customerName"];
	        this.phone = source["phone"];
	        this.vehicleNumber = source["vehicleNumber"];
	        this.complaintType = source["complaintType"];
	        this.description = source["description"];
	        this.status = source["status"];
	        this.resolution = source["resolution"];
	        this.createdAt = source["createdAt"];
	        this.updatedAt = source["updatedAt"];
	    }
	}
	export class CreditNote {
	    id: string;
	    tenantId: string;
	    storeId: string;
	    customerId: string;
	    noteNumber: string;
	    noteDate: string;
	    amountPaise: number;
	    taxPaise: number;
	    totalPaise: number;
	    reason: string;
	
	    static createFrom(source: any = {}) {
	        return new CreditNote(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.tenantId = source["tenantId"];
	        this.storeId = source["storeId"];
	        this.customerId = source["customerId"];
	        this.noteNumber = source["noteNumber"];
	        this.noteDate = source["noteDate"];
	        this.amountPaise = source["amountPaise"];
	        this.taxPaise = source["taxPaise"];
	        this.totalPaise = source["totalPaise"];
	        this.reason = source["reason"];
	    }
	}
	export class Customer {
	    id: string;
	    tenantId: string;
	    name: string;
	    phone: string;
	    email: string;
	    gstin: string;
	    address: string;
	    creditLimitPaise: number;
	    isActive: boolean;
	    businessName: string;
	    contactId: string;
	    groupId: string;
	    contactType: string;
	    alternatePhone: string;
	    landline: string;
	    payTermDays: number;
	    openingBalancePaise: number;
	    city: string;
	    stateCode: string;
	
	    static createFrom(source: any = {}) {
	        return new Customer(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.tenantId = source["tenantId"];
	        this.name = source["name"];
	        this.phone = source["phone"];
	        this.email = source["email"];
	        this.gstin = source["gstin"];
	        this.address = source["address"];
	        this.creditLimitPaise = source["creditLimitPaise"];
	        this.isActive = source["isActive"];
	        this.businessName = source["businessName"];
	        this.contactId = source["contactId"];
	        this.groupId = source["groupId"];
	        this.contactType = source["contactType"];
	        this.alternatePhone = source["alternatePhone"];
	        this.landline = source["landline"];
	        this.payTermDays = source["payTermDays"];
	        this.openingBalancePaise = source["openingBalancePaise"];
	        this.city = source["city"];
	        this.stateCode = source["stateCode"];
	    }
	}
	export class CustomerChallan {
	    id: string;
	    tenantId: string;
	    storeId: string;
	    customerId: string;
	    challanNumber: string;
	    challanDate: string;
	    status: string;
	    invoiceId: string;
	    notes: string;
	
	    static createFrom(source: any = {}) {
	        return new CustomerChallan(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.tenantId = source["tenantId"];
	        this.storeId = source["storeId"];
	        this.customerId = source["customerId"];
	        this.challanNumber = source["challanNumber"];
	        this.challanDate = source["challanDate"];
	        this.status = source["status"];
	        this.invoiceId = source["invoiceId"];
	        this.notes = source["notes"];
	    }
	}
	export class CustomerChallanItem {
	    id: string;
	    challanId: string;
	    productId: string;
	    quantityMillis: number;
	    unitPricePaise: number;
	
	    static createFrom(source: any = {}) {
	        return new CustomerChallanItem(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.challanId = source["challanId"];
	        this.productId = source["productId"];
	        this.quantityMillis = source["quantityMillis"];
	        this.unitPricePaise = source["unitPricePaise"];
	    }
	}
	export class CustomerGroup {
	    id: string;
	    tenantId: string;
	    name: string;
	    calcPercent: number;
	    sellingPriceGroup: string;
	    isActive: boolean;
	
	    static createFrom(source: any = {}) {
	        return new CustomerGroup(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.tenantId = source["tenantId"];
	        this.name = source["name"];
	        this.calcPercent = source["calcPercent"];
	        this.sellingPriceGroup = source["sellingPriceGroup"];
	        this.isActive = source["isActive"];
	    }
	}
	export class DashboardSaleDay {
	    date: string;
	    salePaise: number;
	
	    static createFrom(source: any = {}) {
	        return new DashboardSaleDay(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.date = source["date"];
	        this.salePaise = source["salePaise"];
	    }
	}
	export class DashboardTopItem {
	    name: string;
	    qty: number;
	    amtPaise: number;
	
	    static createFrom(source: any = {}) {
	        return new DashboardTopItem(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.qty = source["qty"];
	        this.amtPaise = source["amtPaise"];
	    }
	}
	export class DashboardStats {
	    todaySalesCount: number;
	    todaySalesPaise: number;
	    todayCashPaise: number;
	    todayUpiPaise: number;
	    todayCardPaise: number;
	    todayCreditPaise: number;
	    todayChequePaise: number;
	    todayBankPaise: number;
	    monthSalesPaise: number;
	    monthSalesCount: number;
	    prevMonthSalesPaise: number;
	    monthPurchasePaise: number;
	    monthExpensePaise: number;
	    totalReceivablePaise: number;
	    totalPayablePaise: number;
	    lowStockCount: number;
	    totalProducts: number;
	    salesByDay: DashboardSaleDay[];
	    topItems: DashboardTopItem[];
	
	    static createFrom(source: any = {}) {
	        return new DashboardStats(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.todaySalesCount = source["todaySalesCount"];
	        this.todaySalesPaise = source["todaySalesPaise"];
	        this.todayCashPaise = source["todayCashPaise"];
	        this.todayUpiPaise = source["todayUpiPaise"];
	        this.todayCardPaise = source["todayCardPaise"];
	        this.todayCreditPaise = source["todayCreditPaise"];
	        this.todayChequePaise = source["todayChequePaise"];
	        this.todayBankPaise = source["todayBankPaise"];
	        this.monthSalesPaise = source["monthSalesPaise"];
	        this.monthSalesCount = source["monthSalesCount"];
	        this.prevMonthSalesPaise = source["prevMonthSalesPaise"];
	        this.monthPurchasePaise = source["monthPurchasePaise"];
	        this.monthExpensePaise = source["monthExpensePaise"];
	        this.totalReceivablePaise = source["totalReceivablePaise"];
	        this.totalPayablePaise = source["totalPayablePaise"];
	        this.lowStockCount = source["lowStockCount"];
	        this.totalProducts = source["totalProducts"];
	        this.salesByDay = this.convertValues(source["salesByDay"], DashboardSaleDay);
	        this.topItems = this.convertValues(source["topItems"], DashboardTopItem);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	export class DebitNote {
	    id: string;
	    tenantId: string;
	    storeId: string;
	    companyId: string;
	    noteNumber: string;
	    noteDate: string;
	    amountPaise: number;
	    taxPaise: number;
	    totalPaise: number;
	    reason: string;
	
	    static createFrom(source: any = {}) {
	        return new DebitNote(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.tenantId = source["tenantId"];
	        this.storeId = source["storeId"];
	        this.companyId = source["companyId"];
	        this.noteNumber = source["noteNumber"];
	        this.noteDate = source["noteDate"];
	        this.amountPaise = source["amountPaise"];
	        this.taxPaise = source["taxPaise"];
	        this.totalPaise = source["totalPaise"];
	        this.reason = source["reason"];
	    }
	}
	export class DeviceIdentity {
	    id: string;
	    storeId: string;
	    deviceName: string;
	    invoicePrefix: string;
	    nextInvoiceSeq: number;
	
	    static createFrom(source: any = {}) {
	        return new DeviceIdentity(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.storeId = source["storeId"];
	        this.deviceName = source["deviceName"];
	        this.invoicePrefix = source["invoicePrefix"];
	        this.nextInvoiceSeq = source["nextInvoiceSeq"];
	    }
	}
	export class Employee {
	    id: string;
	    tenantId: string;
	    name: string;
	    phone: string;
	    email: string;
	    address: string;
	    designation: string;
	    salaryPaise: number;
	    joiningDate: string;
	    paidHolidayCount: number;
	    isActive: boolean;
	
	    static createFrom(source: any = {}) {
	        return new Employee(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.tenantId = source["tenantId"];
	        this.name = source["name"];
	        this.phone = source["phone"];
	        this.email = source["email"];
	        this.address = source["address"];
	        this.designation = source["designation"];
	        this.salaryPaise = source["salaryPaise"];
	        this.joiningDate = source["joiningDate"];
	        this.paidHolidayCount = source["paidHolidayCount"];
	        this.isActive = source["isActive"];
	    }
	}
	export class EmployeeAttendance {
	    id: string;
	    tenantId: string;
	    employeeId: string;
	    attendanceDate: string;
	    status: string;
	    inTime: string;
	    outTime: string;
	    notes: string;
	
	    static createFrom(source: any = {}) {
	        return new EmployeeAttendance(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.tenantId = source["tenantId"];
	        this.employeeId = source["employeeId"];
	        this.attendanceDate = source["attendanceDate"];
	        this.status = source["status"];
	        this.inTime = source["inTime"];
	        this.outTime = source["outTime"];
	        this.notes = source["notes"];
	    }
	}
	export class ExpenseEntry {
	    id: string;
	    tenantId: string;
	    storeId: string;
	    expenseId: string;
	    quantityMillis: number;
	    ratePaise: number;
	    amountPaise: number;
	    paymentMethod: string;
	    referenceNumber: string;
	    narration: string;
	    entryDate: string;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new ExpenseEntry(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.tenantId = source["tenantId"];
	        this.storeId = source["storeId"];
	        this.expenseId = source["expenseId"];
	        this.quantityMillis = source["quantityMillis"];
	        this.ratePaise = source["ratePaise"];
	        this.amountPaise = source["amountPaise"];
	        this.paymentMethod = source["paymentMethod"];
	        this.referenceNumber = source["referenceNumber"];
	        this.narration = source["narration"];
	        this.entryDate = source["entryDate"];
	        this.createdAt = source["createdAt"];
	    }
	}
	export class ExpenseMaster {
	    id: string;
	    tenantId: string;
	    name: string;
	    isActive: boolean;
	
	    static createFrom(source: any = {}) {
	        return new ExpenseMaster(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.tenantId = source["tenantId"];
	        this.name = source["name"];
	        this.isActive = source["isActive"];
	    }
	}
	export class IncomeEntry {
	    id: string;
	    tenantId: string;
	    storeId: string;
	    incomeId: string;
	    quantityMillis: number;
	    ratePaise: number;
	    amountPaise: number;
	    paymentMethod: string;
	    referenceNumber: string;
	    narration: string;
	    entryDate: string;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new IncomeEntry(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.tenantId = source["tenantId"];
	        this.storeId = source["storeId"];
	        this.incomeId = source["incomeId"];
	        this.quantityMillis = source["quantityMillis"];
	        this.ratePaise = source["ratePaise"];
	        this.amountPaise = source["amountPaise"];
	        this.paymentMethod = source["paymentMethod"];
	        this.referenceNumber = source["referenceNumber"];
	        this.narration = source["narration"];
	        this.entryDate = source["entryDate"];
	        this.createdAt = source["createdAt"];
	    }
	}
	export class IncomeMaster {
	    id: string;
	    tenantId: string;
	    name: string;
	    isActive: boolean;
	
	    static createFrom(source: any = {}) {
	        return new IncomeMaster(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.tenantId = source["tenantId"];
	        this.name = source["name"];
	        this.isActive = source["isActive"];
	    }
	}
	export class Invoice {
	    id: string;
	    tenantId: string;
	    storeId: string;
	    deviceId: string;
	    invoiceNumber: string;
	    customerId: string;
	    customerName: string;
	    status: string;
	    subtotalPaise: number;
	    discountPaise: number;
	    taxPaise: number;
	    roundoffPaise: number;
	    totalPaise: number;
	    notes: string;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new Invoice(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.tenantId = source["tenantId"];
	        this.storeId = source["storeId"];
	        this.deviceId = source["deviceId"];
	        this.invoiceNumber = source["invoiceNumber"];
	        this.customerId = source["customerId"];
	        this.customerName = source["customerName"];
	        this.status = source["status"];
	        this.subtotalPaise = source["subtotalPaise"];
	        this.discountPaise = source["discountPaise"];
	        this.taxPaise = source["taxPaise"];
	        this.roundoffPaise = source["roundoffPaise"];
	        this.totalPaise = source["totalPaise"];
	        this.notes = source["notes"];
	        this.createdAt = source["createdAt"];
	    }
	}
	export class InvoiceItem {
	    id: string;
	    invoiceId: string;
	    productId: string;
	    productName: string;
	    hsnCode: string;
	    quantityMillis: number;
	    priceTier: string;
	    unitPricePaise: number;
	    discountPaise: number;
	    taxPercent: number;
	    taxPaise: number;
	    totalPaise: number;
	
	    static createFrom(source: any = {}) {
	        return new InvoiceItem(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.invoiceId = source["invoiceId"];
	        this.productId = source["productId"];
	        this.productName = source["productName"];
	        this.hsnCode = source["hsnCode"];
	        this.quantityMillis = source["quantityMillis"];
	        this.priceTier = source["priceTier"];
	        this.unitPricePaise = source["unitPricePaise"];
	        this.discountPaise = source["discountPaise"];
	        this.taxPercent = source["taxPercent"];
	        this.taxPaise = source["taxPaise"];
	        this.totalPaise = source["totalPaise"];
	    }
	}
	export class InvoicePayment {
	    id: string;
	    invoiceId: string;
	    method: string;
	    amountPaise: number;
	    referenceNumber: string;
	    isVerified: boolean;
	
	    static createFrom(source: any = {}) {
	        return new InvoicePayment(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.invoiceId = source["invoiceId"];
	        this.method = source["method"];
	        this.amountPaise = source["amountPaise"];
	        this.referenceNumber = source["referenceNumber"];
	        this.isVerified = source["isVerified"];
	    }
	}
	export class InvoiceWithDetails {
	    id: string;
	    tenantId: string;
	    storeId: string;
	    deviceId: string;
	    invoiceNumber: string;
	    customerId: string;
	    customerName: string;
	    status: string;
	    subtotalPaise: number;
	    discountPaise: number;
	    taxPaise: number;
	    roundoffPaise: number;
	    totalPaise: number;
	    notes: string;
	    createdAt: string;
	    items: InvoiceItem[];
	    payments: InvoicePayment[];
	
	    static createFrom(source: any = {}) {
	        return new InvoiceWithDetails(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.tenantId = source["tenantId"];
	        this.storeId = source["storeId"];
	        this.deviceId = source["deviceId"];
	        this.invoiceNumber = source["invoiceNumber"];
	        this.customerId = source["customerId"];
	        this.customerName = source["customerName"];
	        this.status = source["status"];
	        this.subtotalPaise = source["subtotalPaise"];
	        this.discountPaise = source["discountPaise"];
	        this.taxPaise = source["taxPaise"];
	        this.roundoffPaise = source["roundoffPaise"];
	        this.totalPaise = source["totalPaise"];
	        this.notes = source["notes"];
	        this.createdAt = source["createdAt"];
	        this.items = this.convertValues(source["items"], InvoiceItem);
	        this.payments = this.convertValues(source["payments"], InvoicePayment);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class MessageTemplate {
	    id: string;
	    tenantId: string;
	    name: string;
	    templateType: string;
	    content: string;
	    isActive: boolean;
	
	    static createFrom(source: any = {}) {
	        return new MessageTemplate(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.tenantId = source["tenantId"];
	        this.name = source["name"];
	        this.templateType = source["templateType"];
	        this.content = source["content"];
	        this.isActive = source["isActive"];
	    }
	}
	export class PaymentEntry {
	    id: string;
	    tenantId: string;
	    storeId: string;
	    paymentTypeId: string;
	    partyType: string;
	    partyId: string;
	    amountPaise: number;
	    paymentMethod: string;
	    referenceNumber: string;
	    narration: string;
	    entryDate: string;
	
	    static createFrom(source: any = {}) {
	        return new PaymentEntry(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.tenantId = source["tenantId"];
	        this.storeId = source["storeId"];
	        this.paymentTypeId = source["paymentTypeId"];
	        this.partyType = source["partyType"];
	        this.partyId = source["partyId"];
	        this.amountPaise = source["amountPaise"];
	        this.paymentMethod = source["paymentMethod"];
	        this.referenceNumber = source["referenceNumber"];
	        this.narration = source["narration"];
	        this.entryDate = source["entryDate"];
	    }
	}
	export class PaymentInput {
	    method: string;
	    amountPaise: number;
	    referenceNumber: string;
	
	    static createFrom(source: any = {}) {
	        return new PaymentInput(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.method = source["method"];
	        this.amountPaise = source["amountPaise"];
	        this.referenceNumber = source["referenceNumber"];
	    }
	}
	export class PaymentMaster {
	    id: string;
	    tenantId: string;
	    name: string;
	    isActive: boolean;
	
	    static createFrom(source: any = {}) {
	        return new PaymentMaster(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.tenantId = source["tenantId"];
	        this.name = source["name"];
	        this.isActive = source["isActive"];
	    }
	}
	export class Product {
	    id: string;
	    tenantId: string;
	    name: string;
	    sku: string;
	    barcode: string;
	    hsnCode: string;
	    categoryId: string;
	    brandId: string;
	    unitId: string;
	    taxPercent: number;
	    isActive: boolean;
	    isKit: boolean;
	    description: string;
	    alertQuantityMillis: number;
	    purchasePricePaise: number;
	    productCode: string;
	    gstApplicable: boolean;
	    groupCode: string;
	    groupName: string;
	    autoQtyMillis: number;
	    openingQtyMillis: number;
	    reorderQtyMillis: number;
	    isService: boolean;
	    size: string;
	    colour: string;
	    expiryMonth: string;
	    location: string;
	    terms: string;
	    productTags: string;
	
	    static createFrom(source: any = {}) {
	        return new Product(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.tenantId = source["tenantId"];
	        this.name = source["name"];
	        this.sku = source["sku"];
	        this.barcode = source["barcode"];
	        this.hsnCode = source["hsnCode"];
	        this.categoryId = source["categoryId"];
	        this.brandId = source["brandId"];
	        this.unitId = source["unitId"];
	        this.taxPercent = source["taxPercent"];
	        this.isActive = source["isActive"];
	        this.isKit = source["isKit"];
	        this.description = source["description"];
	        this.alertQuantityMillis = source["alertQuantityMillis"];
	        this.purchasePricePaise = source["purchasePricePaise"];
	        this.productCode = source["productCode"];
	        this.gstApplicable = source["gstApplicable"];
	        this.groupCode = source["groupCode"];
	        this.groupName = source["groupName"];
	        this.autoQtyMillis = source["autoQtyMillis"];
	        this.openingQtyMillis = source["openingQtyMillis"];
	        this.reorderQtyMillis = source["reorderQtyMillis"];
	        this.isService = source["isService"];
	        this.size = source["size"];
	        this.colour = source["colour"];
	        this.expiryMonth = source["expiryMonth"];
	        this.location = source["location"];
	        this.terms = source["terms"];
	        this.productTags = source["productTags"];
	    }
	}
	export class ProductPrice {
	    id: string;
	    productId: string;
	    tier: string;
	    pricePaise: number;
	    validFrom: string;
	
	    static createFrom(source: any = {}) {
	        return new ProductPrice(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.productId = source["productId"];
	        this.tier = source["tier"];
	        this.pricePaise = source["pricePaise"];
	        this.validFrom = source["validFrom"];
	    }
	}
	export class ProductRawMaterial {
	    id: string;
	    productId: string;
	    name: string;
	    qtyMillis: number;
	    unit: string;
	    sortOrder: number;
	
	    static createFrom(source: any = {}) {
	        return new ProductRawMaterial(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.productId = source["productId"];
	        this.name = source["name"];
	        this.qtyMillis = source["qtyMillis"];
	        this.unit = source["unit"];
	        this.sortOrder = source["sortOrder"];
	    }
	}
	export class ProductSubItem {
	    id: string;
	    productId: string;
	    name: string;
	    value: string;
	    sortOrder: number;
	
	    static createFrom(source: any = {}) {
	        return new ProductSubItem(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.productId = source["productId"];
	        this.name = source["name"];
	        this.value = source["value"];
	        this.sortOrder = source["sortOrder"];
	    }
	}
	export class ProductWithPrices {
	    id: string;
	    tenantId: string;
	    name: string;
	    sku: string;
	    barcode: string;
	    hsnCode: string;
	    categoryId: string;
	    brandId: string;
	    unitId: string;
	    taxPercent: number;
	    isActive: boolean;
	    isKit: boolean;
	    description: string;
	    alertQuantityMillis: number;
	    purchasePricePaise: number;
	    productCode: string;
	    gstApplicable: boolean;
	    groupCode: string;
	    groupName: string;
	    autoQtyMillis: number;
	    openingQtyMillis: number;
	    reorderQtyMillis: number;
	    isService: boolean;
	    size: string;
	    colour: string;
	    expiryMonth: string;
	    location: string;
	    terms: string;
	    productTags: string;
	    prices: ProductPrice[];
	    stockQtyMillis: number;
	    categoryName: string;
	    brandName: string;
	    subItems: ProductSubItem[];
	    rawMaterials: ProductRawMaterial[];
	
	    static createFrom(source: any = {}) {
	        return new ProductWithPrices(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.tenantId = source["tenantId"];
	        this.name = source["name"];
	        this.sku = source["sku"];
	        this.barcode = source["barcode"];
	        this.hsnCode = source["hsnCode"];
	        this.categoryId = source["categoryId"];
	        this.brandId = source["brandId"];
	        this.unitId = source["unitId"];
	        this.taxPercent = source["taxPercent"];
	        this.isActive = source["isActive"];
	        this.isKit = source["isKit"];
	        this.description = source["description"];
	        this.alertQuantityMillis = source["alertQuantityMillis"];
	        this.purchasePricePaise = source["purchasePricePaise"];
	        this.productCode = source["productCode"];
	        this.gstApplicable = source["gstApplicable"];
	        this.groupCode = source["groupCode"];
	        this.groupName = source["groupName"];
	        this.autoQtyMillis = source["autoQtyMillis"];
	        this.openingQtyMillis = source["openingQtyMillis"];
	        this.reorderQtyMillis = source["reorderQtyMillis"];
	        this.isService = source["isService"];
	        this.size = source["size"];
	        this.colour = source["colour"];
	        this.expiryMonth = source["expiryMonth"];
	        this.location = source["location"];
	        this.terms = source["terms"];
	        this.productTags = source["productTags"];
	        this.prices = this.convertValues(source["prices"], ProductPrice);
	        this.stockQtyMillis = source["stockQtyMillis"];
	        this.categoryName = source["categoryName"];
	        this.brandName = source["brandName"];
	        this.subItems = this.convertValues(source["subItems"], ProductSubItem);
	        this.rawMaterials = this.convertValues(source["rawMaterials"], ProductRawMaterial);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class PurchaseOrder {
	    id: string;
	    tenantId: string;
	    storeId: string;
	    companyId: string;
	    orderNumber: string;
	    orderDate: string;
	    status: string;
	    subtotalPaise: number;
	    taxPaise: number;
	    totalPaise: number;
	    notes: string;
	
	    static createFrom(source: any = {}) {
	        return new PurchaseOrder(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.tenantId = source["tenantId"];
	        this.storeId = source["storeId"];
	        this.companyId = source["companyId"];
	        this.orderNumber = source["orderNumber"];
	        this.orderDate = source["orderDate"];
	        this.status = source["status"];
	        this.subtotalPaise = source["subtotalPaise"];
	        this.taxPaise = source["taxPaise"];
	        this.totalPaise = source["totalPaise"];
	        this.notes = source["notes"];
	    }
	}
	export class PurchaseOrderItem {
	    id: string;
	    orderId: string;
	    productId: string;
	    quantityMillis: number;
	    unitPricePaise: number;
	    taxPercent: number;
	    totalPaise: number;
	    receivedMillis: number;
	
	    static createFrom(source: any = {}) {
	        return new PurchaseOrderItem(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.orderId = source["orderId"];
	        this.productId = source["productId"];
	        this.quantityMillis = source["quantityMillis"];
	        this.unitPricePaise = source["unitPricePaise"];
	        this.taxPercent = source["taxPercent"];
	        this.totalPaise = source["totalPaise"];
	        this.receivedMillis = source["receivedMillis"];
	    }
	}
	export class PurchaseReturn {
	    id: string;
	    tenantId: string;
	    storeId: string;
	    purchaseId: string;
	    companyId: string;
	    returnNumber: string;
	    returnDate: string;
	    subtotalPaise: number;
	    taxPaise: number;
	    totalPaise: number;
	    notes: string;
	
	    static createFrom(source: any = {}) {
	        return new PurchaseReturn(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.tenantId = source["tenantId"];
	        this.storeId = source["storeId"];
	        this.purchaseId = source["purchaseId"];
	        this.companyId = source["companyId"];
	        this.returnNumber = source["returnNumber"];
	        this.returnDate = source["returnDate"];
	        this.subtotalPaise = source["subtotalPaise"];
	        this.taxPaise = source["taxPaise"];
	        this.totalPaise = source["totalPaise"];
	        this.notes = source["notes"];
	    }
	}
	export class PurchaseReturnItem {
	    id: string;
	    returnId: string;
	    productId: string;
	    quantityMillis: number;
	    unitPricePaise: number;
	    taxPercent: number;
	    totalPaise: number;
	
	    static createFrom(source: any = {}) {
	        return new PurchaseReturnItem(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.returnId = source["returnId"];
	        this.productId = source["productId"];
	        this.quantityMillis = source["quantityMillis"];
	        this.unitPricePaise = source["unitPricePaise"];
	        this.taxPercent = source["taxPercent"];
	        this.totalPaise = source["totalPaise"];
	    }
	}
	export class Quotation {
	    id: string;
	    tenantId: string;
	    storeId: string;
	    customerId: string;
	    quotationNumber: string;
	    quotationDate: string;
	    validUntil: string;
	    status: string;
	    subtotalPaise: number;
	    discountPaise: number;
	    taxPaise: number;
	    totalPaise: number;
	    notes: string;
	
	    static createFrom(source: any = {}) {
	        return new Quotation(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.tenantId = source["tenantId"];
	        this.storeId = source["storeId"];
	        this.customerId = source["customerId"];
	        this.quotationNumber = source["quotationNumber"];
	        this.quotationDate = source["quotationDate"];
	        this.validUntil = source["validUntil"];
	        this.status = source["status"];
	        this.subtotalPaise = source["subtotalPaise"];
	        this.discountPaise = source["discountPaise"];
	        this.taxPaise = source["taxPaise"];
	        this.totalPaise = source["totalPaise"];
	        this.notes = source["notes"];
	    }
	}
	export class QuotationItem {
	    id: string;
	    quotationId: string;
	    productId: string;
	    quantityMillis: number;
	    unitPricePaise: number;
	    discountPaise: number;
	    taxPercent: number;
	    totalPaise: number;
	
	    static createFrom(source: any = {}) {
	        return new QuotationItem(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.quotationId = source["quotationId"];
	        this.productId = source["productId"];
	        this.quantityMillis = source["quantityMillis"];
	        this.unitPricePaise = source["unitPricePaise"];
	        this.discountPaise = source["discountPaise"];
	        this.taxPercent = source["taxPercent"];
	        this.totalPaise = source["totalPaise"];
	    }
	}
	export class SaleLineInput {
	    productId: string;
	    productName: string;
	    hsnCode: string;
	    quantityMillis: number;
	    priceTier: string;
	    unitPricePaise: number;
	    discountPaise: number;
	    taxPercent: number;
	
	    static createFrom(source: any = {}) {
	        return new SaleLineInput(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.productId = source["productId"];
	        this.productName = source["productName"];
	        this.hsnCode = source["hsnCode"];
	        this.quantityMillis = source["quantityMillis"];
	        this.priceTier = source["priceTier"];
	        this.unitPricePaise = source["unitPricePaise"];
	        this.discountPaise = source["discountPaise"];
	        this.taxPercent = source["taxPercent"];
	    }
	}
	export class SaleDraft {
	    customerId: string;
	    lines: SaleLineInput[];
	    payments: PaymentInput[];
	    notes: string;
	    terms: string;
	    createdBy: string;
	    createdByEmail: string;
	
	    static createFrom(source: any = {}) {
	        return new SaleDraft(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.customerId = source["customerId"];
	        this.lines = this.convertValues(source["lines"], SaleLineInput);
	        this.payments = this.convertValues(source["payments"], PaymentInput);
	        this.notes = source["notes"];
	        this.terms = source["terms"];
	        this.createdBy = source["createdBy"];
	        this.createdByEmail = source["createdByEmail"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	export class SaleOrder {
	    id: string;
	    tenantId: string;
	    storeId: string;
	    customerId: string;
	    orderNumber: string;
	    orderDate: string;
	    status: string;
	    subtotalPaise: number;
	    taxPaise: number;
	    totalPaise: number;
	    notes: string;
	
	    static createFrom(source: any = {}) {
	        return new SaleOrder(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.tenantId = source["tenantId"];
	        this.storeId = source["storeId"];
	        this.customerId = source["customerId"];
	        this.orderNumber = source["orderNumber"];
	        this.orderDate = source["orderDate"];
	        this.status = source["status"];
	        this.subtotalPaise = source["subtotalPaise"];
	        this.taxPaise = source["taxPaise"];
	        this.totalPaise = source["totalPaise"];
	        this.notes = source["notes"];
	    }
	}
	export class SaleOrderItem {
	    id: string;
	    orderId: string;
	    productId: string;
	    quantityMillis: number;
	    unitPricePaise: number;
	    taxPercent: number;
	    totalPaise: number;
	    deliveredMillis: number;
	
	    static createFrom(source: any = {}) {
	        return new SaleOrderItem(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.orderId = source["orderId"];
	        this.productId = source["productId"];
	        this.quantityMillis = source["quantityMillis"];
	        this.unitPricePaise = source["unitPricePaise"];
	        this.taxPercent = source["taxPercent"];
	        this.totalPaise = source["totalPaise"];
	        this.deliveredMillis = source["deliveredMillis"];
	    }
	}
	export class SalesReturn {
	    id: string;
	    tenantId: string;
	    storeId: string;
	    invoiceId: string;
	    customerId: string;
	    returnNumber: string;
	    returnDate: string;
	    subtotalPaise: number;
	    taxPaise: number;
	    totalPaise: number;
	    notes: string;
	
	    static createFrom(source: any = {}) {
	        return new SalesReturn(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.tenantId = source["tenantId"];
	        this.storeId = source["storeId"];
	        this.invoiceId = source["invoiceId"];
	        this.customerId = source["customerId"];
	        this.returnNumber = source["returnNumber"];
	        this.returnDate = source["returnDate"];
	        this.subtotalPaise = source["subtotalPaise"];
	        this.taxPaise = source["taxPaise"];
	        this.totalPaise = source["totalPaise"];
	        this.notes = source["notes"];
	    }
	}
	export class SalesReturnItem {
	    id: string;
	    returnId: string;
	    productId: string;
	    quantityMillis: number;
	    unitPricePaise: number;
	    taxPercent: number;
	    totalPaise: number;
	
	    static createFrom(source: any = {}) {
	        return new SalesReturnItem(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.returnId = source["returnId"];
	        this.productId = source["productId"];
	        this.quantityMillis = source["quantityMillis"];
	        this.unitPricePaise = source["unitPricePaise"];
	        this.taxPercent = source["taxPercent"];
	        this.totalPaise = source["totalPaise"];
	    }
	}
	export class ServiceReminder {
	    id: string;
	    tenantId: string;
	    customerId: string;
	    customerName: string;
	    phone: string;
	    vehicleNumber: string;
	    serviceType: string;
	    reminderDate: string;
	    status: string;
	    notes: string;
	
	    static createFrom(source: any = {}) {
	        return new ServiceReminder(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.tenantId = source["tenantId"];
	        this.customerId = source["customerId"];
	        this.customerName = source["customerName"];
	        this.phone = source["phone"];
	        this.vehicleNumber = source["vehicleNumber"];
	        this.serviceType = source["serviceType"];
	        this.reminderDate = source["reminderDate"];
	        this.status = source["status"];
	        this.notes = source["notes"];
	    }
	}
	export class StockEntry {
	    productId: string;
	    productName: string;
	    sku: string;
	    barcode: string;
	    categoryName: string;
	    brandName: string;
	    quantityMillis: number;
	    mrpPaise: number;
	
	    static createFrom(source: any = {}) {
	        return new StockEntry(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.productId = source["productId"];
	        this.productName = source["productName"];
	        this.sku = source["sku"];
	        this.barcode = source["barcode"];
	        this.categoryName = source["categoryName"];
	        this.brandName = source["brandName"];
	        this.quantityMillis = source["quantityMillis"];
	        this.mrpPaise = source["mrpPaise"];
	    }
	}
	export class StockTransfer {
	    id: string;
	    tenantId: string;
	    fromStoreId: string;
	    toStoreId: string;
	    transferNumber: string;
	    transferDate: string;
	    status: string;
	    notes: string;
	
	    static createFrom(source: any = {}) {
	        return new StockTransfer(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.tenantId = source["tenantId"];
	        this.fromStoreId = source["fromStoreId"];
	        this.toStoreId = source["toStoreId"];
	        this.transferNumber = source["transferNumber"];
	        this.transferDate = source["transferDate"];
	        this.status = source["status"];
	        this.notes = source["notes"];
	    }
	}
	export class StockTransferItem {
	    id: string;
	    transferId: string;
	    productId: string;
	    quantityMillis: number;
	
	    static createFrom(source: any = {}) {
	        return new StockTransferItem(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.transferId = source["transferId"];
	        this.productId = source["productId"];
	        this.quantityMillis = source["quantityMillis"];
	    }
	}
	export class Voucher {
	    id: string;
	    tenantId: string;
	    storeId: string;
	    voucherType: string;
	    voucherNumber: string;
	    partyType: string;
	    partyId: string;
	    amountPaise: number;
	    method: string;
	    referenceNumber: string;
	    narration: string;
	    registerId: string;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new Voucher(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.tenantId = source["tenantId"];
	        this.storeId = source["storeId"];
	        this.voucherType = source["voucherType"];
	        this.voucherNumber = source["voucherNumber"];
	        this.partyType = source["partyType"];
	        this.partyId = source["partyId"];
	        this.amountPaise = source["amountPaise"];
	        this.method = source["method"];
	        this.referenceNumber = source["referenceNumber"];
	        this.narration = source["narration"];
	        this.registerId = source["registerId"];
	        this.createdAt = source["createdAt"];
	    }
	}

}

export namespace printing {
	
	export class PrintResult {
	    jobId: string;
	    success: boolean;
	    error?: string;
	
	    static createFrom(source: any = {}) {
	        return new PrintResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.jobId = source["jobId"];
	        this.success = source["success"];
	        this.error = source["error"];
	    }
	}
	export class PrinterConfig {
	    name: string;
	    connectionType: string;
	    address: string;
	    port: number;
	    paperWidth: number;
	    isDefault: boolean;
	
	    static createFrom(source: any = {}) {
	        return new PrinterConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.connectionType = source["connectionType"];
	        this.address = source["address"];
	        this.port = source["port"];
	        this.paperWidth = source["paperWidth"];
	        this.isDefault = source["isDefault"];
	    }
	}
	export class QueueStatus {
	    pending: number;
	    printing: boolean;
	
	    static createFrom(source: any = {}) {
	        return new QueueStatus(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.pending = source["pending"];
	        this.printing = source["printing"];
	    }
	}

}

export namespace reports {
	
	export class AccountLineItem {
	    account: string;
	    amountPaise: number;
	
	    static createFrom(source: any = {}) {
	        return new AccountLineItem(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.account = source["account"];
	        this.amountPaise = source["amountPaise"];
	    }
	}
	export class BalanceSheetResult {
	    liabilities: AccountLineItem[];
	    assets: AccountLineItem[];
	
	    static createFrom(source: any = {}) {
	        return new BalanceSheetResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.liabilities = this.convertValues(source["liabilities"], AccountLineItem);
	        this.assets = this.convertValues(source["assets"], AccountLineItem);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class BankBookEntry {
	    date: string;
	    description: string;
	    debit: number;
	    credit: number;
	    balance: number;
	
	    static createFrom(source: any = {}) {
	        return new BankBookEntry(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.date = source["date"];
	        this.description = source["description"];
	        this.debit = source["debit"];
	        this.credit = source["credit"];
	        this.balance = source["balance"];
	    }
	}
	export class BrandSummaryRow {
	    brandName: string;
	    saleQtyMillis: number;
	    saleAmountPaise: number;
	    purchQtyMillis: number;
	    purchAmountPaise: number;
	
	    static createFrom(source: any = {}) {
	        return new BrandSummaryRow(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.brandName = source["brandName"];
	        this.saleQtyMillis = source["saleQtyMillis"];
	        this.saleAmountPaise = source["saleAmountPaise"];
	        this.purchQtyMillis = source["purchQtyMillis"];
	        this.purchAmountPaise = source["purchAmountPaise"];
	    }
	}
	export class CategorySummaryRow {
	    categoryName: string;
	    saleQtyMillis: number;
	    saleAmountPaise: number;
	    purchQtyMillis: number;
	    purchAmountPaise: number;
	
	    static createFrom(source: any = {}) {
	        return new CategorySummaryRow(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.categoryName = source["categoryName"];
	        this.saleQtyMillis = source["saleQtyMillis"];
	        this.saleAmountPaise = source["saleAmountPaise"];
	        this.purchQtyMillis = source["purchQtyMillis"];
	        this.purchAmountPaise = source["purchAmountPaise"];
	    }
	}
	export class EmployeeSaleRow {
	    employeeName: string;
	    saleCount: number;
	    saleAmountPaise: number;
	    returnsPaise: number;
	    netAmountPaise: number;
	
	    static createFrom(source: any = {}) {
	        return new EmployeeSaleRow(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.employeeName = source["employeeName"];
	        this.saleCount = source["saleCount"];
	        this.saleAmountPaise = source["saleAmountPaise"];
	        this.returnsPaise = source["returnsPaise"];
	        this.netAmountPaise = source["netAmountPaise"];
	    }
	}
	export class GSTInvoiceRow {
	    gstin: string;
	    invoiceNo: string;
	    date: string;
	    taxablePaise: number;
	    cgstPaise: number;
	    sgstPaise: number;
	    igstPaise: number;
	    totalPaise: number;
	
	    static createFrom(source: any = {}) {
	        return new GSTInvoiceRow(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.gstin = source["gstin"];
	        this.invoiceNo = source["invoiceNo"];
	        this.date = source["date"];
	        this.taxablePaise = source["taxablePaise"];
	        this.cgstPaise = source["cgstPaise"];
	        this.sgstPaise = source["sgstPaise"];
	        this.igstPaise = source["igstPaise"];
	        this.totalPaise = source["totalPaise"];
	    }
	}
	export class GSTR1Section {
	    section: string;
	    records: number;
	    invoicePaise: number;
	    taxablePaise: number;
	    igstPaise: number;
	    cgstPaise: number;
	    sgstPaise: number;
	
	    static createFrom(source: any = {}) {
	        return new GSTR1Section(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.section = source["section"];
	        this.records = source["records"];
	        this.invoicePaise = source["invoicePaise"];
	        this.taxablePaise = source["taxablePaise"];
	        this.igstPaise = source["igstPaise"];
	        this.cgstPaise = source["cgstPaise"];
	        this.sgstPaise = source["sgstPaise"];
	    }
	}
	export class HSNSummaryRow {
	    hsnCode: string;
	    description: string;
	    qtyMillis: number;
	    taxablePaise: number;
	    taxPaise: number;
	    totalPaise: number;
	
	    static createFrom(source: any = {}) {
	        return new HSNSummaryRow(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.hsnCode = source["hsnCode"];
	        this.description = source["description"];
	        this.qtyMillis = source["qtyMillis"];
	        this.taxablePaise = source["taxablePaise"];
	        this.taxPaise = source["taxPaise"];
	        this.totalPaise = source["totalPaise"];
	    }
	}
	export class GSTR1SummaryResult {
	    sections: GSTR1Section[];
	    hsn: HSNSummaryRow[];
	    totalTaxablePaise: number;
	    totalTaxPaise: number;
	
	    static createFrom(source: any = {}) {
	        return new GSTR1SummaryResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.sections = this.convertValues(source["sections"], GSTR1Section);
	        this.hsn = this.convertValues(source["hsn"], HSNSummaryRow);
	        this.totalTaxablePaise = source["totalTaxablePaise"];
	        this.totalTaxPaise = source["totalTaxPaise"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class GSTR2BCategory {
	    category: string;
	    invoices: number;
	    taxablePaise: number;
	    igstPaise: number;
	    cgstPaise: number;
	    sgstPaise: number;
	    totalItcPaise: number;
	
	    static createFrom(source: any = {}) {
	        return new GSTR2BCategory(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.category = source["category"];
	        this.invoices = source["invoices"];
	        this.taxablePaise = source["taxablePaise"];
	        this.igstPaise = source["igstPaise"];
	        this.cgstPaise = source["cgstPaise"];
	        this.sgstPaise = source["sgstPaise"];
	        this.totalItcPaise = source["totalItcPaise"];
	    }
	}
	export class GSTR2BResult {
	    registered: GSTR2BCategory;
	    unregistered: GSTR2BCategory;
	    totalEligible: GSTR2BCategory;
	
	    static createFrom(source: any = {}) {
	        return new GSTR2BResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.registered = this.convertValues(source["registered"], GSTR2BCategory);
	        this.unregistered = this.convertValues(source["unregistered"], GSTR2BCategory);
	        this.totalEligible = this.convertValues(source["totalEligible"], GSTR2BCategory);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class HealthCheck {
	    label: string;
	    detail: string;
	    ok: boolean;
	
	    static createFrom(source: any = {}) {
	        return new HealthCheck(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.label = source["label"];
	        this.detail = source["detail"];
	        this.ok = source["ok"];
	    }
	}
	export class GSTR3BSectionRow {
	    description: string;
	    taxablePaise: number;
	    cgstPaise: number;
	    sgstPaise: number;
	    igstPaise: number;
	    totalPaise: number;
	
	    static createFrom(source: any = {}) {
	        return new GSTR3BSectionRow(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.description = source["description"];
	        this.taxablePaise = source["taxablePaise"];
	        this.cgstPaise = source["cgstPaise"];
	        this.sgstPaise = source["sgstPaise"];
	        this.igstPaise = source["igstPaise"];
	        this.totalPaise = source["totalPaise"];
	    }
	}
	export class GSTR3BResult {
	    outward: GSTR3BSectionRow[];
	    inward: GSTR3BSectionRow[];
	    itc: GSTR3BSectionRow[];
	    taxPayable: GSTR3BSectionRow[];
	    outputTaxPaise: number;
	    itcAvailablePaise: number;
	    netPayablePaise: number;
	    healthChecks: HealthCheck[];
	
	    static createFrom(source: any = {}) {
	        return new GSTR3BResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.outward = this.convertValues(source["outward"], GSTR3BSectionRow);
	        this.inward = this.convertValues(source["inward"], GSTR3BSectionRow);
	        this.itc = this.convertValues(source["itc"], GSTR3BSectionRow);
	        this.taxPayable = this.convertValues(source["taxPayable"], GSTR3BSectionRow);
	        this.outputTaxPaise = source["outputTaxPaise"];
	        this.itcAvailablePaise = source["itcAvailablePaise"];
	        this.netPayablePaise = source["netPayablePaise"];
	        this.healthChecks = this.convertValues(source["healthChecks"], HealthCheck);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	export class GSTRateSummaryRow {
	    ratePercent: number;
	    taxablePaise: number;
	    cgstPaise: number;
	    sgstPaise: number;
	    igstPaise: number;
	    totalPaise: number;
	
	    static createFrom(source: any = {}) {
	        return new GSTRateSummaryRow(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.ratePercent = source["ratePercent"];
	        this.taxablePaise = source["taxablePaise"];
	        this.cgstPaise = source["cgstPaise"];
	        this.sgstPaise = source["sgstPaise"];
	        this.igstPaise = source["igstPaise"];
	        this.totalPaise = source["totalPaise"];
	    }
	}
	export class GSTWiseRow {
	    ratePercent: number;
	    saleTaxablePaise: number;
	    saleTaxPaise: number;
	    purchTaxablePaise: number;
	    purchTaxPaise: number;
	
	    static createFrom(source: any = {}) {
	        return new GSTWiseRow(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.ratePercent = source["ratePercent"];
	        this.saleTaxablePaise = source["saleTaxablePaise"];
	        this.saleTaxPaise = source["saleTaxPaise"];
	        this.purchTaxablePaise = source["purchTaxablePaise"];
	        this.purchTaxPaise = source["purchTaxPaise"];
	    }
	}
	
	
	export class ItemSaleQtyRow {
	    itemName: string;
	    sku: string;
	    categoryName: string;
	    brandName: string;
	    qtySoldMillis: number;
	    saleAmountPaise: number;
	
	    static createFrom(source: any = {}) {
	        return new ItemSaleQtyRow(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.itemName = source["itemName"];
	        this.sku = source["sku"];
	        this.categoryName = source["categoryName"];
	        this.brandName = source["brandName"];
	        this.qtySoldMillis = source["qtySoldMillis"];
	        this.saleAmountPaise = source["saleAmountPaise"];
	    }
	}
	export class ItemSummaryRow {
	    itemName: string;
	    sku: string;
	    saleQtyMillis: number;
	    saleAmountPaise: number;
	    purchQtyMillis: number;
	    purchAmountPaise: number;
	
	    static createFrom(source: any = {}) {
	        return new ItemSummaryRow(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.itemName = source["itemName"];
	        this.sku = source["sku"];
	        this.saleQtyMillis = source["saleQtyMillis"];
	        this.saleAmountPaise = source["saleAmountPaise"];
	        this.purchQtyMillis = source["purchQtyMillis"];
	        this.purchAmountPaise = source["purchAmountPaise"];
	    }
	}
	export class LedgerRow {
	    date: string;
	    description: string;
	    amount: number;
	    paymentMethod: string;
	    reference: string;
	
	    static createFrom(source: any = {}) {
	        return new LedgerRow(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.date = source["date"];
	        this.description = source["description"];
	        this.amount = source["amount"];
	        this.paymentMethod = source["paymentMethod"];
	        this.reference = source["reference"];
	    }
	}
	export class OrderRow {
	    id: string;
	    orderType: string;
	    orderNumber: string;
	    date: string;
	    partyName: string;
	    status: string;
	    totalPaise: number;
	
	    static createFrom(source: any = {}) {
	        return new OrderRow(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.orderType = source["orderType"];
	        this.orderNumber = source["orderNumber"];
	        this.date = source["date"];
	        this.partyName = source["partyName"];
	        this.status = source["status"];
	        this.totalPaise = source["totalPaise"];
	    }
	}
	export class OutstandingRow {
	    partyId: string;
	    partyName: string;
	    totalPaise: number;
	    paidPaise: number;
	    balancePaise: number;
	
	    static createFrom(source: any = {}) {
	        return new OutstandingRow(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.partyId = source["partyId"];
	        this.partyName = source["partyName"];
	        this.totalPaise = source["totalPaise"];
	        this.paidPaise = source["paidPaise"];
	        this.balancePaise = source["balancePaise"];
	    }
	}
	export class PartySummaryRow {
	    partyName: string;
	    partyType: string;
	    saleAmountPaise: number;
	    purchAmountPaise: number;
	    balancePaise: number;
	
	    static createFrom(source: any = {}) {
	        return new PartySummaryRow(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.partyName = source["partyName"];
	        this.partyType = source["partyType"];
	        this.saleAmountPaise = source["saleAmountPaise"];
	        this.purchAmountPaise = source["purchAmountPaise"];
	        this.balancePaise = source["balancePaise"];
	    }
	}
	export class PaymentDetailRow {
	    id: string;
	    date: string;
	    partyType: string;
	    partyName: string;
	    paymentMethod: string;
	    amountPaise: number;
	    reference: string;
	    narration: string;
	
	    static createFrom(source: any = {}) {
	        return new PaymentDetailRow(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.date = source["date"];
	        this.partyType = source["partyType"];
	        this.partyName = source["partyName"];
	        this.paymentMethod = source["paymentMethod"];
	        this.amountPaise = source["amountPaise"];
	        this.reference = source["reference"];
	        this.narration = source["narration"];
	    }
	}
	export class ProfitLossResult {
	    expenses: AccountLineItem[];
	    income: AccountLineItem[];
	
	    static createFrom(source: any = {}) {
	        return new ProfitLossResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.expenses = this.convertValues(source["expenses"], AccountLineItem);
	        this.income = this.convertValues(source["income"], AccountLineItem);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class PurchaseSummaryRow {
	    date: string;
	    orderCount: number;
	    totalPaise: number;
	
	    static createFrom(source: any = {}) {
	        return new PurchaseSummaryRow(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.date = source["date"];
	        this.orderCount = source["orderCount"];
	        this.totalPaise = source["totalPaise"];
	    }
	}
	export class RojmelEntry {
	    date: string;
	    particulars: string;
	    voucherNo: string;
	    receiptPaise: number;
	    paymentPaise: number;
	    balancePaise: number;
	
	    static createFrom(source: any = {}) {
	        return new RojmelEntry(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.date = source["date"];
	        this.particulars = source["particulars"];
	        this.voucherNo = source["voucherNo"];
	        this.receiptPaise = source["receiptPaise"];
	        this.paymentPaise = source["paymentPaise"];
	        this.balancePaise = source["balancePaise"];
	    }
	}
	export class RojmelResult {
	    openingBalancePaise: number;
	    entries: RojmelEntry[];
	
	    static createFrom(source: any = {}) {
	        return new RojmelResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.openingBalancePaise = source["openingBalancePaise"];
	        this.entries = this.convertValues(source["entries"], RojmelEntry);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class SaleSummaryRow {
	    date: string;
	    invoiceCount: number;
	    totalPaise: number;
	    cashPaise: number;
	    upiPaise: number;
	    cardPaise: number;
	    creditPaise: number;
	
	    static createFrom(source: any = {}) {
	        return new SaleSummaryRow(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.date = source["date"];
	        this.invoiceCount = source["invoiceCount"];
	        this.totalPaise = source["totalPaise"];
	        this.cashPaise = source["cashPaise"];
	        this.upiPaise = source["upiPaise"];
	        this.cardPaise = source["cardPaise"];
	        this.creditPaise = source["creditPaise"];
	    }
	}
	export class TCSReportRow {
	    invoiceNo: string;
	    date: string;
	    customerName: string;
	    amountPaise: number;
	    taxPercent: number;
	    taxAmountPaise: number;
	
	    static createFrom(source: any = {}) {
	        return new TCSReportRow(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.invoiceNo = source["invoiceNo"];
	        this.date = source["date"];
	        this.customerName = source["customerName"];
	        this.amountPaise = source["amountPaise"];
	        this.taxPercent = source["taxPercent"];
	        this.taxAmountPaise = source["taxAmountPaise"];
	    }
	}
	export class TradingAccountResult {
	    debitItems: AccountLineItem[];
	    creditItems: AccountLineItem[];
	
	    static createFrom(source: any = {}) {
	        return new TradingAccountResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.debitItems = this.convertValues(source["debitItems"], AccountLineItem);
	        this.creditItems = this.convertValues(source["creditItems"], AccountLineItem);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class TrialBalanceRow {
	    accountName: string;
	    debitPaise: number;
	    creditPaise: number;
	
	    static createFrom(source: any = {}) {
	        return new TrialBalanceRow(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.accountName = source["accountName"];
	        this.debitPaise = source["debitPaise"];
	        this.creditPaise = source["creditPaise"];
	    }
	}
	export class UdhaarRow {
	    customerId: string;
	    name: string;
	    phone: string;
	    bills: number;
	    days0_30Paise: number;
	    days31_60Paise: number;
	    days61_90Paise: number;
	    days90PlusPaise: number;
	    totalDuePaise: number;
	    oldestDays: number;
	
	    static createFrom(source: any = {}) {
	        return new UdhaarRow(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.customerId = source["customerId"];
	        this.name = source["name"];
	        this.phone = source["phone"];
	        this.bills = source["bills"];
	        this.days0_30Paise = source["days0_30Paise"];
	        this.days31_60Paise = source["days31_60Paise"];
	        this.days61_90Paise = source["days61_90Paise"];
	        this.days90PlusPaise = source["days90PlusPaise"];
	        this.totalDuePaise = source["totalDuePaise"];
	        this.oldestDays = source["oldestDays"];
	    }
	}

}

