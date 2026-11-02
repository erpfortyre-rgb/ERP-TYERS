import 'package:flutter_test/flutter_test.dart';
import 'package:pos_app/features/accounting/domain/accounting.dart';

void main() {
  test('journal accepts equal debits and credits', () {
    expect(
      journalBalances(const [
        JournalAmount(debitPaise: 12500),
        JournalAmount(creditPaise: 12500),
      ]),
      isTrue,
    );
  });

  test('journal rejects imbalance and invalid lines', () {
    expect(
      journalBalances(const [
        JournalAmount(debitPaise: 12500),
        JournalAmount(creditPaise: 12499),
      ]),
      isFalse,
    );
    expect(
      journalBalances(const [
        JournalAmount(debitPaise: 100, creditPaise: 100),
        JournalAmount(debitPaise: 100),
      ]),
      isFalse,
    );
    expect(journalBalances(const []), isFalse);
  });
}
