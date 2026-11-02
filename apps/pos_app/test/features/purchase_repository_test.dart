import 'package:flutter_test/flutter_test.dart';
import 'package:pos_app/features/accounting/data/accounting_repository.dart';
import 'package:pos_app/features/accounting/domain/accounting.dart';
import 'package:pos_app/features/audit/data/period_freeze_repository.dart';
import 'package:pos_app/features/items/data/items_repository_impl.dart';
import 'package:pos_app/features/parties/data/supplier_repository.dart';
import 'package:pos_app/features/parties/domain/supplier.dart';
import 'package:pos_app/features/purchase/data/purchase_repository.dart';
import 'package:pos_app/features/purchase/domain/purchase.dart';

import '../support/test_database.dart';

void main() {
  late TestDatabaseFixture fixture;
  late SupplierRepository suppliers;
  late PurchaseRepository purchases;
  late ItemsRepositoryImpl products;
  late AccountingRepository accounting;
  late String supplierId;
  late String productId;

  setUp(() async {
    fixture = await createTestDatabase(prepareSale: true);
    suppliers = SupplierRepository(fixture.database);
    purchases = PurchaseRepository(fixture.database);
    products = ItemsRepositoryImpl(fixture.database);
    accounting = AccountingRepository(fixture.database);
    supplierId = suppliers.save(
      const SupplierDraft(code: 'SUP-1', businessName: 'Test supplier'),
    );
    productId = (await products.findBySku('TY-100'))!.id;
  });
  tearDown(() => fixture.close());

  test('supplier search and code uniqueness are tenant-local', () {
    expect(suppliers.search(query: 'SUP-1').single.id, supplierId);
    expect(
      () => suppliers.save(
        const SupplierDraft(code: 'sup-1', businessName: 'Duplicate supplier'),
      ),
      throwsA(isA<SupplierValidationException>()),
    );
    expect(suppliers.search(), hasLength(1));
  });

  test('draft does not change stock; finalization atomically posts once', () {
    final database = fixture.database;
    final originalStock = database
        .select('SELECT quantity FROM local_stock')
        .first['quantity'];
    final billId = purchases.saveDraft(
      supplierId: supplierId,
      supplierInvoiceNumber: 'SUP-INV-1',
      purchaseDate: DateTime(2026, 10, 22),
      supplierInvoiceDate: DateTime(2026, 10, 20),
      lines: [
        PurchaseLineDraft(
          productId: productId,
          quantityMilli: 1000,
          unitCostPaise: 50000,
        ),
      ],
    );
    expect(
      database.select('SELECT quantity FROM local_stock').first['quantity'],
      originalStock,
    );
    expect(
      database
          .select(
            'SELECT count(*) AS n FROM stock_movements WHERE purchase_item_id IS NOT NULL',
          )
          .first['n'],
      0,
    );
    expect(
      database.select('SELECT total_paise FROM purchase_bills WHERE id = ?', [
        billId,
      ]).first['total_paise'],
      59000,
    );

    expect(
      () => purchases.finalize(billId),
      throwsA(isA<PurchaseValidationException>()),
    );
    expect(
      database.select('SELECT quantity FROM local_stock').first['quantity'],
      originalStock,
    );
    expect(
      database.select(
        'SELECT count(*) AS n FROM journal_entries WHERE source_id = ?',
        [billId],
      ).first['n'],
      0,
    );

    final inventory = accounting.saveAccount(
      code: 'INV',
      name: 'Inventory',
      category: AccountCategory.asset,
    );
    final inputTax = accounting.saveAccount(
      code: 'TAX-IN',
      name: 'Input tax',
      category: AccountCategory.asset,
    );
    final payable = accounting.saveAccount(
      code: 'AP',
      name: 'Supplier payable',
      category: AccountCategory.liability,
    );
    accounting.mapAccount(AccountMappingPurpose.purchaseInventory, inventory);
    accounting.mapAccount(AccountMappingPurpose.purchaseTaxInput, inputTax);
    accounting.mapAccount(AccountMappingPurpose.supplierPayable, payable);

    purchases.finalize(billId);
    expect(
      database.select('SELECT quantity FROM local_stock').first['quantity'],
      101,
    );
    expect(
      database.select(
        'SELECT count(*) AS n FROM stock_movements WHERE reference_id = ?',
        [billId],
      ).first['n'],
      1,
    );
    final journal = database
        .select(
          '''SELECT j.id, j.status, SUM(l.debit_paise) AS debits,
             SUM(l.credit_paise) AS credits FROM journal_entries j
             JOIN journal_lines l ON l.journal_entry_id = j.id
             WHERE j.source_id = ? GROUP BY j.id''',
          [billId],
        )
        .single;
    expect(journal['status'], 'POSTED');
    expect(journal['debits'], 59000);
    expect(journal['credits'], 59000);
    expect(accounting.ledger(inventory).single.balancePaise, 50000);
    expect(
      () => purchases.finalize(billId),
      throwsA(isA<PurchaseValidationException>()),
    );
    expect(
      database.select('SELECT quantity FROM local_stock').first['quantity'],
      101,
    );
    expect(
      () => database.execute(
        '''UPDATE journal_lines SET debit_paise = 1
           WHERE journal_entry_id = ?''',
        [journal['id']],
      ),
      throwsA(anything),
    );
  });

  test('period freeze blocks purchase posting', () {
    PeriodFreezeRepository(fixture.database).freeze(
      startDate: DateTime(2026, 10, 22),
      endDate: DateTime(2026, 10, 22),
      scope: FreezeScope.accounting,
      reason: 'Closed accounting date',
    );
    final billId = purchases.saveDraft(
      supplierId: supplierId,
      supplierInvoiceNumber: 'SUP-INV-FROZEN',
      purchaseDate: DateTime(2026, 10, 22),
      supplierInvoiceDate: DateTime(2026, 10, 22),
      lines: [
        PurchaseLineDraft(
          productId: productId,
          quantityMilli: 1000,
          unitCostPaise: 50000,
        ),
      ],
    );
    expect(
      () => purchases.finalize(billId),
      throwsA(isA<PurchaseValidationException>()),
    );
    expect(
      fixture.database.select(
        'SELECT status FROM purchase_bills WHERE id = ?',
        [billId],
      ).first['status'],
      'DRAFT',
    );
  });

  test('purchase return requests reserve quantity but never change stock', () {
    final database = fixture.database;
    final billId = purchases.saveDraft(
      supplierId: supplierId,
      supplierInvoiceNumber: 'SUP-INV-RETURN',
      purchaseDate: DateTime(2026, 10, 22),
      supplierInvoiceDate: DateTime(2026, 10, 22),
      lines: [
        PurchaseLineDraft(
          productId: productId,
          quantityMilli: 1000,
          unitCostPaise: 50000,
        ),
      ],
    );
    final inventory = accounting.saveAccount(
      code: 'INV-RET',
      name: 'Inventory for return test',
      category: AccountCategory.asset,
    );
    final payable = accounting.saveAccount(
      code: 'AP-RET',
      name: 'Payable for return test',
      category: AccountCategory.liability,
    );
    final tax = accounting.saveAccount(
      code: 'TAX-RET',
      name: 'Input tax for return test',
      category: AccountCategory.asset,
    );
    accounting.mapAccount(AccountMappingPurpose.purchaseInventory, inventory);
    accounting.mapAccount(AccountMappingPurpose.supplierPayable, payable);
    accounting.mapAccount(AccountMappingPurpose.purchaseTaxInput, tax);
    purchases.finalize(billId);
    final originalLine =
        database.select(
              'SELECT id FROM purchase_bill_items WHERE purchase_bill_id = ?',
              [billId],
            ).single['id']
            as String;
    final returnId = purchases.saveReturnForReview(
      purchaseBillId: billId,
      reason: 'Client review required',
      lines: [
        PurchaseReturnLineDraft(
          purchaseBillItemId: originalLine,
          quantityMilli: 500,
        ),
      ],
    );
    expect(
      database.select('SELECT status FROM purchase_returns WHERE id = ?', [
        returnId,
      ]).single['status'],
      'REVIEW_REQUIRED',
    );
    expect(
      () => purchases.saveReturnForReview(
        purchaseBillId: billId,
        reason: 'Exceeds remaining amount',
        lines: [
          PurchaseReturnLineDraft(
            purchaseBillItemId: originalLine,
            quantityMilli: 600,
          ),
        ],
      ),
      throwsA(isA<PurchaseValidationException>()),
    );
    expect(
      database.select('SELECT quantity FROM local_stock').first['quantity'],
      101,
    );
    expect(
      purchases.returnableLines(billId).single.availableQuantityMilli,
      500,
    );
  });
}
