import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/providers.dart';
import '../../../core/theme/app_colors.dart';
import '../data/accounting_repository.dart';
import '../domain/accounting.dart';

class AccountingScreen extends ConsumerStatefulWidget {
  const AccountingScreen({super.key});

  @override
  ConsumerState<AccountingScreen> createState() => _AccountingScreenState();
}

class _AccountingScreenState extends ConsumerState<AccountingScreen> {
  String? _selectedAccount;
  int _revision = 0;

  @override
  Widget build(BuildContext context) => ref
      .watch(databaseProvider)
      .when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) =>
            Center(child: Text('Accounting setup unavailable: $error')),
        data: (database) {
          final repository = AccountingRepository(database);
          final accounts = repository.accounts();
          final mappings = repository.mappings();
          final selectedId =
              accounts.any((account) => account.id == _selectedAccount)
              ? _selectedAccount
              : null;
          final ledger = selectedId == null
              ? const <AccountLedgerEntry>[]
              : repository.ledger(selectedId);
          return SingleChildScrollView(
            key: ValueKey(_revision),
            padding: const EdgeInsets.all(18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Wrap(
                  spacing: 12,
                  runSpacing: 8,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    const Text(
                      'Chart of accounts',
                      style: TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    FilledButton.icon(
                      onPressed: () => _addAccount(repository),
                      icon: const Icon(Icons.add),
                      label: const Text('Add account'),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                const Text(
                  'Configure business-approved accounts before posting purchases. No accounts or opening balances are pre-filled.',
                  style: TextStyle(color: AppColors.textMuted),
                ),
                const SizedBox(height: 16),
                if (accounts.isEmpty)
                  const Card(
                    child: Padding(
                      padding: EdgeInsets.all(16),
                      child: Text('No chart-of-account entries configured.'),
                    ),
                  )
                else
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: accounts
                        .map(
                          (account) => ChoiceChip(
                            label: Text(
                              '${account.code} · ${account.name} (${account.category.label})',
                            ),
                            selected: account.id == selectedId,
                            onSelected: (_) =>
                                setState(() => _selectedAccount = account.id),
                          ),
                        )
                        .toList(),
                  ),
                const SizedBox(height: 20),
                const Text(
                  'Purchase posting mappings',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 8),
                ...AccountMappingPurpose.values.map((purpose) {
                  final eligible = accounts
                      .where(
                        (account) =>
                            account.isActive &&
                            account.category.value == purpose.requiredCategory,
                      )
                      .toList();
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: SizedBox(
                      width: 520,
                      child: DropdownButtonFormField<String?>(
                        initialValue:
                            eligible.any(
                              (account) => account.id == mappings[purpose],
                            )
                            ? mappings[purpose]
                            : null,
                        decoration: InputDecoration(
                          labelText: purpose.label,
                          helperText:
                              'Requires an active ${purpose.requiredCategory.toLowerCase()} account',
                          isDense: true,
                        ),
                        items: [
                          const DropdownMenuItem<String?>(
                            value: null,
                            child: Text('Not configured'),
                          ),
                          ...eligible.map(
                            (account) => DropdownMenuItem<String?>(
                              value: account.id,
                              child: Text(
                                '${account.code} · ${account.name}',
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          ),
                        ],
                        onChanged: (value) {
                          if (value == null) return;
                          try {
                            repository.mapAccount(purpose, value);
                            setState(() => _revision++);
                          } catch (error) {
                            _message('Mapping was not saved: $error');
                          }
                        },
                      ),
                    ),
                  );
                }),
                const Divider(height: 28),
                Text(
                  selectedId == null
                      ? 'General ledger'
                      : 'General ledger · ${accounts.firstWhere((account) => account.id == selectedId).name}',
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 8),
                if (selectedId == null)
                  const Text('Select an account to view posted entries.')
                else if (ledger.isEmpty)
                  const Text('No posted journal entries for this account.')
                else
                  SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    child: DataTable(
                      columns: const [
                        DataColumn(label: Text('Date')),
                        DataColumn(label: Text('Source')),
                        DataColumn(label: Text('Narration')),
                        DataColumn(label: Text('Debit')),
                        DataColumn(label: Text('Credit')),
                        DataColumn(label: Text('Balance')),
                      ],
                      rows: ledger.map((entry) {
                        return DataRow(
                          cells: [
                            DataCell(Text(_date(entry.date))),
                            DataCell(Text(entry.sourceType)),
                            DataCell(Text(entry.narration)),
                            DataCell(Text(_money(entry.debitPaise))),
                            DataCell(Text(_money(entry.creditPaise))),
                            DataCell(Text(_money(entry.balancePaise))),
                          ],
                        );
                      }).toList(),
                    ),
                  ),
              ],
            ),
          );
        },
      );

  Future<void> _addAccount(AccountingRepository repository) async {
    final result = await showDialog<_AccountFormResult>(
      context: context,
      builder: (_) => const _AccountFormDialog(),
    );
    if (result == null || !mounted) return;
    try {
      final id = repository.saveAccount(
        code: result.code,
        name: result.name,
        category: result.category,
      );
      setState(() {
        _selectedAccount = id;
        _revision++;
      });
    } catch (error) {
      _message('Account was not saved: $error');
    }
  }

  void _message(String value) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(value)));
  }

  static String _money(int paise) => '₹${(paise / 100).toStringAsFixed(2)}';
  static String _date(DateTime value) =>
      '${value.day.toString().padLeft(2, '0')}/${value.month.toString().padLeft(2, '0')}/${value.year}';
}

class _AccountFormResult {
  const _AccountFormResult(this.code, this.name, this.category);
  final String code;
  final String name;
  final AccountCategory category;
}

class _AccountFormDialog extends StatefulWidget {
  const _AccountFormDialog();

  @override
  State<_AccountFormDialog> createState() => _AccountFormDialogState();
}

class _AccountFormDialogState extends State<_AccountFormDialog> {
  final _key = GlobalKey<FormState>();
  final _code = TextEditingController();
  final _name = TextEditingController();
  AccountCategory _category = AccountCategory.asset;

  @override
  void dispose() {
    _code.dispose();
    _name.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
    title: const Text('Add chart-of-account entry'),
    content: SizedBox(
      width: 420,
      child: Form(
        key: _key,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextFormField(
              controller: _code,
              decoration: const InputDecoration(labelText: 'Account code'),
              validator: _required,
            ),
            TextFormField(
              controller: _name,
              decoration: const InputDecoration(labelText: 'Account name'),
              validator: _required,
            ),
            DropdownButtonFormField<AccountCategory>(
              initialValue: _category,
              decoration: const InputDecoration(labelText: 'Category'),
              items: AccountCategory.values
                  .map(
                    (category) => DropdownMenuItem(
                      value: category,
                      child: Text(category.label),
                    ),
                  )
                  .toList(),
              onChanged: (value) {
                if (value != null) setState(() => _category = value);
              },
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
        onPressed: () {
          if (!_key.currentState!.validate()) return;
          Navigator.pop(
            context,
            _AccountFormResult(_code.text, _name.text, _category),
          );
        },
        child: const Text('Save account'),
      ),
    ],
  );

  String? _required(String? value) =>
      value == null || value.trim().isEmpty ? 'Required.' : null;
}
