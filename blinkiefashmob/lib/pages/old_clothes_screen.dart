import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../services/api_client.dart';
import '../services/user_session.dart';
import '../widgets/bf_loader.dart';

class OldClothesScreen extends StatefulWidget {
  const OldClothesScreen({super.key});

  @override
  State<OldClothesScreen> createState() => _OldClothesScreenState();
}

class _OldClothesScreenState extends State<OldClothesScreen> {
  final ApiClient _api = ApiClient();
  final _itemCtrl = TextEditingController(text: '5');
  final _notesCtrl = TextEditingController();

  bool _loading = true;
  bool _submitting = false;
  String? _error;

  List<Map<String, dynamic>> _addresses = const [];
  String? _selectedAddressId;

  List<Map<String, dynamic>> _pickups = const [];
  int _availableItems = 0;
  int _availablePercent = 0;

  static const Color _green = Color(0xFF16A34A);

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _itemCtrl.dispose();
    _notesCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final userId = UserSession.instance.userId;
    if (userId == null || userId.isEmpty) {
      setState(() {
        _loading = false;
        _error = 'Please login to schedule a pickup.';
      });
      return;
    }
    try {
      final addrFuture = _api.fetchAddresses(userId);
      final infoFuture = _api.fetchOldClothesInfo(userId);
      final addrList = await addrFuture;
      final info = await infoFuture;
      if (!mounted) return;
      final addresses = addrList.whereType<Map<String, dynamic>>().toList(
        growable: false,
      );
      String? defaultId;
      for (final a in addresses) {
        if (a['is_default'] == true) {
          defaultId = a['id'].toString();
          break;
        }
      }
      defaultId ??= addresses.isNotEmpty
          ? addresses.first['id'].toString()
          : null;
      setState(() {
        _addresses = addresses;
        _selectedAddressId = defaultId;
        _pickups = (info['pickups'] as List? ?? const [])
            .whereType<Map<String, dynamic>>()
            .toList(growable: false);
        _availableItems = (info['availableItems'] as num?)?.toInt() ?? 0;
        _availablePercent = (info['availablePercent'] as num?)?.toInt() ?? 0;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = 'Connection error. Please try again.';
      });
    }
  }

  Future<void> _submit() async {
    final userId = UserSession.instance.userId;
    if (userId == null) {
      setState(() => _error = 'Please login.');
      return;
    }
    if (_selectedAddressId == null) {
      setState(() => _error = 'Please select a pickup address.');
      return;
    }
    final count = int.tryParse(_itemCtrl.text.trim()) ?? 0;
    if (count < 1) {
      setState(() => _error = 'Enter at least 1 cloth item.');
      return;
    }
    if (count > 5) {
      setState(() => _error = 'You can donate a maximum of 5 clothing pieces.');
      return;
    }

    setState(() {
      _submitting = true;
      _error = null;
    });

    final res = await _api.requestClothesPickup(
      userId: userId,
      addressId: _selectedAddressId!,
      itemCount: count,
      notes: _notesCtrl.text.trim().isEmpty ? null : _notesCtrl.text.trim(),
    );
    if (!mounted) return;
    if (res['success'] == true) {
      _itemCtrl.text = '5';
      _notesCtrl.clear();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Pickup scheduled. Once collected, up to 5% discount will be available for your next order.',
          ),
        ),
      );
      await _load();
    } else {
      setState(() {
        _submitting = false;
        _error = res['message']?.toString() ?? 'Failed to schedule pickup.';
      });
      return;
    }
    if (mounted) setState(() => _submitting = false);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8F9FA),
      appBar: AppBar(
        title: const Text(
          'Old Clothes Pickup',
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
                Container(
                  padding: const EdgeInsets.all(18),
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [Color(0xFF16A34A), Color(0xFF0F766E)],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    borderRadius: BorderRadius.circular(18),
                  ),
                  child: const Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Icon(
                            Icons.recycling_rounded,
                            color: Colors.white,
                            size: 28,
                          ),
                          SizedBox(width: 10),
                          Expanded(
                            child: Text(
                              'Donate clothes, save more',
                              style: TextStyle(
                                color: Colors.white,
                                fontWeight: FontWeight.w800,
                                fontSize: 19,
                              ),
                            ),
                          ),
                        ],
                      ),
                      SizedBox(height: 8),
                      Text(
                        'Pickup is available only for customers who have already placed an order. Donate up to 5 pieces and get up to 5% off on your next order after collection.',
                        style: TextStyle(color: Colors.white70, height: 1.4),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 18),
                if (_availableItems > 0)
                  Container(
                    padding: const EdgeInsets.all(14),
                    margin: const EdgeInsets.only(bottom: 18),
                    decoration: BoxDecoration(
                      color: const Color(0xFFECFDF5),
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: const Color(0xFF86EFAC)),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.savings_rounded, color: _green),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            'You have $_availableItems donated cloth credits — $_availablePercent% off ready for your next order.',
                            style: const TextStyle(
                              color: Color(0xFF166534),
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                if (_error != null)
                  Container(
                    padding: const EdgeInsets.all(12),
                    margin: const EdgeInsets.only(bottom: 12),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFEF2F2),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xFFFCA5A5)),
                    ),
                    child: Text(
                      _error!,
                      style: const TextStyle(color: Color(0xFFDC2626)),
                    ),
                  ),
                const Text(
                  'NUMBER OF CLOTH ITEMS',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF6B7280),
                    letterSpacing: 1.1,
                  ),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: _itemCtrl,
                  keyboardType: TextInputType.number,
                  inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                  decoration: InputDecoration(
                    filled: true,
                    fillColor: Colors.white,
                    prefixIcon: const Icon(
                      Icons.checkroom_rounded,
                      color: _green,
                    ),
                    hintText: '1 to 5 pieces',
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: const BorderSide(color: Color(0xFFE5E7EB)),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: const BorderSide(color: Color(0xFFE5E7EB)),
                    ),
                  ),
                ),
                const SizedBox(height: 6),
                const Text(
                  'Maximum 5 pieces. Collection is accepted only after at least one BlinkieFash order.',
                  style: TextStyle(fontSize: 12, color: Color(0xFF6B7280)),
                ),
                const SizedBox(height: 16),
                const Text(
                  'PICKUP ADDRESS',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF6B7280),
                    letterSpacing: 1.1,
                  ),
                ),
                const SizedBox(height: 8),
                if (_addresses.isEmpty)
                  Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xFFE5E7EB)),
                    ),
                    child: const Text(
                      'No saved addresses. Please add one from Checkout first.',
                      style: TextStyle(color: Color(0xFF6B7280)),
                    ),
                  )
                else
                  ..._addresses.map((a) {
                    final id = a['id'].toString();
                    final selected = id == _selectedAddressId;
                    return GestureDetector(
                      onTap: () => setState(() => _selectedAddressId = id),
                      child: Container(
                        margin: const EdgeInsets.only(bottom: 8),
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: selected ? _green : const Color(0xFFE5E7EB),
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
                                  ? _green
                                  : const Color(0xFF9CA3AF),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    a['address_line']?.toString() ?? '',
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    '${a['city'] ?? ''} - ${a['pincode'] ?? ''}',
                                    style: const TextStyle(
                                      color: Color(0xFF6B7280),
                                      fontSize: 13,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    );
                  }),
                const SizedBox(height: 16),
                const Text(
                  'NOTES (OPTIONAL)',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF6B7280),
                    letterSpacing: 1.1,
                  ),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: _notesCtrl,
                  maxLines: 3,
                  decoration: InputDecoration(
                    filled: true,
                    fillColor: Colors.white,
                    hintText: 'Any pickup instructions for the rider…',
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: const BorderSide(color: Color(0xFFE5E7EB)),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: const BorderSide(color: Color(0xFFE5E7EB)),
                    ),
                  ),
                ),
                const SizedBox(height: 18),
                FilledButton(
                  style: FilledButton.styleFrom(
                    backgroundColor: _green,
                    minimumSize: const Size.fromHeight(52),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                  ),
                  onPressed: _submitting || _addresses.isEmpty ? null : _submit,
                  child: _submitting
                      ? const SizedBox(
                          width: 22,
                          height: 22,
                          child: BfSpinner(),
                        )
                      : const Text(
                          'Schedule Pickup',
                          style: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                ),
                const SizedBox(height: 28),
                if (_pickups.isNotEmpty) ...[
                  const Text(
                    'YOUR PICKUPS',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF6B7280),
                      letterSpacing: 1.1,
                    ),
                  ),
                  const SizedBox(height: 8),
                  ..._pickups.map(_buildPickupTile),
                ],
              ],
            ),
    );
  }

  Widget _buildPickupTile(Map<String, dynamic> p) {
    final status = (p['status']?.toString() ?? 'requested').toLowerCase();
    Color color;
    switch (status) {
      case 'collected':
        color = _green;
        break;
      case 'cancelled':
        color = const Color(0xFFDC2626);
        break;
      default:
        color = const Color(0xFFF59E0B);
    }
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE5E7EB)),
      ),
      child: Row(
        children: [
          const Icon(Icons.checkroom_rounded, color: Color(0xFF16A34A)),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '${p['item_count'] ?? 0} item${(p['item_count'] ?? 0) == 1 ? '' : 's'}',
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 2),
                Text(
                  '${p['address_line'] ?? ''}, ${p['city'] ?? ''}',
                  style: const TextStyle(
                    color: Color(0xFF6B7280),
                    fontSize: 12,
                  ),
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Text(
              status.toUpperCase(),
              style: TextStyle(
                color: color,
                fontSize: 11,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
