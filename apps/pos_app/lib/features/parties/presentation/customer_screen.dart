import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/providers.dart';
import '../../../core/theme/app_colors.dart';
import '../data/customer_ledger_repository.dart';

class CustomerScreen extends ConsumerStatefulWidget {
  const CustomerScreen({super.key});

  @override
  ConsumerState<CustomerScreen> createState() => _CustomerScreenState();
}

class _CustomerScreenState extends ConsumerState<CustomerScreen> {
  final _search = TextEditingController();
  String? _customerId;
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
            Center(child: Text('Customer ledger unavailable: $error')),
        data: (database) {
          final repository = CustomerLedgerRepository(database);
          final customers = repository.searchCustomers(_search.text);
          final customer = customers.where((item) => item.id == _customerId);
          final selected = customer.isNotEmpty
              ? customer.first
              : customers.isEmpty
              ? null
              : customers.first;
          final invoices = selected == null
              ? const <CustomerLedgerInvoice>[]
              : repository.invoices(selected.id);
          final unsettled = invoices.fold<int>(
            0,
            (sum, invoice) => sum + invoice.balanceNotConfirmedPaise,
          );
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
                      width: 340,
                      child: TextField(
                        controller: _search,
                        decoration: const InputDecoration(
                          prefixIcon: Icon(Icons.search),
                          labelText: 'Search customer, phone, GSTIN',
                          isDense: true,
                        ),
                        onChanged: (_) => setState(() {
                          _customerId = null;
                          _revision++;
                        }),
                      ),
                    ),
                    if (customers.isNotEmpty)
                      SizedBox(
                        width: 320,
                        child: DropdownButtonFormField<String>(
                          key: ValueKey('customer-$selected'),
                          initialValue: selected?.id,
                          decoration: const InputDecoration(
                            labelText: 'Customer',
                            isDense: true,
                          ),
                          items: customers
                              .map(
                                (item) => DropdownMenuItem(
                                  value: item.id,
                                  child: Text(
                                    item.name,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                              )
                              .toList(),
                          onChanged: (value) =>
                              setState(() => _customerId = value),
                        ),
                      ),
                    if (selected != null)
                      Chip(
                        label: Text(
                          'Balance not confirmed ${_money(unsettled)}',
                        ),
                      ),
                  ],
                ),
              ),
              const Padding(
                padding: EdgeInsets.fromLTRB(16, 0, 16, 12),
                child: Text(
                  'Cash allocations are shown as recorded. UPI/card amounts remain unverified and are not treated as settled bank receipts.',
                  style: TextStyle(color: AppColors.textMuted),
                ),
              ),
              Expanded(
                child: selected == null
                    ? const Center(child: Text('No customers found.'))
                    : invoices.isEmpty
                    ? const Center(
                        child: Text('No finalized invoices for this customer.'),
                      )
                    : SingleChildScrollView(
                        key: ValueKey(_revision),
                        padding: const EdgeInsets.all(16),
                        scrollDirection: Axis.horizontal,
                        child: DataTable(
                          columns: const [
                            DataColumn(label: Text('Invoice')),
                            DataColumn(label: Text('Date')),
                            DataColumn(label: Text('Total')),
                            DataColumn(label: Text('Cash recorded')),
                            DataColumn(label: Text('UPI/card unverified')),
                            DataColumn(label: Text('Credit')),
                            DataColumn(label: Text('Balance not confirmed')),
                          ],
                          rows: invoices.map((invoice) {
                            return DataRow(
                              cells: [
                                DataCell(Text(invoice.invoiceNumber)),
                                DataCell(Text(_date(invoice.date))),
                                DataCell(Text(_money(invoice.totalPaise))),
                                DataCell(
                                  Text(_money(invoice.cashRecordedPaise)),
                                ),
                                DataCell(
                                  Text(_money(invoice.digitalUnverifiedPaise)),
                                ),
                                DataCell(Text(_money(invoice.creditPaise))),
                                DataCell(
                                  Text(
                                    _money(invoice.balanceNotConfirmedPaise),
                                  ),
                                ),
                              ],
                            );
                          }).toList(),
                        ),
                      ),
              ),
            ],
          );
        },
      );

  static String _money(int paise) => '₹${(paise / 100).toStringAsFixed(2)}';
  static String _date(DateTime value) =>
      '${value.day.toString().padLeft(2, '0')}/${value.month.toString().padLeft(2, '0')}/${value.year}';
}
