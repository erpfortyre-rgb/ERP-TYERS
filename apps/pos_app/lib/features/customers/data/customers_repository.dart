import 'package:sqlite3/sqlite3.dart';
import 'package:uuid/uuid.dart';

import '../../../database/app_database.dart';
import '../domain/customer.dart';

class CustomersRepository {
  CustomersRepository(this._database);
  final AppDatabase _database;
  static const _uuid = Uuid();

  Future<List<Customer>> search(String query) async {
    final value = query.trim();
    final rows = _database.select(
      '''SELECT id, name, phone, gstin FROM customers
         WHERE tenant_id = ? AND (? = '' OR name LIKE '%' || ? || '%' COLLATE NOCASE
           OR phone LIKE '%' || ? || '%' OR gstin LIKE '%' || ? || '%')
         ORDER BY name COLLATE NOCASE LIMIT 100''',
      [_database.tenantId, value, value, value, value],
    );
    return rows.map(_map).toList(growable: false);
  }

  Future<Customer> create({
    required String name,
    String? phone,
    String? gstin,
    String? address,
  }) async {
    final normalized = name.trim();
    if (normalized.isEmpty) {
      throw const FormatException('Customer name is required.');
    }
    final id = _uuid.v4();
    final now = DateTime.now().toUtc().millisecondsSinceEpoch;
    _database.execute(
      '''INSERT INTO customers(id, tenant_id, name, phone, gstin, address, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)''',
      [
        id,
        _database.tenantId,
        normalized,
        _clean(phone),
        _clean(gstin),
        _clean(address),
        now,
        now,
      ],
    );
    return Customer(
      id: id,
      name: normalized,
      phone: _clean(phone),
      gstin: _clean(gstin),
    );
  }

  Customer _map(Row row) => Customer(
    id: row['id'] as String,
    name: row['name'] as String,
    phone: row['phone'] as String?,
    gstin: row['gstin'] as String?,
  );

  String? _clean(String? value) {
    final normalized = value?.trim();
    return normalized == null || normalized.isEmpty ? null : normalized;
  }
}
