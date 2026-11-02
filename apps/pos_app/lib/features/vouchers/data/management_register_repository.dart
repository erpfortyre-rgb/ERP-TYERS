import 'package:uuid/uuid.dart';

import '../../../database/app_database.dart';

class ManagementRegister {
  const ManagementRegister({
    required this.id,
    required this.name,
    required this.isActive,
  });

  final String id;
  final String name;
  final bool isActive;
}

class ManagementRegisterRepository {
  ManagementRegisterRepository(this._database);
  final AppDatabase _database;
  static const _uuid = Uuid();

  List<ManagementRegister> list({bool activeOnly = true}) => _database
      .select(
        '''SELECT id, name, is_active FROM management_registers
           WHERE tenant_id = ? AND (? = 0 OR is_active = 1)
           ORDER BY name COLLATE NOCASE''',
        [_database.tenantId, activeOnly ? 1 : 0],
      )
      .map(
        (row) => ManagementRegister(
          id: row['id'] as String,
          name: row['name'] as String,
          isActive: row['is_active'] == 1,
        ),
      )
      .toList(growable: false);

  void add(String name) {
    final value = name.trim();
    if (value.isEmpty) {
      throw const ManagementRegisterException('Name is required.');
    }
    _database.execute(
      '''INSERT INTO management_registers(id, tenant_id, name, created_at)
         VALUES (?, ?, ?, ?)''',
      [
        _uuid.v4(),
        _database.tenantId,
        value,
        DateTime.now().toUtc().millisecondsSinceEpoch,
      ],
    );
  }

  void setActive(String id, bool isActive) {
    _database.execute(
      'UPDATE management_registers SET is_active = ? WHERE id = ? AND tenant_id = ?',
      [isActive ? 1 : 0, id, _database.tenantId],
    );
  }

  void saveVoucherSelections(String voucherId, List<String> registerIds) {
    if (registerIds.toSet().length != registerIds.length) {
      throw const ManagementRegisterException(
        'A register can only be selected once.',
      );
    }
    _database.transaction(() {
      for (final id in registerIds) {
        final valid = _database.select(
          'SELECT id FROM management_registers WHERE id = ? AND tenant_id = ? AND is_active = 1',
          [id, _database.tenantId],
        );
        if (valid.isEmpty) {
          throw const ManagementRegisterException(
            'One selected management register is no longer active.',
          );
        }
      }
      _database.execute(
        'DELETE FROM voucher_register_selections WHERE voucher_id = ? AND tenant_id = ?',
        [voucherId, _database.tenantId],
      );
      for (final id in registerIds) {
        _database.execute(
          '''INSERT INTO voucher_register_selections(id, tenant_id, voucher_id, register_id, created_at)
             VALUES (?, ?, ?, ?, ?)''',
          [
            _uuid.v4(),
            _database.tenantId,
            voucherId,
            id,
            DateTime.now().toUtc().millisecondsSinceEpoch,
          ],
        );
      }
    });
  }

  List<String> selectionsForVoucher(String voucherId) => _database
      .select(
        '''SELECT register_id FROM voucher_register_selections
           WHERE tenant_id = ? AND voucher_id = ?''',
        [_database.tenantId, voucherId],
      )
      .map((row) => row['register_id'] as String)
      .toList(growable: false);
}

class ManagementRegisterException implements Exception {
  const ManagementRegisterException(this.message);
  final String message;
  @override
  String toString() => message;
}
