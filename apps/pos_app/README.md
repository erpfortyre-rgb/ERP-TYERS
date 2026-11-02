# Shiv Shankar Tyres POS

Flutter app for the Windows desktop POS and Android app.

## Run

```powershell
flutter pub get
flutter run -d windows
flutter run -d <android-device-id>
```

## Current local POS features

- Local SQLCipher database and migrations.
- Five effective-dated product rates: MRP and CMP A-D, with recent price
  history. CMP customer eligibility is not configured.
- Offline invoices with product search, barcode lookup, rate selection,
  integer-paise price snapshots, split payment allocations, stock movements,
  and a sync outbox.
- Tyre kits expand into component invoice lines; component stock changes only
  when the invoice transaction is finalized.
- Draft vehicle finance quotations use configured master values and explicit
  amounts; no loan or eligibility formulas are assumed.
- Physical stock audit snapshots with append-only edits and a database-enforced
  three-edit lock. Physical counts do not automatically adjust stock.
- Period freeze controls block invoice finalization during a frozen range.
  Unfreeze remains disabled pending an approved authorization policy.
- Management register options and a reusable register-selection confirmation
  component are ready for future voucher workflows; vouchers are not yet
  implemented.
- Phase 5 provides local supplier management, purchase drafts, guarded atomic
  purchase posting, stock-inward movements, configurable chart-of-account
  mappings, posted purchase journals, customer ledgers, and purchase returns
  saved for review. A return draft does not adjust stock or supplier balances.
- Purchase posting is blocked by relevant period freezes, missing configured
  product tax, or missing accounting mappings. No selling prices are changed.
- Cash/bank books, expense posting, receipt/payment vouchers, complete supplier
  settlement ledgers, and P&L remain unavailable. Digital sale allocations
  remain unverified and are not treated as settled bank receipts.
- Billing keyboard shortcuts: F2 new invoice, F4 payment, F6 add item,
  F8 product search and F9 barcode. Escape remains available for dialog
  dismissal.

Several navigation destinations (including customer, purchase, stock
management and reports) remain placeholders. Local UPI/card payments are
recorded as unverified; the app does not contact payment providers or a server.
Read [the Phase 4 audit](docs/desktop-phase4-audit.md) for implementation
boundaries and unresolved client policies.
Read [the Phase 5 audit](docs/desktop-phase5-audit.md) for current accounting
boundaries and remaining work.

## Verify

```powershell
flutter analyze
flutter test
flutter build apk --debug
```
