class SupplierRecord {
  const SupplierRecord({
    required this.id,
    required this.code,
    required this.businessName,
    required this.contactPerson,
    required this.phone,
    required this.email,
    required this.gstin,
    required this.billingAddress,
    required this.state,
    required this.isActive,
  });

  final String id;
  final String code;
  final String businessName;
  final String? contactPerson;
  final String? phone;
  final String? email;
  final String? gstin;
  final String? billingAddress;
  final String? state;
  final bool isActive;
}

class SupplierDraft {
  const SupplierDraft({
    this.id,
    required this.code,
    required this.businessName,
    this.contactPerson,
    this.phone,
    this.email,
    this.gstin,
    this.billingAddress,
    this.state,
    this.isActive = true,
  });

  final String? id;
  final String code;
  final String businessName;
  final String? contactPerson;
  final String? phone;
  final String? email;
  final String? gstin;
  final String? billingAddress;
  final String? state;
  final bool isActive;
}

class SupplierValidationException implements Exception {
  const SupplierValidationException(this.message);
  final String message;
  @override
  String toString() => message;
}
