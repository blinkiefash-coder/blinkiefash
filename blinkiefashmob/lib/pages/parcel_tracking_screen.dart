import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:http/http.dart' as http;
import '../api_base.dart';

/// Real-time parcel tracking screen — polls backend every 8 s.
class ParcelTrackingScreen extends StatefulWidget {
  final String requestId;
  final String pickupText;
  final String dropText;
  final num estimatedFare;

  const ParcelTrackingScreen({
    super.key,
    required this.requestId,
    this.pickupText = '',
    this.dropText = '',
    this.estimatedFare = 0,
  });

  @override
  State<ParcelTrackingScreen> createState() => _ParcelTrackingScreenState();
}

class _ParcelTrackingScreenState extends State<ParcelTrackingScreen> {
  static const _green = Color(0xFF16A34A);
  static const _pollInterval = Duration(seconds: 8);

  Timer? _timer;
  Map<String, dynamic>? _data;
  bool _loading = true;
  String? _error;
  bool _cancelling = false;
  final MapController _mapCtrl = MapController();

  @override
  void initState() {
    super.initState();
    _fetchStatus();
    _timer = Timer.periodic(_pollInterval, (_) => _fetchStatus());
  }

  @override
  void dispose() {
    _timer?.cancel();
    _mapCtrl.dispose();
    super.dispose();
  }

  Future<void> _fetchStatus() async {
    try {
      final res = await http
          .get(Uri.parse('$apiApiBaseUrl/deliver/request/${widget.requestId}'))
          .timeout(const Duration(seconds: 10));
      if (!mounted) return;
      final body = jsonDecode(res.body) as Map<String, dynamic>;
      if (body['success'] == true) {
        final req = body['request'] as Map<String, dynamic>;
        setState(() {
          _data = req;
          _loading = false;
          _error = null;
        });
        // Pan map to rider if location available
        final rLat = req['rider_lat'];
        final rLng = req['rider_lng'];
        if (rLat != null && rLng != null) {
          try {
            _mapCtrl.move(
              LatLng(
                double.parse(rLat.toString()),
                double.parse(rLng.toString()),
              ),
              14,
            );
          } catch (_) {}
        }
        // Stop polling when delivered
        if (req['status'] == 'completed' || req['status'] == 'delivered') {
          _timer?.cancel();
        }
      }
    } catch (_) {
      if (mounted && _loading) setState(() => _error = 'Network error');
    }
  }

  Future<void> _cancelRequest() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Cancel Parcel?'),
        content: const Text('Are you sure you want to cancel this delivery?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Keep it'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text(
              'Cancel',
              style: TextStyle(color: Color(0xFFEF4444)),
            ),
          ),
        ],
      ),
    );
    if (confirm != true) return;

    setState(() => _cancelling = true);
    try {
      final res = await http
          .patch(
            Uri.parse(
              '$apiApiBaseUrl/deliver/request/${widget.requestId}/cancel',
            ),
            headers: {'Content-Type': 'application/json'},
          )
          .timeout(const Duration(seconds: 10));
      if (!mounted) return;
      final body = jsonDecode(res.body) as Map<String, dynamic>;
      if (body['success'] == true) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Delivery cancelled successfully')),
        );
        _timer?.cancel();
        setState(() => _cancelling = false);
        await Future.delayed(const Duration(seconds: 1));
        if (mounted) Navigator.of(context).pop();
      } else {
        setState(() => _cancelling = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(body['message'] ?? 'Cancellation failed')),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() => _cancelling = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: ${e.toString().substring(0, 50)}')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final status = _data?['status'] as String? ?? 'pending';
    final isAssigned =
        status == 'assigned' ||
        status == 'accepted' ||
        status == 'in_progress' ||
        status == 'picked_up';
    final isDone = status == 'completed' || status == 'delivered';

    final riderLat = _data != null
        ? double.tryParse(_data!['rider_lat']?.toString() ?? '')
        : null;
    final riderLng = _data != null
        ? double.tryParse(_data!['rider_lng']?.toString() ?? '')
        : null;
    final hasRiderLocation = riderLat != null && riderLng != null;

    final pickupLat = _data != null
        ? double.tryParse(_data!['pickup_lat']?.toString() ?? '')
        : null;
    final pickupLng = _data != null
        ? double.tryParse(_data!['pickup_lng']?.toString() ?? '')
        : null;
    final dropLat = _data != null
        ? double.tryParse(_data!['drop_lat']?.toString() ?? '')
        : null;
    final dropLng = _data != null
        ? double.tryParse(_data!['drop_lng']?.toString() ?? '')
        : null;

    final mapCenter = hasRiderLocation
        ? LatLng(riderLat, riderLng)
        : (pickupLat != null && pickupLng != null
              ? LatLng(pickupLat, pickupLng)
              : const LatLng(20.4625, 85.883));

    return PopScope(
      canPop: isDone,
      child: Scaffold(
        backgroundColor: const Color(0xFFF8FAFC),
        appBar: AppBar(
          title: const Text(
            'Parcel Tracking',
            style: TextStyle(fontWeight: FontWeight.w700),
          ),
          backgroundColor: Colors.white,
          foregroundColor: const Color(0xFF0F172A),
          elevation: 0,
          automaticallyImplyLeading: isDone,
          bottom: PreferredSize(
            preferredSize: const Size.fromHeight(1),
            child: Container(color: const Color(0xFFE2E8F0), height: 1),
          ),
        ),
        body: _loading
            ? const Center(child: CircularProgressIndicator())
            : _error != null && _data == null
            ? Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(_error!),
                    const SizedBox(height: 12),
                    ElevatedButton(
                      onPressed: _fetchStatus,
                      child: const Text('Retry'),
                    ),
                  ],
                ),
              )
            : Column(
                children: [
                  // ── Status banner ────────────────────────────────
                  _StatusBanner(
                    status: status,
                    isAssigned: isAssigned,
                    isDone: isDone,
                  ),

                  // ── Map (always visible) ─────────────────────────
                  Expanded(
                    child: FlutterMap(
                      mapController: _mapCtrl,
                      options: MapOptions(
                        initialCenter: mapCenter,
                        initialZoom: 13,
                      ),
                      children: [
                        TileLayer(
                          urlTemplate:
                              'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                          userAgentPackageName: 'com.blinkiefash.app',
                        ),
                        // ── Route polylines ──────────────────────────────
                        PolylineLayer(
                          polylines: [
                            // Pickup to Dropoff route
                            if (pickupLat != null &&
                                pickupLng != null &&
                                dropLat != null &&
                                dropLng != null)
                              Polyline(
                                points: [
                                  LatLng(pickupLat, pickupLng),
                                  LatLng(dropLat, dropLng),
                                ],
                                color: const Color(0xFFEA580C),
                                strokeWidth: 3.5,
                              ),
                            // Rider to Dropoff remaining route
                            if (hasRiderLocation &&
                                dropLat != null &&
                                dropLng != null)
                              Polyline(
                                points: [
                                  LatLng(riderLat, riderLng),
                                  LatLng(dropLat, dropLng),
                                ],
                                color: const Color(0xFF0284C7),
                                strokeWidth: 2.5,
                              ),
                          ],
                        ),
                        MarkerLayer(
                          markers: [
                            // Pickup pin
                            if (pickupLat != null && pickupLng != null)
                              Marker(
                                point: LatLng(pickupLat, pickupLng),
                                width: 36,
                                height: 36,
                                child: const Icon(
                                  Icons.trip_origin_rounded,
                                  color: _green,
                                  size: 30,
                                ),
                              ),
                            // Drop pin
                            if (dropLat != null && dropLng != null)
                              Marker(
                                point: LatLng(dropLat, dropLng),
                                width: 36,
                                height: 36,
                                child: const Icon(
                                  Icons.place_rounded,
                                  color: Color(0xFFEF4444),
                                  size: 30,
                                ),
                              ),
                            // Rider pin
                            if (hasRiderLocation)
                              Marker(
                                point: LatLng(riderLat, riderLng),
                                width: 44,
                                height: 44,
                                child: Container(
                                  decoration: const BoxDecoration(
                                    color: Color(0xFF0EA5E9),
                                    shape: BoxShape.circle,
                                  ),
                                  child: const Icon(
                                    Icons.delivery_dining_rounded,
                                    color: Colors.white,
                                    size: 24,
                                  ),
                                ),
                              ),
                          ],
                        ),
                      ],
                    ),
                  ),

                  // ── Bottom info card ─────────────────────────────
                  _BottomCard(
                    data: _data!,
                    pickupText: widget.pickupText,
                    dropText: widget.dropText,
                    fare: widget.estimatedFare,
                    isAssigned: isAssigned,
                    isDone: isDone,
                    onBookAnother: () =>
                        Navigator.of(context).popUntil((r) => r.isFirst),
                    onCancel: isDone ? null : _cancelRequest,
                    cancelling: _cancelling,
                  ),
                ],
              ),
      ),
    );
  }
}

// ── Status banner ─────────────────────────────────────────────────────────────
class _StatusBanner extends StatelessWidget {
  final String status;
  final bool isAssigned;
  final bool isDone;

  const _StatusBanner({
    required this.status,
    required this.isAssigned,
    required this.isDone,
  });

  @override
  Widget build(BuildContext context) {
    final Color bg;
    final Color fg;
    final IconData icon;
    final String label;

    if (isDone || status == 'completed') {
      bg = const Color(0xFFF0FDF4);
      fg = const Color(0xFF16A34A);
      icon = Icons.check_circle_rounded;
      label = 'Parcel Delivered! 🎉';
    } else if (status == 'arrived') {
      bg = const Color(0xFFE0F2FE);
      fg = const Color(0xFF0284C7);
      icon = Icons.location_on_rounded;
      label = 'Rider has arrived at your location';
    } else if (status == 'accepted' || isAssigned) {
      bg = const Color(0xFFFFF7ED);
      fg = const Color(0xFFEA580C);
      icon = Icons.delivery_dining_rounded;
      label = 'Rider is on the way to you…';
    } else {
      bg = const Color(0xFFF0F9FF);
      fg = const Color(0xFF0284C7);
      icon = Icons.access_time_rounded;
      label = 'Waiting for a rider to accept…';
    }

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      color: bg,
      child: Row(
        children: [
          Icon(icon, color: fg, size: 22),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              label,
              style: TextStyle(
                color: fg,
                fontWeight: FontWeight.w700,
                fontSize: 14,
              ),
            ),
          ),
          if (!isDone && status != 'completed')
            SizedBox(
              width: 14,
              height: 14,
              child: CircularProgressIndicator(strokeWidth: 2, color: fg),
            ),
        ],
      ),
    );
  }
}

// ── Bottom info card ──────────────────────────────────────────────────────────
class _BottomCard extends StatelessWidget {
  final Map<String, dynamic> data;
  final String pickupText;
  final String dropText;
  final num fare;
  final bool isAssigned;
  final bool isDone;
  final VoidCallback onBookAnother;
  final VoidCallback? onCancel;
  final bool cancelling;

  const _BottomCard({
    required this.data,
    required this.pickupText,
    required this.dropText,
    required this.fare,
    required this.isAssigned,
    required this.isDone,
    required this.onBookAnother,
    this.onCancel,
    this.cancelling = false,
  });

  int _calculateExpectedMinutes() {
    // If rider not yet assigned, show 5 min connection timer
    if (!isAssigned) return 5;

    // If rider assigned, calculate based on distance
    final distValue = data['distance_km'];
    double distanceKm = 0;
    if (distValue is num) {
      distanceKm = distValue.toDouble();
    } else if (distValue is String) {
      distanceKm = double.tryParse(distValue) ?? 0;
    }
    // Assume average speed of 30 km/h, minimum 5 minutes
    final minutes = distanceKm > 0 ? (distanceKm / 30 * 60).ceil() : 5;
    return minutes > 0 ? minutes : 5;
  }

  @override
  Widget build(BuildContext context) {
    final riderName = data['rider_name'] as String?;
    final riderPhone = data['rider_phone'] as String?;
    final expectedMin = _calculateExpectedMinutes();
    final timerLabel = isAssigned
        ? 'Expected: $expectedMin min'
        : 'Connecting to rider in $expectedMin min';

    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        boxShadow: [BoxShadow(color: Colors.black12, blurRadius: 12)],
      ),
      padding: const EdgeInsets.all(16),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Route
          Row(
            children: [
              const Icon(
                Icons.trip_origin_rounded,
                color: Color(0xFF16A34A),
                size: 16,
              ),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  pickupText,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 12),
                ),
              ),
            ],
          ),
          const Padding(
            padding: EdgeInsets.only(left: 7),
            child: SizedBox(
              height: 12,
              child: VerticalDivider(width: 1, color: Color(0xFFCBD5E1)),
            ),
          ),
          Row(
            children: [
              const Icon(
                Icons.place_rounded,
                color: Color(0xFFEF4444),
                size: 16,
              ),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  dropText,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 12),
                ),
              ),
              Text(
                '₹$fare',
                style: const TextStyle(
                  fontWeight: FontWeight.w800,
                  color: Color(0xFF16A34A),
                  fontSize: 16,
                ),
              ),
            ],
          ),

          // Rider info
          if (isAssigned && (riderName != null || riderPhone != null)) ...[
            const Divider(height: 20),
            Row(
              children: [
                const CircleAvatar(
                  radius: 18,
                  backgroundColor: Color(0xFFE0F2FE),
                  child: Icon(Icons.person_rounded, color: Color(0xFF0284C7)),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (riderName != null)
                        Text(
                          riderName,
                          style: const TextStyle(
                            fontWeight: FontWeight.w700,
                            fontSize: 14,
                          ),
                        ),
                      if (riderPhone != null)
                        Text(
                          riderPhone,
                          style: const TextStyle(
                            color: Color(0xFF64748B),
                            fontSize: 12,
                          ),
                        ),
                    ],
                  ),
                ),
              ],
            ),
          ],

          // OTP Box - Show when rider accepts
          if (isAssigned && data['otp_code'] != null) ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: const Color(0xFFF0F9FF),
                border: Border.all(color: const Color(0xFF0284C7), width: 2),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Delivery OTP',
                    style: TextStyle(
                      color: Color(0xFF0284C7),
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        data['otp_code'] ?? '---',
                        style: const TextStyle(
                          fontSize: 28,
                          fontWeight: FontWeight.w900,
                          color: Color(0xFF0284C7),
                          letterSpacing: 4,
                        ),
                      ),
                      if (data['otp_verified'] == true)
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 10,
                            vertical: 6,
                          ),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF0FDF4),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: const Row(
                            children: [
                              Icon(
                                Icons.check_circle_rounded,
                                color: Color(0xFF16A34A),
                                size: 16,
                              ),
                              SizedBox(width: 6),
                              Text(
                                'Verified',
                                style: TextStyle(
                                  color: Color(0xFF16A34A),
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ],
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text(
                    data['otp_verified'] == true
                        ? 'OTP verified with rider ✓'
                        : 'Share this code with your rider at delivery',
                    style: const TextStyle(
                      color: Color(0xFF64748B),
                      fontSize: 11,
                    ),
                  ),
                ],
              ),
            ),
          ],

          // Photo Proof - Show when uploaded
          if (isAssigned && data['delivery_photo_url'] != null) ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFFF0FDF4),
                border: Border.all(color: const Color(0xFF86EFAC), width: 2),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Row(
                    children: [
                      Icon(
                        Icons.check_circle_rounded,
                        color: Color(0xFF16A34A),
                        size: 18,
                      ),
                      SizedBox(width: 8),
                      Text(
                        'Proof of Delivery',
                        style: TextStyle(
                          color: Color(0xFF16A34A),
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(8),
                    child: Image.network(
                      data['delivery_photo_url'],
                      height: 120,
                      width: double.infinity,
                      fit: BoxFit.cover,
                      errorBuilder: (_, __, ___) => Container(
                        height: 120,
                        color: const Color(0xFFF1F5F9),
                        child: const Center(
                          child: Icon(
                            Icons.image_not_supported_outlined,
                            color: Color(0xFF94A3B8),
                          ),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Photo taken by rider for verification',
                    style: TextStyle(color: Color(0xFF64748B), fontSize: 11),
                  ),
                ],
              ),
            ),
          ],

          // Expected time + Cancel button
          if (!isDone) ...[
            const SizedBox(height: 14),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              decoration: BoxDecoration(
                color: const Color(0xFFFFF7ED),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      const Icon(
                        Icons.schedule_rounded,
                        color: Color(0xFFEA580C),
                        size: 20,
                      ),
                      const SizedBox(width: 8),
                      Text(
                        timerLabel,
                        style: const TextStyle(
                          color: Color(0xFFEA580C),
                          fontWeight: FontWeight.w600,
                          fontSize: 13,
                        ),
                      ),
                    ],
                  ),
                  if (cancelling)
                    const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  else
                    TextButton(
                      onPressed: onCancel,
                      child: const Text(
                        'Cancel',
                        style: TextStyle(
                          color: Color(0xFFEF4444),
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ],

          // Book another button
          if (isDone) ...[
            const SizedBox(height: 14),
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                style: FilledButton.styleFrom(
                  backgroundColor: const Color(0xFF16A34A),
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                onPressed: onBookAnother,
                icon: const Icon(Icons.add_rounded, color: Colors.white),
                label: const Text(
                  'Book Another Parcel',
                  style: TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 15,
                    color: Colors.white,
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
