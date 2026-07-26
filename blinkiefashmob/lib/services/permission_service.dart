import 'dart:io' show Platform;

import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:geolocator/geolocator.dart';

/// Requests the runtime permissions the app needs to function.
///
/// Currently:
///   - Location (whileInUse) — needed for delivery / store proximity.
///   - Notifications (Android 13+) — needed for order updates.
///
/// All requests are wrapped in try/catch so a denial or platform error never
/// crashes the app. The startup flow continues regardless of the user's
/// choice; features that require a denied permission simply degrade
/// gracefully (e.g. user manually picks city instead of auto-detect).
class PermissionService {
  PermissionService._();
  static final PermissionService instance = PermissionService._();

  bool _alreadyRequested = false;

  /// Call once at app startup. Safe to call multiple times — only the first
  /// call will actually trigger system prompts.
  Future<void> requestStartupPermissions() async {
    if (_alreadyRequested) return;
    _alreadyRequested = true;

    await _requestLocationPermission();
    await _requestNotificationPermission();
  }

  Future<void> _requestLocationPermission() async {
    try {
      // Don't prompt if location services are off at the OS level — the system
      // dialog would just deny anyway. The app falls back to the saved city.
      final serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        debugPrint('Location services disabled at OS level.');
        return;
      }

      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }

      debugPrint('Location permission status: $permission');
    } catch (e, stack) {
      debugPrint('Location permission request failed: $e\n$stack');
    }
  }

  Future<void> _requestNotificationPermission() async {
    try {
      // FirebaseMessaging.requestPermission triggers the OS dialog on iOS and
      // on Android 13+ (where POST_NOTIFICATIONS is a runtime permission).
      // On older Android it is a no-op that returns authorized.
      if (Platform.isAndroid || Platform.isIOS) {
        final settings = await FirebaseMessaging.instance.requestPermission(
          alert: true,
          badge: true,
          sound: true,
        );
        debugPrint(
          'Notification permission status: ${settings.authorizationStatus}',
        );
      }
    } catch (e, stack) {
      debugPrint('Notification permission request failed: $e\n$stack');
    }
  }
}
