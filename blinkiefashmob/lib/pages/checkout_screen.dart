import 'package:flutter/material.dart';
import '../models/cart_item.dart';
import '../services/api_client.dart';
import '../services/cart_manager.dart';
import '../services/user_session.dart';
import 'location_picker_screen.dart';
import 'order_detail_screen.dart';

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
  double? _distanceKm;
  bool _calculatingFee = false;
  bool _deliveryAvailable = true;

  // Reward state
  double _availableReferralAmount = 0;
  int _availableClothingItems = 0;
  int _availableClothingPercent = 0;
  bool _useReferral = false;
  bool _useClothing = false;

  // Donation modal state
  final _donationItemCtrl = TextEditingController(text: '1');
  final _donationNotesCtrl = TextEditingController();
  bool _donationScheduled = false;

  @override
  void initState() {
    super.initState();
    _loadAddresses();
    _loadRewards();
  }

  @override
  void dispose() {
    _donationItemCtrl.dispose();
    _donationNotesCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadRewards() async {
    final userId = UserSession.instance.userId;
    if (userId == null) return;
    try {
      final data = await _api.fetchAvailableRewards(userId: userId);
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
    setState(() => _calculatingFee = true);
    final result = await _api.fetchDeliveryFee(
      addressId: addressId,
      subtotal: subtotal,
    );
    if (!mounted) return;
    setState(() {
      _calculatingFee = false;
      final fee = result['fee'];
      _deliveryFee = fee != null ? (fee as num).toDouble() : 0.0;
      final dist = result['distance'];
      _distanceKm = dist != null ? (dist as num).toDouble() : null;
      _deliveryAvailable = result['withinRange'] as bool? ?? true;
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

  Future<void> _placeOrder() async {
    if (_selectedAddressId == null) {
      setState(() => _error = 'Please select a delivery address');
      return;
    }
    if (!_deliveryAvailable) {
      setState(
        () => _error =
            'Delivery is not available beyond 15 km from our nearest store.',
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

    setState(() {
      _placingOrder = true;
      _error = null;
    });

    final items = cartItems
        .map(
          (ci) => {
            'variantId': ci.id,
            'quantity': ci.quantity,
            'price': double.tryParse(ci.rawPrice) ?? 0.0,
          },
        )
        .toList();

    // Send subtotal only — backend calculates final amount with delivery fee
    final subtotal = _effectiveSubtotal;

    final res = await _api.placeOrder(
      userId: userId,
      addressId: _selectedAddressId!,
      items: items,
      totalAmount: subtotal,
      isTryOrder: widget.isTryOrder,
      useReferralReward: _useReferral && _availableReferralAmount > 0,
      useClothingReward: _useClothing && _availableClothingItems > 0,
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
    final referralDiscount = (_useReferral && _availableReferralAmount > 0)
        ? (_availableReferralAmount > subtotal
              ? subtotal
              : _availableReferralAmount)
        : 0.0;
    final clothingDiscount = (_useClothing && _availableClothingPercent > 0)
        ? subtotal * _availableClothingPercent / 100
        : 0.0;
    final discountedSubtotal = (subtotal - referralDiscount - clothingDiscount)
        .clamp(0.0, subtotal);
    final total = discountedSubtotal + _deliveryFee;

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
          ...cartItems.map((ci) => _CartItemRow(item: ci)),
          const SizedBox(height: 16),

          const _SectionHeader(title: 'Delivery Address'),
          const SizedBox(height: 8),
          _loadingAddresses
              ? const Center(
                  child: Padding(
                    padding: EdgeInsets.all(16),
                    child: CircularProgressIndicator(strokeWidth: 2),
                  ),
                )
              : Column(
                  children: [
                    if (_addresses.isEmpty)
                      Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: const Color(0xFFE5E7EB)),
                        ),
                        child: const Text(
                          'No saved addresses. Add one below.',
                          style: TextStyle(color: Color(0xFF6B7280)),
                        ),
                      )
                    else
                      ..._addresses.map(
                        (addr) => _AddressTile(
                          address: addr,
                          selected: _selectedAddressId == addr['id'].toString(),
                          onSelect: () {
                            final id = addr['id'].toString();
                            setState(() => _selectedAddressId = id);
                            _fetchDeliveryFee(id);
                          },
                        ),
                      ),
                    const SizedBox(height: 10),
                    OutlinedButton.icon(
                      style: OutlinedButton.styleFrom(
                        foregroundColor: const Color(0xFF166534),
                        side: const BorderSide(color: Color(0xFF166634)),
                        minimumSize: const Size.fromHeight(46),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      onPressed: _showAddAddressSheet,
                      icon: const Icon(Icons.add_location_alt_outlined),
                      label: const Text('Add New Address'),
                    ),
                  ],
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
                      onChanged: (v) => setState(() => _useReferral = v),
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
                      onChanged: (v) => setState(() => _useClothing = v),
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
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: const Color(0xFFE5E7EB)),
            ),
            child: Column(
              children: [
                _PriceRow(
                  label: 'Item Total',
                  value: '₹${subtotal.toStringAsFixed(0)}',
                ),
                const SizedBox(height: 8),
                _calculatingFee
                    ? const _PriceRow(
                        label: 'Delivery & Handling',
                        value: 'Calculating…',
                      )
                    : !_deliveryAvailable
                    ? const _PriceRow(
                        label: 'Delivery & Handling',
                        value: 'Not available',
                        valueColor: Color(0xFFDC2626),
                      )
                    : _PriceRow(
                        label: _distanceKm != null
                            ? 'Delivery & Handling (${_distanceKm!.toStringAsFixed(1)} km)'
                            : 'Delivery & Handling',
                        value: _deliveryFee == 0
                            ? 'FREE'
                            : '₹${_deliveryFee.toStringAsFixed(0)}',
                        valueColor: _deliveryFee == 0
                            ? const Color(0xFF16A34A)
                            : null,
                      ),
                if (!_calculatingFee && _deliveryAvailable && _deliveryFee == 0)
                  const Padding(
                    padding: EdgeInsets.only(top: 4),
                    child: Text(
                      '✓ Free delivery on orders above ₹999',
                      style: TextStyle(fontSize: 11, color: Color(0xFF16A34A)),
                    ),
                  ),
                if (!_calculatingFee &&
                    _deliveryAvailable &&
                    _deliveryFee > 0 &&
                    subtotal < 999)
                  Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Text(
                      'Add ₹${(999 - subtotal).ceil()} more for FREE delivery',
                      style: const TextStyle(
                        fontSize: 11,
                        color: Color(0xFF92400E),
                      ),
                    ),
                  ),
                if (referralDiscount > 0) ...[
                  const SizedBox(height: 8),
                  _PriceRow(
                    label: 'Referral Reward',
                    value: '- ₹${referralDiscount.toStringAsFixed(0)}',
                    valueColor: const Color(0xFF16A34A),
                  ),
                ],
                if (clothingDiscount > 0) ...[
                  const SizedBox(height: 8),
                  _PriceRow(
                    label:
                        'Donation Discount (${_availableClothingPercent.clamp(0, 5)}%)',
                    value: '- ₹${clothingDiscount.toStringAsFixed(0)}',
                    valueColor: const Color(0xFF16A34A),
                  ),
                ],
                const Divider(height: 22),
                _PriceRow(
                  label: 'Total Payable',
                  value: '₹${total.toStringAsFixed(0)}',
                  bold: true,
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
          child: FilledButton(
            style: FilledButton.styleFrom(
              backgroundColor: const Color(0xFF16A34A),
              minimumSize: const Size.fromHeight(52),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(14),
              ),
            ),
            onPressed: _placingOrder ? null : _placeOrder,
            child: _placingOrder
                ? const SizedBox(
                    width: 24,
                    height: 24,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: Colors.white,
                    ),
                  )
                : Text(
                    'Place Order  ₹${total.toStringAsFixed(0)}',
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
          ),
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

class _AddressTile extends StatelessWidget {
  const _AddressTile({
    required this.address,
    required this.selected,
    required this.onSelect,
  });
  final Map<String, dynamic> address;
  final bool selected;
  final VoidCallback onSelect;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onSelect,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: selected ? const Color(0xFF16A34A) : const Color(0xFFE5E7EB),
            width: selected ? 2 : 1,
          ),
        ),
        child: Row(
          children: [
            Icon(
              selected
                  ? Icons.radio_button_checked
                  : Icons.radio_button_unchecked,
              color: selected
                  ? const Color(0xFF16A34A)
                  : const Color(0xFF9CA3AF),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    address['address_line']?.toString() ?? '',
                    style: const TextStyle(fontWeight: FontWeight.w600),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    '${address['city'] ?? ''} - ${address['pincode'] ?? ''}',
                    style: const TextStyle(
                      color: Color(0xFF6B7280),
                      fontSize: 13,
                    ),
                  ),
                ],
              ),
            ),
            if (address['is_default'] == true)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: const Color(0xFFECFDF5),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Text(
                  'Default',
                  style: TextStyle(
                    color: Color(0xFF16A34A),
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _CartItemRow extends StatelessWidget {
  const _CartItemRow({required this.item});
  final CartItem item;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE5E7EB)),
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
              ],
            ),
          ),
          Text(
            '₹${((double.tryParse(item.rawPrice) ?? 0) * item.quantity).toStringAsFixed(0)}',
            style: const TextStyle(fontWeight: FontWeight.w700),
          ),
        ],
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
  });
  final String label;
  final String value;
  final bool bold;
  final Color? valueColor;

  @override
  Widget build(BuildContext context) {
    final style = TextStyle(
      fontWeight: bold ? FontWeight.w800 : FontWeight.w500,
      color: const Color(0xFF0F172A),
      fontSize: bold ? 15 : 14,
    );
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: style),
        Text(value, style: style.copyWith(color: valueColor ?? style.color)),
      ],
    );
  }
}

/// Represents an address picked by the user from the location picker screen.
class PickedAddress {
  final String addressLine;
  final String city;
  final String pincode;
  final double lat;
  final double lng;

  PickedAddress({
    required this.addressLine,
    required this.city,
    required this.pincode,
    required this.lat,
    required this.lng,
  });
}
