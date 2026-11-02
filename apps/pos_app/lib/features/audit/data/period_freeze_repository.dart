import 'dart:convert';

import 'package:uuid/uuid.dart';

import '../../../database/app_database.dart';

enum FreezeScope {
  stock('STOCK', 'Stock'),
  accounting('ACCOUNTING', 'Accounting'),
  both('BOTH', 'Stock and accounting');

  const FreezeScope(this.databaseValue, this.label);
  final String databaseValue;
  final String label;
}

class PeriodFreeze {
  const PeriodFreeze({
    required this.id,
    required this.branchId,
    required this.branchName,
    required this.startDate,
    required this.endDate,
    required this.scope,
    required this.reason,
    required this.frozenBy,
    required this.frozenAt,
    required this.unfrozenAt,
    required this.unfreezeReason,
  });

  final String id;
  final String? branchId;
  final String? branchName;
  final DateTime startDate;
  final DateTime endDate;
  final FreezeScope scope;
  final String reason;
  final String frozenBy;
  final DateTime frozenAt;
  final DateTime? unfrozenAt;
  final String? unfreezeReason;
}

class PeriodFreezeRepository {
  PeriodFreezeRepository(this._database);
  final AppDatabase _database;
  static const _uuid = Uuid();

  List<PeriodFreeze> list() => _database
      .select(
        '''SELECT f.*, b.name AS branch_name FROM period_freezes f
           LEFT JOIN branches b ON b.id = f.branch_id
           WHERE f.tenant_id = ? ORDER BY f.start_date DESC LIMIT 500''',
        [_database.tenantId],
      )
      .map(
        (row) => PeriodFreeze(
          id: row['id'] as String,
          branchId: row['branch_id'] as String?,
          branchName: row['branch_name'] as String?,
          startDate: DateTime.fromMillisecondsSinceEpoch(
            row['start_date'] as int,
          ),
          endDate: DateTime.fromMillisecondsSinceEpoch(row['end_date'] as int),
          scope: FreezeScope.values.firstWhere(
            (scope) => scope.databaseValue == row['scope'],
          ),
          reason: row['reason'] as String,
          frozenBy: row['frozen_by'] as String,
          frozenAt: DateTime.fromMillisecondsSinceEpoch(
            row['frozen_at'] as int,
          ),
          unfrozenAt: row['unfrozen_at'] == null
              ? null
              : DateTime.fromMillisecondsSinceEpoch(row['unfrozen_at'] as int),
          unfreezeReason: row['unfreeze_reason'] as String?,
        ),
      )
      .toList(growable: false);

  String freeze({
    required DateTime startDate,
    required DateTime endDate,
    required FreezeScope scope,
    required String reason,
  }) {
    final normalizedReason = reason.trim();
    if (normalizedReason.isEmpty) {
      throw const PeriodFreezeException('Enter a freeze reason.');
    }
    final start = DateTime(startDate.year, startDate.month, startDate.day);
    final end = DateTime(endDate.year, endDate.month, endDate.day, 23, 59, 59);
    if (end.isBefore(start)) {
      throw const PeriodFreezeException(
        'End date must be on or after start date.',
      );
    }
    final config = _database
        .select(
          'SELECT default_branch_id, device_id FROM device_identity WHERE id = 1',
        )
        .first;
    final branchId = config['default_branch_id'] as String?;
    if (branchId == null) {
      throw const PeriodFreezeException('Configure a default branch first.');
    }
    final startMillis = start.millisecondsSinceEpoch;
    final endMillis = end.millisecondsSinceEpoch;
    final conflicts = _database.select(
      '''SELECT id FROM period_freezes
         WHERE tenant_id = ? AND (branch_id = ? OR branch_id IS NULL)
           AND unfrozen_at IS NULL AND scope IN (?, 'BOTH')
           AND start_date <= ? AND end_date >= ?''',
      [
        _database.tenantId,
        branchId,
        scope.databaseValue,
        endMillis,
        startMillis,
      ],
    );
    if (conflicts.isNotEmpty) {
      throw const PeriodFreezeException(
        'An active freeze overlaps this date range and scope.',
      );
    }

    final id = _uuid.v4();
    final now = DateTime.now().toUtc().millisecondsSinceEpoch;
    final deviceId = config['device_id'] as String;
    _database.transaction(() {
      _database.execute(
        '''INSERT INTO period_freezes(
          id, tenant_id, branch_id, start_date, end_date, scope, reason, frozen_by, frozen_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)''',
        [
          id,
          _database.tenantId,
          branchId,
          startMillis,
          endMillis,
          scope.databaseValue,
          normalizedReason,
          deviceId,
          now,
        ],
      );
      _database.execute(
        '''INSERT INTO business_audit_events(
          id, tenant_id, branch_id, event_type, entity_type, entity_id, details, created_at
        ) VALUES (?, ?, ?, 'PERIOD_FROZEN', 'period_freeze', ?, ?, ?)''',
        [_uuid.v4(), _database.tenantId, branchId, id, normalizedReason, now],
      );
      _database.execute(
        '''INSERT INTO sync_outbox(
          id, tenant_id, device_id, entity_type, entity_id, operation,
          event_type, schema_version, payload_json, state, created_at
        ) VALUES (?, ?, ?, 'period_freeze', ?, 'UPSERT', ?, 1, ?, 'PENDING', ?)''',
        [
          _uuid.v4(),
          _database.tenantId,
          deviceId,
          id,
          'PERIOD_FROZEN:${_uuid.v4()}',
          jsonEncode({
            'id': id,
            'branchId': branchId,
            'start': startMillis,
            'end': endMillis,
            'scope': scope.databaseValue,
          }),
          now,
        ],
      );
    });
    return id;
  }

  List<Map<String, Object?>> auditEvents() => _database
      .select(
        '''SELECT event_type, entity_type, entity_id, details, created_at
           FROM business_audit_events WHERE tenant_id = ?
           ORDER BY created_at DESC LIMIT 500''',
        [_database.tenantId],
      )
      .map((row) => Map<String, Object?>.from(row))
      .toList(growable: false);
}

class PeriodFreezeException implements Exception {
  const PeriodFreezeException(this.message);
  final String message;
  @override
  String toString() => message;
}
