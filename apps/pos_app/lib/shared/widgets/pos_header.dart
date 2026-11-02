import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/providers.dart';
import '../../core/theme/app_colors.dart';
import '../../database/app_database.dart';
import '../../features/billing/data/offline_billing_repository.dart';
import 'status_badge.dart';

class PosHeader extends ConsumerWidget {
  const PosHeader({
    super.key,
    required this.pageTitle,
    required this.onToggleSidebar,
    this.compact = false,
  });

  final String pageTitle;
  final VoidCallback onToggleSidebar;
  final bool compact;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final dense = compact || MediaQuery.sizeOf(context).width < 1100;
    final now = DateTime.now();
    final date =
        '${now.day.toString().padLeft(2, '0')}/'
        '${now.month.toString().padLeft(2, '0')}/${now.year}';

    final databaseState = ref.watch(databaseProvider);
    final databaseStatus = databaseState.when(
      loading: () => 'Database opening',
      error: (_, _) => 'Database unavailable',
      data: (database) {
        final diagnostics = database.diagnostics();
        return diagnostics.encryptionVerified && diagnostics.health == 'ok'
            ? 'Database ready'
            : 'Database check failed';
      },
    );
    final billingState = databaseState is AsyncData<AppDatabase>
        ? databaseState.value
        : null;
    final config = billingState == null
        ? null
        : OfflineBillingRepository(billingState).configuration();

    return Container(
      height: 64,
      padding: const EdgeInsets.symmetric(horizontal: 18),
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(bottom: BorderSide(color: AppColors.border)),
      ),
      child: Row(
        children: [
          IconButton(
            tooltip: 'Toggle navigation',
            onPressed: onToggleSidebar,
            icon: const Icon(Icons.menu_open),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  pageTitle,
                  style: const TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textDark,
                  ),
                ),
                if (!dense)
                  Text(
                    config?.prefix == null
                        ? 'Invoice prefix: not configured'
                        : 'Invoice prefix: ${config!.prefix}',
                    style: TextStyle(fontSize: 11, color: AppColors.textMuted),
                  ),
              ],
            ),
          ),
          if (!dense) ...[
            StatusBadge(label: databaseStatus, icon: Icons.storage_outlined),
            const SizedBox(width: 8),
            StatusBadge(
              label: billingState == null
                  ? 'Sync not configured'
                  : 'Sync not configured · ${OfflineBillingRepository(billingState).pendingOutboxCount()} pending',
              icon: Icons.cloud_outlined,
            ),
            const SizedBox(width: 16),
          ],
          const Icon(
            Icons.calendar_today_outlined,
            size: 15,
            color: AppColors.textMuted,
          ),
          const SizedBox(width: 7),
          Text(date, style: const TextStyle(fontSize: 12)),
          if (!dense) ...[
            const SizedBox(width: 16),
            const CircleAvatar(
              radius: 15,
              backgroundColor: Color(0xFFEFF6FF),
              child: Icon(
                Icons.person_outline,
                size: 18,
                color: AppColors.primary,
              ),
            ),
            const SizedBox(width: 7),
            const Text(
              'Not signed in',
              style: TextStyle(fontSize: 12, color: AppColors.textMuted),
            ),
          ],
        ],
      ),
    );
  }
}
