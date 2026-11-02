import 'package:flutter_test/flutter_test.dart';
import 'package:pos_app/features/billing/domain/invoice_line.dart';

void main() {
  group('InvoiceLine', () {
    test('calculates discount before GST', () {
      const line = InvoiceLine(
        itemCode: 'TY-01',
        description: 'Tyre',
        quantity: 2,
        rate: 1000,
        discountPercent: 10,
        gstPercent: 18,
      );

      expect(line.grossAmount, 2000);
      expect(line.discountAmount, 200);
      expect(line.taxableAmount, 1800);
      expect(line.gstAmount, 324);
      expect(line.totalAmount, 2124);
    });

    test('supports fractional quantities and zero tax', () {
      const line = InvoiceLine(
        itemCode: '',
        description: 'Tube',
        quantity: 0.5,
        rate: 400,
        discountPercent: 0,
        gstPercent: 0,
      );

      expect(line.taxableAmount, 200);
      expect(line.gstAmount, 0);
      expect(line.totalAmount, 200);
    });
  });
}
