import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import 'hotkey_bar.dart';
import 'pos_header.dart';

class AppScaffold extends StatelessWidget {
  const AppScaffold({
    super.key,
    required this.sidebar,
    required this.body,
    required this.hotkeys,
    required this.pageTitle,
    required this.collapsedSidebar,
    required this.scaffoldKey,
    required this.onToggleSidebar,
    required this.sidebarCollapsed,
  });

  final Widget sidebar;
  final Widget collapsedSidebar;
  final Widget body;
  final List<HotkeyHint> hotkeys;
  final String pageTitle;
  final GlobalKey<ScaffoldState> scaffoldKey;
  final VoidCallback onToggleSidebar;
  final bool sidebarCollapsed;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final compact = constraints.maxWidth < 760;
        return Scaffold(
          key: scaffoldKey,
          drawer: compact ? Drawer(width: 248, child: sidebar) : null,
          body: compact
              ? Column(
                  children: [
                    PosHeader(
                      pageTitle: pageTitle,
                      compact: true,
                      onToggleSidebar: onToggleSidebar,
                    ),
                    Expanded(child: body),
                  ],
                )
              : Column(
                  children: [
                    PosHeader(
                      pageTitle: pageTitle,
                      onToggleSidebar: onToggleSidebar,
                    ),
                    Expanded(
                      child: Row(
                        children: [
                          AnimatedContainer(
                            duration: const Duration(milliseconds: 180),
                            curve: Curves.easeOut,
                            width: sidebarCollapsed ? 76 : 232,
                            child: sidebarCollapsed
                                ? collapsedSidebar
                                : sidebar,
                          ),
                          const VerticalDivider(
                            width: 1,
                            thickness: 1,
                            color: AppColors.border,
                          ),
                          Expanded(child: body),
                        ],
                      ),
                    ),
                    HotkeyBar(items: hotkeys),
                  ],
                ),
        );
      },
    );
  }
}
