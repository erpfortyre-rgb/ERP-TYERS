import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';

/// Jo screens abhi bani nahi hain unke liye khali jagah.
class PlaceholderScreen extends StatelessWidget {
  const PlaceholderScreen(this.title, {super.key});

  final String title;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Text(
        '$title (jald aayega)',
        style: const TextStyle(fontSize: 20, color: AppColors.textMuted),
      ),
    );
  }
}
