import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/providers.dart';
import '../../../core/theme/app_colors.dart';
import '../../../database/app_database.dart';
import '../data/finance_quotation_repository.dart';

class FinanceQuotationScreen extends ConsumerStatefulWidget {
  const FinanceQuotationScreen({super.key});
  @override
  ConsumerState<FinanceQuotationScreen> createState() =>
      _FinanceQuotationScreenState();
}

class _FinanceQuotationScreenState
    extends ConsumerState<FinanceQuotationScreen> {
  int _revision = 0;

  @override
  Widget build(BuildContext context) => ref
      .watch(databaseProvider)
      .when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) =>
            Center(child: Text('Finance quotations unavailable: $error')),
        data: (database) {
          final repository = FinanceQuotationRepository(database);
          final quotations = repository.list();
          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Padding(
                padding: const EdgeInsets.all(16),
                child: Row(
                  children: [
                    const Expanded(
                      child: Text(
                        'Vehicle finance quotations',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                    FilledButton.icon(
                      onPressed: () => _edit(database),
                      icon: const Icon(Icons.add),
                      label: const Text('New quotation'),
                    ),
                  ],
                ),
              ),
              Expanded(
                child: quotations.isEmpty
                    ? const Center(child: Text('No finance quotations saved.'))
                    : ListView.builder(
                        key: ValueKey(_revision),
                        itemCount: quotations.length,
                        itemBuilder: (context, index) {
                          final quote = quotations[index];
                          return Card(
                            margin: const EdgeInsets.fromLTRB(16, 4, 16, 4),
                            child: ListTile(
                              title: Text('${quote.vehicleNo} · ${quote.make}'),
                              subtitle: Text(
                                'Delivery ${_date(quote.approxDeliveryDate)} · ${quote.status} · Total receivable ${_money(quote.totalMoneyReceivablePaise)}',
                              ),
                              onTap: () => _details(quote),
                              trailing: quote.status == 'DRAFT'
                                  ? IconButton(
                                      tooltip: 'Edit draft',
                                      onPressed: () => _edit(database, quote),
                                      icon: const Icon(Icons.edit_outlined),
                                    )
                                  : const Icon(Icons.chevron_right),
                            ),
                          );
                        },
                      ),
              ),
              const Padding(
                padding: EdgeInsets.all(16),
                child: Text(
                  'Loan and receivable figures are explicitly entered; no interest, EMI, eligibility, approval or disbursement is calculated.',
                  style: TextStyle(color: AppColors.textMuted),
                ),
              ),
            ],
          );
        },
      );

  Future<void> _edit(AppDatabase database, [FinanceQuotation? quote]) async {
    final saved = await showDialog<bool>(
      context: context,
      builder: (_) =>
          _FinanceQuotationEditor(database: database, initial: quote),
    );
    if (saved == true && mounted) setState(() => _revision++);
  }

  void _details(FinanceQuotation quote) {
    showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('Finance quotation · ${quote.vehicleNo}'),
        content: SizedBox(
          width: 560,
          child: ListView(
            shrinkWrap: true,
            children: [
              _detail('Fitment Type', quote.fitmentType),
              _detail('Make', quote.make),
              _detail('Ply Rating', quote.plyRating),
              _detail('Field Office Name', quote.fieldOfficeName),
              _detail('Approx Delivery Date', _date(quote.approxDeliveryDate)),
              _detail('Bill Amount', _money(quote.billAmountPaise)),
              _detail('Margin Money', _money(quote.marginMoneyPaise)),
              _detail('Loan Period', '${quote.loanPeriodMonths} months'),
              _detail('Loan Amount', _money(quote.loanAmountPaise)),
              _detail('Processing Fee', _money(quote.processingFeePaise)),
              _detail(
                'Total Money Receivable',
                _money(quote.totalMoneyReceivablePaise),
              ),
              _detail('Status', quote.status),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Close'),
          ),
          OutlinedButton.icon(
            onPressed: () => showDialog<void>(
              context: context,
              builder: (_) => AlertDialog(
                title: const Text('Quotation print preview'),
                content: SizedBox(
                  width: 600,
                  child: SingleChildScrollView(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'VEHICLE FINANCE QUOTATION',
                          style: TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const Divider(),
                        for (final entry in [
                          ('Vehicle No.', quote.vehicleNo),
                          ('Fitment Type', quote.fitmentType),
                          ('Make', quote.make),
                          ('Ply Rating', quote.plyRating),
                          ('Field Office Name', quote.fieldOfficeName),
                          (
                            'Approx Delivery Date',
                            _date(quote.approxDeliveryDate),
                          ),
                          ('Bill Amount', _money(quote.billAmountPaise)),
                          ('Margin Money', _money(quote.marginMoneyPaise)),
                          ('Loan Period', '${quote.loanPeriodMonths} months'),
                          ('Loan Amount', _money(quote.loanAmountPaise)),
                          ('Processing Fee', _money(quote.processingFeePaise)),
                          (
                            'Total Money Receivable',
                            _money(quote.totalMoneyReceivablePaise),
                          ),
                        ])
                          _detail(entry.$1, entry.$2),
                      ],
                    ),
                  ),
                ),
                actions: [
                  TextButton(
                    onPressed: () => Navigator.pop(context),
                    child: const Text('Close preview'),
                  ),
                ],
              ),
            ),
            icon: const Icon(Icons.print_outlined),
            label: const Text('Print preview'),
          ),
        ],
      ),
    );
  }
}

class _FinanceQuotationEditor extends StatefulWidget {
  const _FinanceQuotationEditor({required this.database, this.initial});
  final AppDatabase database;
  final FinanceQuotation? initial;

  @override
  State<_FinanceQuotationEditor> createState() =>
      _FinanceQuotationEditorState();
}

class _FinanceQuotationEditorState extends State<_FinanceQuotationEditor> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _vehicle;
  late final TextEditingController _bill;
  late final TextEditingController _margin;
  late final TextEditingController _period;
  late final TextEditingController _loan;
  late final TextEditingController _fee;
  late final TextEditingController _receivable;
  late DateTime _delivery;
  String? _fitment;
  String? _make;
  String? _ply;
  String? _office;
  bool _saving = false;

  FinanceQuotationRepository get _repository =>
      FinanceQuotationRepository(widget.database);

  @override
  void initState() {
    super.initState();
    final quote = widget.initial;
    _vehicle = TextEditingController(text: quote?.vehicleNo ?? '');
    _bill = TextEditingController(text: _rupees(quote?.billAmountPaise));
    _margin = TextEditingController(text: _rupees(quote?.marginMoneyPaise));
    _period = TextEditingController(
      text: quote?.loanPeriodMonths.toString() ?? '',
    );
    _loan = TextEditingController(text: _rupees(quote?.loanAmountPaise));
    _fee = TextEditingController(text: _rupees(quote?.processingFeePaise));
    _receivable = TextEditingController(
      text: _rupees(quote?.totalMoneyReceivablePaise),
    );
    _delivery = quote?.approxDeliveryDate ?? DateTime.now();
    _fitment = quote?.fitmentType;
    _make = quote?.make;
    _ply = quote?.plyRating;
    _office = quote?.fieldOfficeName;
  }

  @override
  void dispose() {
    for (final controller in [
      _vehicle,
      _bill,
      _margin,
      _period,
      _loan,
      _fee,
      _receivable,
    ]) {
      controller.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
    title: Text(
      widget.initial == null ? 'New finance quotation' : 'Edit draft',
    ),
    content: SizedBox(
      width: 760,
      child: Form(
        key: _formKey,
        child: SingleChildScrollView(
          child: Wrap(
            spacing: 12,
            runSpacing: 12,
            children: [
              _text(_vehicle, 'Vehicle No.'),
              _master(
                FinanceMasterCategory.fitment,
                _fitment,
                (v) => _fitment = v,
              ),
              _master(FinanceMasterCategory.make, _make, (v) => _make = v),
              _master(FinanceMasterCategory.plyRating, _ply, (v) => _ply = v),
              _master(
                FinanceMasterCategory.fieldOffice,
                _office,
                (v) => _office = v,
              ),
              SizedBox(
                width: 230,
                child: OutlinedButton.icon(
                  onPressed: _pickDate,
                  icon: const Icon(Icons.calendar_month_outlined),
                  label: Text('Approx delivery · ${_date(_delivery)}'),
                ),
              ),
              _amount(_bill, 'Bill Amount'),
              _amount(_margin, 'Margin Money'),
              SizedBox(
                width: 230,
                child: TextFormField(
                  controller: _period,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(
                    labelText: 'Loan Period (months)',
                  ),
                  validator: (value) => (int.tryParse(value ?? '') ?? 0) <= 0
                      ? 'Enter positive months.'
                      : null,
                ),
              ),
              _amount(_loan, 'Loan Amount'),
              _amount(_fee, 'Processing Fee'),
              _amount(_receivable, 'Total Money Receivable'),
            ],
          ),
        ),
      ),
    ),
    actions: [
      TextButton(
        onPressed: () => Navigator.pop(context, false),
        child: const Text('Cancel'),
      ),
      FilledButton(
        onPressed: _saving ? null : _save,
        child: Text(_saving ? 'Saving...' : 'Save draft'),
      ),
    ],
  );

  Widget _text(TextEditingController controller, String label) => SizedBox(
    width: 230,
    child: TextFormField(
      controller: controller,
      decoration: InputDecoration(labelText: label),
      validator: (value) =>
          value == null || value.trim().isEmpty ? 'Required.' : null,
    ),
  );

  Widget _amount(TextEditingController controller, String label) => SizedBox(
    width: 230,
    child: TextFormField(
      controller: controller,
      keyboardType: const TextInputType.numberWithOptions(decimal: true),
      inputFormatters: [
        FilteringTextInputFormatter.allow(RegExp(r'^\d*\.?\d{0,2}')),
      ],
      decoration: InputDecoration(labelText: label, prefixText: 'INR '),
      validator: (value) =>
          _parsePaise(value ?? '') == null ? 'Enter a valid amount.' : null,
    ),
  );

  Widget _master(
    FinanceMasterCategory category,
    String? value,
    ValueChanged<String?> setValue,
  ) {
    final options = _repository.masterValues(category);
    final validValue = options.any((option) => option.value == value)
        ? value
        : null;
    return SizedBox(
      width: 230,
      child: Row(
        children: [
          Expanded(
            child: DropdownButtonFormField<String>(
              initialValue: validValue,
              decoration: InputDecoration(labelText: category.label),
              items: options
                  .map(
                    (option) => DropdownMenuItem(
                      value: option.value,
                      child: Text(
                        option.value,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  )
                  .toList(),
              validator: (selected) =>
                  selected == null ? 'Configure/select a value.' : null,
              onChanged: setValue,
            ),
          ),
          IconButton(
            tooltip: 'Add ${category.label} master value',
            onPressed: () => _addMaster(category),
            icon: const Icon(Icons.add_circle_outline),
          ),
        ],
      ),
    );
  }

  Future<void> _addMaster(FinanceMasterCategory category) async {
    final value = await showDialog<String>(
      context: context,
      builder: (context) => _MasterValueDialog(category: category),
    );
    if (value == null) return;
    try {
      _repository.addMasterValue(category, value);
      setState(() {
        switch (category) {
          case FinanceMasterCategory.fitment:
            _fitment = value.trim();
          case FinanceMasterCategory.make:
            _make = value.trim();
          case FinanceMasterCategory.plyRating:
            _ply = value.trim();
          case FinanceMasterCategory.fieldOffice:
            _office = value.trim();
        }
      });
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Could not save master value: $error')),
        );
      }
    }
  }

  Future<void> _pickDate() async {
    final date = await showDatePicker(
      context: context,
      initialDate: _delivery,
      firstDate: DateTime(2000),
      lastDate: DateTime(2100),
    );
    if (date != null) setState(() => _delivery = date);
  }

  void _save() {
    if (!_formKey.currentState!.validate() ||
        _fitment == null ||
        _make == null ||
        _ply == null ||
        _office == null) {
      return;
    }
    setState(() => _saving = true);
    try {
      _repository.save(
        id: widget.initial?.id,
        vehicleNo: _vehicle.text,
        fitmentType: _fitment!,
        make: _make!,
        plyRating: _ply!,
        fieldOfficeName: _office!,
        approxDeliveryDate: _delivery,
        billAmountPaise: _parsePaise(_bill.text)!,
        marginMoneyPaise: _parsePaise(_margin.text)!,
        loanPeriodMonths: int.parse(_period.text),
        loanAmountPaise: _parsePaise(_loan.text)!,
        processingFeePaise: _parsePaise(_fee.text)!,
        totalMoneyReceivablePaise: _parsePaise(_receivable.text)!,
      );
      Navigator.pop(context, true);
    } catch (error) {
      setState(() => _saving = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Quotation was not saved: $error')),
      );
    }
  }
}

class _MasterValueDialog extends StatefulWidget {
  const _MasterValueDialog({required this.category});
  final FinanceMasterCategory category;
  @override
  State<_MasterValueDialog> createState() => _MasterValueDialogState();
}

class _MasterValueDialogState extends State<_MasterValueDialog> {
  final _controller = TextEditingController();
  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
    title: Text('Add ${widget.category.label} value'),
    content: TextField(
      controller: _controller,
      autofocus: true,
      decoration: const InputDecoration(labelText: 'Value'),
      onSubmitted: (_) => Navigator.pop(context, _controller.text),
    ),
    actions: [
      TextButton(
        onPressed: () => Navigator.pop(context),
        child: const Text('Cancel'),
      ),
      FilledButton(
        onPressed: () => Navigator.pop(context, _controller.text),
        child: const Text('Add'),
      ),
    ],
  );
}

Widget _detail(String label, String value) => Padding(
  padding: const EdgeInsets.symmetric(vertical: 5),
  child: Row(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      SizedBox(
        width: 210,
        child: Text(label, style: const TextStyle(color: AppColors.textMuted)),
      ),
      Expanded(child: Text(value)),
    ],
  ),
);

int? _parsePaise(String value) {
  final text = value.trim();
  if (!RegExp(r'^\d+(\.\d{1,2})?$').hasMatch(text)) return null;
  final parts = text.split('.');
  return int.parse(parts.first) * 100 +
      (parts.length == 1 ? 0 : int.parse(parts[1].padRight(2, '0')));
}

String _rupees(int? paise) => paise == null
    ? ''
    : '${paise ~/ 100}.${(paise % 100).toString().padLeft(2, '0')}';
String _money(int paise) => 'INR ${_rupees(paise)}';
String _date(DateTime date) =>
    '${date.day.toString().padLeft(2, '0')}/${date.month.toString().padLeft(2, '0')}/${date.year}';
