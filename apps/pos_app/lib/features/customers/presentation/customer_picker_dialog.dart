import 'package:flutter/material.dart';

import '../data/customers_repository.dart';
import '../domain/customer.dart';

class CustomerPickerDialog extends StatefulWidget {
  const CustomerPickerDialog({super.key, required this.repository});
  final CustomersRepository repository;

  @override
  State<CustomerPickerDialog> createState() => _CustomerPickerDialogState();
}

class _CustomerPickerDialogState extends State<CustomerPickerDialog> {
  final _search = TextEditingController();
  int _revision = 0;

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  Future<void> _create() async {
    final customer = await showDialog<Customer>(
      context: context,
      builder: (_) => _NewCustomerDialog(repository: widget.repository),
    );
    if (customer != null && mounted) Navigator.of(context).pop(customer);
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
    title: const Text('Select customer'),
    content: SizedBox(
      width: 520,
      height: 420,
      child: Column(
        children: [
          TextField(
            controller: _search,
            autofocus: true,
            decoration: const InputDecoration(
              labelText: 'Search name, phone, or GSTIN',
              prefixIcon: Icon(Icons.search),
            ),
            onChanged: (_) => setState(() => _revision++),
          ),
          const SizedBox(height: 8),
          Expanded(
            child: FutureBuilder<List<Customer>>(
              key: ValueKey(_revision),
              future: widget.repository.search(_search.text),
              builder: (context, snapshot) {
                if (snapshot.hasError) {
                  return const Center(child: Text('Customer search failed.'));
                }
                if (!snapshot.hasData) {
                  return const Center(child: CircularProgressIndicator());
                }
                if (snapshot.data!.isEmpty) {
                  return const Center(child: Text('No matching customers.'));
                }
                return ListView(
                  children: [
                    for (final customer in snapshot.data!)
                      ListTile(
                        leading: const CircleAvatar(
                          child: Icon(Icons.person_outline),
                        ),
                        title: Text(customer.name),
                        subtitle: Text(
                          [customer.phone, customer.gstin]
                              .whereType<String>()
                              .where((value) => value.isNotEmpty)
                              .join(' | '),
                        ),
                        onTap: () => Navigator.of(context).pop(customer),
                      ),
                  ],
                );
              },
            ),
          ),
          Align(
            alignment: Alignment.centerLeft,
            child: OutlinedButton.icon(
              onPressed: _create,
              icon: const Icon(Icons.person_add_alt_1),
              label: const Text('Create customer'),
            ),
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
  );
}

class _NewCustomerDialog extends StatefulWidget {
  const _NewCustomerDialog({required this.repository});
  final CustomersRepository repository;

  @override
  State<_NewCustomerDialog> createState() => _NewCustomerDialogState();
}

class _NewCustomerDialogState extends State<_NewCustomerDialog> {
  final _formKey = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _phone = TextEditingController();
  final _gstin = TextEditingController();
  final _address = TextEditingController();
  bool _saving = false;

  @override
  void dispose() {
    _name.dispose();
    _phone.dispose();
    _gstin.dispose();
    _address.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (_saving || !_formKey.currentState!.validate()) return;
    setState(() => _saving = true);
    try {
      final customer = await widget.repository.create(
        name: _name.text,
        phone: _phone.text,
        gstin: _gstin.text,
        address: _address.text,
      );
      if (mounted) Navigator.of(context).pop(customer);
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('$error')));
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
    title: const Text('New customer'),
    content: SizedBox(
      width: 420,
      child: Form(
        key: _formKey,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextFormField(
              controller: _name,
              autofocus: true,
              decoration: const InputDecoration(labelText: 'Name *'),
              validator: (value) => value == null || value.trim().isEmpty
                  ? 'Name is required.'
                  : null,
            ),
            TextFormField(
              controller: _phone,
              decoration: const InputDecoration(labelText: 'Phone'),
            ),
            TextFormField(
              controller: _gstin,
              decoration: const InputDecoration(labelText: 'GSTIN'),
            ),
            TextFormField(
              controller: _address,
              decoration: const InputDecoration(labelText: 'Address'),
            ),
            const SizedBox(height: 8),
            const Text(
              'Credit requires this customer to have a phone number or GSTIN.',
              style: TextStyle(fontSize: 12),
            ),
          ],
        ),
      ),
    ),
    actions: [
      TextButton(
        onPressed: () => Navigator.of(context).pop(),
        child: const Text('Cancel'),
      ),
      FilledButton(
        onPressed: _saving ? null : _save,
        child: Text(_saving ? 'Saving...' : 'Save customer'),
      ),
    ],
  );
}
