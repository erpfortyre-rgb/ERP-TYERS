import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/providers.dart';
import '../../../core/theme/app_colors.dart';
import '../../../database/app_database.dart';
import '../data/items_repository_impl.dart';
import '../data/kits_repository.dart';
import '../domain/item.dart';
import '../domain/kit.dart';

class KitsScreen extends ConsumerStatefulWidget {
  const KitsScreen({super.key});

  @override
  ConsumerState<KitsScreen> createState() => _KitsScreenState();
}

class _KitsScreenState extends ConsumerState<KitsScreen> {
  int _revision = 0;

  @override
  Widget build(BuildContext context) => ref
      .watch(databaseProvider)
      .when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => Center(child: Text('Kits unavailable: $error')),
        data: (database) {
          final repository = KitsRepository(database);
          final kits = repository.list(activeOnly: false);
          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Padding(
                padding: const EdgeInsets.all(16),
                child: Row(
                  children: [
                    const Expanded(
                      child: Text(
                        'Tyre kits / bill of materials',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                    FilledButton.icon(
                      onPressed: () => _editKit(database),
                      icon: const Icon(Icons.add),
                      label: const Text('Create kit'),
                    ),
                  ],
                ),
              ),
              Expanded(
                child: kits.isEmpty
                    ? const Center(
                        child: Text(
                          'No kits configured. Create a kit from products.',
                        ),
                      )
                    : ListView.builder(
                        key: ValueKey(_revision),
                        padding: const EdgeInsets.symmetric(horizontal: 16),
                        itemCount: kits.length,
                        itemBuilder: (context, index) {
                          final kit = kits[index];
                          return Card(
                            child: ListTile(
                              title: Text(kit.name),
                              subtitle: Text(
                                '${kit.isActive ? 'Active' : 'Inactive'} · '
                                '${kit.components.map((row) => '${row.productName} × ${_quantity(row.quantityMilli)} · ${row.tier.label}').join(' | ')}',
                              ),
                              trailing: IconButton(
                                tooltip: 'Edit kit',
                                onPressed: () => _editKit(database, kit),
                                icon: const Icon(Icons.edit_outlined),
                              ),
                            ),
                          );
                        },
                      ),
              ),
              const Padding(
                padding: EdgeInsets.all(16),
                child: Text(
                  'Kits expand to component invoice lines. Stock is checked and deducted only when the sale is finalized.',
                  style: TextStyle(color: AppColors.textMuted),
                ),
              ),
            ],
          );
        },
      );

  Future<void> _editKit(AppDatabase database, [TyreKit? initial]) async {
    final saved = await showDialog<bool>(
      context: context,
      builder: (_) => _KitEditor(database: database, initial: initial),
    );
    if (saved == true && mounted) setState(() => _revision++);
  }
}

class _KitEditor extends StatefulWidget {
  const _KitEditor({required this.database, this.initial});
  final AppDatabase database;
  final TyreKit? initial;

  @override
  State<_KitEditor> createState() => _KitEditorState();
}

class _KitEditorState extends State<_KitEditor> {
  late final TextEditingController _name;
  late final List<TyreKitDraftComponent> _components;
  bool _active = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _name = TextEditingController(text: widget.initial?.name ?? '');
    _components = [
      for (final component in widget.initial?.components ?? const [])
        TyreKitDraftComponent(
          productId: component.productId,
          quantityMilli: component.quantityMilli,
          tier: component.tier,
        ),
    ];
    _active = widget.initial?.isActive ?? true;
  }

  @override
  void dispose() {
    _name.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
    title: Text(widget.initial == null ? 'Create tyre kit' : 'Edit tyre kit'),
    content: SizedBox(
      width: 650,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          TextField(
            controller: _name,
            autofocus: true,
            decoration: const InputDecoration(labelText: 'Kit name'),
          ),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Active'),
            value: _active,
            onChanged: (value) => setState(() => _active = value),
          ),
          const Divider(),
          Row(
            children: [
              const Expanded(child: Text('Components')),
              TextButton.icon(
                onPressed: _chooseProduct,
                icon: const Icon(Icons.add),
                label: const Text('Add product'),
              ),
            ],
          ),
          Flexible(
            child: _components.isEmpty
                ? const Center(child: Text('Add one or more products.'))
                : ListView(
                    shrinkWrap: true,
                    children: [
                      for (final component in _components)
                        FutureBuilder<Product?>(
                          future: _product(component.productId),
                          builder: (context, snapshot) {
                            final available = KitsRepository(widget.database)
                                .availableStockMilli(component.productId);
                            return ListTile(
                              dense: true,
                              onTap: snapshot.data == null
                                  ? null
                                  : () => _editComponent(
                                      component,
                                      snapshot.data!,
                                    ),
                              title: Text(
                                snapshot.data?.name ?? 'Loading product',
                              ),
                              subtitle: Text(
                                '${_quantity(component.quantityMilli)} units · ${component.tier.label} · Available now ${_quantity(available)}',
                              ),
                              trailing: IconButton(
                                tooltip: 'Remove component',
                                onPressed: () => setState(
                                  () => _components.remove(component),
                                ),
                                icon: const Icon(Icons.close),
                              ),
                            );
                          },
                        ),
                    ],
                  ),
          ),
          if (_error != null)
            Text(_error!, style: const TextStyle(color: AppColors.error)),
        ],
      ),
    ),
    actions: [
      TextButton(
        onPressed: () => Navigator.pop(context, false),
        child: const Text('Cancel'),
      ),
      FilledButton(onPressed: _save, child: const Text('Save kit')),
    ],
  );

  Future<Product?> _product(String id) =>
      ItemsRepositoryImpl(widget.database).getProduct(id);

  Future<void> _chooseProduct() async {
    final items = ItemsRepositoryImpl(widget.database);
    final products = await items.searchProducts(activeOnly: true);
    if (!mounted) return;
    final selected = await showDialog<Product>(
      context: context,
      builder: (context) => _ComponentProductPicker(products: products),
    );
    if (selected == null || !mounted) return;
    if (_components.any((component) => component.productId == selected.id)) {
      setState(
        () => _error = 'Product already added. Edit its quantity instead.',
      );
      return;
    }
    final component = await showDialog<TyreKitDraftComponent>(
      context: context,
      builder: (_) => _KitComponentEditor(
        product: selected,
        prices: items.currentPrices(selected.id),
      ),
    );
    if (component != null && mounted) {
      setState(() {
        _error = null;
        _components.add(component);
      });
    }
  }

  Future<void> _editComponent(
    TyreKitDraftComponent existing,
    Product product,
  ) async {
    final updated = await showDialog<TyreKitDraftComponent>(
      context: context,
      builder: (_) => _KitComponentEditor(
        product: product,
        prices: ItemsRepositoryImpl(widget.database).currentPrices(product.id),
        initial: existing,
      ),
    );
    if (updated == null || !mounted) return;
    final index = _components.indexOf(existing);
    if (index >= 0) {
      setState(() => _components[index] = updated);
    }
  }

  void _save() {
    try {
      KitsRepository(widget.database).save(
        id: widget.initial?.id,
        name: _name.text,
        isActive: _active,
        components: _components,
      );
      Navigator.pop(context, true);
    } catch (error) {
      setState(() => _error = '$error');
    }
  }
}

class _ComponentProductPicker extends StatefulWidget {
  const _ComponentProductPicker({required this.products});

  final List<Product> products;

  @override
  State<_ComponentProductPicker> createState() =>
      _ComponentProductPickerState();
}

class _ComponentProductPickerState extends State<_ComponentProductPicker> {
  final _search = TextEditingController();

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final query = _search.text.trim().toLowerCase();
    final products = widget.products
        .where(
          (product) =>
              product.name.toLowerCase().contains(query) ||
              product.sku.toLowerCase().contains(query) ||
              (product.barcode?.toLowerCase().contains(query) ?? false),
        )
        .toList(growable: false);
    return AlertDialog(
      title: const Text('Choose a component product'),
      content: SizedBox(
        width: 480,
        height: 420,
        child: Column(
          children: [
            TextField(
              controller: _search,
              decoration: const InputDecoration(
                prefixIcon: Icon(Icons.search),
                labelText: 'Search active products',
                hintText: 'Name, SKU, or barcode',
                isDense: true,
              ),
              onChanged: (_) => setState(() {}),
            ),
            const SizedBox(height: 8),
            Expanded(
              child: widget.products.isEmpty
                  ? const Center(
                      child: Text(
                        'No active products found. Add or activate a product in Items first.',
                        textAlign: TextAlign.center,
                      ),
                    )
                  : products.isEmpty
                  ? const Center(child: Text('No products match this search.'))
                  : ListView.separated(
                      itemCount: products.length,
                      separatorBuilder: (_, _) => const Divider(height: 1),
                      itemBuilder: (context, index) {
                        final product = products[index];
                        return ListTile(
                          leading: const Icon(Icons.tire_repair),
                          title: Text(
                            product.name,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          subtitle: Text(
                            '${product.sku}${product.barcode == null ? '' : ' · ${product.barcode}'}',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          trailing: const Icon(Icons.chevron_right),
                          onTap: () => Navigator.pop(context, product),
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
      ],
    );
  }
}

class _KitComponentEditor extends StatefulWidget {
  const _KitComponentEditor({
    required this.product,
    required this.prices,
    this.initial,
  });
  final Product product;
  final Future<Map<PriceTier, int>> prices;
  final TyreKitDraftComponent? initial;

  @override
  State<_KitComponentEditor> createState() => _KitComponentEditorState();
}

class _KitComponentEditorState extends State<_KitComponentEditor> {
  late final TextEditingController _quantity;
  late PriceTier _tier;

  @override
  void initState() {
    super.initState();
    _quantity = TextEditingController(
      text: widget.initial == null
          ? '1'
          : _quantityString(widget.initial!.quantityMilli),
    );
    _tier = widget.initial?.tier ?? PriceTier.mrp;
  }

  @override
  void dispose() {
    _quantity.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => FutureBuilder<Map<PriceTier, int>>(
    future: widget.prices,
    builder: (context, snapshot) {
      final prices = snapshot.data;
      final availableTiers = prices == null
          ? const <PriceTier>[]
          : PriceTier.values.where((tier) => prices[tier] != null).toList();
      final selectedTier = availableTiers.contains(_tier)
          ? _tier
          : availableTiers.firstOrNull;

      return AlertDialog(
        title: Text('Add ${widget.product.name}'),
        content: snapshot.hasError
            ? Text('Could not load product prices: ${snapshot.error}')
            : !snapshot.hasData
            ? const SizedBox(
                height: 80,
                child: Center(child: CircularProgressIndicator()),
              )
            : availableTiers.isEmpty
            ? const Text(
                'This product has no currently effective selling price. '
                'Open Items, set a price with an effective date that has '
                'already started, then try again.',
              )
            : Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  TextField(
                    controller: _quantity,
                    keyboardType: const TextInputType.numberWithOptions(
                      decimal: true,
                    ),
                    decoration: const InputDecoration(
                      labelText: 'Quantity',
                      helperText: 'Use a positive quantity, up to 3 decimals.',
                    ),
                  ),
                  DropdownButtonFormField<PriceTier>(
                    initialValue: selectedTier,
                    decoration: const InputDecoration(
                      labelText: 'Component rate tier',
                    ),
                    items: availableTiers
                        .map(
                          (tier) => DropdownMenuItem(
                            value: tier,
                            child: Text(
                              '${tier.label} · ₹${(prices![tier]! / 100).toStringAsFixed(2)}',
                            ),
                          ),
                        )
                        .toList(),
                    onChanged: (value) {
                      if (value != null) setState(() => _tier = value);
                    },
                  ),
                ],
              ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: snapshot.hasData && selectedTier != null
                ? () {
                    final text = _quantity.text.trim();
                    if (!RegExp(r'^\d+(?:\.\d{1,3})?$').hasMatch(text)) {
                      _showValidation(
                        context,
                        'Enter a positive quantity with up to 3 decimals.',
                      );
                      return;
                    }
                    final quantity = double.tryParse(text);
                    if (quantity == null ||
                        !quantity.isFinite ||
                        quantity <= 0) {
                      _showValidation(
                        context,
                        'Quantity must be greater than zero.',
                      );
                      return;
                    }
                    Navigator.pop(
                      context,
                      TyreKitDraftComponent(
                        productId: widget.product.id,
                        quantityMilli: (quantity * 1000).round(),
                        tier: selectedTier,
                      ),
                    );
                  }
                : null,
            child: const Text('Add component'),
          ),
        ],
      );
    },
  );

  void _showValidation(BuildContext context, String message) {
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text(message)));
  }
}

String _quantity(int milli) =>
    '${milli ~/ 1000}.${(milli % 1000).toString().padLeft(3, '0')}';
String _quantityString(int milli) =>
    milli % 1000 == 0 ? '${milli ~/ 1000}' : _quantity(milli);
