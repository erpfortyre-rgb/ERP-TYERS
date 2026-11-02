import 'package:flutter_test/flutter_test.dart';
import 'package:pos_app/features/audit/data/stock_audit_repository.dart';

import '../support/test_database.dart';

void main() {
  late TestDatabaseFixture fixture;
  setUpAll(() async => fixture = await createTestDatabase(prepareSale: true));
  tearDownAll(() => fixture.close());

  test('database trigger refuses a fourth stock audit edit', () {
    final database = fixture.database;
    final audits = StockAuditRepository(database);
    audits.startAudit(DateTime.now());
    final row = audits.rows().single;
    for (var index = 0; index < 3; index++) {
      audits.editCount(
        rowId: row.id,
        expectedEditCount: index,
        physicalQuantityMilli: 100000 - (index * 1000),
      );
    }
    expect(
      () => database.execute(
        '''INSERT INTO stock_audit_edits(
          id, row_id, previous_quantity_milli, new_quantity_milli, edit_number, edited_at
        ) VALUES ('illegal-edit', ?, 97000, 96000, 4, ?)''',
        [row.id, DateTime.now().millisecondsSinceEpoch],
      ),
      throwsA(anything),
    );
    expect(audits.rows().single.editCount, 3);
  });
}
