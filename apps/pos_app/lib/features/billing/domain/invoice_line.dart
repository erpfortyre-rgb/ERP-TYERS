class InvoiceLine {
  const InvoiceLine({
    required this.itemCode,
    required this.description,
    required this.quantity,
    required this.rate,
    required this.discountPercent,
    required this.gstPercent,
  });

  final String itemCode;
  final String description;
  final double quantity;
  final double rate;
  final double discountPercent;
  final double gstPercent;

  double get grossAmount => quantity * rate;

  double get discountAmount => grossAmount * discountPercent / 100;

  double get taxableAmount => grossAmount - discountAmount;

  double get gstAmount => taxableAmount * gstPercent / 100;

  double get totalAmount => taxableAmount + gstAmount;
}
