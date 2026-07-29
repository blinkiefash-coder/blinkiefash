import 'package:shared_preferences/shared_preferences.dart';

class UserSession {
  UserSession._();
  static final UserSession instance = UserSession._();

  String? userId;
  String? name;
  String? phone;
  String? email;
  String? role;
  String? token;
  String? vendorId;
  String? vendorStoreName;
  String? vendorEmail;

  bool get isLoggedIn {
    final hasToken = token != null && token!.isNotEmpty;
    final isVendorSession =
        role == 'vendor' && userId != null && userId!.isNotEmpty;
    return hasToken || isVendorSession;
  }

  static const _keyUserId = 'userId';
  static const _keyName = 'name';
  static const _keyPhone = 'phone';
  static const _keyEmail = 'email';
  static const _keyRole = 'role';
  static const _keyToken = 'token';
  static const _keyVendorId = 'vendorId';
  static const _keyVendorStoreName = 'vendorStoreName';
  static const _keyVendorEmail = 'vendorEmail';

  Future<void> setFromLoginResponse(Map<String, dynamic> response) async {
    final user = response['user'] as Map<String, dynamic>? ?? {};
    userId = (user['id'] ?? '').toString();
    name = (user['name'] ?? '').toString();
    phone = (user['phone'] ?? '').toString();
    role = (user['role'] ?? '').toString();
    token = (response['token'] ?? '').toString();
    await _saveToPrefs();
  }

  Future<void> setVendorSession({
    required String vendorId,
    required String userId,
    required String name,
    required String email,
    String? phone,
  }) async {
    this.vendorId = vendorId;
    vendorStoreName = name;
    vendorEmail = email;
    this.userId = userId;
    this.name = name;
    this.email = email;
    this.phone = phone;
    role = 'vendor';
    token = 'vendor-session';
    await _saveToPrefs();
  }

  Future<void> clear() async {
    userId = null;
    name = null;
    phone = null;
    role = null;
    token = null;
    vendorId = null;
    vendorStoreName = null;
    vendorEmail = null;
    await _clearPrefs();
  }

  Future<void> loadFromPrefs() async {
    final prefs = await SharedPreferences.getInstance();
    userId = prefs.getString(_keyUserId);
    name = prefs.getString(_keyName);
    phone = prefs.getString(_keyPhone);
    email = prefs.getString(_keyEmail);
    role = prefs.getString(_keyRole);
    token = prefs.getString(_keyToken);
    vendorId = prefs.getString(_keyVendorId);
    vendorStoreName = prefs.getString(_keyVendorStoreName);
    vendorEmail = prefs.getString(_keyVendorEmail);
  }

  Future<void> _saveToPrefs() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_keyUserId, userId ?? '');
    await prefs.setString(_keyName, name ?? '');
    await prefs.setString(_keyPhone, phone ?? '');
    await prefs.setString(_keyEmail, email ?? '');
    await prefs.setString(_keyRole, role ?? '');
    await prefs.setString(_keyToken, token ?? '');
    await prefs.setString(_keyVendorId, vendorId ?? '');
    await prefs.setString(_keyVendorStoreName, vendorStoreName ?? '');
    await prefs.setString(_keyVendorEmail, vendorEmail ?? '');
  }

  Future<void> _clearPrefs() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_keyUserId);
    await prefs.remove(_keyName);
    await prefs.remove(_keyPhone);
    await prefs.remove(_keyEmail);
    await prefs.remove(_keyRole);
    await prefs.remove(_keyToken);
    await prefs.remove(_keyVendorId);
    await prefs.remove(_keyVendorStoreName);
    await prefs.remove(_keyVendorEmail);
  }
}
