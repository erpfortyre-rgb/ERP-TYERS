/// Persistence boundary for the Desktop Phase 3 billing workflow.
///
/// Implementations must persist the requested record groups atomically. This
/// interface intentionally does not define invoice finalization or stock
/// deduction rules.
abstract interface class OfflineBillingPersistence {
  Future<void> saveInvoice(InvoiceRecord invoice);

  Future<void> saveInvoiceItems(
    String invoiceId,
    List<InvoiceItemRecord> items,
  );

  Future<void> savePaymentAllocations(
    String invoiceId,
    List<PaymentAllocationRecord> allocations,
  );

  Future<void> createStockMovements(List<StockMovementRecord> movements);

  Future<void> addSyncOutboxEvent(SyncOutboxRecord event);
}

class InvoiceRecord {
  const InvoiceRecord({
    required this.id,
    required this.invoiceNumber,
    required this.invoiceDate,
    required this.subtotalPaise,
    required this.taxPaise,
    required this.totalPaise,
    this.branchId,
    this.customerId,
  });

  final String id;
  final String invoiceNumber;
  final DateTime invoiceDate;
  final int subtotalPaise;
  final int taxPaise;
  final int totalPaise;
  final String? branchId;
  final String? customerId;
}

class InvoiceItemRecord {
  const InvoiceItemRecord({
    required this.id,
    required this.productName,
    required this.quantity,
    required this.unitPricePaise,
    required this.lineTotalPaise,
    this.productId,
    this.sku,
    this.discountPercent = 0,
    this.taxPercent = 0,
  });

  final String id;
  final String? productId;
  final String productName;
  final String? sku;
  final double quantity;
  final int unitPricePaise;
  final double discountPercent;
  final double taxPercent;
  final int lineTotalPaise;
}

class PaymentAllocationRecord {
  const PaymentAllocationRecord({
    required this.id,
    required this.method,
    required this.amountPaise,
    this.reference,
  });

  final String id;
  final String method;
  final int amountPaise;
  final String? reference;
}

class StockMovementRecord {
  const StockMovementRecord({
    required this.id,
    required this.productId,
    required this.branchId,
    required this.movementType,
    required this.quantity,
    required this.createdAt,
    this.referenceId,
  });

  final String id;
  final String productId;
  final String branchId;
  final String movementType;
  final double quantity;
  final DateTime createdAt;
  final String? referenceId;
}

class SyncOutboxRecord {
  const SyncOutboxRecord({
    required this.id,
    required this.entityType,
    required this.entityId,
    required this.operation,
    required this.payloadJson,
    required this.createdAt,
  });

  final String id;
  final String entityType;
  final String entityId;
  final String operation;
  final String payloadJson;
  final DateTime createdAt;
}
