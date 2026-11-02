import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:pos_app/database/app_database.dart';
import 'package:pos_app/database/encryption/key_manager.dart';
import 'package:pos_app/features/items/data/items_repository_impl.dart';
import 'package:pos_app/features/items/domain/item.dart';
import 'package:sqlite3/sqlite3.dart';

class _MemoryKeyStore implements DatabaseKeyStore {
  _MemoryKeyStore([this.value]);
  String? value;

  @override
  Future<String?> readKey() async => value;

  @override
  Future<void> writeKey(String key) async => value = key;
}

void main() {
  late Directory directory;
  late File databaseFile;
  late _MemoryKeyStore keyStore;
  late AppDatabase database;
  late ItemsRepositoryImpl products;

  setUp(() async {
    directory = await Directory.systemTemp.createTemp('pos-encrypted-db-');
    databaseFile = File(
      '${directory.path}${Platform.pathSeparator}pos.sqlite3',
    );
    keyStore = _MemoryKeyStore();
    database = await AppDatabase.open(
      databaseFile: databaseFile,
      keyStore: keyStore,
    );
    products = ItemsRepositoryImpl(database);
  });

  tearDown(() async {
    database.close();
    await directory.delete(recursive: true);
  });

  test(
    'opens verified SQLCipher and persists encrypted product and prices',
    () async {
      final diagnostics = database.diagnostics();
      expect(diagnostics.encryptionVerified, isTrue);
      expect(diagnostics.cipherVersion, isNotEmpty);
      // ignore: avoid_print
      print('Verified SQLCipher runtime: ${diagnostics.cipherVersion}');
      expect(diagnostics.schemaVersion, AppDatabase.currentSchemaVersion);
      expect(diagnostics.health, 'ok');
      expect(diagnostics.foreignKeysEnabled, isTrue);

      await products.saveProduct(_draft(sku: 'TY-100', barcode: '890100'));
      final product = await products.findBySku('TY-100');
      expect(product, isNotNull);
      expect((await products.findByBarcode('890100'))?.id, product!.id);
      expect((await products.currentPrices(product.id))[PriceTier.mrp], 250000);
      expect(database.diagnostics().productCount, 1);

      database.close();
      database = await AppDatabase.open(
        databaseFile: databaseFile,
        keyStore: keyStore,
      );
      products = ItemsRepositoryImpl(database);
      expect((await products.findByBarcode('890100'))?.name, 'Tyre 100');

      final bytes = await databaseFile
          .openRead(0, 16)
          .fold<List<int>>([], (all, chunk) => all..addAll(chunk));
      expect(
        utf8.decode(bytes, allowMalformed: true),
        isNot(startsWith('SQLite format 3')),
      );
      final unkeyed = sqlite3.open(databaseFile.path);
      addTearDown(unkeyed.close);
      expect(
        () => unkeyed.select('SELECT * FROM sqlite_master'),
        throwsA(anything),
      );
    },
  );

  test(
    'appends rate history and product edits without deleting old prices',
    () async {
      await products.saveProduct(_draft(sku: 'TY-200', barcode: '890200'));
      final product = (await products.findBySku('TY-200'))!;
      final now = DateTime.now().add(const Duration(days: 1));
      for (var price = 250001; price <= 250006; price++) {
        await products.saveProduct(
          _draft(
            id: product.id,
            sku: 'TY-200',
            barcode: '890200',
            name: 'Updated tyre',
            price: price,
            validFrom: now.add(Duration(seconds: price - 250001)),
          ),
        );
      }
      final history = await products.priceHistory(product.id);
      final mrpHistory = history
          .where((entry) => entry.tier == PriceTier.mrp)
          .toList();
      expect(mrpHistory, hasLength(5));
      expect(mrpHistory.first.pricePaise, 250006);
      expect((await products.findByBarcode('890200'))?.name, 'Updated tyre');
    },
  );

  test(
    'rejects a wrong key and does not replace it with a new database',
    () async {
      await products.saveProduct(_draft(sku: 'TY-300', barcode: '890300'));
      database.close();
      final wrongStore = _MemoryKeyStore(
        base64UrlEncode(List<int>.filled(32, 9)),
      );
      await expectLater(
        AppDatabase.open(databaseFile: databaseFile, keyStore: wrongStore),
        throwsA(isA<DatabaseOpenException>()),
      );
      expect(await databaseFile.exists(), isTrue);
    },
  );

  test(
    'refuses to create a replacement key when the database key is missing',
    () async {
      await products.saveProduct(_draft(sku: 'TY-400', barcode: '890400'));
      database.close();
      await expectLater(
        AppDatabase.open(
          databaseFile: databaseFile,
          keyStore: _MemoryKeyStore(),
        ),
        throwsA(isA<DatabaseKeyUnavailableException>()),
      );
    },
  );
}

ProductDraft _draft({
  String? id,
  required String sku,
  required String barcode,
  String name = 'Tyre 100',
  int price = 250000,
  DateTime? validFrom,
}) => ProductDraft(
  id: id,
  name: name,
  sku: sku,
  barcode: barcode,
  category: 'Tyres',
  brand: 'Example',
  hsnCode: '4011',
  unit: 'PCS',
  isActive: true,
  prices: {for (final tier in PriceTier.values) tier: price},
  validFrom: validFrom ?? DateTime.utc(2026, 1, 1),
);
