import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';

import '../../../app/providers.dart';
import '../../../core/theme/app_colors.dart';
import '../../../database/app_database.dart';
import '../../customers/domain/customer.dart';
import '../../customers/presentation/customer_picker_dialog.dart';
import '../../items/domain/item.dart';
import '../../items/domain/kit.dart';
import '../../items/data/kits_repository.dart';
import '../../items/domain/items_repository.dart';
import '../data/offline_billing_repository.dart';
import '../domain/invoice_calculator.dart';
import '../domain/kit_explosion.dart';
import 'invoice_print_service.dart';

class BillingScreen extends ConsumerStatefulWidget {
  const BillingScreen({super.key});

  @override
  ConsumerState<BillingScreen> createState() => _BillingScreenState();
}

class _BillingScreenState extends ConsumerState<BillingScreen> {
  static const _uuid = Uuid();
  final _search = TextEditingController();
  final _barcode = TextEditingController();
  final _searchFocus = FocusNode();
  final _barcodeFocus = FocusNode();
  final _lines = <BillingLine>[];
  List<SalePaymentInput> _payments = const [];
  Customer? _customer;
  String _query = '';
  String _invoiceId = _uuid.v4();
  int _revision = 0;
  bool _saving = false;
  String? _productsFutureQuery;
  Future<List<Product>>? _productsFuture;

  @override
  void dispose() {
    _search.dispose();
    _barcode.dispose();
    _searchFocus.dispose();
    _barcodeFocus.dispose();
    super.dispose();
  }

  Future<void> _chooseCustomer(AppDatabase db) async {
    final customer = await showDialog<Customer>(
      context: context,
      builder: (_) => CustomerPickerDialog(
        repository: ref.read(customersRepositoryProvider(db)),
      ),
    );
    if (customer != null && mounted) setState(() => _customer = customer);
  }

  Future<void> _addMatchingProduct(ItemsRepository repository) async {
    if (_query.trim().isEmpty) {
      _searchFocus.requestFocus();
      _message('Search for a product before using F6.');
      return;
    }
    final results = await _productsFuture;
    if (!mounted) return;
    if (results == null || results.length != 1) {
      _searchFocus.requestFocus();
      _message('Narrow the search to one product, then press F6.');
      return;
    }
    await _chooseProduct(repository, results.single);
  }

  Future<void> _chooseProduct(
    ItemsRepository repository,
    Product product, [
    BillingLine? existing,
  ]) async {
    final current = await repository.currentPrices(product.id);
    if (!mounted) return;
    final line = await showDialog<BillingLine>(
      context: context,
      builder: (_) => _ProductLineDialog(
        product: product,
        currentPrices: current,
        existing: existing,
      ),
    );
    if (line == null || !mounted) return;
    setState(() {
      if (existing == null) {
        _lines.add(line);
      } else {
        final index = _lines.indexOf(existing);
        if (index >= 0) _lines[index] = line;
      }
      _payments = const [];
      _revision++;
      _query = '';
      _search.clear();
      _barcode.clear();
    });
  }

  Future<void> _searchBarcode(ItemsRepository repository, String value) async {
    final product = await repository.findByBarcode(value);
    if (!mounted) return;
    if (product == null || !product.isActive) {
      _message('No active product matches that barcode.');
      return;
    }
    await _chooseProduct(repository, product);
  }

  Future<void> _addKit(AppDatabase database, ItemsRepository repository) async {
    final kits = KitsRepository(database).list();
    if (kits.isEmpty) {
      _message('Create an active kit in the Kits section first.');
      return;
    }
    final kit = await showDialog<TyreKit>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Add tyre kit'),
        content: SizedBox(
          width: 520,
          child: ListView(
            shrinkWrap: true,
            children: [
              for (final kit in kits)
                ListTile(
                  title: Text(kit.name),
                  subtitle: Text(
                    kit.components
                        .map(
                          (component) =>
                              '${component.productName} × ${formatQuantity(component.quantityMilli)} (${component.tier.label})',
                        )
                        .join(' · '),
                  ),
                  onTap: () => Navigator.of(context).pop(kit),
                ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Cancel'),
          ),
        ],
      ),
    );
    if (kit == null || !mounted) return;
    final kitQuantityMilli = await showDialog<int>(
      context: context,
      builder: (_) => const _KitQuantityDialog(),
    );
    if (kitQuantityMilli == null || !mounted) return;
    final componentLines = <BillingLine>[];
    final expanded = explodeKit(kit, kitQuantityMilli: kitQuantityMilli);
    for (final component in expanded) {
      final product = await repository.getProduct(component.productId);
      if (product == null || !product.isActive) {
        _message('A component in ${kit.name} is no longer active.');
        return;
      }
      final prices = await repository.currentPrices(product.id);
      final price = prices[component.tier];
      if (price == null) {
        _message('No ${component.tier.label} rate is set for ${product.name}.');
        return;
      }
      componentLines.add(
        BillingLine(
          productId: product.id,
          name: product.name,
          sku: product.sku,
          tier: component.tier,
          quantityMilli: component.quantityMilli,
          unitPricePaise: price,
          discountBasisPoints: 0,
          taxPercent: product.taxPercent,
          originatingKitId: kit.id,
        ),
      );
    }
    if (!mounted) return;
    setState(() {
      _lines.addAll(componentLines);
      _payments = const [];
      _revision++;
    });
  }

  Future<void> _editLine(ItemsRepository repository, BillingLine line) async {
    final product = await repository.getProduct(line.productId);
    if (product == null || !mounted) return;
    await _chooseProduct(repository, product, line);
  }

  Future<void> _reviewPayment(OfflineBillingRepository repository) async {
    if (_lines.isEmpty) {
      _message('Add a product before allocating payment.');
      return;
    }
    final totals = calculateInvoice(_lines);
    final allocations = await showDialog<List<SalePaymentInput>>(
      context: context,
      builder: (_) => _PaymentDialog(
        totalPaise: totals.totalPaise,
        initial: _payments,
        customer: _customer,
      ),
    );
    if (allocations != null && mounted) setState(() => _payments = allocations);
  }

  Future<void> _finalize(OfflineBillingRepository repository) async {
    if (_saving) return;
    final missingTax = _lines.where((line) => line.taxPercent == null);
    if (missingTax.isNotEmpty) {
      _message('Set an approved tax rate on each product before finalizing.');
      return;
    }
    setState(() => _saving = true);
    try {
      final invoice = repository.finalizeSale(
        SaleDraft(
          id: _invoiceId,
          customerId: _customer?.id,
          lines: _lines
              .map(
                (line) => SaleLineInput(
                  productId: line.productId,
                  priceTier: line.tier,
                  quantityMilli: line.quantityMilli,
                  discountBasisPoints: line.discountBasisPoints,
                  originatingKitId: line.originatingKitId,
                  unitPricePaise: line.unitPricePaise,
                ),
              )
              .toList(growable: false),
          payments: _payments,
        ),
      );
      if (!mounted) return;
      setState(() {
        _lines.clear();
        _payments = const [];
        _customer = null;
        _invoiceId = _uuid.v4();
        _revision++;
        _saving = false;
      });
      await showDialog<void>(
        context: context,
        builder: (_) => _SavedInvoiceDialog(invoice: invoice),
      );
    } on InvoiceValidationException catch (error) {
      _message(error.message);
    } catch (error) {
      _message('Invoice was rolled back and not saved: $error');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  void _newInvoice() {
    if (_lines.isEmpty && _customer == null) return;
    showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Start a new invoice?'),
        content: const Text(
          'Unsaved line and payment details will be cleared.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Keep invoice'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Clear invoice'),
          ),
        ],
      ),
    ).then((clear) {
      if (clear == true && mounted) {
        setState(() {
          _lines.clear();
          _payments = const [];
          _customer = null;
          _invoiceId = _uuid.v4();
          _revision++;
        });
      }
    });
  }

  void _message(String value) {
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(value)));
  }

  @override
  Widget build(BuildContext context) => ref
      .watch(databaseProvider)
      .when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => _DatabaseUnavailable(message: '$error'),
        data: (database) {
          final products = ref.watch(itemsRepositoryProvider(database));
          if (_productsFutureQuery != _query || _productsFuture == null) {
            _productsFutureQuery = _query;
            _productsFuture = products.searchProducts(
              query: _query,
              activeOnly: true,
            );
          }
          final billing = ref.watch(billingRepositoryProvider(database));
          final totals = calculateInvoice(_lines);
          final config = billing.configuration();
          final pending = billing.pendingOutboxCount();
          final lineTaxReady =
              _lines.isNotEmpty &&
              _lines.every((line) => line.taxPercent != null);
          final stockReady =
              _lines.isNotEmpty &&
              _lines.every(
                (line) =>
                    billing.stockQuantityMilli(line.productId) >=
                    line.quantityMilli,
              );
          final paymentsBalanced =
              _payments.fold<int>(
                    0,
                    (sum, payment) => sum + payment.amountPaise,
                  ) ==
                  totals.totalPaise &&
              _payments.isNotEmpty;
          final canSave =
              !_saving &&
              lineTaxReady &&
              stockReady &&
              paymentsBalanced &&
              config.prefix != null &&
              config.branchId != null;

          return Shortcuts(
            shortcuts: const {
              SingleActivator(LogicalKeyboardKey.f2): _NewInvoiceIntent(),
              SingleActivator(LogicalKeyboardKey.f4): _PaymentIntent(),
              SingleActivator(LogicalKeyboardKey.f6): _AddProductIntent(),
              SingleActivator(LogicalKeyboardKey.f8): _ProductSearchIntent(),
              SingleActivator(LogicalKeyboardKey.f9): _BarcodeIntent(),
            },
            child: Actions(
              actions: {
                _NewInvoiceIntent: CallbackAction<_NewInvoiceIntent>(
                  onInvoke: (_) => _newInvoice(),
                ),
                _PaymentIntent: CallbackAction<_PaymentIntent>(
                  onInvoke: (_) => _reviewPayment(billing),
                ),
                _AddProductIntent: CallbackAction<_AddProductIntent>(
                  onInvoke: (_) => _addMatchingProduct(products),
                ),
                _ProductSearchIntent: CallbackAction<_ProductSearchIntent>(
                  onInvoke: (_) => _searchFocus.requestFocus(),
                ),
                _BarcodeIntent: CallbackAction<_BarcodeIntent>(
                  onInvoke: (_) => _barcodeFocus.requestFocus(),
                ),
              },
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    _InvoiceToolbar(
                      customer: _customer,
                      config: config,
                      onCustomer: () => _chooseCustomer(database),
                      onNew: _newInvoice,
                    ),
                    const SizedBox(height: 8),
                    _DatabaseStrip(
                      database: database,
                      pendingOutboxCount: pending,
                    ),
                    const SizedBox(height: 12),
                    Expanded(
                      child: LayoutBuilder(
                        builder: (context, constraints) {
                          final wide = constraints.maxWidth >= 900;
                          final items = _ProductAndLinesPanel(
                            repository: products,
                            productsFuture: _productsFuture!,
                            lines: _lines,
                            revision: _revision,
                            query: _query,
                            searchController: _search,
                            searchFocus: _searchFocus,
                            barcodeController: _barcode,
                            barcodeFocus: _barcodeFocus,
                            onQuery: (value) => setState(() => _query = value),
                            onBarcode: (value) =>
                                _searchBarcode(products, value),
                            onAddKit: () => _addKit(database, products),
                            onSelect: (product) =>
                                _chooseProduct(products, product),
                            onEdit: (line) => _editLine(products, line),
                            onRemove: (line) => setState(() {
                              _lines.remove(line);
                              _payments = const [];
                            }),
                          );
                          final summary = _InvoiceSummary(
                            lines: _lines,
                            totals: totals,
                            payments: _payments,
                            canSave: canSave,
                            saving: _saving,
                            onPayment: () => _reviewPayment(billing),
                            onSave: () => _finalize(billing),
                          );
                          return wide
                              ? Row(
                                  crossAxisAlignment:
                                      CrossAxisAlignment.stretch,
                                  children: [
                                    Expanded(child: items),
                                    const SizedBox(width: 12),
                                    SizedBox(width: 330, child: summary),
                                  ],
                                )
                              : SingleChildScrollView(
                                  child: Column(
                                    children: [
                                      SizedBox(height: 450, child: items),
                                      const SizedBox(height: 12),
                                      SizedBox(height: 570, child: summary),
                                    ],
                                  ),
                                );
                        },
                      ),
                    ),
                    if (!lineTaxReady && _lines.isNotEmpty)
                      const Padding(
                        padding: EdgeInsets.only(top: 8),
                        child: Text(
                          'Finalization is blocked until every item has an approved configured tax rate.',
                          style: TextStyle(color: AppColors.warning),
                        ),
                      ),
                  ],
                ),
              ),
            ),
          );
        },
      );
}

class _InvoiceToolbar extends StatelessWidget {
  const _InvoiceToolbar({
    required this.customer,
    required this.config,
    required this.onCustomer,
    required this.onNew,
  });
  final Customer? customer;
  final DeviceInvoiceConfig config;
  final VoidCallback onCustomer;
  final VoidCallback onNew;

  @override
  Widget build(BuildContext context) => Wrap(
    spacing: 10,
    runSpacing: 8,
    crossAxisAlignment: WrapCrossAlignment.center,
    children: [
      SizedBox(
        width: 210,
        child: InputDecorator(
          decoration: const InputDecoration(labelText: 'Next invoice'),
          child: Text(
            config.prefix == null
                ? 'Prefix not configured'
                : '${config.prefix}-${DateTime.now().year % 100}-${(config.sequence + 1).toString().padLeft(6, '0')}',
          ),
        ),
      ),
      SizedBox(
        width: 180,
        child: InputDecorator(
          decoration: const InputDecoration(labelText: 'Branch'),
          child: Text(config.branchName ?? 'Not configured'),
        ),
      ),
      OutlinedButton.icon(
        onPressed: onCustomer,
        icon: const Icon(Icons.person_search_outlined),
        label: Text(customer?.name ?? 'Select customer'),
      ),
      OutlinedButton.icon(
        onPressed: onNew,
        icon: const Icon(Icons.note_add_outlined),
        label: const Text('New invoice  F2'),
      ),
    ],
  );
}

class _DatabaseStrip extends StatelessWidget {
  const _DatabaseStrip({
    required this.database,
    required this.pendingOutboxCount,
  });
  final AppDatabase database;
  final int pendingOutboxCount;

  @override
  Widget build(BuildContext context) {
    final diagnostics = database.diagnostics();
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
      color: AppColors.surface,
      child: Wrap(
        spacing: 18,
        runSpacing: 4,
        children: [
          Text(
            'Database ${diagnostics.health == 'ok' && diagnostics.encryptionVerified ? 'Ready · SQLCipher ${diagnostics.cipherVersion}' : 'Health check failed'}',
          ),
          const Text('Sync Not configured'),
          Text('$pendingOutboxCount pending local events'),
        ],
      ),
    );
  }
}

class _ProductAndLinesPanel extends StatelessWidget {
  const _ProductAndLinesPanel({
    required this.repository,
    required this.productsFuture,
    required this.lines,
    required this.revision,
    required this.query,
    required this.searchController,
    required this.searchFocus,
    required this.barcodeController,
    required this.barcodeFocus,
    required this.onQuery,
    required this.onBarcode,
    required this.onAddKit,
    required this.onSelect,
    required this.onEdit,
    required this.onRemove,
  });
  final ItemsRepository repository;
  final Future<List<Product>> productsFuture;
  final List<BillingLine> lines;
  final int revision;
  final String query;
  final TextEditingController searchController;
  final FocusNode searchFocus;
  final TextEditingController barcodeController;
  final FocusNode barcodeFocus;
  final ValueChanged<String> onQuery;
  final ValueChanged<String> onBarcode;
  final VoidCallback onAddKit;
  final ValueChanged<Product> onSelect;
  final ValueChanged<BillingLine> onEdit;
  final ValueChanged<BillingLine> onRemove;

  @override
  Widget build(BuildContext context) => Container(
    decoration: BoxDecoration(
      color: AppColors.surface,
      border: Border.all(color: AppColors.border),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.all(12),
          child: Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              SizedBox(
                width: 300,
                child: TextField(
                  controller: searchController,
                  focusNode: searchFocus,
                  onChanged: onQuery,
                  decoration: const InputDecoration(
                    labelText: 'Search product  F8',
                    prefixIcon: Icon(Icons.search),
                  ),
                ),
              ),
              OutlinedButton.icon(
                onPressed: onAddKit,
                icon: const Icon(Icons.tire_repair_outlined),
                label: const Text('Add kit'),
              ),
              SizedBox(
                width: 210,
                child: TextField(
                  controller: barcodeController,
                  focusNode: barcodeFocus,
                  onSubmitted: onBarcode,
                  decoration: const InputDecoration(
                    labelText: 'Barcode  F9',
                    prefixIcon: Icon(Icons.qr_code_scanner),
                  ),
                ),
              ),
            ],
          ),
        ),
        SizedBox(
          height: 74,
          child: FutureBuilder<List<Product>>(
            key: ValueKey('product-search-$query-$revision'),
            future: productsFuture,
            builder: (context, snapshot) {
              if (snapshot.hasError) {
                return const Center(child: Text('Product search failed.'));
              }
              if (!snapshot.hasData) {
                return const Center(child: LinearProgressIndicator());
              }
              final products = snapshot.data!.take(
                query.trim().isEmpty ? 0 : 8,
              );
              if (query.trim().isNotEmpty && products.isEmpty) {
                return const Center(
                  child: Text('No matching active products.'),
                );
              }
              return ListView(
                scrollDirection: Axis.horizontal,
                children: [
                  for (final product in products)
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 4),
                      child: ActionChip(
                        label: Text('${product.name} · ${product.sku}'),
                        onPressed: () => onSelect(product),
                      ),
                    ),
                ],
              );
            },
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(14, 4, 14, 8),
          child: Text(
            'Bill items (${lines.length})',
            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
          ),
        ),
        const Divider(height: 1),
        if (lines.isEmpty)
          const Expanded(
            child: Center(
              child: Text(
                'No items on this draft. Search the local product master or scan a barcode.',
                textAlign: TextAlign.center,
              ),
            ),
          )
        else
          Expanded(
            child: SingleChildScrollView(
              child: SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: DataTable(
                  columns: const [
                    DataColumn(label: Text('PRODUCT')),
                    DataColumn(label: Text('QTY')),
                    DataColumn(label: Text('TIER')),
                    DataColumn(label: Text('UNIT PRICE')),
                    DataColumn(label: Text('DISCOUNT')),
                    DataColumn(label: Text('TAX')),
                    DataColumn(label: Text('TOTAL')),
                    DataColumn(label: Text('')),
                  ],
                  rows: [
                    for (final line in lines)
                      DataRow(
                        cells: [
                          DataCell(
                            SizedBox(
                              width: 150,
                              child: Text(
                                '${line.name}\n${line.sku}',
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          ),
                          DataCell(Text(formatQuantity(line.quantityMilli))),
                          DataCell(Text(line.tier.label)),
                          DataCell(Text(formatMoney(line.unitPricePaise))),
                          DataCell(
                            Text(
                              '${(line.discountBasisPoints / 100).toStringAsFixed(2)}%',
                            ),
                          ),
                          DataCell(
                            Text(
                              line.taxPercent == null
                                  ? 'Not configured'
                                  : '${line.taxPercent}%',
                            ),
                          ),
                          DataCell(Text(formatMoney(line.totalPaise))),
                          DataCell(
                            Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                IconButton(
                                  tooltip: 'Edit line',
                                  onPressed: () => onEdit(line),
                                  icon: const Icon(Icons.edit_outlined),
                                ),
                                IconButton(
                                  tooltip: 'Remove line',
                                  onPressed: () => onRemove(line),
                                  icon: const Icon(Icons.delete_outline),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                  ],
                ),
              ),
            ),
          ),
      ],
    ),
  );
}

class _InvoiceSummary extends StatelessWidget {
  const _InvoiceSummary({
    required this.lines,
    required this.totals,
    required this.payments,
    required this.canSave,
    required this.saving,
    required this.onPayment,
    required this.onSave,
  });
  final List<BillingLine> lines;
  final InvoiceTotals totals;
  final List<SalePaymentInput> payments;
  final bool canSave;
  final bool saving;
  final VoidCallback onPayment;
  final VoidCallback onSave;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(14),
    decoration: BoxDecoration(
      color: AppColors.surface,
      border: Border.all(color: AppColors.border),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _SummaryRow(
          label: 'Taxable subtotal',
          value: formatMoney(totals.subtotalPaise),
        ),
        _SummaryRow(
          label: 'Configured tax',
          value: formatMoney(totals.taxPaise),
        ),
        const Divider(height: 24),
        const Text('Payable'),
        Text(
          formatMoney(totals.totalPaise),
          style: const TextStyle(fontSize: 29, fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 8),
        Text(
          payments.isEmpty
              ? 'Payment not allocated'
              : payments
                    .map(
                      (p) =>
                          '${p.method.name.toUpperCase()} ${formatMoney(p.amountPaise)}',
                    )
                    .join('\n'),
          style: const TextStyle(fontSize: 12),
        ),
        const Spacer(),
        OutlinedButton.icon(
          onPressed: onPayment,
          icon: const Icon(Icons.payments_outlined),
          label: const Text('Allocate payment  F4'),
        ),
        const SizedBox(height: 6),
        FilledButton.icon(
          onPressed: canSave ? onSave : null,
          icon: saving
              ? const SizedBox.square(
                  dimension: 16,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Icon(Icons.save_outlined),
          label: Text(saving ? 'Saving...' : 'Finalize and save'),
        ),
        const SizedBox(height: 8),
        if (lines.any((line) => line.taxPercent == null))
          const Text(
            'Tax setup required',
            style: TextStyle(color: AppColors.warning),
          ),
      ],
    ),
  );
}

class _SummaryRow extends StatelessWidget {
  const _SummaryRow({required this.label, required this.value});
  final String label;
  final String value;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 4),
    child: Row(
      children: [
        Expanded(child: Text(label)),
        Text(value),
      ],
    ),
  );
}

class _ProductLineDialog extends StatefulWidget {
  const _ProductLineDialog({
    required this.product,
    required this.currentPrices,
    this.existing,
  });
  final Product product;
  final Map<PriceTier, int> currentPrices;
  final BillingLine? existing;
  @override
  State<_ProductLineDialog> createState() => _ProductLineDialogState();
}

class _ProductLineDialogState extends State<_ProductLineDialog> {
  final _quantity = TextEditingController();
  final _discount = TextEditingController();
  late PriceTier _tier;
  @override
  void initState() {
    super.initState();
    _tier = widget.existing?.tier ?? PriceTier.mrp;
    _quantity.text = widget.existing == null
        ? '1'
        : formatQuantity(widget.existing!.quantityMilli);
    _discount.text = widget.existing == null
        ? '0'
        : (widget.existing!.discountBasisPoints / 100).toStringAsFixed(2);
  }

  @override
  void dispose() {
    _quantity.dispose();
    _discount.dispose();
    super.dispose();
  }

  int? _scaled(String value, int scale, int decimals) {
    final normalized = value.trim();
    if (!RegExp(r'^\d+(\.\d{1,3})?$').hasMatch(normalized)) return null;
    if (normalized.contains('.') &&
        normalized.split('.').last.length > decimals) {
      return null;
    }
    final pieces = normalized.split('.');
    final whole = int.tryParse(pieces.first);
    if (whole == null) return null;
    final fractional = pieces.length == 1
        ? 0
        : int.parse(pieces[1].padRight(decimals, '0'));
    return whole * scale +
        fractional *
            (scale ~/ (decimals == 0 ? 1 : (decimals == 1 ? 10 : 100)));
  }

  void _submit() {
    final quantity = _scaled(_quantity.text, 1000, 3);
    final discount = _scaled(_discount.text, 100, 2);
    final price = widget.currentPrices[_tier];
    if (quantity == null ||
        quantity <= 0 ||
        discount == null ||
        discount > 10000 ||
        price == null) {
      return;
    }
    Navigator.of(context).pop(
      BillingLine(
        productId: widget.product.id,
        name: widget.product.name,
        sku: widget.product.sku,
        tier: _tier,
        quantityMilli: quantity,
        unitPricePaise: price,
        discountBasisPoints: discount,
        taxPercent: widget.product.taxPercent,
        originatingKitId: widget.existing?.originatingKitId,
      ),
    );
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
    title: Text(widget.product.name),
    content: SizedBox(
      width: 420,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            'SKU ${widget.product.sku} · ${widget.product.taxPercent == null ? 'Tax not configured' : 'Tax ${widget.product.taxPercent}%'}',
          ),
          DropdownButtonFormField<PriceTier>(
            initialValue: _tier,
            decoration: const InputDecoration(labelText: 'Rate tier'),
            items: PriceTier.values
                .map(
                  (tier) => DropdownMenuItem(
                    value: tier,
                    child: Text(
                      '${tier.label} · ${widget.currentPrices[tier] == null ? 'No rate' : formatMoney(widget.currentPrices[tier]!)}',
                    ),
                  ),
                )
                .toList(),
            onChanged: (value) {
              if (value != null) setState(() => _tier = value);
            },
          ),
          TextField(
            controller: _quantity,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            inputFormatters: [
              FilteringTextInputFormatter.allow(RegExp(r'^\d*\.?\d{0,3}')),
            ],
            decoration: const InputDecoration(labelText: 'Quantity'),
          ),
          TextField(
            controller: _discount,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            inputFormatters: [
              FilteringTextInputFormatter.allow(RegExp(r'^\d*\.?\d{0,2}')),
            ],
            decoration: const InputDecoration(labelText: 'Discount %'),
          ),
          const SizedBox(height: 8),
          const Text(
            'CMP customer eligibility is not assigned by this application.',
            style: TextStyle(fontSize: 12),
          ),
        ],
      ),
    ),
    actions: [
      TextButton(
        onPressed: () => Navigator.pop(context),
        child: const Text('Cancel'),
      ),
      FilledButton(
        onPressed: _submit,
        child: Text(widget.existing == null ? 'Add to bill' : 'Update line'),
      ),
    ],
  );
}

class _PaymentDialog extends StatefulWidget {
  const _PaymentDialog({
    required this.totalPaise,
    required this.initial,
    required this.customer,
  });
  final int totalPaise;
  final List<SalePaymentInput> initial;
  final Customer? customer;
  @override
  State<_PaymentDialog> createState() => _PaymentDialogState();
}

class _PaymentDialogState extends State<_PaymentDialog> {
  late final Map<PaymentMethod, TextEditingController> _amounts;
  late final TextEditingController _reference;
  @override
  void initState() {
    super.initState();
    _amounts = {
      for (final method in PaymentMethod.values)
        method: TextEditingController(text: _initialAmount(method)),
    };
    _reference = TextEditingController(
      text:
          widget.initial
              .firstWhere(
                (payment) => payment.reference != null,
                orElse: () => const SalePaymentInput(PaymentMethod.cash, 0),
              )
              .reference ??
          '',
    );
    for (final controller in _amounts.values) {
      controller.addListener(_refresh);
    }
  }

  String _initialAmount(PaymentMethod method) {
    final amount = widget.initial
        .where((payment) => payment.method == method)
        .fold<int>(0, (sum, payment) => sum + payment.amountPaise);
    return '${amount ~/ 100}.${(amount % 100).toString().padLeft(2, '0')}';
  }

  int get _allocated => _amounts.values.fold(
    0,
    (sum, controller) => sum + (_parsePaise(controller.text) ?? 0),
  );
  int? _parsePaise(String value) {
    final parts = value.trim().split('.');
    if (parts.length > 2 ||
        !RegExp(r'^\d+$').hasMatch(parts[0]) ||
        (parts.length == 2 && !RegExp(r'^\d{1,2}$').hasMatch(parts[1]))) {
      return null;
    }
    return int.parse(parts[0]) * 100 +
        (parts.length == 1 ? 0 : int.parse(parts[1].padRight(2, '0')));
  }

  void _refresh() => setState(() {});
  @override
  void dispose() {
    for (final controller in _amounts.values) {
      controller.dispose();
    }
    _reference.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final balanced = _allocated == widget.totalPaise;
    final credit = _parsePaise(_amounts[PaymentMethod.credit]!.text) ?? 0;
    final creditAllowed =
        credit == 0 || (widget.customer?.creditIdentified ?? false);
    return AlertDialog(
      title: const Text('Split payment'),
      content: SizedBox(
        width: 400,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                'Invoice total: ${formatMoney(widget.totalPaise)}',
                style: const TextStyle(fontWeight: FontWeight.bold),
              ),
              for (final method in PaymentMethod.values)
                TextField(
                  controller: _amounts[method],
                  keyboardType: const TextInputType.numberWithOptions(
                    decimal: true,
                  ),
                  inputFormatters: [
                    FilteringTextInputFormatter.allow(
                      RegExp(r'^\d*\.?\d{0,2}'),
                    ),
                  ],
                  decoration: InputDecoration(
                    labelText: method.name.toUpperCase(),
                    suffixText: 'INR',
                  ),
                ),
              if ((_parsePaise(_amounts[PaymentMethod.upi]!.text) ?? 0) > 0 ||
                  (_parsePaise(_amounts[PaymentMethod.card]!.text) ?? 0) > 0)
                TextField(
                  controller: _reference,
                  decoration: const InputDecoration(
                    labelText: 'Payment reference (optional)',
                  ),
                ),
              const SizedBox(height: 8),
              Text('Remaining: ${formatMoney(widget.totalPaise - _allocated)}'),
              if (!creditAllowed)
                const Text(
                  'Credit needs a selected customer with phone or GSTIN.',
                  style: TextStyle(color: Colors.red),
                ),
              const Text(
                'UPI and card are stored as recorded, unverified payments. Credit does not post a customer ledger entry.',
                style: TextStyle(fontSize: 12),
              ),
            ],
          ),
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: balanced && creditAllowed
              ? () => Navigator.pop(context, [
                  for (final method in PaymentMethod.values)
                    if ((_parsePaise(_amounts[method]!.text) ?? 0) > 0)
                      SalePaymentInput(
                        method,
                        _parsePaise(_amounts[method]!.text)!,
                        reference: _reference.text.trim().isEmpty
                            ? null
                            : _reference.text.trim(),
                      ),
                ])
              : null,
          child: const Text('Use allocations'),
        ),
      ],
    );
  }
}

class _SavedInvoiceDialog extends StatelessWidget {
  const _SavedInvoiceDialog({required this.invoice});
  final SavedInvoice invoice;
  @override
  Widget build(BuildContext context) => AlertDialog(
    title: Text('Invoice ${invoice.invoiceNumber} saved'),
    content: SizedBox(
      width: 540,
      child: ListView(
        shrinkWrap: true,
        children: [
          Text('Customer: ${invoice.customerName ?? 'Walk-in'}'),
          Text('Status: ${invoice.state}'),
          const Divider(),
          for (final line in invoice.lines)
            ListTile(
              dense: true,
              title: Text(line.name),
              subtitle: Text(
                '${formatQuantity(line.quantityMilli)} × ${formatMoney(line.unitPricePaise)} · ${line.priceTier.label}',
              ),
              trailing: Text(formatMoney(line.totalPaise)),
            ),
          const Divider(),
          Text('Subtotal ${formatMoney(invoice.subtotalPaise)}'),
          Text('Tax ${formatMoney(invoice.taxPaise)}'),
          Text(
            'Total ${formatMoney(invoice.totalPaise)}',
            style: const TextStyle(fontWeight: FontWeight.bold),
          ),
          for (final payment in invoice.payments)
            Text(
              '${payment.method.name.toUpperCase()}: ${formatMoney(payment.amountPaise)}${payment.method == PaymentMethod.upi || payment.method == PaymentMethod.card ? ' (unverified)' : ''}',
            ),
        ],
      ),
    ),
    actions: [
      TextButton(
        onPressed: () => Navigator.pop(context),
        child: const Text('Close'),
      ),
      FilledButton.icon(
        onPressed: () => InvoicePrintService.print(invoice),
        icon: const Icon(Icons.print_outlined),
        label: const Text('Print'),
      ),
    ],
  );
}

class _KitQuantityDialog extends StatefulWidget {
  const _KitQuantityDialog();
  @override
  State<_KitQuantityDialog> createState() => _KitQuantityDialogState();
}

class _KitQuantityDialogState extends State<_KitQuantityDialog> {
  final _quantity = TextEditingController(text: '1');

  @override
  void dispose() {
    _quantity.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
    title: const Text('Kit quantity'),
    content: TextField(
      controller: _quantity,
      autofocus: true,
      keyboardType: const TextInputType.numberWithOptions(decimal: true),
      inputFormatters: [
        FilteringTextInputFormatter.allow(RegExp(r'^\d*\.?\d{0,3}')),
      ],
      decoration: const InputDecoration(labelText: 'Number of kits'),
      onSubmitted: (_) => _submit(context),
    ),
    actions: [
      TextButton(
        onPressed: () => Navigator.pop(context),
        child: const Text('Cancel'),
      ),
      FilledButton(
        onPressed: () => _submit(context),
        child: const Text('Add components'),
      ),
    ],
  );

  void _submit(BuildContext context) {
    final value = double.tryParse(_quantity.text);
    if (value == null || !value.isFinite || value <= 0) return;
    Navigator.pop(context, (value * 1000).round());
  }
}

class _DatabaseUnavailable extends StatelessWidget {
  const _DatabaseUnavailable({required this.message});
  final String message;
  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.lock_outline, size: 40),
          const Text('Encrypted database unavailable'),
          Text(message, textAlign: TextAlign.center),
          const Text(
            'Billing is disabled until the encrypted local database can be opened.',
          ),
        ],
      ),
    ),
  );
}

class _NewInvoiceIntent extends Intent {
  const _NewInvoiceIntent();
}

class _PaymentIntent extends Intent {
  const _PaymentIntent();
}

class _AddProductIntent extends Intent {
  const _AddProductIntent();
}

class _ProductSearchIntent extends Intent {
  const _ProductSearchIntent();
}

class _BarcodeIntent extends Intent {
  const _BarcodeIntent();
}
