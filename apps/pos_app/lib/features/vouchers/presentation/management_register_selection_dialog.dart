import 'package:flutter/material.dart';

import '../data/management_register_repository.dart';

class ManagementRegisterSelectionDialog extends StatefulWidget {
  const ManagementRegisterSelectionDialog({
    super.key,
    required this.registers,
    this.initialSelections = const [],
  });

  final List<ManagementRegister> registers;
  final List<String> initialSelections;

  static Future<List<String>?> show(
    BuildContext context,
    ManagementRegisterRepository repository, {
    List<String> initialSelections = const [],
  }) => showDialog<List<String>>(
    context: context,
    builder: (_) => ManagementRegisterSelectionDialog(
      registers: repository.list(),
      initialSelections: initialSelections,
    ),
  );

  @override
  State<ManagementRegisterSelectionDialog> createState() =>
      _ManagementRegisterSelectionDialogState();
}

class _ManagementRegisterSelectionDialogState
    extends State<ManagementRegisterSelectionDialog> {
  late final Set<String> _selected;

  @override
  void initState() {
    super.initState();
    _selected = widget.initialSelections.toSet();
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
    title: const Text('Management register selection'),
    content: SizedBox(
      width: 480,
      child: widget.registers.isEmpty
          ? const Text(
              'No management registers are configured. Configure them before saving a voucher.',
            )
          : ListView(
              shrinkWrap: true,
              children: [
                for (final register in widget.registers)
                  CheckboxListTile(
                    value: _selected.contains(register.id),
                    title: Text(register.name),
                    controlAffinity: ListTileControlAffinity.leading,
                    onChanged: (checked) => setState(() {
                      if (checked == true) {
                        _selected.add(register.id);
                      } else {
                        _selected.remove(register.id);
                      }
                    }),
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
        onPressed: widget.registers.isEmpty ? null : _confirm,
        child: const Text('Review selection'),
      ),
    ],
  );

  Future<void> _confirm() async {
    final names = widget.registers
        .where((register) => _selected.contains(register.id))
        .map((register) => register.name)
        .toList(growable: false);
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Confirm affected registers'),
        content: Text(
          names.isEmpty ? 'No register selected.' : names.join('\n'),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Back to editing'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Confirm registers'),
          ),
        ],
      ),
    );
    if (confirmed == true && mounted) {
      Navigator.pop(context, _selected.toList(growable: false));
    }
  }
}
