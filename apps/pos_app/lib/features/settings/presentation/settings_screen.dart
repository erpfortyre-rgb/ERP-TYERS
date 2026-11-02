import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/providers.dart';
import '../../../database/app_database.dart';
import '../../billing/data/offline_billing_repository.dart';
import '../../items/data/items_repository_impl.dart';
import '../../items/domain/item.dart';

class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) => ref
      .watch(databaseProvider)
      .when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => Center(
          child: Text(
            'Encrypted local database could not be opened.\n$error',
            textAlign: TextAlign.center,
          ),
        ),
        data: (database) => _SettingsContent(database: database),
      );
}

class _SettingsContent extends StatefulWidget {
  const _SettingsContent({required this.database});
  final AppDatabase database;
  @override
  State<_SettingsContent> createState() => _SettingsContentState();
}

class _SettingsContentState extends State<_SettingsContent> {
  late DatabaseDiagnostics _diagnostics;
  late DeviceInvoiceConfig _config;
  late List<BranchChoice> _branches;
  OfflineBillingRepository get _billing =>
      OfflineBillingRepository(widget.database);

  @override
  void initState() {
    super.initState();
    _refreshValues();
  }

  void _refreshValues() {
    _diagnostics = widget.database.diagnostics();
    _config = _billing.configuration();
    _branches = _billing.branches();
  }

  void _refresh() => setState(_refreshValues);

  @override
  Widget build(BuildContext context) => ListView(
    padding: const EdgeInsets.all(24),
    children: [
      Text('Settings', style: Theme.of(context).textTheme.headlineSmall),
      const SizedBox(height: 18),
      Text(
        'Invoice and inventory setup',
        style: Theme.of(context).textTheme.titleLarge,
      ),
      const SizedBox(height: 8),
      Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Device invoice prefix: ${_config.prefix ?? 'Not assigned'}',
              ),
              const SizedBox(height: 8),
              if (_config.prefix == null)
                OutlinedButton.icon(
                  onPressed: _assignPrefix,
                  icon: const Icon(Icons.pin_outlined),
                  label: const Text('Assign client-approved prefix'),
                )
              else
                const Text('This prefix is immutable after assignment.'),
              const Divider(height: 24),
              Wrap(
                spacing: 12,
                runSpacing: 8,
                crossAxisAlignment: WrapCrossAlignment.center,
                children: [
                  SizedBox(
                    width: 250,
                    child: DropdownButtonFormField<String>(
                      initialValue:
                          _branches.any(
                            (branch) => branch.id == _config.branchId,
                          )
                          ? _config.branchId
                          : null,
                      decoration: const InputDecoration(
                        labelText: 'Default invoice branch',
                      ),
                      items: _branches
                          .map(
                            (branch) => DropdownMenuItem(
                              value: branch.id,
                              child: Text(branch.name),
                            ),
                          )
                          .toList(),
                      onChanged: (id) {
                        if (id != null) {
                          _billing.setDefaultBranch(id);
                          _refresh();
                        }
                      },
                    ),
                  ),
                  OutlinedButton.icon(
                    onPressed: _createBranch,
                    icon: const Icon(Icons.add_business_outlined),
                    label: const Text('Add branch'),
                  ),
                  OutlinedButton.icon(
                    onPressed: _addOpeningStock,
                    icon: const Icon(Icons.inventory_outlined),
                    label: const Text('Add opening stock'),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              const Text(
                'Finalizing a sale requires approved product tax rates, a device prefix, a branch, and sufficient recorded stock.',
                style: TextStyle(fontSize: 12),
              ),
            ],
          ),
        ),
      ),
      const SizedBox(height: 22),
      Text('Local database', style: Theme.of(context).textTheme.titleLarge),
      const SizedBox(height: 8),
      const Text(
        'Encrypted offline storage. The database key is protected by the platform secure store and is never displayed.',
      ),
      const SizedBox(height: 12),
      Card(
        child: Column(
          children: [
            _DiagnosticRow(
              label: 'Initialized',
              value: _diagnostics.initialized ? 'Yes' : 'No',
            ),
            _DiagnosticRow(
              label: 'Encryption verified',
              value: _diagnostics.encryptionVerified ? 'Yes' : 'No',
            ),
            _DiagnosticRow(
              label: 'Cipher runtime',
              value: _diagnostics.cipherVersion,
            ),
            _DiagnosticRow(
              label: 'Schema version',
              value: '${_diagnostics.schemaVersion}',
            ),
            _DiagnosticRow(
              label: 'Database health',
              value: _diagnostics.health,
            ),
            _DiagnosticRow(
              label: 'Foreign keys',
              value: _diagnostics.foreignKeysEnabled ? 'Enabled' : 'Disabled',
            ),
            _DiagnosticRow(
              label: 'Products stored',
              value: '${_diagnostics.productCount}',
            ),
            _DiagnosticRow(
              label: 'Pending local events',
              value: '${_billing.pendingOutboxCount()}',
            ),
            _DiagnosticRow(
              label: 'Last checked',
              value: _diagnostics.lastCheckedAt.toLocal().toString(),
            ),
          ],
        ),
      ),
      const SizedBox(height: 12),
      Align(
        alignment: Alignment.centerLeft,
        child: OutlinedButton.icon(
          onPressed: _refresh,
          icon: const Icon(Icons.refresh),
          label: const Text('Refresh diagnostics'),
        ),
      ),
    ],
  );

  Future<void> _assignPrefix() async {
    final controller = TextEditingController();
    final value = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Assign device invoice prefix'),
        content: TextField(
          controller: controller,
          autofocus: true,
          textCapitalization: TextCapitalization.characters,
          maxLength: 5,
          decoration: const InputDecoration(
            labelText: 'Client-approved prefix',
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, controller.text),
            child: const Text('Assign once'),
          ),
        ],
      ),
    );
    controller.dispose();
    if (value == null || !mounted) return;
    try {
      _billing.assignInvoicePrefix(value);
      _refresh();
    } catch (error) {
      _showError(error);
    }
  }

  Future<void> _createBranch() async {
    final controller = TextEditingController();
    final value = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Add branch'),
        content: TextField(
          controller: controller,
          autofocus: true,
          decoration: const InputDecoration(labelText: 'Branch name'),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, controller.text),
            child: const Text('Add branch'),
          ),
        ],
      ),
    );
    controller.dispose();
    if (value == null || !mounted) return;
    try {
      _billing.createBranch(value);
      _refresh();
    } catch (error) {
      _showError(error);
    }
  }

  Future<void> _addOpeningStock() async {
    if (_config.branchId == null) {
      _showError('Create a branch before recording opening stock.');
      return;
    }
    final result = await showDialog<bool>(
      context: context,
      builder: (_) => _OpeningStockDialog(database: widget.database),
    );
    if (result == true && mounted) _refresh();
  }

  void _showError(Object error) =>
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text('$error')));
}

class _OpeningStockDialog extends StatefulWidget {
  const _OpeningStockDialog({required this.database});
  final AppDatabase database;
  @override
  State<_OpeningStockDialog> createState() => _OpeningStockDialogState();
}

class _OpeningStockDialogState extends State<_OpeningStockDialog> {
  final _quantity = TextEditingController();
  late final Future<List<Product>> _products;
  String? _productId;
  @override
  void initState() {
    super.initState();
    _products = ItemsRepositoryImpl(widget.database)
        .searchProducts(activeOnly: true);
  }

  @override
  void dispose() {
    _quantity.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
    title: const Text('Record opening stock'),
    content: SizedBox(
      width: 420,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          FutureBuilder<List<Product>>(
            future: _products,
            builder: (context, snapshot) {
              if (snapshot.hasError) {
                return const Text('Products could not be loaded.');
              }
              if (!snapshot.hasData) return const LinearProgressIndicator();
              final products = snapshot.data!;
              if (_productId == null && products.isNotEmpty) {
                _productId = products.first.id;
              }
              if (products.isEmpty) {
                return const Text('Add a product before recording stock.');
              }
              return DropdownButtonFormField<String>(
                initialValue: _productId,
                decoration: const InputDecoration(labelText: 'Product'),
                items: [
                  for (final product in products)
                    DropdownMenuItem(
                      value: product.id,
                      child: Text('${product.name} (${product.sku})'),
                    ),
                ],
                onChanged: (id) => setState(() => _productId = id),
              );
            },
          ),
          TextField(
            controller: _quantity,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            decoration: const InputDecoration(labelText: 'Opening quantity'),
          ),
          const Text(
            'This appends an auditable opening-balance stock movement.',
            style: TextStyle(fontSize: 12),
          ),
        ],
      ),
    ),
    actions: [
      TextButton(
        onPressed: () => Navigator.pop(context, false),
        child: const Text('Cancel'),
      ),
      FilledButton(
        onPressed: () {
          final quantity = double.tryParse(_quantity.text.trim());
          if (_productId == null ||
              quantity == null ||
              quantity <= 0 ||
              quantity > 999999) {
            return;
          }
          try {
            OfflineBillingRepository(widget.database).addOpeningStock(
              productId: _productId!,
              quantityMilli: (quantity * 1000).round(),
            );
            Navigator.pop(context, true);
          } catch (error) {
            ScaffoldMessenger.of(context)
                .showSnackBar(SnackBar(content: Text('$error')));
          }
        },
        child: const Text('Record stock'),
      ),
    ],
  );
}

class _DiagnosticRow extends StatelessWidget {
  const _DiagnosticRow({required this.label, required this.value});
  final String label;
  final String value;
  @override
  Widget build(BuildContext context) => ListTile(
    title: Text(label),
    trailing: Text(value, textAlign: TextAlign.end),
  );
}
