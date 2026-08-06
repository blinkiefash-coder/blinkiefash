import 'dart:async';
import 'dart:io' show Platform;
import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:image_picker/image_picker.dart';
import 'package:url_launcher/url_launcher.dart';

import '../api_service.dart';

// ─────────────────────────────────────────────────────────────────────────────
// Delivery phases (no customer OTP — photo confirms arrival)
// storePickup → navigating → photoUpload → otpVerified
//            → [trialInProgress | completed]
// ─────────────────────────────────────────────────────────────────────────────
enum _Phase {
  storePickup,
  navigating,
  photoUpload,
  otpVerified,
  trialInProgress,
  completed,
}

class NavigationScreen extends StatefulWidget {
  const NavigationScreen({
    super.key,
    required this.order,
    required this.deliveryId,
  });
  final Map<String, dynamic> order;
  final String deliveryId;

  @override
  State<NavigationScreen> createState() => _NavigationScreenState();
}

class _NavigationScreenState extends State<NavigationScreen> {
  final _api = ApiService();
  Timer? _locationTimer;
  Timer? _deliveryCountdownTimer;
  Timer? _trialCountdownTimer;

  // 60-min delivery window — calculated from order started_at
  int _deliverySecondsRemaining = 3600;

  // 15-min trial window
  int _trialSecondsRemaining = 900;

  _Phase _phase = _Phase.storePickup;
  bool _isTryOrder = false;
  bool _loading = false;

  // Store pickup OTP
  final _storeOtpController = TextEditingController();
  String? _storeOtpError;
  bool _storeOtpRequested = false;

  // Pre-delivery photo
  String? _deliveryPhotoUrl;
  bool _uploadingPhoto = false;
  bool _photoTaken = false; // true even if upload failed — allows Continue

  @override
  void initState() {
    super.initState();
    _isTryOrder = widget.order['is_try_order'] == true;
    _api.loadToken().then((_) async {
      await _restorePhase();
      _startLocationStream();
    });
    _initDeliveryTimer();
  }

  /// Check current delivery status from backend and restore the correct phase
  /// so re-opening the screen after navigating away doesn't reset to storePickup.
  Future<void> _restorePhase() async {
    final res = await _api.getDeliveryDetail(widget.deliveryId);
    if (!mounted) return;
    final data = res['data'] as Map<String, dynamic>?;
    if (data == null) return;

    final deliveryStatus = data['delivery_status']?.toString() ?? '';
    final storeVerifiedAt = data['store_pickup_verified_at'];
    final otpVerifiedAt = data['otp_verified_at'];
    final deliveryPhotoUrl = data['delivery_photo_url']?.toString();
    final tryBuyStarted = data['try_buy_started_at'];
    final tryBuyDecision = data['try_buy_decision'];

    _Phase newPhase;
    if (tryBuyDecision != null) {
      newPhase = _Phase.completed;
    } else if (tryBuyStarted != null) {
      newPhase = _Phase.trialInProgress;
      _startTrialCountdown();
    } else if (otpVerifiedAt != null) {
      newPhase = _Phase.otpVerified;
      _isTryOrder = data['is_try_order'] == true;
    } else if (deliveryStatus == 'arrived') {
      // No customer OTP step — restore photo state if already taken
      newPhase = _Phase.photoUpload;
      if (deliveryPhotoUrl != null && deliveryPhotoUrl.isNotEmpty) {
        _deliveryPhotoUrl = deliveryPhotoUrl;
        _photoTaken = true;
      }
    } else if (storeVerifiedAt != null ||
        deliveryStatus == 'on_the_way' ||
        deliveryStatus == 'picked') {
      newPhase = _Phase.navigating;
    } else if (data['store_pickup_otp'] != null) {
      // OTP was generated but not yet verified → show OTP entry
      newPhase = _Phase.storePickup;
      _storeOtpRequested = true;
    } else {
      newPhase = _Phase.storePickup;
    }

    if (mounted) setState(() => _phase = newPhase);
  }

  // Compute remaining seconds from order confirmed_at (fallback: started_at)
  // so navigating away and back does not reset the countdown
  void _initDeliveryTimer() {
    // Prefer confirmed_at → started_at → now as the 60-min window start
    final rawConfirmed = widget.order['confirmed_at']?.toString();
    final rawStarted = widget.order['started_at']?.toString();
    final baseRaw = rawConfirmed ?? rawStarted;
    if (baseRaw != null) {
      final base = DateTime.tryParse(baseRaw);
      if (base != null) {
        final elapsed = DateTime.now().difference(base.toLocal()).inSeconds;
        _deliverySecondsRemaining = (3600 - elapsed).clamp(0, 3600);
      }
    }
    _startDeliveryCountdown();
  }

  void _startDeliveryCountdown() {
    _deliveryCountdownTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) return;
      setState(() {
        if (_deliverySecondsRemaining > 0) _deliverySecondsRemaining--;
      });
    });
  }

  void _startTrialCountdown() {
    _trialSecondsRemaining = 900;
    _trialCountdownTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) return;
      setState(() {
        if (_trialSecondsRemaining > 0) _trialSecondsRemaining--;
      });
    });
  }

  bool get _isDeliveryUrgent => _deliverySecondsRemaining < 600;
  bool get _isTrialExpired => _trialSecondsRemaining == 0;

  @override
  void dispose() {
    _locationTimer?.cancel();
    _deliveryCountdownTimer?.cancel();
    _trialCountdownTimer?.cancel();
    _storeOtpController.dispose();
    super.dispose();
  }

  void _startLocationStream() {
    _locationTimer = Timer.periodic(const Duration(seconds: 10), (_) async {
      try {
        final pos = await Geolocator.getCurrentPosition(
          desiredAccuracy: LocationAccuracy.high,
        );
        await _api.updateLocation(
          widget.deliveryId,
          pos.latitude,
          pos.longitude,
        );
      } catch (_) {}
    });
  }

  Future<void> _openMapsNavigation() async {
    final rawLat = widget.order['drop_lat'];
    final rawLng = widget.order['drop_lng'];
    final lat = rawLat != null ? double.tryParse(rawLat.toString()) : null;
    final lng = rawLng != null ? double.tryParse(rawLng.toString()) : null;

    final Uri url;
    if (lat != null && lng != null) {
      if (Platform.isIOS) {
        // Apple Maps
        url = Uri.parse('maps://?daddr=$lat,$lng&dirflg=d');
      } else {
        // HTTPS Google Maps URL — always works on Android (browser or Maps app)
        url = Uri.parse(
          'https://www.google.com/maps/dir/?api=1&destination=$lat,$lng&travelmode=driving',
        );
      }
    } else {
      final addr = widget.order['address_line']?.toString() ?? '';
      final city = widget.order['city']?.toString() ?? '';
      final query = Uri.encodeComponent('$addr $city'.trim());
      url = Uri.parse('https://www.google.com/maps/search/?api=1&query=$query');
    }

    await launchUrl(url, mode: LaunchMode.externalApplication);
  }

  // ── New OTP + Try & Buy actions ───────────────────────────────────────────

  // ── Store pickup OTP actions ──────────────────────────────────────────────

  Future<void> _requestStoreOtp() async {
    setState(() {
      _loading = true;
      _storeOtpError = null;
    });
    final res = await _api.storeArrived(widget.deliveryId);
    if (!mounted) return;
    setState(() => _loading = false);
    if (res['success'] == true) {
      setState(() => _storeOtpRequested = true);
    } else {
      _showError(res['message'] ?? 'Failed to request store OTP');
    }
  }

  Future<void> _verifyStoreOtp() async {
    final otp = _storeOtpController.text.trim();
    if (otp.length != 4) {
      setState(() => _storeOtpError = 'Enter the 4-digit OTP');
      return;
    }
    setState(() {
      _loading = true;
      _storeOtpError = null;
    });
    final res = await _api.verifyStoreOtp(widget.deliveryId, otp);
    if (!mounted) return;
    setState(() => _loading = false);
    if (res['success'] == true) {
      // Move to navigating phase + update delivery status
      await _api.updateDeliveryStatus(widget.deliveryId, 'on_the_way');
      setState(() => _phase = _Phase.navigating);
    } else {
      setState(() => _storeOtpError = res['message'] ?? 'Incorrect OTP');
    }
  }

  // ── Pre-delivery photo upload ─────────────────────────────────────────────

  Future<void> _pickAndUploadPhoto(ImageSource source) async {
    final picker = ImagePicker();
    final xFile = await picker.pickImage(
      source: source,
      imageQuality: 70,
      maxWidth: 1280,
    );
    if (xFile == null || !mounted) return;
    setState(() => _uploadingPhoto = true);
    final res = await _api.uploadDeliveryPhoto(widget.deliveryId, xFile.path);
    if (!mounted) return;
    setState(() => _uploadingPhoto = false);
    if (res['url'] != null) {
      setState(() {
        _deliveryPhotoUrl = res['url'] as String;
        _photoTaken = true;
      });
    } else {
      // Upload failed (likely SSL/network) — still let rider continue
      setState(() => _photoTaken = true);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Photo saved locally. You can continue.'),
            backgroundColor: Color(0xFF16A34A),
            duration: Duration(seconds: 3),
          ),
        );
      }
    }
  }

  // ── Mark arrived at customer ──────────────────────────────────────────────

  Future<void> _markArrived() async {
    setState(() => _loading = true);
    final res = await _api.markArrived(widget.deliveryId);
    if (!mounted) return;
    setState(() => _loading = false);
    if (res['success'] == true) {
      // Go to photo upload first, then OTP
      setState(() => _phase = _Phase.photoUpload);
    } else {
      _showError(res['message'] ?? 'Failed to mark arrived');
    }
  }

  Future<void> _confirmArrival() async {
    setState(() => _loading = true);
    final res = await _api.confirmArrival(widget.deliveryId);
    if (!mounted) return;
    setState(() => _loading = false);
    if (res['success'] == true) {
      setState(() {
        _isTryOrder = res['is_try_order'] == true;
        _phase = _Phase.otpVerified;
      });
    } else {
      _showError(res['message'] ?? 'Failed to confirm delivery');
    }
  }

  Future<void> _selectTryBuy(String mode) async {
    setState(() => _loading = true);
    final res = await _api.tryBuySelect(widget.deliveryId, mode);
    if (!mounted) return;
    setState(() => _loading = false);
    if (res['success'] == true) {
      if (mode == 'try') {
        setState(() => _phase = _Phase.trialInProgress);
        _startTrialCountdown();
      } else {
        setState(() => _phase = _Phase.completed);
        _deliveryCountdownTimer?.cancel();
        await Future.delayed(const Duration(seconds: 2));
        if (mounted) Navigator.of(context).popUntil((r) => r.isFirst);
      }
    } else {
      _showError(res['message'] ?? 'Failed');
    }
  }

  Future<void> _completeTryBuy(String decision) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(
          decision == 'kept' ? 'Customer Kept It?' : 'Customer Returned It?',
        ),
        content: Text(
          decision == 'kept'
              ? 'Mark order as delivered.'
              : 'Mark order as returned/cancelled.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: FilledButton.styleFrom(
              backgroundColor: decision == 'kept'
                  ? const Color(0xFF16A34A)
                  : const Color(0xFFEF4444),
            ),
            child: const Text('Confirm'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    setState(() => _loading = true);
    final res = await _api.tryBuyComplete(widget.deliveryId, decision);
    if (!mounted) return;
    setState(() => _loading = false);
    if (res['success'] == true) {
      _trialCountdownTimer?.cancel();
      _deliveryCountdownTimer?.cancel();
      setState(() => _phase = _Phase.completed);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            decision == 'kept'
                ? 'Order delivered! 🎉'
                : 'Return recorded. Heading back.',
          ),
          backgroundColor: decision == 'kept'
              ? const Color(0xFF16A34A)
              : const Color(0xFFEF4444),
        ),
      );
      await Future.delayed(const Duration(seconds: 2));
      if (mounted) Navigator.of(context).popUntil((r) => r.isFirst);
    } else {
      _showError(res['message'] ?? 'Failed');
    }
  }

  void _showError(String msg) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(msg), backgroundColor: const Color(0xFFEF4444)),
    );
  }

  // ── Build ─────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final order = widget.order;
    final shortId = (order['id'] as String? ?? '')
        .substring(0, 8)
        .toUpperCase();
    final storeName = order['store_name'] as String? ?? 'Dark Store';
    final storeAddr = order['store_address'] as String? ?? '';
    final dropAddr = order['address_line'] as String? ?? '';
    final dropCity = order['city'] as String? ?? '';
    final customerName = order['customer_name'] as String? ?? 'Customer';
    final customerPhone = order['customer_phone'] as String? ?? '';

    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            // ── Top bar ──────────────────────────────────────────────────────
            Container(
              color: const Color(0xFF16A34A),
              padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
              child: Row(
                children: [
                  IconButton(
                    icon: const Icon(Icons.arrow_back, color: Colors.white),
                    onPressed: () => Navigator.of(context).pop(),
                  ),
                  const Expanded(
                    child: Text(
                      'Active Delivery',
                      style: TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w800,
                        fontSize: 18,
                      ),
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 4,
                    ),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.2),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      '#$shortId',
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w700,
                        fontSize: 12,
                      ),
                    ),
                  ),
                ],
              ),
            ),

            // ── Map area ────────────────────────────────────────────────────
            Expanded(
              child: Stack(
                children: [
                  Container(
                    color: const Color(0xFFE8F5E9),
                    child: CustomPaint(
                      painter: _MapPainter(),
                      child: Container(),
                    ),
                  ),
                  const Center(
                    child: Icon(
                      Icons.navigation,
                      color: Color(0xFF16A34A),
                      size: 42,
                    ),
                  ),
                  const Positioned(
                    top: 80,
                    right: 80,
                    child: Icon(
                      Icons.location_on,
                      color: Color(0xFFEF4444),
                      size: 36,
                    ),
                  ),
                  Positioned(
                    top: 12,
                    left: 12,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 5,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(20),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.1),
                            blurRadius: 6,
                          ),
                        ],
                      ),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            Icons.gps_fixed,
                            size: 13,
                            color: Color(0xFF16A34A),
                          ),
                          SizedBox(width: 4),
                          Text(
                            'Sharing live location',
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                              color: Color(0xFF16A34A),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  if (_isTryOrder)
                    Positioned(
                      top: 12,
                      right: 12,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: 5,
                        ),
                        decoration: BoxDecoration(
                          color: const Color(0xFF7C3AED),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: const Text(
                          '🛍 Try & Buy',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ),

            // ── Bottom panel (scrollable to avoid overflow when keyboard/OTP shown)
            Flexible(
              child: SingleChildScrollView(
                child: Container(
                  color: Colors.white,
                  padding: const EdgeInsets.fromLTRB(16, 14, 16, 20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          _InfoBlock(label: 'Customer', value: customerName),
                          if (customerPhone.isNotEmpty)
                            _InfoBlock(label: 'Phone', value: customerPhone),
                        ],
                      ),
                      const SizedBox(height: 10),
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text(
                                  'Pickup',
                                  style: TextStyle(
                                    color: Color(0xFF94A3B8),
                                    fontSize: 12,
                                  ),
                                ),
                                Text(
                                  storeName,
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w700,
                                    fontSize: 13,
                                  ),
                                ),
                                if (storeAddr.isNotEmpty)
                                  Text(
                                    storeAddr,
                                    style: const TextStyle(
                                      color: Color(0xFF64748B),
                                      fontSize: 11,
                                    ),
                                  ),
                              ],
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text(
                                  'Drop off',
                                  style: TextStyle(
                                    color: Color(0xFF94A3B8),
                                    fontSize: 12,
                                  ),
                                ),
                                Text(
                                  dropAddr,
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w700,
                                    fontSize: 13,
                                  ),
                                ),
                                if (dropCity.isNotEmpty)
                                  Text(
                                    dropCity,
                                    style: const TextStyle(
                                      color: Color(0xFF64748B),
                                      fontSize: 11,
                                    ),
                                  ),
                              ],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 14),
                      if (_loading)
                        const Center(
                          child: Padding(
                            padding: EdgeInsets.symmetric(vertical: 16),
                            child: CircularProgressIndicator(
                              color: Color(0xFF16A34A),
                            ),
                          ),
                        )
                      else
                        _buildPhaseContent(),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPhaseContent() {
    switch (_phase) {
      case _Phase.storePickup:
        return _buildStorePickupPhase();
      case _Phase.navigating:
        return _buildNavigatingPhase();
      case _Phase.photoUpload:
        return _buildPhotoUploadPhase();
      case _Phase.otpVerified:
        return _buildOtpVerifiedPhase();
      case _Phase.trialInProgress:
        return _buildTrialPhase();
      case _Phase.completed:
        return _buildCompletedBanner();
    }
  }

  // ── PHASE: Store Pickup ───────────────────────────────────────────────────
  Widget _buildStorePickupPhase() {
    final storeName = widget.order['store_name'] as String? ?? 'Dark Store';
    final storeAddr = widget.order['store_address'] as String? ?? '';
    final distance = widget.order['distance'];
    final distStr = distance != null ? '${distance} km' : null;
    return Column(
      children: [
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: const Color(0xFFF0FDF4),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFF86EFAC)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  const Icon(Icons.store, color: Color(0xFF16A34A), size: 18),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Head to: $storeName',
                      style: const TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 13,
                        color: Color(0xFF166534),
                      ),
                    ),
                  ),
                  if (distStr != null)
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 4,
                      ),
                      decoration: BoxDecoration(
                        color: const Color(0xFF16A34A),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        distStr,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                ],
              ),
              if (storeAddr.isNotEmpty) ...[
                const SizedBox(height: 4),
                Text(
                  storeAddr,
                  style: const TextStyle(
                    color: Color(0xFF64748B),
                    fontSize: 11,
                  ),
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: 12),
        if (_storeOtpRequested) ...[
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(12),
            margin: const EdgeInsets.only(bottom: 10),
            decoration: BoxDecoration(
              color: const Color(0xFFFFF7ED),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFFED7AA)),
            ),
            child: const Row(
              children: [
                Icon(Icons.info_outline, color: Color(0xFFD97706), size: 18),
                SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Get the 4-digit store OTP from the store staff',
                    style: TextStyle(
                      color: Color(0xFF92400E),
                      fontWeight: FontWeight.w600,
                      fontSize: 13,
                    ),
                  ),
                ),
              ],
            ),
          ),
          TextField(
            controller: _storeOtpController,
            keyboardType: TextInputType.number,
            maxLength: 4,
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: 24,
              fontWeight: FontWeight.w900,
              letterSpacing: 10,
            ),
            decoration: InputDecoration(
              counterText: '',
              hintText: '- - - -',
              errorText: _storeOtpError,
              filled: true,
              fillColor: const Color(0xFFF8FAFC),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
          ),
          const SizedBox(height: 10),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: _verifyStoreOtp,
              icon: const Icon(Icons.check_circle_outline),
              label: const Text(
                'Confirm Pickup',
                style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16),
              ),
              style: FilledButton.styleFrom(
                backgroundColor: const Color(0xFF16A34A),
                minimumSize: const Size.fromHeight(50),
              ),
            ),
          ),
        ] else ...[
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: _requestStoreOtp,
              icon: const Icon(Icons.store_mall_directory_outlined),
              label: const Text(
                "I've Arrived at Store",
                style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16),
              ),
              style: FilledButton.styleFrom(
                backgroundColor: const Color(0xFF16A34A),
                minimumSize: const Size.fromHeight(50),
              ),
            ),
          ),
        ],
      ],
    );
  }

  Widget _buildNavigatingPhase() {
    final distance = widget.order['distance'];
    final distStr = distance != null ? '${distance} km' : null;
    return Column(
      children: [
        Row(
          children: [
            Expanded(
              child: _DeliveryTimer(
                seconds: _deliverySecondsRemaining,
                urgent: _isDeliveryUrgent,
                label: 'Time left',
              ),
            ),
            if (distStr != null) ...[
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 10,
                ),
                decoration: BoxDecoration(
                  color: const Color(0xFFEFF6FF),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFFBFDBFE)),
                ),
                child: Column(
                  children: [
                    const Icon(
                      Icons.route_outlined,
                      color: Color(0xFF2563EB),
                      size: 16,
                    ),
                    const SizedBox(height: 2),
                    Text(
                      distStr,
                      style: const TextStyle(
                        fontWeight: FontWeight.w800,
                        fontSize: 13,
                        color: Color(0xFF1D4ED8),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ],
        ),
        const SizedBox(height: 10),
        SizedBox(
          width: double.infinity,
          child: OutlinedButton.icon(
            onPressed: _openMapsNavigation,
            icon: const Icon(Icons.navigation_outlined),
            label: const Text(
              'Navigate to Customer',
              style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
            ),
            style: OutlinedButton.styleFrom(
              foregroundColor: const Color(0xFF1D4ED8),
              side: const BorderSide(color: Color(0xFF1D4ED8)),
              minimumSize: const Size.fromHeight(48),
            ),
          ),
        ),
        const SizedBox(height: 10),
        SizedBox(
          width: double.infinity,
          child: FilledButton.icon(
            onPressed: _markArrived,
            icon: const Icon(Icons.place_outlined),
            label: const Text(
              "I've Arrived at Customer",
              style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16),
            ),
            style: FilledButton.styleFrom(
              backgroundColor: const Color(0xFF2563EB),
              minimumSize: const Size.fromHeight(50),
            ),
          ),
        ),
      ],
    );
  }

  // ── PHASE: Photo Upload (confirms arrival — no customer OTP needed) ──────
  Widget _buildPhotoUploadPhase() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(12),
          margin: const EdgeInsets.only(bottom: 12),
          decoration: BoxDecoration(
            color: const Color(0xFFEFF6FF),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFFBFDBFE)),
          ),
          child: const Row(
            children: [
              Icon(
                Icons.camera_alt_outlined,
                color: Color(0xFF2563EB),
                size: 18,
              ),
              SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Upload a photo of the items before handing over',
                  style: TextStyle(
                    color: Color(0xFF1E40AF),
                    fontWeight: FontWeight.w600,
                    fontSize: 13,
                  ),
                ),
              ),
            ],
          ),
        ),
        if (_deliveryPhotoUrl != null)
          Container(
            width: double.infinity,
            height: 160,
            margin: const EdgeInsets.only(bottom: 10),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(12),
              image: DecorationImage(
                image: NetworkImage(_deliveryPhotoUrl!),
                fit: BoxFit.cover,
              ),
            ),
            child: Align(
              alignment: Alignment.topRight,
              child: GestureDetector(
                onTap: () => setState(() {
                  _deliveryPhotoUrl = null;
                  _photoTaken = false;
                }),
                child: Container(
                  margin: const EdgeInsets.all(8),
                  padding: const EdgeInsets.all(4),
                  decoration: const BoxDecoration(
                    color: Colors.white,
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.close, size: 16),
                ),
              ),
            ),
          )
        else if (_photoTaken)
          Container(
            width: double.infinity,
            margin: const EdgeInsets.only(bottom: 10),
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            decoration: BoxDecoration(
              color: const Color(0xFFECFDF3),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: const Color(0xFF86EFAC)),
            ),
            child: Row(
              children: [
                const Icon(
                  Icons.check_circle,
                  color: Color(0xFF16A34A),
                  size: 18,
                ),
                const SizedBox(width: 8),
                const Expanded(
                  child: Text(
                    'Photo taken ✓',
                    style: TextStyle(
                      color: Color(0xFF15803D),
                      fontWeight: FontWeight.w600,
                      fontSize: 13,
                    ),
                  ),
                ),
                GestureDetector(
                  onTap: () => setState(() => _photoTaken = false),
                  child: const Icon(
                    Icons.refresh,
                    color: Color(0xFF16A34A),
                    size: 18,
                  ),
                ),
              ],
            ),
          ),
        Row(
          children: [
            Expanded(
              child: FilledButton.icon(
                onPressed: _uploadingPhoto
                    ? null
                    : () => _pickAndUploadPhoto(ImageSource.camera),
                icon: const Icon(Icons.camera_alt),
                label: _uploadingPhoto
                    ? const SizedBox(
                        height: 18,
                        width: 18,
                        child: CircularProgressIndicator(
                          color: Colors.white,
                          strokeWidth: 2,
                        ),
                      )
                    : const Text(
                        'Take Photo',
                        style: TextStyle(fontWeight: FontWeight.w700),
                      ),
                style: FilledButton.styleFrom(
                  backgroundColor: const Color(0xFF2563EB),
                  minimumSize: const Size.fromHeight(48),
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        SizedBox(
          width: double.infinity,
          child: FilledButton(
            onPressed: (_photoTaken && !_uploadingPhoto) ? _confirmArrival : null,
            style: FilledButton.styleFrom(
              backgroundColor: const Color(0xFF16A34A),
              minimumSize: const Size.fromHeight(50),
            ),
            child: const Text(
              'Confirm Delivery',
              style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16),
            ),
          ),
        ),
      ],
    );
  }

  // ── PHASE: OTP verified — choose Try or Buy ───────────────────────────────
  Widget _buildOtpVerifiedPhase() {
    return Column(
      children: [
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(12),
          margin: const EdgeInsets.only(bottom: 14),
          decoration: BoxDecoration(
            color: const Color(0xFFECFDF3),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFF86EFAC)),
          ),
          child: const Row(
            children: [
              Icon(
                Icons.check_circle_outline,
                color: Color(0xFF16A34A),
                size: 18,
              ),
              SizedBox(width: 8),
              Text(
                'Arrived at Customer!',
                style: TextStyle(
                  color: Color(0xFF166534),
                  fontWeight: FontWeight.w700,
                  fontSize: 14,
                ),
              ),
            ],
          ),
        ),
        if (_isTryOrder) ...[
          const Text(
            'Customer selected Try & Buy — choose delivery mode:',
            style: TextStyle(
              color: Color(0xFF475569),
              fontSize: 13,
              fontWeight: FontWeight.w500,
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () => _selectTryBuy('try'),
                  icon: const Icon(Icons.timer_outlined),
                  label: const Text(
                    'Try & Buy\n(15 min)',
                    textAlign: TextAlign.center,
                    style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
                  ),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: const Color(0xFF7C3AED),
                    side: const BorderSide(color: Color(0xFF7C3AED)),
                    minimumSize: const Size.fromHeight(54),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: FilledButton.icon(
                  onPressed: () => _selectTryBuy('buy'),
                  icon: const Icon(Icons.shopping_bag_outlined),
                  label: const Text(
                    'Buy Now',
                    style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
                  ),
                  style: FilledButton.styleFrom(
                    backgroundColor: const Color(0xFF16A34A),
                    minimumSize: const Size.fromHeight(54),
                  ),
                ),
              ),
            ],
          ),
        ] else ...[
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: () => _selectTryBuy('buy'),
              icon: const Icon(Icons.check_circle_outline),
              label: const Text(
                'Mark as Delivered',
                style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16),
              ),
              style: FilledButton.styleFrom(
                backgroundColor: const Color(0xFF16A34A),
                minimumSize: const Size.fromHeight(50),
              ),
            ),
          ),
        ],
      ],
    );
  }

  // ── PHASE: Trial in progress ──────────────────────────────────────────────
  Widget _buildTrialPhase() {
    return Column(
      children: [
        _DeliveryTimer(
          seconds: _trialSecondsRemaining,
          urgent: _isTrialExpired || _trialSecondsRemaining < 120,
          label: _isTrialExpired
              ? 'Trial time expired!'
              : 'Trial time remaining',
        ),
        const SizedBox(height: 14),
        const Text(
          'Waiting for customer to try the item...',
          style: TextStyle(
            color: Color(0xFF475569),
            fontSize: 13,
            fontWeight: FontWeight.w500,
          ),
        ),
        const SizedBox(height: 14),
        Row(
          children: [
            Expanded(
              child: FilledButton.icon(
                onPressed: () => _completeTryBuy('kept'),
                icon: const Icon(Icons.check_circle_outline),
                label: const Text(
                  'Customer Kept It',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
                ),
                style: FilledButton.styleFrom(
                  backgroundColor: const Color(0xFF16A34A),
                  minimumSize: const Size.fromHeight(54),
                ),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: OutlinedButton.icon(
                onPressed: () => _completeTryBuy('returned'),
                icon: const Icon(Icons.undo_outlined),
                label: const Text(
                  'Customer Returned',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
                ),
                style: OutlinedButton.styleFrom(
                  foregroundColor: const Color(0xFFEF4444),
                  side: const BorderSide(color: Color(0xFFEF4444)),
                  minimumSize: const Size.fromHeight(54),
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }

  // ── PHASE: Completed ──────────────────────────────────────────────────────
  Widget _buildCompletedBanner() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFECFDF3),
        borderRadius: BorderRadius.circular(12),
      ),
      child: const Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.check_circle, color: Color(0xFF16A34A)),
          SizedBox(width: 8),
          Text(
            'Delivered!',
            style: TextStyle(
              color: Color(0xFF16A34A),
              fontWeight: FontWeight.w800,
              fontSize: 16,
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared widgets
// ─────────────────────────────────────────────────────────────────────────────

class _DeliveryTimer extends StatelessWidget {
  const _DeliveryTimer({
    required this.seconds,
    required this.urgent,
    required this.label,
  });
  final int seconds;
  final bool urgent;
  final String label;

  String get _display {
    final m = seconds ~/ 60;
    final s = seconds % 60;
    return '${m.toString().padLeft(2, '0')}:${s.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 14),
      margin: const EdgeInsets.only(bottom: 4),
      decoration: BoxDecoration(
        color: urgent ? const Color(0xFFFEF2F2) : const Color(0xFFECFDF3),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: urgent ? const Color(0xFFFCA5A5) : const Color(0xFF86EFAC),
        ),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.timer_outlined,
            color: urgent ? const Color(0xFFDC2626) : const Color(0xFF16A34A),
            size: 18,
          ),
          const SizedBox(width: 8),
          Text(
            '$label: ',
            style: TextStyle(
              fontSize: 13,
              color: urgent ? const Color(0xFFDC2626) : const Color(0xFF166534),
            ),
          ),
          Text(
            _display,
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w900,
              color: urgent ? const Color(0xFFDC2626) : const Color(0xFF166534),
            ),
          ),
        ],
      ),
    );
  }
}

class _InfoBlock extends StatelessWidget {
  const _InfoBlock({required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 12),
          ),
          Text(value, style: const TextStyle(fontWeight: FontWeight.w700)),
        ],
      ),
    );
  }
}

class _MapPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final roadPaint = Paint()
      ..color = Colors.white
      ..strokeWidth = 10
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;

    final routePaint = Paint()
      ..color = const Color(0xFF2563EB)
      ..strokeWidth = 5
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;

    canvas.drawLine(
      Offset(0, size.height * 0.5),
      Offset(size.width, size.height * 0.5),
      roadPaint,
    );
    canvas.drawLine(
      Offset(size.width * 0.5, 0),
      Offset(size.width * 0.5, size.height),
      roadPaint,
    );

    final path = Path()
      ..moveTo(size.width * 0.5, size.height * 0.8)
      ..lineTo(size.width * 0.5, size.height * 0.5)
      ..lineTo(size.width * 0.75, size.height * 0.3);
    canvas.drawPath(path, routePaint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
