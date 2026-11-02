import 'package:flutter/material.dart';

import '../features/billing/presentation/billing_screen.dart';
import '../features/billing/presentation/invoice_list_screen.dart';
import '../features/common/placeholder_screen.dart';
import '../features/accounting/presentation/accounting_screen.dart';
import '../features/audit/presentation/period_freeze_screen.dart';
import '../features/audit/presentation/physical_stock_audit_screen.dart';
import '../features/items/presentation/item_list_screen.dart';
import '../features/items/presentation/kits_screen.dart';
import '../features/parties/presentation/customer_screen.dart';
import '../features/parties/presentation/supplier_screen.dart';
import '../features/purchase/presentation/purchase_screen.dart';
import '../features/quotation/presentation/finance_quotation_screen.dart';
import '../features/settings/presentation/settings_screen.dart';
import '../features/vouchers/presentation/management_registers_screen.dart';
import '../shared/widgets/app_scaffold.dart';
import '../shared/widgets/hotkey_bar.dart';
import '../shared/widgets/pos_sidebar.dart';

class HomeShell extends StatefulWidget {
  const HomeShell({super.key});

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  final _scaffoldKey = GlobalKey<ScaffoldState>();
  int _index = 0;
  bool _sidebarCollapsed = false;

  static const _items = <PosNavItem>[
    PosNavItem('Billing', Icons.receipt_long),
    PosNavItem('Invoices', Icons.receipt_outlined),
    PosNavItem('Items', Icons.tire_repair),
    PosNavItem('Kits', Icons.widgets_outlined),
    PosNavItem('Customers', Icons.people_outline),
    PosNavItem('Suppliers', Icons.local_shipping_outlined),
    PosNavItem('Purchase', Icons.local_shipping_outlined),
    PosNavItem('Accounting', Icons.account_balance_outlined),
    PosNavItem('Stock', Icons.inventory_2_outlined),
    PosNavItem('Stock Audit', Icons.fact_check_outlined),
    PosNavItem('Finance Quotes', Icons.request_quote_outlined),
    PosNavItem('Period Freeze', Icons.lock_clock_outlined),
    PosNavItem('Registers', Icons.list_alt_outlined),
    PosNavItem('Reports', Icons.bar_chart_outlined),
    PosNavItem('Settings', Icons.settings_outlined),
  ];

  static const _pages = <Widget>[
    BillingScreen(),
    InvoiceListScreen(),
    ItemListScreen(),
    KitsScreen(),
    CustomerScreen(),
    SupplierScreen(),
    PurchaseScreen(),
    AccountingScreen(),
    PlaceholderScreen('Stock'),
    PhysicalStockAuditScreen(),
    FinanceQuotationScreen(),
    PeriodFreezeScreen(),
    ManagementRegistersScreen(),
    PlaceholderScreen('Reports'),
    SettingsScreen(),
  ];

  static const _hotkeys = <HotkeyHint>[
    HotkeyHint('F2', 'New invoice'),
    HotkeyHint('F4', 'Payment'),
    HotkeyHint('F6', 'Add item'),
    HotkeyHint('F8', 'Product search'),
    HotkeyHint('F9', 'Barcode'),
    HotkeyHint('Esc', 'Close / customer'),
  ];

  void _selectNavigation(int index) {
    setState(() => _index = index);
    if (MediaQuery.sizeOf(context).width < 760) {
      _scaffoldKey.currentState?.closeDrawer();
    }
  }

  Widget _sidebar({required bool compact}) => PosSidebar(
    items: _items,
    selectedIndex: _index,
    compact: compact,
    onSelect: _selectNavigation,
  );

  @override
  Widget build(BuildContext context) {
    final width = MediaQuery.sizeOf(context).width;
    return AppScaffold(
      scaffoldKey: _scaffoldKey,
      pageTitle: _items[_index].label,
      sidebar: _sidebar(compact: false),
      collapsedSidebar: _sidebar(compact: true),
      sidebarCollapsed: _sidebarCollapsed,
      onToggleSidebar: () {
        if (width < 760) {
          _scaffoldKey.currentState?.openDrawer();
        } else {
          setState(() => _sidebarCollapsed = !_sidebarCollapsed);
        }
      },
      hotkeys: _hotkeys,
      body: _pages[_index],
    );
  }
}
