import 'package:flutter_test/flutter_test.dart';
import 'package:pos_app/features/billing/domain/kit_explosion.dart';
import 'package:pos_app/features/items/domain/item.dart';
import 'package:pos_app/features/items/domain/kit.dart';

void main() {
  test('expands every component quantity and retains its own rate tier', () {
    final kit = TyreKit(
      id: 'kit-id',
      name: 'Tyre kit',
      isActive: true,
      components: const [
        TyreKitComponent(
          productId: 'tyre',
          productName: 'Tyre',
          sku: 'TY',
          quantityMilli: 1000,
          tier: PriceTier.cmpA,
        ),
        TyreKitComponent(
          productId: 'tube',
          productName: 'Tube',
          sku: 'TU',
          quantityMilli: 500,
          tier: PriceTier.mrp,
        ),
      ],
    );
    final lines = explodeKit(kit, kitQuantityMilli: 2000);
    expect(lines.map((line) => line.quantityMilli), [2000, 1000]);
    expect(lines.map((line) => line.tier), [PriceTier.cmpA, PriceTier.mrp]);
    expect(lines.every((line) => line.kitId == kit.id), isTrue);
  });

  test('rejects non-positive kit quantities', () {
    const kit = TyreKit(
      id: 'kit-id',
      name: 'Tyre kit',
      isActive: true,
      components: [
        TyreKitComponent(
          productId: 'tyre',
          productName: 'Tyre',
          sku: 'TY',
          quantityMilli: 1000,
          tier: PriceTier.mrp,
        ),
      ],
    );
    expect(() => explodeKit(kit, kitQuantityMilli: 0), throwsArgumentError);
  });
}
