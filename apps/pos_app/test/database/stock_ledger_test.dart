import 'package:flutter_test/flutter_test.dart';
import 'package:pos_app/features/billing/data/offline_billing_repository.dart';
import 'package:pos_app/features/items/data/items_repository_impl.dart';
import 'package:pos_app/features/items/domain/item.dart';
import 'package:uuid/uuid.dart';

import '../support/test_database.dart';

void main() {
  late TestDatabaseFixture fixture;
  setUpAll(() async => fixture = await createTestDatabase(prepareSale: true));
  tearDownAll(() => fixture.close());

  test(
    'finalized sale writes one stock movement and matching balance change',
    () async {
      final database = fixture.database;
      final product = (await ItemsRepositoryImpl(database)
          .findBySku('TY-100'))!;
      final invoice = OfflineBillingRepository(database).finalizeSale(
        SaleDraft(
          id: const Uuid().v4(),
          lines: [
            SaleLineInput(
              productId: product.id,
              priceTier: PriceTier.mrp,
              quantityMilli: 1000,
              unitPricePaise: 10000,
            ),
          ],
          payments: const [SalePaymentInput(PaymentMethod.cash, 11800)],
        ),
      );
      final movement = database
          .select(
            '''SELECT quantity FROM stock_movements
               WHERE reference_id = ? AND movement_type = 'SALE' ''',
            [invoice.id],
          )
          .single;
      expect(movement['quantity'], -1.0);
      expect(
        database.select('SELECT quantity FROM local_stock').single['quantity'],
        99.0,
      );
    },
  );
}
