import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/providers.dart';
import '../data/supplier_repository.dart';
import '../domain/supplier.dart';

class SupplierScreen extends ConsumerStatefulWidget {
  const SupplierScreen({super.key});

  @override
  ConsumerState<SupplierScreen> createState() => _SupplierScreenState();
}

class _SupplierScreenState extends ConsumerState<SupplierScreen> {
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
            Center(child: Text('Suppliers unavailable: $error')),
        data: (database) {
          final repository = SupplierRepository(database);
          final suppliers = repository.search(query: _search.text);
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
                      width: 360,
                      child: TextField(
                        controller: _search,
                        decoration: const InputDecoration(
                          prefixIcon: Icon(Icons.search),
                          labelText: 'Search supplier, code, or phone',
                          isDense: true,
                        ),
                        onChanged: (_) => setState(() => _revision++),
                      ),
                    ),
                    FilledButton.icon(
                      onPressed: () => _openForm(repository),
                      icon: const Icon(Icons.person_add_alt_1),
                      label: const Text('Add supplier'),
                    ),
                  ],
                ),
              ),
              Expanded(
                child: suppliers.isEmpty
                    ? const Center(
                        child: Text(
                          'No suppliers found. Add a supplier to begin.',
                        ),
                      )
                    : ListView.separated(
                        key: ValueKey(_revision),
                        padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                        itemCount: suppliers.length,
                        separatorBuilder: (_, _) => const SizedBox(height: 8),
                        itemBuilder: (context, index) {
                          final supplier = suppliers[index];
                          return Card(
                            child: ListTile(
                              leading: CircleAvatar(
                                child: Text(
                                  supplier.businessName.isEmpty
                                      ? '?'
                                      : supplier.businessName[0].toUpperCase(),
                                ),
                              ),
                              title: Text(supplier.businessName),
                              subtitle: Text(
                                [
                                  'Code: ${supplier.code}',
                                  if (supplier.phone != null)
                                    'Phone: ${supplier.phone}',
                                  if (supplier.gstin != null)
                                    'GSTIN: ${supplier.gstin}',
                                  if (!supplier.isActive) 'Inactive',
                                ].join('  ·  '),
                              ),
                              trailing: IconButton(
                                tooltip: 'Edit supplier',
                                icon: const Icon(Icons.edit_outlined),
                                onPressed: () =>
                                    _openForm(repository, supplier),
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

  Future<void> _openForm(
    SupplierRepository repository, [
    SupplierRecord? supplier,
  ]) async {
    final draft = await showDialog<SupplierDraft>(
      context: context,
      builder: (_) => _SupplierFormDialog(supplier: supplier),
    );
    if (draft == null || !mounted) return;
    try {
      repository.save(draft);
      setState(() => _revision++);
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Supplier saved locally.')));
    } catch (error) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Supplier was not saved: $error')));
    }
  }
}

class _SupplierFormDialog extends StatefulWidget {
  const _SupplierFormDialog({required this.supplier});

  final SupplierRecord? supplier;

  @override
  State<_SupplierFormDialog> createState() => _SupplierFormDialogState();
}

class _SupplierFormDialogState extends State<_SupplierFormDialog> {
  final _formKey = GlobalKey<FormState>();
  late final Map<String, TextEditingController> _fields;
  bool _active = true;

  @override
  void initState() {
    super.initState();
    final supplier = widget.supplier;
    _fields = {
      'code': TextEditingController(text: supplier?.code ?? ''),
      'name': TextEditingController(text: supplier?.businessName ?? ''),
      'contact': TextEditingController(text: supplier?.contactPerson ?? ''),
      'phone': TextEditingController(text: supplier?.phone ?? ''),
      'email': TextEditingController(text: supplier?.email ?? ''),
      'gstin': TextEditingController(text: supplier?.gstin ?? ''),
      'address': TextEditingController(text: supplier?.billingAddress ?? ''),
      'state': TextEditingController(text: supplier?.state ?? ''),
    };
    _active = supplier?.isActive ?? true;
  }

  @override
  void dispose() {
    for (final field in _fields.values) {
      field.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
    title: Text(widget.supplier == null ? 'Add supplier' : 'Edit supplier'),
    content: SizedBox(
      width: 640,
      child: Form(
        key: _formKey,
        child: SingleChildScrollView(
          child: Wrap(
            spacing: 12,
            runSpacing: 4,
            children: [
              _field('code', 'Supplier code', required: true),
              _field('name', 'Business name', required: true),
              _field('contact', 'Contact person'),
              _field('phone', 'Phone', keyboardType: TextInputType.phone),
              _field(
                'email',
                'Email',
                keyboardType: TextInputType.emailAddress,
              ),
              _field('gstin', 'GSTIN'),
              _field('state', 'State'),
              _field('address', 'Billing address', width: 610, lines: 2),
              SizedBox(
                width: 610,
                child: SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('Active supplier'),
                  value: _active,
                  onChanged: (value) => setState(() => _active = value),
                ),
              ),
            ],
          ),
        ),
      ),
    ),
    actions: [
      TextButton(
        onPressed: () => Navigator.pop(context),
        child: const Text('Cancel'),
      ),
      FilledButton(
        onPressed: () {
          if (!_formKey.currentState!.validate()) return;
          String? value(String key) => _fields[key]!.text;
          Navigator.pop(
            context,
            SupplierDraft(
              id: widget.supplier?.id,
              code: value('code')!,
              businessName: value('name')!,
              contactPerson: value('contact'),
              phone: value('phone'),
              email: value('email'),
              gstin: value('gstin'),
              billingAddress: value('address'),
              state: value('state'),
              isActive: _active,
            ),
          );
        },
        child: const Text('Save'),
      ),
    ],
  );

  Widget _field(
    String key,
    String label, {
    bool required = false,
    TextInputType? keyboardType,
    int lines = 1,
    double width = 300,
  }) => SizedBox(
    width: width,
    child: TextFormField(
      controller: _fields[key],
      keyboardType: keyboardType,
      maxLines: lines,
      decoration: InputDecoration(labelText: label, isDense: true),
      validator: required
          ? (value) => value == null || value.trim().isEmpty
                ? '$label is required.'
                : null
          : null,
    ),
  );
}
