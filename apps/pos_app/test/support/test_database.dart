import 'dart:io';

import 'package:pos_app/database/app_database.dart';
import 'package:pos_app/database/encryption/key_manager.dart';
import 'package:pos_app/features/billing/data/offline_billing_repository.dart';
import 'package:pos_app/features/items/data/items_repository_impl.dart';
import 'package:pos_app/features/items/domain/item.dart';

class TestKeyStore implements DatabaseKeyStore {
  String? value;
  @override
  Future<String?> readKey() async => value;
  @override
  Future<void> writeKey(String key) async => value = key;
}

class TestDatabaseFixture {
  TestDatabaseFixture(this.directory, this.database, this.keyStore);
  final Directory directory;
  final AppDatabase database;
  final TestKeyStore keyStore;

  Future<void> close() async {
    database.close();
    await directory.delete(recursive: true);
  }
}

Future<TestDatabaseFixture> createTestDatabase({
  bool prepareSale = false,
}) async {
  final directory = await Directory.systemTemp.createTemp('pos-widget-db-');
  final file = File('${directory.path}${Platform.pathSeparator}pos.sqlite3');
  final keyStore = TestKeyStore();
  final database = await AppDatabase.open(
    databaseFile: file,
    keyStore: keyStore,
  );
  if (prepareSale) {
    final items = ItemsRepositoryImpl(database);
    await items.saveProduct(
      ProductDraft(
        name: 'Tyre 100',
        sku: 'TY-100',
        barcode: '890100',
        category: 'Tyres',
        brand: 'Shiv Shankar',
        hsnCode: '4011',
        unit: 'PCS',
        isActive: true,
        taxPercent: 18,
        prices: {
          for (final tier in PriceTier.values)
            tier: tier == PriceTier.mrp ? 10000 : 9000,
        },
        validFrom: DateTime.utc(2026, 1, 1),
      ),
    );
    final billing = OfflineBillingRepository(database);
    final branchId = billing.createBranch('Main');
    billing.setDefaultBranch(branchId);
    billing.assignInvoicePrefix('C1');
    final product = await items.findBySku('TY-100');
    billing.addOpeningStock(productId: product!.id, quantityMilli: 100000);
  }
  return TestDatabaseFixture(directory, database, keyStore);
}
