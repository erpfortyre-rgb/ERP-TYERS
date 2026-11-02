import 'package:flutter/material.dart';
import 'api.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Api.load();
  runApp(const PosApp());
}

const seed = Color(0xFF1976D2);

class PosApp extends StatelessWidget {
  const PosApp({super.key});
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Shiv Shankar Tyres POS',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(colorSchemeSeed: seed, useMaterial3: true),
      home: Api.isLoggedIn ? const PosPage() : const LoginPage(),
    );
  }
}

// ─────────────────────────────── Login ───────────────────────────────
class LoginPage extends StatefulWidget {
  const LoginPage({super.key});
  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final _url = TextEditingController(text: Api.baseUrl);
  final _email = TextEditingController(text: 'owner@sst.local');
  final _pass = TextEditingController();
  bool _busy = false;
  String? _err;

  Future<void> _login() async {
    setState(() { _busy = true; _err = null; });
    try {
      await Api.login(serverUrl: _url.text, email: _email.text, password: _pass.text);
      if (mounted) {
        Navigator.of(context).pushReplacement(MaterialPageRoute(builder: (_) => const PosPage()));
      }
    } catch (e) {
      setState(() => _err = e.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 400),
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              const Icon(Icons.store, size: 56, color: seed),
              const SizedBox(height: 10),
              const Text('Shiv Shankar Tyres', style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
              const Text('POS Login', style: TextStyle(color: Colors.grey)),
              const SizedBox(height: 24),
              TextField(controller: _url, decoration: const InputDecoration(labelText: 'Server URL', border: OutlineInputBorder(), prefixIcon: Icon(Icons.cloud))),
              const SizedBox(height: 12),
              TextField(controller: _email, decoration: const InputDecoration(labelText: 'Email', border: OutlineInputBorder(), prefixIcon: Icon(Icons.person))),
              const SizedBox(height: 12),
              TextField(controller: _pass, obscureText: true, onSubmitted: (_) => _login(), decoration: const InputDecoration(labelText: 'Password', border: OutlineInputBorder(), prefixIcon: Icon(Icons.lock))),
              if (_err != null) Padding(padding: const EdgeInsets.only(top: 12), child: Text(_err!, style: const TextStyle(color: Colors.red))),
              const SizedBox(height: 18),
              SizedBox(width: double.infinity, child: FilledButton(
                onPressed: _busy ? null : _login,
                child: Padding(padding: const EdgeInsets.all(12), child: Text(_busy ? 'Signing in…' : 'Sign In')),
              )),
            ]),
          ),
        ),
      ),
    );
  }
}

// ─────────────────────────────── POS ───────────────────────────────
class PosPage extends StatefulWidget {
  const PosPage({super.key});
  @override
  State<PosPage> createState() => _PosPageState();
}

class _PosPageState extends State<PosPage> {
  final _search = TextEditingController();
  List<dynamic> _products = [];
  final Map<String, Map<String, dynamic>> _cart = {}; // productId -> {product, qty}
  bool _loading = false;
  bool _checkout = false;

  @override
  void initState() {
    super.initState();
    _load('');
  }

  Future<void> _load(String q) async {
    setState(() => _loading = true);
    try {
      final list = await Api.products(q);
      setState(() => _products = list);
    } catch (e) {
      _snack(e.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _snack(String m) {
    if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(m)));
  }

  void _add(Map<String, dynamic> p) {
    final id = p['id'] as String;
    setState(() {
      if (_cart.containsKey(id)) {
        _cart[id]!['qty'] = (_cart[id]!['qty'] as int) + 1;
      } else {
        _cart[id] = {'product': p, 'qty': 1};
      }
    });
  }

  void _setQty(String id, int qty) {
    setState(() {
      if (qty <= 0) {
        _cart.remove(id);
      } else {
        _cart[id]!['qty'] = qty;
      }
    });
  }

  int get _total => _cart.values.fold(0, (s, c) => s + mrpPaise(c['product']) * (c['qty'] as int));
  int get _count => _cart.values.fold(0, (s, c) => s + (c['qty'] as int));

  Future<void> _finalize() async {
    if (_cart.isEmpty) return;
    setState(() => _checkout = true);
    try {
      final lines = _cart.values.map((c) {
        final p = c['product'] as Map<String, dynamic>;
        return {
          'productId': p['id'],
          'productName': p['name'],
          'hsnCode': p['hsnCode'] ?? '',
          'quantityMillis': (c['qty'] as int) * 1000,
          'priceTier': 'MRP',
          'unitPricePaise': mrpPaise(p),
          'discountPaise': 0,
          'taxPercent': (p['taxPercent'] as num?)?.toInt() ?? 0,
        };
      }).toList();
      final draft = {
        'customerId': '',
        'lines': lines,
        'payments': [{'method': 'CASH', 'amountPaise': _total, 'referenceNumber': ''}],
        'notes': '',
        'terms': '',
      };
      final res = await Api.createSale(draft);
      _snack('Invoice ${res['invoiceNumber'] ?? ''} saved');
      setState(() => _cart.clear());
      _load(_search.text);
    } catch (e) {
      _snack(e.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _checkout = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('POS Billing'),
        backgroundColor: seed,
        foregroundColor: Colors.white,
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: () async {
              final nav = Navigator.of(context);
              await Api.logout();
              nav.pushReplacement(MaterialPageRoute(builder: (_) => const LoginPage()));
            },
          ),
        ],
      ),
      body: Column(children: [
        Padding(
          padding: const EdgeInsets.all(10),
          child: TextField(
            controller: _search,
            onChanged: (v) => _load(v),
            decoration: const InputDecoration(
              hintText: 'Search products…',
              prefixIcon: Icon(Icons.search),
              border: OutlineInputBorder(),
              isDense: true,
            ),
          ),
        ),
        Expanded(
          child: _loading
              ? const Center(child: CircularProgressIndicator())
              : ListView.separated(
                  itemCount: _products.length,
                  separatorBuilder: (_, _) => const Divider(height: 1),
                  itemBuilder: (_, i) {
                    final p = _products[i] as Map<String, dynamic>;
                    final stock = ((p['stockQtyMillis'] as num?)?.toInt() ?? 0) / 1000;
                    return ListTile(
                      title: Text(p['name'] ?? ''),
                      subtitle: Text('${rupees(mrpPaise(p))}  ·  ${stock.toStringAsFixed(0)} in stock'),
                      trailing: const Icon(Icons.add_circle, color: seed),
                      onTap: () => _add(p),
                    );
                  },
                ),
        ),
      ]),
      bottomNavigationBar: _cart.isEmpty
          ? null
          : SafeArea(
              child: Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(border: Border(top: BorderSide(color: Colors.grey.shade300))),
                child: Column(mainAxisSize: MainAxisSize.min, children: [
                  ..._cart.entries.map((e) {
                    final p = e.value['product'] as Map<String, dynamic>;
                    final qty = e.value['qty'] as int;
                    return Row(children: [
                      Expanded(child: Text(p['name'] ?? '', overflow: TextOverflow.ellipsis)),
                      IconButton(icon: const Icon(Icons.remove_circle_outline), onPressed: () => _setQty(e.key, qty - 1)),
                      Text('$qty'),
                      IconButton(icon: const Icon(Icons.add_circle_outline), onPressed: () => _setQty(e.key, qty + 1)),
                      SizedBox(width: 72, child: Text(rupees(mrpPaise(p) * qty), textAlign: TextAlign.right)),
                    ]);
                  }),
                  const Divider(),
                  Row(children: [
                    Text('$_count item(s)', style: const TextStyle(color: Colors.grey)),
                    const Spacer(),
                    Text('Total: ${rupees(_total)}', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                  ]),
                  const SizedBox(height: 8),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton.icon(
                      onPressed: _checkout ? null : _finalize,
                      icon: const Icon(Icons.payments),
                      label: Padding(padding: const EdgeInsets.all(8), child: Text(_checkout ? 'Saving…' : 'Cash Sale  ${rupees(_total)}')),
                    ),
                  ),
                ]),
              ),
            ),
    );
  }
}
