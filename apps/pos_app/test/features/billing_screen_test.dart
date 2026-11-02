import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pos_app/app/providers.dart';
import 'package:pos_app/features/billing/presentation/billing_screen.dart';

import '../support/test_database.dart';

void main() {
  late TestDatabaseFixture fixture;
  setUpAll(() async => fixture = await createTestDatabase(prepareSale: true));
  tearDownAll(() => fixture.close());
  testWidgets('finalizes a database product with a balanced offline payment', (
    tester,
  ) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          databaseProvider.overrideWith((ref) async => fixture.database),
        ],
        child: const MaterialApp(home: Scaffold(body: BillingScreen())),
      ),
    );
    await tester.pumpAndSettle();

    await tester.enterText(find.byType(TextField).first, 'TY-100');
    await tester.pumpAndSettle();
    await tester.tap(find.text('Tyre 100 · TY-100'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Add to bill'));
    await tester.pumpAndSettle();

    final saveButton = find.widgetWithText(FilledButton, 'Finalize and save');
    expect(tester.widget<FilledButton>(saveButton).onPressed, isNull);
    final paymentButton = find.text('Allocate payment  F4');
    await tester.ensureVisible(paymentButton);
    await tester.tap(paymentButton);
    await tester.pumpAndSettle();
    final paymentDialog = find.byType(AlertDialog).last;
    await tester.enterText(
      find
          .descendant(of: paymentDialog, matching: find.byType(TextField))
          .first,
      '118.00',
    );
    await tester.pump();
    await tester.tap(find.text('Use allocations'));
    await tester.pumpAndSettle();

    await tester.ensureVisible(saveButton);
    expect(tester.widget<FilledButton>(saveButton).onPressed, isNotNull);
    await tester.tap(saveButton);
    await tester.pumpAndSettle();

    expect(find.textContaining('Invoice C1-26-000001 saved'), findsOneWidget);
    expect(
      fixture.database.select('SELECT count(*) AS n FROM invoices').first['n'],
      1,
    );
    expect(
      fixture.database
          .select('SELECT count(*) AS n FROM invoice_items')
          .first['n'],
      1,
    );
    expect(
      fixture.database
          .select('SELECT count(*) AS n FROM invoice_payments')
          .first['n'],
      1,
    );
    expect(
      fixture.database
          .select('SELECT count(*) AS n FROM sync_outbox')
          .first['n'],
      1,
    );
    expect(
      fixture.database
          .select('SELECT quantity FROM local_stock')
          .first['quantity'],
      99.0,
    );
    expect(
      fixture.database
          .select(
            "SELECT quantity FROM stock_movements WHERE movement_type = 'SALE'",
          )
          .first['quantity'],
      -1.0,
    );
    expect(tester.takeException(), isNull);
  });
}
