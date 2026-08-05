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
import '../api_base.dart';
import '../widgets/bf_loader.dart';

// ── Status helpers ────────────────────────────────────────────────────────────

const _statusSteps = ['placed', 'packed', 'out_for_delivery', 'delivered'];

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

// Short labels for the compact horizontal stepper
const _statusIcons = {
  'placed': Icons.receipt_long_outlined,
  'packed': Icons.inventory_2_outlined,
  'out_for_delivery': Icons.delivery_dining_outlined,
  'delivered': Icons.home_outlined,
};

String _timelineStageForStatus(String status) {
  switch (status) {
    case 'placed':
    case 'confirmed':
      return 'placed';
    case 'packed':
    case 'picked':
      return 'packed';
    case 'out_for_delivery':
      return 'out_for_delivery';
    case 'delivered':
    case 'completed':
    case 'trial_started':
    case 'trial_completed':
      return 'delivered';
    default:
      return 'placed';
  }
}

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
  int _extraDilationSeconds = 0;
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

  static const _cancelReasons = [
    'Found a better price elsewhere',
    'Ordered by mistake',
    'Wrong item / size selected',
    'Changed my mind',
    'Delivery is taking too long',
    'Payment issue',
    'Duplicate order placed',
    'Other',
  ];

  Future<void> _cancelOrder() async {
    String? selectedReason;
    final otherCtrl = TextEditingController();

    final confirmed = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (ctx, setSheetState) {
            return Padding(
              padding: EdgeInsets.only(
                bottom: MediaQuery.of(ctx).viewInsets.bottom,
              ),
              child: SingleChildScrollView(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 20, 20, 28),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Row(
                        children: [
                          Container(
                            width: 36,
                            height: 36,
                            decoration: BoxDecoration(
                              color: const Color(0xFFFEF2F2),
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: const Icon(
                              Icons.cancel_outlined,
                              color: Color(0xFFEF4444),
                              size: 20,
                            ),
                          ),
                          const SizedBox(width: 12),
                          const Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Cancel Order',
                                  style: TextStyle(
                                    fontSize: 16,
                                    fontWeight: FontWeight.w800,
                                    color: Color(0xFF0F172A),
                                  ),
                                ),
                                Text(
                                  'Please tell us why you\'re cancelling',
                                  style: TextStyle(
                                    fontSize: 12,
                                    color: Color(0xFF6B7280),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 20),
                      ..._cancelReasons.map((reason) {
                        final isOther = reason == 'Other';
                        return Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            InkWell(
                              onTap: () =>
                                  setSheetState(() => selectedReason = reason),
                              borderRadius: BorderRadius.circular(10),
                              child: Padding(
                                padding: const EdgeInsets.symmetric(
                                  vertical: 6,
                                  horizontal: 4,
                                ),
                                child: Row(
                                  children: [
                                    AnimatedContainer(
                                      duration: const Duration(
                                        milliseconds: 150,
                                      ),
                                      width: 20,
                                      height: 20,
                                      decoration: BoxDecoration(
                                        shape: BoxShape.circle,
                                        border: Border.all(
                                          color: selectedReason == reason
                                              ? const Color(0xFFEF4444)
                                              : const Color(0xFFD1D5DB),
                                          width: 2,
                                        ),
                                        color: selectedReason == reason
                                            ? const Color(0xFFEF4444)
                                            : Colors.white,
                                      ),
                                      child: selectedReason == reason
                                          ? const Icon(
                                              Icons.check,
                                              size: 12,
                                              color: Colors.white,
                                            )
                                          : null,
                                    ),
                                    const SizedBox(width: 12),
                                    Text(
                                      reason,
                                      style: TextStyle(
                                        fontSize: 14,
                                        color: selectedReason == reason
                                            ? const Color(0xFF0F172A)
                                            : const Color(0xFF374151),
                                        fontWeight: selectedReason == reason
                                            ? FontWeight.w600
                                            : FontWeight.w400,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                            if (isOther && selectedReason == 'Other') ...[
                              const SizedBox(height: 8),
                              TextField(
                                controller: otherCtrl,
                                maxLines: 3,
                                maxLength: 300,
                                autofocus: true,
                                decoration: InputDecoration(
                                  hintText: 'Please describe your reason...',
                                  hintStyle: const TextStyle(
                                    color: Color(0xFF9CA3AF),
                                    fontSize: 13,
                                  ),
                                  filled: true,
                                  fillColor: const Color(0xFFF9FAFB),
                                  border: OutlineInputBorder(
                                    borderRadius: BorderRadius.circular(10),
                                    borderSide: const BorderSide(
                                      color: Color(0xFFE5E7EB),
                                    ),
                                  ),
                                  enabledBorder: OutlineInputBorder(
                                    borderRadius: BorderRadius.circular(10),
                                    borderSide: const BorderSide(
                                      color: Color(0xFFE5E7EB),
                                    ),
                                  ),
                                  focusedBorder: OutlineInputBorder(
                                    borderRadius: BorderRadius.circular(10),
                                    borderSide: const BorderSide(
                                      color: Color(0xFFEF4444),
                                    ),
                                  ),
                                  contentPadding: const EdgeInsets.all(12),
                                ),
                              ),
                            ],
                            const SizedBox(height: 2),
                          ],
                        );
                      }),
                      const SizedBox(height: 16),
                      Row(
                        children: [
                          Expanded(
                            child: OutlinedButton(
                              onPressed: () => Navigator.pop(ctx, false),
                              child: const Text('Keep Order'),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: FilledButton(
                              onPressed: selectedReason == null
                                  ? null
                                  : () => Navigator.pop(ctx, true),
                              style: FilledButton.styleFrom(
                                backgroundColor: const Color(0xFFEF4444),
                              ),
                              child: const Text('Confirm Cancel'),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            );
          },
        );
      },
    );

    if (confirmed != true || !mounted) return;

    final finalReason = selectedReason == 'Other' && otherCtrl.text.isNotEmpty
        ? 'Other: ${otherCtrl.text.trim()}'
        : selectedReason ?? '';

    final res = await _api.cancelOrder(widget.orderId, reason: finalReason);
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
    final scheduledAt = _scheduledFor(order);
    if (scheduledAt != null && scheduledAt.isAfter(DateTime.now())) {
      setState(() => _deliverySecondsLeft = 0);
      return;
    }
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
        if (_deliverySecondsLeft > 0) {
          _deliverySecondsLeft--;
          // Smart dilation: if rider > 1 km away and < 8 min left, add 1 min every 20 s
          final rLoc = _riderLoc;
          final aLoc = _addrLoc;
          if (rLoc != null && aLoc != null && _deliverySecondsLeft < 480) {
            final dLat = rLoc.latitude - aLoc.latitude;
            final dLng = rLoc.longitude - aLoc.longitude;
            final approxKm = ((dLat * dLat + dLng * dLng) * 12321.0).clamp(
              0,
              100,
            );
            if (approxKm > 1.0 && _deliverySecondsLeft % 20 == 0) {
              _deliverySecondsLeft += 60;
              _extraDilationSeconds += 60;
            }
          }
        }
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

  DateTime? _scheduledFor(Map<String, dynamic> order) {
    final raw = order['scheduled_for']?.toString();
    if (raw == null || raw.isEmpty) return null;
    return DateTime.tryParse(raw)?.toLocal();
  }

  String? _scheduledSlotLabel(Map<String, dynamic> order) {
    final raw = order['scheduled_slot_label']?.toString();
    if (raw == null || raw.trim().isEmpty) return null;
    return raw.trim();
  }

  bool _isScheduled(Map<String, dynamic> order) {
    final type = order['delivery_schedule_type']?.toString() ?? 'asap';
    return type == 'scheduled';
  }

  String _scheduledEtaText(Map<String, dynamic> order) {
    final slotLabel = _scheduledSlotLabel(order);
    final scheduledAt = _scheduledFor(order);
    if (slotLabel != null) {
      if (scheduledAt != null) {
        final now = DateTime.now();
        final tomorrow = DateTime(now.year, now.month, now.day + 1);
        if (scheduledAt.year == tomorrow.year &&
            scheduledAt.month == tomorrow.month &&
            scheduledAt.day == tomorrow.day) {
          return 'Tomorrow at $slotLabel';
        }
      }
      return 'Scheduled at $slotLabel';
    }
    if (scheduledAt != null) return _formatScheduledLabel(scheduledAt);
    return 'Scheduled Delivery';
  }

  String _formatTime(DateTime dt) {
    final hour12 = dt.hour % 12 == 0 ? 12 : dt.hour % 12;
    final minute = dt.minute.toString().padLeft(2, '0');
    final period = dt.hour < 12 ? 'AM' : 'PM';
    return '$hour12:$minute $period';
  }

  String _formatScheduledLabel(DateTime dt) {
    final now = DateTime.now();
    final tomorrow = DateTime(now.year, now.month, now.day + 1);
    final slot = _formatTime(dt);
    if (dt.year == tomorrow.year &&
        dt.month == tomorrow.month &&
        dt.day == tomorrow.day) {
      return 'Tomorrow at $slot';
    }
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
    return '${dt.day} ${months[dt.month - 1]} at $slot';
  }

  String? _resolveImageUrl(dynamic raw) {
    final value = raw?.toString().trim();
    if (value == null || value.isEmpty) return null;
    if (value.startsWith('http://') || value.startsWith('https://')) {
      return value;
    }
    if (value.startsWith('/')) return '$apiBaseUrl$value';
    return '$apiBaseUrl/$value';
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(body: Center(child: BfSpinner()));
    }
    if (_error != null || _order == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Order Details')),
        body: Center(child: Text(_error ?? 'Order not found')),
      );
    }

    final order = _order!;
    final status = (order['status'] ?? 'placed').toString();
    final cancelReason = (order['cancel_reason'] ?? '').toString().trim();
    final items = (order['items'] as List?) ?? [];
    final isCancelled = status == 'cancelled';
    final isDelivered = [
      'delivered',
      'completed',
      'trial_completed',
    ].contains(status);

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
            const Text(
              'Track Order',
              style: TextStyle(
                fontWeight: FontWeight.w700,
                fontSize: 16,
                color: Color(0xFF0F172A),
              ),
            ),
            Text(
              '#${_shortId(order['id'].toString())}',
              style: const TextStyle(fontSize: 11, color: Color(0xFF6B7280)),
            ),
          ],
        ),
      ),
      body: RefreshIndicator(
        color: const Color(0xFF22C55E),
        backgroundColor: const Color(0xFF0D2015),
        strokeWidth: 2.5,
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            _placedDate(order),
            const SizedBox(height: 12),
            _statusTimeline(status),
            const SizedBox(height: 12),
            if (!isCancelled) ...[
              _estimatedDelivery(status, order),
              const SizedBox(height: 12),
            ],
            if (isCancelled) ...[
              _cancelledBanner(cancelReason: cancelReason),
              const SizedBox(height: 12),
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
            if (!isCancelled &&
                !isDelivered &&
                (_storeLoc != null || _addrLoc != null)) ...[
              _mapCard(status),
              const SizedBox(height: 12),
            ],
            _addressCard(order),
            const SizedBox(height: 12),
            _itemsCard(items),
            const SizedBox(height: 12),
            // ── Delivery countdown timer (bottom, prominent) ───────────────
            if (!isCancelled &&
                ![
                  'delivered',
                  'completed',
                  'trial_completed',
                ].contains(status) &&
                !_isScheduled(order)) ...[
              _deliveryCountdownCard(),
              const SizedBox(height: 12),
            ],
            // Invoice — only for delivered/completed orders
            if (['delivered', 'completed', 'trial_completed'].contains(status))
              SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  onPressed: () async {
                    final url = Uri.parse(
                      '$apiApiBaseUrl/checkout/orders/${order['id']}/invoice',
                    );
                    if (await canLaunchUrl(url)) {
                      await launchUrl(
                        url,
                        mode: LaunchMode.externalApplication,
                      );
                    }
                  },
                  icon: const Icon(
                    Icons.receipt_long_rounded,
                    color: Color(0xFF16A34A),
                  ),
                  label: const Text(
                    'Download Invoice',
                    style: TextStyle(
                      color: Color(0xFF16A34A),
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  style: OutlinedButton.styleFrom(
                    side: const BorderSide(color: Color(0xFF16A34A)),
                    minimumSize: const Size.fromHeight(48),
                  ),
                ),
              ),
            const SizedBox(height: 8),
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
    const totalSecs = 60 * 60; // 60-minute base window
    final displayed = _deliverySecondsLeft + _extraDilationSeconds;
    final elapsed = (totalSecs - _deliverySecondsLeft).clamp(0, totalSecs);
    final progress = (elapsed / totalSecs).clamp(0.0, 1.0);
    final m = displayed ~/ 60;
    // Show "X min" — no seconds, rounded up so it never shows 0
    final display = m > 0 ? '$m min' : 'Soon';
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

    final List<LatLng> points = [?store, ?addr];

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
                    'Dispatch Partner',
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

  Widget _cancelledBanner({String? cancelReason}) {
    final reason = (cancelReason ?? '').trim();
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFFEF2F2),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFFECACA)),
      ),
      child: Row(
        children: [
          const Icon(Icons.cancel_outlined, color: Color(0xFFEF4444), size: 28),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Order Cancelled',
                  style: TextStyle(
                    fontWeight: FontWeight.w700,
                    color: Color(0xFFDC2626),
                    fontSize: 15,
                  ),
                ),
                const SizedBox(height: 2),
                const Text(
                  'This order has been cancelled by the store.',
                  style: TextStyle(color: Color(0xFF991B1B), fontSize: 13),
                ),
                if (reason.isNotEmpty) ...[
                  const SizedBox(height: 6),
                  Text(
                    'Reason: $reason',
                    style: const TextStyle(
                      color: Color(0xFF7F1D1D),
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _estimatedDelivery(String status, Map<String, dynamic> order) {
    final isDelivered = status == 'delivered' || status == 'completed';
    final deliveryPromise =
        order['deliveryPromise']?.toString() ?? 'Today, within 60 minutes';
    final deliveryType = order['deliveryType']?.toString();
    final distanceKm = order['distanceKm'] as num?;

    String deliveryText = deliveryPromise;
    if (!isDelivered && deliveryType == 'local' || deliveryType == 'extended') {
      // For dynamic ETAs, show the promise from backend
      deliveryText = deliveryPromise;
    } else if (!isDelivered) {
      // For scheduled deliveries, show what was delivered
      deliveryText = deliveryPromise;
    }

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
            isDelivered ? 'Your order has been delivered' : deliveryText,
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w800,
              color: isDelivered
                  ? const Color(0xFF16A34A)
                  : const Color(0xFF0F172A),
            ),
          ),
          // Show distance info if available
          if (!isDelivered && distanceKm != null && distanceKm > 0)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text(
                'Distance: ${distanceKm.toStringAsFixed(1)} km',
                style: const TextStyle(color: Color(0xFF6B7280), fontSize: 12),
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
                    style: const TextStyle(
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF0F172A),
                    ),
                  ),
                ],
                const SizedBox(height: 2),
                Text(
                  '$line\n$city - $pincode',
                  style: const TextStyle(
                    fontSize: 13,
                    height: 1.5,
                    color: Color(0xFF0F172A),
                  ),
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
              const Text(
                'Products Ordered',
                style: TextStyle(
                  fontWeight: FontWeight.w700,
                  fontSize: 14,
                  color: Color(0xFF0F172A),
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
    final image = _resolveImageUrl(
      item['image'] ?? item['image_url'] ?? item['url'],
    );
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
                  style: const TextStyle(
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF0F172A),
                  ),
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
    final timelineStage = _timelineStageForStatus(currentStatus);
    final currentIndex = _statusSteps.indexOf(timelineStage);
    final statusColor = _statusColor(currentStatus);

    final steps = isCancelled
        ? [
            {'icon': Icons.cancel_outlined, 'label': 'Cancelled'},
          ]
        : _statusSteps
              .map(
                (s) => {
                  'icon': _statusIcons[s] ?? Icons.circle,
                  'label': _statusLabels[s] ?? s,
                },
              )
              .toList();
    final total = steps.length;

    return Container(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE5E7EB)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x06000000),
            blurRadius: 8,
            offset: Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Row(
            children: [
              const Text(
                'Order Status',
                style: TextStyle(
                  fontWeight: FontWeight.w800,
                  fontSize: 15,
                  color: Color(0xFF0F172A),
                ),
              ),
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 5,
                ),
                decoration: BoxDecoration(
                  color: statusColor.withAlpha(20),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: statusColor.withAlpha(60)),
                ),
                child: Text(
                  _statusBadgeLabel(currentStatus),
                  style: TextStyle(
                    color: statusColor,
                    fontWeight: FontWeight.w700,
                    fontSize: 12,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 24),

          // Horizontal stepper
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: List.generate(total * 2 - 1, (idx) {
              // Even indices = steps, odd indices = connecting lines
              if (idx.isOdd) {
                final stepIdx = idx ~/ 2;
                final isDone =
                    !isCancelled && currentIndex >= 0 && stepIdx < currentIndex;
                return Expanded(
                  child: Padding(
                    padding: const EdgeInsets.only(top: 20),
                    child: Container(
                      height: 3,
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(2),
                        gradient: LinearGradient(
                          colors: isDone
                              ? [
                                  const Color(0xFF16A34A),
                                  const Color(0xFF16A34A).withAlpha(120),
                                ]
                              : [
                                  const Color(0xFFE2E8F0),
                                  const Color(0xFFE2E8F0),
                                ],
                        ),
                      ),
                    ),
                  ),
                );
              }

              final i = idx ~/ 2;
              final isDone = isCancelled
                  ? true
                  : (currentIndex >= 0 && i <= currentIndex);
              final isCurrent = isCancelled ? true : (i == currentIndex);
              final icon = steps[i]['icon'] as IconData;
              final label = steps[i]['label'] as String;
              final accent = isCancelled
                  ? const Color(0xFFEF4444)
                  : const Color(0xFF16A34A);

              return Expanded(
                child: Column(
                  children: [
                    // Circle
                    isCurrent
                        ? _PulsingRing(
                            accentColor: accent,
                            child: Container(
                              width: 40,
                              height: 40,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                color: accent,
                              ),
                              child: Icon(icon, size: 18, color: Colors.white),
                            ),
                          )
                        : Container(
                            width: 40,
                            height: 40,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: isDone ? accent : Colors.white,
                              border: Border.all(
                                color: isDone
                                    ? accent
                                    : const Color(0xFFDDE3EC),
                                width: 2,
                              ),
                            ),
                            child: Icon(
                              isDone ? Icons.check_rounded : icon,
                              size: 17,
                              color: isDone
                                  ? Colors.white
                                  : const Color(0xFFCBD5E1),
                            ),
                          ),
                    const SizedBox(height: 6),
                    // Label — up to 2 lines so full words show
                    Text(
                      label,
                      textAlign: TextAlign.center,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 9.5,
                        fontWeight: isCurrent
                            ? FontWeight.w800
                            : (isDone ? FontWeight.w600 : FontWeight.w400),
                        color: isCurrent
                            ? const Color(0xFF0F172A)
                            : (isDone
                                  ? const Color(0xFF374151)
                                  : const Color(0xFFB0BEC5)),
                        height: 1.3,
                        letterSpacing: -0.2,
                      ),
                    ),
                  ],
                ),
              );
            }),
          ),
        ],
      ),
    );
  }
}

// ── Pulsing ring animation for current status step ───────────────────────────
class _PulsingRing extends StatefulWidget {
  final Widget child;
  final Color accentColor;
  const _PulsingRing({required this.child, required this.accentColor});
  @override
  State<_PulsingRing> createState() => _PulsingRingState();
}

class _PulsingRingState extends State<_PulsingRing>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;
  late final Animation<double> _scale;
  late final Animation<double> _opacity;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    )..repeat();
    _scale = Tween<double>(
      begin: 1.0,
      end: 2.0,
    ).animate(CurvedAnimation(parent: _ctrl, curve: Curves.easeOut));
    _opacity = Tween<double>(
      begin: 0.5,
      end: 0.0,
    ).animate(CurvedAnimation(parent: _ctrl, curve: Curves.easeOut));
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 48,
      height: 48,
      child: Stack(
        alignment: Alignment.center,
        children: [
          AnimatedBuilder(
            animation: _ctrl,
            builder: (ctx, anim) => Transform.scale(
              scale: _scale.value,
              child: Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: widget.accentColor.withAlpha(
                    (_opacity.value * 255).toInt(),
                  ),
                ),
              ),
            ),
          ),
          widget.child,
        ],
      ),
    );
  }
}
