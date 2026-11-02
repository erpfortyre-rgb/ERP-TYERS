import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pos_app/app/app.dart';
import 'package:pos_app/app/providers.dart';

import '../support/test_database.dart';

void main() {
  late TestDatabaseFixture fixture;

  setUp(() async => fixture = await createTestDatabase(prepareSale: true));
  tearDown(() => fixture.close());

  testWidgets('selects an active product and saves it as a kit component', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(1600, 900);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          databaseProvider.overrideWith((ref) async => fixture.database),
        ],
        child: const PosApp(),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Kits'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Create kit'));
    await tester.pumpAndSettle();

    await tester.enterText(
      find.widgetWithText(TextField, 'Kit name'),
      'Test kit',
    );
    await tester.tap(find.text('Add product'));
    await tester.pumpAndSettle();

    expect(find.text('Choose a component product'), findsOneWidget);
    expect(find.text('Tyre 100'), findsOneWidget);
    await tester.tap(find.text('Tyre 100'));
    await tester.pumpAndSettle();

    expect(find.text('Add Tyre 100'), findsOneWidget);
    await tester.tap(find.text('Add component'));
    await tester.pumpAndSettle();
    expect(find.text('Tyre 100'), findsOneWidget);
    expect(find.textContaining('1.000 units'), findsOneWidget);

    await tester.tap(find.text('Save kit'));
    await tester.pumpAndSettle();
    expect(find.text('Test kit'), findsOneWidget);
    expect(find.textContaining('Tyre 100 ×'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
