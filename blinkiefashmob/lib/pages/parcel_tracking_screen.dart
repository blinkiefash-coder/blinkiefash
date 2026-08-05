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
  static const _orange = Color(0xFFEA580C);
  static const _blue = Color(0xFF0284C7);
  static const _red = Color(0xFFEF4444);
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

  double _parseCoordinate(dynamic value) {
    if (value is num) return value.toDouble();
    if (value is String) return double.tryParse(value) ?? 0.0;
    return 0.0;
  }

  Future<void> _fetchStatus() async {
    try {
      final res = await http
          .get(Uri.parse('$apiApiBaseUrl/deliver/request/${widget.requestId}'))
          .timeout(const Duration(seconds: 10));
      if (!mounted) return;
      final body = jsonDecode(res.body) as Map<String, dynamic>;

      // Check if response is successful
      if (body['success'] != true) {
        if (mounted) {
          setState(() {
            _loading = false;
            _error = body['message'] ?? 'Failed to load parcel details';
          });
        }
        return;
      }

      // Extract parcel data - try 'parcel' key first, then 'request'
      dynamic req = body['parcel'];
      if (req == null) {
        req = body['request'];
      }

      if (req == null || req is! Map<String, dynamic>) {
        if (mounted) {
          setState(() {
            _loading = false;
            _error = 'Parcel data not found in response';
          });
        }
        return;
      }

      if (mounted) {
        setState(() {
          _data = req;
          _loading = false;
          _error = null;
        });
      }

      // Pan map to rider if location available
      final rLat = req['rider_lat'];
      final rLng = req['rider_lng'];
      if (rLat != null && rLng != null) {
        try {
          _mapCtrl.move(
            LatLng(_parseCoordinate(rLat), _parseCoordinate(rLng)),
            14,
          );
        } catch (_) {}
      }

      // Stop polling when delivered
      if (req['status'] == 'completed' || req['status'] == 'delivered') {
        _timer?.cancel();
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _loading = false;
          _error = 'Error: ${e.toString().substring(0, 60)}';
        });
      }
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

    // Use API data for location and fare (prefer over constructor params)
    final pickupText = (_data?['pickup_text'] ?? widget.pickupText).toString();
    final dropText = (_data?['drop_text'] ?? widget.dropText).toString();
    final fareValue = _data?['estimated_fare'] ?? widget.estimatedFare;
    final fare = _parseCoordinate(fareValue) as num;

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
            'Live Tracking',
            style: TextStyle(
              fontWeight: FontWeight.w800,
              fontSize: 18,
              letterSpacing: -0.5,
            ),
          ),
          backgroundColor: Colors.white,
          foregroundColor: const Color(0xFF0F172A),
          elevation: 0,
          automaticallyImplyLeading: isDone,
          actions: [
            if (!isDone)
              Padding(
                padding: const EdgeInsets.only(right: 12),
                child: Center(
                  child: _cancelling
                      ? const Padding(
                          padding: EdgeInsets.all(8),
                          child: SizedBox(
                            width: 28,
                            height: 28,
                            child: CircularProgressIndicator(
                              strokeWidth: 2.5,
                              valueColor: AlwaysStoppedAnimation<Color>(_red),
                            ),
                          ),
                        )
                      : Material(
                          color: Colors.transparent,
                          child: InkWell(
                            onTap: _cancelRequest,
                            borderRadius: BorderRadius.circular(20),
                            child: Padding(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 12,
                                vertical: 8,
                              ),
                              child: Text(
                                'Cancel',
                                style: TextStyle(
                                  color: _red,
                                  fontWeight: FontWeight.w700,
                                  fontSize: 14,
                                  letterSpacing: 0.3,
                                ),
                              ),
                            ),
                          ),
                        ),
                ),
              ),
          ],
          bottom: PreferredSize(
            preferredSize: const Size.fromHeight(1),
            child: Container(
              color: const Color(0xFFE2E8F0),
              height: 1,
            ),
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
                    pickupText: pickupText,
                    dropText: dropText,
                    fare: fare,
                    isAssigned: isAssigned,
                    isDone: isDone,
                    onBookAnother: () =>
                        Navigator.of(context).popUntil((r) => r.isFirst),
                    onCancel: _cancelRequest,
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
    final Color bgColor;
    final Color accentColor;
    final IconData icon;
    final String label;

    if (isDone || status == 'completed') {
      bgColor = const Color(0xFFF0FDF4);
      accentColor = const Color(0xFF16A34A);
      icon = Icons.check_circle_rounded;
      label = 'Delivered Successfully! 🎉';
    } else if (status == 'arrived') {
      bgColor = const Color(0xFFE0F2FE);
      accentColor = const Color(0xFF0284C7);
      icon = Icons.location_on_rounded;
      label = 'Rider arrived at your location';
    } else if (status == 'accepted' || isAssigned) {
      bgColor = const Color(0xFFFFF7ED);
      accentColor = const Color(0xFFEA580C);
      icon = Icons.delivery_dining_rounded;
      label = 'Rider is heading to you…';
    } else {
      bgColor = const Color(0xFFF0F9FF);
      accentColor = const Color(0xFF0284C7);
      icon = Icons.access_time_rounded;
      label = 'Finding a rider…';
    }

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      color: bgColor,
      child: Row(
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: accentColor.withValues(alpha: 0.15),
              shape: BoxShape.circle,
            ),
            child: Center(
              child: Icon(icon, color: accentColor, size: 24),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    color: accentColor,
                    letterSpacing: -0.3,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  'Updates every 8 seconds',
                  style: TextStyle(
                    fontSize: 12,
                    color: accentColor.withValues(alpha: 0.6),
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),
          if (!isDone && status != 'completed')
            SizedBox(
              width: 20,
              height: 20,
              child: CircularProgressIndicator(
                strokeWidth: 2.5,
                valueColor: AlwaysStoppedAnimation(accentColor),
              ),
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
  final VoidCallback onCancel;

  const _BottomCard({
    required this.data,
    required this.pickupText,
    required this.dropText,
    required this.fare,
    required this.isAssigned,
    required this.isDone,
    required this.onBookAnother,
    required this.onCancel,
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

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.12),
            blurRadius: 20,
            offset: const Offset(0, -4),
          ),
        ],
      ),
      padding: const EdgeInsets.all(20),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // ── Route Info Card ──
            _RouteInfoCard(
              pickupText: pickupText,
              dropText: dropText,
              fare: fare,
              expectedMin: expectedMin,
              isAssigned: isAssigned,
            ),
            const SizedBox(height: 16),

            // ── Rider Info Card ──
            if (isAssigned && (riderName != null || riderPhone != null))
              _RiderInfoCard(
                name: riderName,
                phone: riderPhone,
              )
            else if (!isAssigned)
              _ConnectingCard(expectedMin: expectedMin),

            if (isAssigned && (riderName != null || riderPhone != null))
              const SizedBox(height: 16),

            // ── OTP Box ──
            if (isAssigned && data['otp_code'] != null) ...[
              _OTPBox(
                otpCode: data['otp_code'],
                isVerified: data['otp_verified'] == true,
              ),
              const SizedBox(height: 16),
            ],

            // ── Delivery Photo ──
            if (data['delivery_photo_url'] != null) ...[
              _DeliveryPhotoBox(
                photoUrl: data['delivery_photo_url'],
              ),
              const SizedBox(height: 16),
            ],

            // ── Action Buttons ──
            if (isDone)
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
                  icon: const Icon(Icons.add_circle_outline_rounded),
                  label: const Text(
                    'Book Another Delivery',
                    style: TextStyle(
                      fontWeight: FontWeight.w700,
                      fontSize: 15,
                      letterSpacing: 0.2,
                    ),
                  ),
                ),
              )
            else if (isAssigned)
              SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  style: OutlinedButton.styleFrom(
                    side: const BorderSide(
                      color: Color(0xFFEF4444),
                      width: 2,
                    ),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  onPressed: onCancel,
                  icon: const Icon(
                    Icons.close_rounded,
                    color: Color(0xFFEF4444),
                  ),
                  label: const Text(
                    'Cancel Delivery',
                    style: TextStyle(
                      fontWeight: FontWeight.w700,
                      fontSize: 14,
                      letterSpacing: 0.2,
                      color: Color(0xFFEF4444),
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

// ── Route Info Card ──
class _RouteInfoCard extends StatelessWidget {
  final String pickupText;
  final String dropText;
  final num fare;
  final int expectedMin;
  final bool isAssigned;

  const _RouteInfoCard({
    required this.pickupText,
    required this.dropText,
    required this.fare,
    required this.expectedMin,
    required this.isAssigned,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Pickup
          Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: const Color(0xFF16A34A).withValues(alpha: 0.1),
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.trip_origin_rounded,
                  color: Color(0xFF16A34A),
                  size: 18,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Pickup',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: Color(0xFF64748B),
                        letterSpacing: 0.3,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      pickupText,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF0F172A),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const Padding(
            padding: EdgeInsets.only(left: 17),
            child: SizedBox(
              height: 16,
              child: VerticalDivider(
                width: 1,
                color: Color(0xFFCBD5E1),
              ),
            ),
          ),
          // Dropoff
          Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: const Color(0xFFEF4444).withValues(alpha: 0.1),
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.place_rounded,
                  color: Color(0xFFEF4444),
                  size: 18,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Dropoff',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: Color(0xFF64748B),
                        letterSpacing: 0.3,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      dropText,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF0F172A),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Container(
            height: 1,
            color: const Color(0xFFE2E8F0),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              _InfoChip(
                icon: Icons.currency_rupee_rounded,
                label: '₹$fare',
                color: const Color(0xFF16A34A),
              ),
              const SizedBox(width: 10),
              _InfoChip(
                icon: Icons.schedule_rounded,
                label: '~$expectedMin min',
                color: const Color(0xFFEA580C),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

// ── Rider Info Card ──
class _RiderInfoCard extends StatelessWidget {
  final String? name;
  final String? phone;

  const _RiderInfoCard({
    required this.name,
    required this.phone,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            const Color(0xFF0284C7).withValues(alpha: 0.95),
            const Color(0xFF0284C7).withValues(alpha: 0.85),
          ],
        ),
        borderRadius: BorderRadius.circular(18),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF0284C7).withValues(alpha: 0.3),
            blurRadius: 16,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 56,
                height: 56,
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.2),
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: Colors.white.withValues(alpha: 0.4),
                    width: 2,
                  ),
                ),
                child: const Icon(
                  Icons.person_rounded,
                  color: Colors.white,
                  size: 32,
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Your Rider',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        letterSpacing: 0.3,
                      ),
                    ),
                    const SizedBox(height: 4),
                    if (name != null)
                      Text(
                        name!,
                        style: const TextStyle(
                          fontWeight: FontWeight.w800,
                          fontSize: 18,
                          color: Colors.white,
                          letterSpacing: -0.5,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: const Color(0xFF16A34A),
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.check_rounded,
                  color: Colors.white,
                  size: 20,
                ),
              ),
            ],
          ),
          if (phone != null) ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(
                    Icons.phone_rounded,
                    color: Colors.white,
                    size: 16,
                  ),
                  const SizedBox(width: 6),
                  Text(
                    phone!,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 0.2,
                    ),
                  ),
                ],
              ),
            ),
          ],
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(2),
            child: Divider(
              color: Colors.white.withValues(alpha: 0.2),
              height: 1,
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: _RiderStatChip(
                  icon: Icons.star_rounded,
                  label: '4.8',
                  sublabel: 'Rating',
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _RiderStatChip(
                  icon: Icons.local_shipping_rounded,
                  label: '342',
                  sublabel: 'Deliveries',
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _RiderStatChip(
                  icon: Icons.timer_rounded,
                  label: '12min',
                  sublabel: 'ETA',
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _RiderStatChip extends StatelessWidget {
  final IconData icon;
  final String label;
  final String sublabel;

  const _RiderStatChip({
    required this.icon,
    required this.label,
    required this.sublabel,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, color: Colors.white, size: 16),
          const SizedBox(height: 4),
          Text(
            label,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 13,
              fontWeight: FontWeight.w800,
            ),
          ),
          Text(
            sublabel,
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.7),
              fontSize: 9,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}

// ── Connecting Card ──
class _ConnectingCard extends StatelessWidget {
  final int expectedMin;

  const _ConnectingCard({required this.expectedMin});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFF0F9FF),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFF0284C7).withValues(alpha: 0.3)),
      ),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: const Color(0xFF0284C7).withValues(alpha: 0.15),
              shape: BoxShape.circle,
            ),
            child: const Center(
              child: SizedBox(
                width: 16,
                height: 16,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  valueColor: AlwaysStoppedAnimation(Color(0xFF0284C7)),
                ),
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Finding a rider…',
                  style: TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 14,
                    color: Color(0xFF0F172A),
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  'Usually within $expectedMin minutes',
                  style: const TextStyle(
                    color: Color(0xFF0284C7),
                    fontSize: 12,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ── OTP Box ──
class _OTPBox extends StatelessWidget {
  final String otpCode;
  final bool isVerified;

  const _OTPBox({
    required this.otpCode,
    required this.isVerified,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            const Color(0xFFF0F9FF),
            const Color(0xFFE0F2FE),
          ],
        ),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: const Color(0xFF0284C7).withValues(alpha: 0.5),
          width: 2,
        ),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF0284C7).withValues(alpha: 0.1),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Delivery OTP',
                style: TextStyle(
                  color: Color(0xFF0284C7),
                  fontSize: 13,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 0.4,
                ),
              ),
              if (isVerified)
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 5,
                  ),
                  decoration: BoxDecoration(
                    color: const Color(0xFF16A34A).withValues(alpha: 0.2),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(
                      color: const Color(0xFF16A34A),
                      width: 1.5,
                    ),
                  ),
                  child: const Row(
                    children: [
                      Icon(
                        Icons.check_circle_rounded,
                        color: Color(0xFF16A34A),
                        size: 14,
                      ),
                      SizedBox(width: 4),
                      Text(
                        'Verified',
                        style: TextStyle(
                          color: Color(0xFF16A34A),
                          fontSize: 11,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 0.2,
                        ),
                      ),
                    ],
                  ),
                ),
            ],
          ),
          const SizedBox(height: 14),
          Container(
            padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(
                color: const Color(0xFF0284C7).withValues(alpha: 0.2),
              ),
              boxShadow: [
                BoxShadow(
                  color: const Color(0xFF0284C7).withValues(alpha: 0.05),
                  blurRadius: 8,
                ),
              ],
            ),
            child: Center(
              child: Text(
                otpCode,
                style: const TextStyle(
                  fontSize: 40,
                  fontWeight: FontWeight.w900,
                  color: Color(0xFF0284C7),
                  letterSpacing: 8,
                  fontFamily: 'Courier',
                ),
              ),
            ),
          ),
          const SizedBox(height: 12),
          Text(
            isVerified
                ? '✓ OTP verified with the rider'
                : 'Share this code with your rider at delivery',
            style: TextStyle(
              color: isVerified
                  ? const Color(0xFF16A34A)
                  : const Color(0xFF64748B),
              fontSize: 12,
              fontWeight: FontWeight.w600,
              letterSpacing: 0.2,
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}

// ── Delivery Photo Box ──
class _DeliveryPhotoBox extends StatelessWidget {
  final String photoUrl;

  const _DeliveryPhotoBox({required this.photoUrl});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: const Color(0xFF86EFAC).withValues(alpha: 0.5),
          width: 2,
        ),
        color: const Color(0xFFF0FDF4),
      ),
      overflow: Overflow.hidden,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            color: const Color(0xFFF0FDF4),
            child: const Row(
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
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.2,
                  ),
                ),
              ],
            ),
          ),
          ClipRRect(
            borderRadius: const BorderRadius.vertical(
              bottom: Radius.circular(14),
            ),
            child: Image.network(
              photoUrl,
              height: 140,
              width: double.infinity,
              fit: BoxFit.cover,
              errorBuilder: (_, __, ___) => Container(
                height: 140,
                color: const Color(0xFFF1F5F9),
                child: const Center(
                  child: Icon(
                    Icons.image_not_supported_outlined,
                    color: Color(0xFF94A3B8),
                    size: 32,
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Info Chip ──
class _InfoChip extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;

  const _InfoChip({
    required this.icon,
    required this.label,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: color),
          const SizedBox(width: 4),
          Text(
            label,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: color,
            ),
          ),
        ],
      ),
    );
  }
}
