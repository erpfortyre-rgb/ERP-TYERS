String createInvoiceNumber({
  required String prefix,
  required int year,
  required int sequence,
}) {
  final normalized = prefix.trim().toUpperCase();
  if (!RegExp(r'^[A-Z0-9]{1,5}$').hasMatch(normalized)) {
    throw ArgumentError.value(
      prefix,
      'prefix',
      'Must be 1 to 5 letters/digits.',
    );
  }
  if (year < 0 || sequence <= 0) {
    throw ArgumentError(
      'Year must be non-negative and sequence must be positive.',
    );
  }
  return '$normalized-${year % 100}-${sequence.toString().padLeft(6, '0')}';
}
