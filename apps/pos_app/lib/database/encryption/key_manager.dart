import 'dart:convert';
import 'dart:math';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

abstract interface class DatabaseKeyStore {
  Future<String?> readKey();
  Future<void> writeKey(String key);
}

class PlatformDatabaseKeyStore implements DatabaseKeyStore {
  PlatformDatabaseKeyStore({FlutterSecureStorage? storage})
    : _storage = storage ?? FlutterSecureStorage();

  static const keyName = 'pos_app.sqlcipher.key.v1';
  final FlutterSecureStorage _storage;

  @override
  Future<String?> readKey() => _storage.read(key: keyName);

  @override
  Future<void> writeKey(String key) => _storage.write(key: keyName, value: key);
}

class DatabaseKeyManager {
  DatabaseKeyManager(this._store);

  final DatabaseKeyStore _store;

  Future<String> loadOrCreate({required bool databaseExists}) async {
    final stored = await _store.readKey();
    if (stored != null) {
      _decodeAndValidate(stored);
      return stored;
    }
    if (databaseExists) {
      throw const DatabaseKeyUnavailableException(
        'The database key is missing from secure storage. The existing database was left untouched.',
      );
    }

    final bytes = List<int>.generate(32, (_) => Random.secure().nextInt(256));
    final encoded = base64UrlEncode(bytes);
    await _store.writeKey(encoded);
    return encoded;
  }

  static List<int> decode(String encoded) => _decodeAndValidate(encoded);

  static List<int> _decodeAndValidate(String encoded) {
    try {
      final bytes = base64Url.decode(base64Url.normalize(encoded));
      if (bytes.length != 32) throw const FormatException();
      return bytes;
    } on FormatException {
      throw const DatabaseKeyUnavailableException(
        'The locally stored database key is invalid. The database was not opened.',
      );
    }
  }
}

class DatabaseKeyUnavailableException implements Exception {
  const DatabaseKeyUnavailableException(this.message);

  final String message;

  @override
  String toString() => message;
}
