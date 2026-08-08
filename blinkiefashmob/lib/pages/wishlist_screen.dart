import 'package:flutter/material.dart';

import '../services/wishlist_manager.dart';
import 'all_products_screen.dart';
import 'product_detail_screen.dart';

class WishlistScreen extends StatefulWidget {
  const WishlistScreen({super.key});

  @override
  State<WishlistScreen> createState() => _WishlistScreenState();
}

class _WishlistScreenState extends State<WishlistScreen> {
  @override
  void initState() {
    super.initState();
    // Rebuild whenever wishlist changes
    WishlistManager.instance.countNotifier.addListener(_onWishlistChange);
  }

  @override
  void dispose() {
    WishlistManager.instance.countNotifier.removeListener(_onWishlistChange);
    super.dispose();
  }

  void _onWishlistChange() {
    if (mounted) setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final items = WishlistManager.instance.items;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Wishlist'),
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
                    Icons.favorite_border_rounded,
                    size: 72,
                    color: Color(0xFFD1D5DB),
                  ),
                  const SizedBox(height: 16),
                  const Text(
                    'Your wishlist is empty',
                    style: TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF374151),
                    ),
                  ),
                  const SizedBox(height: 6),
                  const Text(
                    'Save items you love to find them later',
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
          : RefreshIndicator(
              color: const Color(0xFF22C55E),
              backgroundColor: const Color(0xFF0D2015),
              strokeWidth: 2.5,
              onRefresh: () async => setState(() {}),
              child: ListView(
                padding: const EdgeInsets.all(14),
                children: [
                  const Text(
                    'Saved Items',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
                  ),
                  const SizedBox(height: 12),
                  ...items.map(
                    (item) => GestureDetector(
                      onTap: () => Navigator.of(context).push(
                        MaterialPageRoute<void>(
                          builder: (_) => ProductDetailScreen(
                            productId: item.productId,
                            initialName: item.name,
                          ),
                        ),
                      ),
                      child: Container(
                        margin: const EdgeInsets.only(bottom: 12),
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: const Color(0xFFE5E7EB)),
                        ),
                        child: Row(
                          children: [
                            Container(
                              width: 72,
                              height: 72,
                              decoration: BoxDecoration(
                                color: const Color(0xFFF1F5F9),
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: item.imageUrl == null
                                  ? const Icon(
                                      Icons.image_outlined,
                                      color: Color(0xFF64748B),
                                    )
                                  : ClipRRect(
                                      borderRadius: BorderRadius.circular(12),
                                      child: Image.network(
                                        item.imageUrl!,
                                        cacheWidth:
                                            (300 *
                                                    MediaQuery.of(
                                                      context,
                                                    ).devicePixelRatio)
                                                .round(),
                                        fit: BoxFit.cover,
                                        errorBuilder: (ctx, err, st) =>
                                            const Icon(
                                              Icons.image_outlined,
                                              color: Color(0xFF64748B),
                                            ),
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
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                  const SizedBox(height: 6),
                                  Text(
                                    '\u20b9${item.price}',
                                    style: const TextStyle(
                                      fontSize: 16,
                                      fontWeight: FontWeight.w800,
                                      color: Color(0xFF111827),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            IconButton(
                              onPressed: () => setState(
                                () => WishlistManager.instance.remove(
                                  item.productId,
                                ),
                              ),
                              icon: const Icon(
                                Icons.favorite,
                                color: Color(0xFFE11D48),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                  // ── Add More ──────────────────────────────────────────────
                  const SizedBox(height: 8),
                  OutlinedButton.icon(
                    onPressed: () => Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) => const AllProductsScreen(),
                      ),
                    ),
                    icon: const Icon(Icons.add_circle_outline, size: 16),
                    label: const Text(
                      'Add More Items',
                      style: TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 13,
                      ),
                    ),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: const Color(0xFFEC4899),
                      side: const BorderSide(color: Color(0xFFEC4899)),
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      minimumSize: const Size(double.infinity, 0),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                  ),
                ],
              ),
            ),
    );
  }
}
