import 'dart:convert';

import 'package:uuid/uuid.dart';

import '../../../database/app_database.dart';
import '../domain/item.dart';
import '../domain/kit.dart';

class KitsRepository {
  KitsRepository(this._database);

  final AppDatabase _database;
  static const _uuid = Uuid();

  List<TyreKit> list({bool activeOnly = true}) {
    final rows = _database.select(
      '''SELECT id FROM bom_kits
         WHERE tenant_id = ? AND (? = 0 OR is_active = 1)
         ORDER BY name COLLATE NOCASE''',
      [_database.tenantId, activeOnly ? 1 : 0],
    );
    return rows.map((row) => get(row['id'] as String)!).toList(growable: false);
  }

  TyreKit? get(String kitId) {
    final rows = _database.select(
      'SELECT id, name, is_active FROM bom_kits WHERE id = ? AND tenant_id = ?',
      [kitId, _database.tenantId],
    );
    if (rows.isEmpty) return null;
    final row = rows.first;
    final components = _database.select(
      '''SELECT c.product_id, p.name AS product_name, p.sku,
                c.quantity_milli, c.price_tier
         FROM bom_components c JOIN products p ON p.id = c.product_id
         WHERE c.kit_id = ? ORDER BY p.name COLLATE NOCASE''',
      [kitId],
    );
    return TyreKit(
      id: kitId,
      name: row['name'] as String,
      isActive: row['is_active'] == 1,
      components: components
          .map(
            (component) => TyreKitComponent(
              productId: component['product_id'] as String,
              productName: component['product_name'] as String,
              sku: component['sku'] as String,
              quantityMilli: component['quantity_milli'] as int,
              tier: PriceTier.fromDatabase(component['price_tier'] as String),
            ),
          )
          .toList(growable: false),
    );
  }

  int availableStockMilli(String productId) {
    final branchId =
        _database
                .select(
                  'SELECT default_branch_id FROM device_identity WHERE id = 1',
                )
                .first['default_branch_id']
            as String?;
    if (branchId == null) return 0;
    final rows = _database.select(
      'SELECT quantity FROM local_stock WHERE product_id = ? AND branch_id = ?',
      [productId, branchId],
    );
    return rows.isEmpty ? 0 : ((rows.first['quantity'] as num) * 1000).round();
  }

  String save({
    String? id,
    required String name,
    required bool isActive,
    required List<TyreKitDraftComponent> components,
  }) {
    final normalized = name.trim();
    if (normalized.isEmpty) {
      throw const KitValidationException('Kit name is required.');
    }
    if (components.isEmpty) {
      throw const KitValidationException('A kit needs at least one component.');
    }
    if (components.any((component) => component.quantityMilli <= 0)) {
      throw const KitValidationException(
        'Component quantities must be positive.',
      );
    }
    if (components.map((component) => component.productId).toSet().length !=
        components.length) {
      throw const KitValidationException(
        'Duplicate products are not allowed; combine their quantities.',
      );
    }

    final kitId = id ?? _uuid.v4();
    final tenantId = _database.tenantId;
    final now = DateTime.now().toUtc().millisecondsSinceEpoch;
    _database.transaction(() {
      final existing = _database.select(
        'SELECT id FROM bom_kits WHERE id = ? AND tenant_id = ?',
        [kitId, tenantId],
      );
      if (id != null && existing.isEmpty) {
        throw const KitValidationException('Kit not found.');
      }
      for (final component in components) {
        final product = _database.select(
          'SELECT id FROM products WHERE id = ? AND tenant_id = ? AND is_active = 1',
          [component.productId, tenantId],
        );
        if (product.isEmpty) {
          throw const KitValidationException(
            'Every kit component must be an active product in this tenant.',
          );
        }
      }
      if (existing.isEmpty) {
        _database.execute(
          '''INSERT INTO bom_kits(id, tenant_id, name, is_active, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?)''',
          [kitId, tenantId, normalized, isActive ? 1 : 0, now, now],
        );
      } else {
        _database.execute(
          'UPDATE bom_kits SET name = ?, is_active = ?, updated_at = ? WHERE id = ?',
          [normalized, isActive ? 1 : 0, now, kitId],
        );
        _database.execute('DELETE FROM bom_components WHERE kit_id = ?', [
          kitId,
        ]);
      }
      for (final component in components) {
        _database.execute(
          '''INSERT INTO bom_components(id, kit_id, product_id, quantity_milli, price_tier)
             VALUES (?, ?, ?, ?, ?)''',
          [
            _uuid.v4(),
            kitId,
            component.productId,
            component.quantityMilli,
            component.tier.databaseValue,
          ],
        );
      }
      final device =
          _database
                  .select('SELECT device_id FROM device_identity WHERE id = 1')
                  .first['device_id']
              as String;
      _database.execute(
        '''INSERT INTO sync_outbox(
          id, tenant_id, device_id, entity_type, entity_id, operation,
          event_type, schema_version, payload_json, state, created_at
        ) VALUES (?, ?, ?, 'bom_kit', ?, 'UPSERT', ?, 1, ?, 'PENDING', ?)''',
        [
          _uuid.v4(),
          tenantId,
          device,
          kitId,
          'BOM_KIT_CHANGED:${_uuid.v4()}',
          jsonEncode({
            'id': kitId,
            'name': normalized,
            'active': isActive,
            'components': components
                .map(
                  (component) => {
                    'productId': component.productId,
                    'quantityMilli': component.quantityMilli,
                    'tier': component.tier.databaseValue,
                  },
                )
                .toList(),
          }),
          now,
        ],
      );
    });
    return kitId;
  }
}

class KitValidationException implements Exception {
  const KitValidationException(this.message);
  final String message;
  @override
  String toString() => message;
}
