import 'dart:async';
import 'dart:convert';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:geocoding/geocoding.dart';
import 'package:geolocator/geolocator.dart';
import 'package:http/http.dart' as http;
import 'package:image_picker/image_picker.dart';
import 'package:latlong2/latlong.dart';

import '../services/api_client.dart';
import '../services/notification_service.dart';
import '../services/user_session.dart';
import 'login_screen.dart';
import 'location_picker_screen.dart';
import 'vendor_help_screen.dart';

class VendorDashboardScreen extends StatefulWidget {
  const VendorDashboardScreen({
    super.key,
    required this.vendorId,
    required this.storeName,
    required this.email,
  });

  final String vendorId;
  final String storeName;
  final String email;

  @override
  State<VendorDashboardScreen> createState() => _VendorDashboardScreenState();
}

class _VendorDashboardScreenState extends State<VendorDashboardScreen> {
  final ApiClient _api = ApiClient();
  int _tab = 0;
  bool _statusLoading = true;
  bool _statusUpdating = false;
  bool _isOperational = true;

  @override
  void initState() {
    super.initState();
    _loadOperationalStatus();
  }

  Future<void> _loadOperationalStatus() async {
    try {
      final profile = await _api.fetchVendorProfile(widget.vendorId);
      if (!mounted) return;
      setState(() {
        _isOperational = profile['is_operational'] != false;
        _statusLoading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _statusLoading = false);
    }
  }

  Future<void> _toggleOperationalStatus(bool value) async {
    setState(() => _statusUpdating = true);
    try {
      final res = await _api.setVendorOperationalStatus(
        vendorId: widget.vendorId,
        isOperational: value,
      );
      if (!mounted) return;
      if (res['success'] == true) {
        setState(() => _isOperational = value);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              value
                  ? 'Store is now LIVE. Customers can place new orders.'
                  : 'Store is now PAUSED. Products are hidden for shoppers.',
            ),
          ),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              (res['message'] ?? res['error'] ?? 'Unable to update status')
                  .toString(),
            ),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _statusUpdating = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, result) {
        if (!didPop && _tab != 0) {
          setState(() => _tab = 0);
        }
      },
      child: Scaffold(
        backgroundColor: const Color(0xFFF8FAFC),
        appBar: AppBar(
          backgroundColor: Colors.white,
          elevation: 0,
          surfaceTintColor: Colors.white,
          titleSpacing: 0,
          toolbarHeight: 60,
          title: Row(
            children: [
              const SizedBox(width: 6),
              Image.asset('assets/images/logo.png', width: 32, height: 32),
              const SizedBox(width: 6),
              Flexible(
                child: RichText(
                  overflow: TextOverflow.ellipsis,
                  text: TextSpan(
                    style: TextStyle(
                      fontFamily: 'Montserrat',
                      fontWeight: FontWeight.w900,
                      fontSize: 20,
                    ),
                    children: [
                      TextSpan(
                        text: 'BLINKIE',
                        style: TextStyle(color: Color(0xFF0F172A)),
                      ),
                      TextSpan(
                        text: 'FASH',
                        style: TextStyle(color: Color(0xFF16A34A)),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
          bottom: PreferredSize(
            preferredSize: const Size.fromHeight(26),
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
              child: Align(
                alignment: Alignment.centerLeft,
                child: Text(
                  'Vendor Console • ${widget.storeName}',
                  style: const TextStyle(
                    fontSize: 12,
                    color: Color(0xFF64748B),
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ),
          ),
          actions: [
            if (!_statusLoading)
              Row(
                children: [
                  Text(
                    _isOperational ? 'LIVE' : 'PAUSED',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: _isOperational
                          ? const Color(0xFF166534)
                          : const Color(0xFFB91C1C),
                    ),
                  ),
                  Switch(
                    value: _isOperational,
                    onChanged: _statusUpdating
                        ? null
                        : (v) => _toggleOperationalStatus(v),
                  ),
                ],
              ),
            IconButton(
              tooltip: 'Help & Support',
              onPressed: () {
                Navigator.of(context).push(
                  MaterialPageRoute<void>(
                    builder: (_) => const VendorHelpScreen(),
                  ),
                );
              },
              icon: const Icon(Icons.support_agent_rounded),
            ),
            IconButton(
              tooltip: 'Sign out',
              onPressed: () async {
                await UserSession.instance.clear();
                await NotificationService.instance.clearForCurrentUser();
                if (!context.mounted) return;
                Navigator.of(context).pushAndRemoveUntil(
                  MaterialPageRoute(
                    builder: (_) => const LoginScreen(startAsVendor: true),
                  ),
                  (_) => false,
                );
              },
              icon: const Icon(Icons.logout_rounded),
            ),
          ],
        ),
        body: IndexedStack(
          index: _tab,
          children: [
            _VendorAddProductTab(
              vendorId: widget.vendorId,
              fallbackStoreLabel: widget.storeName,
            ),
            _VendorStockMonitoringTab(vendorId: widget.vendorId),
            _VendorStockUpdateTab(vendorId: widget.vendorId),
            _VendorOrdersTab(vendorId: widget.vendorId),
            _VendorDeliverTab(vendorId: widget.vendorId),
          ],
        ),
        bottomNavigationBar: BottomNavigationBar(
          type: BottomNavigationBarType.fixed,
          selectedItemColor: const Color(0xFF16A34A),
          unselectedItemColor: const Color(0xFF94A3B8),
          selectedLabelStyle: const TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w600,
          ),
          unselectedLabelStyle: const TextStyle(fontSize: 11),
          backgroundColor: Colors.white,
          elevation: 12,
          currentIndex: _tab,
          onTap: (i) => setState(() => _tab = i),
          items: const [
            BottomNavigationBarItem(
              icon: Icon(Icons.add_box_outlined),
              activeIcon: Icon(Icons.add_box_rounded),
              label: 'Catalog',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.inventory_2_outlined),
              activeIcon: Icon(Icons.inventory_2_rounded),
              label: 'Insights',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.tune_outlined),
              activeIcon: Icon(Icons.tune_rounded),
              label: 'Adjust',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.receipt_long_outlined),
              activeIcon: Icon(Icons.receipt_long_rounded),
              label: 'Orders',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.local_shipping_outlined),
              activeIcon: Icon(Icons.local_shipping_rounded),
              label: 'Parcel',
            ),
          ],
        ),
      ),
    );
  }
}

class _VendorDeliverTab extends StatefulWidget {
  const _VendorDeliverTab({required this.vendorId});

  final String vendorId;

  @override
  State<_VendorDeliverTab> createState() => _VendorDeliverTabState();
}

class _VendorDeliverTabState extends State<_VendorDeliverTab> {
  final ApiClient _api = ApiClient();

  bool _loading = true;
  bool _updating = false;
  bool _estimating = false;
  bool _submitting = false;
  String _status = 'pending';
  List<Map<String, dynamic>> _requests = const [];
  final _pickupCtrl = TextEditingController();
  final _dropCtrl = TextEditingController();
  double? _pickupLat;
  double? _pickupLng;
  double? _dropLat;
  double? _dropLng;
  Map<String, dynamic>? _estimate;
  List<LatLng> _routePoints = const [];
  List<LatLng> _nearbyRiders = const [];
  bool _routeLoading = false;
  String _cityHint = '';

  @override
  void initState() {
    super.initState();
    _load();
    _setPickupFromCurrentLocation();
  }

  @override
  void dispose() {
    _pickupCtrl.dispose();
    _dropCtrl.dispose();
    super.dispose();
  }

  void _snack(String msg) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
  }

  Future<void> _setPickupFromCurrentLocation() async {
    try {
      final permission = await Geolocator.checkPermission();
      if (permission != LocationPermission.whileInUse &&
          permission != LocationPermission.always) {
        return;
      }

      final pos = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.low,
      );
      String label = 'Current location';
      try {
        final marks = await placemarkFromCoordinates(pos.latitude, pos.longitude);
        if (marks.isNotEmpty) {
          final p = marks.first;
          final parts = [
            p.name,
            p.subLocality,
            p.locality,
          ].whereType<String>().where((e) => e.trim().isNotEmpty).toList();
          if (parts.isNotEmpty) label = parts.take(3).join(', ');
          _cityHint = (p.locality ?? p.administrativeArea ?? '').trim();
        }
      } catch (_) {}

      if (!mounted) return;
      setState(() {
        _pickupCtrl.text = label;
        _pickupLat = pos.latitude;
        _pickupLng = pos.longitude;
      });
      _refreshNearbyRiders();
      _refreshRoute();
    } catch (_) {}
  }

  void _refreshNearbyRiders() {
    if (_pickupLat == null || _pickupLng == null) {
      setState(() => _nearbyRiders = const []);
      return;
    }

    final lat = _pickupLat!;
    final lng = _pickupLng!;
    final cosLat = math.cos(lat * math.pi / 180).abs().clamp(0.2, 1.0);
    final riders = <LatLng>[];
    for (int i = 0; i < 6; i++) {
      final angle = (i * 57 + 19) * math.pi / 180;
      final radiusKm = 0.2 + (i % 3) * 0.2;
      final dLat = (radiusKm / 111.0) * math.cos(angle);
      final dLng = (radiusKm / (111.0 * cosLat)) * math.sin(angle);
      riders.add(LatLng(lat + dLat, lng + dLng));
    }
    setState(() => _nearbyRiders = riders);
  }

  Future<void> _refreshRoute() async {
    if (_pickupLat == null ||
        _pickupLng == null ||
        _dropLat == null ||
        _dropLng == null) {
      if (mounted) setState(() => _routePoints = const []);
      return;
    }

    if (mounted) setState(() => _routeLoading = true);
    try {
      final uri = Uri.parse(
        'https://router.project-osrm.org/route/v1/driving/'
        '${_pickupLng!.toStringAsFixed(6)},${_pickupLat!.toStringAsFixed(6)};'
        '${_dropLng!.toStringAsFixed(6)},${_dropLat!.toStringAsFixed(6)}'
        '?overview=full&geometries=geojson',
      );
      final res = await http.get(
        uri,
        headers: const {'User-Agent': 'BlinkieFashApp/1.0'},
      );

      if (!mounted) return;

      final fallback = [LatLng(_pickupLat!, _pickupLng!), LatLng(_dropLat!, _dropLng!)];
      if (res.statusCode != 200) {
        setState(() => _routePoints = fallback);
        return;
      }

      final body = jsonDecode(res.body);
      final routes = body is Map ? (body['routes'] as List? ?? const []) : const [];
      if (routes.isEmpty) {
        setState(() => _routePoints = fallback);
        return;
      }

      final geometry = routes.first['geometry'];
      final coordinates = geometry is Map
          ? (geometry['coordinates'] as List? ?? const [])
          : const [];
      final points = <LatLng>[];
      for (final c in coordinates) {
        if (c is List && c.length >= 2) {
          final lng = (c[0] as num?)?.toDouble();
          final lat = (c[1] as num?)?.toDouble();
          if (lat != null && lng != null) points.add(LatLng(lat, lng));
        }
      }
      setState(() => _routePoints = points.isEmpty ? fallback : points);
    } catch (_) {
      if (!mounted) return;
      setState(() {
        if (_pickupLat != null &&
            _pickupLng != null &&
            _dropLat != null &&
            _dropLng != null) {
          _routePoints = [LatLng(_pickupLat!, _pickupLng!), LatLng(_dropLat!, _dropLng!)];
        }
      });
    } finally {
      if (mounted) setState(() => _routeLoading = false);
    }
  }

  Future<void> _pickLocationFromMap({required bool pickup}) async {
    final picked = await Navigator.of(context).push<PickedAddress>(
      MaterialPageRoute(builder: (_) => const LocationPickerScreen()),
    );
    if (!mounted || picked == null) return;

    final text = picked.addressLine.trim().isNotEmpty
        ? picked.addressLine.trim()
        : [picked.city, picked.pincode].where((e) => e.trim().isNotEmpty).join(', ');

    setState(() {
      _estimate = null;
      if (pickup) {
        _pickupCtrl.text = text;
        _pickupLat = picked.lat;
        _pickupLng = picked.lng;
        _cityHint = picked.city;
      } else {
        _dropCtrl.text = text;
        _dropLat = picked.lat;
        _dropLng = picked.lng;
      }
    });
    if (pickup) _refreshNearbyRiders();
    _refreshRoute();
  }

  Future<void> _estimateSendParcel() async {
    if (_pickupCtrl.text.trim().isEmpty || _dropCtrl.text.trim().isEmpty) {
      _snack('Set both pickup and destination');
      return;
    }

    setState(() {
      _estimating = true;
      _estimate = null;
    });

    try {
      if (_pickupLat == null || _pickupLng == null) {
        final rows = await locationFromAddress(_pickupCtrl.text.trim());
        if (rows.isNotEmpty) {
          _pickupLat = rows.first.latitude;
          _pickupLng = rows.first.longitude;
        }
      }

      if (_dropLat == null || _dropLng == null) {
        final rows = await locationFromAddress(_dropCtrl.text.trim());
        if (rows.isNotEmpty) {
          _dropLat = rows.first.latitude;
          _dropLng = rows.first.longitude;
        }
      }

      if (_pickupLat == null ||
          _pickupLng == null ||
          _dropLat == null ||
          _dropLng == null) {
        _snack('Unable to resolve locations. Use map selection.');
        return;
      }

      _refreshNearbyRiders();
      _refreshRoute();
      final estimate = await _api.estimateDeliverFare(
        pickupLat: _pickupLat!,
        pickupLng: _pickupLng!,
        dropLat: _dropLat!,
        dropLng: _dropLng!,
        city: _cityHint,
      );
      if (!mounted) return;
      if (estimate['success'] == true) {
        setState(() => _estimate = estimate);
      } else {
        _snack((estimate['message'] ?? 'Unable to estimate fare').toString());
      }
    } catch (_) {
      _snack('Unable to estimate parcel fare right now');
    } finally {
      if (mounted) setState(() => _estimating = false);
    }
  }

  Future<void> _sendVendorParcel() async {
    if (_estimate == null ||
        _pickupLat == null ||
        _pickupLng == null ||
        _dropLat == null ||
        _dropLng == null) {
      _snack('Estimate fare before sending parcel request');
      return;
    }

    setState(() => _submitting = true);
    try {
      final res = await _api.createDeliverRequest(
        pickupText: _pickupCtrl.text.trim(),
        dropText: _dropCtrl.text.trim(),
        pickupLat: _pickupLat!,
        pickupLng: _pickupLng!,
        dropLat: _dropLat!,
        dropLng: _dropLng!,
        city: _cityHint,
      );
      if (!mounted) return;
      if (res['success'] == true) {
        _snack('Vendor parcel request created');
        setState(() {
          _dropCtrl.clear();
          _dropLat = null;
          _dropLng = null;
          _estimate = null;
          _routePoints = const [];
        });
        _load();
      } else {
        _snack((res['message'] ?? res['error'] ?? 'Request failed').toString());
      }
    } catch (_) {
      _snack('Could not create parcel request');
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Widget _vendorParcelMap() {
    if (_pickupLat == null || _pickupLng == null) {
      return const SizedBox.shrink();
    }

    final center = LatLng(_pickupLat!, _pickupLng!);
    final markers = <Marker>[
      Marker(
        point: center,
        width: 40,
        height: 40,
        child: const Icon(
          Icons.trip_origin_rounded,
          color: Color(0xFF16A34A),
          size: 26,
        ),
      ),
      for (final rider in _nearbyRiders)
        Marker(
          point: rider,
          width: 28,
          height: 28,
          child: Container(
            decoration: const BoxDecoration(
              color: Color(0xFF0284C7),
              shape: BoxShape.circle,
            ),
            child: const Icon(
              Icons.delivery_dining_rounded,
              size: 15,
              color: Colors.white,
            ),
          ),
        ),
    ];

    if (_dropLat != null && _dropLng != null) {
      markers.add(
        Marker(
          point: LatLng(_dropLat!, _dropLng!),
          width: 40,
          height: 40,
          child: const Icon(
            Icons.place_rounded,
            color: Color(0xFFEF4444),
            size: 30,
          ),
        ),
      );
    }

    return SizedBox(
      height: 210,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(12),
        child: Stack(
          children: [
            FlutterMap(
              options: MapOptions(initialCenter: center, initialZoom: 13),
              children: [
                TileLayer(
                  urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                  userAgentPackageName: 'com.blinkiefash.app',
                ),
                if (_routePoints.length >= 2)
                  PolylineLayer(
                    polylines: [
                      Polyline(
                        points: _routePoints,
                        color: const Color(0xFF2563EB),
                        strokeWidth: 4,
                      ),
                    ],
                  ),
                MarkerLayer(markers: markers),
              ],
            ),
            if (_routeLoading)
              const Positioned(
                top: 8,
                right: 8,
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.all(Radius.circular(18)),
                  ),
                  child: Padding(
                    padding: EdgeInsets.symmetric(horizontal: 8, vertical: 5),
                    child: Text('Route...', style: TextStyle(fontSize: 11)),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _sendParcelCard() {
    final fare = (_estimate?['estimatedFare'] ?? 0).toString();
    final dist = (_estimate?['distanceKm'] ?? 0).toString();
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Send Parcel (Vendor)',
            style: TextStyle(fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 8),
          TextField(
            controller: _pickupCtrl,
            decoration: const InputDecoration(
              labelText: 'Starting location',
              border: OutlineInputBorder(),
              prefixIcon: Icon(Icons.trip_origin_rounded),
            ),
          ),
          Align(
            alignment: Alignment.centerLeft,
            child: TextButton.icon(
              onPressed: () => _pickLocationFromMap(pickup: true),
              icon: const Icon(Icons.map_outlined),
              label: const Text('Set Starting on map'),
            ),
          ),
          TextField(
            controller: _dropCtrl,
            decoration: const InputDecoration(
              labelText: 'Destination location',
              border: OutlineInputBorder(),
              prefixIcon: Icon(Icons.place_outlined),
            ),
          ),
          Align(
            alignment: Alignment.centerLeft,
            child: TextButton.icon(
              onPressed: () => _pickLocationFromMap(pickup: false),
              icon: const Icon(Icons.map_outlined),
              label: const Text('Set Destination on map'),
            ),
          ),
          _vendorParcelMap(),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: _estimating ? null : _estimateSendParcel,
                  icon: _estimating
                      ? const SizedBox(
                          width: 14,
                          height: 14,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.calculate_outlined),
                  label: Text(_estimating ? 'Estimating...' : 'Estimate Fare'),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: FilledButton.icon(
                  onPressed: _submitting ? null : _sendVendorParcel,
                  icon: _submitting
                      ? const SizedBox(
                          width: 14,
                          height: 14,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.local_shipping_rounded),
                  label: Text(_submitting ? 'Sending...' : 'Send Parcel'),
                ),
              ),
            ],
          ),
          if (_estimate != null) ...[
            const SizedBox(height: 8),
            Text(
              'Distance: $dist km • Estimated Fare: ₹$fare',
              style: const TextStyle(
                fontWeight: FontWeight.w700,
                color: Color(0xFF166534),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final rows = await _api.fetchVendorDeliverRequests(
        vendorId: widget.vendorId,
        status: _status,
      );
      if (!mounted) return;
      setState(() {
        _requests = rows
            .whereType<Map>()
            .map((e) => Map<String, dynamic>.from(e))
            .toList();
      });
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _updateStatus(String requestId, String newStatus) async {
    setState(() => _updating = true);
    try {
      final res = await _api.updateVendorDeliverRequestStatus(
        vendorId: widget.vendorId,
        requestId: requestId,
        status: newStatus,
      );
      if (!mounted) return;
      if (res['success'] == true) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Parcel request marked $newStatus')),
        );
        await _load();
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              (res['message'] ?? res['error'] ?? 'Update failed').toString(),
            ),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _updating = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const Text(
            'Parcel Service',
            style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 6),
          const Text(
            'Send your own parcel or accept local pickup/drop requests in your city.',
            style: TextStyle(color: Color(0xFF64748B)),
          ),
          const SizedBox(height: 12),
          _sendParcelCard(),
          Wrap(
            spacing: 8,
            children: [
              for (final s in const [
                'pending',
                'accepted',
                'completed',
                'cancelled',
              ])
                ChoiceChip(
                  label: Text(s.toUpperCase()),
                  selected: _status == s,
                  onSelected: (_) {
                    setState(() => _status = s);
                    _load();
                  },
                ),
            ],
          ),
          const SizedBox(height: 12),
          if (_loading)
            const Center(child: CircularProgressIndicator())
          else if (_requests.isEmpty)
            const Padding(
              padding: EdgeInsets.only(top: 30),
              child: Center(child: Text('No parcel requests found.')),
            )
          else
            ..._requests.map((r) {
              final id = (r['id'] ?? '').toString();
              final fare = (r['estimated_fare'] ?? 0).toString();
              final dist = (r['distance_km'] ?? 0).toString();
              final pickup = (r['pickup_text'] ?? '').toString();
              final drop = (r['drop_text'] ?? '').toString();
              final status = (r['status'] ?? '').toString().toLowerCase();

              return Container(
                margin: const EdgeInsets.only(bottom: 10),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            'Req #${id.length > 8 ? id.substring(0, 8) : id}',
                            style: const TextStyle(fontWeight: FontWeight.w700),
                          ),
                        ),
                        Text(
                          status.toUpperCase(),
                          style: const TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                            color: Color(0xFF334155),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text(
                      'Pickup: $pickup',
                      style: const TextStyle(fontSize: 12),
                    ),
                    Text('Drop: $drop', style: const TextStyle(fontSize: 12)),
                    const SizedBox(height: 6),
                    Text(
                      'Distance: $dist km • Fare: ₹$fare',
                      style: const TextStyle(
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF166534),
                      ),
                    ),
                    if (status == 'pending') ...[
                      const SizedBox(height: 8),
                      Row(
                        children: [
                          Expanded(
                            child: FilledButton(
                              onPressed: _updating || id.isEmpty
                                  ? null
                                  : () => _updateStatus(id, 'accepted'),
                              child: const Text('Accept'),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: OutlinedButton(
                              onPressed: _updating || id.isEmpty
                                  ? null
                                  : () => _updateStatus(id, 'cancelled'),
                              child: const Text('Decline'),
                            ),
                          ),
                        ],
                      ),
                    ] else if (status == 'accepted') ...[
                      const SizedBox(height: 8),
                      FilledButton(
                        onPressed: _updating || id.isEmpty
                            ? null
                            : () => _updateStatus(id, 'completed'),
                        child: const Text('Mark Completed'),
                      ),
                    ],
                  ],
                ),
              );
            }),
        ],
      ),
    );
  }
}

class _VendorAddProductTab extends StatefulWidget {
  const _VendorAddProductTab({
    required this.vendorId,
    required this.fallbackStoreLabel,
  });

  final String vendorId;
  final String fallbackStoreLabel;

  @override
  State<_VendorAddProductTab> createState() => _VendorAddProductTabState();
}

class _VendorAddProductTabState extends State<_VendorAddProductTab> {
  final ApiClient _api = ApiClient();
  final ImagePicker _picker = ImagePicker();
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _shortDescController = TextEditingController();
  final _fullDescController = TextEditingController();
  final _brandController = TextEditingController();

  List<Map<String, dynamic>> _brands = const [];
  final Map<String, String> _categoryNameById = {};
  final Map<String, List<Map<String, dynamic>>> _childrenByParent = {};
  List<Map<String, dynamic>> _parentCategories = const [];
  List<Map<String, dynamic>> _childCategories = const [];
  List<Map<String, dynamic>> _subChildCategories = const [];
  String? _selectedParentCategoryId;
  String? _selectedChildCategoryId;
  String? _selectedCategoryId;
  String? _selectedStoreId;
  String? _selectedStoreLabel;
  bool _loadingCategories = true;
  bool _loadingStores = true;
  bool _submitting = false;
  bool _loadingRecent = true;
  List<Map<String, dynamic>> _recentProducts = const [];
  String? _categoriesError;
  bool _isTryEnabled = true;
  bool _buy2At999 = false;
  bool _buy3At999 = false;
  bool _buy4At999 = false;
  List<_VariantDraft> _variants = [_VariantDraft()];

  @override
  void initState() {
    super.initState();
    _loadBrandsAndCategories();
    _loadLinkedStore();
    _loadRecentProducts();
  }

  @override
  void dispose() {
    _nameController.dispose();
    _shortDescController.dispose();
    _fullDescController.dispose();
    _brandController.dispose();
    for (final v in _variants) {
      v.dispose();
    }
    super.dispose();
  }

  Map<String, List<Map<String, dynamic>>> _buildChildrenMap(
    List<Map<String, dynamic>> rows,
  ) {
    final map = <String, List<Map<String, dynamic>>>{};
    for (final row in rows) {
      final parentKey = (row['parent_id']?.toString().isNotEmpty ?? false)
          ? row['parent_id'].toString()
          : 'ROOT';
      map.putIfAbsent(parentKey, () => []);
      map[parentKey]!.add(row);
    }
    for (final key in map.keys) {
      map[key]!.sort(
        (a, b) => (a['name'] ?? '').toString().compareTo(
          (b['name'] ?? '').toString(),
        ),
      );
    }
    return map;
  }

  Future<void> _loadBrandsAndCategories() async {
    setState(() => _loadingCategories = true);
    try {
      final values = await Future.wait([
        _api.fetchBrands(),
        _api.fetchCategories(),
      ]);

      final brands = values[0]
          .whereType<Map>()
          .map((e) => Map<String, dynamic>.from(e))
          .where((e) => (e['name'] ?? '').toString().trim().isNotEmpty)
          .toList();

      final categories = values[1]
          .whereType<Map>()
          .map((e) => Map<String, dynamic>.from(e))
          .where((e) => e['id'] != null)
          .toList();

      final childrenMap = _buildChildrenMap(categories);
      final parents = childrenMap['ROOT'] ?? const <Map<String, dynamic>>[];

      if (!mounted) return;
      setState(() {
        _categoriesError = null;
        _brands = brands;
        _childrenByParent
          ..clear()
          ..addAll(childrenMap);
        _categoryNameById
          ..clear()
          ..addEntries(
            categories.map(
              (c) => MapEntry(c['id'].toString(), (c['name'] ?? '').toString()),
            ),
          );
        _parentCategories = parents;
        _childCategories = const [];
        _subChildCategories = const [];
        _selectedParentCategoryId = null;
        _selectedChildCategoryId = null;
        _selectedCategoryId = null;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _brands = const [];
        _childrenByParent.clear();
        _categoryNameById.clear();
        _parentCategories = const [];
        _childCategories = const [];
        _subChildCategories = const [];
        _selectedParentCategoryId = null;
        _selectedChildCategoryId = null;
        _selectedCategoryId = null;
        _categoriesError = 'Could not load brands/categories from database';
      });
    } finally {
      if (mounted) setState(() => _loadingCategories = false);
    }
  }

  void _onParentCategoryChanged(String? parentId) {
    final children = parentId == null
        ? const <Map<String, dynamic>>[]
        : (_childrenByParent[parentId] ?? const <Map<String, dynamic>>[]);

    setState(() {
      _selectedParentCategoryId = parentId;
      _selectedChildCategoryId = null;
      _childCategories = children;
      _subChildCategories = const [];
      _selectedCategoryId = children.isEmpty ? parentId : null;
    });
  }

  void _onChildCategoryChanged(String? childId) {
    final subChildren = childId == null
        ? const <Map<String, dynamic>>[]
        : (_childrenByParent[childId] ?? const <Map<String, dynamic>>[]);

    setState(() {
      _selectedChildCategoryId = childId;
      _subChildCategories = subChildren;
      _selectedCategoryId = subChildren.isEmpty ? childId : null;
    });
  }

  Future<void> _loadRecentProducts() async {
    setState(() => _loadingRecent = true);
    try {
      final data = await _api.fetchVendorProducts(widget.vendorId);
      final rows = data
          .whereType<Map>()
          .map((e) => Map<String, dynamic>.from(e))
          .take(6)
          .toList();
      if (!mounted) return;
      setState(() => _recentProducts = rows);
    } finally {
      if (mounted) setState(() => _loadingRecent = false);
    }
  }

  Future<void> _loadLinkedStore() async {
    setState(() => _loadingStores = true);
    try {
      final linkedRes = await _api.fetchVendorLinkedStore(widget.vendorId);
      final store = linkedRes['store'];
      final linked = store is Map ? Map<String, dynamic>.from(store) : null;

      final profile = await _api.fetchVendorProfile(widget.vendorId);
      final vendorStoreName = (profile['store_name'] ?? '').toString().trim();
      final vendorCity = (profile['city'] ?? '').toString().trim();

      if (!mounted) return;
      setState(() {
        _selectedStoreId = linked?['id']?.toString();
        if (linked != null) {
          _selectedStoreLabel =
              '${linked['name'] ?? ''} - ${linked['city'] ?? ''}'.trim();
        } else if (vendorStoreName.isNotEmpty || vendorCity.isNotEmpty) {
          _selectedStoreLabel = [
            vendorStoreName,
            vendorCity,
          ].where((e) => e.isNotEmpty).join(' - ');
        } else {
          _selectedStoreLabel = widget.fallbackStoreLabel.trim().isEmpty
              ? null
              : widget.fallbackStoreLabel.trim();
        }
      });
    } finally {
      if (mounted) setState(() => _loadingStores = false);
    }
  }

  void _addVariant() {
    setState(() => _variants.add(_VariantDraft()));
  }

  void _removeVariant(int index) {
    if (_variants.length <= 1) return;
    setState(() {
      _variants[index].dispose();
      _variants.removeAt(index);
    });
  }

  Future<void> _pickVariantImages(int index) async {
    final images = await _picker.pickMultiImage(
      imageQuality: 85,
      maxWidth: 1800,
    );
    if (images.isEmpty || !mounted) return;
    setState(() {
      _variants[index].imagePaths.addAll(images.map((e) => e.path));
    });
  }

  void _removeVariantImage(int variantIndex, int imageIndex) {
    setState(() {
      _variants[variantIndex].imagePaths.removeAt(imageIndex);
    });
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    final messenger = ScaffoldMessenger.of(context);
    if (_selectedCategoryId == null || _selectedCategoryId!.isEmpty) {
      messenger.showSnackBar(
        const SnackBar(content: Text('Please select a category')),
      );
      return;
    }

    setState(() => _submitting = true);
    try {
      final variantPayload = <Map<String, dynamic>>[];
      for (final v in _variants) {
        final price = double.tryParse(v.priceCtrl.text.trim());
        final mrp = double.tryParse(v.mrpCtrl.text.trim());
        final qty = int.tryParse(v.stockCtrl.text.trim());
        if (price == null ||
            price <= 0 ||
            mrp == null ||
            mrp <= 0 ||
            qty == null ||
            qty < 0) {
          messenger.showSnackBar(
            const SnackBar(
              content: Text(
                'Please enter valid variant price/MRP/stock values',
              ),
            ),
          );
          setState(() => _submitting = false);
          return;
        }
        final uploaded = await _api.uploadImages(v.imagePaths);
        variantPayload.add({
          'size': v.sizeCtrl.text.trim().isEmpty ? 'M' : v.sizeCtrl.text.trim(),
          'color': v.colorCtrl.text.trim().isEmpty
              ? 'Black'
              : v.colorCtrl.text.trim(),
          'barcode': v.barcodeCtrl.text.trim().isEmpty
              ? null
              : v.barcodeCtrl.text.trim(),
          'mrp': mrp,
          'price': price,
          'quantity': qty,
          'images': uploaded,
        });
      }

      final res = await _api.createVendorProduct(
        vendorId: widget.vendorId,
        categoryId: _selectedCategoryId!,
        name: _nameController.text.trim(),
        shortDescription: _shortDescController.text.trim(),
        fullDescription: _fullDescController.text.trim(),
        brand: _brandController.text.trim(),
        storeId: _selectedStoreId,
        variants: variantPayload,
        isTryEnabled: _isTryEnabled,
        bundleOffers: [
          if (_buy2At999)
            {'quantity_min': 2, 'quantity_max': 2, 'discount_value': 999},
          if (_buy3At999)
            {'quantity_min': 3, 'quantity_max': 3, 'discount_value': 999},
          if (_buy4At999)
            {'quantity_min': 4, 'quantity_max': null, 'discount_value': 999},
        ],
      );

      if (!mounted) return;

      if (res['success'] == true) {
        _nameController.clear();
        _shortDescController.clear();
        _fullDescController.clear();
        _brandController.clear();
        for (final v in _variants) {
          v.dispose();
        }
        _variants = [_VariantDraft()];
        setState(() {
          _isTryEnabled = true;
          _buy2At999 = false;
          _buy3At999 = false;
          _buy4At999 = false;
        });
        _loadRecentProducts();
        messenger.showSnackBar(
          const SnackBar(content: Text('Product created successfully')),
        );
      } else {
        messenger.showSnackBar(
          SnackBar(
            content: Text(
              (res['message'] ?? res['error'] ?? 'Unable to create product')
                  .toString(),
            ),
          ),
        );
      }
    } catch (_) {
      if (!mounted) return;
      messenger.showSnackBar(
        const SnackBar(content: Text('Please review details and try again.')),
      );
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(16),
              gradient: const LinearGradient(
                colors: [Color(0xFF0F172A), Color(0xFF16A34A)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
            ),
            child: const Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Create Product Listing',
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w800,
                    color: Colors.white,
                  ),
                ),
                SizedBox(height: 6),
                Text(
                  'Publish to your catalog instantly with synced stock and pricing.',
                  style: TextStyle(color: Color(0xFFDCFCE7)),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: Form(
              key: _formKey,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  TextFormField(
                    controller: _nameController,
                    decoration: const InputDecoration(
                      labelText: 'Product Name',
                      border: OutlineInputBorder(),
                    ),
                    validator: (v) => (v == null || v.trim().isEmpty)
                        ? 'Product name is required'
                        : null,
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _shortDescController,
                    maxLines: 2,
                    decoration: const InputDecoration(
                      labelText: 'Short Description (Web field)',
                      border: OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _fullDescController,
                    maxLines: 4,
                    decoration: const InputDecoration(
                      labelText: 'Full Description (Web field)',
                      border: OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _brandController,
                    decoration: const InputDecoration(
                      labelText: 'Brand (optional)',
                      border: OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 12),
                  _loadingStores
                      ? const LinearProgressIndicator(minHeight: 2)
                      : TextFormField(
                          initialValue: _selectedStoreLabel ?? 'Not linked',
                          readOnly: true,
                          decoration: const InputDecoration(
                            labelText: 'Store',
                            border: OutlineInputBorder(),
                          ),
                        ),
                  if (_brands.isNotEmpty) ...[
                    const SizedBox(height: 10),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: _brands.take(12).map((b) {
                        final name = (b['name'] ?? '').toString();
                        final selected =
                            _brandController.text.trim().toLowerCase() ==
                            name.toLowerCase();
                        return ChoiceChip(
                          label: Text(name),
                          selected: selected,
                          onSelected: (_) => setState(() {
                            _brandController.text = name;
                          }),
                        );
                      }).toList(),
                    ),
                  ],
                  const SizedBox(height: 12),
                  if (_categoriesError != null)
                    Container(
                      margin: const EdgeInsets.only(bottom: 10),
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFEF2F2),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: const Color(0xFFFECACA)),
                      ),
                      child: Row(
                        children: [
                          const Icon(
                            Icons.error_outline_rounded,
                            size: 16,
                            color: Color(0xFFB91C1C),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              _categoriesError!,
                              style: const TextStyle(
                                color: Color(0xFFB91C1C),
                                fontSize: 12,
                              ),
                            ),
                          ),
                          TextButton(
                            onPressed: _loadingCategories
                                ? null
                                : _loadBrandsAndCategories,
                            child: const Text('Retry'),
                          ),
                        ],
                      ),
                    ),
                  _loadingCategories
                      ? const LinearProgressIndicator(minHeight: 2)
                      : Column(
                          children: [
                            DropdownButtonFormField<String>(
                              initialValue: _selectedParentCategoryId,
                              decoration: const InputDecoration(
                                labelText: 'Main Category',
                                border: OutlineInputBorder(),
                              ),
                              items: _parentCategories
                                  .map(
                                    (c) => DropdownMenuItem<String>(
                                      value: c['id']?.toString() ?? '',
                                      child: Text(c['name']?.toString() ?? ''),
                                    ),
                                  )
                                  .toList(),
                              onChanged: _onParentCategoryChanged,
                            ),
                            const SizedBox(height: 10),
                            DropdownButtonFormField<String>(
                              initialValue: _selectedChildCategoryId,
                              decoration: const InputDecoration(
                                labelText: 'Sub Category',
                                border: OutlineInputBorder(),
                              ),
                              items: _childCategories
                                  .map(
                                    (c) => DropdownMenuItem<String>(
                                      value: c['id']?.toString() ?? '',
                                      child: Text(c['name']?.toString() ?? ''),
                                    ),
                                  )
                                  .toList(),
                              onChanged: _onChildCategoryChanged,
                            ),
                            if (_subChildCategories.isNotEmpty) ...[
                              const SizedBox(height: 10),
                              DropdownButtonFormField<String>(
                                initialValue: _selectedCategoryId,
                                decoration: const InputDecoration(
                                  labelText: 'Final Category',
                                  border: OutlineInputBorder(),
                                ),
                                items: _subChildCategories
                                    .map(
                                      (c) => DropdownMenuItem<String>(
                                        value: c['id']?.toString() ?? '',
                                        child: Text(
                                          c['name']?.toString() ?? '',
                                        ),
                                      ),
                                    )
                                    .toList(),
                                onChanged: (v) =>
                                    setState(() => _selectedCategoryId = v),
                              ),
                            ],
                          ],
                        ),
                  if (_selectedCategoryId != null &&
                      (_categoryNameById[_selectedCategoryId!] ?? '')
                          .isNotEmpty) ...[
                    const SizedBox(height: 8),
                    Text(
                      'Final selected category: ${_categoryNameById[_selectedCategoryId!] ?? ''}',
                      style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: Color(0xFF475569),
                      ),
                    ),
                  ],
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      const Icon(
                        Icons.qr_code_scanner_rounded,
                        size: 18,
                        color: Color(0xFF0F172A),
                      ),
                      const SizedBox(width: 6),
                      const Text(
                        'Variants, Pricing & Inventory',
                        style: TextStyle(fontWeight: FontWeight.w700),
                      ),
                      const Spacer(),
                      Text(
                        '${_variants.length} variant(s)',
                        style: const TextStyle(
                          fontSize: 12,
                          color: Color(0xFF64748B),
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  ..._variants.asMap().entries.map((entry) {
                    final i = entry.key;
                    final v = entry.value;
                    return Container(
                      margin: const EdgeInsets.only(bottom: 10),
                      padding: const EdgeInsets.fromLTRB(12, 10, 12, 12),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: const Color(0xFFDCFCE7)),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Row(
                            children: [
                              Text(
                                'Variant ${i + 1}',
                                style: const TextStyle(
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                              const SizedBox(width: 8),
                              Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 8,
                                  vertical: 3,
                                ),
                                decoration: BoxDecoration(
                                  color: const Color(0xFFF1F5F9),
                                  borderRadius: BorderRadius.circular(999),
                                ),
                                child: Text(
                                  v.imagePaths.isEmpty
                                      ? 'No image'
                                      : '${v.imagePaths.length} image(s)',
                                  style: const TextStyle(
                                    fontSize: 11,
                                    color: Color(0xFF475569),
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ),
                              const Spacer(),
                              if (_variants.length > 1)
                                IconButton(
                                  onPressed: () => _removeVariant(i),
                                  icon: const Icon(
                                    Icons.delete_outline_rounded,
                                    color: Color(0xFFDC2626),
                                  ),
                                ),
                            ],
                          ),
                          const SizedBox(height: 4),
                          Row(
                            children: [
                              Expanded(
                                child: TextField(
                                  controller: v.sizeCtrl,
                                  decoration: const InputDecoration(
                                    labelText: 'Size',
                                    border: OutlineInputBorder(),
                                  ),
                                ),
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: TextField(
                                  controller: v.colorCtrl,
                                  decoration: const InputDecoration(
                                    labelText: 'Color',
                                    border: OutlineInputBorder(),
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 10),
                          TextField(
                            controller: v.barcodeCtrl,
                            decoration: const InputDecoration(
                              labelText: 'Barcode (optional)',
                              border: OutlineInputBorder(),
                              prefixIcon: Icon(Icons.qr_code_2_rounded),
                            ),
                          ),
                          const SizedBox(height: 10),
                          Row(
                            children: [
                              Expanded(
                                child: TextField(
                                  controller: v.mrpCtrl,
                                  keyboardType:
                                      const TextInputType.numberWithOptions(
                                        decimal: true,
                                      ),
                                  decoration: const InputDecoration(
                                    labelText: 'MRP',
                                    border: OutlineInputBorder(),
                                  ),
                                ),
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: TextField(
                                  controller: v.priceCtrl,
                                  keyboardType:
                                      const TextInputType.numberWithOptions(
                                        decimal: true,
                                      ),
                                  decoration: const InputDecoration(
                                    labelText: 'Selling Price',
                                    border: OutlineInputBorder(),
                                  ),
                                ),
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: TextField(
                                  controller: v.stockCtrl,
                                  keyboardType: TextInputType.number,
                                  decoration: const InputDecoration(
                                    labelText: 'Stock Qty',
                                    border: OutlineInputBorder(),
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 10),
                          OutlinedButton.icon(
                            onPressed: () => _pickVariantImages(i),
                            icon: const Icon(Icons.image_outlined),
                            label: Text(
                              v.imagePaths.isEmpty
                                  ? 'Upload Images'
                                  : 'Add More Images (${v.imagePaths.length})',
                            ),
                          ),
                          if (v.imagePaths.isNotEmpty)
                            Wrap(
                              spacing: 6,
                              runSpacing: 6,
                              children: v.imagePaths.asMap().entries.map((img) {
                                final idx = img.key;
                                final fileName = img.value.split('/').last;
                                return InputChip(
                                  label: Text(
                                    fileName,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                  onDeleted: () => _removeVariantImage(i, idx),
                                );
                              }).toList(),
                            ),
                        ],
                      ),
                    );
                  }),
                  Align(
                    alignment: Alignment.centerLeft,
                    child: TextButton.icon(
                      onPressed: _addVariant,
                      icon: const Icon(Icons.add_circle_outline_rounded),
                      label: const Text('Add Another Variant'),
                    ),
                  ),
                  const SizedBox(height: 12),
                  SwitchListTile.adaptive(
                    value: _isTryEnabled,
                    onChanged: (v) => setState(() => _isTryEnabled = v),
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Enable Try & Buy'),
                    subtitle: const Text(
                      'Maps to is_try_enabled as in web flow',
                    ),
                  ),
                  const SizedBox(height: 6),
                  const Text(
                    'Bundle Pricing Offers',
                    style: TextStyle(fontWeight: FontWeight.w700),
                  ),
                  CheckboxListTile(
                    value: _buy2At999,
                    onChanged: (v) => setState(() => _buy2At999 = v ?? false),
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Buy 2 at 999'),
                    controlAffinity: ListTileControlAffinity.leading,
                  ),
                  CheckboxListTile(
                    value: _buy3At999,
                    onChanged: (v) => setState(() => _buy3At999 = v ?? false),
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Buy 3 at 999'),
                    controlAffinity: ListTileControlAffinity.leading,
                  ),
                  CheckboxListTile(
                    value: _buy4At999,
                    onChanged: (v) => setState(() => _buy4At999 = v ?? false),
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Buy 4+ at 999'),
                    controlAffinity: ListTileControlAffinity.leading,
                  ),
                  const SizedBox(height: 16),
                  SizedBox(
                    height: 48,
                    child: FilledButton.icon(
                      onPressed: _submitting ? null : _submit,
                      icon: _submitting
                          ? const SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Icon(Icons.save_rounded),
                      label: Text(
                        _submitting ? 'Creating...' : 'Create Product',
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 14),
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Text(
                      'Recently Added (DB)',
                      style: TextStyle(fontWeight: FontWeight.w700),
                    ),
                    const Spacer(),
                    IconButton(
                      onPressed: _loadingRecent ? null : _loadRecentProducts,
                      icon: const Icon(Icons.refresh_rounded),
                    ),
                  ],
                ),
                if (_loadingRecent)
                  const Padding(
                    padding: EdgeInsets.all(12),
                    child: LinearProgressIndicator(minHeight: 2),
                  )
                else if (_recentProducts.isEmpty)
                  const Padding(
                    padding: EdgeInsets.only(top: 6),
                    child: Text(
                      'No products added yet. Your latest listings will appear here.',
                      style: TextStyle(color: Color(0xFF64748B)),
                    ),
                  )
                else
                  ..._recentProducts.map((p) {
                    return Padding(
                      padding: const EdgeInsets.only(top: 8),
                      child: Row(
                        children: [
                          const Icon(
                            Icons.inventory_2_outlined,
                            size: 16,
                            color: Color(0xFF475569),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              (p['name'] ?? 'Unnamed').toString(),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          Text(
                            '₹${p['price'] ?? '-'}',
                            style: const TextStyle(
                              fontWeight: FontWeight.w600,
                              color: Color(0xFF0F172A),
                            ),
                          ),
                        ],
                      ),
                    );
                  }),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _VendorStockMonitoringTab extends StatefulWidget {
  const _VendorStockMonitoringTab({required this.vendorId});

  final String vendorId;

  @override
  State<_VendorStockMonitoringTab> createState() =>
      _VendorStockMonitoringTabState();
}

class _VendorStockMonitoringTabState extends State<_VendorStockMonitoringTab> {
  final ApiClient _api = ApiClient();
  final TextEditingController _searchController = TextEditingController();
  bool _loading = true;
  bool _showLowStockOnly = false;
  String _search = '';
  String? _storeLabel;
  List<Map<String, dynamic>> _products = const [];

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final linkedStoreRes = await _api.fetchVendorLinkedStore(widget.vendorId);
      final store = linkedStoreRes['store'];
      final storeMap = store is Map ? Map<String, dynamic>.from(store) : null;

      final data = await _api.fetchVendorProducts(widget.vendorId);
      final products = data
          .whereType<Map>()
          .map((e) => Map<String, dynamic>.from(e))
          .toList();
      if (!mounted) return;
      setState(() {
        _storeLabel = storeMap == null
            ? 'Not linked'
            : '${storeMap['name'] ?? ''} - ${storeMap['city'] ?? ''}'.trim();
        _products = products;
      });
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  int _sumVariantStock(List<dynamic> variants) {
    var total = 0;
    for (final raw in variants) {
      if (raw is! Map) continue;
      final rawQuantity = raw['quantity'] ?? raw['stock'] ?? 0;
      final quantity = rawQuantity is num
          ? rawQuantity.toDouble()
          : (double.tryParse(rawQuantity.toString()) ?? 0);
      total += quantity.round();
    }
    return total;
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _products
        .where((p) {
          if (!_showLowStockOnly) return true;
          final variants = (p['variants'] as List?) ?? const [];
          return _sumVariantStock(variants) <= 10;
        })
        .where((p) {
          if (_search.trim().isEmpty) return true;
          final q = _search.toLowerCase().trim();
          final name = (p['name'] ?? '').toString().toLowerCase();
          final brand = (p['brand_name'] ?? '').toString().toLowerCase();
          final category = (p['category_name'] ?? '').toString().toLowerCase();
          return name.contains(q) || brand.contains(q) || category.contains(q);
        })
        .toList();

    final totalStock = _products.fold<int>(0, (sum, p) {
      final variants = (p['variants'] as List?) ?? const [];
      return sum + _sumVariantStock(variants);
    });
    final lowStockCount = _products.where((p) {
      final variants = (p['variants'] as List?) ?? const [];
      return _sumVariantStock(variants) <= 10;
    }).length;

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const Text(
            'Inventory Overview',
            style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 6),
          Text(
            'Store: ${_storeLabel ?? 'Loading...'}',
            style: const TextStyle(color: Color(0xFF64748B)),
          ),
          const SizedBox(height: 10),
          if (_loading) const LinearProgressIndicator(minHeight: 2),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: _MetricCard(
                  title: 'Products',
                  value: '${_products.length}',
                  color: const Color(0xFF16A34A),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _MetricCard(
                  title: 'Total Stock',
                  value: '$totalStock',
                  color: const Color(0xFF0EA5E9),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _MetricCard(
                  title: 'Low Stock',
                  value: '$lowStockCount',
                  color: const Color(0xFFDC2626),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _searchController,
            onChanged: (v) => setState(() => _search = v),
            decoration: InputDecoration(
              hintText: 'Search by product, brand or category',
              prefixIcon: const Icon(Icons.search_rounded),
              suffixIcon: _searchController.text.isEmpty
                  ? null
                  : IconButton(
                      onPressed: () {
                        _searchController.clear();
                        setState(() => _search = '');
                      },
                      icon: const Icon(Icons.close_rounded),
                    ),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
              ),
              filled: true,
              fillColor: Colors.white,
            ),
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              FilterChip(
                selected: _showLowStockOnly,
                label: const Text('Show low stock only'),
                onSelected: (v) => setState(() => _showLowStockOnly = v),
              ),
              const Spacer(),
              IconButton(
                tooltip: 'Refresh',
                onPressed: _loading ? null : _load,
                icon: const Icon(Icons.refresh_rounded),
              ),
            ],
          ),
          const SizedBox(height: 8),
          if (_loading)
            const Padding(
              padding: EdgeInsets.only(top: 20),
              child: Center(child: CircularProgressIndicator()),
            )
          else if (filtered.isEmpty)
            Padding(
              padding: EdgeInsets.only(top: 24),
              child: Center(
                child: Text(
                  'No matching items in your linked store right now.',
                ),
              ),
            )
          else
            ...filtered.map((p) {
              final variants = (p['variants'] as List?) ?? const [];
              final total = _sumVariantStock(variants);
              final low = total <= 10;
              return Container(
                margin: const EdgeInsets.only(bottom: 10),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: low
                        ? const Color(0xFFFCA5A5)
                        : const Color(0xFFE2E8F0),
                  ),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            (p['name'] ?? 'Unnamed Product').toString(),
                            style: const TextStyle(
                              fontWeight: FontWeight.w700,
                              fontSize: 14,
                            ),
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 4,
                          ),
                          decoration: BoxDecoration(
                            color: low
                                ? const Color(0xFFFEE2E2)
                                : const Color(0xFFDCFCE7),
                            borderRadius: BorderRadius.circular(999),
                          ),
                          child: Text(
                            'Stock: $total',
                            style: TextStyle(
                              color: low
                                  ? const Color(0xFFB91C1C)
                                  : const Color(0xFF166534),
                              fontWeight: FontWeight.w700,
                              fontSize: 12,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text(
                      '${p['category_name'] ?? ''} • ${p['brand_name'] ?? ''}',
                      style: const TextStyle(
                        fontSize: 12,
                        color: Color(0xFF64748B),
                      ),
                    ),
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: variants.whereType<Map>().map((v) {
                        final qty = int.tryParse('${v['quantity'] ?? 0}') ?? 0;
                        final size = (v['size'] ?? '-').toString();
                        final color = (v['color'] ?? '-').toString();
                        final barcode = (v['barcode'] ?? '').toString().trim();
                        final barcodeLabel = barcode.isEmpty
                            ? 'No barcode'
                            : 'Barcode: $barcode';
                        return Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 6,
                          ),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF8FAFC),
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(color: const Color(0xFFE2E8F0)),
                          ),
                          child: Text(
                            '$size • $color • Qty: $qty • $barcodeLabel',
                            style: const TextStyle(fontSize: 12),
                          ),
                        );
                      }).toList(),
                    ),
                  ],
                ),
              );
            }),
        ],
      ),
    );
  }
}

class _VendorStockUpdateTab extends StatefulWidget {
  const _VendorStockUpdateTab({required this.vendorId});

  final String vendorId;

  @override
  State<_VendorStockUpdateTab> createState() => _VendorStockUpdateTabState();
}

class _VendorStockUpdateTabState extends State<_VendorStockUpdateTab> {
  final ApiClient _api = ApiClient();
  final TextEditingController _searchController = TextEditingController();
  Timer? _refreshTimer;

  bool _loadingProducts = true;
  bool _updating = false;
  String _search = '';
  String? _storeLabel;
  String? _selectedProductId;
  List<Map<String, dynamic>> _products = const [];

  @override
  void initState() {
    super.initState();
    _load();
    // Poll every 8 seconds so vendors can see quickly changing inventory.
    _refreshTimer = Timer.periodic(const Duration(seconds: 8), (_) {
      if (mounted && !_updating) {
        _load(silent: true);
      }
    });
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _load({bool silent = false}) async {
    if (!silent) setState(() => _loadingProducts = true);
    try {
      final linkedStoreRes = await _api.fetchVendorLinkedStore(widget.vendorId);
      final store = linkedStoreRes['store'];
      final storeMap = store is Map ? Map<String, dynamic>.from(store) : null;

      final data = await _api.fetchVendorProducts(widget.vendorId);
      final products = data
          .whereType<Map>()
          .map((e) => Map<String, dynamic>.from(e))
          .toList();

      if (!mounted) return;
      setState(() {
        _storeLabel = storeMap == null
            ? 'Not linked'
            : '${storeMap['name'] ?? ''} - ${storeMap['city'] ?? ''}'.trim();
        _products = products;
        if (_selectedProductId != null &&
            !_products.any((p) => p['id']?.toString() == _selectedProductId)) {
          _selectedProductId = null;
        }
      });
    } finally {
      if (!silent && mounted) setState(() => _loadingProducts = false);
    }
  }

  Future<void> _setVariantQty({
    required String variantId,
    required int qty,
  }) async {
    if (qty < 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Quantity cannot be negative')),
      );
      return;
    }

    setState(() => _updating = true);
    try {
      final res = await _api.updateVendorVariantStock(
        vendorId: widget.vendorId,
        variantId: variantId,
        quantity: qty,
      );
      if (!mounted) return;

      if (res['success'] == true) {
        setState(() {
          for (final p in _products) {
            final variants = (p['variants'] as List?) ?? const [];
            for (final v in variants.whereType<Map>()) {
              if (v['id']?.toString() == variantId) {
                v['quantity'] = qty;
              }
            }
          }
        });
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Stock updated and synced to store inventory'),
          ),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              (res['error'] ?? res['message'] ?? 'Stock update failed')
                  .toString(),
            ),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _updating = false);
    }
  }

  Future<void> _openSetQtyDialog({
    required String variantId,
    required int currentQty,
  }) async {
    final ctrl = TextEditingController(text: '$currentQty');
    final result = await showDialog<int>(
      context: context,
      builder: (ctx) {
        return AlertDialog(
          title: const Text('Set Stock Quantity'),
          content: TextField(
            controller: ctrl,
            keyboardType: TextInputType.number,
            decoration: const InputDecoration(
              labelText: 'Quantity',
              border: OutlineInputBorder(),
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(ctx).pop(),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: () {
                final q = int.tryParse(ctrl.text.trim());
                if (q == null) return;
                Navigator.of(ctx).pop(q);
              },
              child: const Text('Update'),
            ),
          ],
        );
      },
    );
    ctrl.dispose();

    if (result != null) {
      await _setVariantQty(variantId: variantId, qty: result);
    }
  }

  @override
  Widget build(BuildContext context) {
    final filteredProducts = _products.where((p) {
      if (_selectedProductId != null &&
          p['id']?.toString() != _selectedProductId) {
        return false;
      }
      if (_search.trim().isEmpty) return true;
      final q = _search.toLowerCase().trim();
      final name = (p['name'] ?? '').toString().toLowerCase();
      final brand = (p['brand_name'] ?? '').toString().toLowerCase();
      final category = (p['category_name'] ?? '').toString().toLowerCase();
      return name.contains(q) || brand.contains(q) || category.contains(q);
    }).toList();

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const Text(
            'Live Stock Editor',
            style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 6),
          const Text(
            'Find any product variant and adjust quantity instantly.',
            style: TextStyle(color: Color(0xFF64748B)),
          ),
          const SizedBox(height: 10),
          Text(
            'Store: ${_storeLabel ?? 'Loading...'}',
            style: const TextStyle(
              fontSize: 12,
              color: Color(0xFF64748B),
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _searchController,
            onChanged: (v) => setState(() => _search = v),
            decoration: InputDecoration(
              hintText: 'Search by product, brand or category',
              prefixIcon: const Icon(Icons.search_rounded),
              suffixIcon: _searchController.text.isEmpty
                  ? null
                  : IconButton(
                      onPressed: () {
                        _searchController.clear();
                        setState(() => _search = '');
                      },
                      icon: const Icon(Icons.close_rounded),
                    ),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
              ),
              filled: true,
              fillColor: Colors.white,
            ),
          ),
          const SizedBox(height: 10),
          DropdownButtonFormField<String>(
            initialValue: _selectedProductId,
            decoration: const InputDecoration(
              labelText: 'Select Product (optional)',
              border: OutlineInputBorder(),
              filled: true,
              fillColor: Colors.white,
            ),
            items: [
              const DropdownMenuItem<String>(
                value: null,
                child: Text('All Products'),
              ),
              ..._products.map(
                (p) => DropdownMenuItem<String>(
                  value: p['id']?.toString(),
                  child: Text(
                    (p['name'] ?? 'Unnamed Product').toString(),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ),
            ],
            onChanged: (v) => setState(() => _selectedProductId = v),
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              const Spacer(),
              IconButton(
                tooltip: 'Refresh',
                onPressed: _loadingProducts ? null : _load,
                icon: const Icon(Icons.refresh_rounded),
              ),
            ],
          ),
          const SizedBox(height: 8),
          if (_loadingProducts)
            const Padding(
              padding: EdgeInsets.only(top: 20),
              child: Center(child: CircularProgressIndicator()),
            )
          else if (filteredProducts.isEmpty)
            const Padding(
              padding: EdgeInsets.only(top: 24),
              child: Center(
                child: Text('No matching products for your filter.'),
              ),
            )
          else
            ...filteredProducts.map((p) {
              final variants = (p['variants'] as List?) ?? const [];
              return Container(
                margin: const EdgeInsets.only(bottom: 10),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      (p['name'] ?? 'Unnamed Product').toString(),
                      style: const TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 14,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '${p['category_name'] ?? ''} • ${p['brand_name'] ?? ''}',
                      style: const TextStyle(
                        fontSize: 12,
                        color: Color(0xFF64748B),
                      ),
                    ),
                    const SizedBox(height: 8),
                    ...variants.whereType<Map>().map((v) {
                      final variantId = v['id']?.toString() ?? '';
                      final qty = int.tryParse('${v['quantity'] ?? 0}') ?? 0;
                      final size = (v['size'] ?? '-').toString();
                      final color = (v['color'] ?? '-').toString();
                      final barcode = (v['barcode'] ?? '').toString().trim();
                      return Container(
                        margin: const EdgeInsets.only(bottom: 8),
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF8FAFC),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: const Color(0xFFE2E8F0)),
                        ),
                        child: Row(
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    '$size • $color',
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                  if (barcode.isNotEmpty)
                                    Text(
                                      'Barcode: $barcode',
                                      style: const TextStyle(
                                        fontSize: 11,
                                        color: Color(0xFF64748B),
                                      ),
                                    ),
                                ],
                              ),
                            ),
                            IconButton(
                              onPressed:
                                  _updating || qty <= 0 || variantId.isEmpty
                                  ? null
                                  : () => _setVariantQty(
                                      variantId: variantId,
                                      qty: qty - 1,
                                    ),
                              icon: const Icon(
                                Icons.remove_circle_outline_rounded,
                              ),
                            ),
                            Text(
                              '$qty',
                              style: const TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                            IconButton(
                              onPressed: _updating || variantId.isEmpty
                                  ? null
                                  : () => _setVariantQty(
                                      variantId: variantId,
                                      qty: qty + 1,
                                    ),
                              icon: const Icon(
                                Icons.add_circle_outline_rounded,
                              ),
                            ),
                            const SizedBox(width: 4),
                            OutlinedButton(
                              onPressed: _updating || variantId.isEmpty
                                  ? null
                                  : () => _openSetQtyDialog(
                                      variantId: variantId,
                                      currentQty: qty,
                                    ),
                              child: const Text('Set'),
                            ),
                          ],
                        ),
                      );
                    }),
                  ],
                ),
              );
            }),
        ],
      ),
    );
  }
}

class _MetricCard extends StatelessWidget {
  const _MetricCard({
    required this.title,
    required this.value,
    required this.color,
  });

  final String title;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        color: Colors.white,
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: const TextStyle(fontSize: 12, color: Color(0xFF64748B)),
          ),
          const SizedBox(height: 4),
          Text(
            value,
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w800,
              color: color,
            ),
          ),
        ],
      ),
    );
  }
}

class _VendorOrdersTab extends StatefulWidget {
  const _VendorOrdersTab({required this.vendorId});

  final String vendorId;

  @override
  State<_VendorOrdersTab> createState() => _VendorOrdersTabState();
}

class _VariantDraft {
  _VariantDraft()
    : sizeCtrl = TextEditingController(text: 'M'),
      colorCtrl = TextEditingController(text: 'Black'),
      barcodeCtrl = TextEditingController(),
      mrpCtrl = TextEditingController(),
      priceCtrl = TextEditingController(),
      stockCtrl = TextEditingController(text: '0');

  final TextEditingController sizeCtrl;
  final TextEditingController colorCtrl;
  final TextEditingController barcodeCtrl;
  final TextEditingController mrpCtrl;
  final TextEditingController priceCtrl;
  final TextEditingController stockCtrl;
  final List<String> imagePaths = [];

  void dispose() {
    sizeCtrl.dispose();
    colorCtrl.dispose();
    barcodeCtrl.dispose();
    mrpCtrl.dispose();
    priceCtrl.dispose();
    stockCtrl.dispose();
  }
}

class _VendorOrdersTabState extends State<_VendorOrdersTab> {
  final ApiClient _api = ApiClient();
  Timer? _ordersPoller;

  bool _loading = true;
  bool _statusUpdating = false;
  List<Map<String, dynamic>> _orders = const [];
  final Set<String> _seenOrderIds = <String>{};
  final Map<String, String> _lastOrderStatus = <String, String>{};
  String _statusFilter = 'all';
  bool _incomingAlertOpen = false;

  @override
  void initState() {
    super.initState();
    _load(initialLoad: true);
    _ordersPoller = Timer.periodic(const Duration(seconds: 10), (_) {
      if (!mounted || _statusUpdating) return;
      _load(silent: true);
    });
  }

  @override
  void dispose() {
    _ordersPoller?.cancel();
    super.dispose();
  }

  Future<void> _load({bool silent = false, bool initialLoad = false}) async {
    if (!silent) {
      setState(() => _loading = true);
    }

    try {
      final data = await _api.fetchVendorOrders(widget.vendorId);
      final orders = data
          .whereType<Map>()
          .map((e) => Map<String, dynamic>.from(e))
          .toList();

      final newOrderIds = <String>[];
      final statusChanges = <String>[];
      for (final order in orders) {
        final orderId = (order['id'] ?? '').toString();
        final status = (order['status'] ?? '').toString().toLowerCase();
        if (orderId.isEmpty) continue;

        if (!_seenOrderIds.contains(orderId)) {
          if (!initialLoad) {
            newOrderIds.add(orderId);
          }
          _seenOrderIds.add(orderId);
        } else if (_lastOrderStatus[orderId] != null &&
            _lastOrderStatus[orderId] != status) {
          statusChanges.add(orderId);
        }
        _lastOrderStatus[orderId] = status;
      }

      if (!mounted) return;
      setState(() => _orders = orders);

      if (newOrderIds.isNotEmpty) {
        NotificationService.instance.showVendorNewOrderAlert(
          count: newOrderIds.length,
        );
        await _showIncomingOrderAlert(newOrderIds.length);
      } else if (statusChanges.isNotEmpty) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Order status updated (${statusChanges.length})'),
          ),
        );
      }
    } finally {
      if (!silent && mounted) {
        setState(() => _loading = false);
      }
    }
  }

  Future<void> _showIncomingOrderAlert(int newCount) async {
    if (!mounted || _incomingAlertOpen) return;
    _incomingAlertOpen = true;
    HapticFeedback.vibrate();

    try {
      await showDialog<void>(
        context: context,
        barrierDismissible: true,
        builder: (ctx) {
          return Dialog(
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(20),
            ),
            child: Padding(
              padding: const EdgeInsets.fromLTRB(18, 16, 18, 14),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 54,
                    height: 54,
                    decoration: const BoxDecoration(
                      shape: BoxShape.circle,
                      color: Color(0xFFECFDF3),
                    ),
                    child: const Icon(
                      Icons.notifications_active_rounded,
                      color: Color(0xFF16A34A),
                      size: 30,
                    ),
                  ),
                  const SizedBox(height: 10),
                  const Text(
                    'New Order Alert',
                    style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    newCount <= 1
                        ? 'You just received a new order.'
                        : 'You just received $newCount new orders.',
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      color: Color(0xFF475569),
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 12),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF8FAFC),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: const Color(0xFFE2E8F0)),
                    ),
                    child: const Text(
                      'Open the order card below and Accept/Reject quickly.',
                      textAlign: TextAlign.center,
                      style: TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                    ),
                  ),
                  const SizedBox(height: 14),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton.icon(
                      onPressed: () => Navigator.of(ctx).pop(),
                      icon: const Icon(Icons.receipt_long_rounded),
                      label: const Text('View Orders'),
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      );
    } finally {
      _incomingAlertOpen = false;
    }
  }

  Future<void> _updateOrderStatus({
    required String orderId,
    required String status,
    String? cancelReason,
  }) async {
    setState(() => _statusUpdating = true);
    try {
      final result = await _api.updateVendorOrderStatus(
        vendorId: widget.vendorId,
        orderId: orderId,
        status: status,
        cancelReason: cancelReason,
      );
      if (!mounted) return;

      if (result['success'] == true) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Order marked as ${status.toUpperCase()}')),
        );
        await _load(silent: true);
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              (result['message'] ?? result['error'] ?? 'Unable to update order')
                  .toString(),
            ),
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _statusUpdating = false);
      }
    }
  }

  Future<void> _rejectOrder(String orderId) async {
    final reasonCtrl = TextEditingController();
    final reason = await showDialog<String>(
      context: context,
      builder: (ctx) {
        return AlertDialog(
          title: const Text('Reject Order'),
          content: TextField(
            controller: reasonCtrl,
            maxLines: 2,
            decoration: const InputDecoration(
              labelText: 'Reason',
              hintText: 'Out of stock / store closed / etc.',
              border: OutlineInputBorder(),
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(ctx).pop(),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: () => Navigator.of(ctx).pop(reasonCtrl.text.trim()),
              child: const Text('Reject'),
            ),
          ],
        );
      },
    );
    reasonCtrl.dispose();
    if (reason == null) return;
    await _updateOrderStatus(
      orderId: orderId,
      status: 'cancelled',
      cancelReason: reason,
    );
  }

  Widget _buildActionRow(Map<String, dynamic> order) {
    final orderId = (order['id'] ?? '').toString();
    final status = (order['status'] ?? '').toString().toLowerCase();
    if (orderId.isEmpty) return const SizedBox.shrink();

    if (status == 'placed' || status == 'pending') {
      return Row(
        children: [
          Expanded(
            child: FilledButton.icon(
              onPressed: _statusUpdating
                  ? null
                  : () => _updateOrderStatus(
                      orderId: orderId,
                      status: 'confirmed',
                    ),
              icon: const Icon(Icons.check_circle_outline_rounded),
              label: const Text('Accept'),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: OutlinedButton.icon(
              onPressed: _statusUpdating ? null : () => _rejectOrder(orderId),
              icon: const Icon(Icons.cancel_outlined),
              label: const Text('Reject'),
            ),
          ),
        ],
      );
    }

    if (status == 'confirmed') {
      return FilledButton.icon(
        onPressed: _statusUpdating
            ? null
            : () => _updateOrderStatus(orderId: orderId, status: 'packed'),
        icon: const Icon(Icons.inventory_2_outlined),
        label: const Text('Mark Packed'),
      );
    }

    if (status == 'packed') {
      return FilledButton.icon(
        onPressed: _statusUpdating
            ? null
            : () => _updateOrderStatus(
                orderId: orderId,
                status: 'out_for_delivery',
              ),
        icon: const Icon(Icons.local_shipping_outlined),
        label: const Text('Out For Delivery'),
      );
    }

    if (status == 'out_for_delivery') {
      return FilledButton.icon(
        onPressed: _statusUpdating
            ? null
            : () => _updateOrderStatus(orderId: orderId, status: 'delivered'),
        icon: const Icon(Icons.task_alt_rounded),
        label: const Text('Mark Delivered'),
      );
    }

    return const SizedBox.shrink();
  }

  @override
  Widget build(BuildContext context) {
    final filteredOrders = _statusFilter == 'all'
        ? _orders
        : _orders
              .where(
                (o) =>
                    (o['status'] ?? '').toString().toLowerCase() ==
                    _statusFilter,
              )
              .toList();

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const Text(
            'Order Queue',
            style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final status in const [
                'all',
                'placed',
                'pending',
                'confirmed',
                'packed',
                'out_for_delivery',
                'delivered',
                'cancelled',
              ])
                ChoiceChip(
                  label: Text(status.toUpperCase()),
                  selected: _statusFilter == status,
                  onSelected: (_) => setState(() => _statusFilter = status),
                ),
            ],
          ),
          const SizedBox(height: 12),
          if (_loading)
            const Center(child: CircularProgressIndicator())
          else if (filteredOrders.isEmpty)
            const Padding(
              padding: EdgeInsets.only(top: 20),
              child: Center(
                child: Text('No orders yet. New orders will appear here.'),
              ),
            )
          else
            ...filteredOrders.map((o) {
              final id = (o['id'] ?? '').toString();
              final status = (o['status'] ?? 'pending').toString();
              final total = (o['final_amount'] ?? o['total_amount'] ?? 0)
                  .toString();
              final createdAt = (o['created_at'] ?? '').toString();
              final customerName = (o['customer_name'] ?? '').toString().trim();
              final customerPhone = (o['customer_phone'] ?? '')
                  .toString()
                  .trim();
              final otp = (o['delivery_otp'] ?? '').toString().trim();
              final otpVerifiedAt = (o['otp_verified_at'] ?? '')
                  .toString()
                  .trim();
              final items =
                  (o['items'] as List?)?.whereType<Map>().toList() ??
                  const <Map>[];

              final isNewState =
                  status.toLowerCase() == 'placed' ||
                  status.toLowerCase() == 'pending';

              return Container(
                margin: const EdgeInsets.only(bottom: 10),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: isNewState ? const Color(0xFFFFFBEB) : Colors.white,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: isNewState
                        ? const Color(0xFFF59E0B)
                        : const Color(0xFFE2E8F0),
                  ),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            'Order #${id.length > 8 ? id.substring(0, 8) : id}',
                            style: const TextStyle(
                              fontWeight: FontWeight.w700,
                              fontSize: 14,
                            ),
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 4,
                          ),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF1F5F9),
                            borderRadius: BorderRadius.circular(999),
                          ),
                          child: Text(
                            status.toUpperCase(),
                            style: const TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF334155),
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    if (customerName.isNotEmpty || customerPhone.isNotEmpty)
                      Text(
                        'Customer: ${[customerName, customerPhone].where((e) => e.isNotEmpty).join(' • ')}',
                        style: const TextStyle(
                          color: Color(0xFF334155),
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    const SizedBox(height: 4),
                    Text(
                      'Total: ₹$total',
                      style: const TextStyle(color: Color(0xFF475569)),
                    ),
                    if (createdAt.isNotEmpty)
                      Text(
                        createdAt,
                        style: const TextStyle(
                          fontSize: 12,
                          color: Color(0xFF64748B),
                        ),
                      ),
                    if (otp.isNotEmpty) ...[
                      const SizedBox(height: 6),
                      Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF8FAFC),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: const Color(0xFFE2E8F0)),
                        ),
                        child: Text(
                          otpVerifiedAt.isEmpty
                              ? 'Delivery OTP: $otp (not verified yet)'
                              : 'Delivery OTP: $otp (verified)',
                          style: const TextStyle(
                            fontSize: 12,
                            color: Color(0xFF0F172A),
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ],
                    if (items.isNotEmpty) ...[
                      const SizedBox(height: 8),
                      const Text(
                        'Items from your linked dark store',
                        style: TextStyle(
                          fontSize: 12,
                          color: Color(0xFF64748B),
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 6),
                      ...items.map((item) {
                        final productName = (item['product_name'] ?? 'Product')
                            .toString();
                        final qty = (item['quantity'] ?? 0).toString();
                        final size = (item['size'] ?? '-').toString();
                        final color = (item['color'] ?? '-').toString();
                        final barcode = (item['barcode'] ?? '').toString();
                        final imageUrl = (item['image_url'] ?? '')
                            .toString()
                            .trim();
                        return Container(
                          margin: const EdgeInsets.only(bottom: 6),
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF8FAFC),
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(color: const Color(0xFFE2E8F0)),
                          ),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Container(
                                width: 46,
                                height: 46,
                                decoration: BoxDecoration(
                                  borderRadius: BorderRadius.circular(8),
                                  color: const Color(0xFFE2E8F0),
                                ),
                                clipBehavior: Clip.antiAlias,
                                child: imageUrl.isEmpty
                                    ? const Icon(
                                        Icons.inventory_2_outlined,
                                        size: 20,
                                        color: Color(0xFF64748B),
                                      )
                                    : Image.network(
                                        imageUrl,
                                        fit: BoxFit.cover,
                                        errorBuilder: (_, _, _) => const Icon(
                                          Icons.broken_image_outlined,
                                          size: 20,
                                          color: Color(0xFF64748B),
                                        ),
                                      ),
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      '$productName • Qty: $qty',
                                      style: const TextStyle(
                                        fontWeight: FontWeight.w700,
                                        fontSize: 12,
                                      ),
                                    ),
                                    const SizedBox(height: 2),
                                    Text(
                                      'Variant: $size / $color${barcode.trim().isEmpty ? '' : ' • Barcode: $barcode'}',
                                      style: const TextStyle(
                                        fontSize: 11,
                                        color: Color(0xFF475569),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        );
                      }),
                    ],
                    const SizedBox(height: 8),
                    _buildActionRow(o),
                  ],
                ),
              );
            }),
        ],
      ),
    );
  }
}
