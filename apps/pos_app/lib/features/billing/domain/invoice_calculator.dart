import '../../items/domain/item.dart';

class BillingLine {
  const BillingLine({
    required this.productId,
    required this.name,
    required this.sku,
    required this.tier,
    required this.quantityMilli,
    required this.unitPricePaise,
    required this.discountBasisPoints,
    required this.taxPercent,
    this.originatingKitId,
  });

  final String productId;
  final String name;
  final String sku;
  final PriceTier tier;
  final int quantityMilli;
  final int unitPricePaise;
  final int discountBasisPoints;
  final double? taxPercent;
  final String? originatingKitId;

  int get grossPaise => _roundDiv(unitPricePaise * quantityMilli, 1000);
  int get discountPaise => _roundDiv(grossPaise * discountBasisPoints, 10000);
  int get taxablePaise => grossPaise - discountPaise;
  int get taxPaise => taxPercent == null
      ? 0
      : _roundDiv(taxablePaise * (taxPercent! * 100).round(), 10000);
  int get totalPaise => taxablePaise + taxPaise;
}

class InvoiceTotals {
  const InvoiceTotals({required this.subtotalPaise, required this.taxPaise});
  final int subtotalPaise;
  final int taxPaise;
  int get totalPaise => subtotalPaise + taxPaise;
}

InvoiceTotals calculateInvoice(Iterable<BillingLine> lines) => InvoiceTotals(
  subtotalPaise: lines.fold(0, (sum, line) => sum + line.taxablePaise),
  taxPaise: lines.fold(0, (sum, line) => sum + line.taxPaise),
);

int _roundDiv(int numerator, int denominator) =>
    (numerator + denominator ~/ 2) ~/ denominator;

String formatMoney(int paise) =>
    'INR ${paise ~/ 100}.${(paise % 100).toString().padLeft(2, '0')}';

String formatQuantity(int quantityMilli) =>
    '${quantityMilli ~/ 1000}.${(quantityMilli % 1000).toString().padLeft(3, '0')}';
