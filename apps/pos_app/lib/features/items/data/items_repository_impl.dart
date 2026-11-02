import 'package:sqlite3/sqlite3.dart';
import 'package:uuid/uuid.dart';

import '../../../database/app_database.dart';
import '../domain/item.dart';
import '../domain/items_repository.dart';

class ItemsRepositoryImpl implements ItemsRepository {
  ItemsRepositoryImpl(this._database);

  final AppDatabase _database;
  static const _uuid = Uuid();

  @override
  Future<List<Product>> searchProducts({
    String query = '',
    String? category,
    bool? activeOnly,
  }) async {
    final normalizedQuery = query.trim();
    final rows = _database.select(
      '''SELECT * FROM products
         WHERE tenant_id = ?
           AND (? = '' OR name LIKE '%' || ? || '%' COLLATE NOCASE
                OR sku = ? COLLATE NOCASE OR barcode = ? COLLATE NOCASE)
           AND (? IS NULL OR category = ?)
           AND (? IS NULL OR is_active = ?)
         ORDER BY name COLLATE NOCASE
         LIMIT 500''',
      [
        _database.tenantId,
        normalizedQuery,
        normalizedQuery,
        normalizedQuery,
        normalizedQuery,
        category,
        category,
        activeOnly == null ? null : (activeOnly ? 1 : 0),
        activeOnly == null ? null : (activeOnly ? 1 : 0),
      ],
    );
    return rows.map(_mapProduct).toList(growable: false);
  }

  @override
  Future<Product?> getProduct(String id) async {
    final rows = _database.select(
      'SELECT * FROM products WHERE tenant_id = ? AND id = ? LIMIT 1',
      [_database.tenantId, id],
    );
    return rows.isEmpty ? null : _mapProduct(rows.first);
  }

  @override
  Future<Product?> findBySku(String sku) async {
    final rows = _database.select(
      'SELECT * FROM products WHERE tenant_id = ? AND sku = ? COLLATE NOCASE LIMIT 1',
      [_database.tenantId, sku.trim()],
    );
    return rows.isEmpty ? null : _mapProduct(rows.first);
  }

  @override
  Future<Product?> findByBarcode(String barcode) async {
    final value = barcode.trim();
    if (value.isEmpty) {
      return null;
    }
    final rows = _database.select(
      'SELECT * FROM products WHERE tenant_id = ? AND barcode = ? COLLATE NOCASE LIMIT 1',
      [_database.tenantId, value],
    );
    return rows.isEmpty ? null : _mapProduct(rows.first);
  }

  @override
  Future<List<String>> categories() async {
    final rows = _database.select(
      '''SELECT DISTINCT category FROM products
         WHERE tenant_id = ? AND category IS NOT NULL AND trim(category) != ''
         ORDER BY category COLLATE NOCASE''',
      [_database.tenantId],
    );
    return rows.map((row) => row['category'] as String).toList(growable: false);
  }

  @override
  Future<List<ProductPrice>> priceHistory(String productId) async {
    final results = <ProductPrice>[];
    for (final tier in PriceTier.values) {
      final rows = _database.select(
        '''SELECT * FROM product_prices
           WHERE product_id = ? AND tier = ?
           ORDER BY created_at DESC, valid_from DESC
           LIMIT 5''',
        [productId, tier.databaseValue],
      );
      results.addAll(rows.map(_mapPrice));
    }
    return results;
  }

  @override
  Future<Map<PriceTier, int>> currentPrices(String productId) async {
    final now = DateTime.now().toUtc().millisecondsSinceEpoch;
    final prices = <PriceTier, int>{};
    for (final tier in PriceTier.values) {
      final rows = _database.select(
        '''SELECT price_paise FROM product_prices
           WHERE product_id = ? AND tier = ? AND valid_from <= ?
           ORDER BY valid_from DESC, created_at DESC LIMIT 1''',
        [productId, tier.databaseValue, now],
      );
      if (rows.isNotEmpty) {
        prices[tier] = rows.first['price_paise'] as int;
      }
    }
    return prices;
  }

  @override
  Future<void> saveProduct(ProductDraft draft) async {
    final name = draft.name.trim();
    final sku = draft.sku.trim();
    if (name.isEmpty) {
      throw const ProductValidationException('Name is required.');
    }
    if (sku.isEmpty) {
      throw const ProductValidationException('SKU is required.');
    }
    if (draft.taxPercent != null &&
        (!draft.taxPercent!.isFinite ||
            draft.taxPercent! < 0 ||
            draft.taxPercent! > 100)) {
      throw const ProductValidationException(
        'Tax rate must be between 0 and 100 percent.',
      );
    }
    if (draft.prices.length != PriceTier.values.length ||
        PriceTier.values.any((tier) => !draft.prices.containsKey(tier))) {
      throw const ProductValidationException(
        'Enter a price for MRP and all four CMP tiers.',
      );
    }
    if (draft.prices.values.any((price) => price < 0)) {
      throw const ProductValidationException('Prices cannot be negative.');
    }

    final tenantId = _database.tenantId;
    final now = DateTime.now().toUtc().millisecondsSinceEpoch;
    final productId = draft.id ?? _uuid.v4();
    final validFrom = draft.validFrom.toUtc().millisecondsSinceEpoch;

    _database.transaction(() {
      final existing = _database.select(
        'SELECT created_at FROM products WHERE tenant_id = ? AND id = ?',
        [tenantId, productId],
      );
      if (draft.id != null && existing.isEmpty) {
        throw const ProductNotFoundException();
      }

      if (existing.isEmpty) {
        _database.execute(
          '''INSERT INTO products(
               id, tenant_id, branch_id, name, sku, barcode, category, brand,
               hsn_code, unit, is_active, created_at, updated_at, tax_percent
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
          [
            productId,
            tenantId,
            _clean(draft.branchId),
            name,
            sku,
            _clean(draft.barcode),
            _clean(draft.category),
            _clean(draft.brand),
            _clean(draft.hsnCode),
            draft.unit.trim().isEmpty ? 'PCS' : draft.unit.trim(),
            draft.isActive ? 1 : 0,
            now,
            now,
            draft.taxPercent,
          ],
        );
      } else {
        _database.execute(
          '''UPDATE products SET
               branch_id = ?, name = ?, sku = ?, barcode = ?, category = ?,
               brand = ?, hsn_code = ?, unit = ?, is_active = ?, updated_at = ?,
               tax_percent = ?
             WHERE tenant_id = ? AND id = ?''',
          [
            _clean(draft.branchId),
            name,
            sku,
            _clean(draft.barcode),
            _clean(draft.category),
            _clean(draft.brand),
            _clean(draft.hsnCode),
            draft.unit.trim().isEmpty ? 'PCS' : draft.unit.trim(),
            draft.isActive ? 1 : 0,
            now,
            draft.taxPercent,
            tenantId,
            productId,
          ],
        );
      }

      for (final tier in PriceTier.values) {
        final price = draft.prices[tier]!;
        final lastRows = _database.select(
          '''SELECT price_paise, valid_from FROM product_prices
             WHERE product_id = ? AND tier = ?
             ORDER BY valid_from DESC, created_at DESC LIMIT 1''',
          [productId, tier.databaseValue],
        );
        final unchanged =
            lastRows.isNotEmpty &&
            lastRows.first['price_paise'] == price &&
            lastRows.first['valid_from'] == validFrom;
        if (unchanged) continue;
        _database.execute(
          '''INSERT INTO product_prices(
               id, product_id, tier, price_paise, valid_from, created_at
             ) VALUES (?, ?, ?, ?, ?, ?)''',
          [_uuid.v4(), productId, tier.databaseValue, price, validFrom, now],
        );
      }
    });
  }

  Product _mapProduct(Row row) => Product(
    id: row['id'] as String,
    tenantId: row['tenant_id'] as String,
    branchId: row['branch_id'] as String?,
    name: row['name'] as String,
    sku: row['sku'] as String,
    barcode: row['barcode'] as String?,
    category: row['category'] as String?,
    brand: row['brand'] as String?,
    hsnCode: row['hsn_code'] as String?,
    unit: row['unit'] as String,
    taxPercent: (row['tax_percent'] as num?)?.toDouble(),
    isActive: row['is_active'] == 1,
    createdAt: DateTime.fromMillisecondsSinceEpoch(
      row['created_at'] as int,
      isUtc: true,
    ),
    updatedAt: DateTime.fromMillisecondsSinceEpoch(
      row['updated_at'] as int,
      isUtc: true,
    ),
  );

  ProductPrice _mapPrice(Row row) => ProductPrice(
    id: row['id'] as String,
    productId: row['product_id'] as String,
    tier: PriceTier.fromDatabase(row['tier'] as String),
    pricePaise: row['price_paise'] as int,
    validFrom: DateTime.fromMillisecondsSinceEpoch(
      row['valid_from'] as int,
      isUtc: true,
    ),
    createdAt: DateTime.fromMillisecondsSinceEpoch(
      row['created_at'] as int,
      isUtc: true,
    ),
  );

  String? _clean(String? value) {
    final trimmed = value?.trim();
    return trimmed == null || trimmed.isEmpty ? null : trimmed;
  }
}

class ProductValidationException implements Exception {
  const ProductValidationException(this.message);
  final String message;
  @override
  String toString() => message;
}

class ProductNotFoundException implements Exception {
  const ProductNotFoundException();
  @override
  String toString() => 'The product no longer exists.';
}
