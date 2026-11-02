import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:pos_app/app/app.dart';
import 'package:pos_app/app/providers.dart';

import 'support/test_database.dart';

void main() {
  late TestDatabaseFixture fixture;
  setUpAll(() async => fixture = await createTestDatabase());
  tearDownAll(() => fixture.close());
  testWidgets('POS workspace opens with billing and navigation', (
    tester,
  ) async {
    addTearDown(tester.view.resetPhysicalSize);
    tester.view.devicePixelRatio = 1;

    for (final size in const [
      Size(800, 600),
      Size(1366, 768),
      Size(1600, 900),
      Size(1920, 1080),
    ]) {
      tester.view.physicalSize = size;
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            databaseProvider.overrideWith((ref) async => fixture.database),
          ],
          child: const PosApp(),
        ),
      );
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 500));
      await tester.pump(const Duration(milliseconds: 500));

      expect(find.text('SHIV SHANKAR'), findsOneWidget);
      expect(find.text('Billing'), findsAtLeastNWidgets(1));
      expect(find.text('Items'), findsOneWidget);
      expect(find.textContaining('No items on this draft'), findsOneWidget);
      expect(tester.takeException(), isNull, reason: 'viewport $size');
    }

    tester.view.physicalSize = const Size(1920, 1080);
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          databaseProvider.overrideWith((ref) async => fixture.database),
        ],
        child: const PosApp(),
      ),
    );
    await tester.pumpAndSettle();
    for (final section in const [
      'Kits',
      'Stock Audit',
      'Finance Quotes',
      'Period Freeze',
      'Registers',
      'Customers',
      'Suppliers',
      'Purchase',
      'Accounting',
    ]) {
      await tester.tap(find.text(section).first);
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull, reason: section);
    }
  });
}
