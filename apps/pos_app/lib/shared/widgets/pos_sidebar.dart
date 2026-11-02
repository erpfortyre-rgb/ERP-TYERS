import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';

class PosNavItem {
  const PosNavItem(this.label, this.icon);

  final String label;
  final IconData icon;
}

class PosSidebar extends StatelessWidget {
  const PosSidebar({
    super.key,
    required this.items,
    required this.selectedIndex,
    required this.onSelect,
    this.compact = false,
  });

  final List<PosNavItem> items;
  final int selectedIndex;
  final ValueChanged<int> onSelect;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: AppColors.sidebar,
      child: Column(
        children: [
          Padding(
            padding: EdgeInsets.fromLTRB(compact ? 10 : 18, 18, 12, 18),
            child: Row(
              children: [
                Container(
                  width: 38,
                  height: 38,
                  decoration: BoxDecoration(
                    color: AppColors.primary,
                    borderRadius: BorderRadius.circular(AppColors.radiusSmall),
                  ),
                  child: const Icon(Icons.tire_repair, color: Colors.white),
                ),
                if (!compact) ...[
                  const SizedBox(width: 10),
                  const Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'SHIV SHANKAR',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 12,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 0.6,
                          ),
                        ),
                        Text(
                          'TYRES  ·  POS',
                          style: TextStyle(
                            color: Color(0xFF94A3B8),
                            fontSize: 10,
                            letterSpacing: 1.1,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ],
            ),
          ),
          Padding(
            padding: EdgeInsets.symmetric(horizontal: compact ? 10 : 16),
            child: Align(
              alignment: Alignment.centerLeft,
              child: compact
                  ? const SizedBox.shrink()
                  : const Text(
                      'WORKSPACE',
                      style: TextStyle(
                        color: Color(0xFF64748B),
                        fontSize: 10,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 1.2,
                      ),
                    ),
            ),
          ),
          const SizedBox(height: 8),
          Expanded(
            child: ListView.builder(
              padding: EdgeInsets.symmetric(horizontal: compact ? 8 : 10),
              itemCount: items.length,
              itemBuilder: (context, index) {
                final item = items[index];
                final selected = index == selectedIndex;
                final tile = Material(
                  color: selected
                      ? const Color(0xFF1E3A5F)
                      : Colors.transparent,
                  borderRadius: BorderRadius.circular(AppColors.radiusSmall),
                  child: InkWell(
                    borderRadius: BorderRadius.circular(AppColors.radiusSmall),
                    onTap: () => onSelect(index),
                    hoverColor: Colors.white.withValues(alpha: 0.07),
                    focusColor: Colors.white.withValues(alpha: 0.1),
                    child: Container(
                      height: 42,
                      padding: EdgeInsets.symmetric(
                        horizontal: compact ? 0 : 12,
                      ),
                      alignment: compact ? Alignment.center : null,
                      child: Row(
                        mainAxisAlignment: compact
                            ? MainAxisAlignment.center
                            : MainAxisAlignment.start,
                        children: [
                          Icon(
                            item.icon,
                            size: 19,
                            color: selected
                                ? Colors.white
                                : const Color(0xFF94A3B8),
                          ),
                          if (!compact) ...[
                            const SizedBox(width: 12),
                            Expanded(
                              child: Text(
                                item.label,
                                style: TextStyle(
                                  color: selected
                                      ? Colors.white
                                      : const Color(0xFFCBD5E1),
                                  fontSize: 13,
                                  fontWeight: selected
                                      ? FontWeight.w600
                                      : FontWeight.w400,
                                ),
                              ),
                            ),
                            if (selected)
                              Container(
                                width: 4,
                                height: 20,
                                decoration: BoxDecoration(
                                  color: const Color(0xFF60A5FA),
                                  borderRadius: BorderRadius.circular(4),
                                ),
                              ),
                          ],
                        ],
                      ),
                    ),
                  ),
                );
                return Padding(
                  padding: const EdgeInsets.only(bottom: 4),
                  child: compact
                      ? Tooltip(message: item.label, child: tile)
                      : tile,
                );
              },
            ),
          ),
          Container(
            margin: EdgeInsets.all(compact ? 8 : 12),
            padding: EdgeInsets.all(compact ? 8 : 12),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.06),
              borderRadius: BorderRadius.circular(AppColors.radiusSmall),
            ),
            child: Row(
              mainAxisAlignment: compact
                  ? MainAxisAlignment.center
                  : MainAxisAlignment.start,
              children: [
                const CircleAvatar(
                  radius: 16,
                  backgroundColor: Color(0xFF334155),
                  child: Icon(
                    Icons.person_outline,
                    size: 18,
                    color: Colors.white,
                  ),
                ),
                if (!compact) ...[
                  const SizedBox(width: 9),
                  const Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'User session',
                          style: TextStyle(color: Colors.white, fontSize: 12),
                        ),
                        Text(
                          'Not signed in',
                          style: TextStyle(
                            color: Color(0xFF94A3B8),
                            fontSize: 10,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}
