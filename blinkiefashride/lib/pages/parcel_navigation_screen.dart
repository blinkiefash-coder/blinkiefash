import 'dart:async';
import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:image_picker/image_picker.dart';
import 'package:url_launcher/url_launcher.dart';

import '../api_service.dart';

// ─────────────────────────────────────────────────────────────────────────────
// Parcel delivery phases
// navigating → arrived → photoUpload → otpVerified → completed
// ─────────────────────────────────────────────────────────────────────────────
enum _Phase { navigating, arrived, photoUpload, otpVerified, completed }

// Helper function to safely parse coordinates
double _parseCoordinate(dynamic value) {
  if (value is num) return value.toDouble();
  if (value is String) return double.tryParse(value) ?? 0.0;
  return 0.0;
}

class ParcelNavigationScreen extends StatefulWidget {
  const ParcelNavigationScreen({super.key, required this.parcel});
  final Map<String, dynamic> parcel;

  @override
  State<ParcelNavigationScreen> createState() => _ParcelNavigationScreenState();
}

class _ParcelNavigationScreenState extends State<ParcelNavigationScreen> {
  static const _green = Color(0xFF16A34A);
  static const _orange = Color(0xFFEA580C);
  static const _blue = Color(0xFF0284C7);
  static const _red = Color(0xFFEF4444);

  final _api = ApiService();
  Timer? _locationTimer;
  Timer? _deliveryCountdownTimer;

  // 45-min delivery window for parcel
  int _deliverySecondsRemaining = 2700;

  _Phase _phase = _Phase.navigating;
  bool _loading = false;

  // Delivery OTP entry
  final _otpController = TextEditingController();
  String? _otpError;

  // Pre-delivery photo
  String? _deliveryPhotoUrl;
  bool _uploadingPhoto = false;
  bool _photoTaken = false;

  late String _requestId;
  late String _receiverName;
  late String _receiverPhone;
  late double _dropLat;
  late double _dropLng;

  @override
  void initState() {
    super.initState();
    _requestId = widget.parcel['id'] as String? ?? '';
    _receiverName = widget.parcel['receiver_name'] as String? ?? 'Recipient';
    _receiverPhone = widget.parcel['receiver_phone'] as String? ?? '';

    // Handle both string and num types for coordinates using helper function
    _dropLat = _parseCoordinate(widget.parcel['drop_lat']);
    _dropLng = _parseCoordinate(widget.parcel['drop_lng']);

    _api.loadToken().then((_) async {
      _startLocationStream();
    });
    _initDeliveryTimer();
  }

  @override
  void dispose() {
    _locationTimer?.cancel();
    _deliveryCountdownTimer?.cancel();
    _otpController.dispose();
    super.dispose();
  }

  void _startLocationStream() {
    _locationTimer = Timer.periodic(const Duration(seconds: 10), (_) async {
      try {
        final pos = await Geolocator.getCurrentPosition(
          desiredAccuracy: LocationAccuracy.high,
          timeLimit: const Duration(seconds: 5),
        );
        if (!mounted) return;
        // Update rider location in backend
        await _api.updateParcelDeliveryLocation(
          _requestId,
          pos.latitude,
          pos.longitude,
        );
      } catch (_) {}
    });
  }

  void _initDeliveryTimer() {
    _deliveryCountdownTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) return;
      setState(() {
        _deliverySecondsRemaining = (_deliverySecondsRemaining - 1).clamp(
          0,
          2700,
        );
        if (_deliverySecondsRemaining == 0) {
          // Timer expired
          _deliveryCountdownTimer?.cancel();
        }
      });
    });
  }

  String _formatTime(int seconds) {
    final mins = seconds ~/ 60;
    final secs = seconds % 60;
    return '$mins:${secs.toString().padLeft(2, '0')}';
  }

  Future<void> _markArrived() async {
    setState(() => _loading = true);
    try {
      final result = await _api.markParcelArrived(_requestId);
      if (!mounted) return;
      if (result['success'] == true) {
        setState(() {
          _phase = _Phase.arrived;
          _loading = false;
        });
      } else {
        setState(() => _loading = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(result['message'] as String? ?? 'Failed')),
        );
      }
    } catch (e) {
      if (!mounted) return;
      setState(() => _loading = false);
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Error: $e')));
    }
  }

  Future<void> _pickAndUploadPhoto() async {
    try {
      final ImagePicker picker = ImagePicker();
      final XFile? image = await picker.pickImage(
        source: ImageSource.camera,
        maxWidth: 1024,
        maxHeight: 1024,
      );
      if (image == null) return;

      setState(() => _uploadingPhoto = true);

      // For now, store the file path as photo URL
      // In production, upload to Cloudinary or similar
      final photoUrl = image.path;

      final result = await _api.uploadParcelPhoto(_requestId, photoUrl);

      if (!mounted) return;

      if (result['success'] == true) {
        setState(() {
          _deliveryPhotoUrl = photoUrl;
          _photoTaken = true;
          _uploadingPhoto = false;
          _phase = _Phase.photoUpload;
        });
      } else {
        setState(() => _uploadingPhoto = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(result['message'] as String? ?? 'Upload failed'),
          ),
        );
      }
    } catch (e) {
      if (!mounted) return;
      setState(() => _uploadingPhoto = false);
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Error: $e')));
    }
  }

  Future<void> _verifyOtp() async {
    final otp = _otpController.text.trim();
    if (otp.isEmpty) {
      setState(() => _otpError = 'Enter OTP');
      return;
    }
    if (otp.length != 4) {
      setState(() => _otpError = 'OTP must be 4 digits');
      return;
    }

    setState(() {
      _loading = true;
      _otpError = null;
    });

    try {
      final result = await _api.verifyParcelOtp(_requestId, otp);
      if (!mounted) return;

      if (result['success'] == true) {
        setState(() {
          _phase = _Phase.otpVerified;
          _loading = false;
        });
      } else {
        setState(() {
          _loading = false;
          _otpError = result['message'] as String? ?? 'Verification failed';
        });
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _otpError = 'Error: $e';
      });
    }
  }

  Future<void> _completeDelivery() async {
    setState(() => _loading = true);
    try {
      final result = await _api.completeParcelDelivery(_requestId);
      if (!mounted) return;

      if (result['success'] == true) {
        setState(() {
          _phase = _Phase.completed;
          _loading = false;
        });
        // Show success dialog
        await showDialog<void>(
          context: context,
          barrierDismissible: false,
          builder: (ctx) => AlertDialog(
            title: const Text('✓ Delivery Completed'),
            content: const Text('Parcel delivered successfully!'),
            actions: [
              TextButton(
                onPressed: () {
                  Navigator.pop(ctx);
                  Navigator.pop(context);
                },
                child: const Text('OK'),
              ),
            ],
          ),
        );
      } else {
        setState(() => _loading = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(result['message'] as String? ?? 'Failed')),
        );
      }
    } catch (e) {
      if (!mounted) return;
      setState(() => _loading = false);
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Error: $e')));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'Parcel Delivery',
          style: TextStyle(
            fontWeight: FontWeight.w800,
            fontSize: 20,
            letterSpacing: -0.5,
          ),
        ),
        elevation: 0,
        backgroundColor: Colors.white,
        foregroundColor: Colors.black87,
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(1),
          child: Container(color: const Color(0xFFE2E8F0), height: 1),
        ),
      ),
      body: SingleChildScrollView(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // ── Delivery Timer ──
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [
                      _blue.withValues(alpha: 0.95),
                      _blue.withValues(alpha: 0.85),
                    ],
                  ),
                  borderRadius: BorderRadius.circular(18),
                  boxShadow: [
                    BoxShadow(
                      color: _blue.withValues(alpha: 0.3),
                      blurRadius: 16,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Time Remaining',
                          style: TextStyle(
                            fontSize: 12,
                            color: Colors.white,
                            fontWeight: FontWeight.w600,
                            letterSpacing: 0.3,
                          ),
                        ),
                        SizedBox(height: 4),
                      ],
                    ),
                    Text(
                      _formatTime(_deliverySecondsRemaining),
                      style: const TextStyle(
                        fontSize: 32,
                        fontWeight: FontWeight.w900,
                        color: Colors.white,
                        letterSpacing: -1,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),

              // ── Recipient Details ──
              const Text(
                'Recipient Details',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w800,
                  letterSpacing: -0.3,
                ),
              ),
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [
                      _green.withValues(alpha: 0.15),
                      _orange.withValues(alpha: 0.1),
                    ],
                  ),
                  border: Border.all(
                    color: _green.withValues(alpha: 0.3),
                    width: 1.5,
                  ),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Container(
                          width: 48,
                          height: 48,
                          decoration: BoxDecoration(
                            color: _green.withValues(alpha: 0.2),
                            shape: BoxShape.circle,
                            border: Border.all(
                              color: _green.withValues(alpha: 0.4),
                              width: 2,
                            ),
                          ),
                          child: const Icon(
                            Icons.person_rounded,
                            color: _green,
                            size: 28,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                _receiverName,
                                style: const TextStyle(
                                  fontWeight: FontWeight.w800,
                                  fontSize: 16,
                                  letterSpacing: -0.3,
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ],
                          ),
                        ),
                        if (_receiverPhone.isNotEmpty)
                          GestureDetector(
                            onTap: () async {
                              final uri = Uri.parse('tel:$_receiverPhone');
                              if (await canLaunchUrl(uri)) {
                                await launchUrl(uri);
                              }
                            },
                            child: Container(
                              padding: const EdgeInsets.all(10),
                              decoration: BoxDecoration(
                                color: _green,
                                shape: BoxShape.circle,
                              ),
                              child: const Icon(
                                Icons.phone_rounded,
                                color: Colors.white,
                                size: 20,
                              ),
                            ),
                          ),
                      ],
                    ),
                    if (_receiverPhone.isNotEmpty) ...[
                      const SizedBox(height: 12),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 8,
                        ),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.6),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(
                              Icons.phone_rounded,
                              color: _green,
                              size: 14,
                            ),
                            const SizedBox(width: 6),
                            Text(
                              _receiverPhone,
                              style: const TextStyle(
                                color: _green,
                                fontSize: 13,
                                fontWeight: FontWeight.w700,
                                letterSpacing: 0.2,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(height: 24),

              // Phase-specific UI
              if (_phase == _Phase.navigating) ...[
                const Text(
                  'Navigate to Delivery Location',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w800,
                    letterSpacing: -0.3,
                  ),
                ),
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: [
                        _blue.withValues(alpha: 0.1),
                        _blue.withValues(alpha: 0.05),
                      ],
                    ),
                    border: Border.all(
                      color: _blue.withValues(alpha: 0.3),
                      width: 1.5,
                    ),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Coordinates',
                        style: TextStyle(
                          fontSize: 12,
                          color: Color(0xFF64748B),
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        '$_dropLat, $_dropLng',
                        style: const TextStyle(
                          fontFamily: 'monospace',
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFF0F172A),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(
                    style: FilledButton.styleFrom(
                      backgroundColor: _blue,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                    onPressed: _loading ? null : _markArrived,
                    icon: const Icon(Icons.location_on_rounded),
                    label: const Text(
                      'Mark Arrived',
                      style: TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 15,
                        letterSpacing: 0.2,
                      ),
                    ),
                  ),
                ),
              ] else if (_phase == _Phase.arrived) ...[
                const Text(
                  'Photo Proof',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w800,
                    letterSpacing: -0.3,
                  ),
                ),
                const SizedBox(height: 12),
                if (_deliveryPhotoUrl == null)
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(32),
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                        colors: [
                          _orange.withValues(alpha: 0.1),
                          _orange.withValues(alpha: 0.05),
                        ],
                      ),
                      border: Border.all(
                        color: _orange.withValues(alpha: 0.3),
                        width: 1.5,
                      ),
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: Column(
                      children: [
                        Icon(
                          Icons.camera_alt_rounded,
                          size: 48,
                          color: _orange.withValues(alpha: 0.6),
                        ),
                        const SizedBox(height: 12),
                        const Text(
                          'Take a photo of the parcel\nfor proof of delivery',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            color: Color(0xFF64748B),
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  )
                else
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                        colors: [
                          _green.withValues(alpha: 0.1),
                          _green.withValues(alpha: 0.05),
                        ],
                      ),
                      border: Border.all(
                        color: _green.withValues(alpha: 0.3),
                        width: 1.5,
                      ),
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: const Row(
                      children: [
                        Icon(Icons.check_circle, color: Color(0xFF22C55E)),
                        SizedBox(width: 8),
                        Text('Photo captured'),
                      ],
                    ),
                  ),
                const SizedBox(height: 16),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(
                    style: FilledButton.styleFrom(
                      backgroundColor: _orange,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                    onPressed: _uploadingPhoto ? null : _pickAndUploadPhoto,
                    icon: _uploadingPhoto
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(
                              strokeWidth: 2.5,
                              valueColor: AlwaysStoppedAnimation<Color>(
                                Colors.white,
                              ),
                            ),
                          )
                        : const Icon(Icons.camera_alt_rounded),
                    label: Text(
                      _uploadingPhoto ? 'Uploading...' : 'Capture Photo',
                      style: const TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 15,
                        letterSpacing: 0.2,
                      ),
                    ),
                  ),
                ),
                if (_photoTaken) ...[
                  const SizedBox(height: 16),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton.icon(
                      style: FilledButton.styleFrom(
                        backgroundColor: _green,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      onPressed: () {
                        setState(() => _phase = _Phase.photoUpload);
                      },
                      icon: const Icon(Icons.check_circle_outline_rounded),
                      label: const Text(
                        'Continue to OTP',
                        style: TextStyle(
                          fontWeight: FontWeight.w700,
                          fontSize: 15,
                          letterSpacing: 0.2,
                        ),
                      ),
                    ),
                  ),
                ],
              ] else if (_phase == _Phase.photoUpload) ...[
                const Text(
                  'Enter Delivery OTP',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w800,
                    letterSpacing: -0.3,
                  ),
                ),
                const SizedBox(height: 12),
                const Text(
                  'Ask the recipient for the 4-digit OTP',
                  style: TextStyle(
                    fontSize: 12,
                    color: Color(0xFF64748B),
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _otpController,
                  keyboardType: TextInputType.number,
                  maxLength: 4,
                  enabled: !_loading,
                  decoration: InputDecoration(
                    hintText: '0000',
                    filled: true,
                    fillColor: Colors.white,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(14),
                      borderSide: const BorderSide(
                        color: Color(0xFFE2E8F0),
                        width: 2,
                      ),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(14),
                      borderSide: BorderSide(
                        color: _blue.withValues(alpha: 0.3),
                        width: 2,
                      ),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(14),
                      borderSide: const BorderSide(color: _blue, width: 2),
                    ),
                    errorText: _otpError,
                    errorBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(14),
                      borderSide: const BorderSide(color: _red, width: 2),
                    ),
                    contentPadding: const EdgeInsets.symmetric(vertical: 16),
                  ),
                  style: const TextStyle(
                    fontSize: 32,
                    letterSpacing: 8,
                    fontWeight: FontWeight.w900,
                    color: _blue,
                    fontFamily: 'Courier',
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 16),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(
                    style: FilledButton.styleFrom(
                      backgroundColor: _green,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                    onPressed: _loading ? null : _verifyOtp,
                    icon: const Icon(Icons.verified_user_rounded),
                    label: const Text(
                      'Verify OTP',
                      style: TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 15,
                        letterSpacing: 0.2,
                      ),
                    ),
                  ),
                ),
              ] else if (_phase == _Phase.otpVerified) ...[
                Container(
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: [
                        _green.withValues(alpha: 0.15),
                        _green.withValues(alpha: 0.08),
                      ],
                    ),
                    border: Border.all(
                      color: _green.withValues(alpha: 0.4),
                      width: 2,
                    ),
                    borderRadius: BorderRadius.circular(18),
                  ),
                  child: Column(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: _green,
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(
                          Icons.check_rounded,
                          size: 40,
                          color: Colors.white,
                        ),
                      ),
                      const SizedBox(height: 16),
                      const Text(
                        'OTP Verified!',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w800,
                          color: _green,
                          letterSpacing: -0.3,
                        ),
                      ),
                      SizedBox(height: 8),
                      Text(
                        'Parcel delivery confirmed',
                        style: TextStyle(
                          fontSize: 14,
                          color: Color(0xFF64748B),
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(
                    style: FilledButton.styleFrom(
                      backgroundColor: _green,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                    onPressed: _loading ? null : _completeDelivery,
                    icon: _loading
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(
                              strokeWidth: 2.5,
                              valueColor: AlwaysStoppedAnimation<Color>(
                                Colors.white,
                              ),
                            ),
                          )
                        : const Icon(Icons.check_circle_outline_rounded),
                    label: const Text(
                      'Complete Delivery',
                      style: TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 15,
                        letterSpacing: 0.2,
                      ),
                    ),
                  ),
                ),
              ] else if (_phase == _Phase.completed) ...[
                Container(
                  padding: const EdgeInsets.all(24),
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: [
                        _green.withValues(alpha: 0.15),
                        _green.withValues(alpha: 0.08),
                      ],
                    ),
                    border: Border.all(
                      color: _green.withValues(alpha: 0.4),
                      width: 2,
                    ),
                    borderRadius: BorderRadius.circular(18),
                  ),
                  child: Column(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: _green,
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(
                          Icons.check_rounded,
                          size: 48,
                          color: Colors.white,
                        ),
                      ),
                      const SizedBox(height: 20),
                      const Text(
                        'Delivery Complete!',
                        style: TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.w800,
                          color: _green,
                          letterSpacing: -0.3,
                        ),
                      ),
                      SizedBox(height: 8),
                      Text(
                        'Parcel successfully delivered',
                        style: TextStyle(
                          fontSize: 14,
                          color: Color(0xFF64748B),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
