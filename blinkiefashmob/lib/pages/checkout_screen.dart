import 'package:flutter/material.dart';
import '../services/api_client.dart';
import '../services/cart_manager.dart';
import '../services/user_session.dart';
import 'login_screen.dart';
import 'order_detail_screen.dart';
import '../widgets/bf_loader.dart';

// ignore_for_file: deprecated_member_use

class CheckoutScreen extends StatefulWidget {
  const CheckoutScreen({
    super.key,
    required this.selectedAddressId,
    required this.selectedAddress,
    this.isTryOrder = false,
    this.overrideItems,
  });

  final bool isTryOrder;

  /// The address chosen on the address-selection page (page 1).
  final String selectedAddressId;
  final Map<String, dynamic> selectedAddress;

  /// When provided, these items are used instead of the shared cart.
  /// The shared cart is not cleared after checkout.
  final List<CartItem>? overrideItems;

  @override
  State<CheckoutScreen> createState() => _CheckoutScreenState();
}

class _CheckoutScreenState extends State<CheckoutScreen> {
  final ApiClient _api = ApiClient();
  bool _authRedirectInFlight = false;
  static const double _platformFeeFlat = 0.0;
  static const double _shippingPackagingHandlingPerProduct = 9.0;
  static const double _freeDeliveryThreshold = 999.0;

  List<CartItem> get _effectiveItems {
    // Merge cart items + override items (buy now)
    final cartItems = CartManager.instance.items;
    if (widget.overrideItems != null) {
      return [...cartItems, ...widget.overrideItems!];
    }
    return cartItems;
  }

  double get _effectiveSubtotal => _effectiveItems.fold(0.0, (sum, i) {
    final p = double.tryParse(i.rawPrice) ?? 0.0;
    return sum + p * i.quantity;
  });

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

  // Maximum combined discount allowed from the offers above, in rupees
  static const double _flatOfferDiscount = 50.0;

  // Donation modal state
  final _donationItemCtrl = TextEditingController(text: '1');
  final _donationNotesCtrl = TextEditingController();
  bool _donationScheduled = false;

  // Delivery schedule state
  int _selectedTomorrowSlotIndex = 0;

  // Payment method (display/selection only — order is always COD on the backend today)
  String _paymentMethod = 'cod'; // 'cod' or 'upi'

  /// Name to display in the address summary — falls back to a generic label
  /// when the saved address has no name on file.
  String get _summaryName {
    final n = widget.selectedAddress['name']?.toString().trim() ?? '';
    return n.isNotEmpty ? n : 'Delivery Address';
  }

  /// Phone to display in the address summary — the address's own saved phone.
  String? get _summaryPhone {
    final p = widget.selectedAddress['phone']?.toString().trim() ?? '';
    return p.isNotEmpty ? p : null;
  }

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
      _fetchDeliveryFee(widget.selectedAddressId);
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
            selectedAddressId: widget.selectedAddressId,
            selectedAddress: widget.selectedAddress,
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

  Future<void> _fetchDeliveryFee(String addressId) async {
    final subtotal = _effectiveSubtotal;
    final launchAppliedDiscount = subtotal * 0.02;
    final variantIds = _effectiveItems
        .map((i) => i.productId)
        .where((id) => id.isNotEmpty)
        .toSet()
        .toList();
    final result = await _api.fetchDeliveryFee(
      addressId: addressId,
      subtotal: subtotal,
      variantIds: variantIds,
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
      // Check if item is in override items (buy now)
      if (widget.overrideItems != null &&
          widget.overrideItems!.contains(item)) {
        if (item.quantity > 1) {
          item.quantity--;
        } else {
          widget.overrideItems!.remove(item);
        }
      } else {
        // Item is in cart
        if (item.quantity > 1) {
          CartManager.instance.decrement(item);
        } else {
          CartManager.instance.decrement(item);
        }
      }
    });
  }

  IconData _addressTypeIcon(String? type) {
    switch (type) {
      case 'work':
        return Icons.work_outline;
      case 'other':
        return Icons.location_on_outlined;
      case 'home':
      default:
        return Icons.home_outlined;
    }
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

    // Send discounted subtotal for launch offer.
    final subtotalForOrder = (subtotal - launchAppliedDiscount).clamp(
      0.0,
      subtotal,
    );

    // Auto-schedule only for next-day scheduled delivery types.
    bool isScheduled = false;
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
    // Cap total discount at ₹50 maximum
    manualOfferDiscount = manualOfferDiscount.clamp(0.0, _flatOfferDiscount);

    final res = await _api.placeOrder(
      userId: userId,
      addressId: widget.selectedAddressId,
      items: items,
      totalAmount: subtotalForOrder,
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
                            ScaffoldMessenger.of(context)
                              ..removeCurrentSnackBar()
                              ..showSnackBar(
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
    final launchDisplayedDiscount = subtotal * 0.05;
    final launchAppliedDiscount = subtotal * 0.02;
    final launchAdjustment = (launchDisplayedDiscount - launchAppliedDiscount)
        .clamp(0.0, launchDisplayedDiscount);

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
    final effectiveDeliveryFee =
      subtotal > _freeDeliveryThreshold ? 0.0 : _deliveryFee;

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
        (referralDiscount +
                clothingDiscount +
                firstOrderDiscount +
                spinDiscount +
                questDiscount +
                _couponDiscount +
                autoOfferDiscount)
            .clamp(0.0, _flatOfferDiscount); // Cap at ₹50 maximum
    final discountedSubtotal = (subtotal - totalOfferDiscount).clamp(
      0.0,
      subtotal,
    );
    final total =
        (discountedSubtotal - launchAppliedDiscount).clamp(0.0, discountedSubtotal) +
        effectiveDeliveryFee +
        platformFee +
        shippingPackagingHandlingFee;

    // Show empty state if no items
    if (cartItems.isEmpty) {
      return Scaffold(
        backgroundColor: const Color(0xFFF8FAFC),
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
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                Icons.shopping_bag_outlined,
                size: 80,
                color: const Color(0xFFD1D5DB),
              ),
              const SizedBox(height: 24),
              const Text(
                'Nothing in Checkout',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                  color: Color(0xFF1F2937),
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                'Your checkout is empty',
                style: TextStyle(fontSize: 14, color: Color(0xFF6B7280)),
              ),
              const SizedBox(height: 32),
              ElevatedButton.icon(
                onPressed: () {
                  Navigator.of(context).pop();
                },
                icon: const Icon(Icons.shopping_bag_outlined),
                label: const Text('Start Shopping'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF166534),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(
                    horizontal: 32,
                    vertical: 12,
                  ),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(8),
                  ),
                ),
              ),
            ],
          ),
        ),
      );
    }

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
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
            icon: Icons.shopping_bag_outlined,
          ),
          const SizedBox(height: 8),
          ...cartItems.map(
            (ci) => _CartItemRow(
              item: ci,
              onIncrement: () => _incrementCheckoutItem(ci),
              onDecrement: () => _decrementCheckoutItem(ci),
            ),
          ),
          const SizedBox(height: 10),
          _buildPaymentMethodSelector(),
          const SizedBox(height: 16),

          // ─── OFFERS & DISCOUNTS SECTION ──────────────────────────────────
          const _SectionHeader(
            title: 'Offers & Discounts',
            icon: Icons.local_offer_outlined,
          ),
          const SizedBox(height: 8),
          SizedBox(
            height: 78,
            child: ListView(
              scrollDirection: Axis.horizontal,
              children: [
                _offerChip(
                  emoji: '🚚',
                  title: 'Free Delivery',
                  subtitle: 'First 3 orders',
                  applied: true,
                ),
                const SizedBox(width: 8),
                _offerChip(
                  emoji: '🎡',
                  title: 'Spin & Win',
                  subtitle: _spinRewardPct > 0
                      ? '${_spinRewardPct.toStringAsFixed(0)}% off'
                      : 'Play to unlock',
                  applied: _useSpinReward,
                  available: _spinRewardPct > 0,
                  onTap: () => _toggleExclusiveOffer('spin', !_useSpinReward),
                ),
                const SizedBox(width: 8),
                _offerChip(
                  emoji: '🎮',
                  title: 'Play & Win',
                  subtitle: _questRewardPct > 0
                      ? '${_questRewardPct.toStringAsFixed(0)}% off'
                      : 'Play to unlock',
                  applied: _useQuestReward,
                  available: _questRewardPct > 0,
                  onTap: () => _toggleExclusiveOffer('quest', !_useQuestReward),
                ),
                const SizedBox(width: 8),
                _offerChip(
                  emoji: '👥',
                  title: 'Refer & Earn',
                  subtitle: _availableReferralAmount > 0
                      ? '₹${_availableReferralAmount.toStringAsFixed(0)} off'
                      : 'Refer a friend',
                  applied: _useReferral,
                  available: _availableReferralAmount > 0,
                  onTap: () => _toggleExclusiveOffer('referral', !_useReferral),
                ),
              ],
            ),
          ),
          if (_useSpinReward || _useQuestReward || _useReferral) ...[
            const SizedBox(height: 8),
            Container(
              decoration: BoxDecoration(
                color: const Color(0xFFFEF3C7),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: const Color(0xFFF59E0B)),
              ),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    '✓ Discount Applied',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w500,
                      color: Color(0xFF92400E),
                    ),
                  ),
                  Text(
                    '- ₹${(_useSpinReward
                        ? spinDiscount
                        : _useQuestReward
                        ? questDiscount
                        : referralDiscount).toStringAsFixed(0)}',
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF92400E),
                    ),
                  ),
                ],
              ),
            ),
          ],

          const SizedBox(height: 16),

          const _SectionHeader(
            title: 'Delivery Time',
            icon: Icons.schedule_outlined,
          ),
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
                // Fast delivery (local and extended): fixed immediate delivery promise
                else ...[
                  _deliveryModeTile(
                    title: _todayDeliveryLabel(),
                    subtitle: _todayDeliverySubtitle(),
                    selected: true,
                    enabled: false,
                    onTap: () {},
                  ),
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
                border: Border.all(color: const Color(0xFFDCFCE7)),
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
                border: Border.all(color: const Color(0xFFDCFCE7)),
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

          if (_availableReferralAmount > 0 || _availableClothingItems > 0) ...[
            const _SectionHeader(
              title: 'Rewards & Offers',
              icon: Icons.card_giftcard_outlined,
            ),
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

          const _SectionHeader(
            title: 'Bill Summary',
            icon: Icons.receipt_long_outlined,
          ),
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
                _PriceRow(
                  label: 'Delivery Charges',
                  value: effectiveDeliveryFee > 0
                      ? '₹${effectiveDeliveryFee.toStringAsFixed(0)}'
                      : 'FREE',
                  valueColor: effectiveDeliveryFee > 0
                      ? const Color(0xFF0F172A)
                      : const Color(0xFF16A34A),
                ),
                if (subtotal <= _freeDeliveryThreshold && effectiveDeliveryFee > 0)
                  Padding(
                    padding: const EdgeInsets.only(left: 12, top: 4),
                    child: _PriceRow(
                      label: '↳ Applied for orders up to ₹999',
                      value: '₹${effectiveDeliveryFee.toStringAsFixed(0)}',
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
                  child: Divider(height: 1, color: Color(0xFFF3F4F6)),
                ),
                // ── Offer discounts ───────────────────────────────────────
                _PriceRow(
                  label: 'Offer Discount (5%)',
                  value: '- ₹${launchDisplayedDiscount.toStringAsFixed(0)}',
                  valueColor: launchDisplayedDiscount > 0
                      ? const Color(0xFF16A34A)
                      : const Color(0xFF9CA3AF),
                ),
                if (launchDisplayedDiscount > 0) ...[
                  const SizedBox(height: 6),
                  Padding(
                    padding: const EdgeInsets.only(left: 12),
                    child: _PriceRow(
                      label: '↳ Launch adjustment',
                      value: '+ ₹${launchAdjustment.toStringAsFixed(0)}',
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
                      label: '↳ Applied discount (2%)',
                      value: '- ₹${launchAppliedDiscount.toStringAsFixed(0)}',
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
                    label: '↳ Taxes (GST)',
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
            child: Row(
              children: [
                const CircleAvatar(
                  backgroundColor: Colors.white,
                  child: Icon(
                    Icons.payments_outlined,
                    color: Color(0xFF16A34A),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        _paymentMethod == 'upi'
                            ? 'UPI on Delivery'
                            : 'Cash on Delivery',
                        style: const TextStyle(
                          fontWeight: FontWeight.w700,
                          color: Color(0xFF166534),
                        ),
                      ),
                      const Text(
                        'Pay when your order arrives',
                        style: TextStyle(
                          color: Color(0xFF4B5563),
                          fontSize: 13,
                        ),
                      ),
                    ],
                  ),
                ),
                const Icon(Icons.check_circle, color: Color(0xFF16A34A)),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // ─── DELIVERY ADDRESS (moved to the end) ─────────────────────────
          _buildDeliveryAddressCard(),
          const SizedBox(height: 90),
        ],
      ),
      bottomNavigationBar: SafeArea(
        child: Container(
          padding: const EdgeInsets.fromLTRB(16, 10, 16, 12),
          decoration: BoxDecoration(
            color: Colors.white,
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.06),
                blurRadius: 14,
                offset: const Offset(0, -4),
              ),
            ],
          ),
          child: _placingOrder
              ? FilledButton(
                  style: FilledButton.styleFrom(
                    backgroundColor: const Color(0xFF16A34A),
                    minimumSize: const Size.fromHeight(52),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                  ),
                  onPressed: null,
                  child: const SizedBox(
                    width: 24,
                    height: 24,
                    child: BfSpinner(),
                  ),
                )
              : Row(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            '₹${total.toStringAsFixed(0)}',
                            style: const TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.w800,
                              color: Color(0xFF0F172A),
                            ),
                          ),
                          Text(
                            '${cartItems.length} item${cartItems.length == 1 ? '' : 's'} • Total',
                            style: const TextStyle(
                              fontSize: 11.5,
                              fontWeight: FontWeight.w600,
                              color: Color(0xFF6B7280),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: FilledButton.icon(
                        style: FilledButton.styleFrom(
                          backgroundColor: const Color(0xFF16A34A),
                          minimumSize: const Size.fromHeight(52),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(14),
                          ),
                        ),
                        onPressed: _hasUnavailableItems() ? null : _placeOrder,
                        icon: const Icon(Icons.arrow_forward_rounded, size: 18),
                        label: const Text(
                          'Place Order',
                          style: TextStyle(
                            fontSize: 15.5,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
        ),
      ),
    );
  }

  Widget _buildPaymentMethodSelector() {
    Widget chip(String value, IconData icon, String label) {
      final selected = _paymentMethod == value;
      return Expanded(
        child: GestureDetector(
          onTap: () => setState(() => _paymentMethod = value),
          child: Container(
            padding: const EdgeInsets.symmetric(vertical: 10),
            decoration: BoxDecoration(
              color: selected ? const Color(0xFFF0FDF4) : Colors.white,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(
                color: selected
                    ? const Color(0xFF166534)
                    : const Color(0xFFE5E7EB),
                width: selected ? 1.4 : 1,
              ),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  icon,
                  size: 16,
                  color: selected
                      ? const Color(0xFF166534)
                      : const Color(0xFF6B7280),
                ),
                const SizedBox(width: 6),
                Text(
                  label,
                  style: TextStyle(
                    fontSize: 12.5,
                    fontWeight: FontWeight.w600,
                    color: selected
                        ? const Color(0xFF166534)
                        : const Color(0xFF6B7280),
                  ),
                ),
              ],
            ),
          ),
        ),
      );
    }

    return Row(
      children: [
        chip('cod', Icons.payments_outlined, 'Cash on Delivery'),
        const SizedBox(width: 8),
        chip('upi', Icons.qr_code_scanner, 'UPI on Delivery'),
      ],
    );
  }

  Widget _offerChip({
    required String emoji,
    required String title,
    required String subtitle,
    required bool applied,
    bool available = true,
    VoidCallback? onTap,
  }) {
    final disabled = !available;
    return GestureDetector(
      onTap: disabled ? null : onTap,
      child: Opacity(
        opacity: disabled ? 0.55 : 1,
        child: Container(
          width: 128,
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
            color: disabled
                ? const Color(0xFFF3F4F6)
                : applied
                ? const Color(0xFFFEF3C7)
                : Colors.white,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(
              color: disabled
                  ? const Color(0xFFD1D5DB)
                  : applied
                  ? const Color(0xFFF59E0B)
                  : const Color(0xFFE5E7EB),
              width: applied && !disabled ? 1.4 : 1,
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Row(
                children: [
                  Text(emoji, style: const TextStyle(fontSize: 15)),
                  const SizedBox(width: 4),
                  Expanded(
                    child: Text(
                      title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 11.5,
                        fontWeight: FontWeight.w700,
                        color: disabled
                            ? const Color(0xFF9CA3AF)
                            : const Color(0xFF92400E),
                      ),
                    ),
                  ),
                  if (applied && !disabled)
                    const Icon(
                      Icons.check_circle,
                      size: 14,
                      color: Color(0xFF15803D),
                    ),
                ],
              ),
              const SizedBox(height: 4),
              Text(
                subtitle,
                style: TextStyle(
                  fontSize: 10.5,
                  color: disabled
                      ? const Color(0xFF9CA3AF)
                      : const Color(0xFF78716C),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildDeliveryAddressCard() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const _SectionHeader(
          title: 'Delivery Address',
          icon: Icons.location_on_outlined,
        ),
        const SizedBox(height: 8),
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: const Color(0xFFE5E7EB)),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: const BoxDecoration(
                  color: Color(0xFFF0FDF4),
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  _addressTypeIcon(
                    widget.selectedAddress['address_type']?.toString(),
                  ),
                  color: const Color(0xFF166534),
                  size: 18,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            _summaryName,
                            style: const TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF0F172A),
                            ),
                          ),
                        ),
                        if ((widget.selectedAddress['address_type']
                                    ?.toString() ??
                                '')
                            .isNotEmpty)
                          Container(
                            margin: const EdgeInsets.only(left: 6),
                            padding: const EdgeInsets.symmetric(
                              horizontal: 8,
                              vertical: 2,
                            ),
                            decoration: BoxDecoration(
                              color: const Color(0xFFF0FDF4),
                              borderRadius: BorderRadius.circular(20),
                              border: Border.all(
                                color: const Color(0xFFBBF7D0),
                              ),
                            ),
                            child: Text(
                              (widget.selectedAddress['address_type'] as String)
                                  .toUpperCase(),
                              style: const TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.w700,
                                color: Color(0xFF166534),
                              ),
                            ),
                          ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '${widget.selectedAddress['address_line'] ?? ''}, '
                      '${widget.selectedAddress['city'] ?? ''} - '
                      '${widget.selectedAddress['pincode'] ?? ''}',
                      style: const TextStyle(
                        fontSize: 13,
                        color: Color(0xFF475569),
                        height: 1.4,
                      ),
                    ),
                    if (_summaryPhone != null) ...[
                      const SizedBox(height: 4),
                      Row(
                        children: [
                          const Icon(
                            Icons.phone_outlined,
                            size: 13,
                            color: Color(0xFF64748B),
                          ),
                          const SizedBox(width: 4),
                          Text(
                            _summaryPhone!,
                            style: const TextStyle(
                              fontSize: 12,
                              color: Color(0xFF64748B),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ],
                ),
              ),
              TextButton(
                onPressed: () => Navigator.of(context).pop(),
                style: TextButton.styleFrom(
                  foregroundColor: const Color(0xFF166534),
                  padding: const EdgeInsets.symmetric(horizontal: 4),
                ),
                child: const Text(
                  'Change',
                  style: TextStyle(fontWeight: FontWeight.w700),
                ),
              ),
            ],
          ),
        ),
      ],
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
  const _SectionHeader({required this.title, this.icon});
  final String title;
  final IconData? icon;
  @override
  Widget build(BuildContext context) => Row(
    children: [
      if (icon != null) ...[
        Container(
          width: 26,
          height: 26,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: const Color(0xFFF0FDF4),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Icon(icon, size: 15, color: const Color(0xFF16A34A)),
        ),
        const SizedBox(width: 8),
      ],
      Expanded(child: _SectionHeaderText(title: title)),
    ],
  );
}

class _SectionHeaderText extends StatelessWidget {
  const _SectionHeaderText({required this.title});
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
                cacheWidth: (108 * MediaQuery.of(context).devicePixelRatio).round(),
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
