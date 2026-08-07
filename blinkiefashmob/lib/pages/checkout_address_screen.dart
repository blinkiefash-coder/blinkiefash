import 'package:flutter/material.dart';
import '../services/api_client.dart';
import '../services/cart_manager.dart';
import '../services/user_session.dart';
import 'login_screen.dart';
import 'location_picker_screen.dart';
import 'checkout_screen.dart';
import '../widgets/bf_loader.dart';

/// Page 1 of the 2-page checkout flow — Myntra-style address selection.
/// Shows saved addresses (name, house/street, city, pincode, phone),
/// lets the user pick/"Change" one, add a new address, and see an
/// estimated delivery date for the selected address before proceeding
/// to page 2 (order summary + payment).
class CheckoutAddressScreen extends StatefulWidget {
  const CheckoutAddressScreen({
    super.key,
    this.isTryOrder = false,
    this.overrideItems,
  });

  final bool isTryOrder;

  /// When provided, these items are used instead of the shared cart.
  final List<CartItem>? overrideItems;

  @override
  State<CheckoutAddressScreen> createState() => _CheckoutAddressScreenState();
}

class _CheckoutAddressScreenState extends State<CheckoutAddressScreen> {
  final ApiClient _api = ApiClient();
  bool _authRedirectInFlight = false;

  List<Map<String, dynamic>> _addresses = [];
  String? _selectedAddressId;
  bool _loading = true;
  String? _error;

  final Map<String, String> _estimateByAddressId = {};

  List<CartItem> get _effectiveItems {
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

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _startFlow());
  }

  void _startFlow() {
    if (UserSession.instance.isLoggedIn) {
      _loadAddresses();
      return;
    }
    if (_authRedirectInFlight || !mounted) return;
    _authRedirectInFlight = true;
    Navigator.of(context).pushReplacement(
      MaterialPageRoute<void>(
        builder: (_) => LoginScreen(
          redirectBuilder: (_) => CheckoutAddressScreen(
            isTryOrder: widget.isTryOrder,
            overrideItems: _clonedOverrideItems(),
          ),
        ),
      ),
    );
  }

  Future<void> _loadAddresses() async {
    final userId = UserSession.instance.userId;
    if (userId == null) {
      setState(() => _loading = false);
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
        _loading = false;
      });
      if (defaultId != null) _fetchEstimate(defaultId);
    } catch (_) {
      if (!mounted) return;
      setState(() => _loading = false);
    }
  }

  Future<void> _fetchEstimate(String addressId) async {
    try {
      final variantIds = _effectiveItems
          .map((i) => i.productId)
          .where((id) => id.isNotEmpty)
          .toSet()
          .toList();
      final result = await _api.fetchDeliveryFee(
        addressId: addressId,
        subtotal: _effectiveSubtotal,
        variantIds: variantIds,
      );
      if (!mounted) return;
      final promise = result['deliveryPromise']?.toString();
      final etaMin = (result['etaMinMinutes'] as num?)?.toInt();
      final etaMax = (result['etaMaxMinutes'] as num?)?.toInt();
      String label;
      if (promise != null && promise.isNotEmpty) {
        label = promise;
      } else if (etaMin != null && etaMax != null) {
        label = '$etaMin-$etaMax min';
      } else {
        label = 'Calculated at next step';
      }
      setState(() {
        _estimateByAddressId[addressId] = label;
      });
    } catch (_) {
      // Silently ignore — estimate is a nice-to-have on this page.
    }
  }

  Future<void> _openAddAddress() async {
    final result = await Navigator.of(context).push<PickedAddress>(
      MaterialPageRoute(builder: (_) => const LocationPickerScreen()),
    );
    if (!mounted || result == null) return;
    final userId = UserSession.instance.userId;
    if (userId == null) return;

    setState(() {
      _loading = true;
      _error = null;
    });
    final res = await _api.addAddress(
      userId: userId,
      addressLine: result.addressLine,
      city: result.city,
      pincode: result.pincode,
      lat: result.lat,
      lng: result.lng,
      name: result.name,
      phone: result.phone,
      addressType: result.addressType,
    );
    if (!mounted) return;
    if (res['success'] == true) {
      final newId = (res['address'] as Map?)?['id']?.toString();
      await _loadAddresses();
      if (!mounted) return;
      if (newId != null) {
        setState(() => _selectedAddressId = newId);
        _fetchEstimate(newId);
      }
    } else {
      setState(() {
        _loading = false;
        _error = res['message']?.toString() ?? 'Failed to save address';
      });
    }
  }

  void _continue() {
    if (_selectedAddressId == null) return;
    final selected = _addresses.firstWhere(
      (a) => a['id'].toString() == _selectedAddressId,
      orElse: () => <String, dynamic>{},
    );
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => CheckoutScreen(
          selectedAddressId: _selectedAddressId!,
          selectedAddress: selected,
          isTryOrder: widget.isTryOrder,
          overrideItems: widget.overrideItems,
        ),
      ),
    );
  }

  IconData _typeIcon(String? type) {
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text(
          'Select Delivery Address',
          style: TextStyle(fontWeight: FontWeight.w700),
        ),
        backgroundColor: Colors.white,
        foregroundColor: const Color(0xFF0F172A),
        elevation: 0,
        surfaceTintColor: Colors.transparent,
      ),
      body: _loading
          ? const Center(child: BfSpinner())
          : ListView(
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
                if (_addresses.isEmpty)
                  Container(
                    padding: const EdgeInsets.all(24),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: const Color(0xFFE5E7EB)),
                    ),
                    child: Column(
                      children: [
                        const Icon(
                          Icons.location_off_outlined,
                          size: 48,
                          color: Color(0xFFD1D5DB),
                        ),
                        const SizedBox(height: 12),
                        const Text(
                          'No saved addresses yet',
                          style: TextStyle(
                            fontWeight: FontWeight.w700,
                            fontSize: 15,
                          ),
                        ),
                        const SizedBox(height: 4),
                        const Text(
                          'Add an address to continue checkout',
                          style: TextStyle(
                            color: Color(0xFF6B7280),
                            fontSize: 13,
                          ),
                        ),
                      ],
                    ),
                  )
                else
                  ..._addresses.map(
                    (addr) => _AddressCard(
                      address: addr,
                      isSelected: addr['id'].toString() == _selectedAddressId,
                      estimateLabel:
                          _estimateByAddressId[addr['id'].toString()],
                      typeIcon: _typeIcon(addr['address_type']?.toString()),
                      onTap: () {
                        final id = addr['id'].toString();
                        setState(() => _selectedAddressId = id);
                        _fetchEstimate(id);
                      },
                    ),
                  ),
                const SizedBox(height: 8),
                OutlinedButton.icon(
                  onPressed: _openAddAddress,
                  style: OutlinedButton.styleFrom(
                    foregroundColor: const Color(0xFF166534),
                    side: const BorderSide(color: Color(0xFF166534)),
                    minimumSize: const Size.fromHeight(48),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  icon: const Icon(Icons.add_location_alt_outlined),
                  label: const Text(
                    'Add New Address',
                    style: TextStyle(fontWeight: FontWeight.w700),
                  ),
                ),
                const SizedBox(height: 100),
              ],
            ),
      bottomNavigationBar: (_loading || _addresses.isEmpty)
          ? null
          : SafeArea(
              child: Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.white,
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withOpacity(0.06),
                      blurRadius: 12,
                      offset: const Offset(0, -4),
                    ),
                  ],
                ),
                child: SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    onPressed: _selectedAddressId == null ? null : _continue,
                    style: FilledButton.styleFrom(
                      backgroundColor: const Color(0xFF16A34A),
                      minimumSize: const Size.fromHeight(52),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14),
                      ),
                    ),
                    child: const Text(
                      'Deliver Here',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ),
              ),
            ),
    );
  }
}

class _AddressCard extends StatelessWidget {
  const _AddressCard({
    required this.address,
    required this.isSelected,
    required this.onTap,
    required this.typeIcon,
    this.estimateLabel,
  });

  final Map<String, dynamic> address;
  final bool isSelected;
  final VoidCallback onTap;
  final IconData typeIcon;
  final String? estimateLabel;

  @override
  Widget build(BuildContext context) {
    final name = address['name']?.toString().trim() ?? '';
    final phone = address['phone']?.toString().trim() ?? '';
    final type = address['address_type']?.toString() ?? '';
    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: isSelected
                ? const Color(0xFF16A34A)
                : const Color(0xFFE5E7EB),
            width: isSelected ? 2 : 1,
          ),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(
              isSelected ? Icons.radio_button_checked : Icons.radio_button_off,
              color: isSelected
                  ? const Color(0xFF16A34A)
                  : const Color(0xFFD1D5DB),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(typeIcon, size: 15, color: const Color(0xFF166534)),
                      const SizedBox(width: 4),
                      Expanded(
                        child: Text(
                          name.isNotEmpty ? name : 'Saved Address',
                          style: const TextStyle(
                            fontWeight: FontWeight.w700,
                            fontSize: 14,
                            color: Color(0xFF0F172A),
                          ),
                        ),
                      ),
                      if (type.isNotEmpty)
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 2,
                          ),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF0FDF4),
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(color: const Color(0xFFBBF7D0)),
                          ),
                          child: Text(
                            type.toUpperCase(),
                            style: const TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF166534),
                            ),
                          ),
                        ),
                      if (address['is_default'] == true) ...[
                        const SizedBox(width: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 2,
                          ),
                          decoration: BoxDecoration(
                            color: const Color(0xFFEFF6FF),
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(color: const Color(0xFFBFDBFE)),
                          ),
                          child: const Text(
                            'DEFAULT',
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF1D4ED8),
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(
                    '${address['address_line'] ?? ''}, ${address['city'] ?? ''} - '
                    '${address['pincode'] ?? ''}',
                    style: const TextStyle(
                      fontSize: 13,
                      color: Color(0xFF475569),
                      height: 1.4,
                    ),
                  ),
                  if (phone.isNotEmpty) ...[
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
                          phone,
                          style: const TextStyle(
                            fontSize: 12,
                            color: Color(0xFF64748B),
                          ),
                        ),
                      ],
                    ),
                  ],
                  if (isSelected && estimateLabel != null) ...[
                    const SizedBox(height: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 6,
                      ),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF0FDF4),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Row(
                        children: [
                          const Icon(
                            Icons.local_shipping_outlined,
                            size: 14,
                            color: Color(0xFF166534),
                          ),
                          const SizedBox(width: 6),
                          Expanded(
                            child: Text(
                              'Estimated delivery: $estimateLabel',
                              style: const TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                                color: Color(0xFF166534),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
