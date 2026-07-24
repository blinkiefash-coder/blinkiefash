import 'dart:async';
import 'dart:io' show Platform;

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

import '../firebase_options.dart';
import 'api_client.dart';
import 'user_session.dart';

// v2 channel forces new channel registration on existing devices so that
// sound/vibration settings take effect even if v1 was created without them.
const _orderChannelId = 'blinkiefash_orders_v2';
const _orderChannelName = 'Order updates';
const _orderChannelDescription =
    'Notifications about your order status — placed, out for delivery, delivered, etc.';

const _vendorOrderChannelId = 'blinkiefash_vendor_orders_ring_v2';
const _vendorOrderChannelName = 'Vendor Incoming Orders';
const _vendorOrderChannelDescription =
    'High-priority alerts for newly received vendor orders.';

Future<void> _configureLocalNotifications(
  FlutterLocalNotificationsPlugin plugin,
) async {
  const androidInit = AndroidInitializationSettings('@mipmap/ic_launcher');
  const iosInit = DarwinInitializationSettings(
    requestAlertPermission: false,
    requestBadgePermission: false,
    requestSoundPermission: false,
  );

  await plugin.initialize(
    const InitializationSettings(android: androidInit, iOS: iosInit),
  );

  final android = plugin
      .resolvePlatformSpecificImplementation<
        AndroidFlutterLocalNotificationsPlugin
      >();
  await android?.createNotificationChannel(
    const AndroidNotificationChannel(
      _orderChannelId,
      _orderChannelName,
      description: _orderChannelDescription,
      importance: Importance.high,
      playSound: true,
      enableVibration: true,
    ),
  );
  await android?.createNotificationChannel(
    const AndroidNotificationChannel(
      _vendorOrderChannelId,
      _vendorOrderChannelName,
      description: _vendorOrderChannelDescription,
      importance: Importance.max,
      playSound: true,
      enableVibration: true,
      showBadge: true,
    ),
  );
}

/// Background message handler must be a top-level function annotated with
/// @pragma('vm:entry-point').
@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);

  // Vendor new-order messages are sent data-only (no notification block)
  // so that this handler always runs and can play alarm sound reliably
  // even while the phone is asleep. All other message types are handled
  // by the OS notification layer, so we skip them here.
  if (message.data['type'] != 'vendor_new_order') return;

  final local = FlutterLocalNotificationsPlugin();
  await _configureLocalNotifications(local);
  final title =
      message.data['title'] as String? ??
      message.notification?.title ??
      'New Vendor Order';
  final body =
      message.data['body'] as String? ??
      message.notification?.body ??
      'You have received a new order. Open vendor app to confirm.';

  await local.show(
    DateTime.now().millisecondsSinceEpoch ~/ 1000,
    title,
    body,
    NotificationDetails(
      android: AndroidNotificationDetails(
        _vendorOrderChannelId,
        _vendorOrderChannelName,
        channelDescription: _vendorOrderChannelDescription,
        importance: Importance.max,
        priority: Priority.max,
        icon: '@mipmap/ic_launcher',
        category: AndroidNotificationCategory.alarm,
        styleInformation: BigTextStyleInformation(body),
        ticker: 'blinkiefash_vendor_new_order',
        playSound: true,
        enableVibration: true,
        vibrationPattern: Int64List.fromList([0, 800, 300, 800]),
        audioAttributesUsage: AudioAttributesUsage.alarm,
        visibility: NotificationVisibility.public,
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

class NotificationService {
  NotificationService._();
  static final NotificationService instance = NotificationService._();

  final FlutterLocalNotificationsPlugin _local =
      FlutterLocalNotificationsPlugin();
  final ApiClient _api = ApiClient();
  bool _initialized = false;
  bool _vendorRingInProgress = false;
  String? _cachedToken;

  static const AndroidNotificationChannel _orderChannel =
      AndroidNotificationChannel(
        _orderChannelId,
        _orderChannelName,
        description: _orderChannelDescription,
        importance: Importance.high,
        playSound: true,
        enableVibration: true,
      );

  static const AndroidNotificationChannel _vendorOrderChannel =
      AndroidNotificationChannel(
        _vendorOrderChannelId,
        _vendorOrderChannelName,
        description: _vendorOrderChannelDescription,
        importance: Importance.max,
        playSound: true,
        enableVibration: true,
        showBadge: true,
      );

  /// Call once during app startup, AFTER Firebase.initializeApp().
  Future<void> init() async {
    if (_initialized) return;
    _initialized = true;

    FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);

    await _configureLocalNotifications(_local);

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
    final isVendorNewOrder = message.data['type'] == 'vendor_new_order';
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
          isVendorNewOrder ? _vendorOrderChannel.id : _orderChannel.id,
          isVendorNewOrder ? _vendorOrderChannel.name : _orderChannel.name,
          channelDescription: isVendorNewOrder
              ? _vendorOrderChannel.description
              : _orderChannel.description,
          importance: isVendorNewOrder ? Importance.max : Importance.high,
          priority: isVendorNewOrder ? Priority.max : Priority.high,
          icon: '@mipmap/ic_launcher',
          category: isVendorNewOrder
              ? AndroidNotificationCategory.alarm
              : AndroidNotificationCategory.status,
          playSound: true,
          enableVibration: isVendorNewOrder,
          audioAttributesUsage: isVendorNewOrder
              ? AudioAttributesUsage.alarm
              : AudioAttributesUsage.notification,
        ),
        iOS: DarwinNotificationDetails(
          presentAlert: true,
          presentBadge: true,
          presentSound: true,
          interruptionLevel: isVendorNewOrder
              ? InterruptionLevel.timeSensitive
              : InterruptionLevel.active,
        ),
      ),
    );
  }

  Future<void> showVendorNewOrderAlert({required int count}) async {
    if (_vendorRingInProgress) return;
    _vendorRingInProgress = true;

    final title = count <= 1 ? 'New Vendor Order' : '$count New Vendor Orders';
    final body = count <= 1
        ? 'You have received a new order. Open Orders to accept or reject.'
        : 'You have received $count new orders. Open Orders to take action.';

    try {
      final notificationId = DateTime.now().millisecondsSinceEpoch ~/ 1000;
      await _local.show(
        notificationId,
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
            playSound: true,
            enableVibration: true,
            vibrationPattern: Int64List.fromList([0, 1200, 400, 1200]),
            audioAttributesUsage: AudioAttributesUsage.alarm,
            visibility: NotificationVisibility.public,
          ),
          iOS: const DarwinNotificationDetails(
            presentAlert: true,
            presentBadge: true,
            presentSound: true,
            interruptionLevel: InterruptionLevel.timeSensitive,
          ),
        ),
      );
    } finally {
      _vendorRingInProgress = false;
    }
  }
}
