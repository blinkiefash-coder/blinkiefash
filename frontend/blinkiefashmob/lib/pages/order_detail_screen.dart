import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:geocoding/geocoding.dart';
import 'package:http/http.dart' as http;
import 'package:latlong2/latlong.dart';
import 'package:url_launcher/url_launcher.dart';

import '../services/api_client.dart';

// ── Status helpers ────────────────────────────────────────────────────────────

const _statusSteps = [
  'placed',
  'confirmed',
  'packed',
  'picked',
  'out_for_delivery',
  'delivered',
];

const _statusLabels = {
  'placed': 'Order Placed',
  'confirmed': 'Order Confirmed',
  'packed': 'Packed',
  'picked': 'Picked Up',
  'out_for_delivery': 'Out for Delivery',
  'delivered': 'Delivered',
  'trial_started': 'Trial Started',
  'trial_completed': 'Trial Completed',
  'completed': 'Completed',
  'cancelled': 'Cancelled',
};

const _statusIcons = {
  'placed': Icons.receipt_long_outlined,
  'confirmed': Icons.check_circle_outline,
  'packed': Icons.inventory_2_outlined,
  'picked': Icons.shopping_bag_outlined,
  'out_for_delivery': Icons.delivery_dining_outlined,
  'delivered': Icons.home_outlined,
};

Color _statusColor(String status) {
  if (status == 'cancelled') return const Color(0xFFEF4444);
  if (status == 'delivered' || status == 'completed') {
    return const Color(0xFF16A34A);
  }
  return const Color(0xFF2563EB);
}

String _statusBadgeLabel(String status) =>
    _statusLabels[status] ?? status.replaceAll('_', ' ').toUpperCase();

// ── Screen ────────────────────────────────────────────────────────────────────

class OrderDetailScreen extends StatefulWidget {
  const OrderDetailScreen({super.key, required this.orderId});
  final String orderId;

  @override
  State<OrderDetailScreen> createState() => _OrderDetailScreenState();
}

class _OrderDetailScreenState extends State<OrderDetailScreen> {
  final _api = ApiClient();
  Map<String, dynamic>? _order;
  bool _loading = true;
  String? _error;

  // Map
  LatLng? _storeLoc;
  LatLng? _addrLoc;
  final _mapController = MapController();
  List<LatLng> _routePoints = [];

  // Rider
  Map<String, dynamic>? _riderInfo;
  LatLng? _riderLoc;
  Timer? _riderLocTimer;

  // OTP + Try & Buy delivery status
  Map<String, dynamic>? _deliveryStatus;
  Timer? _deliveryStatusTimer;
  int _trialSecondsLeft = 0;
  Timer? _trialCountdownTimer;

  // Delivery countdown
  int _deliverySecondsLeft = 0;
  Timer? _deliveryCountdownTimer;

  // Full order auto-refresh (every 15 s while order is active)
  Timer? _orderRefreshTimer;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _riderLocTimer?.cancel();
    _deliveryStatusTimer?.cancel();
    _trialCountdownTimer?.cancel();
    _deliveryCountdownTimer?.cancel();
    _orderRefreshTimer?.cancel();
    _mapController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
      _storeLoc = null;
      _addrLoc = null;
    });
    final data = await _api.fetchOrderDetail(widget.orderId);
    if (!mounted) return;
    if (data['success'] == true) {
      final order = data['order'] as Map<String, dynamic>;
      setState(() {
        _order = order;
        _loading = false;
      });
      _initMapCoords(order);
      _loadRiderInfo(order);
      _startDeliveryStatusPolling(order['status']?.toString() ?? '');
      _startDeliveryCountdown(order);
      _startOrderAutoRefresh(order['status']?.toString() ?? '');
    } else {
      setState(() {
        _error = data['message']?.toString() ?? 'Failed to load order';
        _loading = false;
      });
    }
  }

  Future<void> _cancelOrder() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Cancel Order?'),
        content: const Text(
          'This cannot be undone. Are you sure you want to cancel this order?',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('No, Keep'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: FilledButton.styleFrom(
              backgroundColor: const Color(0xFFEF4444),
            ),
            child: const Text('Yes, Cancel'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    final res = await _api.cancelOrder(widget.orderId);
    if (!mounted) return;
    if (res['success'] == true) {
      setState(() {
        _order = {...?_order, 'status': 'cancelled'};
        _orderRefreshTimer?.cancel();
        _deliveryStatusTimer?.cancel();
        _deliveryCountdownTimer?.cancel();
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Order cancelled'),
          backgroundColor: Color(0xFFEF4444),
        ),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(res['message']?.toString() ?? 'Failed to cancel order'),
          backgroundColor: const Color(0xFFEF4444),
        ),
      );
    }
  }

  void _startOrderAutoRefresh(String currentStatus) {
    _orderRefreshTimer?.cancel();
    const terminal = ['delivered', 'cancelled', 'completed', 'trial_completed'];
    if (terminal.contains(currentStatus)) return;
    _orderRefreshTimer = Timer.periodic(const Duration(seconds: 15), (_) async {
      if (!mounted) return;
      final data = await _api.fetchOrderDetail(widget.orderId);
      if (!mounted) return;
      if (data['success'] == true) {
        final order = data['order'] as Map<String, dynamic>;
        final newStatus = order['status']?.toString() ?? '';
        setState(() => _order = order);
        // Stop auto-refresh once done
        if (terminal.contains(newStatus)) {
          _orderRefreshTimer?.cancel();
        }
      }
    });
  }

  void _startDeliveryCountdown(Map<String, dynamic> order) {
    _deliveryCountdownTimer?.cancel();
    final terminalStatuses = [
      'delivered',
      'cancelled',
      'completed',
      'trial_completed',
    ];
    final status = order['status']?.toString() ?? '';
    if (terminalStatuses.contains(status)) return;
    // Use confirmed_at as the start of the 60-min SLA, fall back to created_at
    final baseIso =
        order['confirmed_at']?.toString() ?? order['created_at']?.toString();
    final base = DateTime.tryParse(baseIso ?? '');
    final deadline = base != null
        ? base.toLocal().add(const Duration(minutes: 60))
        : DateTime.now().add(const Duration(minutes: 60));
    final left = deadline.difference(DateTime.now()).inSeconds;
    // Show timer for up to 60 minutes from order
    if (left < -600) return;
    setState(() => _deliverySecondsLeft = left.clamp(0, 3600));
    if (left <= 0) return; // already expired, just show 0
    _deliveryCountdownTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) return;
      setState(() {
        if (_deliverySecondsLeft > 0) _deliverySecondsLeft--;
      });
    });
  }

  void _startDeliveryStatusPolling(String orderStatus) {
    _deliveryStatusTimer?.cancel();
    final terminal = ['delivered', 'cancelled', 'completed', 'trial_completed'];
    if (terminal.contains(orderStatus)) return;
    _deliveryStatusTimer = Timer.periodic(const Duration(seconds: 6), (
      _,
    ) async {
      try {
        final res = await _api.fetchOrderDeliveryStatus(widget.orderId);
        if (!mounted) return;
        if (res['success'] == true) {
          final newStatus = res['data']?['order_status']?.toString() ?? '';
          setState(
            () => _deliveryStatus = res['data'] as Map<String, dynamic>?,
          );
          final ds = _deliveryStatus;

          // Reload rider info if we just moved to a live-tracking status
          if (['picked', 'out_for_delivery'].contains(newStatus) &&
              _riderLoc == null) {
            _loadRiderInfo({'status': newStatus});
          }

          // Start delivery countdown if not already running
          if (_deliverySecondsLeft == 0 &&
              _order != null &&
              !terminal.contains(newStatus)) {
            _startDeliveryCountdown(_order!);
          }

          // If trial started, run local countdown
          if (ds != null && ds['try_buy_started_at'] != null) {
            final deadline = DateTime.tryParse(
              ds['try_buy_deadline']?.toString() ?? '',
            );
            if (deadline != null) {
              final left = deadline.difference(DateTime.now()).inSeconds;
              if (_trialCountdownTimer == null) {
                setState(() => _trialSecondsLeft = left.clamp(0, 900));
                _trialCountdownTimer = Timer.periodic(
                  const Duration(seconds: 1),
                  (_) {
                    if (!mounted) return;
                    setState(() {
                      if (_trialSecondsLeft > 0) _trialSecondsLeft--;
                    });
                  },
                );
              }
            }
          }
          // Stop polling once done
          if (terminal.contains(newStatus)) {
            _deliveryStatusTimer?.cancel();
            _trialCountdownTimer?.cancel();
          }
        }
      } catch (_) {}
    });
  }

  Future<void> _loadRiderInfo(Map<String, dynamic> order) async {
    final status = order['status']?.toString() ?? '';
    try {
      final res = await _api.fetchOrderRider(widget.orderId);
      if (!mounted) return;
      if (res['success'] == true && res['rider'] != null) {
        final rider = res['rider'] as Map<String, dynamic>;
        setState(() => _riderInfo = rider);
        // Use current_lat/lng from Riders table as initial position —
        // don't wait for delivery_tracking entries (which need 10s to appear)
        final rawLat = rider['lat'];
        final rawLng = rider['lng'];
        if (rawLat != null && rawLng != null) {
          final lat = double.tryParse(rawLat.toString());
          final lng = double.tryParse(rawLng.toString());
          if (lat != null && lng != null) {
            final initLoc = LatLng(lat, lng);
            setState(() => _riderLoc = initLoc);
            if (_addrLoc != null) _fetchRoute(initLoc, _addrLoc!);
            try {
              _mapController.move(initLoc, 14);
            } catch (_) {}
          }
        }
        // Start live tracking for any active delivery status
        final liveStatuses = [
          'picked',
          'out_for_delivery',
          'arrived',
          'trial_started',
        ];
        if (liveStatuses.contains(status) || _riderLocTimer == null) {
          _startRiderLocPolling();
        }
      }
    } catch (_) {}
  }

  void _startRiderLocPolling() {
    _riderLocTimer?.cancel();
    _riderLocTimer = Timer.periodic(const Duration(seconds: 3), (_) async {
      try {
        final res = await _api.fetchRiderLocation(widget.orderId);
        if (!mounted) return;
        // Backend returns { success: true, location: { lat, lng } }
        final loc = res['location'] as Map?;
        final rawLat = loc?['lat'] ?? res['lat'];
        final rawLng = loc?['lng'] ?? res['lng'];
        if (res['success'] == true && rawLat != null && rawLng != null) {
          final lat = double.tryParse(rawLat.toString());
          final lng = double.tryParse(rawLng.toString());
          if (lat != null && lng != null) {
            final newLoc = LatLng(lat, lng);
            setState(() => _riderLoc = newLoc);
            // Fetch road route from rider's current position to customer address
            if (_addrLoc != null) _fetchRoute(newLoc, _addrLoc!);
            try {
              _mapController.move(
                newLoc,
                _mapController.camera.zoom.clamp(13.0, 16.0),
              );
            } catch (_) {}
          }
        }
      } catch (_) {}
    });
  }

  Future<void> _fetchRoute(LatLng from, LatLng to) async {
    try {
      final url = Uri.parse(
        'https://router.project-osrm.org/route/v1/driving/'
        '${from.longitude},${from.latitude};${to.longitude},${to.latitude}'
        '?overview=full&geometries=geojson',
      );
      final resp = await http.get(url).timeout(const Duration(seconds: 6));
      if (resp.statusCode == 200) {
        final data = jsonDecode(resp.body);
        final coords = data['routes']?[0]?['geometry']?['coordinates'] as List?;
        if (coords != null && coords.isNotEmpty && mounted) {
          setState(() {
            _routePoints = coords
                .map<LatLng>(
                  (c) => LatLng(
                    (c[1] as num).toDouble(),
                    (c[0] as num).toDouble(),
                  ),
                )
                .toList();
          });
        }
      }
    } catch (_) {}
  }

  Future<void> _initMapCoords(Map<String, dynamic> order) async {
    final dsLat = double.tryParse(order['dark_store_lat']?.toString() ?? '');
    final dsLng = double.tryParse(order['dark_store_lng']?.toString() ?? '');
    final aLat = double.tryParse(order['address_lat']?.toString() ?? '');
    final aLng = double.tryParse(order['address_lng']?.toString() ?? '');

    LatLng? storeLoc = (dsLat != null && dsLng != null)
        ? LatLng(dsLat, dsLng)
        : null;
    LatLng? addrLoc = (aLat != null && aLng != null)
        ? LatLng(aLat, aLng)
        : null;

    // Fallback: geocode city + pincode if address coords not saved
    if (addrLoc == null) {
      final city = order['city']?.toString() ?? '';
      final pincode = order['pincode']?.toString() ?? '';
      if (city.isNotEmpty || pincode.isNotEmpty) {
        try {
          final q = [
            city,
            pincode,
            'India',
          ].where((s) => s.isNotEmpty).join(', ');
          final locs = await locationFromAddress(q);
          if (locs.isNotEmpty) {
            addrLoc = LatLng(locs.first.latitude, locs.first.longitude);
          }
        } catch (_) {}
      }
    }

    if (!mounted) return;
    setState(() {
      _storeLoc = storeLoc;
      _addrLoc = addrLoc;
    });
    // Fetch initial store→address route
    if (storeLoc != null && addrLoc != null) {
      _fetchRoute(storeLoc, addrLoc);
    }
  }

  String _shortId(String id) =>
      'BLF${id.replaceAll('-', '').substring(0, 10).toUpperCase()}';

  String _fmtDate(String? iso) {
    if (iso == null) return '';
    final dt = DateTime.tryParse(iso)?.toLocal();
    if (dt == null) return '';
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    return '${dt.day} ${months[dt.month - 1]}, ${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')} ${dt.hour < 12 ? 'AM' : 'PM'}';
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(
        body: Center(
          child: CircularProgressIndicator(color: Color(0xFF16A34A)),
        ),
      );
    }
    if (_error != null || _order == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Order Details')),
        body: Center(child: Text(_error ?? 'Order not found')),
      );
    }

    final order = _order!;
    final status = (order['status'] ?? 'placed').toString();
    final items = (order['items'] as List?) ?? [];
    final isCancelled = status == 'cancelled';

    return Scaffold(
      backgroundColor: const Color(0xFFF8F9FA),
      appBar: AppBar(
        backgroundColor: Colors.white,
        foregroundColor: const Color(0xFF0F172A),
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Track Order',
              style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16),
            ),
            Text(
              '#${_shortId(order['id'].toString())}',
              style: const TextStyle(fontSize: 11, color: Color(0xFF6B7280)),
            ),
          ],
        ),
      ),
      body: RefreshIndicator(
        color: const Color(0xFF16A34A),
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            _placedDate(order),
            const SizedBox(height: 12),
            if (isCancelled) ...[
              _cancelledBanner(),
              const SizedBox(height: 12),
            ],
            if (!isCancelled) ...[
              _estimatedDelivery(status),
              const SizedBox(height: 12),
              // Show countdown while order is active (even if expired, show 00:00)
              if (![
                'delivered',
                'completed',
                'trial_completed',
              ].contains(status)) ...[
                _deliveryCountdownCard(),
                const SizedBox(height: 12),
              ],
            ],
            // ── OTP card: show when rider has arrived ──────────────────────
            if (_deliveryStatus != null &&
                _deliveryStatus!['delivery_status'] == 'arrived' &&
                _deliveryStatus!['otp_verified_at'] == null) ...[
              _otpCard(),
              const SizedBox(height: 12),
            ],
            // ── Trial timer: show during try & buy ─────────────────────────
            if (_deliveryStatus != null &&
                _deliveryStatus!['try_buy_started_at'] != null &&
                _deliveryStatus!['try_buy_decision'] == null) ...[
              _trialTimerCard(),
              const SizedBox(height: 12),
            ],
            if (_riderInfo != null) ...[
              _riderCard(),
              const SizedBox(height: 12),
            ],
            if (_storeLoc != null || _addrLoc != null) ...[
              _mapCard(status),
              const SizedBox(height: 12),
            ],
            _addressCard(order),
            const SizedBox(height: 12),
            _itemsCard(items),
            const SizedBox(height: 12),
            _statusTimeline(status),
            const SizedBox(height: 12),
            // Cancel button — only for non-terminal, pre-pickup statuses
            if (['placed', 'confirmed', 'packed'].contains(status)) ...[
              SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  onPressed: _cancelOrder,
                  icon: const Icon(
                    Icons.cancel_outlined,
                    color: Color(0xFFEF4444),
                  ),
                  label: const Text(
                    'Cancel Order',
                    style: TextStyle(
                      color: Color(0xFFEF4444),
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  style: OutlinedButton.styleFrom(
                    side: const BorderSide(color: Color(0xFFEF4444)),
                    minimumSize: const Size.fromHeight(48),
                  ),
                ),
              ),
              const SizedBox(height: 8),
            ],
            const SizedBox(height: 20),
          ],
        ),
      ),
    );
  }

  // ── OTP card ──────────────────────────────────────────────────────────────
  Widget _otpCard() {
    final otp = _deliveryStatus?['delivery_otp']?.toString() ?? '----';
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF7C3AED), Color(0xFF4F46E5)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF7C3AED).withValues(alpha: 0.4),
            blurRadius: 14,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.local_shipping, color: Colors.white, size: 18),
              SizedBox(width: 8),
              Text(
                'Rider has arrived!',
                style: TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w800,
                  fontSize: 15,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          const Text(
            'Share this OTP with the delivery rider to receive your order:',
            style: TextStyle(color: Colors.white70, fontSize: 12),
          ),
          const SizedBox(height: 14),
          Center(
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 14),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text(
                otp.split('').join('  '),
                style: const TextStyle(
                  fontSize: 36,
                  fontWeight: FontWeight.w900,
                  color: Color(0xFF7C3AED),
                  letterSpacing: 8,
                ),
              ),
            ),
          ),
          const SizedBox(height: 10),
          const Center(
            child: Text(
              'Do NOT share with anyone else',
              style: TextStyle(color: Colors.white54, fontSize: 11),
            ),
          ),
        ],
      ),
    );
  }

  // ── Delivery countdown card ───────────────────────────────────────────────
  Widget _deliveryCountdownCard() {
    final total = 60 * 60; // 60-minute delivery window
    final elapsed = total - _deliverySecondsLeft;
    final progress = (elapsed / total).clamp(0.0, 1.0);
    final m = _deliverySecondsLeft ~/ 60;
    final s = _deliverySecondsLeft % 60;
    final display =
        '${m.toString().padLeft(2, '0')}:${s.toString().padLeft(2, '0')}';
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.06),
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(
                Icons.access_time_rounded,
                color: Color(0xFF16A34A),
                size: 20,
              ),
              const SizedBox(width: 8),
              const Text(
                'Estimated Delivery',
                style: TextStyle(
                  fontWeight: FontWeight.w700,
                  fontSize: 14,
                  color: Color(0xFF0F172A),
                ),
              ),
              const Spacer(),
              Text(
                display,
                style: const TextStyle(
                  fontWeight: FontWeight.w800,
                  fontSize: 18,
                  color: Color(0xFF16A34A),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: progress,
              minHeight: 6,
              backgroundColor: const Color(0xFFDCFCE7),
              valueColor: const AlwaysStoppedAnimation<Color>(
                Color(0xFF16A34A),
              ),
            ),
          ),
          const SizedBox(height: 6),
          const Text(
            'Time remaining for delivery',
            style: TextStyle(fontSize: 11, color: Color(0xFF9CA3AF)),
          ),
        ],
      ),
    );
  }

  // ── Trial timer card ──────────────────────────────────────────────────────
  Widget _trialTimerCard() {
    final urgent = _trialSecondsLeft < 120;
    final m = _trialSecondsLeft ~/ 60;
    final s = _trialSecondsLeft % 60;
    final display =
        '${m.toString().padLeft(2, '0')}:${s.toString().padLeft(2, '0')}';
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: urgent ? const Color(0xFFFEF2F2) : const Color(0xFFF0FDF4),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: urgent ? const Color(0xFFFCA5A5) : const Color(0xFF86EFAC),
        ),
      ),
      child: Column(
        children: [
          Row(
            children: [
              Icon(
                Icons.timer_outlined,
                color: urgent
                    ? const Color(0xFFDC2626)
                    : const Color(0xFF16A34A),
                size: 20,
              ),
              const SizedBox(width: 8),
              Text(
                urgent ? 'Trial time almost up!' : '🛍 Try & Buy in progress',
                style: TextStyle(
                  fontWeight: FontWeight.w700,
                  fontSize: 14,
                  color: urgent
                      ? const Color(0xFFDC2626)
                      : const Color(0xFF166534),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            display,
            style: TextStyle(
              fontSize: 42,
              fontWeight: FontWeight.w900,
              color: urgent ? const Color(0xFFDC2626) : const Color(0xFF16A34A),
            ),
          ),
          const SizedBox(height: 4),
          Text(
            _trialSecondsLeft == 0
                ? 'Time is up! Please make a decision.'
                : 'Time remaining to try the items',
            style: const TextStyle(color: Color(0xFF6B7280), fontSize: 12),
          ),
        ],
      ),
    );
  }

  Widget _mapCard(String status) {
    final store = _storeLoc;
    final addr = _addrLoc;
    final both = store != null && addr != null;

    final List<LatLng> points = [
      if (store != null) store,
      if (addr != null) addr,
    ];

    final bool isMoving = status == 'out_for_delivery' || status == 'picked';
    final String statusLabel = isMoving
        ? 'On the Way 🛵'
        : 'Preparing your order';

    return ClipRRect(
      borderRadius: BorderRadius.circular(16),
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.08),
              blurRadius: 12,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Column(
          children: [
            // ── Map ──────────────────────────────────────────────────────────
            SizedBox(
              height: 230,
              child: Stack(
                children: [
                  FlutterMap(
                    mapController: _mapController,
                    options: MapOptions(
                      initialCameraFit: both
                          ? CameraFit.coordinates(
                              coordinates: points,
                              padding: const EdgeInsets.all(70),
                              minZoom: 11,
                              maxZoom: 15,
                            )
                          : null,
                      initialCenter:
                          store ?? addr ?? const LatLng(20.4224, 85.9184),
                      initialZoom: 14,
                    ),
                    children: [
                      // CartoDB Positron — clean, minimal, Blinkit-style
                      TileLayer(
                        urlTemplate:
                            'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
                        subdomains: const ['a', 'b', 'c', 'd'],
                        userAgentPackageName: 'com.blinkiefash.app',
                      ),
                      if (both)
                        PolylineLayer(
                          polylines: [
                            Polyline(
                              points: _routePoints.isNotEmpty
                                  ? _routePoints
                                  : [store, addr],
                              strokeWidth: 4,
                              color: const Color(0xFF16A34A),
                            ),
                          ],
                        ),
                      MarkerLayer(
                        markers: [
                          if (store != null)
                            Marker(
                              point: store,
                              width: 44,
                              height: 44,
                              child: _storeMarker(),
                            ),
                          if (addr != null)
                            Marker(
                              point: addr,
                              width: 44,
                              height: 56,
                              child: _addressMarker(),
                            ),
                          if (_riderLoc != null)
                            Marker(
                              point: _riderLoc!,
                              width: 44,
                              height: 44,
                              child: _riderMarker(),
                            ),
                        ],
                      ),
                    ],
                  ),
                  // Status pill overlay (top-left like Blinkit)
                  Positioned(
                    top: 10,
                    left: 10,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 7,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(24),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.15),
                            blurRadius: 8,
                            offset: const Offset(0, 2),
                          ),
                        ],
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Container(
                            width: 8,
                            height: 8,
                            decoration: BoxDecoration(
                              color: isMoving
                                  ? const Color(0xFFF97316)
                                  : const Color(0xFF16A34A),
                              shape: BoxShape.circle,
                            ),
                          ),
                          const SizedBox(width: 6),
                          Text(
                            statusLabel,
                            style: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF0F172A),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
            // ── Legend bar ───────────────────────────────────────────────────
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              decoration: const BoxDecoration(
                border: Border(top: BorderSide(color: Color(0xFFF1F5F9))),
              ),
              child: Row(
                children: [
                  _mapLegendItem(
                    const Color(0xFF16A34A),
                    Icons.store,
                    'Dark Store',
                  ),
                  const SizedBox(width: 20),
                  _mapLegendItem(
                    const Color(0xFF0F172A),
                    Icons.location_pin,
                    'Your Address',
                  ),
                  if (_riderLoc != null) ...[
                    const SizedBox(width: 20),
                    _mapLegendItem(
                      const Color(0xFFF97316),
                      Icons.delivery_dining,
                      'Rider',
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _storeMarker() {
    return Container(
      width: 40,
      height: 40,
      decoration: BoxDecoration(
        color: const Color(0xFF16A34A),
        shape: BoxShape.circle,
        border: Border.all(color: Colors.white, width: 2.5),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF16A34A).withValues(alpha: 0.45),
            blurRadius: 10,
            spreadRadius: 2,
          ),
        ],
      ),
      child: const Icon(Icons.store, color: Colors.white, size: 20),
    );
  }

  Widget _addressMarker() {
    return Stack(
      alignment: Alignment.topCenter,
      children: [
        Icon(
          Icons.location_pin,
          color: const Color(0xFF0F172A),
          size: 48,
          shadows: [
            Shadow(
              color: Colors.black.withValues(alpha: 0.3),
              blurRadius: 6,
              offset: const Offset(0, 3),
            ),
          ],
        ),
        const Positioned(
          top: 7,
          child: Icon(Icons.home, color: Colors.white, size: 15),
        ),
      ],
    );
  }

  Widget _riderMarker() {
    return Container(
      width: 40,
      height: 40,
      decoration: BoxDecoration(
        color: const Color(0xFFF97316),
        shape: BoxShape.circle,
        border: Border.all(color: Colors.white, width: 2.5),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFFF97316).withValues(alpha: 0.45),
            blurRadius: 10,
            spreadRadius: 2,
          ),
        ],
      ),
      child: const Icon(Icons.delivery_dining, color: Colors.white, size: 20),
    );
  }

  Widget _riderCard() {
    final r = _riderInfo!;
    final name = r['name']?.toString() ?? 'Rider';
    final phone = r['phone']?.toString() ?? '';
    final vehicleType = r['vehicle_type']?.toString() ?? '';
    final vehicleNum = r['vehicle_number']?.toString() ?? '';
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE5E7EB)),
      ),
      child: Row(
        children: [
          Container(
            width: 46,
            height: 46,
            decoration: const BoxDecoration(
              color: Color(0xFFF0FDF4),
              shape: BoxShape.circle,
            ),
            child: const Icon(
              Icons.delivery_dining,
              color: Color(0xFF16A34A),
              size: 26,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Your Rider',
                  style: TextStyle(color: Color(0xFF6B7280), fontSize: 12),
                ),
                Text(
                  name,
                  style: const TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 15,
                  ),
                ),
                if (vehicleType.isNotEmpty || vehicleNum.isNotEmpty)
                  Text(
                    [
                      vehicleType,
                      vehicleNum,
                    ].where((s) => s.isNotEmpty).join(' • '),
                    style: const TextStyle(
                      color: Color(0xFF64748B),
                      fontSize: 12,
                    ),
                  ),
              ],
            ),
          ),
          if (phone.isNotEmpty)
            GestureDetector(
              onTap: () => launchUrl(
                Uri.parse('tel:$phone'),
                mode: LaunchMode.externalApplication,
              ),
              child: Container(
                padding: const EdgeInsets.all(10),
                decoration: const BoxDecoration(
                  color: Color(0xFFF0FDF4),
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.phone,
                  color: Color(0xFF16A34A),
                  size: 20,
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _mapLegendItem(Color color, IconData icon, String label) {
    return Row(
      children: [
        Icon(icon, color: color, size: 15),
        const SizedBox(width: 5),
        Text(
          label,
          style: TextStyle(
            color: color,
            fontSize: 12,
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    );
  }

  Widget _placedDate(Map<String, dynamic> order) {
    return Text(
      'Placed on ${_fmtDate(order['created_at']?.toString())}',
      style: const TextStyle(color: Color(0xFF6B7280), fontSize: 13),
    );
  }

  Widget _cancelledBanner() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFFEF2F2),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFFECACA)),
      ),
      child: const Row(
        children: [
          Icon(Icons.cancel_outlined, color: Color(0xFFEF4444), size: 28),
          SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Order Cancelled',
                  style: TextStyle(
                    fontWeight: FontWeight.w700,
                    color: Color(0xFFDC2626),
                    fontSize: 15,
                  ),
                ),
                SizedBox(height: 2),
                Text(
                  'This order has been cancelled.',
                  style: TextStyle(color: Color(0xFF991B1B), fontSize: 13),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _estimatedDelivery(String status) {
    final isDelivered = status == 'delivered' || status == 'completed';
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE5E7EB)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            isDelivered ? 'Delivered' : 'Estimated Delivery',
            style: const TextStyle(
              color: Color(0xFF6B7280),
              fontSize: 12,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            isDelivered
                ? 'Your order has been delivered'
                : 'Today, within 60 minutes',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w800,
              color: isDelivered
                  ? const Color(0xFF16A34A)
                  : const Color(0xFF0F172A),
            ),
          ),
          Container(
            margin: const EdgeInsets.only(top: 8),
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: _statusColor(status).withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Text(
              _statusBadgeLabel(status),
              style: TextStyle(
                color: _statusColor(status),
                fontWeight: FontWeight.w700,
                fontSize: 12,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _addressCard(Map<String, dynamic> order) {
    final line = order['address_line']?.toString() ?? '';
    final city = order['city']?.toString() ?? '';
    final pincode = order['pincode']?.toString() ?? '';
    final name = order['customer_name']?.toString() ?? '';
    if (line.isEmpty && city.isEmpty) return const SizedBox.shrink();
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE5E7EB)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(
            Icons.location_on_outlined,
            color: Color(0xFF16A34A),
            size: 20,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Shipping To',
                  style: TextStyle(color: Color(0xFF6B7280), fontSize: 12),
                ),
                if (name.isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Text(
                    name,
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                ],
                const SizedBox(height: 2),
                Text(
                  '$line\n$city - $pincode',
                  style: const TextStyle(fontSize: 13, height: 1.5),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _itemsCard(List items) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE5E7EB)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(
                Icons.inventory_2_outlined,
                color: Color(0xFF6B7280),
                size: 18,
              ),
              const SizedBox(width: 8),
              Text(
                'Products Ordered',
                style: const TextStyle(
                  fontWeight: FontWeight.w700,
                  fontSize: 14,
                ),
              ),
              const Spacer(),
              Text(
                '${items.length} item${items.length == 1 ? '' : 's'}',
                style: const TextStyle(color: Color(0xFF6B7280), fontSize: 12),
              ),
            ],
          ),
          const SizedBox(height: 12),
          ...items.map((item) => _itemRow(item as Map<String, dynamic>)),
        ],
      ),
    );
  }

  Widget _itemRow(Map<String, dynamic> item) {
    final image = item['image']?.toString();
    final name = item['product_name']?.toString() ?? '';
    final size = item['size']?.toString() ?? '';
    final color = item['color']?.toString() ?? '';
    final price = double.tryParse(item['price']?.toString() ?? '0') ?? 0;
    final qty = item['quantity'] ?? 1;

    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(10),
            child: image != null && image.isNotEmpty
                ? CachedNetworkImage(
                    imageUrl: image,
                    width: 64,
                    height: 64,
                    fit: BoxFit.cover,
                    placeholder: (ctx, url) => Container(
                      width: 64,
                      height: 64,
                      color: const Color(0xFFF1F5F9),
                    ),
                    errorWidget: (ctx, url, err) => Container(
                      width: 64,
                      height: 64,
                      color: const Color(0xFFF1F5F9),
                      child: const Icon(
                        Icons.image_outlined,
                        color: Color(0xFFCBD5E1),
                      ),
                    ),
                  )
                : Container(
                    width: 64,
                    height: 64,
                    color: const Color(0xFFF1F5F9),
                    child: const Icon(
                      Icons.image_outlined,
                      color: Color(0xFFCBD5E1),
                    ),
                  ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  name,
                  style: const TextStyle(fontWeight: FontWeight.w600),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 4),
                Text(
                  [
                    if (color.isNotEmpty) color,
                    if (size.isNotEmpty) size,
                    '×$qty',
                  ].join(' · '),
                  style: const TextStyle(
                    fontSize: 12,
                    color: Color(0xFF6B7280),
                  ),
                ),
              ],
            ),
          ),
          Text(
            '₹${price.toStringAsFixed(0)}',
            style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
          ),
        ],
      ),
    );
  }

  Widget _statusTimeline(String currentStatus) {
    final isCancelled = currentStatus == 'cancelled';
    final currentIndex = _statusSteps.indexOf(currentStatus);

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE5E7EB)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Text(
                'Order Status',
                style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
              ),
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 4,
                ),
                decoration: BoxDecoration(
                  color: _statusColor(currentStatus).withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  _statusBadgeLabel(currentStatus),
                  style: TextStyle(
                    color: _statusColor(currentStatus),
                    fontWeight: FontWeight.w700,
                    fontSize: 12,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),

          if (isCancelled)
            _timelineRow(
              icon: Icons.cancel_outlined,
              label: 'Order Cancelled',
              isDone: true,
              isLast: true,
              color: const Color(0xFFEF4444),
            )
          else
            ...List.generate(_statusSteps.length, (i) {
              final step = _statusSteps[i];
              final isDone = currentIndex >= 0 && i <= currentIndex;
              final isLast = i == _statusSteps.length - 1;
              return _timelineRow(
                icon: _statusIcons[step] ?? Icons.circle_outlined,
                label: _statusLabels[step] ?? step,
                isDone: isDone,
                isLast: isLast,
                color: isDone
                    ? const Color(0xFF16A34A)
                    : const Color(0xFFD1D5DB),
              );
            }),
        ],
      ),
    );
  }

  Widget _timelineRow({
    required IconData icon,
    required String label,
    required bool isDone,
    required bool isLast,
    required Color color,
  }) {
    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Icon + connecting line
          SizedBox(
            width: 40,
            child: Column(
              children: [
                Container(
                  width: 34,
                  height: 34,
                  decoration: BoxDecoration(
                    color: isDone
                        ? color.withValues(alpha: 0.12)
                        : const Color(0xFFF1F5F9),
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: isDone ? color : const Color(0xFFE5E7EB),
                      width: 2,
                    ),
                  ),
                  child: Icon(
                    icon,
                    size: 16,
                    color: isDone ? color : const Color(0xFFD1D5DB),
                  ),
                ),
                if (!isLast)
                  Expanded(
                    child: Container(
                      width: 2,
                      margin: const EdgeInsets.symmetric(vertical: 4),
                      color: isDone
                          ? const Color(0xFF16A34A).withValues(alpha: 0.4)
                          : const Color(0xFFE5E7EB),
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Padding(
              padding: EdgeInsets.only(top: 8, bottom: isLast ? 0 : 18),
              child: Text(
                label,
                style: TextStyle(
                  fontWeight: isDone ? FontWeight.w700 : FontWeight.w400,
                  color: isDone
                      ? const Color(0xFF0F172A)
                      : const Color(0xFF9CA3AF),
                  fontSize: 14,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
