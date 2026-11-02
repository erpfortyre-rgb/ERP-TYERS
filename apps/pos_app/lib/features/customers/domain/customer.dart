class Customer {
  const Customer({
    required this.id,
    required this.name,
    required this.phone,
    required this.gstin,
  });

  final String id;
  final String name;
  final String? phone;
  final String? gstin;

  bool get creditIdentified =>
      (phone?.trim().isNotEmpty ?? false) ||
      (gstin?.trim().isNotEmpty ?? false);
}
