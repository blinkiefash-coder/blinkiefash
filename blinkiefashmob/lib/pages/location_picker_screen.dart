import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:geolocator/geolocator.dart';
import 'package:geocoding/geocoding.dart';
import 'package:http/http.dart' as http;
import '../widgets/bf_loader.dart';

/// Result returned when user confirms a location.
class PickedAddress {
  const PickedAddress({
    required this.addressLine,
    required this.city,
    required this.pincode,
    this.lat,
    this.lng,
    this.addressType = 'home',
  });
  final String addressLine;
  final String city;
  final String pincode;
  final double? lat;
  final double? lng;
  final String addressType;
}

/// Blinkit-style address picker.
class LocationPickerScreen extends StatefulWidget {
  const LocationPickerScreen({super.key});

  @override
  State<LocationPickerScreen> createState() => _LocationPickerScreenState();
}

class _LocationPickerScreenState extends State<LocationPickerScreen> {
  // ── Step control ──────────────────────────────────────────────────────────
  // Step 0 = search/detect, Step 1 = map pin confirm, Step 2 = fill details
  int _step = 0;

  // ── Search ────────────────────────────────────────────────────────────────
  final TextEditingController _searchCtrl = TextEditingController();
  final FocusNode _searchFocus = FocusNode();
  List<Map<String, dynamic>> _suggestions = [];
  Timer? _debounce;
  bool _searchLoading = false;

  // ── GPS ───────────────────────────────────────────────────────────────────
  bool _detectingLocation = false;
  String? _detectError;

  // ── Map pin (Step 1) ──────────────────────────────────────────────────────
  final MapController _mapController = MapController();
  LatLng _pinCenter = const LatLng(20.2961, 85.8245); // default: Bhubaneswar
  bool _reverseGeocoding = false;

  // ── Confirmed location ───────────────────────────────────────────────────
  String _confirmedArea = '';
  String _confirmedCity = '';
  String _confirmedPincode = '';
  double? _confirmedLat;
  double? _confirmedLng;

  // ── Details form ─────────────────────────────────────────────────────────
  final _formKey = GlobalKey<FormState>();
  final TextEditingController _flatCtrl = TextEditingController();
  final TextEditingController _landmarkCtrl = TextEditingController();
  String _addressType = 'home'; // home | work | other

  @override
  void dispose() {
    _searchCtrl.dispose();
    _searchFocus.dispose();
    _debounce?.cancel();
    _flatCtrl.dispose();
    _landmarkCtrl.dispose();
    _mapController.dispose();
    super.dispose();
  }

  // ── Nominatim search (OpenStreetMap, no API key) ─────────────────────────
  Future<void> _onSearchChanged(String q) async {
    _debounce?.cancel();
    if (q.trim().length < 3) {
      setState(() => _suggestions = []);
      return;
    }
    _debounce = Timer(const Duration(milliseconds: 450), () async {
      if (!mounted) return;
      setState(() => _searchLoading = true);
      try {
        final uri = Uri.parse(
          'https://nominatim.openstreetmap.org/search'
          '?q=${Uri.encodeComponent(q)}'
          '&format=json&addressdetails=1&limit=6&countrycodes=in',
        );
        final res = await http.get(
          uri,
          headers: {'User-Agent': 'BlinkieFashApp/1.0'},
        );
        if (!mounted) return;
        final list = jsonDecode(res.body) as List;
        setState(() {
          _suggestions = list.cast<Map<String, dynamic>>();
          _searchLoading = false;
        });
      } catch (_) {
        if (!mounted) return;
        setState(() => _searchLoading = false);
      }
    });
  }

  // ── GPS detect ───────────────────────────────────────────────────────────
  Future<void> _detectCurrentLocation() async {
    setState(() {
      _detectingLocation = true;
      _detectError = null;
    });
    try {
      bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        setState(() {
          _detectingLocation = false;
          _detectError = 'Location services are disabled.';
        });
        return;
      }
      LocationPermission perm = await Geolocator.checkPermission();
      if (perm == LocationPermission.denied) {
        perm = await Geolocator.requestPermission();
      }
      if (perm == LocationPermission.deniedForever ||
          perm == LocationPermission.denied) {
        setState(() {
          _detectingLocation = false;
          _detectError = 'Location permission denied.';
        });
        return;
      }
      final pos = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
      );
      final placemarks = await placemarkFromCoordinates(
        pos.latitude,
        pos.longitude,
      );
      if (!mounted) return;
      if (placemarks.isNotEmpty) {
        final p = placemarks.first;
        _setLocation(
          area: [
            p.subLocality,
            p.locality,
          ].where((s) => s != null && s.isNotEmpty).join(', '),
          city: p.administrativeArea ?? p.locality ?? '',
          pincode: p.postalCode ?? '',
          lat: pos.latitude,
          lng: pos.longitude,
        );
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _detectingLocation = false;
        _detectError = 'Could not detect location. Try searching.';
      });
    }
  }

  // ── Select from suggestion ───────────────────────────────────────────────
  void _selectSuggestion(Map<String, dynamic> item) {
    final addr = item['address'] as Map<String, dynamic>? ?? {};
    final area = [
      addr['neighbourhood'],
      addr['suburb'],
      addr['quarter'],
    ].whereType<String>().where((s) => s.isNotEmpty).join(', ');
    final city =
        (addr['city'] ??
                addr['state_district'] ??
                addr['county'] ??
                addr['state'] ??
                '')
            .toString();
    final pincode = (addr['postcode'] ?? '').toString();
    final lat = double.tryParse(item['lat']?.toString() ?? '');
    final lng = double.tryParse(item['lon']?.toString() ?? '');
    _setLocation(area: area, city: city, pincode: pincode, lat: lat, lng: lng);
  }

  void _setLocation({
    required String area,
    required String city,
    required String pincode,
    double? lat,
    double? lng,
  }) {
    setState(() {
      _confirmedArea = area.trim();
      _confirmedCity = city.trim();
      _confirmedPincode = pincode.trim();
      _confirmedLat = lat;
      _confirmedLng = lng;
      _suggestions = [];
      _searchCtrl.text = area.isNotEmpty ? area : city;
      _detectingLocation = false;
      // Go to map pin step
      if (lat != null && lng != null) {
        _pinCenter = LatLng(lat, lng);
      }
      _step = 1;
    });
    // Move map after frame renders
    if (lat != null && lng != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        _mapController.move(LatLng(lat, lng), 16);
      });
    }
  }

  // ── Reverse geocode when pin moves on map ────────────────────────────────
  Timer? _reverseDebounce;
  void _onMapMoved(MapCamera camera, bool hasGesture) {
    if (!hasGesture) return;
    _pinCenter = camera.center;
    _reverseDebounce?.cancel();
    _reverseDebounce = Timer(const Duration(milliseconds: 600), () async {
      if (!mounted) return;
      setState(() => _reverseGeocoding = true);
      try {
        final placemarks = await placemarkFromCoordinates(
          _pinCenter.latitude,
          _pinCenter.longitude,
        );
        if (!mounted) return;
        if (placemarks.isNotEmpty) {
          final p = placemarks.first;
          final label = [
            p.subLocality,
            p.locality,
          ].where((s) => s != null && s.isNotEmpty).join(', ');
          setState(() {
            _confirmedArea = label;
            _confirmedCity =
                p.administrativeArea ?? p.locality ?? _confirmedCity;
            _confirmedPincode = p.postalCode ?? _confirmedPincode;
            _confirmedLat = _pinCenter.latitude;
            _confirmedLng = _pinCenter.longitude;
            // Keep search bar in sync with the dragged pin location
            if (!_searchFocus.hasFocus) {
              _searchCtrl.text = label;
              _suggestions = [];
            }
          });
        }
      } catch (_) {
        // keep previous label
      } finally {
        if (mounted) setState(() => _reverseGeocoding = false);
      }
    });
  }

  void _confirmMapPin() {
    setState(() {
      _confirmedLat = _pinCenter.latitude;
      _confirmedLng = _pinCenter.longitude;
      _step = 2;
    });
  }

  // ── Confirm final address ─────────────────────────────────────────────────
  void _confirm() {
    if (!_formKey.currentState!.validate()) return;
    final flat = _flatCtrl.text.trim();
    final landmark = _landmarkCtrl.text.trim();

    final addressLine = [
      flat,
      if (_confirmedArea.isNotEmpty) _confirmedArea,
      if (landmark.isNotEmpty) 'Near $landmark',
    ].join(', ');

    Navigator.of(context).pop(
      PickedAddress(
        addressLine: addressLine,
        city: _confirmedCity,
        pincode: _confirmedPincode,
        lat: _confirmedLat,
        lng: _confirmedLng,
        addressType: _addressType,
      ),
    );
  }

  // ── Build ─────────────────────────────────────────────────────────────────
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8F9FA),
      appBar: AppBar(
        backgroundColor: Colors.white,
        foregroundColor: const Color(0xFF0F172A),
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        title: Text(
          _step == 0
              ? 'Enter your location'
              : _step == 1
              ? 'Pin your exact location'
              : 'Confirm location',
          style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 17),
        ),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () {
            if (_step == 2) {
              setState(() => _step = 1);
            } else if (_step == 1) {
              setState(() => _step = 0);
            } else {
              Navigator.of(context).pop();
            }
          },
        ),
      ),
      body: _step == 0
          ? _buildSearchStep()
          : _step == 1
          ? _buildMapPinStep()
          : _buildDetailsStep(),
    );
  }

  // ── Step 1: Map pin confirmation ──────────────────────────────────────────
  Widget _buildMapPinStep() {
    return Stack(
      children: [
        FlutterMap(
          mapController: _mapController,
          options: MapOptions(
            initialCenter: _pinCenter,
            initialZoom: 16,
            onPositionChanged: (camera, hasGesture) =>
                _onMapMoved(camera, hasGesture),
          ),
          children: [
            TileLayer(
              urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
              userAgentPackageName: 'com.blinkiefash.mob',
            ),
          ],
        ),
        // Fixed center pin
        const Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.location_on, color: Color(0xFF16A34A), size: 44),
              SizedBox(height: 22), // visual offset below icon center
            ],
          ),
        ),
        // Search bar + suggestions at top (interactive, replaces read-only label)
        Positioned(
          top: 16,
          left: 16,
          right: 16,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(12),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.1),
                      blurRadius: 8,
                    ),
                  ],
                ),
                child: TextField(
                  controller: _searchCtrl,
                  focusNode: _searchFocus,
                  onChanged: _onSearchChanged,
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                  ),
                  decoration: InputDecoration(
                    hintText: 'Search area, street, locality…',
                    hintStyle: const TextStyle(
                      color: Color(0xFF9CA3AF),
                      fontWeight: FontWeight.normal,
                      fontSize: 13,
                    ),
                    prefixIcon: const Icon(
                      Icons.search,
                      color: Color(0xFF6B7280),
                      size: 20,
                    ),
                    suffixIcon: _searchLoading
                        ? const Padding(
                            padding: EdgeInsets.all(12),
                            child: SizedBox(
                              width: 16,
                              height: 16,
                              child: BfSpinner(size: 16),
                            ),
                          )
                        : _searchCtrl.text.isNotEmpty
                        ? IconButton(
                            icon: const Icon(
                              Icons.close,
                              size: 18,
                              color: Color(0xFF6B7280),
                            ),
                            onPressed: () {
                              _searchCtrl.clear();
                              setState(() => _suggestions = []);
                            },
                          )
                        : _reverseGeocoding
                        ? const Padding(
                            padding: EdgeInsets.all(12),
                            child: SizedBox(
                              width: 16,
                              height: 16,
                              child: BfSpinner(size: 16),
                            ),
                          )
                        : const Icon(
                            Icons.location_on,
                            color: Color(0xFF16A34A),
                            size: 20,
                          ),
                    filled: true,
                    fillColor: Colors.white,
                    border: OutlineInputBorder(
                      borderSide: BorderSide.none,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    contentPadding: const EdgeInsets.symmetric(vertical: 13),
                  ),
                ),
              ),
              if (_suggestions.isNotEmpty)
                Container(
                  margin: const EdgeInsets.only(top: 4),
                  constraints: const BoxConstraints(maxHeight: 220),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(12),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.1),
                        blurRadius: 8,
                      ),
                    ],
                  ),
                  child: ListView(
                    shrinkWrap: true,
                    padding: const EdgeInsets.symmetric(vertical: 6),
                    children: _suggestions.map((s) {
                      final display = s['display_name']?.toString() ?? '';
                      final parts = display.split(',');
                      final title = parts.isNotEmpty
                          ? parts.first.trim()
                          : display;
                      final sub = parts.length > 1
                          ? parts.skip(1).take(2).join(',').trim()
                          : '';
                      return ListTile(
                        leading: const Icon(
                          Icons.location_on_outlined,
                          color: Color(0xFF6B7280),
                          size: 18,
                        ),
                        title: Text(
                          title,
                          style: const TextStyle(
                            fontWeight: FontWeight.w600,
                            fontSize: 13,
                          ),
                        ),
                        subtitle: sub.isNotEmpty
                            ? Text(
                                sub,
                                style: const TextStyle(
                                  fontSize: 11,
                                  color: Color(0xFF6B7280),
                                ),
                                overflow: TextOverflow.ellipsis,
                              )
                            : null,
                        dense: true,
                        onTap: () {
                          _selectSuggestion(s);
                          FocusScope.of(context).unfocus();
                        },
                      );
                    }).toList(),
                  ),
                ),
            ],
          ),
        ),
        // Confirm button at bottom
        Positioned(
          bottom: 0,
          left: 0,
          right: 0,
          child: Container(
            color: Colors.white,
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Move map to pin exact delivery location',
                  style: TextStyle(color: Color(0xFF6B7280), fontSize: 12),
                ),
                const SizedBox(height: 10),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(
                    onPressed: _confirmMapPin,
                    icon: const Icon(Icons.check_circle_outline),
                    label: const Text(
                      'Confirm Location',
                      style: TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 15,
                      ),
                    ),
                    style: FilledButton.styleFrom(
                      backgroundColor: const Color(0xFF16A34A),
                      minimumSize: const Size.fromHeight(50),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  // ── Step 0: Search / GPS ──────────────────────────────────────────────────
  Widget _buildSearchStep() {
    return Column(
      children: [
        // Search bar
        Container(
          color: Colors.white,
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
          child: TextField(
            controller: _searchCtrl,
            focusNode: _searchFocus,
            onChanged: _onSearchChanged,
            decoration: InputDecoration(
              hintText: 'Search for area, street, locality…',
              hintStyle: const TextStyle(
                color: Color(0xFF9CA3AF),
                fontSize: 14,
              ),
              prefixIcon: const Icon(Icons.search, color: Color(0xFF6B7280)),
              suffixIcon: _searchLoading
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: Padding(
                        padding: EdgeInsets.all(12),
                        child: BfSpinner(),
                      ),
                    )
                  : _searchCtrl.text.isNotEmpty
                  ? IconButton(
                      icon: const Icon(
                        Icons.close,
                        size: 18,
                        color: Color(0xFF6B7280),
                      ),
                      onPressed: () {
                        _searchCtrl.clear();
                        setState(() => _suggestions = []);
                      },
                    )
                  : null,
              filled: true,
              fillColor: const Color(0xFFF1F5F9),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(14),
                borderSide: BorderSide.none,
              ),
              contentPadding: const EdgeInsets.symmetric(vertical: 13),
            ),
          ),
        ),

        // Error
        if (_detectError != null)
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 0),
            child: Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: const Color(0xFFFEF2F2),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Row(
                children: [
                  const Icon(
                    Icons.error_outline,
                    color: Color(0xFFDC2626),
                    size: 16,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      _detectError!,
                      style: const TextStyle(
                        color: Color(0xFFDC2626),
                        fontSize: 13,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),

        Expanded(
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              // Detect location button
              GestureDetector(
                onTap: _detectingLocation ? null : _detectCurrentLocation,
                child: Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: const Color(0xFFD1FAE5)),
                  ),
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: const Color(0xFFECFDF5),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: _detectingLocation
                            ? const SizedBox(
                                width: 22,
                                height: 22,
                                child: BfSpinner(size: 22),
                              )
                            : const Icon(
                                Icons.my_location,
                                color: Color(0xFF16A34A),
                                size: 22,
                              ),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              _detectingLocation
                                  ? 'Detecting location…'
                                  : 'Use current location',
                              style: const TextStyle(
                                fontWeight: FontWeight.w700,
                                color: Color(0xFF166534),
                              ),
                            ),
                            const SizedBox(height: 2),
                            const Text(
                              'Using GPS',
                              style: TextStyle(
                                fontSize: 12,
                                color: Color(0xFF6B7280),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const Icon(Icons.chevron_right, color: Color(0xFF16A34A)),
                    ],
                  ),
                ),
              ),

              // Suggestions
              if (_suggestions.isNotEmpty) ...[
                const SizedBox(height: 16),
                const Text(
                  'Search results',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF6B7280),
                  ),
                ),
                const SizedBox(height: 8),
                ..._suggestions.map((s) {
                  final display = s['display_name']?.toString() ?? '';
                  final parts = display.split(',');
                  final title = parts.isNotEmpty ? parts.first.trim() : display;
                  final sub = parts.length > 1
                      ? parts.skip(1).take(3).join(',').trim()
                      : '';
                  return GestureDetector(
                    onTap: () => _selectSuggestion(s),
                    child: Container(
                      margin: const EdgeInsets.only(bottom: 8),
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Row(
                        children: [
                          const Icon(
                            Icons.location_on_outlined,
                            color: Color(0xFF6B7280),
                            size: 20,
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  title,
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                                if (sub.isNotEmpty)
                                  Text(
                                    sub,
                                    style: const TextStyle(
                                      fontSize: 12,
                                      color: Color(0xFF6B7280),
                                    ),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  );
                }),
              ] else if (_searchCtrl.text.trim().length >= 3 &&
                  !_searchLoading &&
                  _suggestions.isEmpty) ...[
                const SizedBox(height: 24),
                const Center(
                  child: Text(
                    'No results found. Try a different search.',
                    style: TextStyle(color: Color(0xFF9CA3AF)),
                  ),
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }

  // ── Step 1: Fill details form ─────────────────────────────────────────────
  Widget _buildDetailsStep() {
    return SingleChildScrollView(
      padding: EdgeInsets.only(
        left: 16,
        right: 16,
        top: 16,
        bottom: MediaQuery.of(context).viewInsets.bottom + 16,
      ),
      child: Form(
        key: _formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Selected location chip
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: const Color(0xFFECFDF5),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: const Color(0xFFBBF7D0)),
              ),
              child: Row(
                children: [
                  const Icon(
                    Icons.location_on,
                    color: Color(0xFF16A34A),
                    size: 22,
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          _confirmedArea.isNotEmpty
                              ? _confirmedArea
                              : _confirmedCity,
                          style: const TextStyle(
                            fontWeight: FontWeight.w700,
                            color: Color(0xFF166534),
                          ),
                        ),
                        Text(
                          '$_confirmedCity${_confirmedPincode.isNotEmpty ? " - $_confirmedPincode" : ""}',
                          style: const TextStyle(
                            fontSize: 13,
                            color: Color(0xFF4B7C5E),
                          ),
                        ),
                      ],
                    ),
                  ),
                  TextButton(
                    onPressed: () => setState(() => _step = 1),
                    child: const Text(
                      'Change',
                      style: TextStyle(
                        color: Color(0xFF16A34A),
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 20),
            // Address type selector (Home / Work / Other)
            const Text(
              'Save address as',
              style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                _typeChip('home', Icons.home_outlined, 'Home'),
                const SizedBox(width: 10),
                _typeChip('work', Icons.work_outline, 'Work'),
                const SizedBox(width: 10),
                _typeChip('other', Icons.location_on_outlined, 'Other'),
              ],
            ),
            const SizedBox(height: 20),
            const Text(
              'Complete your address',
              style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16),
            ),
            const SizedBox(height: 4),
            const Text(
              'Add flat / house number and landmark',
              style: TextStyle(color: Color(0xFF6B7280), fontSize: 13),
            ),
            const SizedBox(height: 16),

            // Flat / House / Floor
            TextFormField(
              controller: _flatCtrl,
              textCapitalization: TextCapitalization.words,
              decoration: _deco(
                label: 'Flat / House No. / Floor',
                hint: 'e.g. 201, 3rd Floor',
                icon: Icons.home_outlined,
              ),
              validator: (v) => (v?.trim().isEmpty ?? true)
                  ? 'Please enter flat / house number'
                  : null,
            ),
            const SizedBox(height: 12),

            // City (pre-filled, editable)
            TextFormField(
              initialValue: _confirmedCity,
              textCapitalization: TextCapitalization.words,
              decoration: _deco(
                label: 'City',
                hint: 'City name',
                icon: Icons.location_city_outlined,
              ),
              onChanged: (v) => _confirmedCity = v,
              validator: (v) => (v?.trim().isEmpty ?? true) ? 'Required' : null,
            ),
            const SizedBox(height: 12),

            // Pincode (pre-filled, editable)
            TextFormField(
              initialValue: _confirmedPincode,
              keyboardType: TextInputType.number,
              maxLength: 6,
              decoration: _deco(
                label: 'Pincode',
                hint: '6-digit pincode',
                icon: Icons.pin_outlined,
              ),
              onChanged: (v) => _confirmedPincode = v,
              validator: (v) {
                if (v?.trim().isEmpty ?? true) return 'Required';
                if ((v?.trim().length ?? 0) != 6) {
                  return 'Enter valid 6-digit pincode';
                }
                return null;
              },
            ),
            const SizedBox(height: 12),

            // Landmark (optional)
            TextFormField(
              controller: _landmarkCtrl,
              textCapitalization: TextCapitalization.sentences,
              decoration: _deco(
                label: 'Landmark (optional)',
                hint: 'e.g. Opposite city mall',
                icon: Icons.flag_outlined,
              ),
            ),

            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                style: FilledButton.styleFrom(
                  backgroundColor: const Color(0xFF16A34A),
                  minimumSize: const Size.fromHeight(52),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                  ),
                ),
                onPressed: _confirm,
                child: const Text(
                  'Save Address',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
                ),
              ),
            ),
            const SizedBox(height: 20),
          ],
        ),
      ),
    );
  }

  Widget _typeChip(String type, IconData icon, String label) {
    final selected = _addressType == type;
    return GestureDetector(
      onTap: () => setState(() => _addressType = type),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        decoration: BoxDecoration(
          color: selected ? const Color(0xFFECFDF5) : Colors.white,
          borderRadius: BorderRadius.circular(24),
          border: Border.all(
            color: selected ? const Color(0xFF16A34A) : const Color(0xFFD1D5DB),
            width: selected ? 2 : 1,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              icon,
              size: 18,
              color: selected
                  ? const Color(0xFF16A34A)
                  : const Color(0xFF6B7280),
            ),
            const SizedBox(width: 6),
            Text(
              label,
              style: TextStyle(
                fontWeight: FontWeight.w600,
                fontSize: 13,
                color: selected
                    ? const Color(0xFF166534)
                    : const Color(0xFF374151),
              ),
            ),
          ],
        ),
      ),
    );
  }

  InputDecoration _deco({
    required String label,
    required String hint,
    required IconData icon,
  }) => InputDecoration(
    labelText: label,
    hintText: hint,
    counterText: '',
    prefixIcon: Icon(icon, color: const Color(0xFF6B7280), size: 20),
    filled: true,
    fillColor: Colors.white,
    labelStyle: const TextStyle(color: Color(0xFF6B7280)),
    border: OutlineInputBorder(
      borderRadius: BorderRadius.circular(13),
      borderSide: const BorderSide(color: Color(0xFFE5E7EB)),
    ),
    enabledBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(13),
      borderSide: const BorderSide(color: Color(0xFFE5E7EB)),
    ),
    focusedBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(13),
      borderSide: const BorderSide(color: Color(0xFF16A34A), width: 2),
    ),
    contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
  );
}
