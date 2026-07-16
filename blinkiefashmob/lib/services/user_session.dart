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

  bool get isLoggedIn => token != null && token!.isNotEmpty;

  static const _keyUserId = 'userId';
  static const _keyName = 'name';
  static const _keyPhone = 'phone';
  static const _keyEmail = 'email';
  static const _keyRole = 'role';
  static const _keyToken = 'token';

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
    required String userId,
    required String name,
    required String email,
    String? phone,
  }) async {
    this.userId = userId;
    this.name = name;
    this.email = email;
    this.phone = phone;
    role = 'vendor';
    token = '';
    await _saveToPrefs();
  }

  Future<void> clear() async {
    userId = null;
    name = null;
    phone = null;
    role = null;
    token = null;
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
  }

  Future<void> _saveToPrefs() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_keyUserId, userId ?? '');
    await prefs.setString(_keyName, name ?? '');
    await prefs.setString(_keyPhone, phone ?? '');
    await prefs.setString(_keyEmail, email ?? '');
    await prefs.setString(_keyRole, role ?? '');
    await prefs.setString(_keyToken, token ?? '');
  }

  Future<void> _clearPrefs() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_keyUserId);
    await prefs.remove(_keyName);
    await prefs.remove(_keyPhone);
    await prefs.remove(_keyEmail);
    await prefs.remove(_keyRole);
    await prefs.remove(_keyToken);
  }
}
