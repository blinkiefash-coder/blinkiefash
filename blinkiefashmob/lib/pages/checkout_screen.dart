import 'package:flutter/material.dart';
import '../services/api_client.dart';
import '../services/cart_manager.dart';
import '../services/user_session.dart';
import 'login_screen.dart';
import 'location_picker_screen.dart';
import 'order_detail_screen.dart';
import '../widgets/bf_loader.dart';

// ignore_for_file: deprecated_member_use

class CheckoutScreen extends StatefulWidget {
  const CheckoutScreen({
    super.key,
    this.isTryOrder = false,
    this.overrideItems,
  });

  final bool isTryOrder;

  /// When provided, these items are used instead of the shared cart.
  /// The shared cart is not cleared after checkout.
  final List<CartItem>? overrideItems;

  @override
  State<CheckoutScreen> createState() => _CheckoutScreenState();
}

class _CheckoutScreenState extends State<CheckoutScreen> {
  final ApiClient _api = ApiClient();
  bool _authRedirectInFlight = false;
  static const double _platformFeeFlat = 9.0;
  static const double _shippingPackagingHandlingPerProduct = 9.0;

  List<CartItem> get _effectiveItems =>
      widget.overrideItems ?? CartManager.instance.items;

  double get _effectiveSubtotal => _effectiveItems.fold(0.0, (sum, i) {
    final p = double.tryParse(i.rawPrice) ?? 0.0;
    return sum + p * i.quantity;
  });

  List<Map<String, dynamic>> _addresses = [];
  String? _selectedAddressId;
  bool _loadingAddresses = true;
  bool _placingOrder = false;
  String? _error;

  // Delivery fee state
  double _deliveryFee = 0.0;
  bool _deliveryAvailable = true;
  double? _deliveryDistanceKm;
  int? _deliveryEtaMinMinutes;
  int? _deliveryEtaMaxMinutes;
  String? _deliveryPromise; // e.g., "Fast Delivery", "Same Day Delivery", etc.
  String? _deliveryType; // e.g., 'local', 'sameday', 'nextday', '2days'

  // Reward state
  double _availableReferralAmount = 0;
  int _availableClothingItems = 0;
  int _availableClothingPercent = 0;
  bool _useReferral = false;
  bool _useClothing = false;

  // Earned offers (spin wheel + fashion quest)
  double _spinRewardPct = 0;
  double _questRewardPct = 0;
  bool _useSpinReward = false;
  bool _useQuestReward = false;

  // Coupon code
  final _couponCtrl = TextEditingController();
  String _appliedCouponCode = '';
  double _couponDiscount = 0;
  bool _couponApplied = false;

  // Auto offers (milestone + buy-more)
  int _selectedAutoOffer = -1; // index in _kAutoOffers, -1 = none

  // Donation modal state
  final _donationItemCtrl = TextEditingController(text: '1');
  final _donationNotesCtrl = TextEditingController();
  bool _donationScheduled = false;

  // Delivery schedule state
  bool _deliverTomorrow = false;
  int _selectedTomorrowSlotIndex = 0;

  // Receiver information state
  String _receiverType = 'own'; // 'own' or 'someone_else'
  final _receiverNameCtrl = TextEditingController();
  final _receiverPhoneCtrl = TextEditingController();

  static final List<TimeOfDay> _tomorrowSlots = List.generate(28, (i) {
    final totalMinutes = (7 * 60 + 30) + (i * 30);
    return TimeOfDay(hour: totalMinutes ~/ 60, minute: totalMinutes % 60);
  });

  // Next-day scheduled delivery slots (11:00 to 21:00 for 25km local delivery)
  static final List<TimeOfDay> _nextdayLocalSlots = List.generate(20, (i) {
    final totalMinutes = (11 * 60) + (i * 30);
    return TimeOfDay(hour: totalMinutes ~/ 60, minute: totalMinutes % 60);
  });

  // Next-day scheduled delivery slots (11:30 to 21:00 for 25-45km extended delivery)
  static final List<TimeOfDay> _nextdayExtendedSlots = List.generate(19, (i) {
    final totalMinutes = (11 * 60 + 30) + (i * 30);
    return TimeOfDay(hour: totalMinutes ~/ 60, minute: totalMinutes % 60);
  });

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _startCheckoutFlow();
    });
  }

  @override
  void dispose() {
    _donationItemCtrl.dispose();
    _donationNotesCtrl.dispose();
    _couponCtrl.dispose();
    _receiverNameCtrl.dispose();
    _receiverPhoneCtrl.dispose();
    super.dispose();
  }

  List<CartItem>? _clonedOverrideItems() {
    final items = widget.overrideItems;
    if (items == null) return null;
    return items
        .map(
          (item) => CartItem(
            productId: item.productId,
            name: item.name,
            price: item.price,
            rawPrice: item.rawPrice,
            compareRawPrice: item.compareRawPrice,
            imageUrl: item.imageUrl,
            size: item.size,
            color: item.color,
            quantity: item.quantity,
            availableStock: item.availableStock,
          ),
        )
        .toList();
  }

  void _startCheckoutFlow() {
    if (UserSession.instance.isLoggedIn) {
      _loadAddresses();
      _loadRewards();
      _loadEarnedOffers();
      _refreshVariantAvailability();
      return;
    }
    if (_authRedirectInFlight || !mounted) return;
    _authRedirectInFlight = true;
    Navigator.of(context).pushReplacement(
      MaterialPageRoute<void>(
        builder: (_) => LoginScreen(
          redirectBuilder: (_) => CheckoutScreen(
            isTryOrder: widget.isTryOrder,
            overrideItems: _clonedOverrideItems(),
          ),
        ),
      ),
    );
  }

  Future<void> _loadEarnedOffers() async {
    final userId = UserSession.instance.userId;
    if (userId == null) return;
    try {
      final data = await _api.fetchGamificationState(userId);
      if (!mounted) return;
      setState(() {
        _spinRewardPct = (data['spinRewardPct'] as num?)?.toDouble() ?? 0.0;
        _questRewardPct = (data['questRewardPct'] as num?)?.toDouble() ?? 0.0;
      });
    } catch (_) {}
  }

  Future<void> _refreshVariantAvailability() async {
    final items = _effectiveItems;
    if (items.isEmpty) return;
    try {
      final ids = items.map((i) => i.productId).toList();
      final res = await _api.fetchVariantAvailability(ids);
      if (res['success'] != true) return;
      final list = (res['availability'] as List?) ?? const [];
      final byId = <String, Map<String, dynamic>>{};
      for (final raw in list) {
        if (raw is Map<String, dynamic>) {
          final id = raw['variantId']?.toString() ?? '';
          if (id.isNotEmpty) byId[id] = raw;
        }
      }

      for (final item in items) {
        final row = byId[item.productId];
        if (row == null) {
          item.availableStock = 0;
          continue;
        }
        final isAvailable = row['isAvailable'] == true;
        final stock = (row['availableStock'] as num?)?.toInt() ?? 0;
        item.availableStock = isAvailable ? stock : 0;
      }

      if (mounted) setState(() {});
    } catch (_) {}
  }

  // Hardcoded coupon validation (extend as needed)
  static const _validCoupons = {
    'BLINKIE10': 10.0, // 10% off
    'BLINKIE5': 5.0, // 5% off
    'FLASH20': 20.0, // 20% off
    'WELCOME15': 15.0, // 15% off
  };

  void _applyCoupon() {
    final code = _couponCtrl.text.trim().toUpperCase();
    if (code.isEmpty) return;
    final pct = _validCoupons[code];
    if (pct == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Invalid coupon code. Try BLINKIE10 or FLASH20.'),
          backgroundColor: Color(0xFFDC2626),
        ),
      );
      return;
    }
    final discount = _effectiveSubtotal * pct / 100;
    setState(() {
      _useReferral = false;
      _useClothing = false;
      _useSpinReward = false;
      _useQuestReward = false;
      _selectedAutoOffer = -1;
      _appliedCouponCode = code;
      _couponDiscount = discount;
      _couponApplied = true;
    });
    FocusScope.of(context).unfocus();
  }

  void _toggleExclusiveOffer(String offerKey, bool enabled, {int? autoIndex}) {
    setState(() {
      if (!enabled) {
        if (offerKey == 'referral') _useReferral = false;
        if (offerKey == 'clothing') _useClothing = false;
        if (offerKey == 'spin') _useSpinReward = false;
        if (offerKey == 'quest') _useQuestReward = false;
        if (offerKey == 'auto') _selectedAutoOffer = -1;
        if (offerKey == 'coupon') {
          _couponApplied = false;
          _appliedCouponCode = '';
          _couponDiscount = 0;
          _couponCtrl.clear();
        }
        return;
      }

      _useReferral = offerKey == 'referral';
      _useClothing = offerKey == 'clothing';
      _useSpinReward = offerKey == 'spin';
      _useQuestReward = offerKey == 'quest';
      _selectedAutoOffer = offerKey == 'auto' ? (autoIndex ?? -1) : -1;
      if (offerKey != 'coupon') {
        _couponApplied = false;
        _appliedCouponCode = '';
        _couponDiscount = 0;
        _couponCtrl.clear();
      }
    });
  }

  Future<void> _loadRewards() async {
    final userId = UserSession.instance.userId;
    if (userId == null) return;
    try {
      final data = await _api.fetchAvailableRewards(userId);
      if (!mounted) return;
      setState(() {
        _availableReferralAmount =
            (data['referralAmount'] as num?)?.toDouble() ?? 0.0;
        _availableClothingItems = (data['clothingItems'] as num?)?.toInt() ?? 0;
        _availableClothingPercent =
            (data['clothingPercent'] as num?)?.toInt() ?? 0;
      });
    } catch (_) {}
  }

  Future<void> _loadAddresses() async {
    final userId = UserSession.instance.userId;
    if (userId == null) {
      setState(() {
        _loadingAddresses = false;
      });
      return;
    }
    try {
      final list = await _api.fetchAddresses(userId);
      if (!mounted) return;
      final parsed = list.whereType<Map<String, dynamic>>().toList();
      String? defaultId;
      for (final a in parsed) {
        if (a['is_default'] == true) {
          defaultId = a['id'].toString();
          break;
        }
      }
      defaultId ??= parsed.isNotEmpty ? parsed.first['id'].toString() : null;
      setState(() {
        _addresses = parsed;
        _selectedAddressId = defaultId;
        _loadingAddresses = false;
      });
      // Fetch delivery fee for the default address
      if (defaultId != null) _fetchDeliveryFee(defaultId);
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loadingAddresses = false;
      });
    }
  }

  Future<void> _fetchDeliveryFee(String addressId) async {
    final subtotal = _effectiveSubtotal;
    final result = await _api.fetchDeliveryFee(
      addressId: addressId,
      subtotal: subtotal,
    );
    if (!mounted) return;
    setState(() {
      final fee = result['fee'];
      _deliveryFee = fee != null ? (fee as num).toDouble() : 0.0;
      _deliveryAvailable = result['withinRange'] as bool? ?? true;
      _deliveryDistanceKm = (result['distance'] as num?)?.toDouble();
      _deliveryEtaMinMinutes = (result['etaMinMinutes'] as num?)?.toInt();
      _deliveryEtaMaxMinutes = (result['etaMaxMinutes'] as num?)?.toInt();

      // Store delivery promise and type for display
      _deliveryPromise = result['deliveryPromise']?.toString();
      _deliveryType = result['deliveryType']?.toString();
    });
  }

  Future<void> _showAddAddressSheet() async {
    final result = await Navigator.of(context).push<PickedAddress>(
      MaterialPageRoute(builder: (_) => const LocationPickerScreen()),
    );
    if (result == null) return;
    final userId = UserSession.instance.userId;
    if (userId == null) return;

    setState(() {
      _loadingAddresses = true;
      _error = null;
    });
    final res = await _api.addAddress(
      userId: userId,
      addressLine: result.addressLine,
      city: result.city,
      pincode: result.pincode,
      lat: result.lat,
      lng: result.lng,
    );
    if (!mounted) return;
    if (res['success'] == true) {
      await _loadAddresses();
      if (_addresses.isNotEmpty && _selectedAddressId == null) {
        final newId = _addresses.first['id'].toString();
        setState(() => _selectedAddressId = newId);
        _fetchDeliveryFee(newId);
      }
    } else {
      setState(() {
        _loadingAddresses = false;
        _error = res['message']?.toString() ?? 'Failed to save address';
      });
    }
  }

  bool _hasUnavailableItems() {
    for (final item in _effectiveItems) {
      final limit = item.availableStock;
      if (limit != null && (limit <= 0 || item.quantity > limit)) {
        return true;
      }
    }
    return false;
  }

  void _incrementCheckoutItem(CartItem item) {
    final limit = item.availableStock;
    if (limit != null && item.quantity >= limit) {
      setState(() {
        _error = '${item.name}: only $limit in stock for selected size/color';
      });
      return;
    }

    setState(() {
      if (widget.overrideItems != null) {
        item.quantity++;
      } else {
        final ok = CartManager.instance.increment(item);
        if (!ok) {
          _error = '${item.name}: stock limit reached for selected size/color';
        }
      }
    });
  }

  void _decrementCheckoutItem(CartItem item) {
    setState(() {
      if (widget.overrideItems != null) {
        if (item.quantity > 1) {
          item.quantity--;
        } else {
          widget.overrideItems!.remove(item);
        }
      } else {
        CartManager.instance.decrement(item);
      }
    });
  }

  String _slotLabel(TimeOfDay slot) {
    final hour12 = slot.hourOfPeriod == 0 ? 12 : slot.hourOfPeriod;
    final minute = slot.minute.toString().padLeft(2, '0');
    final period = slot.period == DayPeriod.am ? 'AM' : 'PM';
    return '$hour12:$minute $period';
  }

  String _todayDeliveryLabel() {
    // Show delivery promise if available from backend
    if (_deliveryPromise != null) {
      return _deliveryPromise!; // Shows dynamic ETA like "Delivery in 62 minutes" or "Next Day Delivery"
    }
    return 'Delivery Time';
  }

  String _todayDeliverySubtitle() {
    final etaMin = _deliveryEtaMinMinutes;
    final etaMax = _deliveryEtaMaxMinutes;
    final distance = _deliveryDistanceKm;
    final type = _deliveryType ?? '';
    final now = DateTime.now();
    final currentHour = now.hour;
    final isAfterOperatingHours = currentHour >= 21 || currentHour < 10;

    // For same day delivery
    if (type == 'sameday') {
      return 'Same day delivery to major Odisha cities (ordered before 12:00 PM)';
    }

    // For next day delivery (after 21:00, within 45km - allows time slot selection)
    if (type == 'nextday_scheduled_local') {
      return 'Next day delivery (11:00 AM to 9:00 PM) - Select your preferred time';
    }
    if (type == 'nextday_scheduled_extended') {
      return 'Next day delivery (11:30 AM to 9:00 PM) - Select your preferred time';
    }

    // For next day delivery (fixed)
    if (type == 'nextday') {
      if (isAfterOperatingHours) {
        return 'Next day delivery (order placed after operating hours)';
      }
      return 'Next day delivery available';
    }

    // For 2 days delivery
    if (type == '2days') {
      if (isAfterOperatingHours) {
        return 'Next to next day delivery (order placed after 21:00)';
      }
      return 'Delivery within 2 days across Odisha';
    }

    // For time-based ETAs (local and extended)
    if (etaMin != null && etaMax != null && distance != null) {
      return '$etaMin-$etaMax min for ${distance.toStringAsFixed(1)} km from your nearest delivery partner.';
    }
    if (etaMin != null && etaMax != null) {
      return '$etaMin-$etaMax min based on your delivery zone.';
    }
    return 'ETA updates automatically once your address is selected.';
  }

  // Get the appropriate slot list based on delivery type
  List<TimeOfDay> _getSlotList() {
    if (_deliveryType == 'nextday_scheduled_local') {
      return _nextdayLocalSlots;
    } else if (_deliveryType == 'nextday_scheduled_extended') {
      return _nextdayExtendedSlots;
    }
    return _tomorrowSlots;
  }

  DateTime _selectedTomorrowDateTime() {
    final now = DateTime.now();
    final tomorrow = now.add(const Duration(days: 1));
    final slotList = _getSlotList();
    final slot = slotList[_selectedTomorrowSlotIndex];
    return DateTime(
      tomorrow.year,
      tomorrow.month,
      tomorrow.day,
      slot.hour,
      slot.minute,
    );
  }

  Future<void> _placeOrder() async {
    if (_selectedAddressId == null) {
      setState(() => _error = 'Please select a delivery address');
      return;
    }
    if (!_deliveryAvailable) {
      setState(
        () => _error =
            'Delivery is not available at this location. Please check your address.',
      );
      return;
    }
    final userId = UserSession.instance.userId;
    if (userId == null) {
      setState(() => _error = 'Please login to place order');
      return;
    }
    final cartItems = _effectiveItems;
    if (cartItems.isEmpty) {
      setState(() => _error = 'Your cart is empty');
      return;
    }
    if (_hasUnavailableItems()) {
      setState(() {
        _error =
            'One or more items are unavailable for now or exceed available stock. Update quantities to continue.';
      });
      return;
    }

    setState(() {
      _placingOrder = true;
      _error = null;
    });

    final items = cartItems
        .map(
          (ci) => {
            'variantId': ci.productId,
            'quantity': ci.quantity,
            'price': double.tryParse(ci.rawPrice) ?? 0.0,
          },
        )
        .toList();

    // Send subtotal only — backend calculates final amount with delivery fee
    final subtotal = _effectiveSubtotal;

    // Auto-schedule if delivery type is next-day scheduled (after 21:00, ≤45km)
    bool isScheduled = _deliverTomorrow;
    if (_deliveryType == 'nextday_scheduled_local' ||
        _deliveryType == 'nextday_scheduled_extended') {
      isScheduled = true;
    }

    final scheduledAt = isScheduled ? _selectedTomorrowDateTime() : null;
    final slotList = _getSlotList();
    final scheduledLabel = isScheduled
        ? _slotLabel(slotList[_selectedTomorrowSlotIndex])
        : null;

    String? manualOfferType;
    double manualOfferDiscount = 0;
    if (_useSpinReward && _spinRewardPct > 0) {
      manualOfferType = 'spin';
      manualOfferDiscount = subtotal * _spinRewardPct / 100;
    } else if (_useQuestReward && _questRewardPct > 0) {
      manualOfferType = 'quest';
      manualOfferDiscount = subtotal * _questRewardPct / 100;
    } else if (_couponApplied && _couponDiscount > 0) {
      manualOfferType = 'coupon';
      manualOfferDiscount = _couponDiscount;
    } else if (_selectedAutoOffer >= 0) {
      final currentAuto = _kAutoOffers[_selectedAutoOffer];
      if (currentAuto.isEligible(subtotal, cartItems.length)) {
        manualOfferType = 'auto';
        manualOfferDiscount = currentAuto.compute(subtotal);
      }
    }

    final res = await _api.placeOrder(
      userId: userId,
      addressId: _selectedAddressId!,
      items: items,
      totalAmount: subtotal,
      isTryOrder: widget.isTryOrder,
      useReferralReward: _useReferral && _availableReferralAmount > 0,
      useClothingReward: _useClothing && _availableClothingItems > 0,
      useFirstOrderDiscount: false,
      manualOfferType: manualOfferType,
      manualOfferDiscount: manualOfferDiscount > 0 ? manualOfferDiscount : null,
      deliveryScheduleType: isScheduled ? 'scheduled' : 'asap',
      scheduledFor: scheduledAt?.toIso8601String(),
      scheduledSlotLabel: scheduledLabel,
    );
    if (!mounted) return;

    setState(() => _placingOrder = false);

    if (res['success'] == true) {
      // Only clear the shared cart when this was a regular cart order
      if (widget.overrideItems == null) CartManager.instance.clear();
      if (!mounted) return;
      final orderId = res['orderId'].toString();
      // Navigate to order detail, replacing checkout + cart in the stack
      Navigator.of(context).pushAndRemoveUntil(
        MaterialPageRoute(builder: (_) => OrderDetailScreen(orderId: orderId)),
        (route) => route.isFirst,
      );
    } else {
      setState(
        () => _error = res['message']?.toString() ?? 'Order failed. Try again.',
      );
    }
  }

  void _showDonationModal() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (_) => StatefulBuilder(
        builder: (context, setModalState) => Padding(
          padding: EdgeInsets.only(
            left: 16,
            right: 16,
            top: 16,
            bottom: MediaQuery.of(context).viewInsets.bottom + 16,
          ),
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Donate Clothes?',
                  style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: 8),
                const Text(
                  'You can donate old clothes and get up to 5% discount on this order after collection.',
                  style: TextStyle(color: Color(0xFF6B7280)),
                ),
                const SizedBox(height: 20),
                const Text(
                  'How many pieces do you have?',
                  style: TextStyle(fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: _donationItemCtrl,
                  keyboardType: TextInputType.number,
                  decoration: InputDecoration(
                    hintText: 'Enter number (1-5)',
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10),
                    ),
                  ),
                ),
                const SizedBox(height: 14),
                const Text(
                  'Notes (optional)',
                  style: TextStyle(fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: _donationNotesCtrl,
                  maxLines: 3,
                  decoration: InputDecoration(
                    hintText: 'Add any notes...',
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10),
                    ),
                  ),
                ),
                const SizedBox(height: 20),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: () => Navigator.pop(context),
                        style: OutlinedButton.styleFrom(
                          minimumSize: const Size.fromHeight(48),
                          side: const BorderSide(color: Color(0xFFD1D5DB)),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(10),
                          ),
                        ),
                        child: const Text('Cancel'),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: FilledButton(
                        onPressed: () {
                          final count =
                              int.tryParse(_donationItemCtrl.text) ?? 0;
                          if (count < 1 || count > 5) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(
                                content: Text('Please enter 1-5 pieces'),
                              ),
                            );
                            return;
                          }
                          setState(() {
                            _donationScheduled = true;
                            _useClothing = true;
                          });
                          Navigator.pop(context);
                        },
                        style: FilledButton.styleFrom(
                          backgroundColor: const Color(0xFF16A34A),
                          minimumSize: const Size.fromHeight(48),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(10),
                          ),
                        ),
                        child: const Text('Schedule Pickup'),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final cartItems = _effectiveItems;
    final subtotal = _effectiveSubtotal;

    // MRP / Listing Price total
    final listingTotal = cartItems.fold(0.0, (sum, i) {
      final mrp = double.tryParse(i.compareRawPrice ?? i.rawPrice) ?? 0.0;
      return sum + mrp * i.quantity;
    });
    final mrpDiscount = (listingTotal - subtotal).clamp(0.0, listingTotal);

    final productUnits = cartItems.fold<int>(0, (sum, i) => sum + i.quantity);
    const platformFee = _platformFeeFlat;
    final shippingPackagingHandlingFee =
        productUnits * _shippingPackagingHandlingPerProduct;

    final referralDiscount = (_useReferral && _availableReferralAmount > 0)
        ? (_availableReferralAmount > subtotal
              ? subtotal
              : _availableReferralAmount)
        : 0.0;
    final clothingDiscount = (_useClothing && _availableClothingPercent > 0)
        ? subtotal * _availableClothingPercent / 100
        : 0.0;
    const firstOrderDiscount = 0.0;
    final spinDiscount = (_useSpinReward && _spinRewardPct > 0)
        ? subtotal * _spinRewardPct / 100
        : 0.0;
    final questDiscount = (_useQuestReward && _questRewardPct > 0)
        ? subtotal * _questRewardPct / 100
        : 0.0;
    final autoOfferDiscount =
        (_selectedAutoOffer >= 0 &&
            _selectedAutoOffer < _kAutoOffers.length &&
            _kAutoOffers[_selectedAutoOffer].isEligible(
              subtotal,
              cartItems.length,
            ))
        ? _kAutoOffers[_selectedAutoOffer].compute(subtotal)
        : 0.0;
    final totalOfferDiscount =
        referralDiscount +
        clothingDiscount +
        firstOrderDiscount +
        spinDiscount +
        questDiscount +
        _couponDiscount +
        autoOfferDiscount;
    final discountedSubtotal = (subtotal - totalOfferDiscount).clamp(
      0.0,
      subtotal,
    );
    final total =
        discountedSubtotal +
        _deliveryFee +
        platformFee +
        shippingPackagingHandlingFee;

    return Scaffold(
      backgroundColor: const Color(0xFFF8F9FA),
      appBar: AppBar(
        title: const Text(
          'Checkout',
          style: TextStyle(fontWeight: FontWeight.w700),
        ),
        backgroundColor: Colors.white,
        foregroundColor: const Color(0xFF0F172A),
        elevation: 0,
        surfaceTintColor: Colors.transparent,
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (_error != null)
            Container(
              margin: const EdgeInsets.only(bottom: 12),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFFFEF2F2),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFFCA5A5)),
              ),
              child: Row(
                children: [
                  const Icon(
                    Icons.error_outline,
                    color: Color(0xFFDC2626),
                    size: 18,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      _error!,
                      style: const TextStyle(color: Color(0xFFDC2626)),
                    ),
                  ),
                  GestureDetector(
                    onTap: () => setState(() => _error = null),
                    child: const Icon(
                      Icons.close,
                      size: 16,
                      color: Color(0xFFDC2626),
                    ),
                  ),
                ],
              ),
            ),

          _SectionHeader(
            title:
                'Order Summary (${cartItems.length} item${cartItems.length != 1 ? "s" : ""})',
          ),
          const SizedBox(height: 8),
          ...cartItems.map(
            (ci) => _CartItemRow(
              item: ci,
              onIncrement: () => _incrementCheckoutItem(ci),
              onDecrement: () => _decrementCheckoutItem(ci),
            ),
          ),
          const SizedBox(height: 16),

          const _SectionHeader(title: 'Delivery Address'),
          const SizedBox(height: 8),
          _loadingAddresses
              ? const Center(
                  child: Padding(
                    padding: EdgeInsets.all(16),
                    child: BfSpinner(),
                  ),
                )
              : Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: const Color(0xFFE5E7EB)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (_addresses.isEmpty)
                        Column(
                          children: [
                            const Text(
                              'No saved addresses. Add one to continue.',
                              style: TextStyle(color: Color(0xFF6B7280)),
                            ),
                            const SizedBox(height: 12),
                            SizedBox(
                              width: double.infinity,
                              child: ElevatedButton.icon(
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: const Color(0xFF166534),
                                  minimumSize: const Size.fromHeight(46),
                                  shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(10),
                                  ),
                                ),
                                onPressed: _showAddAddressSheet,
                                icon: const Icon(Icons.add_location_alt),
                                label: const Text('Add Address'),
                              ),
                            ),
                          ],
                        )
                      else ...[
                        // Address dropdown
                        DropdownButtonFormField<String>(
                          initialValue: _selectedAddressId,
                          decoration: InputDecoration(
                            labelText: 'Select Address',
                            filled: true,
                            fillColor: const Color(0xFFF8FAFC),
                            prefixIcon: const Icon(Icons.location_on, size: 20),
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(10),
                              borderSide:
                                  const BorderSide(color: Color(0xFFE5E7EB)),
                            ),
                            enabledBorder: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(10),
                              borderSide:
                                  const BorderSide(color: Color(0xFFE5E7EB)),
                            ),
                          ),
                          items: _addresses.map((addr) {
                            final id = addr['id'].toString();
                            final line = addr['address_line'] ?? '';
                            final city = addr['city'] ?? '';
                            final label = '$line, $city';
                            return DropdownMenuItem<String>(
                              value: id,
                              child: Text(label, maxLines: 1),
                            );
                          }).toList(),
                          onChanged: (value) {
                            if (value != null) {
                              setState(() => _selectedAddressId = value);
                              _fetchDeliveryFee(value);
                            }
                          },
                        ),
                        const SizedBox(height: 12),
                        // Edit address button
                        SizedBox(
                          width: double.infinity,
                          child: OutlinedButton.icon(
                            style: OutlinedButton.styleFrom(
                              foregroundColor: const Color(0xFF166534),
                              side: const BorderSide(
                                color: Color(0xFF166534),
                              ),
                              minimumSize: const Size.fromHeight(42),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(10),
                              ),
                            ),
                            onPressed: _showAddAddressSheet,
                            icon: const Icon(Icons.edit),
                            label: const Text('Edit Address'),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),

          const SizedBox(height: 16),

          // Receiver section
          const _SectionHeader(title: 'Receiver'),
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: const Color(0xFFE5E7EB)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Own receiver option
                GestureDetector(
                  onTap: () => setState(() => _receiverType = 'own'),
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 10,
                    ),
                    decoration: BoxDecoration(
                      color: _receiverType == 'own'
                          ? const Color(0xFFF0FDF4)
                          : Colors.transparent,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(
                        color: _receiverType == 'own'
                            ? const Color(0xFF166534)
                            : const Color(0xFFE5E7EB),
                      ),
                    ),
                    child: Row(
                      children: [
                        Radio<String>(
                          value: 'own',
                          groupValue: _receiverType,
                          onChanged: (value) {
                            if (value != null) {
                              setState(() => _receiverType = value);
                            }
                          },
                          activeColor: const Color(0xFF166534),
                        ),
                        const SizedBox(width: 8),
                        const Expanded(
                          child: Text(
                            'Deliver to me',
                            style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 10),
                // Someone else option
                GestureDetector(
                  onTap: () => setState(() => _receiverType = 'someone_else'),
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 10,
                    ),
                    decoration: BoxDecoration(
                      color: _receiverType == 'someone_else'
                          ? const Color(0xFFF0FDF4)
                          : Colors.transparent,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(
                        color: _receiverType == 'someone_else'
                            ? const Color(0xFF166534)
                            : const Color(0xFFE5E7EB),
                      ),
                    ),
                    child: Row(
                      children: [
                        Radio<String>(
                          value: 'someone_else',
                          groupValue: _receiverType,
                          onChanged: (value) {
                            if (value != null) {
                              setState(() => _receiverType = value);
                            }
                          },
                          activeColor: const Color(0xFF166534),
                        ),
                        const SizedBox(width: 8),
                        const Expanded(
                          child: Text(
                            'Deliver to someone else',
                            style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                // Show name and phone fields if someone else is selected
                if (_receiverType == 'someone_else') ...[
                  const SizedBox(height: 12),
                  TextField(
                    controller: _receiverNameCtrl,
                    decoration: InputDecoration(
                      labelText: 'Receiver Name',
                      hintText: 'Enter receiver name',
                      filled: true,
                      fillColor: const Color(0xFFF8FAFC),
                      prefixIcon: const Icon(Icons.person, size: 20),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(10),
                        borderSide: const BorderSide(
                          color: Color(0xFFE5E7EB),
                        ),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(10),
                        borderSide: const BorderSide(
                          color: Color(0xFFE5E7EB),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 10),
                  TextField(
                    controller: _receiverPhoneCtrl,
                    decoration: InputDecoration(
                      labelText: 'Receiver Phone',
                      hintText: 'Enter phone number',
                      filled: true,
                      fillColor: const Color(0xFFF8FAFC),
                      prefixIcon: const Icon(Icons.phone, size: 20),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(10),
                        borderSide: const BorderSide(
                          color: Color(0xFFE5E7EB),
                        ),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(10),
                        borderSide: const BorderSide(
                          color: Color(0xFFE5E7EB),
                        ),
                      ),
                    ),
                    keyboardType: TextInputType.phone,
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: 16),

          const _SectionHeader(title: 'Delivery Time'),
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: const Color(0xFFE5E7EB)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Fixed delivery: same day, next day (not scheduled), or 2+ days
                if ((_deliveryType == 'sameday' ||
                        _deliveryType == 'nextday' ||
                        _deliveryType == '2days') &&
                    _deliveryType != 'nextday_scheduled_local' &&
                    _deliveryType != 'nextday_scheduled_extended')
                  _deliveryModeTile(
                    title: _todayDeliveryLabel(),
                    subtitle: _todayDeliverySubtitle(),
                    selected: true,
                    enabled: false,
                    onTap: () {},
                  )
                // Next-day scheduled (for after 21:00, ≤45km): show time slot selection directly
                else if (_deliveryType == 'nextday_scheduled_local' ||
                    _deliveryType == 'nextday_scheduled_extended') ...[
                  _deliveryModeTile(
                    title: _todayDeliveryLabel(),
                    subtitle: _todayDeliverySubtitle(),
                    selected: true,
                    enabled: false,
                    onTap: () {},
                  ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<int>(
                    initialValue: _selectedTomorrowSlotIndex,
                    decoration: InputDecoration(
                      labelText: 'Select delivery time',
                      labelStyle: const TextStyle(
                        color: Color(0xFF166534),
                        fontWeight: FontWeight.w600,
                      ),
                      filled: true,
                      fillColor: const Color(0xFFF0FDF4),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(10),
                        borderSide:
                            const BorderSide(color: Color(0xFF166534), width: 2),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(10),
                        borderSide:
                            const BorderSide(color: Color(0xFF166534), width: 2),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(10),
                        borderSide:
                            const BorderSide(color: Color(0xFF166534), width: 3),
                      ),
                      contentPadding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 14,
                      ),
                      suffixIcon: const Padding(
                        padding: EdgeInsets.only(right: 8),
                        child: Icon(
                          Icons.schedule,
                          color: Color(0xFF166534),
                          size: 20,
                        ),
                      ),
                    ),
                    dropdownColor: Colors.white,
                    items: List.generate(_getSlotList().length, (i) {
                      final label = _slotLabel(_getSlotList()[i]);
                      final isSelected = i == _selectedTomorrowSlotIndex;
                      return DropdownMenuItem<int>(
                        value: i,
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 4,
                          ),
                          decoration: BoxDecoration(
                            color: isSelected
                                ? const Color(0xFFD1FAE5)
                                : Colors.transparent,
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text(
                            label,
                            style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w600,
                              color: isSelected
                                  ? const Color(0xFF166534)
                                  : const Color(0xFF1F2937),
                            ),
                          ),
                        ),
                      );
                    }),
                    onChanged: (value) {
                      if (value == null) return;
                      setState(() => _selectedTomorrowSlotIndex = value);
                    },
                  ),
                ]
                // Fast delivery (local and extended): show today/tomorrow with time slot options
                else ...[
                  _deliveryModeTile(
                    title: _todayDeliveryLabel(),
                    subtitle: _todayDeliverySubtitle(),
                    selected: !_deliverTomorrow,
                    enabled: true,
                    onTap: () => setState(() => _deliverTomorrow = false),
                  ),
                  const Divider(height: 8),
                  _deliveryModeTile(
                    title: 'Schedule for Tomorrow',
                    subtitle: 'Select a slot between 7:30 AM and 9:00 PM',
                    selected: _deliverTomorrow,
                    enabled: true,
                    onTap: () => setState(() => _deliverTomorrow = true),
                  ),
                  if (_deliverTomorrow) ...[
                    const SizedBox(height: 6),
                    DropdownButtonFormField<int>(
                      initialValue: _selectedTomorrowSlotIndex,
                      decoration: InputDecoration(
                        labelText: 'Tomorrow delivery slot',
                        labelStyle: const TextStyle(
                          color: Color(0xFF166534),
                          fontWeight: FontWeight.w600,
                        ),
                        filled: true,
                        fillColor: const Color(0xFFF0FDF4),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(10),
                          borderSide: const BorderSide(
                            color: Color(0xFF166534),
                            width: 2,
                          ),
                        ),
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(10),
                          borderSide: const BorderSide(
                            color: Color(0xFF166534),
                            width: 2,
                          ),
                        ),
                        focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(10),
                          borderSide: const BorderSide(
                            color: Color(0xFF166534),
                            width: 3,
                          ),
                        ),
                        contentPadding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 14,
                        ),
                        suffixIcon: const Padding(
                          padding: EdgeInsets.only(right: 8),
                          child: Icon(
                            Icons.schedule,
                            color: Color(0xFF166534),
                            size: 20,
                          ),
                        ),
                      ),
                      dropdownColor: Colors.white,
                      items: List.generate(_tomorrowSlots.length, (i) {
                        final label = _slotLabel(_tomorrowSlots[i]);
                        final isSelected = i == _selectedTomorrowSlotIndex;
                        return DropdownMenuItem<int>(
                          value: i,
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 8,
                              vertical: 4,
                            ),
                            decoration: BoxDecoration(
                              color: isSelected
                                  ? const Color(0xFFD1FAE5)
                                  : Colors.transparent,
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(
                              label,
                              style: TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w600,
                                color: isSelected
                                    ? const Color(0xFF166534)
                                    : const Color(0xFF1F2937),
                              ),
                            ),
                          ),
                        );
                      }),
                      onChanged: (value) {
                        if (value == null) return;
                        setState(() => _selectedTomorrowSlotIndex = value);
                      },
                    ),
                  ],
                ],
              ],
            ),
          ),
          const SizedBox(height: 16),

          // Donation prompt section
          if (!_donationScheduled && _availableClothingPercent < 5)
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: const Color(0xFFF0FDF4),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFBDCFCE7)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Row(
                    children: [
                      Icon(
                        Icons.recycling_rounded,
                        color: Color(0xFF16A34A),
                        size: 20,
                      ),
                      SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          'Are you willing to donate clothes?',
                          style: TextStyle(
                            fontWeight: FontWeight.w600,
                            color: Color(0xFF166534),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Get up to 5% discount on this order after collection',
                    style: TextStyle(fontSize: 13, color: Color(0xFF4B5563)),
                  ),
                  const SizedBox(height: 10),
                  FilledButton(
                    onPressed: _showDonationModal,
                    style: FilledButton.styleFrom(
                      backgroundColor: const Color(0xFF16A34A),
                      minimumSize: const Size.fromHeight(40),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8),
                      ),
                    ),
                    child: const Text(
                      'Schedule Pickup',
                      style: TextStyle(fontWeight: FontWeight.w600),
                    ),
                  ),
                ],
              ),
            ),
          if (_donationScheduled)
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: const Color(0xFFF0FDF4),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFBDCFCE7)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.check_circle, color: Color(0xFF16A34A)),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Pickup scheduled!',
                          style: TextStyle(
                            fontWeight: FontWeight.w600,
                            color: Color(0xFF166534),
                          ),
                        ),
                        Text(
                          '${_donationItemCtrl.text} piece(s) • discount will be applied after collection',
                          style: const TextStyle(
                            fontSize: 12,
                            color: Color(0xFF4B5563),
                          ),
                        ),
                      ],
                    ),
                  ),
                  GestureDetector(
                    onTap: () => setState(() {
                      _donationScheduled = false;
                      _donationItemCtrl.text = '1';
                      _donationNotesCtrl.clear();
                      _useClothing = false;
                    }),
                    child: const Icon(
                      Icons.close,
                      size: 18,
                      color: Color(0xFF9CA3AF),
                    ),
                  ),
                ],
              ),
            ),
          const SizedBox(height: 16),

          // ── Offers & Coupons ───────────────────────────────────────────
          const _SectionHeader(title: 'Offers & Coupons'),
          const SizedBox(height: 8),
          Container(
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: const Color(0xFFE5E7EB)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // ── Auto offer cards (horizontal scroll) ──────────────────
                Padding(
                  padding: const EdgeInsets.fromLTRB(14, 14, 0, 12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Available Offers',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                          color: Color(0xFF374151),
                        ),
                      ),
                      const SizedBox(height: 10),
                      SizedBox(
                        height: 108,
                        child: ListView.separated(
                          scrollDirection: Axis.horizontal,
                          padding: const EdgeInsets.only(right: 14),
                          itemCount: _kAutoOffers.length,
                          separatorBuilder: (_, _) => const SizedBox(width: 8),
                          itemBuilder: (_, i) {
                            final offer = _kAutoOffers[i];
                            final eligible = offer.isEligible(
                              subtotal,
                              cartItems.length,
                            );
                            final selected =
                                _selectedAutoOffer == i && eligible;
                            final hint = offer.unlockHint(
                              subtotal,
                              cartItems.length,
                            );
                            return GestureDetector(
                              onTap: eligible
                                  ? () {
                                      if (selected) {
                                        _toggleExclusiveOffer('auto', false);
                                      } else {
                                        _toggleExclusiveOffer(
                                          'auto',
                                          true,
                                          autoIndex: i,
                                        );
                                      }
                                    }
                                  : null,
                              child: AnimatedContainer(
                                duration: const Duration(milliseconds: 200),
                                width: 130,
                                padding: const EdgeInsets.all(10),
                                decoration: BoxDecoration(
                                  color: selected
                                      ? offer.color.withValues(alpha: 0.08)
                                      : eligible
                                      ? const Color(0xFFF8FAFC)
                                      : const Color(0xFFF1F5F9),
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(
                                    color: selected
                                        ? offer.color
                                        : eligible
                                        ? offer.color.withValues(alpha: 0.35)
                                        : const Color(0xFFE2E8F0),
                                    width: selected ? 2 : 1.2,
                                  ),
                                ),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      children: [
                                        Text(
                                          offer.emoji,
                                          style: TextStyle(
                                            fontSize: 20,
                                            color: eligible
                                                ? null
                                                : Colors.grey,
                                          ),
                                        ),
                                        const Spacer(),
                                        if (selected)
                                          Icon(
                                            Icons.check_circle_rounded,
                                            color: offer.color,
                                            size: 16,
                                          ),
                                      ],
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      offer.title,
                                      style: TextStyle(
                                        fontSize: 13,
                                        fontWeight: FontWeight.w800,
                                        color: eligible
                                            ? offer.color
                                            : const Color(0xFF9CA3AF),
                                      ),
                                    ),
                                    Text(
                                      offer.description,
                                      style: const TextStyle(
                                        fontSize: 10.5,
                                        color: Color(0xFF6B7280),
                                      ),
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                    const Spacer(),
                                    Container(
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: 6,
                                        vertical: 2,
                                      ),
                                      decoration: BoxDecoration(
                                        color: selected
                                            ? offer.color
                                            : eligible
                                            ? offer.color.withValues(
                                                alpha: 0.12,
                                              )
                                            : const Color(0xFFE2E8F0),
                                        borderRadius: BorderRadius.circular(6),
                                      ),
                                      child: Text(
                                        selected
                                            ? 'Applied ✓'
                                            : eligible
                                            ? 'Tap to apply'
                                            : hint ?? 'Locked',
                                        style: TextStyle(
                                          fontSize: 9,
                                          fontWeight: FontWeight.w700,
                                          color: selected
                                              ? Colors.white
                                              : eligible
                                              ? offer.color
                                              : const Color(0xFF9CA3AF),
                                        ),
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            );
                          },
                        ),
                      ),
                    ],
                  ),
                ),
                const Divider(height: 1),
                // Coupon code input
                Padding(
                  padding: const EdgeInsets.fromLTRB(14, 14, 14, 10),
                  child: Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: _couponCtrl,
                          textCapitalization: TextCapitalization.characters,
                          enabled: !_couponApplied,
                          decoration: InputDecoration(
                            hintText: 'Enter coupon code',
                            prefixIcon: const Icon(
                              Icons.local_offer_outlined,
                              color: Color(0xFF16A34A),
                              size: 20,
                            ),
                            filled: true,
                            fillColor: const Color(0xFFF8FAFC),
                            contentPadding: const EdgeInsets.symmetric(
                              horizontal: 14,
                              vertical: 10,
                            ),
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(10),
                              borderSide: const BorderSide(
                                color: Color(0xFFE5E7EB),
                              ),
                            ),
                            enabledBorder: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(10),
                              borderSide: const BorderSide(
                                color: Color(0xFFE5E7EB),
                              ),
                            ),
                            focusedBorder: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(10),
                              borderSide: const BorderSide(
                                color: Color(0xFF16A34A),
                              ),
                            ),
                            isDense: true,
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      ElevatedButton(
                        onPressed: _couponApplied ? null : _applyCoupon,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF16A34A),
                          foregroundColor: Colors.white,
                          disabledBackgroundColor: const Color(
                            0xFF16A34A,
                          ).withValues(alpha: 0.5),
                          padding: const EdgeInsets.symmetric(
                            horizontal: 16,
                            vertical: 13,
                          ),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(10),
                          ),
                          elevation: 0,
                        ),
                        child: Text(
                          _couponApplied ? 'Applied ✓' : 'Apply',
                          style: const TextStyle(
                            fontWeight: FontWeight.w700,
                            fontSize: 13,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                // Applied badge
                if (_couponApplied)
                  Container(
                    margin: const EdgeInsets.fromLTRB(14, 0, 14, 12),
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 8,
                    ),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF0FDF4),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: const Color(0xFFD1FAE5)),
                    ),
                    child: Row(
                      children: [
                        const Icon(
                          Icons.check_circle,
                          color: Color(0xFF16A34A),
                          size: 16,
                        ),
                        const SizedBox(width: 6),
                        Expanded(
                          child: Text(
                            'Coupon \u2018$_appliedCouponCode\u2019 applied!',
                            style: const TextStyle(
                              color: Color(0xFF166534),
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                        Text(
                          '- \u20b9${_couponDiscount.toStringAsFixed(0)}',
                          style: const TextStyle(
                            color: Color(0xFF16A34A),
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const SizedBox(width: 6),
                        GestureDetector(
                          onTap: () => setState(() {
                            _couponApplied = false;
                            _appliedCouponCode = '';
                            _couponDiscount = 0;
                            _couponCtrl.clear();
                          }),
                          child: const Icon(
                            Icons.close,
                            size: 16,
                            color: Color(0xFF9CA3AF),
                          ),
                        ),
                      ],
                    ),
                  ),
                // Spin Wheel reward
                if (_spinRewardPct > 0) ...[
                  const Divider(height: 1),
                  SwitchListTile(
                    value: _useSpinReward,
                    activeThumbColor: const Color(0xFF16A34A),
                    onChanged: (v) => _toggleExclusiveOffer('spin', v),
                    secondary: Container(
                      width: 36,
                      height: 36,
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: [Color(0xFFEC4899), Color(0xFFBE185D)],
                        ),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: const Icon(
                        Icons.casino_outlined,
                        color: Colors.white,
                        size: 18,
                      ),
                    ),
                    title: Text(
                      'Spin & Win: ${_spinRewardPct.toStringAsFixed(0)}% Off',
                      style: const TextStyle(
                        fontWeight: FontWeight.w600,
                        fontSize: 14,
                      ),
                    ),
                    subtitle: Text(
                      'Save \u20b9${(_effectiveSubtotal * _spinRewardPct / 100).toStringAsFixed(0)} on this order',
                    ),
                  ),
                ],
                // Fashion Quest reward
                if (_questRewardPct > 0) ...[
                  const Divider(height: 1),
                  SwitchListTile(
                    value: _useQuestReward,
                    activeThumbColor: const Color(0xFF16A34A),
                    onChanged: (v) => _toggleExclusiveOffer('quest', v),
                    secondary: Container(
                      width: 36,
                      height: 36,
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: [Color(0xFF7C3AED), Color(0xFF0EA5E9)],
                        ),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: const Icon(
                        Icons.videogame_asset_rounded,
                        color: Colors.white,
                        size: 18,
                      ),
                    ),
                    title: Text(
                      'Fashion Quest: ${_questRewardPct.toStringAsFixed(1)}% Off',
                      style: const TextStyle(
                        fontWeight: FontWeight.w600,
                        fontSize: 14,
                      ),
                    ),
                    subtitle: Text(
                      'Save \u20b9${(_effectiveSubtotal * _questRewardPct / 100).toStringAsFixed(0)} \u00b7 earned from game levels',
                    ),
                  ),
                ],
                // Empty hint
                if (_spinRewardPct == 0 &&
                    _questRewardPct == 0 &&
                    !_couponApplied)
                  const Padding(
                    padding: EdgeInsets.fromLTRB(14, 0, 14, 14),
                    child: Row(
                      children: [
                        Icon(
                          Icons.lightbulb_outline,
                          color: Color(0xFF9CA3AF),
                          size: 16,
                        ),
                        SizedBox(width: 6),
                        Expanded(
                          child: Text(
                            'Play Spin & Win or Fashion Quest to earn discount rewards!',
                            style: TextStyle(
                              color: Color(0xFF9CA3AF),
                              fontSize: 12,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          if (_availableReferralAmount > 0 || _availableClothingItems > 0) ...[
            const _SectionHeader(title: 'Rewards & Offers'),
            const SizedBox(height: 8),
            Container(
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: const Color(0xFFE5E7EB)),
              ),
              child: Column(
                children: [
                  if (_availableReferralAmount > 0)
                    SwitchListTile(
                      value: _useReferral,
                      activeThumbColor: const Color(0xFF16A34A),
                      onChanged: (v) => _toggleExclusiveOffer('referral', v),
                      title: Text(
                        'Apply ₹${_availableReferralAmount.toStringAsFixed(0)} referral reward',
                        style: const TextStyle(fontWeight: FontWeight.w600),
                      ),
                      subtitle: const Text('Flat off on this order'),
                      secondary: const Icon(
                        Icons.card_giftcard,
                        color: Color(0xFF16A34A),
                      ),
                    ),
                  if (_availableReferralAmount > 0 &&
                      _availableClothingItems > 0)
                    const Divider(height: 1),
                  if (_availableClothingItems > 0)
                    SwitchListTile(
                      value: _useClothing,
                      activeThumbColor: const Color(0xFF16A34A),
                      onChanged: (v) => _toggleExclusiveOffer('clothing', v),
                      title: Text(
                        'Use $_availableClothingPercent% donation discount',
                        style: const TextStyle(fontWeight: FontWeight.w600),
                      ),
                      subtitle: Text(
                        'From $_availableClothingItems donated cloth item${_availableClothingItems == 1 ? '' : 's'} — max 5% on this order',
                      ),
                      secondary: const Icon(
                        Icons.recycling_rounded,
                        color: Color(0xFF16A34A),
                      ),
                    ),
                ],
              ),
            ),
            const SizedBox(height: 16),
          ],

          const _SectionHeader(title: 'Bill Summary'),
          const SizedBox(height: 4),
          const Padding(
            padding: EdgeInsets.only(bottom: 8),
            child: Text(
              'GSTIN: 21AAOCB8427B1ZY',
              style: TextStyle(fontSize: 11, color: Color(0xFF9CA3AF)),
            ),
          ),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: const Color(0xFFE5E7EB)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // ── MRP / Selling Price ───────────────────────────────────
                if (mrpDiscount > 0) ...[
                  _PriceRow(
                    label: 'Listing Price (MRP)',
                    value: '₹${listingTotal.toStringAsFixed(0)}',
                    labelStyle: const TextStyle(
                      fontSize: 13,
                      color: Color(0xFF9CA3AF),
                      decoration: TextDecoration.lineThrough,
                    ),
                    valueStyle: const TextStyle(
                      fontSize: 13,
                      color: Color(0xFF9CA3AF),
                      decoration: TextDecoration.lineThrough,
                    ),
                  ),
                  const SizedBox(height: 6),
                  _PriceRow(
                    label: 'Selling Price',
                    value: '₹${subtotal.toStringAsFixed(0)}',
                  ),
                  const SizedBox(height: 6),
                  _PriceRow(
                    label: 'Discount on MRP',
                    value: '- ₹${mrpDiscount.toStringAsFixed(0)}',
                    valueColor: const Color(0xFF16A34A),
                  ),
                ] else
                  _PriceRow(
                    label: 'Item Total',
                    value: '₹${subtotal.toStringAsFixed(0)}',
                  ),
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 10),
                  child: Divider(height: 1, color: Color(0xFFF3F4F6)),
                ),
                // ── Delivery ─────────────────────────────────────────────
                const _PriceRow(
                  label: 'Delivery Charges',
                  value: 'FREE',
                  valueColor: Color(0xFF16A34A),
                ),
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 10),
                  child: Divider(height: 1, color: Color(0xFFF3F4F6)),
                ),
                // ── Offer discounts ───────────────────────────────────────
                _PriceRow(
                  label: 'Offer Discount',
                  value: totalOfferDiscount > 0
                      ? '- ₹${totalOfferDiscount.toStringAsFixed(0)}'
                      : '₹0',
                  valueColor: totalOfferDiscount > 0
                      ? const Color(0xFF16A34A)
                      : const Color(0xFF9CA3AF),
                ),
                if (totalOfferDiscount > 0) ...[
                  const SizedBox(height: 6),
                  if (referralDiscount > 0)
                    Padding(
                      padding: const EdgeInsets.only(left: 12),
                      child: _PriceRow(
                        label: '↳ Referral Reward',
                        value: '- ₹${referralDiscount.toStringAsFixed(0)}',
                        valueColor: const Color(0xFF16A34A),
                        labelStyle: const TextStyle(
                          fontSize: 12,
                          color: Color(0xFF6B7280),
                        ),
                        valueStyle: const TextStyle(
                          fontSize: 12,
                          color: Color(0xFF16A34A),
                        ),
                      ),
                    ),
                  if (clothingDiscount > 0)
                    Padding(
                      padding: const EdgeInsets.only(left: 12, top: 4),
                      child: _PriceRow(
                        label:
                            '↳ Donation (${_availableClothingPercent.clamp(0, 5)}%)',
                        value: '- ₹${clothingDiscount.toStringAsFixed(0)}',
                        valueColor: const Color(0xFF16A34A),
                        labelStyle: const TextStyle(
                          fontSize: 12,
                          color: Color(0xFF6B7280),
                        ),
                        valueStyle: const TextStyle(
                          fontSize: 12,
                          color: Color(0xFF16A34A),
                        ),
                      ),
                    ),
                  if (firstOrderDiscount > 0)
                    Padding(
                      padding: const EdgeInsets.only(left: 12, top: 4),
                      child: _PriceRow(
                        label: '↳ First Order 50% (up to ₹300)',
                        value: '- ₹${firstOrderDiscount.toStringAsFixed(0)}',
                        valueColor: const Color(0xFF16A34A),
                        labelStyle: const TextStyle(
                          fontSize: 12,
                          color: Color(0xFF6B7280),
                        ),
                        valueStyle: const TextStyle(
                          fontSize: 12,
                          color: Color(0xFF16A34A),
                        ),
                      ),
                    ),
                  if (spinDiscount > 0)
                    Padding(
                      padding: const EdgeInsets.only(left: 12, top: 4),
                      child: _PriceRow(
                        label:
                            '↳ Spin & Win (${_spinRewardPct.toStringAsFixed(0)}%)',
                        value: '- ₹${spinDiscount.toStringAsFixed(0)}',
                        valueColor: const Color(0xFF16A34A),
                        labelStyle: const TextStyle(
                          fontSize: 12,
                          color: Color(0xFF6B7280),
                        ),
                        valueStyle: const TextStyle(
                          fontSize: 12,
                          color: Color(0xFF16A34A),
                        ),
                      ),
                    ),
                  if (questDiscount > 0)
                    Padding(
                      padding: const EdgeInsets.only(left: 12, top: 4),
                      child: _PriceRow(
                        label:
                            '↳ Fashion Quest (${_questRewardPct.toStringAsFixed(1)}%)',
                        value: '- ₹${questDiscount.toStringAsFixed(0)}',
                        valueColor: const Color(0xFF16A34A),
                        labelStyle: const TextStyle(
                          fontSize: 12,
                          color: Color(0xFF6B7280),
                        ),
                        valueStyle: const TextStyle(
                          fontSize: 12,
                          color: Color(0xFF16A34A),
                        ),
                      ),
                    ),
                  if (_couponDiscount > 0)
                    Padding(
                      padding: const EdgeInsets.only(left: 12, top: 4),
                      child: _PriceRow(
                        label: '↳ Coupon ($_appliedCouponCode)',
                        value: '- ₹${_couponDiscount.toStringAsFixed(0)}',
                        valueColor: const Color(0xFF16A34A),
                        labelStyle: const TextStyle(
                          fontSize: 12,
                          color: Color(0xFF6B7280),
                        ),
                        valueStyle: const TextStyle(
                          fontSize: 12,
                          color: Color(0xFF16A34A),
                        ),
                      ),
                    ),
                  if (autoOfferDiscount > 0)
                    Padding(
                      padding: const EdgeInsets.only(left: 12, top: 4),
                      child: _PriceRow(
                        label: '↳ ${_kAutoOffers[_selectedAutoOffer].title}',
                        value: '- ₹${autoOfferDiscount.toStringAsFixed(0)}',
                        valueColor: const Color(0xFF16A34A),
                        labelStyle: const TextStyle(
                          fontSize: 12,
                          color: Color(0xFF6B7280),
                        ),
                        valueStyle: const TextStyle(
                          fontSize: 12,
                          color: Color(0xFF16A34A),
                        ),
                      ),
                    ),
                ],
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 10),
                  child: Divider(height: 1, color: Color(0xFFF3F4F6)),
                ),
                // ── Total Fees ────────────────────────────────────────────
                _PriceRow(
                  label: 'Total Fees',
                  value:
                      '₹${(platformFee + shippingPackagingHandlingFee).toStringAsFixed(0)}',
                ),
                const SizedBox(height: 4),
                Padding(
                  padding: const EdgeInsets.only(left: 12),
                  child: _PriceRow(
                    label: '↳ Platform Fee',
                    value: '₹${platformFee.toStringAsFixed(0)}',
                    labelStyle: const TextStyle(
                      fontSize: 12,
                      color: Color(0xFF6B7280),
                    ),
                    valueStyle: const TextStyle(
                      fontSize: 12,
                      color: Color(0xFF6B7280),
                    ),
                  ),
                ),
                const SizedBox(height: 4),
                Padding(
                  padding: const EdgeInsets.only(left: 12),
                  child: _PriceRow(
                    label:
                        '↳ Shipping, Packaging & Handling ($productUnits items)',
                    value:
                        '₹${shippingPackagingHandlingFee.toStringAsFixed(0)}',
                    labelStyle: const TextStyle(
                      fontSize: 12,
                      color: Color(0xFF6B7280),
                    ),
                    valueStyle: const TextStyle(
                      fontSize: 12,
                      color: Color(0xFF6B7280),
                    ),
                  ),
                ),
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 10),
                  child: Divider(height: 1),
                ),
                // ── Total Payable ─────────────────────────────────────────
                _PriceRow(
                  label: 'Total Payable',
                  value: '₹${total.toStringAsFixed(0)}',
                  bold: true,
                ),
                if (mrpDiscount + totalOfferDiscount > 0)
                  Padding(
                    padding: const EdgeInsets.only(top: 10),
                    child: Container(
                      width: double.infinity,
                      padding: const EdgeInsets.symmetric(
                        vertical: 8,
                        horizontal: 12,
                      ),
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: [Color(0xFF16A34A), Color(0xFF15803D)],
                        ),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        '🎉 You save ₹${(mrpDiscount + totalOfferDiscount).toStringAsFixed(0)} on this order!',
                        style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w700,
                          fontSize: 12.5,
                        ),
                        textAlign: TextAlign.center,
                      ),
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: const Color(0xFFECFDF5),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: const Color(0xFF86EFAC)),
            ),
            child: const Row(
              children: [
                CircleAvatar(
                  backgroundColor: Colors.white,
                  child: Icon(
                    Icons.payments_outlined,
                    color: Color(0xFF16A34A),
                  ),
                ),
                SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Cash on Delivery',
                        style: TextStyle(
                          fontWeight: FontWeight.w700,
                          color: Color(0xFF166534),
                        ),
                      ),
                      Text(
                        'Pay when your order arrives',
                        style: TextStyle(
                          color: Color(0xFF4B5563),
                          fontSize: 13,
                        ),
                      ),
                    ],
                  ),
                ),
                Icon(Icons.check_circle, color: Color(0xFF16A34A)),
              ],
            ),
          ),
          const SizedBox(height: 90),
        ],
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              FilledButton(
                style: FilledButton.styleFrom(
                  backgroundColor: const Color(0xFF16A34A),
                  minimumSize: const Size.fromHeight(52),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                  ),
                ),
                onPressed: (_placingOrder || _hasUnavailableItems())
                    ? null
                    : _placeOrder,
                child: _placingOrder
                    ? const SizedBox(width: 24, height: 24, child: BfSpinner())
                    : Text(
                        'Place Order  ₹${total.toStringAsFixed(0)}',
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _deliveryModeTile({
    required String title,
    required String? subtitle,
    required bool selected,
    required bool enabled,
    required VoidCallback onTap,
  }) {
    final activeColor = selected
        ? const Color(0xFF16A34A)
        : const Color(0xFF9CA3AF);
    return InkWell(
      onTap: enabled ? onTap : null,
      borderRadius: BorderRadius.circular(10),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 2, vertical: 6),
        child: Row(
          children: [
            Icon(
              selected
                  ? Icons.radio_button_checked_rounded
                  : Icons.radio_button_off_rounded,
              color: enabled ? activeColor : const Color(0xFFD1D5DB),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: TextStyle(
                      fontWeight: FontWeight.w600,
                      fontSize: 13.5,
                      color: enabled
                          ? const Color(0xFF0F172A)
                          : const Color(0xFF9CA3AF),
                    ),
                  ),
                  if (subtitle != null)
                    Padding(
                      padding: const EdgeInsets.only(top: 2),
                      child: Text(
                        subtitle,
                        style: const TextStyle(
                          fontSize: 12,
                          color: Color(0xFF6B7280),
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Helper Widgets ────────────────────────────────────────────────────────────

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({required this.title});
  final String title;
  @override
  Widget build(BuildContext context) => Text(
    title,
    style: const TextStyle(
      fontWeight: FontWeight.w700,
      fontSize: 15,
      color: Color(0xFF0F172A),
    ),
  );
}

class _CartItemRow extends StatelessWidget {
  const _CartItemRow({
    required this.item,
    required this.onIncrement,
    required this.onDecrement,
  });
  final CartItem item;
  final VoidCallback onIncrement;
  final VoidCallback onDecrement;

  @override
  Widget build(BuildContext context) {
    final stockLimit = item.availableStock;
    final outOfStock = stockLimit != null && stockLimit <= 0;
    final exceedsStock = stockLimit != null && item.quantity > stockLimit;
    final canIncrement = stockLimit == null || item.quantity < stockLimit;

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: outOfStock ? const Color(0xFFFFF7ED) : Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: (outOfStock || exceedsStock)
              ? const Color(0xFFFCA5A5)
              : const Color(0xFFE5E7EB),
        ),
      ),
      child: Row(
        children: [
          if (item.imageUrl != null)
            ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: Image.network(
                item.imageUrl!,
                width: 54,
                height: 54,
                fit: BoxFit.cover,
                errorBuilder: (c, e, s) => const SizedBox(
                  width: 54,
                  height: 54,
                  child: Icon(Icons.image_outlined),
                ),
              ),
            )
          else
            const SizedBox(
              width: 54,
              height: 54,
              child: Icon(Icons.image_outlined),
            ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  item.name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontWeight: FontWeight.w600),
                ),
                Text(
                  '${item.color} · ${item.size}  ×${item.quantity}',
                  style: const TextStyle(
                    color: Color(0xFF6B7280),
                    fontSize: 12,
                  ),
                ),
                if (stockLimit != null)
                  Text(
                    outOfStock ? 'Unavailable for now' : 'Stock: $stockLimit',
                    style: TextStyle(
                      color: outOfStock
                          ? const Color(0xFFDC2626)
                          : const Color(0xFF6B7280),
                      fontSize: 12,
                      fontWeight: outOfStock
                          ? FontWeight.w700
                          : FontWeight.w500,
                    ),
                  ),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                '₹${((double.tryParse(item.rawPrice) ?? 0) * item.quantity).toStringAsFixed(0)}',
                style: const TextStyle(fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 8),
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  _QtyBtn(icon: Icons.remove, onTap: onDecrement),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 8),
                    child: Text(
                      '${item.quantity}',
                      style: const TextStyle(fontWeight: FontWeight.w700),
                    ),
                  ),
                  _QtyBtn(
                    icon: Icons.add,
                    onTap: canIncrement ? onIncrement : null,
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _QtyBtn extends StatelessWidget {
  const _QtyBtn({required this.icon, required this.onTap});
  final IconData icon;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Opacity(
        opacity: onTap == null ? 0.4 : 1,
        child: Container(
          width: 24,
          height: 24,
          decoration: BoxDecoration(
            border: Border.all(color: const Color(0xFFE5E7EB)),
            borderRadius: BorderRadius.circular(7),
          ),
          child: Icon(icon, size: 14),
        ),
      ),
    );
  }
}

class _PriceRow extends StatelessWidget {
  const _PriceRow({
    required this.label,
    required this.value,
    this.bold = false,
    this.valueColor,
    this.labelStyle,
    this.valueStyle,
  });
  final String label;
  final String value;
  final bool bold;
  final Color? valueColor;
  final TextStyle? labelStyle;
  final TextStyle? valueStyle;

  @override
  Widget build(BuildContext context) {
    final defaultStyle = TextStyle(
      fontWeight: bold ? FontWeight.w800 : FontWeight.w500,
      color: const Color(0xFF0F172A),
      fontSize: bold ? 15 : 13.5,
    );
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: labelStyle ?? defaultStyle),
        Text(
          value,
          style:
              valueStyle ??
              defaultStyle.copyWith(color: valueColor ?? defaultStyle.color),
        ),
      ],
    );
  }
}

// ── Auto Offer model ──────────────────────────────────────────────────────────
class _AutoOffer {
  const _AutoOffer({
    required this.id,
    required this.emoji,
    required this.title,
    required this.description,
    required this.color,
    this.minItems = 0,
    this.minAmount = 0,
    this.flatOff = 0,
    this.pctOff = 0,
  });

  final int id;
  final String emoji;
  final String title;
  final String description;
  final Color color;
  final int minItems;
  final double minAmount;
  final double flatOff;
  final double pctOff;

  bool isEligible(double subtotal, int itemCount) =>
      itemCount >= minItems && subtotal >= minAmount;

  double compute(double subtotal) => flatOff + subtotal * pctOff / 100;

  String? unlockHint(double subtotal, int itemCount) {
    if (isEligible(subtotal, itemCount)) return null;
    final parts = <String>[];
    if (minAmount > 0 && subtotal < minAmount) {
      parts.add('₹${(minAmount - subtotal).toStringAsFixed(0)} more');
    }
    if (minItems > 0 && itemCount < minItems) {
      final need = minItems - itemCount;
      parts.add('$need more item${need > 1 ? 's' : ''}');
    }
    return parts.isEmpty ? 'Locked' : 'Add ${parts.join(' & ')}';
  }
}

// Offer catalogue
const _kAutoOffers = [
  _AutoOffer(
    id: 1,
    emoji: '💰',
    title: '₹100 Off',
    description: 'On orders ₹1,000+',
    color: Color(0xFF059669),
    minAmount: 1000,
    flatOff: 100,
  ),
  _AutoOffer(
    id: 2,
    emoji: '💎',
    title: '₹250 Off',
    description: 'On orders ₹2,000+',
    color: Color(0xFF7C3AED),
    minAmount: 2000,
    flatOff: 250,
  ),
  _AutoOffer(
    id: 3,
    emoji: '🔥',
    title: '₹500 Off',
    description: 'On orders ₹3,500+',
    color: Color(0xFFEA580C),
    minAmount: 3500,
    flatOff: 500,
  ),
  _AutoOffer(
    id: 4,
    emoji: '👑',
    title: '₹750 Off',
    description: 'On orders ₹5,000+',
    color: Color(0xFFCA8A04),
    minAmount: 5000,
    flatOff: 750,
  ),
  _AutoOffer(
    id: 5,
    emoji: '🛍️',
    title: 'Buy 2 • 10% Off',
    description: 'Buy any 2 items',
    color: Color(0xFF2563EB),
    minItems: 2,
    pctOff: 10,
  ),
  _AutoOffer(
    id: 6,
    emoji: '🎁',
    title: 'Buy 3 • 15% Off',
    description: 'Buy any 3 items',
    color: Color(0xFFDB2777),
    minItems: 3,
    pctOff: 15,
  ),
  _AutoOffer(
    id: 7,
    emoji: '✨',
    title: 'Buy 5 • 20% Off',
    description: 'Buy any 5 items',
    color: Color(0xFF9333EA),
    minItems: 5,
    pctOff: 20,
  ),
];
