import 'package:flutter_test/flutter_test.dart';
import 'package:pos_app/database/app_database.dart';
import 'package:pos_app/features/audit/data/period_freeze_repository.dart';
import 'package:pos_app/features/audit/data/stock_audit_repository.dart';
import 'package:pos_app/features/billing/data/offline_billing_repository.dart';
import 'package:pos_app/features/items/data/kits_repository.dart';
import 'package:pos_app/features/items/data/items_repository_impl.dart';
import 'package:pos_app/features/items/domain/item.dart';
import 'package:pos_app/features/items/domain/kit.dart';
import 'package:pos_app/features/quotation/data/finance_quotation_repository.dart';
import 'package:pos_app/features/vouchers/data/management_register_repository.dart';
import 'package:uuid/uuid.dart';

import '../support/test_database.dart';

void main() {
  late TestDatabaseFixture fixture;
  late ItemsRepositoryImpl items;
  late OfflineBillingRepository billing;

  setUpAll(() async {
    fixture = await createTestDatabase(prepareSale: true);
    items = ItemsRepositoryImpl(fixture.database);
    billing = OfflineBillingRepository(fixture.database);
  });
  tearDownAll(() => fixture.close());

  test(
    'kit persists and finalizes component with price snapshot and stock once',
    () async {
      final product = (await items.findBySku('TY-100'))!;
      final existingPrices = await items.currentPrices(product.id);
      await items.saveProduct(
        ProductDraft(
          id: product.id,
          branchId: product.branchId,
          name: product.name,
          sku: product.sku,
          barcode: product.barcode,
          category: product.category,
          brand: product.brand,
          hsnCode: product.hsnCode,
          unit: product.unit,
          taxPercent: product.taxPercent,
          isActive: product.isActive,
          prices: {...existingPrices, PriceTier.mrp: 11000},
          validFrom: DateTime.now(),
        ),
      );
      final kitId = KitsRepository(fixture.database).save(
        name: 'Tyre set',
        isActive: true,
        components: [
          TyreKitDraftComponent(
            productId: product.id,
            quantityMilli: 1000,
            tier: PriceTier.mrp,
          ),
        ],
      );
      final kit = KitsRepository(fixture.database).get(kitId)!;
      expect(kit.components, hasLength(1));
      expect(kit.components.single.tier, PriceTier.mrp);

      final invoice = billing.finalizeSale(
        SaleDraft(
          id: const Uuid().v4(),
          lines: [
            SaleLineInput(
              productId: product.id,
              priceTier: PriceTier.mrp,
              quantityMilli: 1000,
              originatingKitId: kitId,
              unitPricePaise: 8500,
            ),
          ],
          payments: const [SalePaymentInput(PaymentMethod.cash, 10030)],
        ),
      );
      expect(invoice.lines.single.unitPricePaise, 8500);
      expect(invoice.lines.single.originatingKitId, kitId);
      expect(
        fixture.database
            .select('SELECT quantity FROM local_stock')
            .first['quantity'],
        99.0,
      );
      expect(
        fixture.database.select(
          'SELECT count(*) AS n FROM stock_movements WHERE reference_id = ?',
          [invoice.id],
        ).first['n'],
        1,
      );
    },
  );

  test(
    'insufficient kit component stock leaves invoice and stock unchanged',
    () async {
      final product = (await items.findBySku('TY-100'))!;
      final beforeStock = fixture.database
          .select('SELECT quantity FROM local_stock')
          .first['quantity'];
      final beforeInvoices = fixture.database
          .select('SELECT count(*) AS n FROM invoices')
          .first['n'];
      expect(
        () => billing.finalizeSale(
          SaleDraft(
            id: const Uuid().v4(),
            lines: [
              SaleLineInput(
                productId: product.id,
                priceTier: PriceTier.mrp,
                quantityMilli: 200000,
                unitPricePaise: 10000,
              ),
            ],
            payments: const [SalePaymentInput(PaymentMethod.cash, 2360000)],
          ),
        ),
        throwsA(isA<InvoiceValidationException>()),
      );
      expect(
        fixture.database
            .select('SELECT quantity FROM local_stock')
            .first['quantity'],
        beforeStock,
      );
      expect(
        fixture.database
            .select('SELECT count(*) AS n FROM invoices')
            .first['n'],
        beforeInvoices,
      );
    },
  );

  test('kits reject empty and duplicate components', () async {
    final product = (await items.findBySku('TY-100'))!;
    expect(
      () =>
          KitsRepository(fixture.database)
              .save(name: 'Empty', isActive: true, components: const []),
      throwsA(isA<KitValidationException>()),
    );
    final duplicate = TyreKitDraftComponent(
      productId: product.id,
      quantityMilli: 1000,
      tier: PriceTier.mrp,
    );
    expect(
      () => KitsRepository(fixture.database).save(
        name: 'Duplicate',
        isActive: true,
        components: [duplicate, duplicate],
      ),
      throwsA(isA<KitValidationException>()),
    );
  });

  test(
    'finance quotation uses configured masters and persists explicit amounts',
    () async {
      final repository = FinanceQuotationRepository(fixture.database);
      repository.addMasterValue(FinanceMasterCategory.fitment, 'Test fitment');
      repository.addMasterValue(FinanceMasterCategory.make, 'Test make');
      repository.addMasterValue(FinanceMasterCategory.plyRating, 'Test ply');
      repository.addMasterValue(
        FinanceMasterCategory.fieldOffice,
        'Test office',
      );
      final quote = repository.save(
        vehicleNo: 'TEST-01',
        fitmentType: 'Test fitment',
        make: 'Test make',
        plyRating: 'Test ply',
        fieldOfficeName: 'Test office',
        approxDeliveryDate: DateTime(2026, 12, 1),
        billAmountPaise: 100000,
        marginMoneyPaise: 20000,
        loanPeriodMonths: 12,
        loanAmountPaise: 80000,
        processingFeePaise: 2500,
        totalMoneyReceivablePaise: 82500,
      );
      expect(quote.status, 'DRAFT');
      expect(quote.totalMoneyReceivablePaise, 82500);
      expect(repository.get(quote.id)?.vehicleNo, 'TEST-01');
    },
  );

  test('stock audit locks after three persisted edits', () async {
    final repository = StockAuditRepository(fixture.database);
    repository.startAudit(DateTime.now());
    final row = repository.rows().single;
    for (var edit = 0; edit < 3; edit++) {
      repository.editCount(
        rowId: row.id,
        expectedEditCount: edit,
        physicalQuantityMilli: 100000 - ((edit + 1) * 1000),
      );
    }
    expect(repository.rows().single.editCount, 3);
    expect(
      () => repository.editCount(
        rowId: row.id,
        expectedEditCount: 3,
        physicalQuantityMilli: 1,
      ),
      throwsA(isA<StockAuditException>()),
    );
    expect(
      fixture.database.select(
        'SELECT count(*) AS n FROM stock_audit_edits WHERE row_id = ?',
        [row.id],
      ).first['n'],
      3,
    );
    final reopened = await AppDatabase.open(
      databaseFile: fixture.database.file,
      keyStore: fixture.keyStore,
    );
    addTearDown(reopened.close);
    expect(StockAuditRepository(reopened).rows().single.editCount, 3);
    expect(
      () => fixture.database.execute(
        '''INSERT INTO stock_audit_edits(
          id, row_id, previous_quantity_milli, new_quantity_milli, edit_number, edited_at
        ) VALUES (?, ?, 0, 1, 4, ?)''',
        [const Uuid().v4(), row.id, DateTime.now().millisecondsSinceEpoch],
      ),
      throwsA(anything),
    );
  });

  test(
    'frozen period blocks invoice and records attempted finalization',
    () async {
      final product = (await items.findBySku('TY-100'))!;
      PeriodFreezeRepository(fixture.database).freeze(
        startDate: DateTime.now(),
        endDate: DateTime.now(),
        scope: FreezeScope.both,
        reason: 'Test freeze',
      );
      expect(
        () => billing.finalizeSale(
          SaleDraft(
            id: const Uuid().v4(),
            lines: [
              SaleLineInput(
                productId: product.id,
                priceTier: PriceTier.mrp,
                quantityMilli: 1000,
              ),
            ],
            payments: const [SalePaymentInput(PaymentMethod.cash, 11800)],
          ),
        ),
        throwsA(isA<InvoiceValidationException>()),
      );
      expect(
        fixture.database
            .select(
              "SELECT count(*) AS n FROM business_audit_events WHERE event_type = 'BLOCKED_BY_PERIOD_FREEZE'",
            )
            .first['n'],
        1,
      );
    },
  );

  test('register selections persist without posting financial effects', () {
    final repository = ManagementRegisterRepository(fixture.database);
    repository.add('Test management register');
    final register = repository.list().single;
    final voucherId = const Uuid().v4();
    repository.saveVoucherSelections(voucherId, [register.id]);
    expect(repository.selectionsForVoucher(voucherId), [register.id]);
  });
}
