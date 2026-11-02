import 'dart:convert';

import 'package:uuid/uuid.dart';

import '../../../database/app_database.dart';
import '../domain/accounting.dart';

class AccountingRepository {
  AccountingRepository(this._database);
  final AppDatabase _database;
  static const _uuid = Uuid();

  List<LedgerAccount> accounts({bool activeOnly = false}) => _database
      .select(
        '''SELECT * FROM chart_of_accounts WHERE tenant_id = ?
           AND (? = 0 OR is_active = 1) ORDER BY code COLLATE NOCASE''',
        [_database.tenantId, activeOnly ? 1 : 0],
      )
      .map(
        (row) => LedgerAccount(
          id: row['id'] as String,
          code: row['code'] as String,
          name: row['name'] as String,
          category: AccountCategory.fromValue(row['category'] as String),
          isActive: row['is_active'] == 1,
        ),
      )
      .toList(growable: false);

  String saveAccount({
    String? id,
    required String code,
    required String name,
    required AccountCategory category,
    bool active = true,
  }) {
    final normalizedCode = code.trim();
    final normalizedName = name.trim();
    if (normalizedCode.isEmpty || normalizedName.isEmpty) {
      throw const AccountingValidationException(
        'Account code and name are required.',
      );
    }
    final tenantId = _database.tenantId;
    final accountId = id ?? _uuid.v4();
    final now = DateTime.now().toUtc().millisecondsSinceEpoch;
    _database.transaction(() {
      final duplicate = _database.select(
        '''SELECT id FROM chart_of_accounts
           WHERE tenant_id = ? AND code = ? COLLATE NOCASE
             AND (? IS NULL OR id != ?) LIMIT 1''',
        [tenantId, normalizedCode, id, id],
      );
      if (duplicate.isNotEmpty) {
        throw const AccountingValidationException(
          'That account code is already in use.',
        );
      }
      if (id == null) {
        _database.execute(
          '''INSERT INTO chart_of_accounts(
             id, tenant_id, code, name, category, is_active, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)''',
          [
            accountId,
            tenantId,
            normalizedCode,
            normalizedName,
            category.value,
            active ? 1 : 0,
            now,
            now,
          ],
        );
      } else {
        _database.execute(
          '''UPDATE chart_of_accounts SET code = ?, name = ?, category = ?,
             is_active = ?, updated_at = ?
             WHERE tenant_id = ? AND id = ?''',
          [
            normalizedCode,
            normalizedName,
            category.value,
            active ? 1 : 0,
            now,
            tenantId,
            accountId,
          ],
        );
        if ((_database.select('SELECT changes() AS n').first['n'] as int) !=
            1) {
          throw const AccountingValidationException('Account not found.');
        }
      }
      _outbox(tenantId, accountId, 'chart_of_accounts', 'ACCOUNT_CHANGED', {
        'id': accountId,
        'code': normalizedCode,
        'name': normalizedName,
        'category': category.value,
        'active': active,
      }, now);
    });
    return accountId;
  }

  Map<AccountMappingPurpose, String> mappings() {
    final rows = _database.select(
      'SELECT purpose, account_id FROM accounting_mappings WHERE tenant_id = ?',
      [_database.tenantId],
    );
    return {
      for (final row in rows)
        AccountMappingPurpose.values.firstWhere(
          (value) => value.value == row['purpose'],
        ): row['account_id'] as String,
    };
  }

  void mapAccount(AccountMappingPurpose purpose, String accountId) {
    final tenantId = _database.tenantId;
    final account = _database.select(
      '''SELECT id, category, is_active FROM chart_of_accounts
         WHERE id = ? AND tenant_id = ?''',
      [accountId, tenantId],
    );
    if (account.isEmpty || account.first['is_active'] != 1) {
      throw const AccountingValidationException(
        'Select an active account in this tenant.',
      );
    }
    if (account.first['category'] != purpose.requiredCategory) {
      throw AccountingValidationException(
        '${purpose.label} requires an account categorized as ${purpose.requiredCategory}.',
      );
    }
    final now = DateTime.now().toUtc().millisecondsSinceEpoch;
    _database.transaction(() {
      _database.execute(
        '''INSERT INTO accounting_mappings(tenant_id, purpose, account_id, updated_at)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(tenant_id, purpose) DO UPDATE SET
             account_id = excluded.account_id, updated_at = excluded.updated_at''',
        [tenantId, purpose.value, accountId, now],
      );
      _outbox(
        tenantId,
        purpose.value,
        'accounting_mapping',
        'ACCOUNT_MAPPING_CHANGED',
        {'purpose': purpose.value, 'accountId': accountId},
        now,
      );
    });
  }

  List<AccountLedgerEntry> ledger(String accountId) {
    final accountRows = _database.select(
      '''SELECT category FROM chart_of_accounts
         WHERE tenant_id = ? AND id = ?''',
      [_database.tenantId, accountId],
    );
    if (accountRows.isEmpty) {
      throw const AccountingValidationException('Account not found.');
    }
    final category = AccountCategory.fromValue(
      accountRows.first['category'] as String,
    );
    final debitNormal =
        category == AccountCategory.asset ||
        category == AccountCategory.expense;
    final rows = _database.select(
      '''SELECT j.transaction_date, j.source_type, j.source_id, j.narration,
         l.debit_paise, l.credit_paise FROM journal_lines l
         JOIN journal_entries j ON j.id = l.journal_entry_id
         WHERE j.tenant_id = ? AND j.status = 'POSTED' AND l.account_id = ?
         ORDER BY j.transaction_date, j.created_at, j.id, l.id''',
      [_database.tenantId, accountId],
    );
    var balance = 0;
    return rows
        .map((row) {
          final debit = row['debit_paise'] as int;
          final credit = row['credit_paise'] as int;
          balance += debitNormal ? debit - credit : credit - debit;
          return AccountLedgerEntry(
            date: DateTime.fromMillisecondsSinceEpoch(
              row['transaction_date'] as int,
            ),
            sourceType: row['source_type'] as String,
            sourceId: row['source_id'] as String,
            narration: row['narration'] as String,
            debitPaise: debit,
            creditPaise: credit,
            balancePaise: balance,
          );
        })
        .toList(growable: false);
  }

  void _outbox(
    String tenantId,
    String entityId,
    String entityType,
    String event,
    Map<String, Object?> payload,
    int now,
  ) {
    final device =
        _database
                .select('SELECT device_id FROM device_identity WHERE id = 1')
                .first['device_id']
            as String;
    _database.execute(
      '''INSERT INTO sync_outbox(
         id, tenant_id, device_id, entity_type, entity_id, operation,
         event_type, schema_version, payload_json, state, created_at)
         VALUES (?, ?, ?, ?, ?, 'UPSERT', ?, 1, ?, 'PENDING', ?)''',
      [
        _uuid.v4(),
        tenantId,
        device,
        entityType,
        entityId,
        '$event:${_uuid.v4()}',
        jsonEncode(payload),
        now,
      ],
    );
  }
}

class AccountingValidationException implements Exception {
  const AccountingValidationException(this.message);
  final String message;
  @override
  String toString() => message;
}
