enum PriceTier {
  mrp('MRP', 'MRP'),
  cmpA('CMP_A', 'CMP A'),
  cmpB('CMP_B', 'CMP B'),
  cmpC('CMP_C', 'CMP C'),
  cmpD('CMP_D', 'CMP D');

  const PriceTier(this.databaseValue, this.label);

  final String databaseValue;
  final String label;

  static PriceTier fromDatabase(String value) =>
      PriceTier.values.firstWhere((tier) => tier.databaseValue == value);
}

class Product {
  const Product({
    required this.id,
    required this.tenantId,
    required this.branchId,
    required this.name,
    required this.sku,
    required this.barcode,
    required this.category,
    required this.brand,
    required this.hsnCode,
    required this.unit,
    required this.taxPercent,
    required this.isActive,
    required this.createdAt,
    required this.updatedAt,
  });

  final String id;
  final String tenantId;
  final String? branchId;
  final String name;
  final String sku;
  final String? barcode;
  final String? category;
  final String? brand;
  final String? hsnCode;
  final String unit;
  final double? taxPercent;
  final bool isActive;
  final DateTime createdAt;
  final DateTime updatedAt;
}

class ProductDraft {
  const ProductDraft({
    this.id,
    this.branchId,
    required this.name,
    required this.sku,
    required this.barcode,
    required this.category,
    required this.brand,
    required this.hsnCode,
    required this.unit,
    this.taxPercent,
    required this.isActive,
    required this.prices,
    required this.validFrom,
  });

  final String? id;
  final String? branchId;
  final String name;
  final String sku;
  final String? barcode;
  final String? category;
  final String? brand;
  final String? hsnCode;
  final String unit;
  final double? taxPercent;
  final bool isActive;
  final Map<PriceTier, int> prices;
  final DateTime validFrom;
}

class ProductPrice {
  const ProductPrice({
    required this.id,
    required this.productId,
    required this.tier,
    required this.pricePaise,
    required this.validFrom,
    required this.createdAt,
  });

  final String id;
  final String productId;
  final PriceTier tier;
  final int pricePaise;
  final DateTime validFrom;
  final DateTime createdAt;
}
