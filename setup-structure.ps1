# setup-structure.ps1
# Shiv Shankar Tyres - repo + pos_app structure generator
# Chalane ka tarika: repo ke root folder (shiv-shankar-tyres) me terminal kholo, phir:
#   powershell -ExecutionPolicy Bypass -File .\setup-structure.ps1
# Pehle se bani hui file ko ye overwrite NAHI karta (main.dart safe hai).

$ErrorActionPreference = "Stop"

function New-EmptyFile($path) {
    if (-not (Test-Path $path)) {
        New-Item -ItemType File -Path $path -Force | Out-Null
    }
}

function New-KeepFolder($path) {
    New-Item -ItemType Directory -Path $path -Force | Out-Null
    New-EmptyFile (Join-Path $path ".gitkeep")
}

# ---------- 1. Root level ----------
$rootFolders = @(
    ".github/workflows",
    "docs/os-books/screenshots",
    "docs/os-books/sample-data",
    "docs/schema",
    "docs/api",
    "docs/setup",
    "apps/web_admin",
    "apps/website",
    "backend"
)
foreach ($f in $rootFolders) { New-KeepFolder $f }

$rootFiles = @(
    "README.md",
    ".github/workflows/pos_app_build.yml",
    ".github/workflows/backend_deploy.yml",
    "docs/decisions.md",
    "docs/os-books/study-notes.md",
    "docs/schema/database-diagram.md",
    "docs/schema/tables.md",
    "docs/api/api-docs.md",
    "docs/setup/setup-guide.md"
)
foreach ($f in $rootFiles) { New-EmptyFile $f }

# .gitignore (sirf agar pehle se nahi hai)
if (-not (Test-Path ".gitignore")) {
@"
# Flutter / Dart
.dart_tool/
build/
.flutter-plugins
.flutter-plugins-dependencies
*.g.dart
*.freezed.dart

# IDE
.idea/
.vscode/
*.iml

# Secrets - kabhi commit mat karna
.env
*.keystore
*.jks

# OS
.DS_Store
Thumbs.db

# Node (web_admin / website / backend)
node_modules/
dist/
.next/
"@ | Set-Content ".gitignore"
}

# ---------- 2. pos_app ----------
$app = "apps/pos_app"

if (-not (Test-Path "$app/pubspec.yaml")) {
    Write-Host "DHYAN: apps/pos_app me Flutter project nahi mila." -ForegroundColor Yellow
    Write-Host "Pehle ye chalao: cd apps ; flutter create --platforms=windows,android pos_app" -ForegroundColor Yellow
    Write-Host "Phir ye script dobara chalao." -ForegroundColor Yellow
    exit 1
}

$lib = "$app/lib"

# Assets
foreach ($f in @("fonts", "images", "icons")) { New-KeepFolder "$app/assets/$f" }

# Tests
$testFiles = @(
    "test/domain/kit_explosion_test.dart",
    "test/domain/invoice_number_test.dart",
    "test/domain/audit_lock_test.dart",
    "test/database/stock_ledger_test.dart"
)
foreach ($f in $testFiles) { New-EmptyFile "$app/$f" }

# lib files (lib/ ke andar ke relative paths)
$files = @(
    "main.dart",

    # app
    "app/app.dart",
    "app/router.dart",
    "app/providers.dart",

    # core
    "core/constants/app_constants.dart",
    "core/constants/roles.dart",
    "core/constants/payment_modes.dart",
    "core/hotkeys/hotkey_map.dart",
    "core/hotkeys/hotkey_scope.dart",
    "core/hotkeys/focus_helpers.dart",
    "core/theme/app_theme.dart",
    "core/theme/app_colors.dart",
    "core/utils/money.dart",
    "core/utils/date_utils.dart",
    "core/utils/uuid_generator.dart",
    "core/utils/validators.dart",
    "core/errors/app_exceptions.dart",
    "core/platform/device_info.dart",
    "core/platform/license_guard.dart",

    # database
    "database/app_database.dart",
    "database/encryption/key_manager.dart",
    "database/migrations/migration_v1.dart",
    "database/tables/base_columns.dart",
    "database/tables/tenants_table.dart",
    "database/tables/stores_table.dart",
    "database/tables/devices_table.dart",
    "database/tables/users_table.dart",
    "database/tables/roles_table.dart",
    "database/tables/categories_table.dart",
    "database/tables/brands_table.dart",
    "database/tables/units_table.dart",
    "database/tables/items_table.dart",
    "database/tables/item_rates_table.dart",
    "database/tables/item_rate_history_table.dart",
    "database/tables/kit_components_table.dart",
    "database/tables/customers_table.dart",
    "database/tables/suppliers_table.dart",
    "database/tables/invoices_table.dart",
    "database/tables/invoice_items_table.dart",
    "database/tables/invoice_payments_table.dart",
    "database/tables/invoice_counters_table.dart",
    "database/tables/quotations_table.dart",
    "database/tables/loan_quotations_table.dart",
    "database/tables/purchases_table.dart",
    "database/tables/purchase_items_table.dart",
    "database/tables/stock_ledger_table.dart",
    "database/tables/stock_audits_table.dart",
    "database/tables/stock_audit_rows_table.dart",
    "database/tables/vouchers_table.dart",
    "database/tables/period_freezes_table.dart",
    "database/tables/audit_flags_table.dart",
    "database/tables/masters_table.dart",
    "database/tables/activity_log_table.dart",
    "database/tables/sync_queue_table.dart",
    "database/tables/sync_state_table.dart",
    "database/daos/items_dao.dart",
    "database/daos/parties_dao.dart",
    "database/daos/invoices_dao.dart",
    "database/daos/stock_dao.dart",
    "database/daos/audit_dao.dart",
    "database/daos/sync_dao.dart",

    # sync
    "sync/sync_service.dart",
    "sync/sync_queue.dart",
    "sync/conflict_resolver.dart",
    "sync/api_client.dart",

    # features/auth
    "features/auth/data/auth_repository_impl.dart",
    "features/auth/domain/user.dart",
    "features/auth/domain/auth_repository.dart",
    "features/auth/domain/permissions.dart",
    "features/auth/presentation/login_screen.dart",

    # features/items
    "features/items/data/items_repository_impl.dart",
    "features/items/domain/item.dart",
    "features/items/domain/item_rate.dart",
    "features/items/domain/rate_tier.dart",
    "features/items/domain/kit.dart",
    "features/items/domain/items_repository.dart",
    "features/items/presentation/item_list_screen.dart",
    "features/items/presentation/item_form_screen.dart",
    "features/items/presentation/kit_form_screen.dart",

    # features/parties
    "features/parties/data/parties_repository_impl.dart",
    "features/parties/domain/customer.dart",
    "features/parties/domain/supplier.dart",
    "features/parties/domain/parties_repository.dart",
    "features/parties/presentation/customer_screen.dart",
    "features/parties/presentation/supplier_screen.dart",
    "features/parties/presentation/ledger_screen.dart",

    # features/billing
    "features/billing/data/billing_repository_impl.dart",
    "features/billing/domain/invoice.dart",
    "features/billing/domain/invoice_item.dart",
    "features/billing/domain/kit_explosion.dart",
    "features/billing/domain/invoice_number.dart",
    "features/billing/domain/rate_resolver.dart",
    "features/billing/domain/billing_repository.dart",
    "features/billing/presentation/billing_screen.dart",
    "features/billing/presentation/invoice_list_screen.dart",

    # features/payments
    "features/payments/data/payments_repository_impl.dart",
    "features/payments/domain/payment_split.dart",
    "features/payments/domain/upi_qr_generator.dart",
    "features/payments/presentation/payment_dialog.dart",
    "features/payments/presentation/upi_qr_widget.dart",

    # features/purchase
    "features/purchase/data/purchase_repository_impl.dart",
    "features/purchase/domain/purchase.dart",
    "features/purchase/domain/purchase_repository.dart",
    "features/purchase/presentation/purchase_screen.dart",
    "features/purchase/presentation/purchase_list_screen.dart",

    # features/stock
    "features/stock/data/stock_repository_impl.dart",
    "features/stock/domain/stock_entry.dart",
    "features/stock/domain/stock_calculator.dart",
    "features/stock/domain/stock_repository.dart",
    "features/stock/presentation/stock_screen.dart",
    "features/stock/presentation/stock_transfer_screen.dart",

    # features/audit
    "features/audit/data/audit_repository_impl.dart",
    "features/audit/domain/stock_audit.dart",
    "features/audit/domain/three_edit_rule.dart",
    "features/audit/domain/period_freeze.dart",
    "features/audit/domain/audit_repository.dart",
    "features/audit/presentation/stock_audit_screen.dart",
    "features/audit/presentation/period_freeze_screen.dart",
    "features/audit/presentation/audit_reminder_dialog.dart",

    # features/quotation
    "features/quotation/data/quotation_repository_impl.dart",
    "features/quotation/domain/quotation.dart",
    "features/quotation/domain/loan_quotation.dart",
    "features/quotation/domain/quotation_repository.dart",
    "features/quotation/presentation/quotation_screen.dart",
    "features/quotation/presentation/loan_quotation_screen.dart",

    # features/vouchers
    "features/vouchers/data/voucher_repository_impl.dart",
    "features/vouchers/domain/voucher.dart",
    "features/vouchers/domain/register_trigger.dart",
    "features/vouchers/presentation/receipt_screen.dart",
    "features/vouchers/presentation/payment_voucher_screen.dart",

    # features/printing
    "features/printing/data/printer_repository_impl.dart",
    "features/printing/domain/escpos_builder.dart",
    "features/printing/domain/print_job.dart",
    "features/printing/presentation/printer_settings_screen.dart",
    "features/printing/presentation/invoice_a4_layout.dart",

    # features/reports
    "features/reports/data/reports_repository_impl.dart",
    "features/reports/domain/sales_report.dart",
    "features/reports/domain/stock_report.dart",
    "features/reports/domain/profit_report.dart",
    "features/reports/presentation/dashboard_screen.dart",
    "features/reports/presentation/reports_screen.dart",

    # features/settings
    "features/settings/presentation/settings_screen.dart",
    "features/settings/presentation/store_settings_screen.dart",
    "features/settings/presentation/backup_screen.dart",

    # shared
    "shared/widgets/keyboard_text_field.dart",
    "shared/widgets/keyboard_data_table.dart",
    "shared/widgets/keyboard_dropdown.dart",
    "shared/widgets/confirm_dialog.dart",
    "shared/widgets/app_scaffold.dart",
    "shared/models/paginated_result.dart"
)

$created = 0
foreach ($rel in $files) {
    $full = "$lib/$rel"
    if (-not (Test-Path $full)) {
        New-EmptyFile $full
        $created++
    }
}

# providers/ aur widgets/ folders (feature presentation ke andar)
$providerFeatures = @("auth","items","parties","billing","payments","purchase","stock","audit","quotation","vouchers","reports")
foreach ($f in $providerFeatures) { New-KeepFolder "$lib/features/$f/presentation/providers" }
$widgetFeatures = @("auth","items","parties","billing")
foreach ($f in $widgetFeatures) { New-KeepFolder "$lib/features/$f/presentation/widgets" }

# Baad me add hone wale features ke liye jagah
foreach ($f in @("gst","accounting","tally")) { New-KeepFolder "$lib/features/$f" }

Write-Host ""
Write-Host "Ho gaya!" -ForegroundColor Green
Write-Host "Nayi files bani: $created" -ForegroundColor Green
Write-Host "Ab 'git add .' aur 'git commit -m `"Initial project structure`"' chalao." -ForegroundColor Green
