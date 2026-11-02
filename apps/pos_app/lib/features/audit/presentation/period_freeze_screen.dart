import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/providers.dart';
import '../../../core/theme/app_colors.dart';
import '../data/period_freeze_repository.dart';

class PeriodFreezeScreen extends ConsumerStatefulWidget {
  const PeriodFreezeScreen({super.key});
  @override
  ConsumerState<PeriodFreezeScreen> createState() => _PeriodFreezeScreenState();
}

class _PeriodFreezeScreenState extends ConsumerState<PeriodFreezeScreen> {
  int _revision = 0;

  @override
  Widget build(BuildContext context) => ref
      .watch(databaseProvider)
      .when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) =>
            Center(child: Text('Period freezes unavailable: $error')),
        data: (database) {
          final repository = PeriodFreezeRepository(database);
          final freezes = repository.list();
          final events = repository.auditEvents();
          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Padding(
                padding: const EdgeInsets.all(16),
                child: Row(
                  children: [
                    const Expanded(
                      child: Text(
                        'Period freeze',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                    FilledButton.icon(
                      onPressed: () => _freeze(repository),
                      icon: const Icon(Icons.lock_outline),
                      label: const Text('Freeze period'),
                    ),
                  ],
                ),
              ),
              Expanded(
                child: ListView(
                  key: ValueKey(_revision),
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  children: [
                    if (freezes.isEmpty)
                      const Padding(
                        padding: EdgeInsets.all(28),
                        child: Center(child: Text('No periods frozen.')),
                      ),
                    for (final freeze in freezes)
                      Card(
                        child: ListTile(
                          leading: Icon(
                            freeze.unfrozenAt == null
                                ? Icons.lock
                                : Icons.lock_open_outlined,
                            color: freeze.unfrozenAt == null
                                ? AppColors.warning
                                : AppColors.textMuted,
                          ),
                          title: Text(
                            '${_date(freeze.startDate)} – ${_date(freeze.endDate)} · ${freeze.scope.label}',
                          ),
                          subtitle: Text(
                            'Branch: ${freeze.branchName ?? 'All branches'} · ${freeze.reason} · Frozen by device ${freeze.frozenBy}',
                          ),
                          trailing: freeze.unfrozenAt == null
                              ? IconButton(
                                  tooltip: 'Unfreeze policy not configured',
                                  onPressed: _explainRestrictedUnfreeze,
                                  icon: const Icon(Icons.lock_clock_outlined),
                                )
                              : const Text('Unfrozen'),
                        ),
                      ),
                    const Padding(
                      padding: EdgeInsets.only(top: 18, bottom: 8),
                      child: Text(
                        'Recent audit events',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                    if (events.isEmpty)
                      const Text('No period-related events recorded.'),
                    for (final event in events)
                      ListTile(
                        dense: true,
                        leading: const Icon(Icons.history, size: 18),
                        title: Text(
                          '${event['event_type']} · ${event['entity_type']}',
                        ),
                        subtitle: Text(
                          '${event['details']} · ${DateTime.fromMillisecondsSinceEpoch(event['created_at']! as int)}',
                        ),
                      ),
                  ],
                ),
              ),
              const Padding(
                padding: EdgeInsets.all(14),
                child: Text(
                  'A frozen period blocks invoice finalization affecting stock/accounting. Unfreeze is deliberately disabled until client authorization policy is approved.',
                  style: TextStyle(color: AppColors.textMuted),
                ),
              ),
            ],
          );
        },
      );

  Future<void> _freeze(PeriodFreezeRepository repository) async {
    final value = await showDialog<_FreezeInput>(
      context: context,
      builder: (_) => const _FreezeDialog(),
    );
    if (value == null) return;
    try {
      repository.freeze(
        startDate: value.start,
        endDate: value.end,
        scope: value.scope,
        reason: value.reason,
      );
      if (mounted) setState(() => _revision++);
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Period was not frozen: $error')),
        );
      }
    }
  }

  void _explainRestrictedUnfreeze() {
    showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Unfreeze is restricted'),
        content: const Text(
          'The client has not confirmed the roles or approval policy for unfreezing a period. No unfreeze action is available to avoid an unauthorized historical change.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Close'),
          ),
        ],
      ),
    );
  }
}

class _FreezeInput {
  const _FreezeInput(this.start, this.end, this.scope, this.reason);
  final DateTime start;
  final DateTime end;
  final FreezeScope scope;
  final String reason;
}

class _FreezeDialog extends StatefulWidget {
  const _FreezeDialog();
  @override
  State<_FreezeDialog> createState() => _FreezeDialogState();
}

class _FreezeDialogState extends State<_FreezeDialog> {
  DateTime _start = DateTime.now();
  DateTime _end = DateTime.now();
  FreezeScope _scope = FreezeScope.both;
  final _reason = TextEditingController();
  @override
  void dispose() {
    _reason.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
    title: const Text('Freeze accounting / stock period'),
    content: SizedBox(
      width: 440,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          DropdownButtonFormField<FreezeScope>(
            initialValue: _scope,
            decoration: const InputDecoration(labelText: 'Scope'),
            items: FreezeScope.values
                .map(
                  (scope) =>
                      DropdownMenuItem(value: scope, child: Text(scope.label)),
                )
                .toList(),
            onChanged: (value) =>
                setState(() => _scope = value ?? FreezeScope.both),
          ),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: () => _pick(true),
                  child: Text('Start · ${_date(_start)}'),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: OutlinedButton(
                  onPressed: () => _pick(false),
                  child: Text('End · ${_date(_end)}'),
                ),
              ),
            ],
          ),
          TextField(
            controller: _reason,
            decoration: const InputDecoration(labelText: 'Freeze reason'),
            onChanged: (_) => setState(() {}),
          ),
        ],
      ),
    ),
    actions: [
      TextButton(
        onPressed: () => Navigator.pop(context),
        child: const Text('Cancel'),
      ),
      FilledButton(
        onPressed: _reason.text.trim().isEmpty
            ? null
            : () => Navigator.pop(
                context,
                _FreezeInput(_start, _end, _scope, _reason.text.trim()),
              ),
        child: const Text('Freeze period'),
      ),
    ],
  );

  Future<void> _pick(bool start) async {
    final date = await showDatePicker(
      context: context,
      initialDate: start ? _start : _end,
      firstDate: DateTime(2000),
      lastDate: DateTime(2100),
    );
    if (date != null) setState(() => start ? _start = date : _end = date);
  }
}

String _date(DateTime date) =>
    '${date.day.toString().padLeft(2, '0')}/${date.month.toString().padLeft(2, '0')}/${date.year}';
