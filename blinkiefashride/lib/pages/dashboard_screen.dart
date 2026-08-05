import 'dart:async';
import 'dart:typed_data';

import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:geolocator/geolocator.dart';

import '../api_service.dart';
import '../main.dart' show localNotifications, androidChannel;
import 'navigation_screen.dart';
import 'order_request_screen.dart';
import 'parcel_request_screen.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});
  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  final _api = ApiService();
  bool _isOnline = false;
  String _riderName = 'Rider';
  double _balance = 0;
  List<dynamic> _deliveries = [];
  List<dynamic> _availableOrders = [];
  bool _loading = true;
  Timer? _pollTimer;
  Timer? _locationTimer;
  StreamSubscription<RemoteMessage>? _fcmSub;
  final Set<String> _knownIds = {};
  final Set<String> _knownOrderIds = {};
  final Map<String, DateTime> _parcelLastShown = {};
  static const _parcelRealertAfter = Duration(minutes: 2);
  bool _showingOrderRequest = false;
  bool _showingParcelAlert = false;
  String? _riderId;
  String? _riderPhone;
  double? _lastLat;
  double? _lastLng;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    _locationTimer?.cancel();
    _fcmSub?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    await _api.loadToken();
    final name = await _api.getSavedName();
    final profile = await _api.getProfile();
    final earnings = await _api.getEarnings();
    final deliveries = await _api.getDeliveries();
    final available = await _api.getAvailableOrders();
    _riderId = profile?['id'] as String?;
    _riderPhone = profile?['phone'] as String?;
    // Try to get an initial location fix so we can seed known parcels
    // (avoids an immediate alert popup for parcels that already existed).
    try {
      final serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (serviceEnabled) {
        var permission = await Geolocator.checkPermission();
        if (permission == LocationPermission.denied) {
          permission = await Geolocator.requestPermission();
        }
        if (permission == LocationPermission.always ||
            permission == LocationPermission.whileInUse) {
          final pos = await Geolocator.getCurrentPosition(
            desiredAccuracy: LocationAccuracy.high,
            timeLimit: const Duration(seconds: 10),
          );
          _lastLat = pos.latitude;
          _lastLng = pos.longitude;
        }
      }
    } catch (_) {}
    final parcels = _lastLat != null
        ? await _api.getAvailableParcelRequests(_lastLat!, _lastLng!)
        : <Map<String, dynamic>>[];
    if (mounted) {
      final online = profile?['is_available'] == true;
      setState(() {
        _riderName = (profile?['name'] ?? name ?? 'Rider') as String;
        final bal = earnings['balance'];
        _balance = double.tryParse('$bal') ?? 0;
        _isOnline = online;
        _deliveries = deliveries;
        _availableOrders = available;
        _loading = false;
        // Seed known IDs so first load doesn't trigger popups
        for (final d in deliveries) {
          _knownIds.add((d['id'] ?? '') as String);
        }
        for (final o in available) {
          _knownOrderIds.add((o['id'] ?? '') as String);
        }
        for (final p in parcels) {
          _parcelLastShown[(p['id'] ?? '') as String] = DateTime.now();
        }
      });
      if (online) {
        _startPolling();
        _startLocationTracking();
      }
      _registerFcmToken();
      _listenForegroundMessages();
    }
  }

  // ── FCM token registration ─────────────────────────────────────────────────
  Future<void> _registerFcmToken() async {
    try {
      final token = await FirebaseMessaging.instance.getToken();
      if (token != null) await _api.saveFcmToken(token);
      // Refresh token if Firebase rotates it
      FirebaseMessaging.instance.onTokenRefresh.listen((t) {
        _api.saveFcmToken(t);
      });
    } catch (_) {}
  }

  // ── Foreground FCM message handler ────────────────────────────────────────
  void _listenForegroundMessages() {
    _fcmSub = FirebaseMessaging.onMessage.listen((message) {
      final notification = message.notification;
      if (notification == null) return;

      // Show local heads-up notification while app is open
      localNotifications.show(
        notification.hashCode,
        notification.title,
        notification.body,
        NotificationDetails(
          android: AndroidNotificationDetails(
            androidChannel.id,
            androidChannel.name,
            channelDescription: androidChannel.description,
            importance: Importance.max,
            priority: Priority.high,
            icon: '@mipmap/ic_launcher',
            fullScreenIntent: true,
            category: AndroidNotificationCategory.call,
            enableVibration: true,
            vibrationPattern: Int64List.fromList([0, 800, 400, 800, 400, 800]),
          ),
          iOS: const DarwinNotificationDetails(
            presentAlert: true,
            presentBadge: true,
            presentSound: true,
          ),
        ),
      );

      // Trigger poll on any relevant notification type
      final data = message.data;
      if (data['type'] == 'order_assigned' ||
          data['type'] == 'order_available' ||
          data['type'] == 'parcel_available') {
        _poll();
      }
    });
  }

  void _startPolling() {
    _pollTimer?.cancel();
    _pollTimer = Timer.periodic(const Duration(seconds: 10), (_) => _poll());
  }

  void _stopPolling() {
    _pollTimer?.cancel();
    _pollTimer = null;
  }

  void _startLocationTracking() {
    _locationTimer?.cancel();
    _sendLocation(); // send immediately on going online
    _locationTimer = Timer.periodic(
      const Duration(minutes: 1),
      (_) => _sendLocation(),
    );
  }

  void _stopLocationTracking() {
    _locationTimer?.cancel();
    _locationTimer = null;
  }

  Future<void> _sendLocation() async {
    try {
      // Ensure location services are on
      final serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) return;

      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.denied ||
          permission == LocationPermission.deniedForever ||
          permission == LocationPermission.unableToDetermine) {
        return;
      }

      final pos = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
        timeLimit: const Duration(seconds: 10),
      );
      _lastLat = pos.latitude;
      _lastLng = pos.longitude;
      await _api.updateRiderLocation(pos.latitude, pos.longitude);
    } catch (_) {}
  }

  Future<void> _poll() async {
    if (!mounted) return;
    final results = await Future.wait([
      _api.getDeliveries(),
      if (_isOnline) _api.getAvailableOrders() else Future.value(<dynamic>[]),
    ]);
    if (!mounted) return;
    final deliveries = results[0];
    final available = results.length > 1 ? results[1] : <dynamic>[];

    // Check for newly assigned deliveries
    final newAssigned = <Map<String, dynamic>>[];
    for (final d in deliveries) {
      final id = (d['id'] ?? '') as String;
      if (!_knownIds.contains(id) && d['status'] == 'assigned') {
        newAssigned.add(d as Map<String, dynamic>);
      }
      _knownIds.add(id);
    }

    // Check for newly available orders
    final newAvailable = <Map<String, dynamic>>[];
    for (final o in available) {
      final id = (o['id'] ?? '') as String;
      if (!_knownOrderIds.contains(id)) {
        newAvailable.add({
          ...o as Map<String, dynamic>,
          '_isAvailableOrder': true,
        });
      }
      _knownOrderIds.add(id);
    }

    setState(() {
      _deliveries = deliveries;
      _availableOrders = available;
    });

    // Show popups: assigned deliveries take priority over available orders
    final toShow = [...newAssigned, ...newAvailable];
    for (final d in toShow) {
      if (!_showingOrderRequest && mounted) {
        await _showOrderRequest(d);
      }
    }

    if (_isOnline) await _checkParcels();
  }

  // ── Poll for newly available parcel delivery requests ─────────────────────
  Future<void> _checkParcels() async {
    if (_lastLat == null || _lastLng == null) return;
    final parcels = await _api.getAvailableParcelRequests(_lastLat!, _lastLng!);
    if (!mounted) return;

    final now = DateTime.now();
    final newParcels = <Map<String, dynamic>>[];
    for (final p in parcels) {
      final id = (p['id'] ?? '') as String;
      final lastShown = _parcelLastShown[id];
      // Re-alert if never shown, or if it's still unaccepted after 2 minutes.
      if (lastShown == null ||
          now.difference(lastShown) >= _parcelRealertAfter) {
        newParcels.add(p);
      }
    }

    for (final p in newParcels) {
      if (_showingOrderRequest || _showingParcelAlert || !mounted) break;
      _parcelLastShown[(p['id'] ?? '') as String] = DateTime.now();
      await _showParcelRequest(p);
    }
  }

  Future<void> _showParcelRequest(Map<String, dynamic> parcel) async {
    _showingParcelAlert = true;
    await Navigator.of(context).push<bool>(
      MaterialPageRoute<bool>(
        builder: (_) => ParcelRequestScreen(
          parcel: parcel,
          riderId: _riderId ?? '',
          riderName: _riderName,
          riderPhone: _riderPhone ?? '',
          riderLat: _lastLat,
          riderLng: _lastLng,
        ),
        fullscreenDialog: true,
      ),
    );
    _showingParcelAlert = false;
  }

  Future<void> _showOrderRequest(Map<String, dynamic> delivery) async {
    _showingOrderRequest = true;
    final accepted = await Navigator.of(context).push<bool>(
      MaterialPageRoute<bool>(
        builder: (_) => OrderRequestScreen(delivery: delivery),
        fullscreenDialog: true,
      ),
    );
    _showingOrderRequest = false;

    final isAvailableOrder = delivery['_isAvailableOrder'] == true;
    if (accepted == true) {
      if (isAvailableOrder) {
        // Accept the unassigned order via API
        final result = await _api.acceptOrder((delivery['id'] ?? '') as String);
        if (!mounted) return;
        if (result['success'] == true) {
          final deliveryId = result['deliveryId'] as String? ?? '';
          // Navigate to active delivery screen
          await Navigator.of(context).push(
            MaterialPageRoute<void>(
              builder: (_) =>
                  NavigationScreen(order: delivery, deliveryId: deliveryId),
            ),
          );
        } else {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(
                (result['message'] ?? 'Order no longer available') as String,
              ),
              backgroundColor: const Color(0xFFEF4444),
            ),
          );
        }
      }
      await _poll();
    } else if (accepted == false) {
      if (!isAvailableOrder) {
        await _api.updateDeliveryStatus(
          (delivery['id'] ?? '') as String,
          'declined',
        );
      }
      // Remove from known so it can resurface if still available
      if (isAvailableOrder) {
        _knownOrderIds.remove((delivery['id'] ?? '') as String);
      }
      await _poll();
    }
  }

  Future<void> _toggleOnline(bool val) async {
    setState(() => _isOnline = val);
    await _api.toggleAvailability(val);
    if (val) {
      _startPolling();
      _startLocationTracking();
    } else {
      _stopPolling();
      _stopLocationTracking();
    }
  }

  String get _greeting {
    final h = DateTime.now().hour;
    if (h < 12) return 'Good Morning,';
    if (h < 17) return 'Good Afternoon,';
    return 'Good Evening,';
  }

  @override
  Widget build(BuildContext context) {
    final active = _deliveries.where((d) {
      final s = d['status'] as String? ?? '';
      return s == 'assigned' ||
          s == 'picked' ||
          s == 'on_the_way' ||
          s == 'arrived';
    }).toList();
    final completed = _deliveries
        .where((d) => d['status'] == 'completed')
        .toList();

    return Scaffold(
      backgroundColor: const Color(0xFFF2FAF4),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: Padding(
          padding: const EdgeInsets.only(left: 10),
          child: Image.asset(
            'asset/logo.jpeg',
            fit: BoxFit.contain,
            errorBuilder: (_, _, _) =>
                const Icon(Icons.electric_moped, color: Color(0xFF16A34A)),
          ),
        ),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              _greeting,
              style: const TextStyle(fontSize: 13, color: Color(0xFF64748B)),
            ),
            Row(
              children: [
                Text(
                  '$_riderName ',
                  style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w800,
                    color: Color(0xFF0F172A),
                  ),
                ),
                const Text('\u{1F44B}', style: TextStyle(fontSize: 18)),
              ],
            ),
          ],
        ),
        actions: [
          if (_isOnline)
            Padding(
              padding: const EdgeInsets.only(right: 8),
              child: Center(
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color: const Color(0xFFECFDF3),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: const Color(0xFF86EFAC)),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: const [
                      SizedBox(
                        width: 6,
                        height: 6,
                        child: DecoratedBox(
                          decoration: BoxDecoration(
                            color: Color(0xFF16A34A),
                            shape: BoxShape.circle,
                          ),
                        ),
                      ),
                      SizedBox(width: 4),
                      Text(
                        'Live',
                        style: TextStyle(
                          color: Color(0xFF16A34A),
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          IconButton(
            onPressed: () {},
            icon: const Icon(
              Icons.notifications_outlined,
              color: Color(0xFF0F172A),
            ),
          ),
        ],
      ),
      body: _loading
          ? const Center(
              child: CircularProgressIndicator(color: Color(0xFF16A34A)),
            )
          : RefreshIndicator(
              color: const Color(0xFF16A34A),
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 4, 16, 20),
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 14,
                      vertical: 12,
                    ),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: const Color(0xFFE5E7EB)),
                    ),
                    child: Row(
                      children: [
                        Container(
                          width: 10,
                          height: 10,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: _isOnline
                                ? const Color(0xFF16A34A)
                                : const Color(0xFF94A3B8),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            _isOnline
                                ? 'You are Online — Accepting Orders'
                                : 'You are Offline',
                            style: const TextStyle(
                              fontWeight: FontWeight.w700,
                              fontSize: 16,
                            ),
                          ),
                        ),
                        Switch(
                          value: _isOnline,
                          thumbColor: WidgetStateProperty.resolveWith(
                            (states) => states.contains(WidgetState.selected)
                                ? const Color(0xFF16A34A)
                                : null,
                          ),
                          trackColor: WidgetStateProperty.resolveWith(
                            (states) => states.contains(WidgetState.selected)
                                ? const Color(0xFF86EFAC)
                                : null,
                          ),
                          onChanged: _toggleOnline,
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 14),
                  Container(
                    padding: const EdgeInsets.all(18),
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [Color(0xFF16A34A), Color(0xFF15803D)],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      borderRadius: BorderRadius.circular(18),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Earnings Balance',
                          style: TextStyle(color: Colors.white70, fontSize: 13),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          '\u20B9${_balance.toStringAsFixed(2)}',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 34,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                        const SizedBox(height: 14),
                        Row(
                          children: [
                            _StatChip(
                              label: 'Completed',
                              value: '${completed.length}',
                            ),
                            const SizedBox(width: 12),
                            _StatChip(
                              label: 'Active',
                              value: '${active.length}',
                            ),
                            const SizedBox(width: 12),
                            _StatChip(
                              label: 'Total',
                              value: '${_deliveries.length}',
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                  // ── Active Deliveries (+ unassigned available orders) ─
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'Active Deliveries',
                        style: TextStyle(
                          fontSize: 17,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      TextButton(
                        onPressed: _poll,
                        child: const Text(
                          'Refresh',
                          style: TextStyle(color: Color(0xFF16A34A)),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  // Available unassigned orders shown at top with orange card
                  if (_isOnline)
                    ..._availableOrders.map((o) {
                      final order = o as Map<String, dynamic>;
                      return GestureDetector(
                        onTap: () => _showOrderRequest({
                          ...order,
                          '_isAvailableOrder': true,
                        }),
                        child: Container(
                          margin: const EdgeInsets.only(bottom: 10),
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(
                            color: const Color(0xFFFFFBEB),
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(
                              color: const Color(0xFFF59E0B),
                              width: 2,
                            ),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Container(
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 8,
                                      vertical: 3,
                                    ),
                                    decoration: BoxDecoration(
                                      color: const Color(0xFFF59E0B),
                                      borderRadius: BorderRadius.circular(20),
                                    ),
                                    child: const Text(
                                      'UNASSIGNED — TAP TO ACCEPT',
                                      style: TextStyle(
                                        color: Colors.white,
                                        fontSize: 10,
                                        fontWeight: FontWeight.w800,
                                        letterSpacing: 0.5,
                                      ),
                                    ),
                                  ),
                                  const Spacer(),
                                  Text(
                                    '₹${order['total_amount'] ?? '--'}',
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w900,
                                      fontSize: 18,
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 10),
                              Row(
                                children: [
                                  const Icon(
                                    Icons.store_outlined,
                                    size: 16,
                                    color: Color(0xFF78716C),
                                  ),
                                  const SizedBox(width: 6),
                                  Text(
                                    (order['store_name'] ??
                                            order['customer_name'] ??
                                            'New Order')
                                        as String,
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w700,
                                      fontSize: 14,
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 4),
                              Row(
                                children: [
                                  const Icon(
                                    Icons.location_on_outlined,
                                    size: 16,
                                    color: Color(0xFF78716C),
                                  ),
                                  const SizedBox(width: 6),
                                  Expanded(
                                    child: Text(
                                      '${order['address_line'] ?? ''}, ${order['city'] ?? ''}',
                                      style: const TextStyle(
                                        color: Color(0xFF64748B),
                                        fontSize: 12,
                                      ),
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      );
                    }),
                  if (active.isEmpty &&
                      (_availableOrders.isEmpty || !_isOnline))
                    Container(
                      padding: const EdgeInsets.all(20),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: const Color(0xFFE5E7EB)),
                      ),
                      child: Column(
                        children: [
                          Icon(
                            _isOnline
                                ? Icons.delivery_dining_outlined
                                : Icons.power_settings_new_outlined,
                            size: 40,
                            color: const Color(0xFF94A3B8),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            _isOnline
                                ? 'Waiting for orders…'
                                : 'Go online to receive orders',
                            style: const TextStyle(
                              color: Color(0xFF64748B),
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                    )
                  else
                    ...active.map(
                      (d) => _DeliveryCard(
                        deliveryId: (d['id'] ?? '') as String,
                        status: (d['status'] ?? '') as String,
                        fee: '₹${d["delivery_fee"] ?? "--"}',
                        distance: '${d["distance"] ?? "--"} km',
                        onNavigate: () {
                          Navigator.of(context).push(
                            MaterialPageRoute<void>(
                              builder: (_) => NavigationScreen(
                                order: d as Map<String, dynamic>,
                                deliveryId: (d['id'] ?? '') as String,
                              ),
                            ),
                          );
                        },
                        onUpdateStatus: (status) async {
                          await _api.updateDeliveryStatus(
                            d['id'] as String,
                            status,
                          );
                          _poll();
                        },
                      ),
                    ),
                ],
              ),
            ),
    );
  }
}

class _StatChip extends StatelessWidget {
  const _StatChip({required this.label, required this.value});
  final String label;
  final String value;
  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(color: Colors.white70, fontSize: 11),
        ),
        Text(
          value,
          style: const TextStyle(
            color: Colors.white,
            fontWeight: FontWeight.w800,
            fontSize: 16,
          ),
        ),
      ],
    );
  }
}

class _DeliveryCard extends StatelessWidget {
  const _DeliveryCard({
    required this.deliveryId,
    required this.status,
    required this.fee,
    required this.distance,
    required this.onNavigate,
    required this.onUpdateStatus,
  });
  final String deliveryId;
  final String status;
  final String fee;
  final String distance;
  final VoidCallback onNavigate;
  final void Function(String) onUpdateStatus;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE5E7EB)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(
                deliveryId.length > 8
                    ? '#${deliveryId.substring(0, 8).toUpperCase()}'
                    : '#$deliveryId',
                style: const TextStyle(fontWeight: FontWeight.w800),
              ),
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 4,
                ),
                decoration: BoxDecoration(
                  color: const Color(0xFFECFDF3),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  status,
                  style: const TextStyle(
                    color: Color(0xFF16A34A),
                    fontWeight: FontWeight.w700,
                    fontSize: 12,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              const Icon(
                Icons.route_outlined,
                color: Color(0xFF16A34A),
                size: 18,
              ),
              const SizedBox(width: 6),
              Text(
                distance,
                style: const TextStyle(fontWeight: FontWeight.w600),
              ),
              const Spacer(),
              Text(
                fee,
                style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w900,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: onNavigate,
                  style: OutlinedButton.styleFrom(
                    minimumSize: const Size(0, 40),
                    side: const BorderSide(color: Color(0xFF16A34A)),
                  ),
                  child: const Text('Navigate'),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: FilledButton(
                  onPressed: () => onUpdateStatus(
                    status == 'assigned' ? 'picked_up' : 'delivered',
                  ),
                  style: FilledButton.styleFrom(
                    minimumSize: const Size(0, 40),
                    backgroundColor: const Color(0xFF16A34A),
                  ),
                  child: Text(status == 'assigned' ? 'Picked Up' : 'Delivered'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
