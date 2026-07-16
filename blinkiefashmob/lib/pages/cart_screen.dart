import 'package:flutter/material.dart';

import '../services/api_client.dart';
import '../services/cart_manager.dart';
import 'all_products_screen.dart';
import 'checkout_screen.dart';

class CartScreen extends StatefulWidget {
  const CartScreen({super.key});

  @override
  State<CartScreen> createState() => _CartScreenState();
}

class _CartScreenState extends State<CartScreen> {
  final ApiClient _api = ApiClient();

  @override
  void initState() {
    super.initState();
    CartManager.instance.countNotifier.addListener(_onCartChange);
    _refreshAvailability();
  }

  @override
  void dispose() {
    CartManager.instance.countNotifier.removeListener(_onCartChange);
    super.dispose();
  }

  void _onCartChange() {
    if (mounted) setState(() {});
  }

  Future<void> _refreshAvailability() async {
    final items = CartManager.instance.items;
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

  @override
  Widget build(BuildContext context) {
    final items = CartManager.instance.items;
    final hasUnavailable = items.any((item) {
      final limit = item.availableStock;
      return limit != null && (limit <= 0 || item.quantity > limit);
    });
    final subtotal = CartManager.instance.subtotal;
    const deliveryFee = 49.0;
    final total = subtotal + deliveryFee;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Cart'),
        backgroundColor: Colors.white,
        elevation: 0,
        foregroundColor: const Color(0xFF111827),
      ),
      backgroundColor: const Color(0xFFF8FAFC),
      body: items.isEmpty
          ? Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(
                    Icons.shopping_bag_outlined,
                    size: 72,
                    color: Color(0xFFD1D5DB),
                  ),
                  const SizedBox(height: 16),
                  const Text(
                    'Your bag is empty',
                    style: TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF374151),
                    ),
                  ),
                  const SizedBox(height: 6),
                  const Text(
                    'Looks like you haven\'t added anything yet',
                    style: TextStyle(fontSize: 13, color: Color(0xFF9CA3AF)),
                  ),
                  const SizedBox(height: 28),
                  ElevatedButton.icon(
                    onPressed: () => Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) => const AllProductsScreen(),
                      ),
                    ),
                    icon: const Icon(Icons.explore_outlined, size: 18),
                    label: const Text(
                      'Start Shopping',
                      style: TextStyle(
                        fontWeight: FontWeight.w800,
                        fontSize: 15,
                      ),
                    ),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF16A34A),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(
                        horizontal: 32,
                        vertical: 14,
                      ),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14),
                      ),
                      elevation: 0,
                    ),
                  ),
                ],
              ),
            )
          : ListView(
              padding: const EdgeInsets.all(14),
              children: [
                if (hasUnavailable)
                  Container(
                    margin: const EdgeInsets.only(bottom: 12),
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFFF7ED),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: const Color(0xFFFCA5A5)),
                    ),
                    child: const Text(
                      'Some items are unavailable for now. Update quantities or remove them before checkout.',
                      style: TextStyle(
                        color: Color(0xFF9A3412),
                        fontWeight: FontWeight.w600,
                        fontSize: 12,
                      ),
                    ),
                  ),
                ...items.map(
                  (item) => _CartItemTile(
                    item: item,
                    onIncrement: () {
                      final ok = CartManager.instance.increment(item);
                      if (!ok) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: Text(
                              '${item.name}: stock limit reached for selected size/color',
                            ),
                          ),
                        );
                        return;
                      }
                      setState(() {});
                    },
                    onDecrement: () =>
                        setState(() => CartManager.instance.decrement(item)),
                    onRemove: () =>
                        setState(() => CartManager.instance.remove(item)),
                  ),
                ),
                // ── Add More ───────────────────────────────────────────────
                const SizedBox(height: 10),
                OutlinedButton.icon(
                  onPressed: () => Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (_) => const AllProductsScreen(),
                    ),
                  ),
                  icon: const Icon(Icons.add_shopping_cart_outlined, size: 16),
                  label: const Text(
                    'Add More Items',
                    style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
                  ),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: const Color(0xFF16A34A),
                    side: const BorderSide(color: Color(0xFF16A34A)),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    minimumSize: const Size(double.infinity, 0),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                ),
                const SizedBox(height: 14),
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: const Color(0xFFE5E7EB)),
                  ),
                  child: Column(
                    children: [
                      _Line(
                        label: 'Subtotal',
                        value: '\u20b9${subtotal.round()}',
                      ),
                      const SizedBox(height: 8),
                      const _Line(label: 'Delivery', value: '\u20b949'),
                      const Divider(height: 22),
                      _Line(
                        label: 'Payable',
                        value: '\u20b9${total.round()}',
                        bold: true,
                      ),
                    ],
                  ),
                ),
              ],
            ),
      bottomNavigationBar: items.isEmpty
          ? null
          : SafeArea(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
                child: FilledButton(
                  style: FilledButton.styleFrom(
                    minimumSize: const Size.fromHeight(52),
                    backgroundColor: const Color(0xFF16A34A),
                  ),
                  onPressed: hasUnavailable
                      ? null
                      : () {
                          Navigator.of(context).push(
                            MaterialPageRoute<void>(
                              builder: (_) => const CheckoutScreen(),
                            ),
                          );
                        },
                  child: Text(
                    'Proceed to Checkout (${items.length} item${items.length == 1 ? '' : 's'})',
                  ),
                ),
              ),
            ),
    );
  }
}

class _CartItemTile extends StatelessWidget {
  const _CartItemTile({
    required this.item,
    required this.onIncrement,
    required this.onDecrement,
    required this.onRemove,
  });

  final CartItem item;
  final VoidCallback onIncrement;
  final VoidCallback onDecrement;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE5E7EB)),
      ),
      child: Row(
        children: [
          Container(
            width: 82,
            height: 82,
            decoration: BoxDecoration(
              color: const Color(0xFFF1F5F9),
              borderRadius: BorderRadius.circular(12),
            ),
            child: item.imageUrl == null
                ? const Icon(Icons.image_outlined)
                : ClipRRect(
                    borderRadius: BorderRadius.circular(12),
                    child: Image.network(
                      item.imageUrl!,
                      fit: BoxFit.cover,
                      errorBuilder: (ctx, err, st) =>
                          const Icon(Icons.image_outlined),
                    ),
                  ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  item.name,
                  style: const TextStyle(fontWeight: FontWeight.w700),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 4),
                if (item.color != null || item.size != null)
                  Text(
                    [
                      if (item.color != null) 'Color: ${item.color}',
                      if (item.size != null) 'Size: ${item.size}',
                    ].join('  '),
                    style: const TextStyle(
                      fontSize: 12,
                      color: Color(0xFF64748B),
                    ),
                  ),
                const SizedBox(height: 6),
                Text(
                  '\u20b9${item.price}',
                  style: const TextStyle(
                    fontWeight: FontWeight.w800,
                    fontSize: 16,
                  ),
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    _QtyButton(icon: Icons.remove, onTap: onDecrement),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 12),
                      child: Text(
                        '${item.quantity}',
                        style: const TextStyle(
                          fontWeight: FontWeight.w700,
                          fontSize: 16,
                        ),
                      ),
                    ),
                    _QtyButton(icon: Icons.add, onTap: onIncrement),
                    const Spacer(),
                    IconButton(
                      icon: const Icon(
                        Icons.delete_outline,
                        color: Color(0xFFE11D48),
                      ),
                      onPressed: onRemove,
                      padding: EdgeInsets.zero,
                      constraints: const BoxConstraints(),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _QtyButton extends StatelessWidget {
  const _QtyButton({required this.icon, required this.onTap});
  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 28,
        height: 28,
        decoration: BoxDecoration(
          border: Border.all(color: const Color(0xFFE5E7EB)),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Icon(icon, size: 16),
      ),
    );
  }
}

class _Line extends StatelessWidget {
  const _Line({required this.label, required this.value, this.bold = false});

  final String label;
  final String value;
  final bool bold;

  @override
  Widget build(BuildContext context) {
    final style = TextStyle(
      fontWeight: bold ? FontWeight.w800 : FontWeight.w600,
      color: const Color(0xFF0F172A),
    );
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: style),
        Text(value, style: style),
      ],
    );
  }
}
