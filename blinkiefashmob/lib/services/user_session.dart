import 'package:shared_preferences/shared_preferences.dart';

class UserSession {
  UserSession._();

  static final UserSession instance = UserSession._();

  String? userId;
  String? vendorId;
  String? name;
  String? phone;
  String? email;
  String? role;

  bool get isLoggedIn =>
      (userId?.isNotEmpty == true) || (vendorId?.isNotEmpty == true);

  Future<void> loadFromPrefs() async {
    final prefs = await SharedPreferences.getInstance();
    userId = prefs.getString('userId');
    vendorId = prefs.getString('vendor_id');
    name = prefs.getString('userName') ?? prefs.getString('vendor_name');
    phone = prefs.getString('userPhone');
    email = prefs.getString('userEmail');
    role = prefs.getString('userRole');
  }

  Future<void> setFromLoginResponse(Map<String, dynamic> response) async {
    final prefs = await SharedPreferences.getInstance();
    final user = response['user'];
    if (user is Map) {
      userId = user['id']?.toString();
      name = user['name']?.toString();
      phone = user['phone']?.toString();
      email = user['email']?.toString();
      role = user['role']?.toString();
      if (userId != null) await prefs.setString('userId', userId!);
      if (name != null) await prefs.setString('userName', name!);
      if (phone != null) await prefs.setString('userPhone', phone!);
      if (email != null) await prefs.setString('userEmail', email!);
      if (role != null) await prefs.setString('userRole', role!);
    }

    vendorId = response['vendor_id']?.toString() ?? vendorId;
    if (vendorId != null) await prefs.setString('vendor_id', vendorId!);

    final storeName = response['store_name']?.toString();
    if (storeName != null && storeName.isNotEmpty) {
      await prefs.setString('store_name', storeName);
    }
    final vendorName = response['owner_name']?.toString();
    if (vendorName != null && vendorName.isNotEmpty) {
      await prefs.setString('vendor_name', vendorName);
    }
  }

  Future<void> clear() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('userId');
    await prefs.remove('vendor_id');
    await prefs.remove('userName');
    await prefs.remove('userPhone');
    await prefs.remove('userEmail');
    await prefs.remove('userRole');
    await prefs.remove('store_name');
    await prefs.remove('vendor_name');
    userId = null;
    vendorId = null;
    name = null;
    phone = null;
    email = null;
    role = null;
  }
}
