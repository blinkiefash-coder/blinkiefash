import 'package:flutter/material.dart';

import '../api_base.dart';
import '../services/api_client.dart';
import '../services/cart_manager.dart';
import '../services/wishlist_manager.dart';
import 'cart_screen.dart';
import 'checkout_screen.dart';
import 'try_buy_screen.dart';
import 'wishlist_screen.dart';

class ProductDetailScreen extends StatefulWidget {
  const ProductDetailScreen({
    super.key,
    required this.productId,
    this.initialName,
  });

  final String productId;
  final String? initialName;

  @override
  State<ProductDetailScreen> createState() => _ProductDetailScreenState();
}

class _ProductDetailScreenState extends State<ProductDetailScreen> {
  final ApiClient _apiClient = ApiClient();
  late Future<Map<String, dynamic>> _detailFuture;
  final PageController _imageController = PageController();

  int _activeImageIndex = 0;
  String? _selectedColor;
  String? _selectedSize;
  bool _isWishlisted = false;

  // Cached loaded data — used by bottomNavigationBar outside FutureBuilder
  Map<String, dynamic>? _loadedData;

  @override
  void initState() {
    super.initState();
    _isWishlisted = WishlistManager.instance.isWishlisted(widget.productId);
    _detailFuture = _apiClient.fetchProductDetail(widget.productId);
    // Cache data in state so bottomNavigationBar can access it
    _detailFuture.then((d) {
      if (mounted) setState(() => _loadedData = d);
    });
  }

  @override
  void dispose() {
    _imageController.dispose();
    super.dispose();
  }

  String _formatPrice(dynamic value) {
    if (value == null) return '0';
    final parsed = double.tryParse(value.toString());
    if (parsed == null) return '0';
    return parsed.round().toString();
  }

  String _formatWithCommas(String value) {
    final digits = value.replaceAll(RegExp(r'[^0-9]'), '');
    if (digits.isEmpty) return '0';
    if (digits.length <= 3) return digits;

    final head = digits.substring(0, digits.length - 3);
    final tail = digits.substring(digits.length - 3);
    final chunks = <String>[];

    var i = head.length;
    while (i > 0) {
      final start = (i - 2).clamp(0, i);
      chunks.insert(0, head.substring(start, i));
      i = start;
    }

    return '${chunks.join(',')},$tail';
  }

  int? _discountPercent(String original, String discounted) {
    final op = double.tryParse(original);
    final dp = double.tryParse(discounted);
    if (op == null || dp == null || op <= dp || op <= 0) return null;
    return (((op - dp) / op) * 100).round();
  }

  static const _sizeOrder = [
    'XS',
    'S',
    'M',
    'L',
    'XL',
    'XXL',
    'XXXL',
    '3XL',
    '4XL',
  ];

  List<String> _sortSizes(List<String> sizes) {
    final sorted = List<String>.from(sizes);
    sorted.sort((a, b) {
      final ai = _sizeOrder.indexOf(a.toUpperCase());
      final bi = _sizeOrder.indexOf(b.toUpperCase());
      if (ai == -1 && bi == -1) return a.compareTo(b);
      if (ai == -1) return 1;
      if (bi == -1) return -1;
      return ai.compareTo(bi);
    });
    return sorted;
  }

  String? _normalizeImageUrl(dynamic value) {
    if (value == null) return null;
    // API may return image rows as Maps like {url: '...', variant_id: ...}
    if (value is Map) {
      final url = value['url'] ?? value['image_url'] ?? value['image'];
      return _normalizeImageUrl(url);
    }
    final raw = value.toString().trim();
    if (raw.isEmpty) return null;

    if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
    if (raw.startsWith('/')) return '$apiBaseUrl$raw';

    return '$apiBaseUrl/$raw';
  }

  Color _chipColorFromName(String name) {
    final key = name.trim().toLowerCase();
    if (key.contains('white')) return const Color(0xFFF3F4F6);
    if (key.contains('black')) return const Color(0xFF111827);
    if (key.contains('red')) return const Color(0xFFEF4444);
    if (key.contains('yellow')) return const Color(0xFFFACC15);
    if (key.contains('blue')) return const Color(0xFF60A5FA);
    if (key.contains('green')) return const Color(0xFF22C55E);
    if (key.contains('pink')) return const Color(0xFFF472B6);
    if (key.contains('grey') || key.contains('gray')) {
      return const Color(0xFF9CA3AF);
    }
    if (key.contains('brown')) return const Color(0xFF8B5E3C);
    return const Color(0xFFE5E7EB);
  }

  void _toggleWishlist({
    required String name,
    required String price,
    String? imageUrl,
  }) {
    WishlistManager.instance.toggle(
      WishlistItem(
        productId: widget.productId,
        name: name,
        price: price,
        imageUrl: imageUrl,
      ),
    );
    setState(() {
      _isWishlisted = WishlistManager.instance.isWishlisted(widget.productId);
    });
  }

  void _doAddToCart({
    required String title,
    required String rawPrice,
    required String variantId,
    String? imageUrl,
    String? size,
    String? color,
  }) {
    CartManager.instance.addItem(
      CartItem(
        productId: variantId,
        name: title,
        price: _formatWithCommas(rawPrice),
        rawPrice: rawPrice,
        imageUrl: imageUrl,
        size: size,
        color: color,
      ),
    );
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: const Text('Added to cart'),
        duration: const Duration(seconds: 2),
        action: SnackBarAction(
          label: 'View Cart',
          onPressed: () => Navigator.of(
            context,
          ).push(MaterialPageRoute<void>(builder: (_) => const CartScreen())),
        ),
      ),
    );
  }

  void _openWishlist() {
    Navigator.of(
      context,
    ).push(MaterialPageRoute<void>(builder: (_) => const WishlistScreen()));
  }

  void _openTryBuy({
    required String title,
    required String price,
    required String variantId,
    String? imageUrl,
    String? size,
    String? color,
  }) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => TryBuyScreen(
          productName: title,
          price: _formatWithCommas(price),
          variantId: variantId,
          imageUrl: imageUrl,
          size: size,
          color: color,
        ),
      ),
    );
  }

  void _openCheckout({
    required String title,
    required String price,
    required String variantId,
    String? imageUrl,
    String? size,
    String? color,
  }) {
    // Add item to cart so checkout shows correct total
    CartManager.instance.addItem(
      CartItem(
        productId: variantId,
        name: title,
        price: _formatWithCommas(price),
        rawPrice: price,
        imageUrl: imageUrl,
        size: size,
        color: color,
      ),
    );
    Navigator.of(
      context,
    ).push(MaterialPageRoute<void>(builder: (_) => const CheckoutScreen()));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        elevation: 0,
        backgroundColor: Colors.white,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Color(0xFF111827)),
          onPressed: () => Navigator.of(context).maybePop(),
        ),
        title: Row(
          children: [
            Image.asset('assets/images/logo.png', width: 32, height: 32),
            const SizedBox(width: 6),
            RichText(
              text: const TextSpan(
                style: TextStyle(
                  fontFamily: 'Montserrat',
                  fontWeight: FontWeight.w900,
                  fontSize: 20,
                ),
                children: [
                  TextSpan(
                    text: 'BLINKIE',
                    style: TextStyle(color: Color(0xFF0F172A)),
                  ),
                  TextSpan(
                    text: 'FASH',
                    style: TextStyle(color: Color(0xFF16A34A)),
                  ),
                ],
              ),
            ),
          ],
        ),
        titleSpacing: 0,
        actions: [
          IconButton(
            onPressed: () {},
            icon: const Icon(Icons.search, color: Color(0xFF111827)),
          ),
          IconButton(
            onPressed: _openWishlist,
            icon: const Icon(Icons.favorite_border, color: Color(0xFF111827)),
          ),
          ValueListenableBuilder<int>(
            valueListenable: CartManager.instance.countNotifier,
            builder: (ctx, count, _) => Stack(
              children: [
                IconButton(
                  onPressed: () => Navigator.of(context).push(
                    MaterialPageRoute<void>(builder: (_) => const CartScreen()),
                  ),
                  icon: const Icon(
                    Icons.shopping_bag_outlined,
                    color: Color(0xFF111827),
                  ),
                ),
                if (count > 0)
                  Positioned(
                    right: 6,
                    top: 6,
                    child: Container(
                      width: 16,
                      height: 16,
                      decoration: const BoxDecoration(
                        color: Color(0xFF16A34A),
                        shape: BoxShape.circle,
                      ),
                      child: Center(
                        child: Text(
                          '$count',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 10,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
      backgroundColor: const Color(0xFFF8FAFC),
      // ── Bottom action bar — proper bottomNavigationBar so it avoids
      //    keyboard, system nav bar and home indicator automatically
      bottomNavigationBar: _loadedData == null
          ? null
          : _buildBottomBar(_loadedData!),
      body: FutureBuilder<Map<String, dynamic>>(
        future: _detailFuture,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }

          if (snapshot.hasError ||
              !snapshot.hasData ||
              snapshot.data!.isEmpty) {
            return const Center(
              child: Text(
                'Unable to load product details.',
                style: TextStyle(fontSize: 16),
              ),
            );
          }

          final data = snapshot.data!;
          final product = (data['product'] is Map<String, dynamic>)
              ? data['product'] as Map<String, dynamic>
              : <String, dynamic>{};
          final images = (data['images'] is List)
              ? List<dynamic>.from(data['images'])
              : <dynamic>[];
          final variants = (data['variants'] is List)
              ? List<dynamic>.from(data['variants'])
              : <dynamic>[];

          final title = (product['name'] ?? widget.initialName ?? 'Product')
              .toString();
          final brand = (product['brand'] ?? '').toString();
          final category = (product['category_name'] ?? '').toString();
          final description = (product['description'] ?? '').toString();

          final imageUrls = images
              .map(_normalizeImageUrl)
              .whereType<String>()
              .toList();

          final variantMaps = variants
              .whereType<Map>()
              .map((e) => Map<String, dynamic>.from(e))
              .toList();

          final colorOptions = variantMaps
              .map((v) => (v['color'] ?? '').toString().trim())
              .where((v) => v.isNotEmpty)
              .toSet()
              .toList();

          final effectiveColor =
              (_selectedColor != null && colorOptions.contains(_selectedColor))
              ? _selectedColor
              : (colorOptions.isNotEmpty ? colorOptions.first : null);

          final sizeOptions = _sortSizes(
            variantMaps
                .where(
                  (v) => effectiveColor == null
                      ? true
                      : (v['color'] ?? '').toString().trim() == effectiveColor,
                )
                .map((v) => (v['size'] ?? '').toString().trim())
                .where((v) => v.isNotEmpty)
                .toSet()
                .toList(),
          );

          final effectiveSize =
              (_selectedSize != null && sizeOptions.contains(_selectedSize))
              ? _selectedSize
              : null;

          Map<String, dynamic>? selectedVariant;
          for (final v in variantMaps) {
            final matchesColor = effectiveColor == null
                ? true
                : (v['color'] ?? '').toString().trim() == effectiveColor;
            final matchesSize = effectiveSize == null
                ? true
                : (v['size'] ?? '').toString().trim() == effectiveSize;
            if (matchesColor && matchesSize) {
              selectedVariant = v;
              break;
            }
          }
          selectedVariant ??= variantMaps.isNotEmpty
              ? variantMaps.first
              : <String, dynamic>{};

          final currentPrice = _formatPrice(
            selectedVariant['discount_price'] ?? selectedVariant['price'],
          );
          final originalPrice = _formatPrice(selectedVariant['price']);
          final offPercent = _discountPercent(originalPrice, currentPrice);
          final stock =
              int.tryParse(
                (selectedVariant['available_stock'] ?? 0).toString(),
              ) ??
              0;

          final displayImages = imageUrls.isNotEmpty
              ? imageUrls
              : <String?>[null];
          final selectedImage = imageUrls.isNotEmpty ? imageUrls.first : null;

          return SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(14, 10, 14, 20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(22),
                  child: Container(
                    color: const Color(0xFFF3F4F6),
                    child: Stack(
                      children: [
                        AspectRatio(
                          aspectRatio: 0.74,
                          child: PageView.builder(
                            controller: _imageController,
                            itemCount: displayImages.length,
                            onPageChanged: (index) {
                              setState(() => _activeImageIndex = index);
                            },
                            itemBuilder: (context, index) {
                              final image = displayImages[index];
                              if (image == null) {
                                return const Icon(
                                  Icons.image_not_supported_outlined,
                                  size: 36,
                                  color: Color(0xFF9CA3AF),
                                );
                              }
                              return Image.network(
                                image,
                                fit: BoxFit.cover,
                                errorBuilder: (context, error, stackTrace) {
                                  return const Icon(
                                    Icons.broken_image_outlined,
                                    size: 36,
                                    color: Color(0xFF9CA3AF),
                                  );
                                },
                              );
                            },
                          ),
                        ),
                        Positioned(
                          left: 12,
                          top: 18,
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: const [
                              _TopTag(
                                text: '60 MIN DELIVERY',
                                dark: true,
                                icon: Icons.bolt,
                              ),
                              SizedBox(height: 8),
                              _TopTag(
                                text: 'Try & Buy',
                                dark: false,
                                icon: Icons.inventory_2_outlined,
                              ),
                            ],
                          ),
                        ),
                        Positioned(
                          right: 12,
                          top: 12,
                          child: CircleAvatar(
                            radius: 22,
                            backgroundColor: Colors.white,
                            child: IconButton(
                              onPressed: () => _toggleWishlist(
                                name: title,
                                price: currentPrice,
                                imageUrl: selectedImage,
                              ),
                              icon: Icon(
                                _isWishlisted
                                    ? Icons.favorite
                                    : Icons.favorite_border,
                                color: _isWishlisted
                                    ? const Color(0xFFE11D48)
                                    : const Color(0xFF374151),
                              ),
                            ),
                          ),
                        ),
                        if (displayImages.length > 1) ...[
                          Positioned(
                            left: 12,
                            top: 0,
                            bottom: 0,
                            child: _CircleArrow(
                              icon: Icons.chevron_left,
                              onTap: () {
                                if (_activeImageIndex == 0) return;
                                _imageController.previousPage(
                                  duration: const Duration(milliseconds: 250),
                                  curve: Curves.easeOut,
                                );
                              },
                            ),
                          ),
                          Positioned(
                            right: 12,
                            top: 0,
                            bottom: 0,
                            child: _CircleArrow(
                              icon: Icons.chevron_right,
                              onTap: () {
                                if (_activeImageIndex >=
                                    displayImages.length - 1) {
                                  return;
                                }
                                _imageController.nextPage(
                                  duration: const Duration(milliseconds: 250),
                                  curve: Curves.easeOut,
                                );
                              },
                            ),
                          ),
                        ],
                        Positioned(
                          right: 12,
                          bottom: 12,
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 12,
                              vertical: 6,
                            ),
                            decoration: BoxDecoration(
                              color: Colors.white.withValues(alpha: 0.92),
                              borderRadius: BorderRadius.circular(14),
                            ),
                            child: Text(
                              '${_activeImageIndex + 1}/${displayImages.length}',
                              style: const TextStyle(
                                fontWeight: FontWeight.w700,
                                color: Color(0xFF111827),
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 10),
                if (displayImages.length > 1)
                  Center(
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: List.generate(displayImages.length, (index) {
                        final active = index == _activeImageIndex;
                        return AnimatedContainer(
                          duration: const Duration(milliseconds: 180),
                          margin: const EdgeInsets.symmetric(horizontal: 3),
                          height: 5,
                          width: active ? 18 : 10,
                          decoration: BoxDecoration(
                            color: active
                                ? const Color(0xFF16A34A)
                                : const Color(0xFFD1D5DB),
                            borderRadius: BorderRadius.circular(100),
                          ),
                        );
                      }),
                    ),
                  ),
                const SizedBox(height: 16),
                if (category.trim().isNotEmpty)
                  Text(
                    category.toUpperCase(),
                    style: const TextStyle(
                      color: Color(0xFFE11D48),
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                if (category.trim().isNotEmpty) const SizedBox(height: 6),
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w800,
                    height: 1.08,
                  ),
                ),
                const SizedBox(height: 8),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(
                      child: Text(
                        brand.trim().isNotEmpty
                            ? 'By $brand'
                            : 'By BlinkieFash',
                        style: const TextStyle(
                          fontSize: 14,
                          color: Color(0xFF475569),
                          fontWeight: FontWeight.w600,
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    const SizedBox(width: 10),
                    const Row(
                      children: [
                        Icon(Icons.star, color: Color(0xFF16A34A), size: 20),
                        SizedBox(width: 4),
                        Text(
                          '4.6 (128)',
                          style: TextStyle(
                            fontWeight: FontWeight.w700,
                            color: Color(0xFF16A34A),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      '₹${_formatWithCommas(currentPrice)}',
                      style: const TextStyle(
                        fontSize: 24,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    if (originalPrice != currentPrice)
                      Padding(
                        padding: const EdgeInsets.only(left: 10, bottom: 6),
                        child: Text(
                          '₹${_formatWithCommas(originalPrice)}',
                          style: const TextStyle(
                            fontSize: 14,
                            color: Color(0xFF9CA3AF),
                            decoration: TextDecoration.lineThrough,
                          ),
                        ),
                      ),
                    if (offPercent != null)
                      Padding(
                        padding: const EdgeInsets.only(left: 10, bottom: 8),
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 3,
                          ),
                          decoration: BoxDecoration(
                            color: const Color(0xFFFCE7F3),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Text(
                            '$offPercent% OFF',
                            style: const TextStyle(
                              color: Color(0xFFE11D48),
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 4),
                const Text(
                  'Inclusive of all taxes',
                  style: TextStyle(color: Color(0xFF64748B), fontSize: 12),
                ),
                const SizedBox(height: 16),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 14,
                    vertical: 12,
                  ),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF0FDF4),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Row(
                    children: const [
                      Icon(Icons.bolt, color: Color(0xFF16A34A)),
                      SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          'Get it in 60 mins\nDelivering to Bhubaneswar',
                          style: TextStyle(
                            fontWeight: FontWeight.w600,
                            color: Color(0xFF334155),
                          ),
                        ),
                      ),
                      Text(
                        'Change',
                        style: TextStyle(
                          color: Color(0xFF16A34A),
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 18),
                Text(
                  'Color: ${effectiveColor ?? '-'}',
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF111827),
                  ),
                ),
                const SizedBox(height: 10),
                SizedBox(
                  height: 64,
                  child: ListView.separated(
                    scrollDirection: Axis.horizontal,
                    itemCount: colorOptions.length,
                    separatorBuilder: (_, _) => const SizedBox(width: 10),
                    itemBuilder: (context, index) {
                      final colorName = colorOptions[index];
                      final active = colorName == effectiveColor;
                      final chipColor = _chipColorFromName(colorName);
                      return GestureDetector(
                        onTap: () {
                          setState(() {
                            _selectedColor = colorName;
                            _selectedSize = null;
                          });
                        },
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 180),
                          width: 64,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            border: Border.all(
                              color: active
                                  ? const Color(0xFF16A34A)
                                  : const Color(0xFFE5E7EB),
                              width: active ? 3 : 1,
                            ),
                          ),
                          child: Center(
                            child: CircleAvatar(
                              radius: 24,
                              backgroundColor: chipColor,
                              child: Text(
                                colorName.isEmpty
                                    ? '-'
                                    : colorName.substring(0, 1).toUpperCase(),
                                style: TextStyle(
                                  fontWeight: FontWeight.w800,
                                  color: chipColor.computeLuminance() < 0.4
                                      ? Colors.white
                                      : const Color(0xFF111827),
                                ),
                              ),
                            ),
                          ),
                        ),
                      );
                    },
                  ),
                ),
                const SizedBox(height: 16),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      effectiveSize != null
                          ? 'Size: $effectiveSize (Selected)'
                          : 'Select Size',
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF111827),
                      ),
                    ),
                    TextButton(
                      onPressed: () {},
                      style: TextButton.styleFrom(
                        padding: EdgeInsets.zero,
                        minimumSize: Size.zero,
                        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                      ),
                      child: const Text(
                        'Size Guide',
                        style: TextStyle(
                          fontSize: 13,
                          color: Color(0xFF16A34A),
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                Wrap(
                  spacing: 10,
                  runSpacing: 10,
                  children: sizeOptions.map((size) {
                    final active = size == effectiveSize;
                    return GestureDetector(
                      onTap: () => setState(() => _selectedSize = size),
                      child: Container(
                        width: 68,
                        height: 50,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color: active
                              ? const Color(0xFFECFDF3)
                              : Colors.white,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: active
                                ? const Color(0xFF22C55E)
                                : const Color(0xFFE5E7EB),
                            width: active ? 1.5 : 1,
                          ),
                        ),
                        child: Text(
                          size,
                          style: TextStyle(
                            fontWeight: FontWeight.w700,
                            color: active
                                ? const Color(0xFF166534)
                                : const Color(0xFF111827),
                          ),
                        ),
                      ),
                    );
                  }).toList(),
                ),
                const SizedBox(height: 18),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 14,
                  ),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: const Color(0xFFE5E7EB)),
                  ),
                  child: const Row(
                    children: [
                      Expanded(
                        child: _FeatureBlock(
                          icon: Icons.bolt,
                          title: '60 MIN DELIVERY',
                          subtitle: 'Lightning fast delivery',
                        ),
                      ),
                      Expanded(
                        child: _FeatureBlock(
                          icon: Icons.inventory_2_outlined,
                          title: 'TRY & BUY',
                          subtitle: 'Try at home for 15 mins',
                        ),
                      ),
                      Expanded(
                        child: _FeatureBlock(
                          icon: Icons.verified_user_outlined,
                          title: '100% ORIGINAL',
                          subtitle: 'Authenticity guaranteed',
                        ),
                      ),
                      Expanded(
                        child: _FeatureBlock(
                          icon: Icons.lock_outline,
                          title: 'SECURE PAYMENTS',
                          subtitle: 'Safe and trusted',
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 14),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: const Color(0xFFE5E7EB)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Get it in 60 mins',
                        style: TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      const SizedBox(height: 8),
                      const Text(
                        'Delivering to 751030',
                        style: TextStyle(
                          color: Color(0xFF64748B),
                          fontSize: 16,
                        ),
                      ),
                      const SizedBox(height: 10),
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF8FAFC),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: const Row(
                          children: [
                            Icon(
                              Icons.delivery_dining,
                              color: Color(0xFF16A34A),
                            ),
                            SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                'We deliver in 60 mins\nPlace order in next 15 mins',
                                style: TextStyle(
                                  color: Color(0xFF111827),
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ),
                            Text(
                              '15 mins',
                              style: TextStyle(
                                color: Color(0xFF16A34A),
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 14),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: const Color(0xFFE5E7EB)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Product Description',
                        style: TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      const SizedBox(height: 10),
                      Text(
                        description.trim().isNotEmpty
                            ? description
                            : 'Premium quality fashion product with modern fit and clean finish.',
                        style: const TextStyle(
                          fontSize: 16,
                          color: Color(0xFF1F2937),
                          height: 1.4,
                        ),
                      ),
                    ],
                  ),
                ),
                if (description.trim().isNotEmpty) ...[
                  const SizedBox(height: 14),
                ],
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: const Color(0xFFE5E7EB)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Product Details',
                        style: TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      const SizedBox(height: 10),
                      _DetailRow(
                        label: 'Brand',
                        value: brand.isEmpty ? '-' : brand,
                      ),
                      _DetailRow(
                        label: 'Category',
                        value: category.isEmpty ? '-' : category,
                      ),
                      _DetailRow(label: 'Color', value: effectiveColor ?? '-'),
                      _DetailRow(label: 'Size', value: effectiveSize ?? '-'),
                      _DetailRow(label: 'Available Stock', value: '$stock'),
                    ],
                  ),
                ),
                const SizedBox(height: 14),
                // Cash on Delivery
                Container(
                  width: double.infinity,
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: const Color(0xFFE5E7EB)),
                  ),
                  child: const _ExpandableInfoRow(
                    icon: Icons.payments_outlined,
                    title: 'Cash on Delivery',
                    subtitle: 'Pay when your order arrives',
                  ),
                ),
                const SizedBox(height: 8),
                // Genuine Quality Assured
                Container(
                  width: double.infinity,
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: const Color(0xFFE5E7EB)),
                  ),
                  child: const _ExpandableInfoRow(
                    icon: Icons.verified_outlined,
                    title: 'Genuine Quality Assured',
                    subtitle: '100% authentic products guaranteed',
                  ),
                ),
                const SizedBox(height: 14),
                // Ratings & Reviews (improved)
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: const Color(0xFFE5E7EB)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: const [
                              Text(
                                'Ratings & Reviews',
                                style: TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.w800,
                                  color: Color(0xFF111827),
                                ),
                              ),
                              SizedBox(height: 2),
                              Text(
                                '4.6★  (128 Ratings)',
                                style: TextStyle(
                                  fontSize: 13,
                                  color: Color(0xFF64748B),
                                ),
                              ),
                            ],
                          ),
                          TextButton(
                            onPressed: () {},
                            child: const Text(
                              'See All >',
                              style: TextStyle(
                                color: Color(0xFF16A34A),
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 10),
                      Row(
                        children: List.generate(5, (idx) {
                          return const Icon(
                            Icons.star_rounded,
                            color: Color(0xFFFBBF24),
                            size: 20,
                          );
                        }),
                      ),
                      const SizedBox(height: 6),
                      const Text(
                        '"Great quality and fast delivery! Loved the fit."',
                        style: TextStyle(
                          fontSize: 13,
                          color: Color(0xFF374151),
                          fontStyle: FontStyle.italic,
                        ),
                      ),
                      const SizedBox(height: 4),
                      const Text(
                        '— Priya S.  •  Verified Purchase',
                        style: TextStyle(
                          fontSize: 11,
                          color: Color(0xFF94A3B8),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 14),
              ],
            ),
          );
        },
      ),
    );
  }

  /// Bottom action bar built from cached loaded data.
  /// Placed in Scaffold.bottomNavigationBar so it automatically avoids the
  /// keyboard, system navigation bar, and home indicator on all devices.
  Widget _buildBottomBar(Map<String, dynamic> data) {
    final product = (data['product'] is Map<String, dynamic>)
        ? data['product'] as Map<String, dynamic>
        : <String, dynamic>{};
    final variants = (data['variants'] is List)
        ? List<dynamic>.from(data['variants'])
        : <dynamic>[];
    final images = (data['images'] is List)
        ? List<dynamic>.from(data['images'])
        : <dynamic>[];

    final variantMaps = variants
        .whereType<Map>()
        .map((e) => Map<String, dynamic>.from(e))
        .toList();
    final colorOptions = variantMaps
        .map((v) => (v['color'] ?? '').toString().trim())
        .where((v) => v.isNotEmpty)
        .toSet()
        .toList();
    final effectiveColor =
        (_selectedColor != null && colorOptions.contains(_selectedColor))
        ? _selectedColor
        : (colorOptions.isNotEmpty ? colorOptions.first : null);
    final sizeOptions = _sortSizes(
      variantMaps
          .where(
            (v) => effectiveColor == null
                ? true
                : (v['color'] ?? '').toString().trim() == effectiveColor,
          )
          .map((v) => (v['size'] ?? '').toString().trim())
          .where((v) => v.isNotEmpty)
          .toSet()
          .toList(),
    );
    final effectiveSize =
        (_selectedSize != null && sizeOptions.contains(_selectedSize))
        ? _selectedSize
        : null;

    Map<String, dynamic>? selectedVariant;
    for (final v in variantMaps) {
      final matchesColor = effectiveColor == null
          ? true
          : (v['color'] ?? '').toString().trim() == effectiveColor;
      final matchesSize = effectiveSize == null
          ? true
          : (v['size'] ?? '').toString().trim() == effectiveSize;
      if (matchesColor && matchesSize) {
        selectedVariant = v;
        break;
      }
    }
    selectedVariant ??= variantMaps.isNotEmpty
        ? variantMaps.first
        : <String, dynamic>{};

    final imageUrls = images
        .map(_normalizeImageUrl)
        .whereType<String>()
        .toList();
    final selectedImage = imageUrls.isNotEmpty ? imageUrls.first : null;
    final title = (product['name'] ?? '').toString();
    final currentPrice = _formatPrice(
      selectedVariant['discount_price'] ?? selectedVariant['price'],
    );
    final variantId = selectedVariant['id']?.toString() ?? '';
    final isTryEnabled = product['is_try_enabled'] != false;

    return SafeArea(
      child: Container(
        padding: const EdgeInsets.fromLTRB(8, 10, 8, 12),
        decoration: const BoxDecoration(
          color: Colors.white,
          border: Border(top: BorderSide(color: Color(0xFFE5E7EB))),
        ),
        child: Row(
          children: [
            Expanded(
              child: OutlinedButton(
                onPressed: () => _doAddToCart(
                  title: title,
                  rawPrice: currentPrice,
                  variantId: variantId,
                  imageUrl: selectedImage,
                  size: effectiveSize,
                  color: effectiveColor,
                ),
                style: OutlinedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 10),
                ),
                child: const Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      'Add to Cart',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(width: 6),
            Expanded(
              child: OutlinedButton(
                onPressed: isTryEnabled
                    ? () => _openTryBuy(
                        title: title,
                        price: currentPrice,
                        variantId: variantId,
                        imageUrl: selectedImage,
                        size: effectiveSize,
                        color: effectiveColor,
                      )
                    : null,
                style: OutlinedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 10),
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      isTryEnabled ? 'Try & Buy' : 'Not Available',
                      style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    Text(
                      isTryEnabled ? 'Try for 15 mins' : 'Try & Buy disabled',
                      style: const TextStyle(
                        fontSize: 10,
                        color: Color(0xFF64748B),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(width: 6),
            Expanded(
              child: FilledButton(
                style: FilledButton.styleFrom(
                  backgroundColor: const Color(0xFF16A34A),
                  padding: const EdgeInsets.symmetric(vertical: 10),
                ),
                onPressed: () => _openCheckout(
                  title: title,
                  price: currentPrice,
                  variantId: variantId,
                  imageUrl: selectedImage,
                  size: effectiveSize,
                  color: effectiveColor,
                ),
                child: const Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      'Buy Now',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    Text(
                      'Get it in 60 mins',
                      style: TextStyle(fontSize: 10, color: Colors.white70),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _TopTag extends StatelessWidget {
  const _TopTag({required this.text, required this.dark, required this.icon});

  final String text;
  final bool dark;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: dark ? const Color(0xFF111827) : Colors.white,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            icon,
            size: 16,
            color: dark ? const Color(0xFFFACC15) : const Color(0xFF16A34A),
          ),
          const SizedBox(width: 6),
          Text(
            text,
            style: TextStyle(
              color: dark ? Colors.white : const Color(0xFF16A34A),
              fontWeight: FontWeight.w800,
              fontSize: 12,
            ),
          ),
        ],
      ),
    );
  }
}

class _CircleArrow extends StatelessWidget {
  const _CircleArrow({required this.icon, required this.onTap});

  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Container(
        width: 42,
        height: 42,
        decoration: const BoxDecoration(
          color: Colors.white,
          shape: BoxShape.circle,
        ),
        child: IconButton(onPressed: onTap, icon: Icon(icon)),
      ),
    );
  }
}

class _FeatureBlock extends StatelessWidget {
  const _FeatureBlock({
    required this.icon,
    required this.title,
    required this.subtitle,
  });

  final IconData icon;
  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Icon(icon, color: const Color(0xFF22C55E)),
        const SizedBox(height: 6),
        Text(
          title,
          textAlign: TextAlign.center,
          style: const TextStyle(
            fontSize: 10,
            fontWeight: FontWeight.w800,
            color: Color(0xFF111827),
          ),
        ),
        const SizedBox(height: 4),
        Text(
          subtitle,
          textAlign: TextAlign.center,
          style: const TextStyle(fontSize: 10, color: Color(0xFF64748B)),
        ),
      ],
    );
  }
}

class _DetailRow extends StatelessWidget {
  const _DetailRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        children: [
          SizedBox(
            width: 120,
            child: Text(
              label,
              style: const TextStyle(
                color: Color(0xFF64748B),
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: const TextStyle(
                color: Color(0xFF111827),
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ExpandableInfoRow extends StatelessWidget {
  const _ExpandableInfoRow({
    required this.icon,
    required this.title,
    required this.subtitle,
  });

  final IconData icon;
  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
      child: Row(
        children: [
          Icon(icon, color: const Color(0xFF16A34A), size: 22),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF111827),
                    fontSize: 14,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  subtitle,
                  style: const TextStyle(
                    color: Color(0xFF64748B),
                    fontSize: 12,
                  ),
                ),
              ],
            ),
          ),
          const Icon(Icons.chevron_right, color: Color(0xFF9CA3AF)),
        ],
      ),
    );
  }
}
