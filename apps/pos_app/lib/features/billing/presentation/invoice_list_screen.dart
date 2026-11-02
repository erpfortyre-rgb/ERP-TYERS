import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/providers.dart';
import '../data/offline_billing_repository.dart';
import '../domain/invoice_calculator.dart';
import 'invoice_print_service.dart';

class InvoiceListScreen extends ConsumerStatefulWidget {
  const InvoiceListScreen({super.key});
  @override
  ConsumerState<InvoiceListScreen> createState() => _InvoiceListScreenState();
}

class _InvoiceListScreenState extends ConsumerState<InvoiceListScreen> {
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
            Center(child: Text('Invoice history is unavailable: $error')),
        data: (database) {
          final repository = ref.watch(billingRepositoryProvider(database));
          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Padding(
                padding: const EdgeInsets.all(18),
                child: SizedBox(
                  width: 420,
                  child: TextField(
                    controller: _search,
                    onChanged: (_) => setState(() => _revision++),
                    decoration: const InputDecoration(
                      prefixIcon: Icon(Icons.search),
                      labelText: 'Search invoice number or customer',
                    ),
                  ),
                ),
              ),
              Expanded(
                child: FutureBuilder<List<InvoiceListEntry>>(
                  key: ValueKey('invoice-history-$_revision'),
                  future: Future.value(repository.searchInvoices(_search.text)),
                  builder: (context, snapshot) {
                    if (snapshot.hasError) {
                      return Center(
                        child: Text(
                          'Could not load invoices: ${snapshot.error}',
                        ),
                      );
                    }
                    if (!snapshot.hasData) {
                      return const Center(child: CircularProgressIndicator());
                    }
                    if (snapshot.data!.isEmpty) {
                      return const Center(
                        child: Text('No saved invoices yet.'),
                      );
                    }
                    return SingleChildScrollView(
                      child: SizedBox(
                        width: double.infinity,
                        child: DataTable(
                          columns: const [
                            DataColumn(label: Text('INVOICE')),
                            DataColumn(label: Text('DATE')),
                            DataColumn(label: Text('CUSTOMER')),
                            DataColumn(label: Text('STATUS')),
                            DataColumn(label: Text('TOTAL')),
                            DataColumn(label: Text('')),
                          ],
                          rows: [
                            for (final entry in snapshot.data!)
                              DataRow(
                                cells: [
                                  DataCell(
                                    Text(entry.invoiceNumber),
                                    onTap: () => _showDetails(
                                      context,
                                      repository,
                                      entry.id,
                                    ),
                                  ),
                                  DataCell(
                                    Text(
                                      entry.invoiceDate
                                          .toLocal()
                                          .toString()
                                          .split(' ')
                                          .first,
                                    ),
                                  ),
                                  DataCell(
                                    Text(entry.customerName ?? 'Walk-in'),
                                  ),
                                  DataCell(Text(entry.state)),
                                  DataCell(Text(formatMoney(entry.totalPaise))),
                                  DataCell(
                                    IconButton(
                                      tooltip: 'View invoice',
                                      onPressed: () => _showDetails(
                                        context,
                                        repository,
                                        entry.id,
                                      ),
                                      icon: const Icon(Icons.open_in_new),
                                    ),
                                  ),
                                ],
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

  Future<void> _showDetails(
    BuildContext context,
    OfflineBillingRepository repository,
    String id,
  ) async {
    final invoice = repository.loadInvoice(id);
    if (invoice == null || !mounted) return;
    await showDialog<void>(
      context: context,
      builder: (_) => AlertDialog(
        title: Text('Invoice ${invoice.invoiceNumber}'),
        content: SizedBox(
          width: 560,
          child: ListView(
            shrinkWrap: true,
            children: [
              Text('Date: ${invoice.invoiceDate.toLocal()}'),
              Text('Customer: ${invoice.customerName ?? 'Walk-in'}'),
              Text('Transaction status: ${invoice.state}'),
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
                  '${payment.method.name.toUpperCase()}: ${formatMoney(payment.amountPaise)}${payment.method == PaymentMethod.upi || payment.method == PaymentMethod.card ? ' (recorded, unverified)' : ''}',
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
      ),
    );
  }
}
