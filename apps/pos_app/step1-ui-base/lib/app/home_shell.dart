import 'package:flutter/material.dart';

import '../core/theme/app_colors.dart';
import '../features/billing/presentation/billing_screen.dart';
import '../features/common/placeholder_screen.dart';
import '../shared/widgets/app_scaffold.dart';
import '../shared/widgets/hotkey_bar.dart';

class _NavItem {
  const _NavItem(this.label, this.icon, this.page);

  final String label;
  final IconData icon;
  final Widget page;
}

/// Abhi simple menu. Baad me router.dart se navigation jodenge.
class HomeShell extends StatefulWidget {
  const HomeShell({super.key});

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  int _index = 0;

  static const _items = <_NavItem>[
    _NavItem('Billing', Icons.receipt_long, BillingScreen()),
    _NavItem('Items', Icons.tire_repair, PlaceholderScreen('Items')),
    _NavItem('Customers', Icons.people, PlaceholderScreen('Customers')),
    _NavItem('Purchase', Icons.local_shipping, PlaceholderScreen('Purchase')),
    _NavItem('Stock', Icons.inventory_2, PlaceholderScreen('Stock')),
    _NavItem('Reports', Icons.bar_chart, PlaceholderScreen('Reports')),
    _NavItem('Settings', Icons.settings, PlaceholderScreen('Settings')),
  ];

  static const _hotkeys = <HotkeyHint>[
    HotkeyHint('F2', 'New Bill'),
    HotkeyHint('F4', 'Payment'),
    HotkeyHint('F8', 'Save'),
    HotkeyHint('F9', 'Print'),
    HotkeyHint('Esc', 'Back'),
  ];

  @override
  Widget build(BuildContext context) {
    return AppScaffold(
      hotkeys: _hotkeys,
      sidebar: Container(
        color: AppColors.surface,
        child: ListView(
          children: [
            for (var i = 0; i < _items.length; i++)
              ListTile(
                selected: i == _index,
                selectedTileColor: AppColors.background,
                leading: Icon(_items[i].icon),
                title: Text(_items[i].label),
                onTap: () => setState(() => _index = i),
              ),
          ],
        ),
      ),
      body: _items[_index].page,
    );
  }
}
