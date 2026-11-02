import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../core/theme/app_colors.dart';
import '../../../database/app_database.dart';
import '../data/items_repository_impl.dart';
import '../domain/item.dart';

class ProductFormScreen extends StatefulWidget {
  const ProductFormScreen({super.key, required this.database, this.product});

  final AppDatabase database;
  final Product? product;

  @override
  State<ProductFormScreen> createState() => _ProductFormScreenState();
}

class _ProductFormScreenState extends State<ProductFormScreen> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _name;
  late final TextEditingController _sku;
  late final TextEditingController _barcode;
  late final TextEditingController _category;
  late final TextEditingController _brand;
  late final TextEditingController _hsn;
  late final TextEditingController _tax;
  late final TextEditingController _unit;
  late final Map<PriceTier, TextEditingController> _prices;
  late final Future<List<ProductPrice>> _history;
  DateTime _validFrom = DateTime.now();
  bool _active = true;
  bool _saving = false;

  ItemsRepositoryImpl get _repository => ItemsRepositoryImpl(widget.database);

  @override
  void initState() {
    super.initState();
    final product = widget.product;
    _name = TextEditingController(text: product?.name ?? '');
    _sku = TextEditingController(text: product?.sku ?? '');
    _barcode = TextEditingController(text: product?.barcode ?? '');
    _category = TextEditingController(text: product?.category ?? '');
    _brand = TextEditingController(text: product?.brand ?? '');
    _hsn = TextEditingController(text: product?.hsnCode ?? '');
    _tax = TextEditingController(text: product?.taxPercent?.toString() ?? '');
    _unit = TextEditingController(text: product?.unit ?? 'PCS');
    _prices = {
      for (final tier in PriceTier.values) tier: TextEditingController(),
    };
    _history = product == null
        ? Future.value(const <ProductPrice>[])
        : _repository.priceHistory(product.id);
    if (product != null) _loadCurrentPrices(product.id);
  }

  Future<void> _loadCurrentPrices(String productId) async {
    final current = await _repository.currentPrices(productId);
    if (!mounted) return;
    for (final tier in PriceTier.values) {
      _prices[tier]!.text = _formatRupees(current[tier] ?? 0);
    }
  }

  @override
  void dispose() {
    _name.dispose();
    _sku.dispose();
    _barcode.dispose();
    _category.dispose();
    _brand.dispose();
    _hsn.dispose();
    _tax.dispose();
    _unit.dispose();
    for (final controller in _prices.values) {
      controller.dispose();
    }
    super.dispose();
  }

  Future<void> _pickValidFrom() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _validFrom,
      firstDate: DateTime(2000),
      lastDate: DateTime(2100),
    );
    if (picked != null) setState(() => _validFrom = picked);
  }

  int? _parsePaise(String value) {
    final normalized = value.trim();
    if (normalized.isEmpty ||
        !RegExp(r'^\d+(\.\d{1,2})?$').hasMatch(normalized)) {
      return null;
    }
    final parts = normalized.split('.');
    final rupees = int.tryParse(parts.first);
    if (rupees == null) return null;
    final paise = parts.length == 1 ? 0 : int.parse(parts[1].padRight(2, '0'));
    return rupees * 100 + paise;
  }

  String? _priceValidator(String? value) => _parsePaise(value ?? '') == null
      ? 'Enter a non-negative amount with up to 2 decimals.'
      : null;

  Future<void> _save() async {
    if (_saving || !_formKey.currentState!.validate()) return;
    setState(() => _saving = true);
    try {
      final prices = <PriceTier, int>{};
      for (final tier in PriceTier.values) {
        prices[tier] = _parsePaise(_prices[tier]!.text)!;
      }
      await _repository.saveProduct(
        ProductDraft(
          id: widget.product?.id,
          branchId: widget.product?.branchId,
          name: _name.text,
          sku: _sku.text,
          barcode: _barcode.text,
          category: _category.text,
          brand: _brand.text,
          hsnCode: _hsn.text,
          taxPercent: _tax.text.trim().isEmpty
              ? null
              : double.tryParse(_tax.text.trim()),
          unit: _unit.text,
          isActive: _active,
          prices: prices,
          validFrom: _validFrom,
        ),
      );
      if (mounted) Navigator.of(context).pop(true);
    } catch (error) {
      if (!mounted) return;
      final message = error is ProductValidationException
          ? error.message
          : 'Product was not saved. Check that its SKU and barcode are unique.';
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(message)));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final editing = widget.product != null;
    return Scaffold(
      appBar: AppBar(
        title: Text(editing ? 'Edit product' : 'Add product'),
        actions: [
          if (editing)
            TextButton.icon(
              onPressed: _showHistory,
              icon: const Icon(Icons.history),
              label: const Text('Price history'),
            ),
          const SizedBox(width: 8),
        ],
      ),
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 900),
          child: Form(
            key: _formKey,
            child: ListView(
              padding: const EdgeInsets.all(20),
              children: [
                Text(
                  'Product details',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                const SizedBox(height: 14),
                Wrap(
                  spacing: 12,
                  runSpacing: 12,
                  children: [
                    _field(_name, 'Product name *', width: 420, required: true),
                    _field(_sku, 'SKU *', width: 240, required: true),
                    _field(_barcode, 'Barcode', width: 240),
                    _field(_category, 'Category', width: 240),
                    _field(_brand, 'Brand', width: 240),
                    _field(_hsn, 'HSN code', width: 180),
                    SizedBox(
                      width: 180,
                      child: TextFormField(
                        controller: _tax,
                        keyboardType: const TextInputType.numberWithOptions(
                          decimal: true,
                        ),
                        inputFormatters: [
                          FilteringTextInputFormatter.allow(
                            RegExp(r'^\d*\.?\d{0,2}'),
                          ),
                        ],
                        validator: (value) {
                          if (value == null || value.trim().isEmpty) {
                            return null;
                          }
                          final rate = double.tryParse(value.trim());
                          return rate == null || rate < 0 || rate > 100
                              ? 'Use a rate from 0 to 100.'
                              : null;
                        },
                        decoration: const InputDecoration(
                          labelText: 'Configured tax %',
                          helperText: 'Leave blank until approved',
                        ),
                      ),
                    ),
                    _field(_unit, 'Unit', width: 140),
                  ],
                ),
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('Active product'),
                  value: _active,
                  onChanged: (value) => setState(() => _active = value),
                ),
                const Divider(height: 28),
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        'Five-tier pricing',
                        style: Theme.of(context).textTheme.titleLarge,
                      ),
                    ),
                    TextButton.icon(
                      onPressed: _pickValidFrom,
                      icon: const Icon(Icons.calendar_month_outlined),
                      label: Text('Valid from ${_shortDate(_validFrom)}'),
                    ),
                  ],
                ),
                const Text(
                  'Prices are stored as integer paise. Customer eligibility for CMP tiers is not configured.',
                  style: TextStyle(color: AppColors.textMuted),
                ),
                const SizedBox(height: 12),
                for (final tier in PriceTier.values)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: SizedBox(
                      width: 340,
                      child: TextFormField(
                        controller: _prices[tier],
                        keyboardType: const TextInputType.numberWithOptions(
                          decimal: true,
                        ),
                        inputFormatters: [
                          FilteringTextInputFormatter.allow(
                            RegExp(r'^\d*\.?\d{0,2}'),
                          ),
                        ],
                        validator: _priceValidator,
                        decoration: InputDecoration(
                          labelText: '${tier.label} price *',
                          prefixText: 'INR ',
                        ),
                      ),
                    ),
                  ),
                if (editing)
                  FutureBuilder<List<ProductPrice>>(
                    future: _history,
                    builder: (context, snapshot) {
                      if (snapshot.connectionState != ConnectionState.done) {
                        return const LinearProgressIndicator();
                      }
                      if (snapshot.hasError) {
                        return const Text('Price history could not be loaded.');
                      }
                      return _PriceHistory(history: snapshot.data ?? const []);
                    },
                  ),
                const SizedBox(height: 18),
                Align(
                  alignment: Alignment.centerRight,
                  child: FilledButton.icon(
                    onPressed: _saving ? null : _save,
                    icon: _saving
                        ? const SizedBox.square(
                            dimension: 16,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.save_outlined),
                    label: Text(_saving ? 'Saving...' : 'Save product'),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _field(
    TextEditingController controller,
    String label, {
    required double width,
    bool required = false,
  }) => SizedBox(
    width: width,
    child: TextFormField(
      controller: controller,
      decoration: InputDecoration(labelText: label),
      validator: required
          ? (value) =>
                value == null || value.trim().isEmpty ? 'Required.' : null
          : null,
    ),
  );

  Future<void> _showHistory() async {
    final rows = await _history;
    if (!mounted) return;
    await showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Recent price changes'),
        content: SizedBox(width: 520, child: _PriceHistory(history: rows)),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Close'),
          ),
        ],
      ),
    );
  }
}

class _PriceHistory extends StatelessWidget {
  const _PriceHistory({required this.history});

  final List<ProductPrice> history;

  @override
  Widget build(BuildContext context) {
    return ExpansionTile(
      tilePadding: EdgeInsets.zero,
      title: const Text('Recent changes (up to 5 per tier)'),
      children: [
        for (final tier in PriceTier.values)
          ExpansionTile(
            tilePadding: EdgeInsets.zero,
            title: Text(tier.label),
            children: [
              for (final entry in history.where((row) => row.tier == tier))
                ListTile(
                  dense: true,
                  title: Text('INR ${_formatRupees(entry.pricePaise)}'),
                  subtitle: Text(
                    'Valid ${_shortDate(entry.validFrom)}  |  '
                    'Saved ${_shortDate(entry.createdAt)}',
                  ),
                ),
              if (!history.any((row) => row.tier == tier))
                const ListTile(
                  dense: true,
                  title: Text('No saved price changes'),
                ),
            ],
          ),
      ],
    );
  }
}

String _formatRupees(int paise) =>
    '${paise ~/ 100}.${(paise % 100).toString().padLeft(2, '0')}';

String _shortDate(DateTime date) =>
    '${date.day.toString().padLeft(2, '0')}/'
    '${date.month.toString().padLeft(2, '0')}/${date.year}';
