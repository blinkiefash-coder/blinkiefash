import 'package:flutter/material.dart';
import '../services/api_client.dart';
import '../services/cart_manager.dart';
import '../services/user_session.dart';
import 'login_screen.dart';
import 'location_picker_screen.dart' show LocationPickerScreen, PickedAddress;
import 'checkout_screen.dart' hide PickedAddress;
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
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => CheckoutScreen(
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

  Future<void> _openEditAddress(Map<String, dynamic> address) async {
    final updated = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _EditAddressSheet(api: _api, address: address),
    );
    if (updated != true || !mounted) return;
    final keepId = _selectedAddressId;
    setState(() => _loading = true);
    await _loadAddresses();
    if (!mounted) return;
    if (keepId != null && _addresses.any((a) => a['id'].toString() == keepId)) {
      setState(() => _selectedAddressId = keepId);
      _fetchEstimate(keepId);
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
                      onEdit: () => _openEditAddress(addr),
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
                      color: Colors.black.withValues(alpha: 0.06),
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
    required this.onEdit,
    this.estimateLabel,
  });

  final Map<String, dynamic> address;
  final bool isSelected;
  final VoidCallback onTap;
  final IconData typeIcon;
  final VoidCallback onEdit;
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
                      const SizedBox(width: 4),
                      InkWell(
                        onTap: onEdit,
                        borderRadius: BorderRadius.circular(20),
                        child: const Padding(
                          padding: EdgeInsets.all(4),
                          child: Icon(
                            Icons.edit_outlined,
                            size: 16,
                            color: Color(0xFF64748B),
                          ),
                        ),
                      ),
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

class _EditAddressSheet extends StatefulWidget {
  const _EditAddressSheet({required this.api, required this.address});
  final ApiClient api;
  final Map<String, dynamic> address;

  @override
  State<_EditAddressSheet> createState() => _EditAddressSheetState();
}

class _EditAddressSheetState extends State<_EditAddressSheet> {
  late final TextEditingController _nameCtrl;
  late final TextEditingController _phoneCtrl;
  late final TextEditingController _addressLineCtrl;
  late final TextEditingController _cityCtrl;
  late final TextEditingController _pincodeCtrl;
  late String _addressType;
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _nameCtrl = TextEditingController(
      text: widget.address['name']?.toString() ?? '',
    );
    _phoneCtrl = TextEditingController(
      text: widget.address['phone']?.toString() ?? '',
    );
    _addressLineCtrl = TextEditingController(
      text: widget.address['address_line']?.toString() ?? '',
    );
    _cityCtrl = TextEditingController(
      text: widget.address['city']?.toString() ?? '',
    );
    _pincodeCtrl = TextEditingController(
      text: widget.address['pincode']?.toString() ?? '',
    );
    _addressType = widget.address['address_type']?.toString() ?? 'home';
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _phoneCtrl.dispose();
    _addressLineCtrl.dispose();
    _cityCtrl.dispose();
    _pincodeCtrl.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final addressLine = _addressLineCtrl.text.trim();
    final city = _cityCtrl.text.trim();
    final pincode = _pincodeCtrl.text.trim();
    if (addressLine.isEmpty || city.isEmpty || pincode.isEmpty) {
      setState(() => _error = 'Address, city and pincode are required');
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    final res = await widget.api.updateAddress(
      addressId: widget.address['id'].toString(),
      addressLine: addressLine,
      city: city,
      pincode: pincode,
      name: _nameCtrl.text.trim(),
      phone: _phoneCtrl.text.trim(),
      addressType: _addressType,
    );
    if (!mounted) return;
    if (res['success'] == true) {
      Navigator.of(context).pop(true);
    } else {
      setState(() {
        _saving = false;
        _error = res['message']?.toString() ?? 'Failed to update address';
      });
    }
  }

  Widget _typeChip(String value, IconData icon, String label) {
    final selected = _addressType == value;
    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() => _addressType = value),
        child: Container(
          margin: const EdgeInsets.symmetric(horizontal: 4),
          padding: const EdgeInsets.symmetric(vertical: 10),
          decoration: BoxDecoration(
            color: selected ? const Color(0xFFF0FDF4) : Colors.white,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(
              color: selected
                  ? const Color(0xFF16A34A)
                  : const Color(0xFFE5E7EB),
              width: selected ? 1.5 : 1,
            ),
          ),
          child: Column(
            children: [
              Icon(
                icon,
                size: 18,
                color: selected
                    ? const Color(0xFF16A34A)
                    : const Color(0xFF64748B),
              ),
              const SizedBox(height: 4),
              Text(
                label,
                style: TextStyle(
                  fontSize: 11.5,
                  fontWeight: FontWeight.w700,
                  color: selected
                      ? const Color(0xFF166534)
                      : const Color(0xFF64748B),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _field(
    TextEditingController ctrl,
    String label,
    IconData icon, {
    int maxLines = 1,
    TextInputType? keyboardType,
  }) {
    return TextField(
      controller: ctrl,
      maxLines: maxLines,
      keyboardType: keyboardType,
      decoration: InputDecoration(
        labelText: label,
        filled: true,
        fillColor: const Color(0xFFF8FAFC),
        prefixIcon: Icon(icon, size: 18),
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 12,
          vertical: 12,
        ),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: Color(0xFFE5E7EB)),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: Color(0xFFE5E7EB)),
        ),
        isDense: true,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
      ),
      child: Container(
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
        padding: const EdgeInsets.fromLTRB(18, 14, 18, 18),
        child: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            mainAxisSize: MainAxisSize.min,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  margin: const EdgeInsets.only(bottom: 14),
                  decoration: BoxDecoration(
                    color: const Color(0xFFE5E7EB),
                    borderRadius: BorderRadius.circular(4),
                  ),
                ),
              ),
              const Text(
                'Edit Address',
                style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800),
              ),
              const SizedBox(height: 14),
              if (_error != null)
                Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: Text(
                    _error!,
                    style: const TextStyle(
                      color: Color(0xFFDC2626),
                      fontSize: 12.5,
                    ),
                  ),
                ),
              Row(
                children: [
                  _typeChip('home', Icons.home_outlined, 'Home'),
                  _typeChip('work', Icons.work_outline, 'Work'),
                  _typeChip('other', Icons.location_on_outlined, 'Other'),
                ],
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: _field(_nameCtrl, 'Name', Icons.person_outline),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: _field(
                      _phoneCtrl,
                      'Phone',
                      Icons.phone_outlined,
                      keyboardType: TextInputType.phone,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              _field(
                _addressLineCtrl,
                'House / Street / Area',
                Icons.home_work_outlined,
                maxLines: 2,
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(
                    child: _field(
                      _cityCtrl,
                      'City / District',
                      Icons.location_city_outlined,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: _field(
                      _pincodeCtrl,
                      'Pincode',
                      Icons.pin_drop_outlined,
                      keyboardType: TextInputType.number,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 18),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: _saving ? null : _save,
                  style: FilledButton.styleFrom(
                    backgroundColor: const Color(0xFF16A34A),
                    minimumSize: const Size.fromHeight(50),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  child: _saving
                      ? const SizedBox(
                          width: 22,
                          height: 22,
                          child: BfSpinner(),
                        )
                      : const Text(
                          'Save Changes',
                          style: TextStyle(
                            fontWeight: FontWeight.w700,
                            fontSize: 15,
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
}
