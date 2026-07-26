import 'package:flutter/foundation.dart';
import 'package:geocoding/geocoding.dart';
import 'package:geolocator/geolocator.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Holds the user's current delivery location.
///
/// - Persists to SharedPreferences so it survives app restarts.
/// - Auto-detects via Geolocator on first launch (silent — uses last-known
///   position if permission already granted, otherwise stays on defaults).
/// - Updated whenever the home screen or product detail picker resolves a
///   new city/pincode.
class LocationService extends ChangeNotifier {
  LocationService._();
  static final LocationService instance = LocationService._();

  static const _keyCity = 'delivery_city';
  static const _keyPincode = 'delivery_pincode';

  String _city = 'Bhubaneswar';
  String _pincode = '751030';
  bool _loaded = false;

  String get city => _city;
  String get pincode => _pincode;

  /// Load persisted values; called once at app startup.
  Future<void> load() async {
    if (_loaded) return;
    _loaded = true;
    try {
      final prefs = await SharedPreferences.getInstance();
      _city = prefs.getString(_keyCity) ?? _city;
      _pincode = prefs.getString(_keyPincode) ?? _pincode;
      notifyListeners();
    } catch (_) {}
  }

  Future<void> setLocation({String? city, String? pincode}) async {
    var changed = false;
    if (city != null && city.trim().isNotEmpty && city != _city) {
      _city = city.trim();
      changed = true;
    }
    if (pincode != null && pincode.trim().isNotEmpty && pincode != _pincode) {
      _pincode = pincode.trim();
      changed = true;
    }
    if (!changed) return;
    notifyListeners();
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_keyCity, _city);
      await prefs.setString(_keyPincode, _pincode);
    } catch (_) {}
  }

  /// Silently tries to refresh from device GPS — only if permission is already
  /// granted. Never prompts the user.
  Future<void> refreshFromDeviceSilently() async {
    try {
      final serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) return;
      final permission = await Geolocator.checkPermission();
      if (permission != LocationPermission.whileInUse &&
          permission != LocationPermission.always) {
        return;
      }
      final pos = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.low,
        timeLimit: const Duration(seconds: 6),
      );
      final placemarks = await placemarkFromCoordinates(
        pos.latitude,
        pos.longitude,
      );
      if (placemarks.isEmpty) return;
      final p = placemarks.first;
      final city =
          [
                p.locality,
                p.subLocality,
                p.subAdministrativeArea,
                p.administrativeArea,
              ]
              .map((v) => (v ?? '').trim())
              .firstWhere((v) => v.isNotEmpty, orElse: () => '');
      final pincode = (p.postalCode ?? '').trim();
      await setLocation(
        city: city.isNotEmpty ? city : null,
        pincode: pincode.isNotEmpty ? pincode : null,
      );
    } catch (_) {}
  }
}
