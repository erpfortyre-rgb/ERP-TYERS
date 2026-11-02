import '../../items/domain/kit.dart';
import '../../items/domain/item.dart';

class KitExplosionLine {
  const KitExplosionLine({
    required this.kitId,
    required this.productId,
    required this.quantityMilli,
    required this.tier,
  });

  final String kitId;
  final String productId;
  final int quantityMilli;
  final PriceTier tier;
}

List<KitExplosionLine> explodeKit(TyreKit kit, {int kitQuantityMilli = 1000}) {
  if (kitQuantityMilli <= 0) {
    throw ArgumentError.value(
      kitQuantityMilli,
      'kitQuantityMilli',
      'Must be positive.',
    );
  }
  if (kit.components.isEmpty) {
    throw ArgumentError.value(kit, 'kit', 'A kit must contain components.');
  }
  final seenProducts = <String>{};
  return kit.components
      .map((component) {
        if (component.quantityMilli <= 0 ||
            !seenProducts.add(component.productId)) {
          throw ArgumentError.value(
            component,
            'kit.components',
            'Component quantities must be positive and products unique.',
          );
        }
        return KitExplosionLine(
          kitId: kit.id,
          productId: component.productId,
          quantityMilli: _roundDiv(
            component.quantityMilli * kitQuantityMilli,
            1000,
          ),
          tier: component.tier,
        );
      })
      .toList(growable: false);
}

int _roundDiv(int numerator, int denominator) =>
    (numerator + denominator ~/ 2) ~/ denominator;
