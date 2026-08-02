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
    NotificationService.instance.registerForCurrentUser();
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
    final previousValue = _isOperational;
    setState(() => _statusUpdating = true);
    try {
      final res = await _api.setVendorOperationalStatus(
        vendorId: widget.vendorId,
        isOperational: value,
      );
      if (!mounted) return;
      if (res['success'] == true) {
        final returnedStatus =
            (res['vendor'] is Map &&
                (res['vendor'] as Map)['is_operational'] is bool)
            ? (res['vendor'] as Map)['is_operational'] as bool
            : value;
        setState(() => _isOperational = returnedStatus);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              returnedStatus
                  ? 'Store is now LIVE. Customers can place new orders.'
                  : 'Store is now PAUSED. Products are hidden for shoppers.',
            ),
          ),
        );
      } else {
        setState(() => _isOperational = previousValue);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              (res['message'] ?? res['error'] ?? 'Unable to update status')
                  .toString(),
            ),
          ),
        );
      }
    } catch (_) {
      if (!mounted) return;
      setState(() => _isOperational = previousValue);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Unable to update store status. Please try again.'),
        ),
      );
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
                  text: const TextSpan(
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
            _VendorEditProductsTab(vendorId: widget.vendorId),
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
              icon: Icon(Icons.edit_outlined),
              activeIcon: Icon(Icons.edit_rounded),
              label: 'Edit',
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
  static const String _googleMapsApiKeyUpper = String.fromEnvironment(
    'GOOGLE_MAPS_API_KEY',
    defaultValue: '',
  );
  static const String _googleMapsApiKeyLower = String.fromEnvironment(
    'google_maps_api_key',
    defaultValue: '',
  );
  String get _googleMapsApiKey => _googleMapsApiKeyUpper.isNotEmpty
      ? _googleMapsApiKeyUpper
      : _googleMapsApiKeyLower;

  final ApiClient _api = ApiClient();

  bool _loading = true;
  bool _updating = false;
  bool _estimating = false;
  bool _submitting = false;
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
  Timer? _liveTimer;
  int _liveTick = 0;
  int? _etaMinutes;
  bool _routeLoading = false;
  String _cityHint = '';
  final FocusNode _pickupFocus = FocusNode();
  final FocusNode _dropFocus = FocusNode();
  Timer? _pickupDebounce;
  Timer? _dropDebounce;
  bool _pickupSearching = false;
  bool _dropSearching = false;
  List<Map<String, dynamic>> _pickupSuggestions = const [];
  List<Map<String, dynamic>> _dropSuggestions = const [];
  String _googleSearchStatus = 'Idle';
  String? _lastGoogleApiStatus;
  bool _shownGoogleSearchConfigWarning = false;

  @override
  void initState() {
    super.initState();
    _load();
    _setPickupFromCurrentLocation();
  }

  @override
  void dispose() {
    _liveTimer?.cancel();
    _pickupDebounce?.cancel();
    _dropDebounce?.cancel();
    _pickupFocus.dispose();
    _dropFocus.dispose();
    _pickupCtrl.dispose();
    _dropCtrl.dispose();
    super.dispose();
  }

  void _snack(String msg) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
  }

  Future<Location?> _geocodeVendorAddressWithGoogle(String query) async {
    final q = query.trim();
    if (q.isEmpty || _googleMapsApiKey.isEmpty) return null;

    try {
      final uri = Uri.parse(
        'https://maps.googleapis.com/maps/api/geocode/json'
        '?address=${Uri.encodeComponent(q)}'
        '&components=country:IN'
        '&key=${Uri.encodeComponent(_googleMapsApiKey)}',
      );
      final res = await http.get(
        uri,
        headers: const {'User-Agent': 'BlinkieFashApp/1.0'},
      );
      if (res.statusCode != 200) return null;
      final data = jsonDecode(res.body);
      if (data is! Map || data['status'] != 'OK') return null;
      final results = (data['results'] as List? ?? const []);
      if (results.isEmpty || results.first is! Map) return null;

      final first = Map<String, dynamic>.from(results.first as Map);
      final geometry = first['geometry'] as Map?;
      final location = geometry?['location'] as Map?;
      final lat = (location?['lat'] as num?)?.toDouble();
      final lng = (location?['lng'] as num?)?.toDouble();
      if (lat == null || lng == null) return null;
      return Location(latitude: lat, longitude: lng, timestamp: DateTime.now());
    } catch (_) {
      return null;
    }
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
        final marks = await placemarkFromCoordinates(
          pos.latitude,
          pos.longitude,
        );
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
        _pickupSuggestions = const [];
      });
      _refreshNearbyRiders();
      _refreshRoute();
    } catch (_) {}
  }

  void _refreshNearbyRiders() {
    if (_pickupLat == null || _pickupLng == null) {
      _stopLiveTracking();
      setState(() => _nearbyRiders = const []);
      return;
    }

    setState(() => _nearbyRiders = _buildLiveRiders());
    _startLiveTracking();
  }

  List<LatLng> _buildLiveRiders() {
    if (_pickupLat == null || _pickupLng == null) return const [];
    final lat = _pickupLat!;
    final lng = _pickupLng!;
    final cosLat = math.cos(lat * math.pi / 180).abs().clamp(0.2, 1.0);
    final riders = <LatLng>[];
    for (int i = 0; i < 2; i++) {
      if (_routePoints.length >= 2) {
        final idx = (_liveTick * 2 + i * 21) % _routePoints.length;
        riders.add(_routePoints[idx]);
        continue;
      }
      final angle = ((_liveTick * 18) + (i * 57 + 19)) * math.pi / 180;
      final radiusKm = 0.18 + i * 0.22;
      final dLat = (radiusKm / 111.0) * math.cos(angle);
      final dLng = (radiusKm / (111.0 * cosLat)) * math.sin(angle);
      riders.add(LatLng(lat + dLat, lng + dLng));
    }
    return riders;
  }

  void _startLiveTracking() {
    _liveTimer?.cancel();
    _liveTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted || _pickupLat == null || _pickupLng == null) return;
      setState(() {
        _liveTick++;
        _nearbyRiders = _buildLiveRiders();
      });
    });
  }

  void _stopLiveTracking() {
    _liveTimer?.cancel();
    _liveTimer = null;
  }

  double _haversineKm(double lat1, double lng1, double lat2, double lng2) {
    const r = 6371.0;
    final dLat = (lat2 - lat1) * math.pi / 180.0;
    final dLng = (lng2 - lng1) * math.pi / 180.0;
    final a =
        math.sin(dLat / 2) * math.sin(dLat / 2) +
        math.cos(lat1 * math.pi / 180.0) *
            math.cos(lat2 * math.pi / 180.0) *
            math.sin(dLng / 2) *
            math.sin(dLng / 2);
    return r * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a));
  }

  void _recalculateEta() {
    double? distanceKm;
    final fromEstimate = (_estimate?['distanceKm'] as num?)?.toDouble();
    if (fromEstimate != null && fromEstimate > 0) {
      distanceKm = fromEstimate;
    } else if (_pickupLat != null &&
        _pickupLng != null &&
        _dropLat != null &&
        _dropLng != null) {
      distanceKm = _haversineKm(_pickupLat!, _pickupLng!, _dropLat!, _dropLng!);
    }

    if (distanceKm == null) {
      setState(() => _etaMinutes = null);
      return;
    }

    final mins = ((distanceKm / 24.0) * 60.0).round().clamp(6, 95);
    setState(() => _etaMinutes = mins);
  }

  Future<void> _refreshRoute() async {
    if (_pickupLat == null ||
        _pickupLng == null ||
        _dropLat == null ||
        _dropLng == null) {
      if (mounted) {
        setState(() => _routePoints = const []);
        _recalculateEta();
      }
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

      final fallback = [
        LatLng(_pickupLat!, _pickupLng!),
        LatLng(_dropLat!, _dropLng!),
      ];
      if (res.statusCode != 200) {
        setState(() => _routePoints = fallback);
        _recalculateEta();
        _refreshNearbyRiders();
        return;
      }

      final body = jsonDecode(res.body);
      final routes = body is Map
          ? (body['routes'] as List? ?? const [])
          : const [];
      if (routes.isEmpty) {
        setState(() => _routePoints = fallback);
        _recalculateEta();
        _refreshNearbyRiders();
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
      _recalculateEta();
      _refreshNearbyRiders();
    } catch (_) {
      if (!mounted) return;
      setState(() {
        if (_pickupLat != null &&
            _pickupLng != null &&
            _dropLat != null &&
            _dropLng != null) {
          _routePoints = [
            LatLng(_pickupLat!, _pickupLng!),
            LatLng(_dropLat!, _dropLng!),
          ];
        }
      });
      _recalculateEta();
      _refreshNearbyRiders();
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
        : [
            picked.city,
            picked.pincode,
          ].where((e) => e.trim().isNotEmpty).join(', ');

    setState(() {
      _estimate = null;
      if (pickup) {
        _pickupCtrl.text = text;
        _pickupLat = picked.lat;
        _pickupLng = picked.lng;
        _pickupSuggestions = const [];
        _pickupSearching = false;
        _cityHint = picked.city;
      } else {
        _dropCtrl.text = text;
        _dropLat = picked.lat;
        _dropLng = picked.lng;
        _dropSuggestions = const [];
        _dropSearching = false;
      }
    });
    if (pickup) _refreshNearbyRiders();
    _refreshRoute();
    _autoEstimateVendorParcelIfReady();
  }

  Future<List<Map<String, dynamic>>> _searchVendorParcelSuggestions(
    String query,
  ) async {
    _lastGoogleApiStatus = null;
    final suggestions = <Map<String, dynamic>>[];
    final seen = <String>{};

    void addSuggestion({
      required String title,
      required String subtitle,
      required double lat,
      required double lng,
    }) {
      final t = title.trim();
      final s = subtitle.trim();
      if (t.isEmpty) return;
      final key =
          '${t.toLowerCase()}|${lat.toStringAsFixed(5)}|${lng.toStringAsFixed(5)}';
      if (!seen.add(key)) return;
      suggestions.add({
        'title': t,
        'subtitle': s.isEmpty ? 'Tap to select' : s,
        'lat': lat,
        'lng': lng,
      });
    }

    Future<void> addGeocodingSuggestions() async {
      if (_googleMapsApiKey.isEmpty) return;
      try {
        final geoUri = Uri.parse(
          'https://maps.googleapis.com/maps/api/geocode/json'
          '?address=${Uri.encodeComponent(query)}'
          '&components=country:IN'
          '&key=${Uri.encodeComponent(_googleMapsApiKey)}',
        );
        final geoRes = await http.get(
          geoUri,
          headers: const {'User-Agent': 'BlinkieFashApp/1.0'},
        );
        if (geoRes.statusCode != 200) {
          _lastGoogleApiStatus = 'HTTP_${geoRes.statusCode}';
          return;
        }

        final geoData = jsonDecode(geoRes.body);
        if (geoData is! Map) return;
        final status = (geoData['status'] ?? '').toString();
        _lastGoogleApiStatus = status;
        _maybeWarnGoogleSearchConfig(status);
        if (status != 'OK' && status != 'ZERO_RESULTS') return;

        final results = (geoData['results'] as List? ?? const []);
        for (final item in results.take(8)) {
          if (item is! Map) continue;
          final m = Map<String, dynamic>.from(item);
          final geometry = m['geometry'] as Map?;
          final location = geometry?['location'] as Map?;
          final lat = (location?['lat'] as num?)?.toDouble();
          final lng = (location?['lng'] as num?)?.toDouble();
          if (lat == null || lng == null) continue;

          final formatted = (m['formatted_address'] ?? '').toString().trim();
          final title = formatted.isNotEmpty
              ? formatted.split(',').first.trim()
              : query;
          addSuggestion(
            title: title,
            subtitle: formatted.isNotEmpty ? formatted : 'Tap to select',
            lat: lat,
            lng: lng,
          );
        }
      } catch (_) {
        // Keep empty suggestions when Google geocoding fails.
      }
    }

    if (_googleMapsApiKey.isNotEmpty) {
      try {
        final autoUri = Uri.parse(
          'https://maps.googleapis.com/maps/api/place/autocomplete/json'
          '?input=${Uri.encodeComponent(query)}'
          '&components=country:in'
          '&language=en'
          '&key=${Uri.encodeComponent(_googleMapsApiKey)}',
        );

        final autoRes = await http.get(
          autoUri,
          headers: const {'User-Agent': 'BlinkieFashApp/1.0'},
        );
        if (autoRes.statusCode != 200) {
          _lastGoogleApiStatus = 'HTTP_${autoRes.statusCode}';
          return suggestions.take(12).toList();
        }

        if (autoRes.statusCode == 200) {
          final autoData = jsonDecode(autoRes.body);
          if (autoData is Map) {
            final status = (autoData['status'] ?? '').toString();
            _lastGoogleApiStatus = status;
            _maybeWarnGoogleSearchConfig(status);
          }
          final predictions = autoData is Map
              ? (autoData['predictions'] as List? ?? const [])
              : const [];

          for (final p in predictions.take(8)) {
            if (p is! Map) continue;
            final pred = Map<String, dynamic>.from(p);
            final placeId = (pred['place_id'] ?? '').toString();
            if (placeId.isEmpty) continue;

            try {
              final detailsUri = Uri.parse(
                'https://maps.googleapis.com/maps/api/place/details/json'
                '?place_id=${Uri.encodeComponent(placeId)}'
                '&fields=name,formatted_address,geometry/location'
                '&key=${Uri.encodeComponent(_googleMapsApiKey)}',
              );
              final detailsRes = await http.get(
                detailsUri,
                headers: const {'User-Agent': 'BlinkieFashApp/1.0'},
              );
              if (detailsRes.statusCode != 200) continue;

              final detailsData = jsonDecode(detailsRes.body);
              final result = detailsData is Map
                  ? (detailsData['result'] as Map? ?? const {})
                  : const {};
              final geometry = result['geometry'] as Map?;
              final location = geometry?['location'] as Map?;
              final lat = (location?['lat'] as num?)?.toDouble();
              final lng = (location?['lng'] as num?)?.toDouble();
              if (lat == null || lng == null) continue;

              final title =
                  (result['name'] ??
                          pred['structured_formatting']?['main_text'] ??
                          pred['description'] ??
                          query)
                      .toString();
              final subtitle =
                  (result['formatted_address'] ??
                          pred['structured_formatting']?['secondary_text'] ??
                          pred['description'] ??
                          'Tap to select')
                      .toString();

              addSuggestion(
                title: title,
                subtitle: subtitle,
                lat: lat,
                lng: lng,
              );
            } catch (_) {
              // Continue with next prediction.
            }
          }
        }
      } catch (_) {
        // Keep empty suggestions when Google search fails.
      }
    }

    if (suggestions.isEmpty) {
      await addGeocodingSuggestions();
    }

    return suggestions.take(12).toList();
  }

  void _onVendorLocationChanged(String value, {required bool pickup}) {
    if (pickup) {
      _pickupDebounce?.cancel();
    } else {
      _dropDebounce?.cancel();
    }

    setState(() {
      _estimate = null;
      if (pickup) {
        _pickupLat = null;
        _pickupLng = null;
      } else {
        _dropLat = null;
        _dropLng = null;
      }
    });
    if (pickup) _refreshNearbyRiders();
    _refreshRoute();

    final query = value.trim();
    if (_googleMapsApiKey.isEmpty && !_shownGoogleSearchConfigWarning) {
      _shownGoogleSearchConfigWarning = true;
      _googleSearchStatus = 'Missing API key';
      _snack(
        'Google location search is not configured. Rebuild app with --dart-define=GOOGLE_MAPS_API_KEY=... (or google_maps_api_key).',
      );
    }

    if (query.length < 2) {
      if (!mounted) return;
      setState(() {
        _googleSearchStatus = 'Idle';
        if (pickup) {
          _pickupSearching = false;
          _pickupSuggestions = const [];
        } else {
          _dropSearching = false;
          _dropSuggestions = const [];
        }
      });
      return;
    }

    setState(() {
      _googleSearchStatus = 'Checking...';
      if (pickup) {
        _pickupSearching = true;
      } else {
        _dropSearching = true;
      }
    });

    final debounce = Timer(const Duration(milliseconds: 260), () async {
      List<Map<String, dynamic>> rows = const [];
      try {
        rows = await _searchVendorParcelSuggestions(query);
      } catch (_) {
        if (!mounted) return;
        setState(() {
          _googleSearchStatus = 'Request failed';
          if (pickup) {
            _pickupSearching = false;
            _pickupSuggestions = const [];
          } else {
            _dropSearching = false;
            _dropSuggestions = const [];
          }
        });
        return;
      }
      if (!mounted) return;
      setState(() {
        if (rows.isNotEmpty) {
          _googleSearchStatus = 'Connected';
        } else {
          final last = _lastGoogleApiStatus;
          if (last != null &&
              last.isNotEmpty &&
              last != 'OK' &&
              last != 'ZERO_RESULTS') {
            _googleSearchStatus = 'API error: $last';
          } else {
            _googleSearchStatus = 'No results';
          }
        }
        if (pickup) {
          _pickupSearching = false;
          _pickupSuggestions = rows;
        } else {
          _dropSearching = false;
          _dropSuggestions = rows;
        }
      });
    });

    if (pickup) {
      _pickupDebounce = debounce;
    } else {
      _dropDebounce = debounce;
    }
  }

  void _maybeWarnGoogleSearchConfig(String status) {
    if (_shownGoogleSearchConfigWarning) return;
    const blocked = {
      'REQUEST_DENIED',
      'INVALID_REQUEST',
      'OVER_DAILY_LIMIT',
      'OVER_QUERY_LIMIT',
      'API_KEY_INVALID',
    };
    if (!blocked.contains(status)) return;
    _googleSearchStatus = 'API error: $status';
    _shownGoogleSearchConfigWarning = true;
    _snack(
      'Google location search failed ($status). Check API key and Places/Geocoding APIs.',
    );
  }

  Color _googleSearchStatusColor() {
    final s = _googleSearchStatus;
    if (s == 'Connected') return const Color(0xFF166534);
    if (s == 'Checking...' || s == 'Idle') return const Color(0xFF475569);
    if (s == 'No results') return const Color(0xFF92400E);
    return const Color(0xFFB91C1C);
  }

  void _selectVendorSuggestion(Map<String, dynamic> s, {required bool pickup}) {
    final title = (s['title'] ?? '').toString();
    final subtitle = (s['subtitle'] ?? '').toString();
    final lat = (s['lat'] as num?)?.toDouble();
    final lng = (s['lng'] as num?)?.toDouble();
    if (lat == null || lng == null) return;

    final text = subtitle.isNotEmpty ? '$title, $subtitle' : title;
    setState(() {
      _estimate = null;
      if (pickup) {
        _pickupCtrl.text = text;
        _pickupLat = lat;
        _pickupLng = lng;
        _pickupSuggestions = const [];
        _pickupSearching = false;
      } else {
        _dropCtrl.text = text;
        _dropLat = lat;
        _dropLng = lng;
        _dropSuggestions = const [];
        _dropSearching = false;
      }
    });

    if (pickup) _refreshNearbyRiders();
    _refreshRoute();
    _autoEstimateVendorParcelIfReady();
    FocusScope.of(context).unfocus();
  }

  Widget _vendorSuggestionList({required bool pickup}) {
    final rows = pickup ? _pickupSuggestions : _dropSuggestions;
    if (rows.isEmpty) return const SizedBox.shrink();

    return Container(
      margin: const EdgeInsets.only(top: 6, bottom: 4),
      constraints: const BoxConstraints(maxHeight: 180),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: ListView.separated(
        padding: EdgeInsets.zero,
        shrinkWrap: true,
        itemCount: rows.length,
        separatorBuilder: (_, index) => const Divider(height: 1),
        itemBuilder: (_, i) {
          final s = rows[i];
          return ListTile(
            dense: true,
            leading: Icon(
              pickup ? Icons.trip_origin_rounded : Icons.place_outlined,
              color: pickup ? const Color(0xFF16A34A) : const Color(0xFFEF4444),
            ),
            title: Text(
              (s['title'] ?? '').toString(),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
            subtitle: Text(
              (s['subtitle'] ?? '').toString(),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
            onTap: () => _selectVendorSuggestion(s, pickup: pickup),
          );
        },
      ),
    );
  }

  Future<void> _estimateSendParcel({bool showError = true}) async {
    if (_pickupCtrl.text.trim().isEmpty || _dropCtrl.text.trim().isEmpty) {
      if (showError) _snack('Set both pickup and destination');
      return;
    }

    setState(() {
      _estimating = true;
      _estimate = null;
    });

    try {
      if (_pickupLat == null || _pickupLng == null) {
        final g = await _geocodeVendorAddressWithGoogle(_pickupCtrl.text);
        if (g != null) {
          _pickupLat = g.latitude;
          _pickupLng = g.longitude;
        }
      }

      if (_dropLat == null || _dropLng == null) {
        final g = await _geocodeVendorAddressWithGoogle(_dropCtrl.text);
        if (g != null) {
          _dropLat = g.latitude;
          _dropLng = g.longitude;
        }
      }

      if (_pickupLat == null ||
          _pickupLng == null ||
          _dropLat == null ||
          _dropLng == null) {
        if (showError) {
          _snack('Unable to resolve locations. Use map selection.');
        }
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
        _recalculateEta();
      } else {
        if (showError) {
          _snack((estimate['message'] ?? 'Unable to estimate fare').toString());
        }
      }
    } catch (_) {
      if (showError) _snack('Unable to estimate parcel fare right now');
    } finally {
      if (mounted) setState(() => _estimating = false);
    }
  }

  void _autoEstimateVendorParcelIfReady() {
    if (_estimating || _submitting) return;
    if (_pickupLat == null ||
        _pickupLng == null ||
        _dropLat == null ||
        _dropLng == null) {
      return;
    }
    Future.microtask(() => _estimateSendParcel(showError: false));
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
          _dropSuggestions = const [];
          _estimate = null;
          _routePoints = const [];
          _etaMinutes = null;
        });
        _refreshNearbyRiders();
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
            Positioned(
              top: 8,
              left: 8,
              child: DecoratedBox(
                decoration: const BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.all(Radius.circular(18)),
                ),
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 5,
                  ),
                  child: Text(
                    _etaMinutes == null
                        ? 'Set destination for ETA'
                        : 'ETA ~ $_etaMinutes min • $_nearbyRiders.length riders',
                    style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ),
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
    final routeSource = (_estimate?['routeSource'] ?? '').toString();
    final routeLabel = routeSource == 'google-directions'
        ? 'Google'
        : routeSource == 'osrm'
        ? 'OSRM'
        : routeSource == 'haversine-fallback'
        ? 'Fallback (approx)'
        : '';
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
            focusNode: _pickupFocus,
            onChanged: (v) => _onVendorLocationChanged(v, pickup: true),
            decoration: const InputDecoration(
              labelText: 'Starting location',
              border: OutlineInputBorder(),
              prefixIcon: Icon(Icons.trip_origin_rounded),
              suffixIcon: null,
            ),
          ),
          const SizedBox(height: 6),
          Align(
            alignment: Alignment.centerLeft,
            child: Text(
              'Google Search: $_googleSearchStatus',
              style: TextStyle(
                fontSize: 12,
                color: _googleSearchStatusColor(),
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          if (_pickupSearching)
            const Padding(
              padding: EdgeInsets.only(top: 6),
              child: Align(
                alignment: Alignment.centerLeft,
                child: SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(strokeWidth: 2),
                ),
              ),
            ),
          _vendorSuggestionList(pickup: true),
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
            focusNode: _dropFocus,
            onChanged: (v) => _onVendorLocationChanged(v, pickup: false),
            decoration: const InputDecoration(
              labelText: 'Destination location',
              border: OutlineInputBorder(),
              prefixIcon: Icon(Icons.place_outlined),
              suffixIcon: null,
            ),
          ),
          const SizedBox(height: 6),
          Align(
            alignment: Alignment.centerLeft,
            child: Text(
              'Google Search: $_googleSearchStatus',
              style: TextStyle(
                fontSize: 12,
                color: _googleSearchStatusColor(),
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          if (_dropSearching)
            const Padding(
              padding: EdgeInsets.only(top: 6),
              child: Align(
                alignment: Alignment.centerLeft,
                child: SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(strokeWidth: 2),
                ),
              ),
            ),
          _vendorSuggestionList(pickup: false),
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
          if (_estimating)
            const Align(
              alignment: Alignment.centerLeft,
              child: Padding(
                padding: EdgeInsets.only(bottom: 8),
                child: Text(
                  'Calculating fare automatically...',
                  style: TextStyle(
                    fontSize: 12,
                    color: Color(0xFF64748B),
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ),
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
              onPressed: _submitting ? null : _sendVendorParcel,
              icon: _submitting
                  ? const SizedBox(
                      width: 14,
                      height: 14,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    )
                  : const Icon(
                      Icons.local_shipping_rounded,
                      color: Colors.white,
                    ),
              label: Text(
                _submitting
                    ? 'Booking...'
                    : _estimate != null
                    ? 'Book Now — ₹$fare  •  $dist km'
                    : 'Book Now',
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  color: Colors.white,
                ),
              ),
            ),
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
            if (routeLabel.isNotEmpty)
              Text(
                'Route source: $routeLabel',
                style: const TextStyle(fontSize: 12, color: Color(0xFF475569)),
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
        status: 'pending',
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
          const SizedBox(height: 8),
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

double? _resolvePriceValue(String rawText, double? mrp) {
  final text = rawText.trim();
  if (text.isEmpty) return null;

  final percentMatch = RegExp(r'^(-?\d+(?:\.\d+)?)\s*%$').firstMatch(text);
  if (percentMatch != null) {
    final percent = double.tryParse(percentMatch.group(1)!);
    if (percent == null || mrp == null || mrp <= 0) return null;
    return (mrp * (1 - percent / 100)).round().toDouble();
  }

  final numericValue = double.tryParse(
    text.replaceAll(RegExp(r'[^0-9.-]'), ''),
  );
  if (numericValue == null) return null;
  return numericValue.round().toDouble();
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
        final mrp = double.tryParse(v.mrpCtrl.text.trim());
        final resolvedPrice = _resolvePriceValue(v.priceCtrl.text.trim(), mrp);
        final qty = int.tryParse(v.stockCtrl.text.trim());
        if (resolvedPrice == null ||
            resolvedPrice <= 0 ||
            mrp == null ||
            mrp <= 0 ||
            qty == null ||
            qty < 0) {
          messenger.showSnackBar(
            const SnackBar(
              content: Text(
                'Please enter valid variant price/MRP/stock values. You can use a direct number or a percentage like 40%.',
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
          'price': resolvedPrice,
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
                                  keyboardType: TextInputType.text,
                                  decoration: const InputDecoration(
                                    labelText: 'Selling Price / %',
                                    hintText: '499 or 40%',
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
  bool _updating = false;
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

  Future<void> _setVariantPrice({
    required String variantId,
    required int qty,
    required String rawValue,
    required double? mrp,
  }) async {
    final resolvedPrice = _resolvePriceValue(rawValue, mrp);
    if (resolvedPrice == null || resolvedPrice <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Enter a valid selling price or percentage'),
        ),
      );
      return;
    }

    setState(() => _updating = true);
    try {
      final res = await _api.updateVendorVariantStock(
        vendorId: widget.vendorId,
        variantId: variantId,
        quantity: qty,
        price: resolvedPrice,
        mrp: mrp,
      );
      if (!mounted) return;

      if (res['success'] == true) {
        setState(() {
          for (final p in _products) {
            final variants = (p['variants'] as List?) ?? const [];
            for (final v in variants.whereType<Map>()) {
              if (v['id']?.toString() == variantId) {
                v['price'] = resolvedPrice;
                if (mrp != null) v['mrp'] = mrp;
              }
            }
          }
        });
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Price updated for this variant')),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              (res['error'] ?? res['message'] ?? 'Price update failed')
                  .toString(),
            ),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _updating = false);
    }
  }

  Future<void> _openSetPriceDialog({
    required String variantId,
    required double currentPrice,
    required double? mrp,
  }) async {
    final ctrl = TextEditingController(
      text: currentPrice > 0 ? currentPrice.toStringAsFixed(0) : '',
    );
    final result = await showDialog<String>(
      context: context,
      builder: (ctx) {
        return AlertDialog(
          title: const Text('Set Selling Price'),
          content: TextField(
            controller: ctrl,
            keyboardType: TextInputType.text,
            decoration: const InputDecoration(
              labelText: 'Price or %',
              hintText: '499 or 40%',
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
                final value = ctrl.text.trim();
                if (value.isNotEmpty) {
                  Navigator.of(ctx).pop(value);
                }
              },
              child: const Text('Update'),
            ),
          ],
        );
      },
    );
    ctrl.dispose();

    if (result != null && result.isNotEmpty) {
      await _setVariantPrice(
        variantId: variantId,
        qty: 0,
        rawValue: result,
        mrp: mrp,
      );
    }
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
            const Padding(
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
                        final price =
                            double.tryParse('${v['price'] ?? 0}') ?? 0;
                        final mrp = double.tryParse('${v['mrp'] ?? 0}');
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
                          child: Row(
                            children: [
                              Expanded(
                                child: Text(
                                  '$size • $color • Qty: $qty • $barcodeLabel',
                                  style: const TextStyle(fontSize: 12),
                                ),
                              ),
                              const SizedBox(width: 8),
                              TextButton(
                                onPressed: _updating
                                    ? null
                                    : () => _openSetPriceDialog(
                                        variantId: v['id']?.toString() ?? '',
                                        currentPrice: price,
                                        mrp: mrp,
                                      ),
                                child: Text(
                                  'Price: ₹${price.toStringAsFixed(0)}',
                                ),
                              ),
                            ],
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

class _VendorEditProductsTab extends StatefulWidget {
  const _VendorEditProductsTab({required this.vendorId});

  final String vendorId;

  @override
  State<_VendorEditProductsTab> createState() => _VendorEditProductsTabState();
}

class _VendorEditProductsTabState extends State<_VendorEditProductsTab> {
  final ApiClient _api = ApiClient();
  final TextEditingController _searchController = TextEditingController();

  bool _loading = true;
  bool _saving = false;
  String _search = '';
  String? _storeLabel;
  List<Map<String, dynamic>> _products = const [];
  final Map<String, TextEditingController> _priceControllers = {};
  final Map<String, TextEditingController> _stockControllers = {};

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _searchController.dispose();
    for (final controller in _priceControllers.values) {
      controller.dispose();
    }
    for (final controller in _stockControllers.values) {
      controller.dispose();
    }
    super.dispose();
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

      for (final controller in _priceControllers.values) {
        controller.dispose();
      }
      for (final controller in _stockControllers.values) {
        controller.dispose();
      }
      _priceControllers.clear();
      _stockControllers.clear();

      for (final product in products) {
        final variants = (product['variants'] as List?) ?? const [];
        for (final rawVariant in variants.whereType<Map>()) {
          final variantId = rawVariant['id']?.toString() ?? '';
          if (variantId.isEmpty) continue;
          _priceControllers[variantId] = TextEditingController(
            text: '${rawVariant['price'] ?? ''}',
          );
          _stockControllers[variantId] = TextEditingController(
            text: '${rawVariant['quantity'] ?? 0}',
          );
        }
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _saveVariant({
    required String variantId,
    required double? mrp,
  }) async {
    final priceCtrl = _priceControllers[variantId];
    final stockCtrl = _stockControllers[variantId];
    if (priceCtrl == null || stockCtrl == null) return;

    final resolvedPrice = _resolvePriceValue(priceCtrl.text.trim(), mrp);
    final qty = int.tryParse(stockCtrl.text.trim());
    if (resolvedPrice == null || resolvedPrice <= 0 || qty == null || qty < 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Enter a valid price and stock value')),
      );
      return;
    }

    setState(() => _saving = true);
    try {
      final res = await _api.updateVendorVariantStock(
        vendorId: widget.vendorId,
        variantId: variantId,
        quantity: qty,
        price: resolvedPrice,
        mrp: mrp,
      );
      if (!mounted) return;
      if (res['success'] == true) {
        setState(() {
          for (final product in _products) {
            final variants = (product['variants'] as List?) ?? const [];
            for (final rawVariant in variants.whereType<Map>()) {
              if (rawVariant['id']?.toString() == variantId) {
                rawVariant['price'] = resolvedPrice;
                rawVariant['quantity'] = qty;
                if (mrp != null) rawVariant['mrp'] = mrp;
              }
            }
          }
        });
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Variant updated successfully')),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              (res['error'] ?? res['message'] ?? 'Unable to update variant')
                  .toString(),
            ),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final filteredProducts = _products.where((p) {
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
            'Edit Products',
            style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 6),
          const Text(
            'Adjust selling price and stock directly for each variant.',
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
              hintText: 'Search by product or brand',
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
          const SizedBox(height: 12),
          if (_loading)
            const Padding(
              padding: EdgeInsets.only(top: 24),
              child: Center(child: CircularProgressIndicator()),
            )
          else if (filteredProducts.isEmpty)
            const Padding(
              padding: EdgeInsets.only(top: 24),
              child: Center(child: Text('No products found for this search.')),
            )
          else
            ...filteredProducts.map((product) {
              final variants = (product['variants'] as List?) ?? const [];
              return Container(
                margin: const EdgeInsets.only(bottom: 12),
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
                      (product['name'] ?? 'Unnamed Product').toString(),
                      style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '${product['category_name'] ?? ''} • ${product['brand_name'] ?? ''}',
                      style: const TextStyle(
                        fontSize: 12,
                        color: Color(0xFF64748B),
                      ),
                    ),
                    const SizedBox(height: 10),
                    ...variants.whereType<Map>().map((variant) {
                      final variantId = variant['id']?.toString() ?? '';
                      final priceCtrl = _priceControllers[variantId];
                      final stockCtrl = _stockControllers[variantId];
                      if (priceCtrl == null || stockCtrl == null) {
                        return const SizedBox.shrink();
                      }
                      final mrp = double.tryParse('${variant['mrp'] ?? 0}');
                      final size = (variant['size'] ?? '-').toString();
                      final color = (variant['color'] ?? '-').toString();
                      return Container(
                        margin: const EdgeInsets.only(bottom: 8),
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF8FAFC),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: const Color(0xFFE2E8F0)),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              '$size • $color',
                              style: const TextStyle(
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                            const SizedBox(height: 8),
                            Row(
                              children: [
                                Expanded(
                                  child: TextField(
                                    controller: priceCtrl,
                                    keyboardType: TextInputType.text,
                                    decoration: const InputDecoration(
                                      labelText: 'Price / %',
                                      hintText: '499 or 40%',
                                      isDense: true,
                                      border: OutlineInputBorder(),
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: TextField(
                                    controller: stockCtrl,
                                    keyboardType: TextInputType.number,
                                    decoration: const InputDecoration(
                                      labelText: 'Stock',
                                      isDense: true,
                                      border: OutlineInputBorder(),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 8),
                            Align(
                              alignment: Alignment.centerRight,
                              child: FilledButton(
                                onPressed: _saving || variantId.isEmpty
                                    ? null
                                    : () => _saveVariant(
                                        variantId: variantId,
                                        mrp: mrp,
                                      ),
                                child: const Text('Save'),
                              ),
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

  Future<void> _setVariantPrice({
    required String variantId,
    required int qty,
    required String rawValue,
    required double? mrp,
  }) async {
    final resolvedPrice = _resolvePriceValue(rawValue, mrp);
    if (resolvedPrice == null || resolvedPrice <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Enter a valid selling price or percentage'),
        ),
      );
      return;
    }

    setState(() => _updating = true);
    try {
      final res = await _api.updateVendorVariantStock(
        vendorId: widget.vendorId,
        variantId: variantId,
        quantity: qty,
        price: resolvedPrice,
        mrp: mrp,
      );
      if (!mounted) return;

      if (res['success'] == true) {
        setState(() {
          for (final p in _products) {
            final variants = (p['variants'] as List?) ?? const [];
            for (final v in variants.whereType<Map>()) {
              if (v['id']?.toString() == variantId) {
                v['price'] = resolvedPrice;
                if (mrp != null) v['mrp'] = mrp;
              }
            }
          }
        });
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Price updated for this variant')),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              (res['error'] ?? res['message'] ?? 'Price update failed')
                  .toString(),
            ),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _updating = false);
    }
  }

  Future<void> _openSetPriceDialog({
    required String variantId,
    required int currentQty,
    required double currentPrice,
    required double? mrp,
  }) async {
    final ctrl = TextEditingController(
      text: currentPrice > 0 ? currentPrice.toStringAsFixed(0) : '',
    );
    final result = await showDialog<String>(
      context: context,
      builder: (ctx) {
        return AlertDialog(
          title: const Text('Set Selling Price'),
          content: TextField(
            controller: ctrl,
            keyboardType: TextInputType.text,
            decoration: const InputDecoration(
              labelText: 'Price or %',
              hintText: '499 or 40%',
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
                final value = ctrl.text.trim();
                if (value.isNotEmpty) {
                  Navigator.of(ctx).pop(value);
                }
              },
              child: const Text('Update'),
            ),
          ],
        );
      },
    );
    ctrl.dispose();

    if (result != null && result.isNotEmpty) {
      await _setVariantPrice(
        variantId: variantId,
        qty: currentQty,
        rawValue: result,
        mrp: mrp,
      );
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
                      final price = double.tryParse('${v['price'] ?? 0}') ?? 0;
                      final mrp = double.tryParse('${v['mrp'] ?? 0}');
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
                                  const SizedBox(height: 2),
                                  Text(
                                    'Price: ₹${price.toStringAsFixed(0)}',
                                    style: const TextStyle(
                                      fontSize: 11,
                                      color: Color(0xFF0F766E),
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
                                  : () => _openSetPriceDialog(
                                      variantId: variantId,
                                      currentQty: qty,
                                      currentPrice: price,
                                      mrp: mrp,
                                    ),
                              child: const Text('Price'),
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
    String reasonText = '';
    final reason = await showDialog<String>(
      context: context,
      builder: (ctx) {
        return AlertDialog(
          title: const Text('Reject Order'),
          content: TextField(
            maxLines: 2,
            autofocus: true,
            onChanged: (value) => reasonText = value,
            onSubmitted: (value) => Navigator.of(ctx).pop(value.trim()),
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
              onPressed: () => Navigator.of(ctx).pop(reasonText.trim()),
              child: const Text('Reject'),
            ),
          ],
        );
      },
    );
    if (reason == null || reason.trim().isEmpty) return;
    await _updateOrderStatus(
      orderId: orderId,
      status: 'cancelled',
      cancelReason: reason.trim(),
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
