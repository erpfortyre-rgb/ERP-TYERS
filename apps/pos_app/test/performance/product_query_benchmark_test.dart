import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:pos_app/database/app_database.dart';
import 'package:pos_app/database/encryption/key_manager.dart';
import 'package:uuid/uuid.dart';

class _BenchmarkKeyStore implements DatabaseKeyStore {
  String? key;
  @override
  Future<String?> readKey() async => key;
  @override
  Future<void> writeKey(String value) async => key = value;
}

void main() {
  test(
    'benchmarks indexed product queries against 5,000 local products',
    () async {
      final directory = await Directory.systemTemp.createTemp(
        'pos-query-benchmark-',
      );
      final file = File(
        '${directory.path}${Platform.pathSeparator}benchmark.sqlite3',
      );
      final database = await AppDatabase.open(
        databaseFile: file,
        keyStore: _BenchmarkKeyStore(),
      );
      const uuid = Uuid();
      final targetId = uuid.v4();
      final timestamp = DateTime.now().millisecondsSinceEpoch;

      database.transaction(() {
        for (var i = 0; i < 5000; i++) {
          database.execute(
            '''INSERT INTO products(
            id, tenant_id, name, sku, barcode, unit, is_active, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, 'PCS', 1, ?, ?)''',
            [
              i == 4321 ? targetId : uuid.v4(),
              database.tenantId,
              'Tyre product $i',
              'SKU-${i.toString().padLeft(5, '0')}',
              '890${i.toString().padLeft(7, '0')}',
              timestamp,
              timestamp,
            ],
          );
        }
      });

      // Warm the page cache and measure many indexed queries to reduce timer noise.
      database.select(
        'SELECT id FROM products WHERE tenant_id = ? AND sku = ?',
        [database.tenantId, 'SKU-04321'],
      );
      final timings = <String, double>{};
      final cases = <String, List<Object?>>{
        'indexed SKU search': [
          'SELECT id FROM products WHERE tenant_id = ? AND sku = ?',
          [database.tenantId, 'SKU-04321'],
        ],
        'barcode lookup': [
          'SELECT id FROM products WHERE tenant_id = ? AND barcode = ?',
          [database.tenantId, '8900004321'],
        ],
        'product lookup': [
          'SELECT id FROM products WHERE tenant_id = ? AND id = ?',
          [database.tenantId, targetId],
        ],
      };
      for (final entry in cases.entries) {
        final sql = entry.value[0] as String;
        final parameters = entry.value[1] as List<Object?>;
        final watch = Stopwatch()..start();
        for (var i = 0; i < 1000; i++) {
          expect(database.select(sql, parameters), hasLength(1));
        }
        watch.stop();
        timings[entry.key] = watch.elapsedMicroseconds / 1000000;
      }
      // Printed values are mean milliseconds per query over the 1,000-query sample.
      // ignore: avoid_print
      print('5,000 products, mean per query: $timings');
      expect(timings.values.every((milliseconds) => milliseconds < 20), isTrue);

      database.close();
      await directory.delete(recursive: true);
    },
  );
}
