import 'package:flutter_test/flutter_test.dart';
import 'package:pos_app/features/billing/data/offline_billing_repository.dart';
import 'package:pos_app/features/customers/data/customers_repository.dart';
import 'package:pos_app/features/items/data/items_repository_impl.dart';
import 'package:pos_app/features/items/domain/item.dart';
import 'package:pos_app/features/parties/data/customer_ledger_repository.dart';
import 'package:uuid/uuid.dart';

import '../support/test_database.dart';

void main() {
  late TestDatabaseFixture fixture;
  setUp(() async => fixture = await createTestDatabase(prepareSale: true));
  tearDown(() => fixture.close());

  test(
    'customer ledger separates cash, unverified digital and credit',
    () async {
      final customer = await CustomersRepository(fixture.database)
          .create(name: 'Ledger customer', phone: '555-0101');
      final product = (await ItemsRepositoryImpl(fixture.database)
          .findBySku('TY-100'))!;
      final billing = OfflineBillingRepository(fixture.database);
      final invoice = billing.finalizeSale(
        SaleDraft(
          id: const Uuid().v4(),
          customerId: customer.id,
          lines: [
            SaleLineInput(
              productId: product.id,
              priceTier: PriceTier.mrp,
              quantityMilli: 1000,
            ),
          ],
          payments: const [
            SalePaymentInput(PaymentMethod.cash, 5000),
            SalePaymentInput(PaymentMethod.upi, 3000),
            SalePaymentInput(PaymentMethod.credit, 3800),
          ],
        ),
      );

      final repository = CustomerLedgerRepository(fixture.database);
      expect(repository.searchCustomers('555-0101').single.id, customer.id);
      final entry = repository.invoices(customer.id).single;
      expect(entry.invoiceNumber, invoice.invoiceNumber);
      expect(entry.totalPaise, 11800);
      expect(entry.cashRecordedPaise, 5000);
      expect(entry.digitalUnverifiedPaise, 3000);
      expect(entry.creditPaise, 3800);
      expect(entry.balanceNotConfirmedPaise, 6800);
    },
  );
}
