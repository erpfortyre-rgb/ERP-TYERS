import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/providers.dart';
import '../../../core/theme/app_colors.dart';
import '../data/management_register_repository.dart';

class ManagementRegistersScreen extends ConsumerStatefulWidget {
  const ManagementRegistersScreen({super.key});
  @override
  ConsumerState<ManagementRegistersScreen> createState() =>
      _ManagementRegistersScreenState();
}

class _ManagementRegistersScreenState
    extends ConsumerState<ManagementRegistersScreen> {
  final _name = TextEditingController();
  int _revision = 0;

  @override
  void dispose() {
    _name.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => ref
      .watch(databaseProvider)
      .when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) =>
            Center(child: Text('Register configuration unavailable: $error')),
        data: (database) {
          final repository = ManagementRegisterRepository(database);
          final registers = repository.list(activeOnly: false);
          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Padding(
                padding: const EdgeInsets.all(16),
                child: Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _name,
                        decoration: const InputDecoration(
                          labelText: 'Management register name',
                        ),
                        onSubmitted: (_) => _add(repository),
                      ),
                    ),
                    const SizedBox(width: 10),
                    FilledButton.icon(
                      onPressed: () => _add(repository),
                      icon: const Icon(Icons.add),
                      label: const Text('Add register'),
                    ),
                  ],
                ),
              ),
              const Padding(
                padding: EdgeInsets.symmetric(horizontal: 16),
                child: Text(
                  'Names are configured locally; no financial posting effects are assigned. Voucher save workflows are not implemented yet.',
                  style: TextStyle(color: AppColors.textMuted),
                ),
              ),
              Expanded(
                child: registers.isEmpty
                    ? const Center(
                        child: Text(
                          'No management register options configured.',
                        ),
                      )
                    : ListView.builder(
                        key: ValueKey(_revision),
                        itemCount: registers.length,
                        itemBuilder: (context, index) {
                          final register = registers[index];
                          return SwitchListTile(
                            title: Text(register.name),
                            subtitle: Text(
                              register.isActive
                                  ? 'Available for selection'
                                  : 'Inactive',
                            ),
                            value: register.isActive,
                            onChanged: (value) {
                              repository.setActive(register.id, value);
                              setState(() => _revision++);
                            },
                          );
                        },
                      ),
              ),
            ],
          );
        },
      );

  void _add(ManagementRegisterRepository repository) {
    try {
      repository.add(_name.text);
      _name.clear();
      setState(() => _revision++);
    } catch (error) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Register was not saved: $error')));
    }
  }
}
