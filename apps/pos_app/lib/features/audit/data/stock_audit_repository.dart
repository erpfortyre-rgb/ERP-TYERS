import 'dart:convert';

import 'package:uuid/uuid.dart';

import '../../../database/app_database.dart';

class StockAuditRow {
  const StockAuditRow({
    required this.id,
    required this.productId,
    required this.productName,
    required this.sku,
    required this.bookQuantityMilli,
    required this.physicalQuantityMilli,
    required this.editCount,
  });

  final String id;
  final String productId;
  final String productName;
  final String sku;
  final int bookQuantityMilli;
  final int physicalQuantityMilli;
  final int editCount;
  int get varianceMilli => physicalQuantityMilli - bookQuantityMilli;
}

class StockAuditSchedule {
  const StockAuditSchedule({
    required this.id,
    required this.scheduledDate,
    required this.label,
    required this.status,
  });

  final String id;
  final DateTime scheduledDate;
  final String label;
  final String status;
}

class StockAuditRepository {
  StockAuditRepository(this._database);
  final AppDatabase _database;
  static const _uuid = Uuid();

  String startAudit(DateTime date) {
    final config = _database
        .select(
          'SELECT default_branch_id, device_id FROM device_identity WHERE id = 1',
        )
        .first;
    final branchId = config['default_branch_id'] as String?;
    if (branchId == null) {
      throw const StockAuditException('Set a default branch first.');
    }
    final id = _uuid.v4();
    final now = DateTime.now().toUtc().millisecondsSinceEpoch;
    final auditDate = DateTime(
      date.year,
      date.month,
      date.day,
    ).millisecondsSinceEpoch;
    _database.transaction(() {
      _database.execute(
        '''INSERT INTO stock_audit_sessions(id, tenant_id, branch_id, audit_date, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)''',
        [id, _database.tenantId, branchId, auditDate, now, now],
      );
      final products = _database.select(
        '''SELECT p.id, COALESCE(s.quantity, 0) AS quantity
           FROM products p LEFT JOIN local_stock s
             ON s.product_id = p.id AND s.branch_id = ?
           WHERE p.tenant_id = ? AND p.is_active = 1 ORDER BY p.name''',
        [branchId, _database.tenantId],
      );
      for (final product in products) {
        final quantityMilli = ((product['quantity'] as num).toDouble() * 1000)
            .round();
        _database.execute(
          '''INSERT INTO stock_audit_rows(
            id, session_id, product_id, book_quantity_milli, physical_quantity_milli, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?)''',
          [_uuid.v4(), id, product['id'], quantityMilli, quantityMilli, now],
        );
      }
      final payload = jsonEncode({'auditId': id, 'branchId': branchId});
      _database.execute(
        '''INSERT INTO sync_outbox(
          id, tenant_id, device_id, entity_type, entity_id, operation,
          event_type, schema_version, payload_json, state, created_at
        ) VALUES (?, ?, ?, 'stock_audit', ?, 'UPSERT', 'STOCK_AUDIT_STARTED', 1, ?, 'PENDING', ?)''',
        [_uuid.v4(), _database.tenantId, config['device_id'], id, payload, now],
      );
    });
    return id;
  }

  List<StockAuditRow> rows([String? sessionId]) {
    final session = sessionId ?? activeSessionId();
    if (session == null) return const [];
    return _database
        .select(
          '''SELECT r.*, p.name, p.sku FROM stock_audit_rows r
             JOIN products p ON p.id = r.product_id
             WHERE r.session_id = ? ORDER BY p.name COLLATE NOCASE''',
          [session],
        )
        .map(
          (row) => StockAuditRow(
            id: row['id'] as String,
            productId: row['product_id'] as String,
            productName: row['name'] as String,
            sku: row['sku'] as String,
            bookQuantityMilli: row['book_quantity_milli'] as int,
            physicalQuantityMilli: row['physical_quantity_milli'] as int,
            editCount: row['edit_count'] as int,
          ),
        )
        .toList(growable: false);
  }

  String? activeSessionId() {
    final rows = _database.select(
      '''SELECT id FROM stock_audit_sessions WHERE tenant_id = ? AND status = 'OPEN'
         ORDER BY audit_date DESC LIMIT 1''',
      [_database.tenantId],
    );
    return rows.isEmpty ? null : rows.first['id'] as String;
  }

  void editCount({
    required String rowId,
    required int expectedEditCount,
    required int physicalQuantityMilli,
  }) {
    if (physicalQuantityMilli < 0) {
      throw const StockAuditException('Physical stock cannot be negative.');
    }
    _database.transaction(() {
      final row = _database.select(
        'SELECT physical_quantity_milli, edit_count FROM stock_audit_rows WHERE id = ?',
        [rowId],
      );
      if (row.isEmpty) throw const StockAuditException('Audit row not found.');
      final editCount = row.first['edit_count'] as int;
      if (editCount != expectedEditCount) {
        throw const StockAuditException(
          'This row changed elsewhere. Refresh before editing again.',
        );
      }
      if (editCount >= 3) {
        throw const StockAuditException(
          'This audit count is locked after three saved edits.',
        );
      }
      final now = DateTime.now().toUtc().millisecondsSinceEpoch;
      _database.execute(
        '''INSERT INTO stock_audit_edits(
          id, row_id, previous_quantity_milli, new_quantity_milli, edit_number, edited_at
        ) VALUES (?, ?, ?, ?, ?, ?)''',
        [
          _uuid.v4(),
          rowId,
          row.first['physical_quantity_milli'],
          physicalQuantityMilli,
          editCount + 1,
          now,
        ],
      );
      final config = _database
          .select('SELECT device_id FROM device_identity WHERE id = 1')
          .first;
      _database.execute(
        '''INSERT INTO sync_outbox(
          id, tenant_id, device_id, entity_type, entity_id, operation,
          event_type, schema_version, payload_json, state, created_at
        ) VALUES (?, ?, ?, 'stock_audit_row', ?, 'UPSERT', ?, 1, ?, 'PENDING', ?)''',
        [
          _uuid.v4(),
          _database.tenantId,
          config['device_id'],
          rowId,
          'STOCK_AUDIT_COUNT_EDIT:${_uuid.v4()}',
          jsonEncode({
            'rowId': rowId,
            'editNumber': editCount + 1,
            'quantityMilli': physicalQuantityMilli,
          }),
          now,
        ],
      );
    });
  }

  void schedule(DateTime date, String label) {
    final branchId =
        _database
                .select(
                  'SELECT default_branch_id FROM device_identity WHERE id = 1',
                )
                .first['default_branch_id']
            as String?;
    if (branchId == null) {
      throw const StockAuditException('Set a default branch first.');
    }
    final normalized = label.trim();
    if (normalized.isEmpty) {
      throw const StockAuditException('Enter a schedule name.');
    }
    final day = DateTime(
      date.year,
      date.month,
      date.day,
    ).millisecondsSinceEpoch;
    _database.execute(
      '''INSERT INTO stock_audit_schedules(id, tenant_id, branch_id, scheduled_date, label, created_at)
         VALUES (?, ?, ?, ?, ?, ?)''',
      [
        _uuid.v4(),
        _database.tenantId,
        branchId,
        day,
        normalized,
        DateTime.now().toUtc().millisecondsSinceEpoch,
      ],
    );
  }

  List<StockAuditSchedule> upcomingSchedules() => _database
      .select(
        '''SELECT id, scheduled_date, label, status FROM stock_audit_schedules
           WHERE tenant_id = ? AND status = 'SCHEDULED'
           ORDER BY scheduled_date LIMIT 100''',
        [_database.tenantId],
      )
      .map(
        (row) => StockAuditSchedule(
          id: row['id'] as String,
          scheduledDate: DateTime.fromMillisecondsSinceEpoch(
            row['scheduled_date'] as int,
          ),
          label: row['label'] as String,
          status: row['status'] as String,
        ),
      )
      .toList(growable: false);

  void markScheduleStarted(String id) {
    _database.execute(
      '''UPDATE stock_audit_schedules SET status = 'STARTED'
         WHERE id = ? AND tenant_id = ? AND status = 'SCHEDULED' ''',
      [id, _database.tenantId],
    );
  }

  void markScheduleCompleted(String id) {
    _database.execute(
      '''UPDATE stock_audit_schedules SET status = 'COMPLETED'
         WHERE id = ? AND tenant_id = ? AND status IN ('SCHEDULED', 'STARTED')''',
      [id, _database.tenantId],
    );
  }
}

class StockAuditException implements Exception {
  const StockAuditException(this.message);
  final String message;
  @override
  String toString() => message;
}
