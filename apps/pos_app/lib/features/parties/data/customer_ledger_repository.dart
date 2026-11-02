import '../../../database/app_database.dart';

class CustomerAccount {
  const CustomerAccount({
    required this.id,
    required this.name,
    required this.phone,
    required this.gstin,
  });

  final String id;
  final String name;
  final String? phone;
  final String? gstin;
}

class CustomerLedgerInvoice {
  const CustomerLedgerInvoice({
    required this.invoiceNumber,
    required this.date,
    required this.totalPaise,
    required this.cashRecordedPaise,
    required this.digitalUnverifiedPaise,
    required this.creditPaise,
  });

  final String invoiceNumber;
  final DateTime date;
  final int totalPaise;
  final int cashRecordedPaise;
  final int digitalUnverifiedPaise;
  final int creditPaise;

  int get balanceNotConfirmedPaise => totalPaise - cashRecordedPaise;
}

class CustomerLedgerRepository {
  CustomerLedgerRepository(this._database);
  final AppDatabase _database;

  List<CustomerAccount> searchCustomers(String query) {
    final term = query.trim();
    return _database
        .select(
          '''SELECT id, name, phone, gstin FROM customers
             WHERE tenant_id = ? AND (? = '' OR name LIKE '%' || ? || '%' COLLATE NOCASE
               OR phone LIKE '%' || ? || '%' COLLATE NOCASE
               OR gstin LIKE '%' || ? || '%' COLLATE NOCASE)
             ORDER BY name COLLATE NOCASE LIMIT 500''',
          [_database.tenantId, term, term, term, term],
        )
        .map(
          (row) => CustomerAccount(
            id: row['id'] as String,
            name: row['name'] as String,
            phone: row['phone'] as String?,
            gstin: row['gstin'] as String?,
          ),
        )
        .toList(growable: false);
  }

  List<CustomerLedgerInvoice> invoices(String customerId) => _database
      .select(
        '''SELECT i.invoice_number, i.invoice_date, i.total_paise,
           COALESCE(SUM(CASE WHEN p.method = 'CASH'
             AND p.recorded_status = 'RECORDED' THEN p.amount_paise ELSE 0 END), 0)
             AS cash_recorded,
           COALESCE(SUM(CASE WHEN p.method IN ('UPI', 'CARD')
             AND p.recorded_status = 'RECORDED_UNVERIFIED'
             THEN p.amount_paise ELSE 0 END), 0) AS digital_unverified,
           COALESCE(SUM(CASE WHEN p.method = 'CREDIT'
             THEN p.amount_paise ELSE 0 END), 0) AS credit_amount
           FROM invoices i LEFT JOIN invoice_payments p ON p.invoice_id = i.id
           WHERE i.tenant_id = ? AND i.customer_id = ? AND i.state = 'FINALIZED'
           GROUP BY i.id ORDER BY i.invoice_date DESC LIMIT 500''',
        [_database.tenantId, customerId],
      )
      .map(
        (row) => CustomerLedgerInvoice(
          invoiceNumber: row['invoice_number'] as String,
          date: DateTime.fromMillisecondsSinceEpoch(row['invoice_date'] as int),
          totalPaise: row['total_paise'] as int,
          cashRecordedPaise: row['cash_recorded'] as int,
          digitalUnverifiedPaise: row['digital_unverified'] as int,
          creditPaise: row['credit_amount'] as int,
        ),
      )
      .toList(growable: false);
}
