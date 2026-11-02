import 'package:flutter_test/flutter_test.dart';

import 'package:mobile_pos/main.dart';

void main() {
  testWidgets('App builds and shows a sign-in screen', (WidgetTester tester) async {
    await tester.pumpWidget(const PosApp());
    expect(find.text('Shiv Shankar Tyres'), findsOneWidget);
  });
}
