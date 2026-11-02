import 'dart:convert';

import 'package:uuid/uuid.dart';

import '../../../database/app_database.dart';

enum FinanceMasterCategory {
  fitment('FITMENT', 'Fitment Type'),
  make('MAKE', 'Make'),
  plyRating('PLY_RATING', 'Ply Rating'),
  fieldOffice('FIELD_OFFICE', 'Field Office');

  const FinanceMasterCategory(this.databaseValue, this.label);
  final String databaseValue;
  final String label;
}

class FinanceMasterValue {
  const FinanceMasterValue(this.id, this.value);
  final String id;
  final String value;
}

class FinanceQuotation {
  const FinanceQuotation({
    required this.id,
    required this.vehicleNo,
    required this.fitmentType,
    required this.make,
    required this.plyRating,
    required this.fieldOfficeName,
    required this.approxDeliveryDate,
    required this.billAmountPaise,
    required this.marginMoneyPaise,
    required this.loanPeriodMonths,
    required this.loanAmountPaise,
    required this.processingFeePaise,
    required this.totalMoneyReceivablePaise,
    required this.status,
    required this.createdAt,
    required this.updatedAt,
  });

  final String id;
  final String vehicleNo;
  final String fitmentType;
  final String make;
  final String plyRating;
  final String fieldOfficeName;
  final DateTime approxDeliveryDate;
  final int billAmountPaise;
  final int marginMoneyPaise;
  final int loanPeriodMonths;
  final int loanAmountPaise;
  final int processingFeePaise;
  final int totalMoneyReceivablePaise;
  final String status;
  final DateTime createdAt;
  final DateTime updatedAt;
}

class FinanceQuotationRepository {
  FinanceQuotationRepository(this._database);

  final AppDatabase _database;
  static const _uuid = Uuid();

  List<FinanceQuotation> list() => _database
      .select(
        '''SELECT * FROM finance_quotations WHERE tenant_id = ?
           ORDER BY updated_at DESC LIMIT 500''',
        [_database.tenantId],
      )
      .map(_map)
      .toList(growable: false);

  FinanceQuotation? get(String id) {
    final rows = _database.select(
      'SELECT * FROM finance_quotations WHERE tenant_id = ? AND id = ?',
      [_database.tenantId, id],
    );
    return rows.isEmpty ? null : _map(rows.first);
  }

  List<FinanceMasterValue> masterValues(FinanceMasterCategory category) =>
      _database
          .select(
            '''SELECT id, value FROM finance_master_values
               WHERE tenant_id = ? AND category = ? AND is_active = 1
               ORDER BY value COLLATE NOCASE''',
            [_database.tenantId, category.databaseValue],
          )
          .map(
            (row) =>
                FinanceMasterValue(row['id'] as String, row['value'] as String),
          )
          .toList(growable: false);

  void addMasterValue(FinanceMasterCategory category, String value) {
    final normalized = value.trim();
    if (normalized.isEmpty) {
      throw const FinanceQuotationException('Master value is required.');
    }
    _database.execute(
      '''INSERT INTO finance_master_values(id, tenant_id, category, value, created_at)
         VALUES (?, ?, ?, ?, ?)''',
      [
        _uuid.v4(),
        _database.tenantId,
        category.databaseValue,
        normalized,
        DateTime.now().toUtc().millisecondsSinceEpoch,
      ],
    );
  }

  FinanceQuotation save({
    String? id,
    required String vehicleNo,
    required String fitmentType,
    required String make,
    required String plyRating,
    required String fieldOfficeName,
    required DateTime approxDeliveryDate,
    required int billAmountPaise,
    required int marginMoneyPaise,
    required int loanPeriodMonths,
    required int loanAmountPaise,
    required int processingFeePaise,
    required int totalMoneyReceivablePaise,
  }) {
    if (vehicleNo.trim().isEmpty ||
        fitmentType.trim().isEmpty ||
        make.trim().isEmpty ||
        plyRating.trim().isEmpty ||
        fieldOfficeName.trim().isEmpty) {
      throw const FinanceQuotationException('Complete all quotation fields.');
    }
    if ([
      billAmountPaise,
      marginMoneyPaise,
      loanAmountPaise,
      processingFeePaise,
      totalMoneyReceivablePaise,
    ].any((value) => value < 0)) {
      throw const FinanceQuotationException('Amounts cannot be negative.');
    }
    if (loanPeriodMonths <= 0) {
      throw const FinanceQuotationException('Loan period must be positive.');
    }
    final config = _database
        .select(
          'SELECT default_branch_id, device_id FROM device_identity WHERE id = 1',
        )
        .first;
    final branchId = config['default_branch_id'] as String?;
    if (branchId == null) {
      throw const FinanceQuotationException(
        'Configure the default branch before saving a finance quotation.',
      );
    }
    final values = <FinanceMasterCategory, String>{
      FinanceMasterCategory.fitment: fitmentType,
      FinanceMasterCategory.make: make,
      FinanceMasterCategory.plyRating: plyRating,
      FinanceMasterCategory.fieldOffice: fieldOfficeName,
    };
    for (final entry in values.entries) {
      final found = _database.select(
        '''SELECT id FROM finance_master_values
           WHERE tenant_id = ? AND category = ? AND value = ? AND is_active = 1''',
        [_database.tenantId, entry.key.databaseValue, entry.value],
      );
      if (found.isEmpty) {
        throw FinanceQuotationException(
          'Select a configured ${entry.key.label}.',
        );
      }
    }

    final quotationId = id ?? _uuid.v4();
    final now = DateTime.now().toUtc().millisecondsSinceEpoch;
    _database.transaction(() {
      final existing = _database.select(
        'SELECT created_at, status FROM finance_quotations WHERE tenant_id = ? AND id = ?',
        [_database.tenantId, quotationId],
      );
      if (id != null && existing.isEmpty) {
        throw const FinanceQuotationException('Quotation not found.');
      }
      if (existing.isNotEmpty && existing.first['status'] != 'DRAFT') {
        throw const FinanceQuotationException(
          'Only draft quotations can be edited.',
        );
      }
      if (existing.isEmpty) {
        _database.execute(
          '''INSERT INTO finance_quotations(
            id, tenant_id, branch_id, vehicle_no, fitment_type, make, ply_rating,
            field_office_name, approx_delivery_date, bill_amount_paise,
            margin_money_paise, loan_period_months, loan_amount_paise,
            processing_fee_paise, total_money_receivable_paise, status, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT', ?, ?)''',
          [
            quotationId,
            _database.tenantId,
            branchId,
            vehicleNo.trim(),
            fitmentType,
            make,
            plyRating,
            fieldOfficeName,
            approxDeliveryDate.millisecondsSinceEpoch,
            billAmountPaise,
            marginMoneyPaise,
            loanPeriodMonths,
            loanAmountPaise,
            processingFeePaise,
            totalMoneyReceivablePaise,
            now,
            now,
          ],
        );
      } else {
        _database.execute(
          '''UPDATE finance_quotations SET vehicle_no = ?, fitment_type = ?, make = ?,
            ply_rating = ?, field_office_name = ?, approx_delivery_date = ?,
            bill_amount_paise = ?, margin_money_paise = ?, loan_period_months = ?,
            loan_amount_paise = ?, processing_fee_paise = ?,
            total_money_receivable_paise = ?, updated_at = ?
            WHERE id = ? AND tenant_id = ? AND status = 'DRAFT' ''',
          [
            vehicleNo.trim(),
            fitmentType,
            make,
            plyRating,
            fieldOfficeName,
            approxDeliveryDate.millisecondsSinceEpoch,
            billAmountPaise,
            marginMoneyPaise,
            loanPeriodMonths,
            loanAmountPaise,
            processingFeePaise,
            totalMoneyReceivablePaise,
            now,
            quotationId,
            _database.tenantId,
          ],
        );
      }
      _database.execute(
        '''INSERT INTO sync_outbox(
          id, tenant_id, device_id, entity_type, entity_id, operation,
          event_type, schema_version, payload_json, state, created_at
        ) VALUES (?, ?, ?, 'finance_quotation', ?, 'UPSERT', ?, 1, ?, 'PENDING', ?)''',
        [
          _uuid.v4(),
          _database.tenantId,
          config['device_id'],
          quotationId,
          'FINANCE_QUOTATION_SAVED:${_uuid.v4()}',
          jsonEncode({
            'id': quotationId,
            'branchId': branchId,
            'status': 'DRAFT',
          }),
          now,
        ],
      );
    });
    return get(quotationId)!;
  }

  FinanceQuotation _map(dynamic row) => FinanceQuotation(
    id: row['id'] as String,
    vehicleNo: row['vehicle_no'] as String,
    fitmentType: row['fitment_type'] as String,
    make: row['make'] as String,
    plyRating: row['ply_rating'] as String,
    fieldOfficeName: row['field_office_name'] as String,
    approxDeliveryDate: DateTime.fromMillisecondsSinceEpoch(
      row['approx_delivery_date'] as int,
    ),
    billAmountPaise: row['bill_amount_paise'] as int,
    marginMoneyPaise: row['margin_money_paise'] as int,
    loanPeriodMonths: row['loan_period_months'] as int,
    loanAmountPaise: row['loan_amount_paise'] as int,
    processingFeePaise: row['processing_fee_paise'] as int,
    totalMoneyReceivablePaise: row['total_money_receivable_paise'] as int,
    status: row['status'] as String,
    createdAt: DateTime.fromMillisecondsSinceEpoch(row['created_at'] as int),
    updatedAt: DateTime.fromMillisecondsSinceEpoch(row['updated_at'] as int),
  );
}

class FinanceQuotationException implements Exception {
  const FinanceQuotationException(this.message);
  final String message;
  @override
  String toString() => message;
}
