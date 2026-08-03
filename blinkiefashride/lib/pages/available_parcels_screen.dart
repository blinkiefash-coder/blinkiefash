import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import '../api_service.dart';

/// Screen for riders to view and accept available parcel delivery requests
class AvailableParcelsScreen extends StatefulWidget {
  final String riderId;
  final String riderName;
  final String riderPhone;

  const AvailableParcelsScreen({
    super.key,
    required this.riderId,
    required this.riderName,
    required this.riderPhone,
  });

  @override
  State<AvailableParcelsScreen> createState() => _AvailableParcelsScreenState();
}

class _AvailableParcelsScreenState extends State<AvailableParcelsScreen> {
  final ApiService _api = ApiService();
  List<Map<String, dynamic>> _parcels = [];
  bool _loading = true;
  String? _error;
  String? _acceptingId;
  late Position _currentPosition;

  @override
  void initState() {
    super.initState();
    _init();
  }

  Future<void> _init() async {
    try {
      final perms = await Geolocator.requestPermission();
      if (perms == LocationPermission.denied ||
          perms == LocationPermission.deniedForever) {
        setState(() {
          _error = 'Location permission denied';
          _loading = false;
        });
        return;
      }

      _currentPosition = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
      );

      _fetchAvailableParcels();
    } catch (e) {
      setState(() {
        _error = 'Failed to initialize: $e';
        _loading = false;
      });
    }
  }

  Future<void> _fetchAvailableParcels() async {
    try {
      final parcels = await _api.getAvailableParcelRequests(
        _currentPosition.latitude,
        _currentPosition.longitude,
        radiusKm: 10,
      );
      if (mounted) {
        setState(() {
          _parcels = parcels;
          _loading = false;
          _error = null;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = 'Failed to load parcels: $e';
          _loading = false;
        });
      }
    }
  }

  Future<void> _acceptParcel(Map<String, dynamic> parcel) async {
    final requestId = parcel['id'] as String;

    setState(() => _acceptingId = requestId);

    try {
      final result = await _api.acceptParcelRequest(
        requestId,
        riderId: widget.riderId,
        riderName: widget.riderName,
        riderPhone: widget.riderPhone,
        riderLat: _currentPosition.latitude,
        riderLng: _currentPosition.longitude,
      );

      if (!mounted) return;

      if (result?['success'] == true) {
        final otp = result?['request']?['otp_code'] as String? ?? 'N/A';

        // Show OTP to rider
        showDialog(
          context: context,
          builder: (ctx) => AlertDialog(
            title: const Text('Parcel Accepted! ✓'),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'OTP generated for customer verification:',
                  style: TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                ),
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF0F9FF),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: const Color(0xFF0284C7)),
                  ),
                  child: Center(
                    child: Text(
                      otp,
                      style: const TextStyle(
                        fontSize: 32,
                        fontWeight: FontWeight.w900,
                        color: Color(0xFF0284C7),
                        letterSpacing: 3,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                Text(
                  'Pickup: ${parcel['pickup_text'] ?? 'N/A'}',
                  style: const TextStyle(fontSize: 12),
                ),
                const SizedBox(height: 4),
                Text(
                  'Dropoff: ${parcel['drop_text'] ?? 'N/A'}',
                  style: const TextStyle(fontSize: 12),
                ),
                const SizedBox(height: 4),
                Text(
                  'Fare: ₹${parcel['estimated_fare'] ?? 'N/A'}',
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF16A34A),
                  ),
                ),
              ],
            ),
            actions: [
              TextButton(
                onPressed: () {
                  Navigator.pop(ctx);
                  _fetchAvailableParcels();
                },
                child: const Text('OK'),
              ),
            ],
          ),
        );

        setState(() => _acceptingId = null);
      } else {
        setState(() => _acceptingId = null);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(result?['message'] ?? 'Failed to accept parcel'),
          ),
        );
      }
    } catch (e) {
      setState(() => _acceptingId = null);
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Error: $e')));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text('Available Parcels'),
        backgroundColor: Colors.white,
        elevation: 0,
        foregroundColor: const Color(0xFF0F172A),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(1),
          child: Container(color: const Color(0xFFE2E8F0), height: 1),
        ),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
          ? Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(_error!),
                  const SizedBox(height: 12),
                  ElevatedButton(onPressed: _init, child: const Text('Retry')),
                ],
              ),
            )
          : _parcels.isEmpty
          ? const Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.inbox_rounded, size: 48, color: Color(0xFFCBD5E1)),
                  SizedBox(height: 12),
                  Text(
                    'No parcels available nearby',
                    style: TextStyle(color: Color(0xFF64748B)),
                  ),
                ],
              ),
            )
          : RefreshIndicator(
              onRefresh: _fetchAvailableParcels,
              child: ListView.builder(
                padding: const EdgeInsets.all(12),
                itemCount: _parcels.length,
                itemBuilder: (ctx, idx) {
                  final parcel = _parcels[idx];
                  final isAccepting = _acceptingId == parcel['id'];

                  return Card(
                    margin: const EdgeInsets.only(bottom: 12),
                    child: Padding(
                      padding: const EdgeInsets.all(14),
                      child: Column(
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
                                  parcel['pickup_text'] ?? 'Pickup',
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(fontSize: 13),
                                ),
                              ),
                            ],
                          ),
                          const Padding(
                            padding: EdgeInsets.only(
                              left: 7,
                              top: 4,
                              bottom: 4,
                            ),
                            child: SizedBox(
                              height: 10,
                              child: VerticalDivider(
                                width: 1,
                                color: Color(0xFFCBD5E1),
                              ),
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
                                  parcel['drop_text'] ?? 'Dropoff',
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(fontSize: 13),
                                ),
                              ),
                            ],
                          ),

                          const SizedBox(height: 12),

                          // Distance, Fare, and Receiver
                          Row(
                            children: [
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      'Distance: ${parcel['distance_km'] ?? 'N/A'} km',
                                      style: const TextStyle(
                                        fontSize: 12,
                                        color: Color(0xFF64748B),
                                      ),
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      'Receiver: ${parcel['receiver_name'] ?? 'N/A'}',
                                      style: const TextStyle(
                                        fontSize: 12,
                                        color: Color(0xFF64748B),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.end,
                                children: [
                                  Text(
                                    '₹${parcel['estimated_fare'] ?? 'N/A'}',
                                    style: const TextStyle(
                                      fontSize: 18,
                                      fontWeight: FontWeight.w800,
                                      color: Color(0xFF16A34A),
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    '${parcel['receiver_phone'] ?? 'N/A'}',
                                    style: const TextStyle(
                                      fontSize: 11,
                                      color: Color(0xFF64748B),
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),

                          const SizedBox(height: 12),

                          // Accept button
                          SizedBox(
                            width: double.infinity,
                            child: FilledButton(
                              style: FilledButton.styleFrom(
                                backgroundColor: const Color(0xFF0284C7),
                                disabledBackgroundColor: const Color(
                                  0xFF0284C7,
                                ).withOpacity(0.6),
                              ),
                              onPressed: isAccepting
                                  ? null
                                  : () => _acceptParcel(parcel),
                              child: isAccepting
                                  ? const SizedBox(
                                      height: 20,
                                      width: 20,
                                      child: CircularProgressIndicator(
                                        strokeWidth: 2,
                                        valueColor:
                                            AlwaysStoppedAnimation<Color>(
                                              Colors.white,
                                            ),
                                      ),
                                    )
                                  : const Text('Accept Delivery'),
                            ),
                          ),
                        ],
                      ),
                    ),
                  );
                },
              ),
            ),
    );
  }
}
