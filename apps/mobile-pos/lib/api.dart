import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

/// Thin client for the Shiv Shankar Tyres cloud API (cmd/apiserver).
/// Stores the server URL + auth token on the device.
class Api {
  static String baseUrl = '';
  static String token = '';
  static Map<String, dynamic> user = {};

  static Future<void> load() async {
    final p = await SharedPreferences.getInstance();
    baseUrl = p.getString('base_url') ?? 'http://10.0.2.2:8099';
    token = p.getString('token') ?? '';
    final u = p.getString('user');
    if (u != null && u.isNotEmpty) {
      try {
        user = jsonDecode(u) as Map<String, dynamic>;
      } catch (_) {}
    }
  }

  static Future<void> _save() async {
    final p = await SharedPreferences.getInstance();
    await p.setString('base_url', baseUrl);
    await p.setString('token', token);
    await p.setString('user', jsonEncode(user));
  }

  static bool get isLoggedIn => token.isNotEmpty;

  static Uri _u(String path, [Map<String, String>? q]) =>
      Uri.parse('$baseUrl$path').replace(queryParameters: q);

  static Map<String, String> get _headers => {
        'Content-Type': 'application/json',
        if (token.isNotEmpty) 'Authorization': 'Bearer $token',
      };

  /// Logs in with email+password (or PIN). Persists token + server URL.
  static Future<void> login({
    required String serverUrl,
    String email = '',
    String password = '',
    String pin = '',
  }) async {
    baseUrl = serverUrl.trim().replaceAll(RegExp(r'/+$'), '');
    final body = pin.isNotEmpty
        ? {'pin': pin}
        : {'email': email.trim(), 'password': password};
    final res = await http
        .post(_u('/api/login'), headers: _headers, body: jsonEncode(body))
        .timeout(const Duration(seconds: 15));
    final data = jsonDecode(res.body) as Map<String, dynamic>;
    if (res.statusCode != 200) {
      throw Exception(data['error'] ?? 'Login failed');
    }
    token = data['token'] as String;
    user = (data['user'] as Map<String, dynamic>?) ?? {};
    await _save();
  }

  static Future<void> logout() async {
    token = '';
    user = {};
    await _save();
  }

  static Future<List<dynamic>> products(String q) async {
    final res = await http
        .get(_u('/api/products', {'q': q}), headers: _headers)
        .timeout(const Duration(seconds: 15));
    if (res.statusCode != 200) throw Exception('Failed to load products');
    return (jsonDecode(res.body) as List<dynamic>?) ?? [];
  }

  static Future<Map<String, dynamic>> createSale(
      Map<String, dynamic> draft) async {
    final res = await http
        .post(_u('/api/sales'), headers: _headers, body: jsonEncode(draft))
        .timeout(const Duration(seconds: 20));
    final data = jsonDecode(res.body) as Map<String, dynamic>;
    if (res.statusCode != 201 && res.statusCode != 200) {
      throw Exception(data['error'] ?? 'Sale failed');
    }
    return data;
  }
}

/// Picks the MRP (or first) price in paise from a product's `prices` list.
int mrpPaise(Map<String, dynamic> product) {
  final prices = (product['prices'] as List<dynamic>?) ?? [];
  for (final p in prices) {
    if ((p as Map)['tier'] == 'MRP') return (p['pricePaise'] as num).toInt();
  }
  if (prices.isNotEmpty) {
    return ((prices.first as Map)['pricePaise'] as num).toInt();
  }
  return 0;
}

String rupees(int paise) {
  final v = paise / 100.0;
  return '₹${v.toStringAsFixed(2)}';
}
