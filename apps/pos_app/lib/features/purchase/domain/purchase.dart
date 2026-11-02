class PurchaseProduct {
  const PurchaseProduct({
    required this.id,
    required this.name,
    required this.sku,
    required this.taxPercent,
  });

  final String id;
  final String name;
  final String sku;
  final double? taxPercent;
}

class PurchaseLineDraft {
  const PurchaseLineDraft({
    required this.productId,
    required this.quantityMilli,
    required this.unitCostPaise,
    this.discountPaise = 0,
  });

  final String productId;
  final int quantityMilli;
  final int unitCostPaise;
  final int discountPaise;
}

class PurchaseBillSummary {
  const PurchaseBillSummary({
    required this.id,
    required this.reference,
    required this.supplierInvoiceNumber,
    required this.supplierName,
    required this.branchName,
    required this.date,
    required this.totalPaise,
    required this.status,
  });

  final String id;
  final String reference;
  final String supplierInvoiceNumber;
  final String supplierName;
  final String branchName;
  final DateTime date;
  final int totalPaise;
  final String status;
}

class PurchaseDraftData {
  const PurchaseDraftData({
    required this.id,
    required this.supplierId,
    required this.supplierInvoiceNumber,
    required this.purchaseDate,
    required this.supplierInvoiceDate,
    required this.lines,
    required this.notes,
  });

  final String id;
  final String supplierId;
  final String supplierInvoiceNumber;
  final DateTime purchaseDate;
  final DateTime supplierInvoiceDate;
  final List<PurchaseLineDraft> lines;
  final String? notes;
}

class PurchaseReturnLineDraft {
  const PurchaseReturnLineDraft({
    required this.purchaseBillItemId,
    required this.quantityMilli,
  });

  final String purchaseBillItemId;
  final int quantityMilli;
}

class ReturnablePurchaseLine {
  const ReturnablePurchaseLine({
    required this.purchaseBillItemId,
    required this.productName,
    required this.sku,
    required this.availableQuantityMilli,
  });

  final String purchaseBillItemId;
  final String productName;
  final String sku;
  final int availableQuantityMilli;
}

class PurchaseReturnSummary {
  const PurchaseReturnSummary({
    required this.id,
    required this.purchaseReference,
    required this.supplierName,
    required this.reason,
    required this.status,
    required this.createdAt,
  });

  final String id;
  final String purchaseReference;
  final String supplierName;
  final String reason;
  final String status;
  final DateTime createdAt;
}

class PurchaseValidationException implements Exception {
  const PurchaseValidationException(this.message);
  final String message;
  @override
  String toString() => message;
}
