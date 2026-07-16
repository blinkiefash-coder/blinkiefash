import 'dart:async';
import 'dart:io' show Platform;

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

import 'api_client.dart';
import 'user_session.dart';

/// Background message handler must be a top-level function annotated with
/// @pragma('vm:entry-point').
@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp();
  // Notifications with a `notification` payload are auto-displayed by the
  // system in the background — nothing more to do here.
}

class NotificationService {
  NotificationService._();
  static final NotificationService instance = NotificationService._();

  final FlutterLocalNotificationsPlugin _local =
      FlutterLocalNotificationsPlugin();
  final ApiClient _api = ApiClient();
  bool _initialized = false;
  String? _cachedToken;

  static const AndroidNotificationChannel
  _orderChannel = AndroidNotificationChannel(
    'blinkiefash_orders',
    'Order updates',
    description:
        'Notifications about your order status — placed, out for delivery, delivered, etc.',
    importance: Importance.high,
  );

  static const AndroidNotificationChannel _vendorOrderChannel =
      AndroidNotificationChannel(
        'blinkiefash_vendor_orders',
        'Vendor New Orders',
        description: 'High-priority alerts for newly received vendor orders.',
        importance: Importance.max,
        playSound: true,
      );

  /// Call once during app startup, AFTER Firebase.initializeApp().
  Future<void> init() async {
    if (_initialized) return;
    _initialized = true;

    FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);

    // Local notifications init (used to display when in foreground).
    const androidInit = AndroidInitializationSettings('@mipmap/ic_launcher');
    const iosInit = DarwinInitializationSettings(
      requestAlertPermission: false,
      requestBadgePermission: false,
      requestSoundPermission: false,
    );
    await _local.initialize(
      const InitializationSettings(android: androidInit, iOS: iosInit),
    );

    // Create the Android channel up-front.
    await _local
        .resolvePlatformSpecificImplementation<
          AndroidFlutterLocalNotificationsPlugin
        >()
        ?.createNotificationChannel(_orderChannel);
    await _local
        .resolvePlatformSpecificImplementation<
          AndroidFlutterLocalNotificationsPlugin
        >()
        ?.createNotificationChannel(_vendorOrderChannel);

    // Permissions (iOS / Android 13+).
    await FirebaseMessaging.instance.requestPermission(
      alert: true,
      badge: true,
      sound: true,
    );

    // Show foreground messages with a banner on iOS too.
    await FirebaseMessaging.instance
        .setForegroundNotificationPresentationOptions(
          alert: true,
          badge: true,
          sound: true,
        );

    // Listen for foreground pushes and surface a local notification.
    FirebaseMessaging.onMessage.listen(_handleForegroundMessage);

    // Keep token fresh on the backend.
    FirebaseMessaging.instance.onTokenRefresh.listen((token) {
      _cachedToken = token;
      _uploadTokenIfPossible();
    });
  }

  /// Call after a successful login/signup to upload the FCM token bound to
  /// the now-known user id.
  Future<void> registerForCurrentUser() async {
    if (!_initialized) return;
    try {
      // On iOS we may need APNS token first.
      if (!kIsWeb && Platform.isIOS) {
        await FirebaseMessaging.instance.getAPNSToken();
      }
      _cachedToken ??= await FirebaseMessaging.instance.getToken();
      await _uploadTokenIfPossible();
    } catch (e) {
      debugPrint('[NotificationService] registerForCurrentUser failed: $e');
    }
  }

  /// Should be called on logout.
  Future<void> clearForCurrentUser() async {
    try {
      await FirebaseMessaging.instance.deleteToken();
      _cachedToken = null;
    } catch (_) {}
  }

  Future<void> _uploadTokenIfPossible() async {
    final userId = UserSession.instance.userId;
    final token = _cachedToken;
    if (userId == null || userId.isEmpty || token == null || token.isEmpty) {
      return;
    }
    try {
      await _api.registerFcmToken(userId: userId, token: token);
    } catch (e) {
      debugPrint('[NotificationService] token upload failed: $e');
    }
  }

  Future<void> _handleForegroundMessage(RemoteMessage message) async {
    final notification = message.notification;
    final title = notification?.title ?? message.data['title'] as String?;
    final body = notification?.body ?? message.data['body'] as String?;
    if (title == null && body == null) return;

    await _local.show(
      message.hashCode,
      title,
      body,
      NotificationDetails(
        android: AndroidNotificationDetails(
          _orderChannel.id,
          _orderChannel.name,
          channelDescription: _orderChannel.description,
          importance: Importance.high,
          priority: Priority.high,
          icon: '@mipmap/ic_launcher',
        ),
        iOS: const DarwinNotificationDetails(
          presentAlert: true,
          presentBadge: true,
          presentSound: true,
        ),
      ),
    );
  }

  Future<void> showVendorNewOrderAlert({required int count}) async {
    final title = count <= 1 ? 'New Vendor Order' : '$count New Vendor Orders';
    final body = count <= 1
        ? 'You have received a new order. Open Orders to accept or reject.'
        : 'You have received $count new orders. Open Orders to take action.';

    await _local.show(
      DateTime.now().millisecondsSinceEpoch ~/ 1000,
      title,
      body,
      NotificationDetails(
        android: AndroidNotificationDetails(
          _vendorOrderChannel.id,
          _vendorOrderChannel.name,
          channelDescription: _vendorOrderChannel.description,
          importance: Importance.max,
          priority: Priority.max,
          icon: '@mipmap/ic_launcher',
          category: AndroidNotificationCategory.alarm,
          styleInformation: BigTextStyleInformation(body),
          ticker: 'blinkiefash_vendor_new_order',
        ),
        iOS: const DarwinNotificationDetails(
          presentAlert: true,
          presentBadge: true,
          presentSound: true,
          interruptionLevel: InterruptionLevel.timeSensitive,
        ),
      ),
    );
  }
}
