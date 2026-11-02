enum AccountCategory {
  asset('ASSET', 'Assets'),
  liability('LIABILITY', 'Liabilities'),
  equity('EQUITY', 'Equity'),
  income('INCOME', 'Income'),
  expense('EXPENSE', 'Expenses');

  const AccountCategory(this.value, this.label);
  final String value;
  final String label;

  static AccountCategory fromValue(String value) =>
      values.firstWhere((category) => category.value == value);
}

enum AccountMappingPurpose {
  purchaseInventory('PURCHASE_INVENTORY', 'Purchase inventory', 'ASSET'),
  supplierPayable('SUPPLIER_PAYABLE', 'Supplier payable', 'LIABILITY'),
  purchaseTaxInput('PURCHASE_TAX_INPUT', 'Purchase tax input', 'ASSET');

  const AccountMappingPurpose(this.value, this.label, this.requiredCategory);
  final String value;
  final String label;
  final String requiredCategory;
}

class LedgerAccount {
  const LedgerAccount({
    required this.id,
    required this.code,
    required this.name,
    required this.category,
    required this.isActive,
  });

  final String id;
  final String code;
  final String name;
  final AccountCategory category;
  final bool isActive;
}

class AccountLedgerEntry {
  const AccountLedgerEntry({
    required this.date,
    required this.sourceType,
    required this.sourceId,
    required this.narration,
    required this.debitPaise,
    required this.creditPaise,
    required this.balancePaise,
  });

  final DateTime date;
  final String sourceType;
  final String sourceId;
  final String narration;
  final int debitPaise;
  final int creditPaise;
  final int balancePaise;
}

class JournalAmount {
  const JournalAmount({this.debitPaise = 0, this.creditPaise = 0});
  final int debitPaise;
  final int creditPaise;
}

bool journalBalances(Iterable<JournalAmount> lines) {
  var debit = 0;
  var credit = 0;
  var lineCount = 0;
  for (final line in lines) {
    if (line.debitPaise < 0 ||
        line.creditPaise < 0 ||
        (line.debitPaise > 0 && line.creditPaise > 0) ||
        (line.debitPaise == 0 && line.creditPaise == 0)) {
      return false;
    }
    debit += line.debitPaise;
    credit += line.creditPaise;
    lineCount++;
  }
  return lineCount >= 2 && debit > 0 && debit == credit;
}
