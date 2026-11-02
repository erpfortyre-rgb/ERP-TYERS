import 'dart:io';

import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:sqlite3/sqlite3.dart';
import 'package:uuid/uuid.dart';

import 'encryption/key_manager.dart';

class AppDatabase {
  AppDatabase._(this._connection, this.file, this.cipherVersion);

  static const currentSchemaVersion = 4;
  static const localTenantLabel = 'local';

  final Database _connection;
  final File file;
  final String cipherVersion;

  bool _closed = false;

  static Future<AppDatabase> open({
    File? databaseFile,
    DatabaseKeyStore? keyStore,
  }) async {
    final appSupport = databaseFile == null
        ? await getApplicationSupportDirectory()
        : databaseFile.parent;
    final file =
        databaseFile ??
        File(p.join(appSupport.path, 'data', 'pos_app.sqlite3'));
    await file.parent.create(recursive: true);

    final store = keyStore ?? PlatformDatabaseKeyStore();
    final encodedKey = await DatabaseKeyManager(
      store,
    ).loadOrCreate(databaseExists: file.existsSync() && file.lengthSync() > 0);
    final keyBytes = DatabaseKeyManager.decode(encodedKey);
    final keyHex = _toHex(keyBytes);
    Database? connection;

    try {
      connection = sqlite3.open(file.path);
      // The key pragma must be the first database operation on this handle.
      connection.execute('PRAGMA key = "x\'$keyHex\'"');
      final cipherRows = connection.select('PRAGMA cipher_version');
      final cipherVersion = cipherRows.isEmpty
          ? ''
          : cipherRows.first.values.first?.toString() ?? '';
      if (cipherVersion.isEmpty) {
        throw const SqlCipherUnavailableException(
          'The loaded SQLite runtime does not report SQLCipher support.',
        );
      }

      // Force a page read so an incorrect key or damaged file fails at startup.
      connection.select('SELECT count(*) FROM sqlite_master');
      connection.execute('PRAGMA foreign_keys = ON');
      connection.execute('PRAGMA busy_timeout = 5000');

      final database = AppDatabase._(connection, file, cipherVersion);
      database._migrate();
      return database;
    } on DatabaseKeyUnavailableException {
      connection?.close();
      rethrow;
    } on SqlCipherUnavailableException {
      connection?.close();
      rethrow;
    } catch (_) {
      connection?.close();
      throw const DatabaseOpenException(
        'The encrypted local database could not be opened. Its key may be incorrect or the file may be damaged. No unencrypted fallback was used.',
      );
    }
  }

  ResultSet select(String sql, [List<Object?> parameters = const []]) {
    _ensureOpen();
    return _connection.select(sql, parameters);
  }

  void execute(String sql, [List<Object?> parameters = const []]) {
    _ensureOpen();
    _connection.execute(sql, parameters);
  }

  T transaction<T>(T Function() action) {
    _ensureOpen();
    _connection.execute('BEGIN IMMEDIATE TRANSACTION');
    try {
      final result = action();
      _connection.execute('COMMIT');
      return result;
    } catch (_) {
      _connection.execute('ROLLBACK');
      rethrow;
    }
  }

  String get tenantId {
    final rows = select('SELECT tenant_id FROM device_identity WHERE id = 1');
    if (rows.isEmpty) {
      throw const DatabaseOpenException(
        'The local database is missing its device identity row.',
      );
    }
    return rows.first['tenant_id'] as String;
  }

  DatabaseDiagnostics diagnostics() {
    final quickCheck = select('PRAGMA quick_check').first.values.first;
    final foreignKeys = select('PRAGMA foreign_keys').first.values.first == 1;
    final schemaVersion =
        select('PRAGMA user_version').first.values.first as int;
    final productCount =
        select('SELECT count(*) AS count FROM products').first['count'] as int;
    return DatabaseDiagnostics(
      initialized: !_closed,
      encryptionVerified: cipherVersion.isNotEmpty,
      cipherVersion: cipherVersion,
      schemaVersion: schemaVersion,
      health: quickCheck?.toString() ?? 'unknown',
      foreignKeysEnabled: foreignKeys,
      productCount: productCount,
      lastCheckedAt: DateTime.now(),
    );
  }

  void close() {
    if (_closed) return;
    _connection.close();
    _closed = true;
  }

  void _ensureOpen() {
    if (_closed) throw StateError('The local database is closed.');
  }

  void _migrate() {
    final version = select('PRAGMA user_version').first.values.first as int;
    if (version > currentSchemaVersion) {
      throw DatabaseOpenException(
        'Database schema version $version is newer than this application supports.',
      );
    }
    if (version == currentSchemaVersion) return;

    transaction(() {
      var migratedVersion = version;
      if (migratedVersion < 1) {
        _createSchemaV1();
        migratedVersion = 1;
        execute('PRAGMA user_version = 1');
      }
      if (migratedVersion < 2) _migrateToV2();
      if (migratedVersion < 3) _migrateToV3();
      if (migratedVersion < 4) _migrateToV4();
      execute('PRAGMA user_version = $currentSchemaVersion');
    });
  }

  void _migrateToV2() {
    const statements = [
      'ALTER TABLE products ADD COLUMN tax_percent REAL CHECK(tax_percent BETWEEN 0 AND 100)',
      'ALTER TABLE device_identity ADD COLUMN invoice_prefix TEXT',
      'ALTER TABLE device_identity ADD COLUMN invoice_sequence INTEGER NOT NULL DEFAULT 0 CHECK(invoice_sequence >= 0)',
      'ALTER TABLE device_identity ADD COLUMN default_branch_id TEXT REFERENCES branches(id) ON DELETE RESTRICT',
      'ALTER TABLE invoices ADD COLUMN idempotency_key TEXT',
      'ALTER TABLE invoices ADD COLUMN roundoff_paise INTEGER NOT NULL DEFAULT 0',
      'ALTER TABLE invoice_items ADD COLUMN price_tier TEXT',
      'ALTER TABLE invoice_items ADD COLUMN gross_paise INTEGER NOT NULL DEFAULT 0',
      'ALTER TABLE invoice_items ADD COLUMN discount_paise INTEGER NOT NULL DEFAULT 0',
      'ALTER TABLE invoice_items ADD COLUMN tax_paise INTEGER NOT NULL DEFAULT 0',
      'ALTER TABLE invoice_payments ADD COLUMN recorded_status TEXT NOT NULL DEFAULT \'RECORDED\'',
      'ALTER TABLE stock_movements ADD COLUMN invoice_item_id TEXT REFERENCES invoice_items(id) ON DELETE RESTRICT',
      'ALTER TABLE sync_outbox ADD COLUMN tenant_id TEXT NOT NULL DEFAULT \'local\'',
      'ALTER TABLE sync_outbox ADD COLUMN device_id TEXT',
      'ALTER TABLE sync_outbox ADD COLUMN event_type TEXT NOT NULL DEFAULT \'LOCAL_CHANGE\'',
      'ALTER TABLE sync_outbox ADD COLUMN schema_version INTEGER NOT NULL DEFAULT 1',
      'CREATE UNIQUE INDEX idx_invoices_idempotency ON invoices(idempotency_key) WHERE idempotency_key IS NOT NULL',
      'CREATE UNIQUE INDEX idx_stock_movement_invoice_item ON stock_movements(invoice_item_id) WHERE invoice_item_id IS NOT NULL',
      'CREATE UNIQUE INDEX idx_outbox_entity_event ON sync_outbox(entity_type, entity_id, event_type)',
      'CREATE INDEX idx_customers_tenant_phone_nocase ON customers(tenant_id, phone COLLATE NOCASE)',
      'CREATE INDEX idx_invoices_number ON invoices(invoice_number COLLATE NOCASE)',
      'CREATE INDEX idx_invoices_customer_date ON invoices(customer_id, invoice_date DESC)',
    ];
    for (final statement in statements) {
      execute(statement);
    }
  }

  void _migrateToV3() {
    const statements = [
      'ALTER TABLE invoice_items ADD COLUMN originating_kit_id TEXT REFERENCES bom_kits(id) ON DELETE RESTRICT',
      '''CREATE TABLE bom_kits (
        id TEXT PRIMARY KEY NOT NULL,
        tenant_id TEXT NOT NULL,
        name TEXT NOT NULL CHECK(length(trim(name)) > 0),
        is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        UNIQUE(tenant_id, name)
      )''',
      '''CREATE TABLE bom_components (
        id TEXT PRIMARY KEY NOT NULL,
        kit_id TEXT NOT NULL REFERENCES bom_kits(id) ON DELETE CASCADE,
        product_id TEXT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
        quantity_milli INTEGER NOT NULL CHECK(quantity_milli > 0),
        price_tier TEXT NOT NULL CHECK(price_tier IN ('MRP', 'CMP_A', 'CMP_B', 'CMP_C', 'CMP_D')),
        UNIQUE(kit_id, product_id)
      )''',
      '''CREATE TABLE finance_master_values (
        id TEXT PRIMARY KEY NOT NULL,
        tenant_id TEXT NOT NULL,
        category TEXT NOT NULL CHECK(category IN ('FITMENT', 'MAKE', 'PLY_RATING', 'FIELD_OFFICE')),
        value TEXT NOT NULL CHECK(length(trim(value)) > 0),
        is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
        created_at INTEGER NOT NULL,
        UNIQUE(tenant_id, category, value)
      )''',
      '''CREATE TABLE finance_quotations (
        id TEXT PRIMARY KEY NOT NULL,
        tenant_id TEXT NOT NULL,
        branch_id TEXT NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
        vehicle_no TEXT NOT NULL CHECK(length(trim(vehicle_no)) > 0),
        fitment_type TEXT NOT NULL,
        make TEXT NOT NULL,
        ply_rating TEXT NOT NULL,
        field_office_name TEXT NOT NULL,
        approx_delivery_date INTEGER NOT NULL,
        bill_amount_paise INTEGER NOT NULL CHECK(bill_amount_paise >= 0),
        margin_money_paise INTEGER NOT NULL CHECK(margin_money_paise >= 0),
        loan_period_months INTEGER NOT NULL CHECK(loan_period_months > 0),
        loan_amount_paise INTEGER NOT NULL CHECK(loan_amount_paise >= 0),
        processing_fee_paise INTEGER NOT NULL CHECK(processing_fee_paise >= 0),
        total_money_receivable_paise INTEGER NOT NULL CHECK(total_money_receivable_paise >= 0),
        status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT', 'FINALIZED', 'CANCELLED')),
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )''',
      '''CREATE TABLE stock_audit_sessions (
        id TEXT PRIMARY KEY NOT NULL,
        tenant_id TEXT NOT NULL,
        branch_id TEXT NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
        audit_date INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN', 'COMPLETED')),
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )''',
      '''CREATE TABLE stock_audit_rows (
        id TEXT PRIMARY KEY NOT NULL,
        session_id TEXT NOT NULL REFERENCES stock_audit_sessions(id) ON DELETE CASCADE,
        product_id TEXT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
        book_quantity_milli INTEGER NOT NULL,
        physical_quantity_milli INTEGER NOT NULL,
        edit_count INTEGER NOT NULL DEFAULT 0 CHECK(edit_count BETWEEN 0 AND 3),
        updated_at INTEGER NOT NULL,
        UNIQUE(session_id, product_id)
      )''',
      '''CREATE TABLE stock_audit_edits (
        id TEXT PRIMARY KEY NOT NULL,
        row_id TEXT NOT NULL REFERENCES stock_audit_rows(id) ON DELETE RESTRICT,
        previous_quantity_milli INTEGER NOT NULL,
        new_quantity_milli INTEGER NOT NULL,
        edit_number INTEGER NOT NULL CHECK(edit_number BETWEEN 1 AND 3),
        edited_at INTEGER NOT NULL,
        UNIQUE(row_id, edit_number)
      )''',
      '''CREATE TRIGGER stock_audit_edit_limit
      BEFORE INSERT ON stock_audit_edits
      WHEN (SELECT edit_count FROM stock_audit_rows WHERE id = NEW.row_id) IS NULL
        OR (SELECT edit_count FROM stock_audit_rows WHERE id = NEW.row_id) >= 3
        OR NEW.edit_number != (SELECT edit_count + 1 FROM stock_audit_rows WHERE id = NEW.row_id)
      BEGIN
        SELECT RAISE(ABORT, 'Stock audit row is locked or edit state is stale.');
      END''',
      '''CREATE TRIGGER stock_audit_apply_edit
      AFTER INSERT ON stock_audit_edits
      BEGIN
        UPDATE stock_audit_rows
        SET physical_quantity_milli = NEW.new_quantity_milli,
            edit_count = NEW.edit_number,
            updated_at = NEW.edited_at
        WHERE id = NEW.row_id;
      END''',
      '''CREATE TRIGGER stock_audit_row_guard
      BEFORE UPDATE OF physical_quantity_milli, edit_count ON stock_audit_rows
      WHEN NOT EXISTS (
        SELECT 1 FROM stock_audit_edits e
        WHERE e.row_id = OLD.id
          AND e.edit_number = NEW.edit_count
          AND e.new_quantity_milli = NEW.physical_quantity_milli
          AND NEW.edit_count = OLD.edit_count + 1
      )
      BEGIN
        SELECT RAISE(ABORT, 'Stock audit rows can only change through an appended audit edit.');
      END''',
      '''CREATE TRIGGER stock_audit_edit_history_no_update
      BEFORE UPDATE ON stock_audit_edits
      BEGIN
        SELECT RAISE(ABORT, 'Stock audit edit history is append-only.');
      END''',
      '''CREATE TRIGGER stock_audit_edit_history_no_delete
      BEFORE DELETE ON stock_audit_edits
      BEGIN
        SELECT RAISE(ABORT, 'Stock audit edit history is append-only.');
      END''',
      '''CREATE TABLE stock_audit_schedules (
        id TEXT PRIMARY KEY NOT NULL,
        tenant_id TEXT NOT NULL,
        branch_id TEXT NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
        scheduled_date INTEGER NOT NULL,
        label TEXT NOT NULL CHECK(length(trim(label)) > 0),
        status TEXT NOT NULL DEFAULT 'SCHEDULED' CHECK(status IN ('SCHEDULED', 'STARTED', 'COMPLETED')),
        created_at INTEGER NOT NULL,
        UNIQUE(tenant_id, branch_id, scheduled_date)
      )''',
      '''CREATE TABLE period_freezes (
        id TEXT PRIMARY KEY NOT NULL,
        tenant_id TEXT NOT NULL,
        branch_id TEXT REFERENCES branches(id) ON DELETE RESTRICT,
        start_date INTEGER NOT NULL,
        end_date INTEGER NOT NULL,
        scope TEXT NOT NULL CHECK(scope IN ('STOCK', 'ACCOUNTING', 'BOTH')),
        reason TEXT NOT NULL CHECK(length(trim(reason)) > 0),
        frozen_by TEXT NOT NULL,
        frozen_at INTEGER NOT NULL,
        unfrozen_at INTEGER,
        unfreeze_reason TEXT,
        CHECK(start_date <= end_date)
      )''',
      '''CREATE TABLE business_audit_events (
        id TEXT PRIMARY KEY NOT NULL,
        tenant_id TEXT NOT NULL,
        branch_id TEXT REFERENCES branches(id) ON DELETE RESTRICT,
        event_type TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT,
        details TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )''',
      '''CREATE TABLE management_registers (
        id TEXT PRIMARY KEY NOT NULL,
        tenant_id TEXT NOT NULL,
        name TEXT NOT NULL CHECK(length(trim(name)) > 0),
        is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
        created_at INTEGER NOT NULL,
        UNIQUE(tenant_id, name)
      )''',
      '''CREATE TABLE voucher_register_selections (
        id TEXT PRIMARY KEY NOT NULL,
        tenant_id TEXT NOT NULL,
        voucher_id TEXT NOT NULL,
        register_id TEXT NOT NULL REFERENCES management_registers(id) ON DELETE RESTRICT,
        created_at INTEGER NOT NULL,
        UNIQUE(voucher_id, register_id)
      )''',
      'CREATE INDEX idx_bom_components_kit ON bom_components(kit_id)',
      'CREATE INDEX idx_finance_quotes_tenant_date ON finance_quotations(tenant_id, created_at DESC)',
      'CREATE INDEX idx_audit_sessions_branch_date ON stock_audit_sessions(branch_id, audit_date DESC)',
      'CREATE INDEX idx_audit_rows_session ON stock_audit_rows(session_id)',
      'CREATE INDEX idx_audit_edits_row ON stock_audit_edits(row_id, edit_number)',
      'CREATE INDEX idx_freezes_tenant_dates ON period_freezes(tenant_id, start_date, end_date)',
      'CREATE INDEX idx_business_audit_tenant_date ON business_audit_events(tenant_id, created_at DESC)',
      'CREATE INDEX idx_register_selections_voucher ON voucher_register_selections(voucher_id)',
    ];
    for (final statement in statements) {
      execute(statement);
    }
  }

  void _migrateToV4() {
    const statements = [
      '''CREATE TABLE suppliers (
          id TEXT PRIMARY KEY NOT NULL,
          tenant_id TEXT NOT NULL,
          supplier_code TEXT NOT NULL CHECK(length(trim(supplier_code)) > 0),
          business_name TEXT NOT NULL CHECK(length(trim(business_name)) > 0),
          contact_person TEXT,
          phone TEXT,
          email TEXT,
          gstin TEXT,
          billing_address TEXT,
          state TEXT,
          is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          UNIQUE(tenant_id, supplier_code COLLATE NOCASE)
        )''',
      '''CREATE TABLE purchase_bills (
          id TEXT PRIMARY KEY NOT NULL,
          tenant_id TEXT NOT NULL,
          branch_id TEXT NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
          supplier_id TEXT NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
          internal_reference TEXT NOT NULL,
          supplier_invoice_number TEXT NOT NULL CHECK(length(trim(supplier_invoice_number)) > 0),
          purchase_date INTEGER NOT NULL,
          supplier_invoice_date INTEGER NOT NULL,
          status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT', 'FINALIZED')),
          subtotal_paise INTEGER NOT NULL DEFAULT 0 CHECK(subtotal_paise >= 0),
          discount_paise INTEGER NOT NULL DEFAULT 0 CHECK(discount_paise >= 0),
          tax_paise INTEGER NOT NULL DEFAULT 0 CHECK(tax_paise >= 0),
          total_paise INTEGER NOT NULL DEFAULT 0 CHECK(total_paise >= 0),
          notes TEXT,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          finalized_at INTEGER,
          UNIQUE(tenant_id, internal_reference),
          UNIQUE(tenant_id, supplier_id, supplier_invoice_number)
        )''',
      '''CREATE TABLE purchase_bill_items (
          id TEXT PRIMARY KEY NOT NULL,
          purchase_bill_id TEXT NOT NULL REFERENCES purchase_bills(id) ON DELETE RESTRICT,
          product_id TEXT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
          product_name TEXT NOT NULL,
          sku TEXT NOT NULL,
          quantity_milli INTEGER NOT NULL CHECK(quantity_milli > 0),
          unit_cost_paise INTEGER NOT NULL CHECK(unit_cost_paise >= 0),
          discount_paise INTEGER NOT NULL DEFAULT 0 CHECK(discount_paise >= 0),
          tax_percent REAL,
          tax_paise INTEGER NOT NULL DEFAULT 0 CHECK(tax_paise >= 0),
          line_total_paise INTEGER NOT NULL CHECK(line_total_paise >= 0),
          UNIQUE(purchase_bill_id, product_id)
        )''',
      '''CREATE TABLE purchase_returns (
          id TEXT PRIMARY KEY NOT NULL,
          tenant_id TEXT NOT NULL,
          branch_id TEXT NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
          supplier_id TEXT NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
          purchase_bill_id TEXT NOT NULL REFERENCES purchase_bills(id) ON DELETE RESTRICT,
          return_date INTEGER NOT NULL,
          reason TEXT NOT NULL CHECK(length(trim(reason)) > 0),
          status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT', 'REVIEW_REQUIRED')),
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        )''',
      '''CREATE TABLE purchase_return_items (
          id TEXT PRIMARY KEY NOT NULL,
          purchase_return_id TEXT NOT NULL REFERENCES purchase_returns(id) ON DELETE CASCADE,
          purchase_bill_item_id TEXT NOT NULL REFERENCES purchase_bill_items(id) ON DELETE RESTRICT,
          quantity_milli INTEGER NOT NULL CHECK(quantity_milli > 0)
        )''',
      'ALTER TABLE stock_movements ADD COLUMN purchase_item_id TEXT REFERENCES purchase_bill_items(id) ON DELETE RESTRICT',
      'CREATE UNIQUE INDEX idx_stock_movement_purchase_item ON stock_movements(purchase_item_id) WHERE purchase_item_id IS NOT NULL',
      '''CREATE TABLE chart_of_accounts (
          id TEXT PRIMARY KEY NOT NULL,
          tenant_id TEXT NOT NULL,
          code TEXT NOT NULL CHECK(length(trim(code)) > 0),
          name TEXT NOT NULL CHECK(length(trim(name)) > 0),
          category TEXT NOT NULL CHECK(category IN ('ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE')),
          is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          UNIQUE(tenant_id, code COLLATE NOCASE)
        )''',
      '''CREATE TABLE accounting_mappings (
          tenant_id TEXT NOT NULL,
          purpose TEXT NOT NULL,
          account_id TEXT NOT NULL REFERENCES chart_of_accounts(id) ON DELETE RESTRICT,
          updated_at INTEGER NOT NULL,
          PRIMARY KEY(tenant_id, purpose)
        )''',
      '''CREATE TABLE journal_entries (
          id TEXT PRIMARY KEY NOT NULL,
          tenant_id TEXT NOT NULL,
          branch_id TEXT REFERENCES branches(id) ON DELETE RESTRICT,
          transaction_date INTEGER NOT NULL,
          source_type TEXT NOT NULL,
          source_id TEXT NOT NULL,
          narration TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT', 'POSTED', 'REVERSED')),
          device_id TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          posted_at INTEGER,
          UNIQUE(tenant_id, source_type, source_id)
        )''',
      '''CREATE TABLE journal_lines (
          id TEXT PRIMARY KEY NOT NULL,
          journal_entry_id TEXT NOT NULL REFERENCES journal_entries(id) ON DELETE RESTRICT,
          account_id TEXT NOT NULL REFERENCES chart_of_accounts(id) ON DELETE RESTRICT,
          debit_paise INTEGER NOT NULL DEFAULT 0 CHECK(debit_paise >= 0),
          credit_paise INTEGER NOT NULL DEFAULT 0 CHECK(credit_paise >= 0),
          memo TEXT,
          CHECK((debit_paise > 0 AND credit_paise = 0) OR (credit_paise > 0 AND debit_paise = 0))
        )''',
      '''CREATE TRIGGER posted_journal_no_update
        BEFORE UPDATE ON journal_entries WHEN OLD.status = 'POSTED'
        BEGIN SELECT RAISE(ABORT, 'Posted journals are immutable.'); END''',
      '''CREATE TRIGGER posted_journal_no_delete
        BEFORE DELETE ON journal_entries WHEN OLD.status = 'POSTED'
        BEGIN SELECT RAISE(ABORT, 'Posted journals are immutable.'); END''',
      '''CREATE TRIGGER posted_journal_line_no_insert
        BEFORE INSERT ON journal_lines
        WHEN (SELECT status FROM journal_entries WHERE id = NEW.journal_entry_id) = 'POSTED'
        BEGIN SELECT RAISE(ABORT, 'Posted journal lines are immutable.'); END''',
      '''CREATE TRIGGER posted_journal_line_no_update
        BEFORE UPDATE ON journal_lines
        WHEN (SELECT status FROM journal_entries WHERE id = OLD.journal_entry_id) = 'POSTED'
        BEGIN SELECT RAISE(ABORT, 'Posted journal lines are immutable.'); END''',
      '''CREATE TRIGGER posted_journal_line_no_delete
        BEFORE DELETE ON journal_lines
        WHEN (SELECT status FROM journal_entries WHERE id = OLD.journal_entry_id) = 'POSTED'
        BEGIN SELECT RAISE(ABORT, 'Posted journal lines are immutable.'); END''',
      'CREATE INDEX idx_suppliers_tenant_name ON suppliers(tenant_id, business_name COLLATE NOCASE)',
      'CREATE INDEX idx_purchases_tenant_date ON purchase_bills(tenant_id, purchase_date DESC)',
      'CREATE INDEX idx_purchase_items_bill ON purchase_bill_items(purchase_bill_id)',
      'CREATE INDEX idx_purchase_returns_bill ON purchase_returns(purchase_bill_id)',
      'CREATE INDEX idx_journals_tenant_date ON journal_entries(tenant_id, transaction_date DESC)',
      'CREATE INDEX idx_journal_lines_entry ON journal_lines(journal_entry_id)',
      'CREATE INDEX idx_journal_lines_account ON journal_lines(account_id)',
    ];
    for (final statement in statements) {
      execute(statement);
    }
  }

  void _createSchemaV1() {
    const statements = <String>[
      '''CREATE TABLE branches (
        id TEXT PRIMARY KEY NOT NULL,
        tenant_id TEXT NOT NULL,
        name TEXT NOT NULL CHECK(length(trim(name)) > 0),
        is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        UNIQUE(tenant_id, name)
      )''',
      '''CREATE TABLE device_identity (
        id INTEGER PRIMARY KEY CHECK(id = 1),
        device_id TEXT NOT NULL UNIQUE,
        tenant_id TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )''',
      '''CREATE TABLE products (
        id TEXT PRIMARY KEY NOT NULL,
        tenant_id TEXT NOT NULL,
        branch_id TEXT REFERENCES branches(id) ON DELETE RESTRICT,
        name TEXT NOT NULL CHECK(length(trim(name)) > 0),
        sku TEXT NOT NULL CHECK(length(trim(sku)) > 0),
        barcode TEXT,
        category TEXT,
        brand TEXT,
        hsn_code TEXT,
        unit TEXT NOT NULL DEFAULT 'PCS',
        is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        UNIQUE(tenant_id, sku),
        UNIQUE(tenant_id, barcode)
      )''',
      '''CREATE TABLE product_prices (
        id TEXT PRIMARY KEY NOT NULL,
        product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        tier TEXT NOT NULL CHECK(tier IN ('MRP', 'CMP_A', 'CMP_B', 'CMP_C', 'CMP_D')),
        price_paise INTEGER NOT NULL CHECK(price_paise >= 0),
        valid_from INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      )''',
      '''CREATE TABLE customers (
        id TEXT PRIMARY KEY NOT NULL,
        tenant_id TEXT NOT NULL,
        branch_id TEXT REFERENCES branches(id) ON DELETE RESTRICT,
        name TEXT NOT NULL CHECK(length(trim(name)) > 0),
        phone TEXT,
        gstin TEXT,
        address TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )''',
      '''CREATE TABLE local_stock (
        product_id TEXT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
        branch_id TEXT NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
        quantity REAL NOT NULL DEFAULT 0,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY(product_id, branch_id)
      )''',
      '''CREATE TABLE stock_movements (
        id TEXT PRIMARY KEY NOT NULL,
        product_id TEXT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
        branch_id TEXT NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
        movement_type TEXT NOT NULL,
        quantity REAL NOT NULL,
        reference_id TEXT,
        created_at INTEGER NOT NULL
      )''',
      '''CREATE TABLE invoices (
        id TEXT PRIMARY KEY NOT NULL,
        tenant_id TEXT NOT NULL,
        branch_id TEXT REFERENCES branches(id) ON DELETE RESTRICT,
        customer_id TEXT REFERENCES customers(id) ON DELETE RESTRICT,
        invoice_number TEXT NOT NULL,
        invoice_date INTEGER NOT NULL,
        state TEXT NOT NULL DEFAULT 'DRAFT',
        subtotal_paise INTEGER NOT NULL DEFAULT 0 CHECK(subtotal_paise >= 0),
        tax_paise INTEGER NOT NULL DEFAULT 0 CHECK(tax_paise >= 0),
        total_paise INTEGER NOT NULL DEFAULT 0 CHECK(total_paise >= 0),
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        UNIQUE(tenant_id, branch_id, invoice_number)
      )''',
      '''CREATE TABLE invoice_items (
        id TEXT PRIMARY KEY NOT NULL,
        invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
        product_id TEXT REFERENCES products(id) ON DELETE RESTRICT,
        product_name TEXT NOT NULL,
        sku TEXT,
        quantity REAL NOT NULL CHECK(quantity > 0),
        unit_price_paise INTEGER NOT NULL CHECK(unit_price_paise >= 0),
        discount_percent REAL NOT NULL DEFAULT 0 CHECK(discount_percent BETWEEN 0 AND 100),
        tax_percent REAL NOT NULL DEFAULT 0 CHECK(tax_percent BETWEEN 0 AND 100),
        line_total_paise INTEGER NOT NULL CHECK(line_total_paise >= 0)
      )''',
      '''CREATE TABLE invoice_payments (
        id TEXT PRIMARY KEY NOT NULL,
        invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
        method TEXT NOT NULL,
        amount_paise INTEGER NOT NULL CHECK(amount_paise >= 0),
        reference TEXT,
        created_at INTEGER NOT NULL
      )''',
      '''CREATE TABLE sync_outbox (
        id TEXT PRIMARY KEY NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        operation TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        state TEXT NOT NULL DEFAULT 'PENDING',
        attempt_count INTEGER NOT NULL DEFAULT 0 CHECK(attempt_count >= 0),
        created_at INTEGER NOT NULL,
        last_attempt_at INTEGER
      )''',
      'CREATE INDEX idx_products_tenant_name ON products(tenant_id, name COLLATE NOCASE)',
      'CREATE UNIQUE INDEX idx_products_tenant_sku_nocase ON products(tenant_id, sku COLLATE NOCASE)',
      'CREATE UNIQUE INDEX idx_products_tenant_barcode_nocase ON products(tenant_id, barcode COLLATE NOCASE)',
      'CREATE INDEX idx_products_tenant_category_active ON products(tenant_id, category, is_active)',
      'CREATE INDEX idx_product_prices_product_tier_valid ON product_prices(product_id, tier, valid_from DESC, created_at DESC)',
      'CREATE INDEX idx_customers_tenant_name ON customers(tenant_id, name COLLATE NOCASE)',
      'CREATE INDEX idx_customers_tenant_phone ON customers(tenant_id, phone)',
      'CREATE INDEX idx_stock_movements_product_branch_date ON stock_movements(product_id, branch_id, created_at DESC)',
      'CREATE INDEX idx_invoices_tenant_date ON invoices(tenant_id, invoice_date DESC)',
      'CREATE INDEX idx_invoice_items_invoice ON invoice_items(invoice_id)',
      'CREATE INDEX idx_invoice_payments_invoice ON invoice_payments(invoice_id)',
      'CREATE INDEX idx_sync_outbox_state_date ON sync_outbox(state, created_at)',
    ];

    for (final statement in statements) {
      execute(statement);
    }
    final now = DateTime.now().toUtc().millisecondsSinceEpoch;
    execute(
      'INSERT INTO device_identity(id, device_id, tenant_id, created_at) VALUES (1, ?, ?, ?)',
      [const Uuid().v4(), 'local', now],
    );
  }

  static String _toHex(List<int> bytes) =>
      bytes.map((byte) => byte.toRadixString(16).padLeft(2, '0')).join();
}

class DatabaseDiagnostics {
  const DatabaseDiagnostics({
    required this.initialized,
    required this.encryptionVerified,
    required this.cipherVersion,
    required this.schemaVersion,
    required this.health,
    required this.foreignKeysEnabled,
    required this.productCount,
    required this.lastCheckedAt,
  });

  final bool initialized;
  final bool encryptionVerified;
  final String cipherVersion;
  final int schemaVersion;
  final String health;
  final bool foreignKeysEnabled;
  final int productCount;
  final DateTime lastCheckedAt;
}

class DatabaseOpenException implements Exception {
  const DatabaseOpenException(this.message);

  final String message;

  @override
  String toString() => message;
}

class SqlCipherUnavailableException implements Exception {
  const SqlCipherUnavailableException(this.message);

  final String message;

  @override
  String toString() => message;
}
