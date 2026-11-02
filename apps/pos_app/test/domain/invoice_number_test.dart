import 'package:flutter_test/flutter_test.dart';
import 'package:pos_app/features/billing/domain/invoice_number.dart';

void main() {
  test('formats normalized prefix and padded sequence', () {
    expect(
      createInvoiceNumber(prefix: 'c1', year: 2026, sequence: 1),
      'C1-26-000001',
    );
    expect(
      createInvoiceNumber(prefix: 'SST', year: 2101, sequence: 1234567),
      'SST-1-1234567',
    );
  });

  test('rejects invalid prefix and sequence', () {
    expect(
      () => createInvoiceNumber(prefix: 'with space', year: 2026, sequence: 1),
      throwsArgumentError,
    );
    expect(
      () => createInvoiceNumber(prefix: 'A', year: 2026, sequence: 0),
      throwsArgumentError,
    );
  });
}
