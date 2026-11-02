import 'dart:convert';

import 'package:uuid/uuid.dart';

import '../../../database/app_database.dart';
import '../domain/purchase.dart';

class PurchaseRepository {
  PurchaseRepository(this._database);
  final AppDatabase _database;
  static const _uuid = Uuid();

  List<PurchaseProduct> products({String query = ''}) {
    final term = query.trim();
    return _database
        .select(
          '''SELECT id, name, sku, tax_percent FROM products
             WHERE tenant_id = ? AND is_active = 1
               AND (? = '' OR name LIKE '%' || ? || '%' COLLATE NOCASE
                 OR sku LIKE '%' || ? || '%' COLLATE NOCASE)
             ORDER BY name COLLATE NOCASE LIMIT 500''',
          [_database.tenantId, term, term, term],
        )
        .map(
          (row) => PurchaseProduct(
            id: row['id'] as String,
            name: row['name'] as String,
            sku: row['sku'] as String,
            taxPercent: row['tax_percent'] as double?,
          ),
        )
        .toList(growable: false);
  }

  List<PurchaseBillSummary> list({String query = ''}) {
    final term = query.trim();
    return _database
        .select(
          '''SELECT p.*, s.business_name, b.name AS branch_name
             FROM purchase_bills p
             JOIN suppliers s ON s.id = p.supplier_id
             JOIN branches b ON b.id = p.branch_id
             WHERE p.tenant_id = ? AND (? = '' OR p.internal_reference LIKE '%' || ? || '%'
               OR p.supplier_invoice_number LIKE '%' || ? || '%' COLLATE NOCASE
               OR s.business_name LIKE '%' || ? || '%' COLLATE NOCASE)
             ORDER BY p.purchase_date DESC LIMIT 500''',
          [_database.tenantId, term, term, term, term],
        )
        .map(
          (row) => PurchaseBillSummary(
            id: row['id'] as String,
            reference: row['internal_reference'] as String,
            supplierInvoiceNumber: row['supplier_invoice_number'] as String,
            supplierName: row['business_name'] as String,
            branchName: row['branch_name'] as String,
            date: DateTime.fromMillisecondsSinceEpoch(
              row['purchase_date'] as int,
            ),
            totalPaise: row['total_paise'] as int,
            status: row['status'] as String,
          ),
        )
        .toList(growable: false);
  }

  PurchaseDraftData? loadDraft(String id) {
    final rows = _database.select(
      '''SELECT * FROM purchase_bills
         WHERE id = ? AND tenant_id = ? AND status = 'DRAFT' ''',
      [id, _database.tenantId],
    );
    if (rows.isEmpty) return null;
    final bill = rows.first;
    final lines = _database.select(
      'SELECT * FROM purchase_bill_items WHERE purchase_bill_id = ?',
      [id],
    );
    DateTime date(int millis) {
      final value = DateTime.fromMillisecondsSinceEpoch(millis);
      return DateTime(value.year, value.month, value.day);
    }

    return PurchaseDraftData(
      id: id,
      supplierId: bill['supplier_id'] as String,
      supplierInvoiceNumber: bill['supplier_invoice_number'] as String,
      purchaseDate: date(bill['purchase_date'] as int),
      supplierInvoiceDate: date(bill['supplier_invoice_date'] as int),
      lines: lines
          .map(
            (line) => PurchaseLineDraft(
              productId: line['product_id'] as String,
              quantityMilli: line['quantity_milli'] as int,
              unitCostPaise: line['unit_cost_paise'] as int,
              discountPaise: line['discount_paise'] as int,
            ),
          )
          .toList(growable: false),
      notes: bill['notes'] as String?,
    );
  }

  List<PurchaseReturnSummary> returns() => _database
      .select(
        '''SELECT r.id, p.internal_reference, s.business_name, r.reason,
             r.status, r.created_at FROM purchase_returns r
             JOIN purchase_bills p ON p.id = r.purchase_bill_id
             JOIN suppliers s ON s.id = r.supplier_id
             WHERE r.tenant_id = ? ORDER BY r.created_at DESC LIMIT 500''',
        [_database.tenantId],
      )
      .map(
        (row) => PurchaseReturnSummary(
          id: row['id'] as String,
          purchaseReference: row['internal_reference'] as String,
          supplierName: row['business_name'] as String,
          reason: row['reason'] as String,
          status: row['status'] as String,
          createdAt: DateTime.fromMillisecondsSinceEpoch(
            row['created_at'] as int,
          ),
        ),
      )
      .toList(growable: false);

  List<ReturnablePurchaseLine> returnableLines(String purchaseBillId) {
    final rows = _database.select(
      '''SELECT i.id, i.product_name, i.sku, i.quantity_milli,
           COALESCE(SUM(rti.quantity_milli), 0) AS already_requested
           FROM purchase_bill_items i
           JOIN purchase_bills p ON p.id = i.purchase_bill_id
           LEFT JOIN purchase_return_items rti ON rti.purchase_bill_item_id = i.id
           LEFT JOIN purchase_returns r ON r.id = rti.purchase_return_id
             AND r.status IN ('DRAFT', 'REVIEW_REQUIRED')
           WHERE p.id = ? AND p.tenant_id = ? AND p.status = 'FINALIZED'
           GROUP BY i.id ORDER BY i.product_name COLLATE NOCASE''',
      [purchaseBillId, _database.tenantId],
    );
    return rows
        .map(
          (row) => ReturnablePurchaseLine(
            purchaseBillItemId: row['id'] as String,
            productName: row['product_name'] as String,
            sku: row['sku'] as String,
            availableQuantityMilli:
                (row['quantity_milli'] as int) -
                (row['already_requested'] as int),
          ),
        )
        .where((line) => line.availableQuantityMilli > 0)
        .toList(growable: false);
  }

  String saveReturnForReview({
    required String purchaseBillId,
    required String reason,
    required List<PurchaseReturnLineDraft> lines,
  }) {
    final normalizedReason = reason.trim();
    if (normalizedReason.isEmpty || lines.isEmpty) {
      throw const PurchaseValidationException(
        'Enter a return reason and at least one product quantity.',
      );
    }
    if (lines.any((line) => line.quantityMilli <= 0) ||
        lines.map((line) => line.purchaseBillItemId).toSet().length !=
            lines.length) {
      throw const PurchaseValidationException(
        'Return quantities must be positive and each original line can appear once.',
      );
    }
    final tenantId = _database.tenantId;
    final id = _uuid.v4();
    final now = DateTime.now().toUtc().millisecondsSinceEpoch;
    _database.transaction(() {
      final bills = _database.select(
        '''SELECT branch_id, supplier_id, status FROM purchase_bills
             WHERE id = ? AND tenant_id = ?''',
        [purchaseBillId, tenantId],
      );
      if (bills.isEmpty || bills.first['status'] != 'FINALIZED') {
        throw const PurchaseValidationException(
          'Returns can only reference a finalized purchase for this tenant.',
        );
      }
      final bill = bills.first;
      for (final line in lines) {
        final original = _database.select(
          '''SELECT quantity_milli FROM purchase_bill_items
               WHERE id = ? AND purchase_bill_id = ?''',
          [line.purchaseBillItemId, purchaseBillId],
        );
        if (original.isEmpty) {
          throw const PurchaseValidationException(
            'A return item does not belong to the selected purchase.',
          );
        }
        final prior =
            _database
                    .select(
                      '''SELECT COALESCE(SUM(i.quantity_milli), 0) AS quantity
               FROM purchase_return_items i
               JOIN purchase_returns r ON r.id = i.purchase_return_id
               WHERE r.purchase_bill_id = ? AND i.purchase_bill_item_id = ?
                 AND r.status IN ('DRAFT', 'REVIEW_REQUIRED')''',
                      [purchaseBillId, line.purchaseBillItemId],
                    )
                    .first['quantity']
                as int;
        final eligible = original.first['quantity_milli'] as int;
        if (prior + line.quantityMilli > eligible) {
          throw const PurchaseValidationException(
            'Return quantity exceeds the remaining received quantity.',
          );
        }
      }
      _database.execute(
        '''INSERT INTO purchase_returns(
             id, tenant_id, branch_id, supplier_id, purchase_bill_id,
             return_date, reason, status, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'REVIEW_REQUIRED', ?, ?)''',
        [
          id,
          tenantId,
          bill['branch_id'],
          bill['supplier_id'],
          purchaseBillId,
          _dayMillis(DateTime.now()),
          normalizedReason,
          now,
          now,
        ],
      );
      for (final line in lines) {
        _database.execute(
          '''INSERT INTO purchase_return_items(
               id, purchase_return_id, purchase_bill_item_id, quantity_milli)
               VALUES (?, ?, ?, ?)''',
          [_uuid.v4(), id, line.purchaseBillItemId, line.quantityMilli],
        );
      }
      final deviceId =
          _database
                  .select('SELECT device_id FROM device_identity WHERE id = 1')
                  .first['device_id']
              as String;
      _insertOutbox(
        tenantId: tenantId,
        deviceId: deviceId,
        entityType: 'purchase_return',
        entityId: id,
        eventType: 'PURCHASE_RETURN_REVIEW_SAVED',
        payload: {
          'id': id,
          'purchaseBillId': purchaseBillId,
          'reason': normalizedReason,
          'lines': lines
              .map(
                (line) => {
                  'purchaseBillItemId': line.purchaseBillItemId,
                  'quantityMilli': line.quantityMilli,
                },
              )
              .toList(),
        },
        now: now,
      );
    });
    return id;
  }

  String saveDraft({
    String? id,
    required String supplierId,
    required String supplierInvoiceNumber,
    required DateTime purchaseDate,
    required DateTime supplierInvoiceDate,
    required List<PurchaseLineDraft> lines,
    String? notes,
  }) {
    final invoiceNumber = supplierInvoiceNumber.trim();
    if (invoiceNumber.isEmpty) {
      throw const PurchaseValidationException(
        'Supplier invoice number is required.',
      );
    }
    if (lines.isEmpty) {
      throw const PurchaseValidationException(
        'Add at least one product to the purchase draft.',
      );
    }
    if (lines.any(
      (line) =>
          line.quantityMilli <= 0 ||
          line.unitCostPaise < 0 ||
          line.discountPaise < 0,
    )) {
      throw const PurchaseValidationException(
        'Quantities must be positive and costs/discounts cannot be negative.',
      );
    }
    if (lines.map((line) => line.productId).toSet().length != lines.length) {
      throw const PurchaseValidationException(
        'A product can appear only once in a purchase bill.',
      );
    }

    final tenantId = _database.tenantId;
    final config = _database
        .select(
          'SELECT default_branch_id, device_id FROM device_identity WHERE id = 1',
        )
        .first;
    final branchId = config['default_branch_id'] as String?;
    if (branchId == null) {
      throw const PurchaseValidationException(
        'Configure an active default branch before creating purchases.',
      );
    }
    final validBranch = _database.select(
      '''SELECT id FROM branches
         WHERE id = ? AND tenant_id = ? AND is_active = 1''',
      [branchId, tenantId],
    );
    if (validBranch.isEmpty) {
      throw const PurchaseValidationException(
        'Configure an active default branch before creating purchases.',
      );
    }
    final deviceId = config['device_id'] as String;
    final now = DateTime.now().toUtc().millisecondsSinceEpoch;
    final billId = id ?? _uuid.v4();
    final reference = 'PUR-${billId.substring(0, 8).toUpperCase()}';

    _database.transaction(() {
      final supplier = _database.select(
        'SELECT id FROM suppliers WHERE tenant_id = ? AND id = ? AND is_active = 1',
        [tenantId, supplierId],
      );
      if (supplier.isEmpty) {
        throw const PurchaseValidationException(
          'Select an active supplier belonging to this tenant.',
        );
      }
      final duplicateInvoice = _database.select(
        '''SELECT id FROM purchase_bills
           WHERE tenant_id = ? AND supplier_id = ?
             AND supplier_invoice_number = ? COLLATE NOCASE
             AND (? IS NULL OR id != ?) LIMIT 1''',
        [tenantId, supplierId, invoiceNumber, id, id],
      );
      if (duplicateInvoice.isNotEmpty) {
        throw const PurchaseValidationException(
          'This supplier invoice number is already recorded.',
        );
      }
      if (id == null) {
        _database.execute(
          '''INSERT INTO purchase_bills(
             id, tenant_id, branch_id, supplier_id, internal_reference,
             supplier_invoice_number, purchase_date, supplier_invoice_date,
             notes, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
          [
            billId,
            tenantId,
            branchId,
            supplierId,
            reference,
            invoiceNumber,
            _dayMillis(purchaseDate),
            _dayMillis(supplierInvoiceDate),
            _clean(notes),
            now,
            now,
          ],
        );
      } else {
        final current = _database.select(
          '''SELECT id FROM purchase_bills
             WHERE id = ? AND tenant_id = ? AND status = 'DRAFT' ''',
          [billId, tenantId],
        );
        if (current.isEmpty) {
          throw const PurchaseValidationException(
            'Only an existing purchase draft can be edited.',
          );
        }
        _database.execute(
          '''UPDATE purchase_bills SET supplier_id = ?, supplier_invoice_number = ?,
             purchase_date = ?, supplier_invoice_date = ?, notes = ?, updated_at = ?
             WHERE id = ? AND tenant_id = ? AND status = 'DRAFT' ''',
          [
            supplierId,
            invoiceNumber,
            _dayMillis(purchaseDate),
            _dayMillis(supplierInvoiceDate),
            _clean(notes),
            now,
            billId,
            tenantId,
          ],
        );
        _database.execute(
          'DELETE FROM purchase_bill_items WHERE purchase_bill_id = ?',
          [billId],
        );
      }

      var subtotal = 0;
      var discount = 0;
      var taxTotal = 0;
      final payloadLines = <Map<String, Object?>>[];
      for (final line in lines) {
        final productRows = _database.select(
          '''SELECT id, name, sku, tax_percent FROM products
             WHERE tenant_id = ? AND id = ? AND is_active = 1''',
          [tenantId, line.productId],
        );
        if (productRows.isEmpty) {
          throw const PurchaseValidationException(
            'A selected product is missing or inactive.',
          );
        }
        final product = productRows.first;
        final gross = (line.quantityMilli * line.unitCostPaise / 1000).round();
        if (line.discountPaise > gross) {
          throw const PurchaseValidationException(
            'Line discount cannot exceed the line purchase cost.',
          );
        }
        final rate = product['tax_percent'] as double?;
        final taxable = gross - line.discountPaise;
        final itemTax = rate == null ? 0 : (taxable * rate / 100).round();
        final itemTotal = taxable + itemTax;
        subtotal += gross;
        discount += line.discountPaise;
        taxTotal += itemTax;
        final itemId = _uuid.v4();
        _database.execute(
          '''INSERT INTO purchase_bill_items(
             id, purchase_bill_id, product_id, product_name, sku, quantity_milli,
             unit_cost_paise, discount_paise, tax_percent, tax_paise, line_total_paise)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
          [
            itemId,
            billId,
            line.productId,
            product['name'],
            product['sku'],
            line.quantityMilli,
            line.unitCostPaise,
            line.discountPaise,
            rate,
            itemTax,
            itemTotal,
          ],
        );
        payloadLines.add({
          'id': itemId,
          'productId': line.productId,
          'quantityMilli': line.quantityMilli,
          'unitCostPaise': line.unitCostPaise,
          'discountPaise': line.discountPaise,
          'taxPercent': rate,
        });
      }
      _database.execute(
        '''UPDATE purchase_bills SET subtotal_paise = ?, discount_paise = ?,
           tax_paise = ?, total_paise = ?, updated_at = ? WHERE id = ?''',
        [
          subtotal,
          discount,
          taxTotal,
          subtotal - discount + taxTotal,
          now,
          billId,
        ],
      );
      _insertOutbox(
        tenantId: tenantId,
        deviceId: deviceId,
        entityType: 'purchase_bill',
        entityId: billId,
        eventType: 'PURCHASE_DRAFT_SAVED',
        payload: {
          'id': billId,
          'supplierId': supplierId,
          'supplierInvoiceNumber': invoiceNumber,
          'purchaseDate': _dayMillis(purchaseDate),
          'branchId': branchId,
          'lines': payloadLines,
        },
        now: now,
      );
    });
    return billId;
  }

  void finalize(String billId) {
    final tenantId = _database.tenantId;
    final config = _database
        .select(
          'SELECT default_branch_id, device_id FROM device_identity WHERE id = 1',
        )
        .first;
    final deviceId = config['device_id'] as String;
    final now = DateTime.now().toUtc().millisecondsSinceEpoch;
    _database.transaction(() {
      final rows = _database.select(
        '''SELECT * FROM purchase_bills WHERE id = ? AND tenant_id = ?
           AND status = 'DRAFT' ''',
        [billId, tenantId],
      );
      if (rows.isEmpty) {
        throw const PurchaseValidationException(
          'Purchase draft not found or already finalized.',
        );
      }
      final bill = rows.first;
      final branchId = bill['branch_id'] as String;
      final date = bill['purchase_date'] as int;
      final freezes = _database.select(
        '''SELECT id FROM period_freezes
           WHERE tenant_id = ? AND (branch_id = ? OR branch_id IS NULL)
             AND unfrozen_at IS NULL AND scope IN ('STOCK', 'ACCOUNTING', 'BOTH')
             AND start_date <= ? AND end_date >= ? LIMIT 1''',
        [tenantId, branchId, date, date],
      );
      if (freezes.isNotEmpty) {
        throw const PurchaseValidationException(
          'This purchase date is inside an active accounting period freeze.',
        );
      }
      final lines = _database.select(
        'SELECT * FROM purchase_bill_items WHERE purchase_bill_id = ?',
        [billId],
      );
      if (lines.isEmpty) {
        throw const PurchaseValidationException(
          'The purchase draft has no product lines.',
        );
      }
      if (lines.any((line) => line['tax_percent'] == null)) {
        throw const PurchaseValidationException(
          'Purchase cannot be finalized: configure a tax rate for every product first. Confirm the applicable tax setup with your accountant.',
        );
      }

      final inventoryAccount = _mappedAccount(
        tenantId,
        'PURCHASE_INVENTORY',
        'ASSET',
      );
      final payableAccount = _mappedAccount(
        tenantId,
        'SUPPLIER_PAYABLE',
        'LIABILITY',
      );
      final taxPaise = bill['tax_paise'] as int;
      final taxAccount = taxPaise == 0
          ? null
          : _mappedAccount(tenantId, 'PURCHASE_TAX_INPUT', 'ASSET');
      final journalId = _uuid.v4();
      _database.execute(
        '''INSERT INTO journal_entries(
           id, tenant_id, branch_id, transaction_date, source_type, source_id,
           narration, status, device_id, created_at)
           VALUES (?, ?, ?, ?, 'PURCHASE', ?, ?, 'DRAFT', ?, ?)''',
        [
          journalId,
          tenantId,
          branchId,
          date,
          billId,
          'Purchase ${bill['internal_reference']}',
          deviceId,
          now,
        ],
      );
      final subtotalAfterDiscount =
          (bill['subtotal_paise'] as int) - (bill['discount_paise'] as int);
      _insertJournalLine(
        journalId,
        inventoryAccount,
        debit: subtotalAfterDiscount,
      );
      if (taxPaise > 0) {
        _insertJournalLine(journalId, taxAccount!, debit: taxPaise);
      }
      _insertJournalLine(
        journalId,
        payableAccount,
        credit: bill['total_paise'] as int,
      );
      final totals = _database
          .select(
            '''SELECT COALESCE(SUM(debit_paise), 0) AS debits,
               COALESCE(SUM(credit_paise), 0) AS credits
               FROM journal_lines WHERE journal_entry_id = ?''',
            [journalId],
          )
          .first;
      if (totals['debits'] != totals['credits']) {
        throw const PurchaseValidationException(
          'Accounting entries are not balanced; no purchase was posted.',
        );
      }

      for (final line in lines) {
        final quantity = (line['quantity_milli'] as int) / 1000;
        _database.execute(
          '''INSERT INTO local_stock(product_id, branch_id, quantity, updated_at)
             VALUES (?, ?, ?, ?)
             ON CONFLICT(product_id, branch_id) DO UPDATE SET
               quantity = local_stock.quantity + excluded.quantity,
               updated_at = excluded.updated_at''',
          [line['product_id'], branchId, quantity, now],
        );
        _database.execute(
          '''INSERT INTO stock_movements(
             id, product_id, branch_id, movement_type, quantity,
             reference_id, created_at, purchase_item_id)
             VALUES (?, ?, ?, 'PURCHASE_IN', ?, ?, ?, ?)''',
          [
            _uuid.v4(),
            line['product_id'],
            branchId,
            quantity,
            billId,
            now,
            line['id'],
          ],
        );
      }
      _database.execute(
        '''UPDATE journal_entries SET status = 'POSTED', posted_at = ?
           WHERE id = ? AND status = 'DRAFT' ''',
        [now, journalId],
      );
      _database.execute(
        '''UPDATE purchase_bills SET status = 'FINALIZED', finalized_at = ?, updated_at = ?
           WHERE id = ? AND status = 'DRAFT' ''',
        [now, now, billId],
      );
      if ((_database.select('SELECT changes() AS n').first['n'] as int) != 1) {
        throw const PurchaseValidationException(
          'Purchase status changed while finalizing; the transaction was rolled back.',
        );
      }
      _insertOutbox(
        tenantId: tenantId,
        deviceId: deviceId,
        entityType: 'purchase_bill',
        entityId: billId,
        eventType: 'PURCHASE_FINALIZED',
        payload: {
          'id': billId,
          'journalId': journalId,
          'branchId': branchId,
          'totalPaise': bill['total_paise'],
          'lines': lines
              .map(
                (line) => {
                  'id': line['id'],
                  'productId': line['product_id'],
                  'quantityMilli': line['quantity_milli'],
                },
              )
              .toList(),
        },
        now: now,
      );
    });
  }

  void _insertJournalLine(
    String journalId,
    String accountId, {
    int debit = 0,
    int credit = 0,
  }) {
    if (debit == 0 && credit == 0) return;
    _database.execute(
      '''INSERT INTO journal_lines(
         id, journal_entry_id, account_id, debit_paise, credit_paise)
         VALUES (?, ?, ?, ?, ?)''',
      [_uuid.v4(), journalId, accountId, debit, credit],
    );
  }

  String _mappedAccount(String tenantId, String purpose, String category) {
    final rows = _database.select(
      '''SELECT a.id FROM accounting_mappings m
         JOIN chart_of_accounts a ON a.id = m.account_id
         WHERE m.tenant_id = ? AND m.purpose = ? AND a.tenant_id = ?
           AND a.category = ? AND a.is_active = 1''',
      [tenantId, purpose, tenantId, category],
    );
    if (rows.isEmpty) {
      throw PurchaseValidationException(
        'Configure an active $category account mapping for $purpose before finalizing purchases.',
      );
    }
    return rows.first['id'] as String;
  }

  void _insertOutbox({
    required String tenantId,
    required String deviceId,
    required String entityType,
    required String entityId,
    required String eventType,
    required Map<String, Object?> payload,
    required int now,
  }) {
    _database.execute(
      '''INSERT INTO sync_outbox(
         id, tenant_id, device_id, entity_type, entity_id, operation,
         event_type, schema_version, payload_json, state, created_at)
         VALUES (?, ?, ?, ?, ?, 'UPSERT', ?, 1, ?, 'PENDING', ?)''',
      [
        _uuid.v4(),
        tenantId,
        deviceId,
        entityType,
        entityId,
        '$eventType:${_uuid.v4()}',
        jsonEncode(payload),
        now,
      ],
    );
  }

  static int _dayMillis(DateTime date) =>
      DateTime.utc(date.year, date.month, date.day).millisecondsSinceEpoch;

  static String? _clean(String? value) {
    final result = value?.trim();
    return result == null || result.isEmpty ? null : result;
  }
}
