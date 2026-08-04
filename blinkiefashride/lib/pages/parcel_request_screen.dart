import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_ringtone_player/flutter_ringtone_player.dart';

import '../api_service.dart';

/// Single-request, Uber-style popup for one nearby parcel delivery request.
/// Shows distance + fare, pickup/drop, and lets the rider accept or reject.
class ParcelRequestScreen extends StatefulWidget {
  const ParcelRequestScreen({
    super.key,
    required this.parcel,
    required this.riderId,
    required this.riderName,
    required this.riderPhone,
    this.riderLat,
    this.riderLng,
  });

  final Map<String, dynamic> parcel;
  final String riderId;
  final String riderName;
  final String riderPhone;
  final double? riderLat;
  final double? riderLng;

  @override
  State<ParcelRequestScreen> createState() => _ParcelRequestScreenState();
}

class _ParcelRequestScreenState extends State<ParcelRequestScreen>
    with SingleTickerProviderStateMixin {
  final ApiService _api = ApiService();
  late AnimationController _timerController;
  int _seconds = 25;
  Timer? _vibrateTimer;
  bool _accepting = false;

  @override
  void initState() {
    super.initState();
    _startAlert();
    _timerController =
        AnimationController(vsync: this, duration: const Duration(seconds: 25))
          ..addListener(() {
            if (!mounted) return;
            setState(() {
              _seconds = (25 * (1 - _timerController.value)).ceil().clamp(
                0,
                25,
              );
            });
            if (_timerController.isCompleted) {
              Navigator.of(context).pop(false);
            }
          })
          ..forward();
  }

  void _startAlert() {
    try {
      FlutterRingtonePlayer().playAlarm(
        volume: 1.0,
        looping: true,
        asAlarm: true,
      );
    } catch (_) {}
    HapticFeedback.vibrate();
    _vibrateTimer = Timer.periodic(
      const Duration(milliseconds: 800),
      (_) => HapticFeedback.vibrate(),
    );
  }

  void _stopAlert() {
    try {
      FlutterRingtonePlayer().stop();
    } catch (_) {}
    _vibrateTimer?.cancel();
    _vibrateTimer = null;
  }

  @override
  void dispose() {
    _stopAlert();
    _timerController.dispose();
    super.dispose();
  }

  Future<void> _accept() async {
    final requestId = widget.parcel['id'] as String? ?? '';
    if (requestId.isEmpty || _accepting) return;
    _stopAlert();
    _timerController.stop();
    setState(() => _accepting = true);

    try {
      final result = await _api.acceptParcelRequest(
        requestId,
        riderId: widget.riderId,
        riderName: widget.riderName,
        riderPhone: widget.riderPhone,
        riderLat: widget.riderLat,
        riderLng: widget.riderLng,
      );

      if (!mounted) return;

      if (result?['success'] == true) {
        final otp = result?['request']?['otp_code'] as String? ?? 'N/A';
        await showDialog<void>(
          context: context,
          barrierDismissible: false,
          builder: (ctx) => AlertDialog(
            title: const Text('Parcel Accepted! \u2713'),
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
              ],
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(ctx),
                child: const Text('OK'),
              ),
            ],
          ),
        );
        if (!mounted) return;
        Navigator.of(context).pop(true);
      } else {
        setState(() => _accepting = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              (result?['message'] ?? 'Parcel no longer available') as String,
            ),
            backgroundColor: const Color(0xFFEF4444),
          ),
        );
        Navigator.of(context).pop(false);
      }
    } catch (e) {
      if (!mounted) return;
      setState(() => _accepting = false);
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Error: $e')));
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = widget.parcel;
    final requestId = (p['id'] ?? '') as String;
    final shortId = requestId.length > 8
        ? requestId.substring(0, 8).toUpperCase()
        : requestId.toUpperCase();
    final fare = p['estimated_fare'];
    final distance = p['distance_from_rider_km'] ?? p['distance_km'];
    final fareStr = fare != null ? '\u20B9$fare' : '\u20B9--';
    final distStr = distance != null
        ? '${(distance as num).toStringAsFixed(1)} km'
        : '-- km';
    final pickupText = (p['pickup_text'] ?? 'Pickup location') as String;
    final dropText = (p['drop_text'] ?? 'Drop location') as String;

    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      body: SafeArea(
        child: Stack(
          children: [
            Container(
              height: MediaQuery.of(context).size.height * 0.42,
              color: const Color(0xFF1E293B),
              child: const Center(
                child: Icon(
                  Icons.local_shipping_outlined,
                  color: Colors.white24,
                  size: 80,
                ),
              ),
            ),
            Positioned(
              top: 12,
              left: 14,
              right: 14,
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 14,
                  vertical: 10,
                ),
                decoration: BoxDecoration(
                  color: const Color(0xFF1E293B),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Row(
                  children: [
                    Icon(Icons.notifications, color: Colors.amber, size: 20),
                    SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'New Parcel Request',
                            style: TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.w700,
                              fontSize: 13,
                            ),
                          ),
                          Text(
                            'You have a new parcel delivery request!',
                            style: TextStyle(
                              color: Colors.white60,
                              fontSize: 12,
                            ),
                          ),
                        ],
                      ),
                    ),
                    Text(
                      'now',
                      style: TextStyle(color: Colors.white54, fontSize: 11),
                    ),
                  ],
                ),
              ),
            ),
            Align(
              alignment: Alignment.bottomCenter,
              child: Container(
                decoration: const BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
                ),
                padding: const EdgeInsets.fromLTRB(20, 20, 20, 24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const SizedBox.shrink(),
                        const CircleAvatar(
                          radius: 28,
                          backgroundColor: Color(0xFFECFDF3),
                          child: Icon(
                            Icons.local_shipping_outlined,
                            color: Color(0xFF16A34A),
                            size: 28,
                          ),
                        ),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            Text(
                              '00:${_seconds.toString().padLeft(2, '0')}',
                              style: const TextStyle(
                                fontSize: 22,
                                fontWeight: FontWeight.w900,
                                color: Color(0xFF0F172A),
                              ),
                            ),
                            const Text(
                              'Time left',
                              style: TextStyle(
                                color: Color(0xFF16A34A),
                                fontSize: 12,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    const Text(
                      'New Parcel Delivery',
                      style: TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    if (shortId.isNotEmpty)
                      Text(
                        '#$shortId',
                        style: const TextStyle(
                          color: Color(0xFF16A34A),
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    const SizedBox(height: 14),
                    Row(
                      children: [
                        const Icon(
                          Icons.radio_button_checked,
                          color: Color(0xFF16A34A),
                          size: 16,
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            'Pickup: $pickupText',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontWeight: FontWeight.w700,
                              fontSize: 14,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Row(
                      children: [
                        const Icon(
                          Icons.location_on,
                          color: Color(0xFFEF4444),
                          size: 16,
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            'Drop: $dropText',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontWeight: FontWeight.w700,
                              fontSize: 14,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 14),
                    Row(
                      children: [
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'Your Earning',
                              style: TextStyle(
                                color: Color(0xFF64748B),
                                fontSize: 12,
                              ),
                            ),
                            Text(
                              fareStr,
                              style: const TextStyle(
                                fontSize: 26,
                                fontWeight: FontWeight.w900,
                                color: Color(0xFF16A34A),
                              ),
                            ),
                          ],
                        ),
                        const Spacer(),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 10,
                            vertical: 6,
                          ),
                          decoration: BoxDecoration(
                            color: const Color(0xFFECFDF3),
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: Row(
                            children: [
                              const Icon(
                                Icons.route_outlined,
                                color: Color(0xFF16A34A),
                                size: 14,
                              ),
                              const SizedBox(width: 4),
                              Text(
                                distStr,
                                style: const TextStyle(
                                  color: Color(0xFF16A34A),
                                  fontWeight: FontWeight.w700,
                                  fontSize: 12,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    SizedBox(
                      width: double.infinity,
                      child: FilledButton(
                        onPressed: _accepting ? null : _accept,
                        style: FilledButton.styleFrom(
                          backgroundColor: const Color(0xFF16A34A),
                          minimumSize: const Size.fromHeight(50),
                        ),
                        child: _accepting
                            ? const SizedBox(
                                height: 20,
                                width: 20,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: Colors.white,
                                ),
                              )
                            : const Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Text(
                                    'Accept Parcel',
                                    style: TextStyle(
                                      fontSize: 16,
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                  SizedBox(width: 10),
                                  Icon(Icons.arrow_forward),
                                ],
                              ),
                      ),
                    ),
                    const SizedBox(height: 10),
                    SizedBox(
                      width: double.infinity,
                      child: OutlinedButton(
                        onPressed: _accepting
                            ? null
                            : () => Navigator.of(context).pop(false),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: const Color(0xFFEF4444),
                          side: const BorderSide(color: Color(0xFFEF4444)),
                          minimumSize: const Size.fromHeight(46),
                        ),
                        child: const Text(
                          'Reject',
                          style: TextStyle(fontWeight: FontWeight.w700),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
