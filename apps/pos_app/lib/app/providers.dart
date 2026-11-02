import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../database/app_database.dart';
import '../features/items/data/items_repository_impl.dart';
import '../features/items/domain/items_repository.dart';
import '../features/billing/data/offline_billing_repository.dart';
import '../features/customers/data/customers_repository.dart';

final billingRepositoryProvider =
    Provider.family<OfflineBillingRepository, AppDatabase>(
      (ref, database) => OfflineBillingRepository(database),
    );

final customersRepositoryProvider =
    Provider.family<CustomersRepository, AppDatabase>(
      (ref, database) => CustomersRepository(database),
    );

final databaseProvider = FutureProvider<AppDatabase>((ref) async {
  final database = await AppDatabase.open();
  ref.onDispose(database.close);
  return database;
});

final itemsRepositoryProvider = Provider.family<ItemsRepository, AppDatabase>(
  (ref, database) => ItemsRepositoryImpl(database),
);
