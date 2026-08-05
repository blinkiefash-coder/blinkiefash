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
      appBar: AppBar(title: const Text('Parcel Delivery'), elevation: 0),
      body: SingleChildScrollView(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Delivery timer
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: const Color(0xFFF0F9FF),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFF0284C7)),
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
                            color: Color(0xFF64748B),
                          ),
                        ),
                        SizedBox(height: 4),
                      ],
                    ),
                    Text(
                      _formatTime(_deliverySecondsRemaining),
                      style: const TextStyle(
                        fontSize: 28,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF0284C7),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),

              // Recipient details
              const Text(
                'Recipient',
                style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
              ),
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _receiverName,
                      style: const TextStyle(fontWeight: FontWeight.w600),
                    ),
                    const SizedBox(height: 4),
                    GestureDetector(
                      onTap: () async {
                        final uri = Uri.parse('tel:$_receiverPhone');
                        if (await canLaunchUrl(uri)) {
                          await launchUrl(uri);
                        }
                      },
                      child: Text(
                        _receiverPhone,
                        style: const TextStyle(
                          color: Color(0xFF0284C7),
                          decoration: TextDecoration.underline,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),

              // Phase-specific UI
              if (_phase == _Phase.navigating) ...[
                const Text(
                  'Navigate to Delivery Location',
                  style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF8F9FA),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Coordinates',
                        style: TextStyle(
                          fontSize: 12,
                          color: Color(0xFF64748B),
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '$_dropLat, $_dropLng',
                        style: const TextStyle(fontFamily: 'monospace'),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                ElevatedButton(
                  onPressed: _loading ? null : _markArrived,
                  style: ElevatedButton.styleFrom(
                    minimumSize: const Size.fromHeight(48),
                    backgroundColor: const Color(0xFF0284C7),
                  ),
                  child: _loading
                      ? const SizedBox(
                          height: 24,
                          width: 24,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            valueColor: AlwaysStoppedAnimation<Color>(
                              Colors.white,
                            ),
                          ),
                        )
                      : const Text('Mark Arrived'),
                ),
              ] else if (_phase == _Phase.arrived) ...[
                const Text(
                  'Photo Proof',
                  style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 12),
                if (_deliveryPhotoUrl == null)
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(32),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF8F9FA),
                      border: Border.all(color: const Color(0xFFE2E8F0)),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Column(
                      children: [
                        const Icon(
                          Icons.camera_alt,
                          size: 48,
                          color: Color(0xFF94A3B8),
                        ),
                        const SizedBox(height: 12),
                        const Text(
                          'Take a photo of the parcel\nfor proof of delivery',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            color: Color(0xFF64748B),
                            fontSize: 14,
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
                      color: const Color(0xFFF0FDF4),
                      border: Border.all(color: const Color(0xFF86EFAC)),
                      borderRadius: BorderRadius.circular(8),
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
                ElevatedButton(
                  onPressed: _uploadingPhoto ? null : _pickAndUploadPhoto,
                  style: ElevatedButton.styleFrom(
                    minimumSize: const Size.fromHeight(48),
                    backgroundColor: const Color(0xFF0284C7),
                  ),
                  child: _uploadingPhoto
                      ? const SizedBox(
                          height: 24,
                          width: 24,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            valueColor: AlwaysStoppedAnimation<Color>(
                              Colors.white,
                            ),
                          ),
                        )
                      : const Text('Capture Photo'),
                ),
                if (_photoTaken) ...[
                  const SizedBox(height: 16),
                  ElevatedButton(
                    onPressed: () {
                      setState(() => _phase = _Phase.photoUpload);
                    },
                    style: ElevatedButton.styleFrom(
                      minimumSize: const Size.fromHeight(48),
                      backgroundColor: const Color(0xFF22C55E),
                    ),
                    child: const Text('Continue to OTP'),
                  ),
                ],
              ] else if (_phase == _Phase.photoUpload) ...[
                const Text(
                  'Enter Delivery OTP',
                  style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 12),
                const Text(
                  'Ask the recipient for the 4-digit OTP',
                  style: TextStyle(fontSize: 12, color: Color(0xFF64748B)),
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
                    fillColor: const Color(0xFFF8F9FA),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8),
                      borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8),
                      borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
                    ),
                    errorText: _otpError,
                    errorBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8),
                      borderSide: const BorderSide(color: Color(0xFFEF4444)),
                    ),
                  ),
                  style: const TextStyle(
                    fontSize: 24,
                    letterSpacing: 8,
                    fontWeight: FontWeight.bold,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 16),
                ElevatedButton(
                  onPressed: _loading ? null : _verifyOtp,
                  style: ElevatedButton.styleFrom(
                    minimumSize: const Size.fromHeight(48),
                    backgroundColor: const Color(0xFF0284C7),
                  ),
                  child: _loading
                      ? const SizedBox(
                          height: 24,
                          width: 24,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            valueColor: AlwaysStoppedAnimation<Color>(
                              Colors.white,
                            ),
                          ),
                        )
                      : const Text('Verify OTP'),
                ),
              ] else if (_phase == _Phase.otpVerified) ...[
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF0FDF4),
                    border: Border.all(color: const Color(0xFF86EFAC)),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Column(
                    children: [
                      Icon(
                        Icons.check_circle,
                        size: 48,
                        color: Color(0xFF22C55E),
                      ),
                      SizedBox(height: 12),
                      Text(
                        'OTP Verified! ✓',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFF22C55E),
                        ),
                      ),
                      SizedBox(height: 8),
                      Text(
                        'Parcel delivery confirmed',
                        style: TextStyle(
                          fontSize: 14,
                          color: Color(0xFF64748B),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                ElevatedButton(
                  onPressed: _loading ? null : _completeDelivery,
                  style: ElevatedButton.styleFrom(
                    minimumSize: const Size.fromHeight(48),
                    backgroundColor: const Color(0xFF22C55E),
                  ),
                  child: _loading
                      ? const SizedBox(
                          height: 24,
                          width: 24,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            valueColor: AlwaysStoppedAnimation<Color>(
                              Colors.white,
                            ),
                          ),
                        )
                      : const Text('Complete Delivery'),
                ),
              ] else if (_phase == _Phase.completed) ...[
                Container(
                  padding: const EdgeInsets.all(24),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF0FDF4),
                    border: Border.all(color: const Color(0xFF86EFAC)),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Column(
                    children: [
                      Icon(
                        Icons.check_circle,
                        size: 64,
                        color: Color(0xFF22C55E),
                      ),
                      SizedBox(height: 16),
                      Text(
                        'Delivery Complete!',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w700,
                          color: Color(0xFF22C55E),
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
