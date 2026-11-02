import 'dart:convert';

import 'package:uuid/uuid.dart';

import '../../../database/app_database.dart';
import '../../items/domain/item.dart';
import '../domain/invoice_number.dart';

enum PaymentMethod { cash, upi, card, credit }

class SaleLineInput {
  const SaleLineInput({
    required this.productId,
    required this.priceTier,
    required this.quantityMilli,
    this.discountBasisPoints = 0,
    this.originatingKitId,
    this.unitPricePaise,
  });

  final String productId;
  final PriceTier priceTier;
  final int quantityMilli;
  final int discountBasisPoints;
  final String? originatingKitId;
  final int? unitPricePaise;
}

class SalePaymentInput {
  const SalePaymentInput(this.method, this.amountPaise, {this.reference});
  final PaymentMethod method;
  final int amountPaise;
  final String? reference;
}

class SaleDraft {
  const SaleDraft({
    required this.id,
    required this.lines,
    required this.payments,
    this.customerId,
  });

  final String id;
  final String? customerId;
  final List<SaleLineInput> lines;
  final List<SalePaymentInput> payments;
}

class SaleLine {
  const SaleLine({
    required this.id,
    required this.productId,
    required this.name,
    required this.sku,
    required this.priceTier,
    required this.quantityMilli,
    required this.unitPricePaise,
    required this.discountPaise,
    required this.taxPercent,
    required this.taxPaise,
    required this.totalPaise,
    this.originatingKitId,
  });

  final String id;
  final String productId;
  final String name;
  final String sku;
  final PriceTier priceTier;
  final int quantityMilli;
  final int unitPricePaise;
  final int discountPaise;
  final double taxPercent;
  final int taxPaise;
  final int totalPaise;
  final String? originatingKitId;
}

class SavedInvoice {
  const SavedInvoice({
    required this.id,
    required this.invoiceNumber,
    required this.invoiceDate,
    required this.customerName,
    required this.subtotalPaise,
    required this.taxPaise,
    required this.totalPaise,
    required this.state,
    required this.lines,
    required this.payments,
  });

  final String id;
  final String invoiceNumber;
  final DateTime invoiceDate;
  final String? customerName;
  final int subtotalPaise;
  final int taxPaise;
  final int totalPaise;
  final String state;
  final List<SaleLine> lines;
  final List<SalePaymentInput> payments;
}

class InvoiceListEntry {
  const InvoiceListEntry({
    required this.id,
    required this.invoiceNumber,
    required this.invoiceDate,
    required this.customerName,
    required this.totalPaise,
    required this.state,
  });
  final String id;
  final String invoiceNumber;
  final DateTime invoiceDate;
  final String? customerName;
  final int totalPaise;
  final String state;
}

class InvoiceValidationException implements Exception {
  const InvoiceValidationException(this.message);
  final String message;
  @override
  String toString() => message;
}

class OfflineBillingRepository {
  OfflineBillingRepository(this._database);
  final AppDatabase _database;
  static const _uuid = Uuid();

  DeviceInvoiceConfig configuration() {
    final row = _database.select(
      '''SELECT d.device_id, d.tenant_id, d.invoice_prefix, d.invoice_sequence,
                d.default_branch_id, b.name AS branch_name
         FROM device_identity d LEFT JOIN branches b ON b.id = d.default_branch_id
         WHERE d.id = 1''',
    ).first;
    return DeviceInvoiceConfig(
      deviceId: row['device_id'] as String,
      tenantId: row['tenant_id'] as String,
      prefix: row['invoice_prefix'] as String?,
      sequence: row['invoice_sequence'] as int,
      branchId: row['default_branch_id'] as String?,
      branchName: row['branch_name'] as String?,
    );
  }

  List<BranchChoice> branches() => _database
      .select(
        'SELECT id, name FROM branches WHERE tenant_id = ? AND is_active = 1 ORDER BY name COLLATE NOCASE',
        [_database.tenantId],
      )
      .map((row) => BranchChoice(row['id'] as String, row['name'] as String))
      .toList();

  String createBranch(String name) {
    final normalized = name.trim();
    if (normalized.isEmpty) {
      throw const InvoiceValidationException('Branch name is required.');
    }
    final id = _uuid.v4();
    final now = DateTime.now().toUtc().millisecondsSinceEpoch;
    _database.transaction(() {
      _database.execute(
        'INSERT INTO branches(id, tenant_id, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
        [id, _database.tenantId, normalized, now, now],
      );
      _database.execute(
        'UPDATE device_identity SET default_branch_id = ? WHERE id = 1 AND default_branch_id IS NULL',
        [id],
      );
    });
    return id;
  }

  void setDefaultBranch(String branchId) {
    final count =
        _database.select(
              'SELECT count(*) AS n FROM branches WHERE id = ? AND tenant_id = ? AND is_active = 1',
              [branchId, _database.tenantId],
            ).first['n']
            as int;
    if (count != 1) {
      throw const InvoiceValidationException('Choose an active branch.');
    }
    _database.execute(
      'UPDATE device_identity SET default_branch_id = ? WHERE id = 1',
      [branchId],
    );
  }

  void assignInvoicePrefix(String prefix) {
    final value = prefix.trim().toUpperCase();
    if (!RegExp(r'^[A-Z0-9]{1,5}$').hasMatch(value)) {
      throw const InvoiceValidationException(
        'Prefix must be 1 to 5 letters or digits.',
      );
    }
    _database.transaction(() {
      final existing = configuration().prefix;
      if (existing != null && existing != value) {
        throw const InvoiceValidationException(
          'The assigned invoice prefix is immutable.',
        );
      }
      _database.execute(
        'UPDATE device_identity SET invoice_prefix = ? WHERE id = 1 AND invoice_prefix IS NULL',
        [value],
      );
    });
  }

  void addOpeningStock({
    required String productId,
    required int quantityMilli,
  }) {
    if (quantityMilli <= 0) {
      throw const InvoiceValidationException(
        'Opening quantity must be positive.',
      );
    }
    final config = configuration();
    final branchId = config.branchId;
    if (branchId == null) {
      throw const InvoiceValidationException('Set a default branch first.');
    }
    final timestamp = DateTime.now().toUtc().millisecondsSinceEpoch;
    _database.transaction(() {
      final product = _database.select(
        'SELECT id FROM products WHERE id = ? AND tenant_id = ? AND is_active = 1',
        [productId, config.tenantId],
      );
      if (product.isEmpty) {
        throw const InvoiceValidationException('Select an active product.');
      }
      _database.execute(
        '''INSERT INTO local_stock(product_id, branch_id, quantity, updated_at)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(product_id, branch_id) DO UPDATE SET quantity = quantity + excluded.quantity, updated_at = excluded.updated_at''',
        [productId, branchId, quantityMilli / 1000, timestamp],
      );
      _database.execute(
        '''INSERT INTO stock_movements(id, product_id, branch_id, movement_type, quantity, reference_id, created_at)
           VALUES (?, ?, ?, 'OPENING_BALANCE', ?, NULL, ?)''',
        [_uuid.v4(), productId, branchId, quantityMilli / 1000, timestamp],
      );
    });
  }

  int stockQuantityMilli(String productId) {
    final branchId = configuration().branchId;
    if (branchId == null) return 0;
    final rows = _database.select(
      'SELECT quantity FROM local_stock WHERE product_id = ? AND branch_id = ?',
      [productId, branchId],
    );
    return rows.isEmpty ? 0 : ((rows.first['quantity'] as num) * 1000).round();
  }

  SavedInvoice finalizeSale(SaleDraft draft) {
    if (draft.lines.isEmpty) {
      throw const InvoiceValidationException('Add at least one product.');
    }
    if (draft.lines.any(
      (line) =>
          line.quantityMilli <= 0 ||
          line.discountBasisPoints < 0 ||
          line.discountBasisPoints > 10000,
    )) {
      throw const InvoiceValidationException(
        'Quantities and discounts are invalid.',
      );
    }
    final config = configuration();
    if (config.prefix == null) {
      throw const InvoiceValidationException(
        'Assign the approved device invoice prefix in Settings first.',
      );
    }
    if (config.branchId == null) {
      throw const InvoiceValidationException(
        'Set the active branch in Settings first.',
      );
    }
    if (draft.payments.any((payment) => payment.amountPaise < 0)) {
      throw const InvoiceValidationException(
        'Payment amounts cannot be negative.',
      );
    }
    final attemptedAt = DateTime.now().toUtc().millisecondsSinceEpoch;
    final frozenPeriod = _database.select(
      '''SELECT id FROM period_freezes
         WHERE tenant_id = ? AND (branch_id IS NULL OR branch_id = ?)
           AND scope IN ('STOCK', 'ACCOUNTING', 'BOTH')
           AND unfrozen_at IS NULL
           AND start_date <= ? AND end_date >= ?
         LIMIT 1''',
      [config.tenantId, config.branchId, attemptedAt, attemptedAt],
    );
    if (frozenPeriod.isNotEmpty) {
      _database.execute(
        '''INSERT INTO business_audit_events(
          id, tenant_id, branch_id, event_type, entity_type, entity_id, details, created_at
        ) VALUES (?, ?, ?, 'BLOCKED_BY_PERIOD_FREEZE', 'invoice', ?, ?, ?)''',
        [
          _uuid.v4(),
          config.tenantId,
          config.branchId,
          draft.id,
          'Sale finalization blocked by frozen accounting/stock period.',
          attemptedAt,
        ],
      );
      throw const InvoiceValidationException(
        'This accounting/stock period is frozen. Finalizing the sale is blocked.',
      );
    }

    return _database.transaction(() {
      final duplicate = _database.select(
        'SELECT id FROM invoices WHERE id = ? OR idempotency_key = ?',
        [draft.id, draft.id],
      );
      if (duplicate.isNotEmpty) {
        return loadInvoice(duplicate.first['id'] as String)!;
      }

      final computed = <SaleLine>[];
      var subtotal = 0;
      var taxTotal = 0;
      for (final input in draft.lines) {
        final productRows = _database.select(
          'SELECT id, name, sku, tax_percent FROM products WHERE tenant_id = ? AND id = ? AND is_active = 1',
          [config.tenantId, input.productId],
        );
        if (productRows.isEmpty) {
          throw const InvoiceValidationException(
            'A selected product is no longer active.',
          );
        }
        final product = productRows.first;
        final taxRate = product['tax_percent'] as num?;
        if (taxRate == null) {
          throw InvoiceValidationException(
            'Configure an approved tax rate for ${product['name']} before finalizing.',
          );
        }
        final priceRows = input.unitPricePaise == null
            ? _database.select(
                '''SELECT price_paise FROM product_prices
                   WHERE product_id = ? AND tier = ? AND valid_from <= ?
                   ORDER BY valid_from DESC, created_at DESC LIMIT 1''',
                [
                  input.productId,
                  input.priceTier.databaseValue,
                  DateTime.now().toUtc().millisecondsSinceEpoch,
                ],
              )
            : null;
        if (priceRows != null && priceRows.isEmpty) {
          throw InvoiceValidationException(
            'No current ${input.priceTier.label} price is set for ${product['name']}.',
          );
        }
        final price =
            input.unitPricePaise ?? (priceRows!.first['price_paise'] as int);
        if (price < 0) {
          throw const InvoiceValidationException(
            'A selling price cannot be negative.',
          );
        }
        if (input.originatingKitId != null) {
          final component = _database.select(
            '''SELECT c.product_id FROM bom_components c
               JOIN bom_kits k ON k.id = c.kit_id
               WHERE c.kit_id = ? AND c.product_id = ? AND k.tenant_id = ? AND k.is_active = 1''',
            [input.originatingKitId, input.productId, config.tenantId],
          );
          if (component.isEmpty) {
            throw const InvoiceValidationException(
              'The kit component changed before this invoice was finalized.',
            );
          }
        }
        final gross = _roundDiv(price * input.quantityMilli, 1000);
        final discount = _roundDiv(gross * input.discountBasisPoints, 10000);
        final taxable = gross - discount;
        final taxBps = (taxRate * 100).round();
        final tax = _roundDiv(taxable * taxBps, 10000);
        final line = SaleLine(
          id: _uuid.v4(),
          productId: input.productId,
          name: product['name'] as String,
          sku: product['sku'] as String,
          priceTier: input.priceTier,
          quantityMilli: input.quantityMilli,
          unitPricePaise: price,
          discountPaise: discount,
          taxPercent: taxRate.toDouble(),
          taxPaise: tax,
          totalPaise: taxable + tax,
          originatingKitId: input.originatingKitId,
        );
        computed.add(line);
        subtotal += taxable;
        taxTotal += tax;
      }
      final total = subtotal + taxTotal;
      final paymentTotal = draft.payments.fold<int>(
        0,
        (sum, payment) => sum + payment.amountPaise,
      );
      if (paymentTotal != total) {
        throw const InvoiceValidationException(
          'Payment allocations must exactly equal the invoice total.',
        );
      }
      if (draft.payments.any(
        (payment) =>
            payment.method == PaymentMethod.credit && payment.amountPaise > 0,
      )) {
        if (draft.customerId == null) {
          throw const InvoiceValidationException(
            'Select a customer before recording credit.',
          );
        }
        final customerRows = _database.select(
          'SELECT phone, gstin FROM customers WHERE id = ? AND tenant_id = ?',
          [draft.customerId, config.tenantId],
        );
        if (customerRows.isEmpty ||
            ((customerRows.first['phone'] as String?)?.trim().isEmpty ??
                    true) &&
                ((customerRows.first['gstin'] as String?)?.trim().isEmpty ??
                    true)) {
          throw const InvoiceValidationException(
            'Credit requires a customer with a phone number or GSTIN.',
          );
        }
      }

      final requiredStock = <String, int>{};
      for (final line in computed) {
        requiredStock.update(
          line.productId,
          (value) => value + line.quantityMilli,
          ifAbsent: () => line.quantityMilli,
        );
      }
      for (final entry in requiredStock.entries) {
        final stock = _database.select(
          'SELECT quantity FROM local_stock WHERE product_id = ? AND branch_id = ?',
          [entry.key, config.branchId],
        );
        final productName = computed
            .firstWhere((line) => line.productId == entry.key)
            .name;
        if (stock.isEmpty) {
          throw InvoiceValidationException(
            'Opening stock is not configured for $productName.',
          );
        }
        final available = (stock.first['quantity'] as num).toDouble();
        if (available + 0.000001 < entry.value / 1000) {
          throw InvoiceValidationException(
            'Insufficient stock for $productName. Available: ${_quantityMilli((available * 1000).round())}.',
          );
        }
      }

      _database.execute(
        'UPDATE device_identity SET invoice_sequence = invoice_sequence + 1 WHERE id = 1',
      );
      final sequence =
          _database
                  .select(
                    'SELECT invoice_sequence FROM device_identity WHERE id = 1',
                  )
                  .first['invoice_sequence']
              as int;
      final number = createInvoiceNumber(
        prefix: config.prefix!,
        year: DateTime.now().year,
        sequence: sequence,
      );
      final now = DateTime.now().toUtc().millisecondsSinceEpoch;
      final date = DateTime.now();
      _database.execute(
        '''INSERT INTO invoices(id, tenant_id, branch_id, customer_id, invoice_number,
          invoice_date, state, subtotal_paise, tax_paise, total_paise, created_at, updated_at, idempotency_key)
          VALUES (?, ?, ?, ?, ?, ?, 'FINALIZED', ?, ?, ?, ?, ?, ?)''',
        [
          draft.id,
          config.tenantId,
          config.branchId,
          draft.customerId,
          number,
          date.millisecondsSinceEpoch,
          subtotal,
          taxTotal,
          total,
          now,
          now,
          draft.id,
        ],
      );

      for (var i = 0; i < computed.length; i++) {
        final line = computed[i];
        final input = draft.lines[i];
        final gross = _roundDiv(line.unitPricePaise * line.quantityMilli, 1000);
        final discountRate = gross == 0
            ? 0.0
            : line.discountPaise * 100 / gross;
        _database.execute(
          '''INSERT INTO invoice_items(id, invoice_id, product_id, product_name, sku, quantity,
            unit_price_paise, discount_percent, tax_percent, line_total_paise, price_tier,
            gross_paise, discount_paise, tax_paise, originating_kit_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
          [
            line.id,
            draft.id,
            line.productId,
            line.name,
            line.sku,
            input.quantityMilli / 1000,
            line.unitPricePaise,
            discountRate,
            line.taxPercent,
            line.totalPaise,
            line.priceTier.databaseValue,
            gross,
            line.discountPaise,
            line.taxPaise,
            input.originatingKitId,
          ],
        );
        _database.execute(
          'UPDATE local_stock SET quantity = quantity - ?, updated_at = ? WHERE product_id = ? AND branch_id = ?',
          [input.quantityMilli / 1000, now, line.productId, config.branchId],
        );
        final changedRows =
            _database.select('SELECT changes() AS count').first['count'] as int;
        if (changedRows != 1) {
          throw const InvoiceValidationException(
            'Stock changed during finalization; the invoice was rolled back.',
          );
        }
        _database.execute(
          '''INSERT INTO stock_movements(id, product_id, branch_id, movement_type, quantity,
            reference_id, created_at, invoice_item_id)
            VALUES (?, ?, ?, 'SALE', ?, ?, ?, ?)''',
          [
            _uuid.v4(),
            line.productId,
            config.branchId,
            -(input.quantityMilli / 1000),
            draft.id,
            now,
            line.id,
          ],
        );
      }
      for (final payment in draft.payments) {
        final status = switch (payment.method) {
          PaymentMethod.upi || PaymentMethod.card => 'RECORDED_UNVERIFIED',
          PaymentMethod.credit => 'OUTSTANDING',
          PaymentMethod.cash => 'RECORDED',
        };
        _database.execute(
          '''INSERT INTO invoice_payments(id, invoice_id, method, amount_paise, reference, created_at, recorded_status)
            VALUES (?, ?, ?, ?, ?, ?, ?)''',
          [
            _uuid.v4(),
            draft.id,
            payment.method.name.toUpperCase(),
            payment.amountPaise,
            payment.reference,
            now,
            status,
          ],
        );
      }
      final payload = jsonEncode({
        'invoiceNumber': number,
        'customerId': draft.customerId,
        'totalPaise': total,
        'lines': computed
            .map(
              (line) => {
                'id': line.id,
                'productId': line.productId,
                'quantityMilli': line.quantityMilli,
                'totalPaise': line.totalPaise,
                'originatingKitId':
                    draft.lines[computed.indexOf(line)].originatingKitId,
              },
            )
            .toList(),
      });
      _database.execute(
        '''INSERT INTO sync_outbox(id, tenant_id, device_id, entity_type, entity_id, operation,
          event_type, schema_version, payload_json, state, created_at)
          VALUES (?, ?, ?, 'invoice', ?, 'UPSERT', 'INVOICE_FINALIZED', 1, ?, 'PENDING', ?)''',
        [_uuid.v4(), config.tenantId, config.deviceId, draft.id, payload, now],
      );
      return loadInvoice(draft.id)!;
    });
  }

  List<InvoiceListEntry> searchInvoices(String query) {
    final value = query.trim();
    return _database
        .select(
          '''SELECT i.id, i.invoice_number, i.invoice_date, i.total_paise, i.state, c.name AS customer_name
         FROM invoices i LEFT JOIN customers c ON c.id = i.customer_id
         WHERE i.tenant_id = ? AND (? = '' OR i.invoice_number LIKE '%' || ? || '%' COLLATE NOCASE
           OR c.name LIKE '%' || ? || '%' COLLATE NOCASE)
         ORDER BY i.invoice_date DESC LIMIT 500''',
          [_database.tenantId, value, value, value],
        )
        .map(
          (row) => InvoiceListEntry(
            id: row['id'] as String,
            invoiceNumber: row['invoice_number'] as String,
            invoiceDate: DateTime.fromMillisecondsSinceEpoch(
              row['invoice_date'] as int,
            ),
            customerName: row['customer_name'] as String?,
            totalPaise: row['total_paise'] as int,
            state: row['state'] as String,
          ),
        )
        .toList(growable: false);
  }

  SavedInvoice? loadInvoice(String id) {
    final rows = _database.select(
      '''SELECT i.*, c.name AS customer_name FROM invoices i
         LEFT JOIN customers c ON c.id = i.customer_id
         WHERE i.id = ? AND i.tenant_id = ?''',
      [id, _database.tenantId],
    );
    if (rows.isEmpty) return null;
    final row = rows.first;
    final lineRows = _database.select(
      'SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY rowid',
      [id],
    );
    final paymentRows = _database.select(
      'SELECT method, amount_paise, reference FROM invoice_payments WHERE invoice_id = ? ORDER BY rowid',
      [id],
    );
    return SavedInvoice(
      id: id,
      invoiceNumber: row['invoice_number'] as String,
      invoiceDate: DateTime.fromMillisecondsSinceEpoch(
        row['invoice_date'] as int,
      ),
      customerName: row['customer_name'] as String?,
      subtotalPaise: row['subtotal_paise'] as int,
      taxPaise: row['tax_paise'] as int,
      totalPaise: row['total_paise'] as int,
      state: row['state'] as String,
      lines: lineRows
          .map(
            (line) => SaleLine(
              id: line['id'] as String,
              productId: line['product_id'] as String,
              name: line['product_name'] as String,
              sku: line['sku'] as String? ?? '',
              priceTier: PriceTier.fromDatabase(
                line['price_tier'] as String? ?? 'MRP',
              ),
              quantityMilli: ((line['quantity'] as num) * 1000).round(),
              unitPricePaise: line['unit_price_paise'] as int,
              discountPaise: line['discount_paise'] as int,
              taxPercent: (line['tax_percent'] as num).toDouble(),
              taxPaise: line['tax_paise'] as int,
              totalPaise: line['line_total_paise'] as int,
              originatingKitId: line['originating_kit_id'] as String?,
            ),
          )
          .toList(growable: false),
      payments: paymentRows
          .map(
            (payment) => SalePaymentInput(
              PaymentMethod.values.firstWhere(
                (method) => method.name.toUpperCase() == payment['method'],
              ),
              payment['amount_paise'] as int,
              reference: payment['reference'] as String?,
            ),
          )
          .toList(growable: false),
    );
  }

  int pendingOutboxCount() =>
      _database
              .select(
                'SELECT count(*) AS n FROM sync_outbox WHERE state = \'PENDING\'',
              )
              .first['n']
          as int;

  static int _roundDiv(int numerator, int denominator) =>
      (numerator + denominator ~/ 2) ~/ denominator;
  static String _quantityMilli(int value) =>
      '${value ~/ 1000}.${(value % 1000).toString().padLeft(3, '0')}';
}

class DeviceInvoiceConfig {
  const DeviceInvoiceConfig({
    required this.deviceId,
    required this.tenantId,
    required this.prefix,
    required this.sequence,
    required this.branchId,
    required this.branchName,
  });
  final String deviceId;
  final String tenantId;
  final String? prefix;
  final int sequence;
  final String? branchId;
  final String? branchName;
}

class BranchChoice {
  const BranchChoice(this.id, this.name);
  final String id;
  final String name;
}
