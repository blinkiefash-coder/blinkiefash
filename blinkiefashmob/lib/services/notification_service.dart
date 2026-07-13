import 'package:firebase_messaging/firebase_messaging.dart';

class NotificationService {
  NotificationService._();

  static final NotificationService instance = NotificationService._();

  Future<void> registerForCurrentUser() async {
    try {
      await FirebaseMessaging.instance.requestPermission();
      await FirebaseMessaging.instance.getToken();
    } catch (_) {
      // Notifications are best-effort in this lightweight Flutter build.
    }
  }

  Future<void> clearForCurrentUser() async {
    // Compatibility no-op for logout flows.
  }
}
