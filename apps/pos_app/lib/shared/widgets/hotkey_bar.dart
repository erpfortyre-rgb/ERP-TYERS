import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';

class HotkeyHint {
  const HotkeyHint(this.keyLabel, this.label);

  final String keyLabel;
  final String label;
}

/// Screen ke neeche ki bar: kaunsi key kya karti hai.
class HotkeyBar extends StatelessWidget {
  const HotkeyBar({super.key, required this.items});

  final List<HotkeyHint> items;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 36,
      color: AppColors.primary,
      padding: const EdgeInsets.symmetric(horizontal: 12),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          children: [
            for (final item in items)
              Padding(
                padding: const EdgeInsets.only(right: 22),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 6,
                        vertical: 2,
                      ),
                      decoration: BoxDecoration(
                        color: AppColors.accent,
                        borderRadius: BorderRadius.circular(3),
                      ),
                      child: Text(
                        item.keyLabel,
                        style: const TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 12,
                          color: AppColors.textDark,
                        ),
                      ),
                    ),
                    const SizedBox(width: 6),
                    Text(
                      item.label,
                      style: const TextStyle(color: Colors.white, fontSize: 13),
                    ),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }
}
