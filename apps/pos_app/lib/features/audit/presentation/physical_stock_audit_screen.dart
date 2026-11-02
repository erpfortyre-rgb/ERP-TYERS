import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/providers.dart';
import '../../../core/theme/app_colors.dart';
import '../data/stock_audit_repository.dart';

class PhysicalStockAuditScreen extends ConsumerStatefulWidget {
  const PhysicalStockAuditScreen({super.key});
  @override
  ConsumerState<PhysicalStockAuditScreen> createState() =>
      _PhysicalStockAuditScreenState();
}

class _PhysicalStockAuditScreenState
    extends ConsumerState<PhysicalStockAuditScreen> {
  int _revision = 0;
  bool _reminderChecked = false;

  @override
  Widget build(BuildContext context) => ref
      .watch(databaseProvider)
      .when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) =>
            Center(child: Text('Stock audit unavailable: $error')),
        data: (database) {
          final repository = StockAuditRepository(database);
          if (!_reminderChecked) {
            _reminderChecked = true;
            WidgetsBinding.instance.addPostFrameCallback(
              (_) => _checkReminders(repository),
            );
          }
          final schedules = repository.upcomingSchedules();
          final rows = repository.rows();
          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Padding(
                padding: const EdgeInsets.all(16),
                child: Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    const Text(
                      'Physical stock audit',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    OutlinedButton.icon(
                      onPressed: () => _schedule(repository),
                      icon: const Icon(Icons.event_outlined),
                      label: const Text('Schedule audit'),
                    ),
                    FilledButton.icon(
                      onPressed: () => _start(repository),
                      icon: const Icon(Icons.play_arrow),
                      label: const Text('Start audit'),
                    ),
                  ],
                ),
              ),
              if (schedules.isNotEmpty)
                SizedBox(
                  height: 52,
                  child: ListView(
                    scrollDirection: Axis.horizontal,
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    children: [
                      for (final schedule in schedules)
                        Padding(
                          padding: const EdgeInsets.only(right: 8),
                          child: ActionChip(
                            avatar: const Icon(
                              Icons.notifications_active_outlined,
                            ),
                            label: Text(
                              '${schedule.label} · ${_date(schedule.scheduledDate)} · ${schedule.status}',
                            ),
                            onPressed: () =>
                                _showSchedule(repository, schedule),
                          ),
                        ),
                    ],
                  ),
                ),
              Expanded(
                child: rows.isEmpty
                    ? const Center(
                        child: Text(
                          'Start an audit to take a branch stock snapshot.',
                        ),
                      )
                    : SingleChildScrollView(
                        child: SingleChildScrollView(
                          scrollDirection: Axis.horizontal,
                          child: DataTable(
                            columns: const [
                              DataColumn(label: Text('PRODUCT')),
                              DataColumn(label: Text('SKU')),
                              DataColumn(label: Text('BOOK STOCK')),
                              DataColumn(label: Text('PHYSICAL STOCK')),
                              DataColumn(label: Text('VARIANCE')),
                              DataColumn(label: Text('EDIT COUNT')),
                              DataColumn(label: Text('STATUS')),
                              DataColumn(label: Text('ACTION')),
                            ],
                            rows: [
                              for (final row in rows)
                                DataRow(
                                  color: WidgetStatePropertyAll(
                                    _editColor(row.editCount),
                                  ),
                                  cells: [
                                    DataCell(Text(row.productName)),
                                    DataCell(Text(row.sku)),
                                    DataCell(
                                      Text(_quantity(row.bookQuantityMilli)),
                                    ),
                                    DataCell(
                                      Text(
                                        _quantity(row.physicalQuantityMilli),
                                      ),
                                    ),
                                    DataCell(
                                      Text(_quantity(row.varianceMilli)),
                                    ),
                                    DataCell(Text('${row.editCount}/3')),
                                    DataCell(
                                      Text(
                                        row.editCount == 3
                                            ? 'Locked'
                                            : _editStatus(row.editCount),
                                      ),
                                    ),
                                    DataCell(
                                      row.editCount == 3
                                          ? const Tooltip(
                                              message: 'Three saved edits reached. This row is permanently locked.',
                                              child: Icon(Icons.lock_outline),
                                            )
                                          : IconButton(
                                              tooltip:
                                                  'Save physical count edit',
                                              onPressed: () =>
                                                  _editCount(repository, row),
                                              icon: const Icon(
                                                Icons.edit_outlined,
                                              ),
                                            ),
                                    ),
                                  ],
                                ),
                            ],
                          ),
                        ),
                      ),
              ),
              const Padding(
                padding: EdgeInsets.all(14),
                child: Text(
                  'Count edits do not change stock balances. Reconciliation/adjustment requires an approved workflow. Reminders are checked only while this app is open.',
                  style: TextStyle(color: AppColors.textMuted),
                ),
              ),
            ],
          );
        },
      );

  Future<void> _start(StockAuditRepository repository) async {
    final date = DateTime.now();
    try {
      repository.startAudit(date);
      if (mounted) setState(() => _revision++);
    } catch (error) {
      _message('Could not start audit: $error');
    }
  }

  Future<void> _schedule(StockAuditRepository repository) async {
    final result = await showDialog<(DateTime, String)>(
      context: context,
      builder: (_) => const _ScheduleDialog(),
    );
    if (result == null) return;
    try {
      repository.schedule(result.$1, result.$2);
      if (mounted) setState(() => _revision++);
    } catch (error) {
      _message('Could not schedule audit: $error');
    }
  }

  Future<void> _checkReminders(StockAuditRepository repository) async {
    if (!mounted) return;
    final today = DateTime.now();
    final due = repository
        .upcomingSchedules()
        .where(
          (schedule) => !schedule.scheduledDate.isAfter(
            DateTime(today.year, today.month, today.day, 23, 59, 59),
          ),
        )
        .toList();
    if (due.isEmpty) return;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Stock audit reminder'),
        content: Text(
          due
              .map(
                (schedule) =>
                    '${schedule.label} · ${_date(schedule.scheduledDate)}',
              )
              .join('\n'),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Later'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Acknowledge'),
          ),
        ],
      ),
    );
    if (confirmed == true && mounted) {
      for (final schedule in due) {
        repository.markScheduleStarted(schedule.id);
      }
      setState(() => _revision++);
    }
  }

  Future<void> _showSchedule(
    StockAuditRepository repository,
    StockAuditSchedule schedule,
  ) async {
    final start = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(schedule.label),
        content: Text('Scheduled for ${_date(schedule.scheduledDate)}.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Close'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Start audit'),
          ),
        ],
      ),
    );
    if (start == true && mounted) {
      try {
        repository.startAudit(schedule.scheduledDate);
        repository.markScheduleStarted(schedule.id);
        setState(() => _revision++);
      } catch (error) {
        _message('Could not start scheduled audit: $error');
      }
    }
  }

  Future<void> _editCount(
    StockAuditRepository repository,
    StockAuditRow row,
  ) async {
    final quantity = await showDialog<int>(
      context: context,
      builder: (_) => _CountDialog(initialMilli: row.physicalQuantityMilli),
    );
    if (quantity == null) return;
    try {
      repository.editCount(
        rowId: row.id,
        expectedEditCount: row.editCount,
        physicalQuantityMilli: quantity,
      );
      if (mounted) setState(() => _revision++);
    } catch (error) {
      _message('Count was not saved: $error');
    }
  }

  void _message(String text) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text)));
  }
}

class _CountDialog extends StatefulWidget {
  const _CountDialog({required this.initialMilli});
  final int initialMilli;
  @override
  State<_CountDialog> createState() => _CountDialogState();
}

class _CountDialogState extends State<_CountDialog> {
  late final TextEditingController _value;
  @override
  void initState() {
    super.initState();
    _value = TextEditingController(text: _quantity(widget.initialMilli));
  }

  @override
  void dispose() {
    _value.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
    title: const Text('Enter physical stock'),
    content: TextField(
      controller: _value,
      autofocus: true,
      keyboardType: const TextInputType.numberWithOptions(decimal: true),
      inputFormatters: [
        FilteringTextInputFormatter.allow(RegExp(r'^\d*\.?\d{0,3}')),
      ],
      decoration: const InputDecoration(labelText: 'Physical quantity'),
      onSubmitted: (_) => _submit(context),
    ),
    actions: [
      TextButton(
        onPressed: () => Navigator.pop(context),
        child: const Text('Cancel'),
      ),
      FilledButton(
        onPressed: () => _submit(context),
        child: const Text('Save edit'),
      ),
    ],
  );

  void _submit(BuildContext context) {
    final parsed = double.tryParse(_value.text);
    if (parsed == null || !parsed.isFinite || parsed < 0) return;
    Navigator.pop(context, (parsed * 1000).round());
  }
}

class _ScheduleDialog extends StatefulWidget {
  const _ScheduleDialog();
  @override
  State<_ScheduleDialog> createState() => _ScheduleDialogState();
}

class _ScheduleDialogState extends State<_ScheduleDialog> {
  final _label = TextEditingController();
  DateTime _scheduledDate = DateTime.now();
  @override
  void dispose() {
    _label.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
    title: const Text('Schedule stock audit'),
    content: Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        TextField(
          controller: _label,
          decoration: const InputDecoration(labelText: 'Audit name'),
          onChanged: (_) => setState(() {}),
        ),
        OutlinedButton(
          onPressed: () async {
            final date = await showDatePicker(
              context: context,
              initialDate: _scheduledDate,
              firstDate: DateTime.now(),
              lastDate: DateTime(2100),
            );
            if (date != null) setState(() => _scheduledDate = date);
          },
          child: Text(_date(_scheduledDate)),
        ),
      ],
    ),
    actions: [
      TextButton(
        onPressed: () => Navigator.pop(context),
        child: const Text('Cancel'),
      ),
      FilledButton(
        onPressed: _label.text.trim().isEmpty
            ? null
            : () => Navigator.pop(context, (_scheduledDate, _label.text)),
        child: const Text('Schedule'),
      ),
    ],
  );
}

Color _editColor(int count) => switch (count) {
  0 => AppColors.surface,
  1 => const Color(0xFFFFF4CC),
  2 => const Color(0xFFFFE0B2),
  _ => const Color(0xFFFFCDD2),
};
String _editStatus(int count) => switch (count) {
  0 => 'Initial',
  1 => 'First edit',
  2 => 'Second edit',
  _ => 'Third edit',
};
String _quantity(int milli) =>
    '${milli ~/ 1000}.${(milli % 1000).toString().padLeft(3, '0')}';
String _date(DateTime date) =>
    '${date.day.toString().padLeft(2, '0')}/${date.month.toString().padLeft(2, '0')}/${date.year}';
