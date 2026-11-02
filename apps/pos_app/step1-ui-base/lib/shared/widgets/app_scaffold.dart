import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import 'hotkey_bar.dart';

/// Har screen ka common frame: upar bar, left menu, beech me kaam, neeche hotkey bar.
class AppScaffold extends StatelessWidget {
  const AppScaffold({
    super.key,
    required this.sidebar,
    required this.body,
    required this.hotkeys,
    this.storeName = 'Shiv Shankar Tyres',
    this.userLabel = 'Owner',
  });

  final Widget sidebar;
  final Widget body;
  final List<HotkeyHint> hotkeys;
  final String storeName;
  final String userLabel;

  String _today() {
    final d = DateTime.now();
    final dd = d.day.toString().padLeft(2, '0');
    final mm = d.month.toString().padLeft(2, '0');
    return '$dd-$mm-${d.year}';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Column(
        children: [
          Container(
            height: 48,
            color: AppColors.primary,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(
              children: [
                Text(
                  storeName,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const Spacer(),
                Text(
                  userLabel,
                  style: const TextStyle(color: Colors.white70),
                ),
                const SizedBox(width: 20),
                Text(
                  _today(),
                  style: const TextStyle(color: Colors.white70),
                ),
              ],
            ),
          ),
          Expanded(
            child: Row(
              children: [
                SizedBox(width: 210, child: sidebar),
                const VerticalDivider(width: 1),
                Expanded(child: body),
              ],
            ),
          ),
          HotkeyBar(items: hotkeys),
        ],
      ),
    );
  }
}
