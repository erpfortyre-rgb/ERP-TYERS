import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/providers.dart';
import '../../../database/app_database.dart';
import '../../parties/data/supplier_repository.dart';
import '../../parties/domain/supplier.dart';
import '../data/purchase_repository.dart';
import '../domain/purchase.dart';

class PurchaseScreen extends ConsumerStatefulWidget {
  const PurchaseScreen({super.key});

  @override
  ConsumerState<PurchaseScreen> createState() => _PurchaseScreenState();
}

class _PurchaseScreenState extends ConsumerState<PurchaseScreen> {
  final _search = TextEditingController();
  int _revision = 0;

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => ref
      .watch(databaseProvider)
      .when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) =>
            Center(child: Text('Purchases unavailable: $error')),
        data: (database) {
          final repository = PurchaseRepository(database);
          final bills = repository.list(query: _search.text);
          final returns = repository.returns();
          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Padding(
                padding: const EdgeInsets.all(16),
                child: Wrap(
                  spacing: 12,
                  runSpacing: 10,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    SizedBox(
                      width: 350,
                      child: TextField(
                        controller: _search,
                        decoration: const InputDecoration(
                          prefixIcon: Icon(Icons.search),
                          labelText: 'Search reference, supplier, invoice',
                          isDense: true,
                        ),
                        onChanged: (_) => setState(() => _revision++),
                      ),
                    ),
                    FilledButton.icon(
                      onPressed: () => _editDraft(database, repository),
                      icon: const Icon(Icons.add),
                      label: const Text('New purchase draft'),
                    ),
                  ],
                ),
              ),
              const Padding(
                padding: EdgeInsets.fromLTRB(16, 0, 16, 12),
                child: Text(
                  'Draft purchases do not affect stock. Final posting requires configured product tax and accounting mappings.',
                  style: TextStyle(color: Color(0xFF64748B)),
                ),
              ),
              if (returns.isNotEmpty)
                ExpansionTile(
                  title: Text(
                    'Purchase returns for review (${returns.length})',
                  ),
                  children: returns
                      .take(5)
                      .map(
                        (purchaseReturn) => ListTile(
                          dense: true,
                          title: Text(
                            '${purchaseReturn.purchaseReference} · ${purchaseReturn.supplierName}',
                          ),
                          subtitle: Text(purchaseReturn.reason),
                          trailing: const Chip(label: Text('Review required')),
                        ),
                      )
                      .toList(),
                ),
              Expanded(
                child: bills.isEmpty
                    ? const Center(child: Text('No purchase bills found.'))
                    : ListView.separated(
                        key: ValueKey(_revision),
                        padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                        itemCount: bills.length,
                        separatorBuilder: (_, _) => const SizedBox(height: 8),
                        itemBuilder: (context, index) {
                          final bill = bills[index];
                          final posted = bill.status == 'FINALIZED';
                          return Card(
                            child: ListTile(
                              title: Text(
                                '${bill.reference}  ·  ${bill.supplierName}',
                              ),
                              subtitle: Text(
                                'Supplier invoice ${bill.supplierInvoiceNumber}  ·  ${bill.branchName}  ·  ${_date(bill.date)}  ·  ${posted ? 'Posted' : 'Draft'}',
                              ),
                              trailing: Wrap(
                                spacing: 4,
                                crossAxisAlignment: WrapCrossAlignment.center,
                                children: [
                                  Text(
                                    _money(bill.totalPaise),
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                  if (!posted)
                                    IconButton(
                                      tooltip: 'Edit draft',
                                      onPressed: () => _editDraft(
                                        database,
                                        repository,
                                        bill.id,
                                      ),
                                      icon: const Icon(Icons.edit_outlined),
                                    ),
                                  if (!posted)
                                    IconButton(
                                      tooltip: 'Finalize purchase',
                                      onPressed: () =>
                                          _finalize(repository, bill.id),
                                      icon: const Icon(
                                        Icons.check_circle_outline,
                                      ),
                                    ),
                                  if (posted)
                                    IconButton(
                                      tooltip:
                                          'Create purchase return for review',
                                      onPressed: () =>
                                          _createReturn(repository, bill.id),
                                      icon: const Icon(
                                        Icons.assignment_return_outlined,
                                      ),
                                    ),
                                ],
                              ),
                            ),
                          );
                        },
                      ),
              ),
            ],
          );
        },
      );

  Future<void> _editDraft(
    AppDatabase database,
    PurchaseRepository repository, [
    String? id,
  ]) async {
    final existing = id == null ? null : repository.loadDraft(id);
    if (id != null && existing == null) {
      _showMessage('Purchase draft could not be loaded.');
      return;
    }
    final data = await showDialog<_PurchaseFormResult>(
      context: context,
      builder: (_) =>
          _PurchaseFormDialog(database: database, initial: existing),
    );
    if (data == null || !mounted) return;
    try {
      repository.saveDraft(
        id: existing?.id,
        supplierId: data.supplierId,
        supplierInvoiceNumber: data.supplierInvoiceNumber,
        purchaseDate: data.purchaseDate,
        supplierInvoiceDate: data.supplierInvoiceDate,
        lines: data.lines,
        notes: data.notes,
      );
      setState(() => _revision++);
      _showMessage('Purchase draft saved locally.');
    } catch (error) {
      _showMessage('Purchase draft was not saved: $error');
    }
  }

  Future<void> _finalize(PurchaseRepository repository, String id) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Finalize purchase?'),
        content: const Text(
          'This posts the supplier payable and stock inward atomically. The action cannot be repeated or undone. Continue only after checking the supplier invoice and account mappings.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Finalize'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    try {
      repository.finalize(id);
      setState(() => _revision++);
      _showMessage('Purchase posted; stock and journal updated.');
    } catch (error) {
      _showMessage('Purchase was not finalized: $error');
    }
  }

  Future<void> _createReturn(
    PurchaseRepository repository,
    String purchaseBillId,
  ) async {
    final lines = repository.returnableLines(purchaseBillId);
    if (lines.isEmpty) {
      _showMessage('This purchase has no remaining return quantity.');
      return;
    }
    final result = await showDialog<_PurchaseReturnFormResult>(
      context: context,
      builder: (_) => _PurchaseReturnFormDialog(lines: lines),
    );
    if (result == null || !mounted) return;
    try {
      repository.saveReturnForReview(
        purchaseBillId: purchaseBillId,
        reason: result.reason,
        lines: result.lines,
      );
      setState(() => _revision++);
      _showMessage(
        'Return saved for review; no stock or payable adjustment was posted.',
      );
    } catch (error) {
      _showMessage('Return was not saved: $error');
    }
  }

  void _showMessage(String message) {
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text(message)));
  }

  static String _money(int paise) => '₹${(paise / 100).toStringAsFixed(2)}';
  static String _date(DateTime date) =>
      '${date.day.toString().padLeft(2, '0')}/${date.month.toString().padLeft(2, '0')}/${date.year}';
}

class _PurchaseFormResult {
  const _PurchaseFormResult({
    required this.supplierId,
    required this.supplierInvoiceNumber,
    required this.purchaseDate,
    required this.supplierInvoiceDate,
    required this.lines,
    required this.notes,
  });

  final String supplierId;
  final String supplierInvoiceNumber;
  final DateTime purchaseDate;
  final DateTime supplierInvoiceDate;
  final List<PurchaseLineDraft> lines;
  final String? notes;
}

class _PurchaseReturnFormResult {
  const _PurchaseReturnFormResult({required this.reason, required this.lines});

  final String reason;
  final List<PurchaseReturnLineDraft> lines;
}

class _PurchaseReturnFormDialog extends StatefulWidget {
  const _PurchaseReturnFormDialog({required this.lines});
  final List<ReturnablePurchaseLine> lines;

  @override
  State<_PurchaseReturnFormDialog> createState() =>
      _PurchaseReturnFormDialogState();
}

class _PurchaseReturnFormDialogState extends State<_PurchaseReturnFormDialog> {
  final _reason = TextEditingController();
  late final List<TextEditingController> _quantities;

  @override
  void initState() {
    super.initState();
    _quantities = widget.lines
        .map((_) => TextEditingController(text: '0'))
        .toList();
  }

  @override
  void dispose() {
    _reason.dispose();
    for (final controller in _quantities) {
      controller.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
    title: const Text('Purchase return · review only'),
    content: SizedBox(
      width: 580,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          TextField(
            controller: _reason,
            decoration: const InputDecoration(
              labelText: 'Return reason',
              isDense: true,
            ),
            maxLines: 2,
          ),
          const SizedBox(height: 12),
          Flexible(
            child: ListView.builder(
              shrinkWrap: true,
              itemCount: widget.lines.length,
              itemBuilder: (context, index) {
                final line = widget.lines[index];
                return ListTile(
                  title: Text(line.productName),
                  subtitle: Text(
                    '${line.sku} · available ${_quantity(line.availableQuantityMilli)}',
                  ),
                  trailing: SizedBox(
                    width: 110,
                    child: TextField(
                      controller: _quantities[index],
                      keyboardType: const TextInputType.numberWithOptions(
                        decimal: true,
                      ),
                      decoration: const InputDecoration(
                        labelText: 'Return qty',
                        isDense: true,
                      ),
                    ),
                  ),
                );
              },
            ),
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
        onPressed: () {
          if (_reason.text.trim().isEmpty) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Enter a return reason.')),
            );
            return;
          }
          final selected = <PurchaseReturnLineDraft>[];
          for (var index = 0; index < widget.lines.length; index++) {
            final value = _PurchaseFormDialogState._parseQuantity(
              _quantities[index].text,
            );
            if (value == null) {
              if (_quantities[index].text.trim() != '0') {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text('Return quantity must use up to 3 decimals.'),
                  ),
                );
                return;
              }
              continue;
            }
            if (value > widget.lines[index].availableQuantityMilli) {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text(
                    'Return quantity exceeds the available amount.',
                  ),
                ),
              );
              return;
            }
            selected.add(
              PurchaseReturnLineDraft(
                purchaseBillItemId: widget.lines[index].purchaseBillItemId,
                quantityMilli: value,
              ),
            );
          }
          if (selected.isEmpty) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text(
                  'Enter a positive quantity for at least one item.',
                ),
              ),
            );
            return;
          }
          Navigator.pop(
            context,
            _PurchaseReturnFormResult(
              reason: _reason.text.trim(),
              lines: selected,
            ),
          );
        },
        child: const Text('Save for review'),
      ),
    ],
  );

  static String _quantity(int milli) =>
      '${milli ~/ 1000}.${(milli % 1000).toString().padLeft(3, '0')}';
}

class _PurchaseFormDialog extends StatefulWidget {
  const _PurchaseFormDialog({required this.database, required this.initial});

  final AppDatabase database;
  final PurchaseDraftData? initial;

  @override
  State<_PurchaseFormDialog> createState() => _PurchaseFormDialogState();
}

class _PurchaseFormDialogState extends State<_PurchaseFormDialog> {
  final _formKey = GlobalKey<FormState>();
  late final List<SupplierRecord> _suppliers;
  late final List<PurchaseProduct> _products;
  late final TextEditingController _invoice;
  late final TextEditingController _notes;
  late final List<_PurchaseLineEditor> _lines;
  String? _supplierId;
  late DateTime _purchaseDate;
  late DateTime _supplierInvoiceDate;

  @override
  void initState() {
    super.initState();
    _suppliers = SupplierRepository(widget.database).search(activeOnly: true);
    _products = PurchaseRepository(widget.database).products();
    final initial = widget.initial;
    _invoice = TextEditingController(
      text: initial?.supplierInvoiceNumber ?? '',
    );
    _notes = TextEditingController(text: initial?.notes ?? '');
    _supplierId =
        initial?.supplierId ??
        (_suppliers.isEmpty ? null : _suppliers.first.id);
    final today = DateTime.now();
    _purchaseDate = initial?.purchaseDate ?? today;
    _supplierInvoiceDate = initial?.supplierInvoiceDate ?? today;
    _lines =
        initial?.lines
            .map(_PurchaseLineEditor.fromDraft)
            .toList(growable: true) ??
        <_PurchaseLineEditor>[];
    if (_lines.isEmpty && _products.isNotEmpty) {
      _lines.add(_PurchaseLineEditor(productId: _products.first.id));
    }
  }

  @override
  void dispose() {
    _invoice.dispose();
    _notes.dispose();
    for (final line in _lines) {
      line.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
    title: Text(
      widget.initial == null ? 'New purchase draft' : 'Edit purchase draft',
    ),
    content: SizedBox(
      width: 820,
      height: 580,
      child: _suppliers.isEmpty
          ? const Center(
              child: Text('Add an active supplier before creating a purchase.'),
            )
          : _products.isEmpty
          ? const Center(child: Text('Add active products before purchasing.'))
          : Form(
              key: _formKey,
              child: Column(
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: DropdownButtonFormField<String>(
                          initialValue: _supplierId,
                          decoration: const InputDecoration(
                            labelText: 'Supplier',
                            isDense: true,
                          ),
                          items: _suppliers
                              .map(
                                (supplier) => DropdownMenuItem(
                                  value: supplier.id,
                                  child: Text(
                                    supplier.businessName,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                              )
                              .toList(),
                          onChanged: (value) =>
                              setState(() => _supplierId = value),
                          validator: (value) =>
                              value == null ? 'Select a supplier.' : null,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: TextFormField(
                          controller: _invoice,
                          decoration: const InputDecoration(
                            labelText: 'Supplier invoice number',
                            isDense: true,
                          ),
                          validator: (value) =>
                              value == null || value.trim().isEmpty
                              ? 'Invoice number is required.'
                              : null,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Expanded(
                        child: _dateButton(
                          'Purchase date',
                          _purchaseDate,
                          (date) => setState(() => _purchaseDate = date),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: _dateButton(
                          'Supplier invoice date',
                          _supplierInvoiceDate,
                          (date) => setState(() => _supplierInvoiceDate = date),
                        ),
                      ),
                    ],
                  ),
                  const Divider(height: 20),
                  Row(
                    children: [
                      const Expanded(
                        child: Text(
                          'Products',
                          style: TextStyle(fontWeight: FontWeight.w700),
                        ),
                      ),
                      TextButton.icon(
                        onPressed: () => setState(
                          () => _lines.add(
                            _PurchaseLineEditor(productId: _products.first.id),
                          ),
                        ),
                        icon: const Icon(Icons.add, size: 18),
                        label: const Text('Add product'),
                      ),
                    ],
                  ),
                  Expanded(
                    child: ListView.builder(
                      itemCount: _lines.length,
                      itemBuilder: (context, index) =>
                          _lineEditor(index, _lines[index]),
                    ),
                  ),
                  TextFormField(
                    controller: _notes,
                    decoration: const InputDecoration(
                      labelText: 'Notes (optional)',
                      isDense: true,
                    ),
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
        onPressed: _suppliers.isEmpty || _products.isEmpty ? null : _save,
        child: const Text('Save draft'),
      ),
    ],
  );

  Widget _dateButton(
    String title,
    DateTime date,
    ValueChanged<DateTime> onChanged,
  ) => OutlinedButton.icon(
    onPressed: () async {
      final value = await showDatePicker(
        context: context,
        initialDate: date,
        firstDate: DateTime(2000),
        lastDate: DateTime(2100),
      );
      if (value != null) onChanged(value);
    },
    icon: const Icon(Icons.calendar_today_outlined, size: 16),
    label: Text('$title: ${date.day}/${date.month}/${date.year}'),
  );

  Widget _lineEditor(int index, _PurchaseLineEditor line) {
    final product = _products.firstWhere(
      (item) => item.id == line.productId,
      orElse: () => _products.first,
    );
    return Card(
      margin: const EdgeInsets.symmetric(vertical: 4),
      child: Padding(
        padding: const EdgeInsets.all(8),
        child: Column(
          children: [
            Row(
              children: [
                Expanded(
                  flex: 3,
                  child: DropdownButtonFormField<String>(
                    initialValue: line.productId,
                    decoration: const InputDecoration(
                      labelText: 'Product',
                      isDense: true,
                    ),
                    items: _products
                        .map(
                          (item) => DropdownMenuItem(
                            value: item.id,
                            child: Text(
                              '${item.name} (${item.sku})',
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        )
                        .toList(),
                    onChanged: (value) => setState(
                      () => line.productId = value ?? line.productId,
                    ),
                  ),
                ),
                IconButton(
                  tooltip: 'Remove product',
                  onPressed: _lines.length < 2
                      ? null
                      : () => setState(() {
                          _lines.removeAt(index).dispose();
                        }),
                  icon: const Icon(Icons.delete_outline),
                ),
              ],
            ),
            Row(
              children: [
                _numberField(line.quantity, 'Qty', width: 110),
                const SizedBox(width: 8),
                _numberField(line.cost, 'Cost ₹/unit', width: 150),
                const SizedBox(width: 8),
                _numberField(line.discount, 'Discount ₹', width: 145),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    product.taxPercent == null
                        ? 'Tax not configured'
                        : 'Configured tax ${product.taxPercent}%',
                    style: TextStyle(
                      color: product.taxPercent == null
                          ? Colors.deepOrange
                          : const Color(0xFF64748B),
                      fontSize: 12,
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _numberField(
    TextEditingController controller,
    String label, {
    required double width,
  }) => SizedBox(
    width: width,
    child: TextFormField(
      controller: controller,
      keyboardType: const TextInputType.numberWithOptions(decimal: true),
      decoration: InputDecoration(labelText: label, isDense: true),
      validator: (value) =>
          value == null || value.trim().isEmpty ? 'Required' : null,
    ),
  );

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    final parsed = <PurchaseLineDraft>[];
    for (final line in _lines) {
      final quantity = _parseQuantity(line.quantity.text);
      final cost = _parseMoney(line.cost.text);
      final discount = _parseMoney(
        line.discount.text.isEmpty ? '0' : line.discount.text,
      );
      if (quantity == null || cost == null || discount == null) {
        _showError(
          'Enter quantity to three decimals and monetary values to two decimals.',
        );
        return;
      }
      parsed.add(
        PurchaseLineDraft(
          productId: line.productId,
          quantityMilli: quantity,
          unitCostPaise: cost,
          discountPaise: discount,
        ),
      );
    }
    if (_supplierId == null) return;
    Navigator.pop(
      context,
      _PurchaseFormResult(
        supplierId: _supplierId!,
        supplierInvoiceNumber: _invoice.text.trim(),
        purchaseDate: _purchaseDate,
        supplierInvoiceDate: _supplierInvoiceDate,
        lines: parsed,
        notes: _notes.text.trim(),
      ),
    );
  }

  void _showError(String message) {
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text(message)));
  }

  static int? _parseMoney(String input) {
    final value = input.trim();
    if (!RegExp(r'^\d+(?:\.\d{1,2})?$').hasMatch(value)) return null;
    final parts = value.split('.');
    final whole = int.tryParse(parts[0]);
    final fractional = parts.length == 1
        ? 0
        : int.tryParse(parts[1].padRight(2, '0'));
    if (whole == null || fractional == null) return null;
    return whole * 100 + fractional;
  }

  static int? _parseQuantity(String input) {
    final value = input.trim();
    if (!RegExp(r'^\d+(?:\.\d{1,3})?$').hasMatch(value)) return null;
    final parts = value.split('.');
    final whole = int.tryParse(parts[0]);
    final fractional = parts.length == 1
        ? 0
        : int.tryParse(parts[1].padRight(3, '0'));
    if (whole == null || fractional == null) return null;
    final result = whole * 1000 + fractional;
    return result > 0 ? result : null;
  }
}

class _PurchaseLineEditor {
  _PurchaseLineEditor({required this.productId})
    : quantity = TextEditingController(text: '1'),
      cost = TextEditingController(text: ''),
      discount = TextEditingController(text: '0');

  factory _PurchaseLineEditor.fromDraft(
    PurchaseLineDraft draft,
  ) => _PurchaseLineEditor(productId: draft.productId)
    ..quantity.text =
        '${draft.quantityMilli ~/ 1000}.${(draft.quantityMilli % 1000).toString().padLeft(3, '0')}'
    ..cost.text = (draft.unitCostPaise / 100).toStringAsFixed(2)
    ..discount.text = (draft.discountPaise / 100).toStringAsFixed(2);

  String productId;
  final TextEditingController quantity;
  final TextEditingController cost;
  final TextEditingController discount;

  void dispose() {
    quantity.dispose();
    cost.dispose();
    discount.dispose();
  }
}
