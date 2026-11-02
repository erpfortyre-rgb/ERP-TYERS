import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/providers.dart';
import '../../../database/app_database.dart';
import '../domain/item.dart';
import '../domain/items_repository.dart';
import 'item_form_screen.dart';

class ItemListScreen extends ConsumerStatefulWidget {
  const ItemListScreen({super.key});

  @override
  ConsumerState<ItemListScreen> createState() => _ItemListScreenState();
}

class _ItemListScreenState extends ConsumerState<ItemListScreen> {
  final _search = TextEditingController();
  String? _category;
  bool? _activeOnly;
  int _revision = 0;

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  Future<void> _openForm(AppDatabase database, [Product? product]) async {
    final changed = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) => ProductFormScreen(database: database, product: product),
      ),
    );
    if (changed == true && mounted) setState(() => _revision++);
  }

  @override
  Widget build(BuildContext context) => FutureBuilder<AppDatabase>(
    future: ref.watch(databaseProvider.future),
    builder: (context, databaseSnapshot) {
      if (databaseSnapshot.hasError) {
        return _DatabaseError(error: databaseSnapshot.error);
      }
      if (!databaseSnapshot.hasData) {
        return const Center(child: CircularProgressIndicator());
      }
      final database = databaseSnapshot.data!;
      final repository = ref.watch(itemsRepositoryProvider(database));
      return _ItemsContent(
        repository: repository,
        query: _search.text,
        category: _category,
        activeOnly: _activeOnly,
        revision: _revision,
        onQueryChanged: (value) => setState(() => _search.text = value),
        onCategoryChanged: (value) => setState(() => _category = value),
        onActiveChanged: (value) => setState(() => _activeOnly = value),
        onAdd: () => _openForm(database),
        onEdit: (product) => _openForm(database, product),
      );
    },
  );
}

class _ItemsContent extends StatelessWidget {
  const _ItemsContent({
    required this.repository,
    required this.query,
    required this.category,
    required this.activeOnly,
    required this.revision,
    required this.onQueryChanged,
    required this.onCategoryChanged,
    required this.onActiveChanged,
    required this.onAdd,
    required this.onEdit,
  });

  final ItemsRepository repository;
  final String query;
  final String? category;
  final bool? activeOnly;
  final int revision;
  final ValueChanged<String> onQueryChanged;
  final ValueChanged<String?> onCategoryChanged;
  final ValueChanged<bool?> onActiveChanged;
  final VoidCallback onAdd;
  final ValueChanged<Product> onEdit;

  @override
  Widget build(BuildContext context) => FutureBuilder<List<String>>(
    future: repository.categories(),
    builder: (context, categoriesSnapshot) {
      final categories = categoriesSnapshot.data ?? const <String>[];
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 18, 20, 12),
            child: Wrap(
              spacing: 12,
              runSpacing: 10,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                SizedBox(
                  width: 340,
                  child: TextField(
                    decoration: const InputDecoration(
                      prefixIcon: Icon(Icons.search),
                      hintText: 'Search name, SKU, or barcode',
                      isDense: true,
                    ),
                    onChanged: onQueryChanged,
                  ),
                ),
                SizedBox(
                  width: 190,
                  child: DropdownButtonFormField<String?>(
                    initialValue: category,
                    decoration: const InputDecoration(
                      labelText: 'Category',
                      isDense: true,
                    ),
                    items: [
                      const DropdownMenuItem<String?>(
                        value: null,
                        child: Text('All categories'),
                      ),
                      ...categories.map(
                        (value) => DropdownMenuItem<String?>(
                          value: value,
                          child: Text(value),
                        ),
                      ),
                    ],
                    onChanged: onCategoryChanged,
                  ),
                ),
                SizedBox(
                  width: 160,
                  child: DropdownButtonFormField<bool?>(
                    initialValue: activeOnly,
                    decoration: const InputDecoration(
                      labelText: 'Status',
                      isDense: true,
                    ),
                    items: const [
                      DropdownMenuItem<bool?>(
                        value: null,
                        child: Text('All status'),
                      ),
                      DropdownMenuItem<bool?>(
                        value: true,
                        child: Text('Active'),
                      ),
                      DropdownMenuItem<bool?>(
                        value: false,
                        child: Text('Inactive'),
                      ),
                    ],
                    onChanged: onActiveChanged,
                  ),
                ),
                FilledButton.icon(
                  onPressed: onAdd,
                  icon: const Icon(Icons.add),
                  label: const Text('Add product'),
                ),
              ],
            ),
          ),
          Expanded(
            child: FutureBuilder<List<Product>>(
              key: ValueKey('items-$revision-$query-$category-$activeOnly'),
              future: repository.searchProducts(
                query: query,
                category: category,
                activeOnly: activeOnly,
              ),
              builder: (context, snapshot) {
                if (snapshot.hasError) {
                  return Center(
                    child: Text(
                      'Products could not be loaded: ${snapshot.error}',
                    ),
                  );
                }
                if (!snapshot.hasData) {
                  return const Center(child: CircularProgressIndicator());
                }
                final products = snapshot.data!;
                if (products.isEmpty) {
                  return const Center(
                    child: Text(
                      'No products found. Add a product or adjust the filters.',
                    ),
                  );
                }
                return SingleChildScrollView(
                  child: SizedBox(
                    width: double.infinity,
                    child: DataTable(
                      columns: const [
                        DataColumn(label: Text('PRODUCT')),
                        DataColumn(label: Text('SKU')),
                        DataColumn(label: Text('BARCODE')),
                        DataColumn(label: Text('CATEGORY')),
                        DataColumn(label: Text('STATUS')),
                        DataColumn(label: Text('')),
                      ],
                      rows: products
                          .map(
                            (product) => DataRow(
                              cells: [
                                DataCell(
                                  Text(product.name),
                                  onTap: () => _showProductDetails(
                                    context,
                                    repository,
                                    product,
                                    onEdit,
                                  ),
                                ),
                                DataCell(Text(product.sku)),
                                DataCell(Text(product.barcode ?? '-')),
                                DataCell(Text(product.category ?? '-')),
                                DataCell(
                                  Chip(
                                    label: Text(
                                      product.isActive ? 'Active' : 'Inactive',
                                    ),
                                  ),
                                ),
                                DataCell(
                                  IconButton(
                                    tooltip: 'Edit product and prices',
                                    icon: const Icon(Icons.edit_outlined),
                                    onPressed: () => onEdit(product),
                                  ),
                                ),
                              ],
                            ),
                          )
                          .toList(growable: false),
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
}

Future<void> _showProductDetails(
  BuildContext context,
  ItemsRepository repository,
  Product product,
  ValueChanged<Product> onEdit,
) async {
  await showDialog<void>(
    context: context,
    builder: (dialogContext) => AlertDialog(
      title: Text(product.name),
      content: SizedBox(
        width: 520,
        child: ListView(
          shrinkWrap: true,
          children: [
            _detail('SKU', product.sku),
            _detail('Barcode', product.barcode ?? '-'),
            _detail('Category', product.category ?? '-'),
            _detail('Brand', product.brand ?? '-'),
            _detail('HSN', product.hsnCode ?? '-'),
            _detail('Unit', product.unit),
            _detail('Status', product.isActive ? 'Active' : 'Inactive'),
            const Divider(),
            FutureBuilder<Map<PriceTier, int>>(
              future: repository.currentPrices(product.id),
              builder: (context, snapshot) => Column(
                children: [
                  for (final tier in PriceTier.values)
                    _detail(tier.label, _money(snapshot.data?[tier])),
                ],
              ),
            ),
            const Divider(),
            FutureBuilder<List<ProductPrice>>(
              future: repository.priceHistory(product.id),
              builder: (context, snapshot) {
                if (!snapshot.hasData) return const LinearProgressIndicator();
                return ExpansionTile(
                  title: const Text('Recent price history'),
                  children: [
                    for (final price in snapshot.data!)
                      ListTile(
                        dense: true,
                        title: Text(
                          '${price.tier.label}: ${_money(price.pricePaise)}',
                        ),
                        subtitle: Text(
                          'Valid from ${price.validFrom.toLocal().toString().split(' ').first}',
                        ),
                      ),
                  ],
                );
              },
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(dialogContext).pop(),
          child: const Text('Close'),
        ),
        FilledButton.icon(
          onPressed: () {
            Navigator.of(dialogContext).pop();
            onEdit(product);
          },
          icon: const Icon(Icons.edit_outlined),
          label: const Text('Edit product'),
        ),
      ],
    ),
  );
}

Widget _detail(String label, String value) =>
    ListTile(dense: true, title: Text(label), trailing: Text(value));

String _money(int? paise) => paise == null
    ? '-'
    : 'INR ${paise ~/ 100}.${(paise % 100).toString().padLeft(2, '0')}';

class _DatabaseError extends StatelessWidget {
  const _DatabaseError({required this.error});
  final Object? error;

  @override
  Widget build(BuildContext context) => Center(
    child: ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 520),
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.lock_outline, size: 44),
            const SizedBox(height: 12),
            Text(
              'Encrypted local database is unavailable',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 8),
            Text('$error', textAlign: TextAlign.center),
            const SizedBox(height: 12),
            const Text(
              'No plaintext database was opened or created.',
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    ),
  );
}
