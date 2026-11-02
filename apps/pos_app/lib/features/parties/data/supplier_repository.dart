import 'dart:convert';

import 'package:uuid/uuid.dart';

import '../../../database/app_database.dart';
import '../domain/supplier.dart';

class SupplierRepository {
  SupplierRepository(this._database);
  final AppDatabase _database;
  static const _uuid = Uuid();

  List<SupplierRecord> search({String query = '', bool activeOnly = false}) {
    final term = query.trim();
    return _database
        .select(
          '''SELECT * FROM suppliers WHERE tenant_id = ?
             AND (? = '' OR business_name LIKE '%' || ? || '%' COLLATE NOCASE
               OR supplier_code LIKE '%' || ? || '%' COLLATE NOCASE
               OR phone LIKE '%' || ? || '%' COLLATE NOCASE)
             AND (? = 0 OR is_active = 1)
             ORDER BY business_name COLLATE NOCASE LIMIT 500''',
          [_database.tenantId, term, term, term, term, activeOnly ? 1 : 0],
        )
        .map(
          (row) => SupplierRecord(
            id: row['id'] as String,
            code: row['supplier_code'] as String,
            businessName: row['business_name'] as String,
            contactPerson: row['contact_person'] as String?,
            phone: row['phone'] as String?,
            email: row['email'] as String?,
            gstin: row['gstin'] as String?,
            billingAddress: row['billing_address'] as String?,
            state: row['state'] as String?,
            isActive: row['is_active'] == 1,
          ),
        )
        .toList(growable: false);
  }

  String save(SupplierDraft draft) {
    final code = draft.code.trim();
    final name = draft.businessName.trim();
    if (code.isEmpty || name.isEmpty) {
      throw const SupplierValidationException(
        'Supplier code and business name are required.',
      );
    }
    final tenantId = _database.tenantId;
    final now = DateTime.now().toUtc().millisecondsSinceEpoch;
    final id = draft.id ?? _uuid.v4();
    _database.transaction(() {
      final identity = _database
          .select('SELECT device_id FROM device_identity WHERE id = 1')
          .first;
      final deviceId = identity['device_id'] as String;
      final duplicate = _database.select(
        '''SELECT id FROM suppliers
           WHERE tenant_id = ? AND supplier_code = ? COLLATE NOCASE
             AND (? IS NULL OR id != ?) LIMIT 1''',
        [tenantId, code, draft.id, draft.id],
      );
      if (duplicate.isNotEmpty) {
        throw const SupplierValidationException(
          'That supplier code is already in use for this tenant.',
        );
      }
      if (draft.id == null) {
        _database.execute(
          '''INSERT INTO suppliers(id, tenant_id, supplier_code, business_name,
             contact_person, phone, email, gstin, billing_address, state,
             is_active, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
          [
            id,
            tenantId,
            code,
            name,
            _clean(draft.contactPerson),
            _clean(draft.phone),
            _clean(draft.email),
            _clean(draft.gstin),
            _clean(draft.billingAddress),
            _clean(draft.state),
            draft.isActive ? 1 : 0,
            now,
            now,
          ],
        );
      } else {
        final existing = _database.select(
          'SELECT id FROM suppliers WHERE tenant_id = ? AND id = ?',
          [tenantId, id],
        );
        if (existing.isEmpty) {
          throw const SupplierValidationException('Supplier was not found.');
        }
        _database.execute(
          '''UPDATE suppliers SET supplier_code = ?, business_name = ?,
             contact_person = ?, phone = ?, email = ?, gstin = ?,
             billing_address = ?, state = ?, is_active = ?, updated_at = ?
             WHERE tenant_id = ? AND id = ?''',
          [
            code,
            name,
            _clean(draft.contactPerson),
            _clean(draft.phone),
            _clean(draft.email),
            _clean(draft.gstin),
            _clean(draft.billingAddress),
            _clean(draft.state),
            draft.isActive ? 1 : 0,
            now,
            tenantId,
            id,
          ],
        );
      }
      _database.execute(
        '''INSERT INTO sync_outbox(
          id, tenant_id, device_id, entity_type, entity_id, operation,
          event_type, schema_version, payload_json, state, created_at)
          VALUES (?, ?, ?, 'supplier', ?, 'UPSERT', ?, 1, ?, 'PENDING', ?)''',
        [
          _uuid.v4(),
          tenantId,
          deviceId,
          id,
          'SUPPLIER_CHANGED:${_uuid.v4()}',
          jsonEncode({
            'id': id,
            'code': code,
            'businessName': name,
            'contactPerson': _clean(draft.contactPerson),
            'phone': _clean(draft.phone),
            'email': _clean(draft.email),
            'gstin': _clean(draft.gstin),
            'billingAddress': _clean(draft.billingAddress),
            'state': _clean(draft.state),
            'active': draft.isActive,
          }),
          now,
        ],
      );
    });
    return id;
  }

  static String? _clean(String? value) {
    final text = value?.trim();
    return text == null || text.isEmpty ? null : text;
  }
}
