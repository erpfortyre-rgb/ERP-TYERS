import 'item.dart';

class TyreKit {
  const TyreKit({
    required this.id,
    required this.name,
    required this.isActive,
    required this.components,
  });

  final String id;
  final String name;
  final bool isActive;
  final List<TyreKitComponent> components;
}

class TyreKitComponent {
  const TyreKitComponent({
    required this.productId,
    required this.productName,
    required this.sku,
    required this.quantityMilli,
    required this.tier,
  });

  final String productId;
  final String productName;
  final String sku;
  final int quantityMilli;
  final PriceTier tier;
}

class TyreKitDraftComponent {
  const TyreKitDraftComponent({
    required this.productId,
    required this.quantityMilli,
    required this.tier,
  });

  final String productId;
  final int quantityMilli;
  final PriceTier tier;
}
