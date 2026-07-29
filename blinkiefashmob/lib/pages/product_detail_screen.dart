import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:image_picker/image_picker.dart';
import 'package:url_launcher/url_launcher.dart' as ul;

import '../api_base.dart';
import '../services/api_client.dart';
import '../services/cart_manager.dart';
import '../services/wishlist_manager.dart';
import 'cart_screen.dart';
import 'checkout_screen.dart';
import 'try_buy_screen.dart';
import 'wishlist_screen.dart';
import '../widgets/bf_loader.dart';
import '../widgets/animated_search_bar.dart';

class ProductDetailScreen extends StatefulWidget {
  const ProductDetailScreen({
    super.key,
    required this.productId,
    this.initialName,
    this.initialColor,
    this.initialSize,
  });

  final String productId;
  final String? initialName;
  final String? initialColor;
  final String? initialSize;

  @override
  State<ProductDetailScreen> createState() => _ProductDetailScreenState();
}

class _ProductDetailScreenState extends State<ProductDetailScreen> {
  final ApiClient _apiClient = ApiClient();
  late Future<Map<String, dynamic>> _detailFuture;
  final PageController _imageController = PageController(keepPage: false);

  int _activeImageIndex = 0;
  String? _selectedColor;
  String? _selectedSize;
  bool _isWishlisted = false;

  // Reviews
  List<Map<String, dynamic>> _reviews = const [];
  bool _reviewsLoading = true;
  double _avgRating = 0;
  int _reviewCount = 0;

  // New review form
  int _newReviewRating = 5;
  final TextEditingController _reviewTextCtrl = TextEditingController();
  final TextEditingController _reviewerNameCtrl = TextEditingController();
  bool _submittingReview = false;
  XFile? _pickedReviewImage;

  // Description expansion
  bool _descExpanded = false;

  // Selected payment method
  String _selectedPaymentMethod = 'Cash on Delivery';

  // Similar products
  List<Map<String, dynamic>> _similarProducts = const [];
  bool _similarLoading = false;

  // Cached loaded data — used by bottomNavigationBar outside FutureBuilder
  Map<String, dynamic>? _loadedData;

  @override
  void initState() {
    super.initState();
    _isWishlisted = WishlistManager.instance.isWishlisted(widget.productId);
    // Pre-select the colour/size that was tapped in the listing card.
    if (widget.initialColor != null && widget.initialColor!.isNotEmpty) {
      _selectedColor = widget.initialColor;
    }
    if (widget.initialSize != null && widget.initialSize!.isNotEmpty) {
      _selectedSize = widget.initialSize;
    }
    _detailFuture = _apiClient.fetchProductDetail(widget.productId);
    // Cache data in state so bottomNavigationBar can access it
    _detailFuture.then((d) {
      if (mounted) {
        setState(() => _loadedData = d);
        _loadSimilarProducts(d);
      }
    });
    _loadReviews();
  }

  @override
  void dispose() {
    _imageController.dispose();
    _reviewTextCtrl.dispose();
    _reviewerNameCtrl.dispose();
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
      final aa = a.trim().toUpperCase();
      final bb = b.trim().toUpperCase();

      final ai = _sizeOrder.indexOf(aa);
      final bi = _sizeOrder.indexOf(bb);

      // Named apparel sizes first in canonical order.
      if (ai != -1 || bi != -1) {
        if (ai == -1) return 1;
        if (bi == -1) return -1;
        return ai.compareTo(bi);
      }

      // Then numeric sizes (e.g., 28, 30, 32) in ascending order.
      final aNum = RegExp(r'\d+').firstMatch(aa);
      final bNum = RegExp(r'\d+').firstMatch(bb);
      if (aNum != null || bNum != null) {
        if (aNum == null) return 1;
        if (bNum == null) return -1;
        final av = int.tryParse(aNum.group(0)!) ?? 0;
        final bv = int.tryParse(bNum.group(0)!) ?? 0;
        if (av != bv) return av.compareTo(bv);
      }

      return aa.compareTo(bb);
    });
    return sorted;
  }

  String _normalizeColorValue(dynamic value) {
    return (value ?? '').toString().trim().toLowerCase().replaceAll(
      RegExp(r'\s+'),
      ' ',
    );
  }

  String? _imageVariantId(dynamic raw) {
    if (raw is! Map) return null;
    final value = raw['variant_id'] ?? raw['variantId'];
    final id = (value ?? '').toString().trim();
    return id.isEmpty ? null : id;
  }

  String? _variantIdOf(Map<String, dynamic> variant) {
    final id =
        (variant['id'] ?? variant['variant_id'] ?? variant['variantId'] ?? '')
            .toString()
            .trim();
    return id.isEmpty ? null : id;
  }

  String? _variantImageFallback(Map<String, dynamic> variant) {
    return _normalizeImageUrl(
      variant['image_url'] ?? variant['image'] ?? variant['imageUrl'],
    );
  }

  String? _normalizeImageUrl(dynamic value) {
    final raw = (value ?? '').toString().trim();
    if (raw.isEmpty) return null;

    if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
    if (raw.startsWith('/')) return '$apiBaseUrl$raw';

    return '$apiBaseUrl/$raw';
  }

  bool _isPrimaryImage(dynamic value) {
    if (value is! Map) return false;
    final raw = value['is_primary'] ?? value['isPrimary'];
    if (raw is bool) return raw;
    if (raw is num) return raw != 0;
    if (raw is String) {
      final normalized = raw.trim().toLowerCase();
      return normalized == 'true' || normalized == '1' || normalized == 'yes';
    }
    return false;
  }

  List<String> _collectVariantImageUrls(
    List<dynamic> images, {
    required String? variantId,
  }) {
    final primaryUrls = <String>[];
    final fallbackUrls = <String>[];

    for (final raw in images) {
      final url = raw is Map
          ? _normalizeImageUrl(raw['url'])
          : _normalizeImageUrl(raw);
      if (url == null) continue;

      if (raw is! Map) {
        fallbackUrls.add(url);
        continue;
      }

      final currentVariantId = _imageVariantId(raw);
      final matchesVariant = variantId == null || currentVariantId == variantId;
      if (!matchesVariant) continue;

      if (_isPrimaryImage(raw)) {
        primaryUrls.add(url);
      } else {
        fallbackUrls.add(url);
      }
    }

    return [...primaryUrls, ...fallbackUrls];
  }

  String? _bestImageForVariantIds(
    List<dynamic> images, {
    required Set<String> variantIds,
    List<String> fallbackImageUrls = const [],
  }) {
    if (variantIds.isNotEmpty) {
      final primaryUrls = <String>[];
      final secondaryUrls = <String>[];
      for (final raw in images) {
        if (raw is! Map) continue;
        final vid = _imageVariantId(raw);
        if (vid == null || !variantIds.contains(vid)) continue;
        final url = _normalizeImageUrl(raw['url']);
        if (url == null) continue;
        if (_isPrimaryImage(raw)) {
          primaryUrls.add(url);
        } else {
          secondaryUrls.add(url);
        }
      }
      if (primaryUrls.isNotEmpty) return primaryUrls.first;
      if (secondaryUrls.isNotEmpty) return secondaryUrls.first;
    }

    final generalPrimary = <String>[];
    final generalFallback = <String>[];
    for (final raw in images) {
      final url = raw is Map
          ? _normalizeImageUrl(raw['url'])
          : _normalizeImageUrl(raw);
      if (url == null) continue;
      if (raw is! Map || _imageVariantId(raw) == null) {
        if (raw is Map && _isPrimaryImage(raw)) {
          generalPrimary.add(url);
        } else {
          generalFallback.add(url);
        }
      }
    }
    if (generalPrimary.isNotEmpty) return generalPrimary.first;
    if (generalFallback.isNotEmpty) return generalFallback.first;

    for (final url in fallbackImageUrls) {
      if (url.trim().isNotEmpty) return url;
    }
    return null;
  }

  String? _resolveProductImage(Map<String, dynamic> productData) {
    final explicit = _normalizeImageUrl(
      productData['image'] ??
          productData['image_url'] ??
          productData['imageUrl'],
    );
    if (explicit != null) return explicit;

    final images = productData['images'] is List
        ? List<dynamic>.from(productData['images'])
        : <dynamic>[];
    final primaryImages = <String>[];
    final fallbackImages = <String>[];
    for (final raw in images) {
      final url = raw is Map
          ? _normalizeImageUrl(raw['url'])
          : _normalizeImageUrl(raw);
      if (url == null) continue;
      if (raw is Map && _isPrimaryImage(raw)) {
        primaryImages.add(url);
      } else {
        fallbackImages.add(url);
      }
    }

    if (primaryImages.isNotEmpty) return primaryImages.first;
    if (fallbackImages.isNotEmpty) return fallbackImages.first;
    return null;
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

  void _openImageViewer(List<String> images, int initialIndex) {
    if (images.isEmpty) return;
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) =>
            _ImagePreviewScreen(images: images, initialIndex: initialIndex),
      ),
    );
  }

  void _doAddToCart({
    required String title,
    required String rawPrice,
    required String variantId,
    String? compareRawPrice,
    String? imageUrl,
    String? size,
    String? color,
    int? availableStock,
  }) {
    final added = CartManager.instance.addItem(
      CartItem(
        productId: variantId,
        name: title,
        price: _formatWithCommas(rawPrice),
        rawPrice: rawPrice,
        compareRawPrice: compareRawPrice,
        imageUrl: imageUrl,
        size: size,
        color: color,
        availableStock: availableStock,
      ),
    );
    if (!added) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('This variant is out of stock')),
      );
      return;
    }
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

  // ── Share Product ──────────────────────────────────────────────────
  void _shareProduct(String productId, String title, String? imageUrl) {
    final url = 'https://blinkiefash.com/product/$productId';
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (_) => Container(
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 36),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                margin: const EdgeInsets.only(bottom: 16),
                decoration: BoxDecoration(
                  color: const Color(0xFFE2E8F0),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            Row(
              children: [
                if (imageUrl != null)
                  ClipRRect(
                    borderRadius: BorderRadius.circular(10),
                    child: Image.network(
                      imageUrl,
                      width: 56,
                      height: 64,
                      fit: BoxFit.cover,
                      errorBuilder: (_, _, _) =>
                          const SizedBox(width: 56, height: 64),
                    ),
                  ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Share Product',
                        style: TextStyle(
                          fontSize: 17,
                          fontWeight: FontWeight.w800,
                          color: Color(0xFF0F172A),
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        title,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 13,
                          color: Color(0xFF64748B),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),
            _shareOption(
              icon: Icons.copy_rounded,
              color: const Color(0xFF334155),
              bg: const Color(0xFFF1F5F9),
              label: 'Copy Link',
              sub: url,
              onTap: () async {
                await Clipboard.setData(ClipboardData(text: url));
                if (!mounted) return;
                Navigator.pop(context);
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text('\u2714 Link copied to clipboard'),
                    duration: Duration(seconds: 2),
                  ),
                );
              },
            ),
            const SizedBox(height: 10),
            _shareOption(
              icon: Icons.chat_rounded,
              color: const Color(0xFF25D366),
              bg: const Color(0xFFDCFCE7),
              label: 'Share on WhatsApp',
              sub: 'Send to contacts or groups',
              onTap: () async {
                Navigator.pop(context);
                final text = Uri.encodeComponent(
                  'Check out $title on BlinkieFash! $url',
                );
                final waUri = Uri.parse('whatsapp://send?text=$text');
                if (await ul.canLaunchUrl(waUri)) {
                  await ul.launchUrl(waUri);
                } else {
                  await ul.launchUrl(
                    Uri.parse('https://wa.me/?text=$text'),
                    mode: ul.LaunchMode.externalApplication,
                  );
                }
              },
            ),
            const SizedBox(height: 10),
            _shareOption(
              icon: Icons.share_rounded,
              color: const Color(0xFF7C3AED),
              bg: const Color(0xFFF3E8FF),
              label: 'Share via...',
              sub: 'More apps & options',
              onTap: () async {
                Navigator.pop(context);
                await Clipboard.setData(
                  ClipboardData(text: 'Check out $title on BlinkieFash! $url'),
                );
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Link copied — paste to share!'),
                      backgroundColor: Color(0xFF7C3AED),
                    ),
                  );
                }
              },
            ),
          ],
        ),
      ),
    );
  }

  Widget _shareOption({
    required IconData icon,
    required Color color,
    required Color bg,
    required String label,
    required String sub,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: color.withValues(alpha: 0.2)),
        ),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: color,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(icon, color: Colors.white, size: 20),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    label,
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF0F172A),
                    ),
                  ),
                  Text(
                    sub,
                    style: const TextStyle(
                      fontSize: 11,
                      color: Color(0xFF64748B),
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
            const Icon(
              Icons.arrow_forward_ios_rounded,
              size: 13,
              color: Color(0xFFCBD5E1),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _loadReviews() async {
    if (!mounted) return;
    setState(() => _reviewsLoading = true);
    try {
      final result = await _apiClient.fetchReviews(widget.productId);
      if (mounted) {
        setState(() {
          _reviews = (result['reviews'] as List? ?? [])
              .whereType<Map<String, dynamic>>()
              .toList();
          _avgRating = (result['average_rating'] as num?)?.toDouble() ?? 0;
          _reviewCount = (result['count'] as int?) ?? 0;
          _reviewsLoading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _reviewsLoading = false);
    }
  }

  Future<void> _loadSimilarProducts(Map<String, dynamic> data) async {
    final categoryId = (data['product'] as Map?)?['category_id']?.toString();
    if (categoryId == null || categoryId.isEmpty || !mounted) return;
    setState(() => _similarLoading = true);
    try {
      final result = await _apiClient.fetchAllProducts(
        categoryId: categoryId,
        limit: 10,
      );
      if (mounted) {
        final products = (result['products'] as List? ?? [])
            .whereType<Map<String, dynamic>>()
            .where((p) => p['id']?.toString() != widget.productId)
            .toList();
        setState(() {
          _similarProducts = products;
          _similarLoading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _similarLoading = false);
    }
  }

  Future<void> _submitReview(String productId) async {
    final text = _reviewTextCtrl.text.trim();
    if (text.isEmpty) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Please write your review')));
      return;
    }
    setState(() => _submittingReview = true);
    try {
      final userId = FirebaseAuth.instance.currentUser?.uid;

      // Upload image first if picked
      String? uploadedImageUrl;
      if (_pickedReviewImage != null) {
        uploadedImageUrl = await _apiClient.uploadReviewImage(
          _pickedReviewImage!.path,
        );
      }

      final result = await _apiClient.submitReview(
        productId: productId,
        rating: _newReviewRating,
        reviewText: text,
        reviewerName: _reviewerNameCtrl.text.trim().isEmpty
            ? null
            : _reviewerNameCtrl.text.trim(),
        userId: userId,
        imageUrl: uploadedImageUrl,
      );
      if (!mounted) return;
      setState(() => _submittingReview = false);
      if (result['success'] == true) {
        _reviewTextCtrl.clear();
        _reviewerNameCtrl.clear();
        setState(() {
          _newReviewRating = 5;
          _pickedReviewImage = null;
        });
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('Review submitted!')));
        _loadReviews();
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(result['message']?.toString() ?? 'Failed to submit'),
          ),
        );
      }
    } catch (e) {
      debugPrint('Review submission error: $e');
      if (!mounted) return;
      setState(() => _submittingReview = false);
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Error: ${e.toString()}')));
    }
  }

  void _showPaymentInfoSheet(BuildContext ctx) {
    // track selection locally inside the sheet; seed with current selection
    String localSelected = _selectedPaymentMethod;

    final options = [
      (
        label: 'Cash on Delivery',
        sub: 'Pay in cash when your order arrives',
        icon: Icons.money_rounded,
        color: const Color(0xFF16A34A),
        available: true,
      ),
      (
        label: 'UPI on Delivery',
        sub: 'Pay via GPay, PhonePe, Paytm at doorstep',
        icon: Icons.account_balance_wallet_outlined,
        color: const Color(0xFF6366F1),
        available: true,
      ),
      (
        label: 'Card Payment',
        sub: 'Coming soon',
        icon: Icons.credit_card_rounded,
        color: const Color(0xFF94A3B8),
        available: false,
      ),
    ];

    showModalBottomSheet<void>(
      context: ctx,
      backgroundColor: Colors.transparent,
      builder: (_) => StatefulBuilder(
        builder: (sheetCtx, setSheetState) => Container(
          padding: const EdgeInsets.fromLTRB(20, 14, 20, 28),
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: const Color(0xFFE2E8F0),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              const Text(
                'Choose Payment Method',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w800,
                  color: Color(0xFF0F172A),
                ),
              ),
              const SizedBox(height: 4),
              const Text(
                'Select how you want to pay',
                style: TextStyle(fontSize: 13, color: Color(0xFF64748B)),
              ),
              const SizedBox(height: 16),
              ...options.map((opt) {
                final isSelected = localSelected == opt.label;
                return Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: GestureDetector(
                    onTap: opt.available
                        ? () {
                            setSheetState(() => localSelected = opt.label);
                            // Persist to page and close
                            setState(() => _selectedPaymentMethod = opt.label);
                            Navigator.pop(sheetCtx);
                          }
                        : null,
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 180),
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: isSelected
                            ? opt.color.withValues(alpha: 0.08)
                            : opt.available
                            ? const Color(0xFFF8FAFC)
                            : const Color(0xFFF1F5F9),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: isSelected
                              ? opt.color
                              : const Color(0xFFE2E8F0),
                          width: isSelected ? 2 : 1,
                        ),
                      ),
                      child: Row(
                        children: [
                          Container(
                            width: 40,
                            height: 40,
                            decoration: BoxDecoration(
                              color: opt.color.withValues(
                                alpha: opt.available ? 0.12 : 0.05,
                              ),
                              shape: BoxShape.circle,
                            ),
                            child: Icon(
                              opt.icon,
                              color: opt.available
                                  ? opt.color
                                  : const Color(0xFFCBD5E1),
                              size: 20,
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  opt.label,
                                  style: TextStyle(
                                    fontWeight: FontWeight.w700,
                                    fontSize: 14,
                                    color: opt.available
                                        ? const Color(0xFF0F172A)
                                        : const Color(0xFF94A3B8),
                                  ),
                                ),
                                Text(
                                  opt.sub,
                                  style: TextStyle(
                                    fontSize: 12,
                                    color: opt.available
                                        ? const Color(0xFF64748B)
                                        : const Color(0xFFCBD5E1),
                                  ),
                                ),
                              ],
                            ),
                          ),
                          if (!opt.available)
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 8,
                                vertical: 3,
                              ),
                              decoration: BoxDecoration(
                                color: const Color(0xFFE2E8F0),
                                borderRadius: BorderRadius.circular(20),
                              ),
                              child: const Text(
                                'Soon',
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w700,
                                  color: Color(0xFF94A3B8),
                                ),
                              ),
                            )
                          else
                            AnimatedContainer(
                              duration: const Duration(milliseconds: 180),
                              width: 22,
                              height: 22,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                color: isSelected
                                    ? opt.color
                                    : Colors.transparent,
                                border: Border.all(
                                  color: isSelected
                                      ? opt.color
                                      : const Color(0xFFD1D5DB),
                                  width: 2,
                                ),
                              ),
                              child: isSelected
                                  ? const Icon(
                                      Icons.check_rounded,
                                      size: 13,
                                      color: Colors.white,
                                    )
                                  : null,
                            ),
                        ],
                      ),
                    ),
                  ),
                );
              }),
            ],
          ),
        ),
      ),
    );
  }

  void _showQualitySheet(BuildContext context) {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (_) => Container(
        padding: const EdgeInsets.fromLTRB(20, 14, 20, 28),
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: const Color(0xFFE2E8F0),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: const BoxDecoration(
                    color: Color(0xFFDCFCE7),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.verified_rounded,
                    color: Color(0xFF16A34A),
                    size: 24,
                  ),
                ),
                const SizedBox(width: 12),
                const Text(
                  'Genuine Quality Assured',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w800,
                    color: Color(0xFF0F172A),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            ...[
              (
                Icons.check_circle_rounded,
                '100% Authentic Products',
                'All products are sourced directly from brands & authorised distributors.',
              ),
              (
                Icons.replay_rounded,
                'Easy Returns',
                '3-day hassle-free return policy if the product does not meet quality standards.',
              ),
              (
                Icons.local_shipping_outlined,
                'Quality Check Before Dispatch',
                'Every order is inspected before dispatch.',
              ),
              (
                Icons.support_agent_rounded,
                '24/7 Support',
                'Our team is always available to resolve quality concerns.',
              ),
            ].map(
              (t) => Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(t.$1, color: const Color(0xFF16A34A), size: 20),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            t.$2,
                            style: const TextStyle(
                              fontWeight: FontWeight.w700,
                              fontSize: 13,
                              color: Color(0xFF0F172A),
                            ),
                          ),
                          Text(
                            t.$3,
                            style: const TextStyle(
                              fontSize: 12,
                              color: Color(0xFF64748B),
                              height: 1.4,
                            ),
                          ),
                        ],
                      ),
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
    int? availableStock,
  }) {
    final singleItem = CartItem(
      productId: variantId,
      name: title,
      price: _formatWithCommas(price),
      rawPrice: price,
      imageUrl: imageUrl,
      size: size,
      color: color,
      quantity: 1,
      availableStock: availableStock,
    );
    Navigator.of(context)
        .push(
          MaterialPageRoute<void>(
            builder: (_) => CheckoutScreen(overrideItems: [singleItem]),
          ),
        )
        .then((_) {
          // mounted is false if pushAndRemoveUntil fired (order placed)
          // mounted is true if user pressed back without ordering → save to cart
          if (mounted) {
            final added = CartManager.instance.addItem(singleItem);
            if (added) {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text('Item saved to your cart 🛍️'),
                  duration: Duration(seconds: 2),
                ),
              );
            }
          }
        });
  }

  // ── Size Picker Sheet ────────────────────────────────────────────────
  void _showSizePickerSheet({
    required String title,
    required List<String> sizeOptions,
    required List<Map<String, dynamic>> variantMaps,
    required String? effectiveColor,
    required String? selectedImage,
    required bool forBuyNow,
  }) {
    String? pickedSize;
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => StatefulBuilder(
        builder: (ctx, setSheet) => Container(
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          ),
          padding: EdgeInsets.fromLTRB(
            20,
            16,
            20,
            20 + MediaQuery.of(ctx).viewInsets.bottom,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  margin: const EdgeInsets.only(bottom: 16),
                  decoration: BoxDecoration(
                    color: const Color(0xFFE2E8F0),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              // Product preview row
              Row(
                children: [
                  if (selectedImage != null)
                    ClipRRect(
                      borderRadius: BorderRadius.circular(12),
                      child: Image.network(
                        selectedImage,
                        width: 72,
                        height: 72,
                        fit: BoxFit.cover,
                        errorBuilder: (_, _, _) => Container(
                          width: 72,
                          height: 72,
                          color: const Color(0xFFF1F5F9),
                          child: const Icon(
                            Icons.checkroom_outlined,
                            color: Color(0xFFCBD5E1),
                          ),
                        ),
                      ),
                    ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          title,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                            color: Color(0xFF0F172A),
                          ),
                        ),
                        if (effectiveColor != null) ...[
                          const SizedBox(height: 3),
                          Text(
                            'Color: $effectiveColor',
                            style: const TextStyle(
                              fontSize: 12,
                              color: Color(0xFF94A3B8),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 20),
              const Text(
                'Select Size',
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w800,
                  color: Color(0xFF0F172A),
                ),
              ),
              const SizedBox(height: 12),
              Wrap(
                spacing: 10,
                runSpacing: 10,
                children: sizeOptions.map((size) {
                  final sel = size == pickedSize;
                  return GestureDetector(
                    onTap: () => setSheet(() => pickedSize = size),
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 150),
                      padding: const EdgeInsets.symmetric(
                        horizontal: 20,
                        vertical: 10,
                      ),
                      decoration: BoxDecoration(
                        color: sel ? const Color(0xFF16A34A) : Colors.white,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(
                          color: sel
                              ? const Color(0xFF16A34A)
                              : const Color(0xFFE5E7EB),
                          width: 1.5,
                        ),
                      ),
                      child: Text(
                        size,
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: sel ? Colors.white : const Color(0xFF374151),
                        ),
                      ),
                    ),
                  );
                }).toList(),
              ),
              const SizedBox(height: 24),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: pickedSize == null
                      ? null
                      : () {
                          // Find variant matching color + picked size
                          Map<String, dynamic>? v;
                          for (final vm in variantMaps) {
                            final colorMatch =
                                effectiveColor == null ||
                                (vm['color'] ?? '').toString().trim() ==
                                    effectiveColor;
                            final sizeMatch =
                                (vm['size'] ?? '').toString().trim() ==
                                pickedSize;
                            if (colorMatch && sizeMatch) {
                              v = vm;
                              break;
                            }
                          }
                          if (v == null) return;
                          setState(() => _selectedSize = pickedSize);
                          Navigator.pop(ctx);
                          final vPrice = _formatPrice(
                            v['discount_price'] ?? v['price'],
                          );
                          final vId = v['id']?.toString() ?? '';
                          final stock =
                              int.tryParse(
                                (v['available_stock'] ?? 0).toString(),
                              ) ??
                              0;
                          if (forBuyNow) {
                            _openCheckout(
                              title: title,
                              price: vPrice,
                              variantId: vId,
                              imageUrl: selectedImage,
                              size: pickedSize,
                              color: effectiveColor,
                              availableStock: stock,
                            );
                          } else {
                            _openTryBuy(
                              title: title,
                              price: vPrice,
                              variantId: vId,
                              imageUrl: selectedImage,
                              size: pickedSize,
                              color: effectiveColor,
                            );
                          }
                        },
                  style: FilledButton.styleFrom(
                    backgroundColor: const Color(0xFF16A34A),
                    disabledBackgroundColor: const Color(
                      0xFF16A34A,
                    ).withValues(alpha: 0.35),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  child: Text(
                    forBuyNow
                        ? 'Continue to Checkout'
                        : 'Continue to Try & Buy',
                    style: const TextStyle(
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
            onPressed: () {
              final d = _loadedData;
              if (d == null) return;
              final product = (d['product'] as Map<String, dynamic>?) ?? {};
              final images = d['images'] as List? ?? [];
              final firstImg = images.isNotEmpty && images.first is Map
                  ? (images.first as Map)['url']?.toString()
                  : null;
              _shareProduct(
                widget.productId,
                product['name']?.toString() ?? widget.initialName ?? 'Product',
                firstImg,
              );
            },
            icon: const Icon(Icons.share_outlined, color: Color(0xFF111827)),
            tooltip: 'Share',
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
        bottom: const PreferredSize(
          preferredSize: Size.fromHeight(52),
          child: AnimatedSearchBar(),
        ),
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
            return const Center(child: BfSpinner());
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

          final variantMaps = variants
              .whereType<Map>()
              .map((e) => Map<String, dynamic>.from(e))
              .toList();

          final colorLabelByKey = <String, String>{};
          for (final v in variantMaps) {
            final rawColor = (v['color'] ?? '').toString().trim();
            final key = _normalizeColorValue(rawColor);
            if (key.isEmpty || colorLabelByKey.containsKey(key)) continue;
            colorLabelByKey[key] = rawColor;
          }
          final colorOptions = colorLabelByKey.values.toList();

          final selectedColorKey = _normalizeColorValue(_selectedColor);
          final effectiveColorKey =
              colorLabelByKey.containsKey(selectedColorKey)
              ? selectedColorKey
              : (colorLabelByKey.isNotEmpty
                    ? colorLabelByKey.keys.first
                    : null);

          final effectiveColor = effectiveColorKey != null
              ? colorLabelByKey[effectiveColorKey]
              : null;

          // ── Images filtered to selected colour ────────────────────────────
          // Priority:
          //   1. Images explicitly tagged to the selected colour’s variants
          //   2. General images whose URL hints at the colour name
          //   3. All general images (capped at 8 to avoid carousel overload)
          //   4. Entire image list (last resort)
          final colorVariantIds = variantMaps
              .where(
                (v) => effectiveColor == null
                    ? true
                    : _normalizeColorValue(v['color']) == effectiveColorKey,
              )
              .map(_variantIdOf)
              .whereType<String>()
              .toSet();

          // Variant ID for the exact colour+size selection
          final String? exactVariantId = () {
            if (effectiveColor == null || _selectedSize == null) return null;
            for (final v in variantMaps) {
              if (_normalizeColorValue(v['color']) == effectiveColorKey &&
                  (v['size'] ?? '').toString().trim() == _selectedSize) {
                return _variantIdOf(v);
              }
            }
            return null;
          }();

          // 1. Exact colour+size match
          final exactImages = exactVariantId != null
              ? _collectVariantImageUrls(images, variantId: exactVariantId)
              : <String>[];

          // 2. Any variant of the selected colour
          final colorSpecificImages = <String>[];
          final colorSpecificPrimaryImages = <String>[];
          for (final img in images) {
            if (img is! Map) continue;
            final vid = _imageVariantId(img);
            if (vid == null || !colorVariantIds.contains(vid)) continue;
            final url = _normalizeImageUrl(img['url']);
            if (url == null) continue;
            if (_isPrimaryImage(img)) {
              colorSpecificPrimaryImages.add(url);
            } else {
              colorSpecificImages.add(url);
            }
          }
          final orderedColorSpecificImages = [
            ...colorSpecificPrimaryImages,
            ...colorSpecificImages,
          ];

          // 3-4. General (untagged) images with optional URL colour hint
          final allGeneralImages = <String>[];
          final allGeneralPrimaryImages = <String>[];
          for (final img in images) {
            if (img is! Map || _imageVariantId(img) != null) continue;
            final url = _normalizeImageUrl(img['url']);
            if (url == null) continue;
            if (_isPrimaryImage(img)) {
              allGeneralPrimaryImages.add(url);
            } else {
              allGeneralImages.add(url);
            }
          }
          final orderedAllGeneralImages = [
            ...allGeneralPrimaryImages,
            ...allGeneralImages,
          ];

          // ── Build color → first image map from variant.image_url ───────────────
          // This covers products where images are NOT tagged with variant_id.
          // The backend now returns a per-variant image_url via subquery.
          final Map<String, String> variantColorImages = {};
          for (final v in variantMaps) {
            final color = (v['color'] ?? '').toString().trim();
            final colorKey = _normalizeColorValue(color);
            if (color.isEmpty ||
                colorKey.isEmpty ||
                variantColorImages.containsKey(colorKey)) {
              continue;
            }
            final idsForColor = variantMaps
                .where((x) => _normalizeColorValue(x['color']) == colorKey)
                .map(_variantIdOf)
                .whereType<String>()
                .toSet();
            final fallbacksForColor = variantMaps
                .where((x) => _normalizeColorValue(x['color']) == colorKey)
                .map(_variantImageFallback)
                .whereType<String>()
                .toList();
            final url = _bestImageForVariantIds(
              images,
              variantIds: idsForColor,
              fallbackImageUrls: fallbacksForColor,
            );
            if (url != null) {
              variantColorImages[colorKey] = url;
            }
          }

          final colorChipImage = effectiveColor != null
              ? variantColorImages[effectiveColorKey]
              : null;

          final colorHint = (effectiveColor ?? '').toLowerCase();
          final hintImages = colorHint.isNotEmpty
              ? allGeneralImages
                    .where((u) => u.toLowerCase().contains(colorHint))
                    .toList()
              : <String>[];

          final imageUrls = exactImages.isNotEmpty
              ? exactImages
              : orderedColorSpecificImages.isNotEmpty
              ? orderedColorSpecificImages
              : colorChipImage != null
              ? [
                  colorChipImage,
                  ...orderedAllGeneralImages
                      .where((u) => u != colorChipImage)
                      .take(7),
                ]
              : hintImages.isNotEmpty
              ? hintImages
              : orderedAllGeneralImages.isNotEmpty
              ? orderedAllGeneralImages.take(8).toList()
              : images
                    .map(
                      (img) => img is Map
                          ? _normalizeImageUrl(img['url'])
                          : _normalizeImageUrl(img),
                    )
                    .whereType<String>()
                    .take(8)
                    .toList();

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
                : _normalizeColorValue(v['color']) == effectiveColorKey;
            final matchesSize = effectiveSize == null
                ? true
                : (v['size'] ?? '').toString().trim() == effectiveSize;
            if (matchesColor && matchesSize) {
              selectedVariant = v;
              break;
            }
          }
          if (selectedVariant == null) {
            for (final v in variantMaps) {
              final matchesColor = effectiveColor == null
                  ? true
                  : _normalizeColorValue(v['color']) == effectiveColorKey;
              final inStock =
                  int.tryParse((v['available_stock'] ?? 0).toString()) !=
                      null &&
                  (int.tryParse((v['available_stock'] ?? 0).toString()) ?? 0) >
                      0;
              if (matchesColor && inStock) {
                selectedVariant = v;
                break;
              }
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
          final isTryEnabled = product['is_try_enabled'] != false;
          String readMapValue(Map<String, dynamic> src, List<String> keys) {
            for (final k in keys) {
              final v = src[k]?.toString().trim() ?? '';
              if (v.isNotEmpty) return v;
            }
            return '';
          }

          String extractFromDescription(String text, List<String> labels) {
            if (text.trim().isEmpty) return '';
            for (final label in labels) {
              final regex = RegExp(
                '(^|\\n|\\r)\\s*${RegExp.escape(label)}\\s*[:\\-]\\s*([^\\n\\r]+)',
                caseSensitive: false,
                multiLine: true,
              );
              final match = regex.firstMatch(text);
              if (match != null) {
                final value = (match.group(2) ?? '').trim();
                if (value.isNotEmpty) return value;
              }
            }
            return '';
          }

          String resolveHighlight(
            List<String> fieldKeys,
            List<String> descriptionLabels,
          ) {
            final fromProduct = readMapValue(product, fieldKeys);
            if (fromProduct.isNotEmpty) return fromProduct;
            final fromVariant = readMapValue(
              selectedVariant ?? const <String, dynamic>{},
              fieldKeys,
            );
            if (fromVariant.isNotEmpty) return fromVariant;
            return extractFromDescription(description, descriptionLabels);
          }

          final pattern = resolveHighlight(['pattern'], ['Pattern']);
          final type = resolveHighlight(
            ['type', 'product_type', 'garment_type'],
            ['Type', 'Product Type'],
          );
          final sleeveLength = resolveHighlight(
            ['sleeve_length', 'sleeveLength', 'sleeve'],
            ['Sleeve Length', 'Sleeve'],
          );
          final occasion = resolveHighlight(['occasion'], ['Occasion']);
          final fabric = resolveHighlight(
            ['fabric', 'material'],
            ['Fabric', 'Material'],
          );

          final overlayHighlights = <Map<String, String>>[
            if (pattern.isNotEmpty) {'label': 'Pattern', 'value': pattern},
            if (type.isNotEmpty) {'label': 'Type', 'value': type},
            if (sleeveLength.isNotEmpty)
              {'label': 'Sleeve Length', 'value': sleeveLength},
            if (occasion.isNotEmpty) {'label': 'Occasion', 'value': occasion},
            if (fabric.isNotEmpty) {'label': 'Fabric', 'value': fabric},
          ];
          final fallbackHighlights = <Map<String, String>>[
            if (effectiveColor != null && effectiveColor.trim().isNotEmpty)
              {'label': 'Color', 'value': effectiveColor},
            if (effectiveSize != null && effectiveSize.trim().isNotEmpty)
              {'label': 'Size', 'value': effectiveSize},
            if (offPercent != null)
              {'label': 'Discount', 'value': '$offPercent% OFF'},
            {
              'label': 'Availability',
              'value': stock > 0
                  ? '$stock unit${stock > 1 ? 's' : ''} available'
                  : 'Out of stock',
            },
            {
              'label': 'Try & Buy',
              'value': isTryEnabled ? 'Available' : 'Not available',
            },
          ];
          final displayHighlights =
              (overlayHighlights.isNotEmpty
                      ? overlayHighlights
                      : fallbackHighlights)
                  .take(5)
                  .toList();

          final displayImages = imageUrls.isNotEmpty
              ? imageUrls
              : <String?>[null];
          final carouselSlides = <Map<String, dynamic>>[];
          if (displayImages.isNotEmpty) {
            final firstImage = displayImages.first;
            carouselSlides.add({
              'image': firstImage,
              'overlay': false,
              'viewerIndex': 0,
            });
            if (firstImage != null) {
              carouselSlides.add({
                'image': firstImage,
                'overlay': true,
                'viewerIndex': 0,
              });
            }
            for (var i = 1; i < displayImages.length; i++) {
              carouselSlides.add({
                'image': displayImages[i],
                'overlay': false,
                'viewerIndex': i,
              });
            }
          }
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
                            key: ValueKey(effectiveColor ?? '_none_'),
                            controller: _imageController,
                            itemCount: carouselSlides.length,
                            onPageChanged: (index) {
                              setState(() => _activeImageIndex = index);
                            },
                            itemBuilder: (context, index) {
                              final slide = carouselSlides[index];
                              final image = slide['image'] as String?;
                              final showOverlay = slide['overlay'] == true;
                              final viewerIndex =
                                  (slide['viewerIndex'] as int?) ?? 0;
                              if (image == null) {
                                return const Icon(
                                  Icons.image_not_supported_outlined,
                                  size: 36,
                                  color: Color(0xFF9CA3AF),
                                );
                              }
                              return GestureDetector(
                                onTap: () =>
                                    _openImageViewer(imageUrls, viewerIndex),
                                child: Stack(
                                  fit: StackFit.expand,
                                  children: [
                                    Image.network(
                                      image,
                                      fit: BoxFit.cover,
                                      errorBuilder:
                                          (context, error, stackTrace) {
                                            return const Icon(
                                              Icons.broken_image_outlined,
                                              size: 36,
                                              color: Color(0xFF9CA3AF),
                                            );
                                          },
                                    ),
                                    if (showOverlay)
                                      Positioned.fill(
                                        child: Align(
                                          alignment: Alignment.centerLeft,
                                          child: Container(
                                            width:
                                                MediaQuery.of(
                                                  context,
                                                ).size.width *
                                                0.62,
                                            height: double.infinity,
                                            padding: const EdgeInsets.fromLTRB(
                                              16,
                                              22,
                                              12,
                                              18,
                                            ),
                                            decoration: const BoxDecoration(
                                              gradient: LinearGradient(
                                                begin: Alignment.centerLeft,
                                                end: Alignment.centerRight,
                                                colors: [
                                                  Color(0xC2000000),
                                                  Color(0x90000000),
                                                  Color(0x00000000),
                                                ],
                                                stops: [0.0, 0.7, 1.0],
                                              ),
                                            ),
                                            child: Column(
                                              crossAxisAlignment:
                                                  CrossAxisAlignment.start,
                                              children: [
                                                const Text(
                                                  'Key Highlights',
                                                  style: TextStyle(
                                                    color: Colors.white,
                                                    fontSize: 22,
                                                    fontWeight: FontWeight.w800,
                                                  ),
                                                ),
                                                const SizedBox(height: 14),
                                                ...displayHighlights.map(
                                                  (item) => Padding(
                                                    padding:
                                                        const EdgeInsets.only(
                                                          bottom: 12,
                                                        ),
                                                    child: Column(
                                                      crossAxisAlignment:
                                                          CrossAxisAlignment
                                                              .start,
                                                      children: [
                                                        Text(
                                                          item['label'] ?? '',
                                                          style:
                                                              const TextStyle(
                                                                color: Color(
                                                                  0xFFD1D5DB,
                                                                ),
                                                                fontSize: 15,
                                                                fontWeight:
                                                                    FontWeight
                                                                        .w500,
                                                              ),
                                                        ),
                                                        const SizedBox(
                                                          height: 4,
                                                        ),
                                                        Text(
                                                          item['value'] ?? '',
                                                          style:
                                                              const TextStyle(
                                                                color: Colors
                                                                    .white,
                                                                fontSize: 17,
                                                                fontWeight:
                                                                    FontWeight
                                                                        .w800,
                                                                height: 1.22,
                                                              ),
                                                        ),
                                                        const SizedBox(
                                                          height: 8,
                                                        ),
                                                        Container(
                                                          height: 1,
                                                          color: const Color(
                                                            0x66FFFFFF,
                                                          ),
                                                        ),
                                                      ],
                                                    ),
                                                  ),
                                                ),
                                              ],
                                            ),
                                          ),
                                        ),
                                      ),
                                  ],
                                ),
                              );
                            },
                          ),
                        ),
                        Positioned(
                          left: 12,
                          top: 18,
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const _TopTag(
                                text: '60 MIN DELIVERY',
                                dark: true,
                                icon: Icons.bolt,
                              ),
                              if (isTryEnabled) ...[
                                const SizedBox(height: 8),
                                const _TopTag(
                                  text: 'Try & Buy',
                                  dark: false,
                                  icon: Icons.inventory_2_outlined,
                                ),
                              ],
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
                        // Share button on image
                        Positioned(
                          right: 12,
                          top: 72,
                          child: CircleAvatar(
                            radius: 22,
                            backgroundColor: Colors.white,
                            child: IconButton(
                              onPressed: () => _shareProduct(
                                widget.productId,
                                title,
                                selectedImage,
                              ),
                              icon: const Icon(
                                Icons.share_outlined,
                                color: Color(0xFF374151),
                                size: 20,
                              ),
                              tooltip: 'Share',
                            ),
                          ),
                        ),
                        if (carouselSlides.length > 1) ...[
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
                                    carouselSlides.length - 1) {
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
                              '${_activeImageIndex + 1}/${carouselSlides.length}',
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
                if (carouselSlides.length > 1)
                  Center(
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: List.generate(carouselSlides.length, (index) {
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
                const SizedBox(height: 14),
                // ── Category + rating row ────────────────────────────────
                Row(
                  children: [
                    if (category.trim().isNotEmpty)
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: 4,
                        ),
                        decoration: BoxDecoration(
                          color: const Color(0xFFDCFCE7),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Text(
                          category.toUpperCase(),
                          style: const TextStyle(
                            color: Color(0xFF166534),
                            fontSize: 11,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 0.5,
                          ),
                        ),
                      ),
                    const Spacer(),
                    if (_reviewCount > 0)
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: 4,
                        ),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFFF9C4),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(
                              Icons.star_rounded,
                              color: Color(0xFFD97706),
                              size: 14,
                            ),
                            const SizedBox(width: 4),
                            Text(
                              '${_avgRating.toStringAsFixed(1)}  ($_reviewCount)',
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
                ),
                const SizedBox(height: 10),
                // ── Brand ────────────────────────────────────────────────
                if (brand.trim().isNotEmpty)
                  Text(
                    brand.toUpperCase(),
                    style: const TextStyle(
                      fontSize: 11,
                      color: Color(0xFF94A3B8),
                      fontWeight: FontWeight.w700,
                      letterSpacing: 1,
                    ),
                  ),
                const SizedBox(height: 6),
                // ── Title ────────────────────────────────────────────────
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w800,
                    color: Color(0xFF0F172A),
                    height: 1.25,
                  ),
                ),
                const SizedBox(height: 14),
                // ── Price row ────────────────────────────────────────────
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [Color(0xFFF0FDF4), Color(0xFFF8FAFC)],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: const Color(0xFFDCFCE7)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.center,
                        children: [
                          Text(
                            '₹${_formatWithCommas(currentPrice)}',
                            style: const TextStyle(
                              fontSize: 28,
                              fontWeight: FontWeight.w900,
                              color: Color(0xFF0F172A),
                            ),
                          ),
                          if (originalPrice != currentPrice) ...[
                            const SizedBox(width: 12),
                            Text(
                              '₹${_formatWithCommas(originalPrice)}',
                              style: const TextStyle(
                                fontSize: 16,
                                color: Color(0xFF94A3B8),
                                decoration: TextDecoration.lineThrough,
                              ),
                            ),
                          ],
                          if (offPercent != null) ...[
                            const SizedBox(width: 8),
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
                                '$offPercent% OFF',
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontWeight: FontWeight.w800,
                                  fontSize: 12,
                                ),
                              ),
                            ),
                          ],
                        ],
                      ),
                      const SizedBox(height: 4),
                      Row(
                        children: [
                          const Text(
                            'Inclusive of all taxes',
                            style: TextStyle(
                              color: Color(0xFF64748B),
                              fontSize: 12,
                            ),
                          ),
                          if (offPercent != null &&
                              originalPrice != currentPrice) ...[
                            const SizedBox(width: 8),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 8,
                                vertical: 2,
                              ),
                              decoration: BoxDecoration(
                                color: const Color(0xFFDCFCE7),
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: Text(
                                'You save ₹${_formatWithCommas((int.tryParse(originalPrice) ?? 0) - (int.tryParse(currentPrice) ?? 0) > 0 ? ((int.tryParse(originalPrice) ?? 0) - (int.tryParse(currentPrice) ?? 0)).toString() : '0')}',
                                style: const TextStyle(
                                  color: Color(0xFF16A34A),
                                  fontWeight: FontWeight.w700,
                                  fontSize: 11,
                                ),
                              ),
                            ),
                          ],
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                // ── Delivery strip ───────────────────────────────────────
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 14,
                    vertical: 12,
                  ),
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: stock > 0
                          ? [const Color(0xFF052E16), const Color(0xFF166534)]
                          : [const Color(0xFF7C2D12), const Color(0xFFEA580C)],
                      begin: Alignment.centerLeft,
                      end: Alignment.centerRight,
                    ),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Row(
                    children: [
                      Container(
                        width: 36,
                        height: 36,
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.15),
                          shape: BoxShape.circle,
                        ),
                        child: Icon(
                          stock > 0
                              ? Icons.electric_bolt_rounded
                              : Icons.location_off_rounded,
                          color: Colors.white,
                          size: 20,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: stock > 0
                            ? const Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    '60-Minute Express Delivery',
                                    style: TextStyle(
                                      color: Colors.white,
                                      fontWeight: FontWeight.w800,
                                      fontSize: 13,
                                    ),
                                  ),
                                  Text(
                                    'Delivering to your current location',
                                    style: TextStyle(
                                      color: Color(0xFFBBF7D0),
                                      fontSize: 11,
                                    ),
                                  ),
                                ],
                              )
                            : const Text(
                                'Currently unavailable in your area',
                                style: TextStyle(
                                  fontWeight: FontWeight.w700,
                                  color: Colors.white,
                                ),
                              ),
                      ),
                      if (stock > 0)
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 10,
                            vertical: 5,
                          ),
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.2),
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: const Text(
                            'In Stock',
                            style: TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.w700,
                              fontSize: 11,
                            ),
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

                      // Get the best image for this color variant
                      final matchingVariants = variantMaps
                          .where(
                            (v) =>
                                _normalizeColorValue(v['color']) ==
                                _normalizeColorValue(colorName),
                          )
                          .toList();

                      final imageUrl = matchingVariants.isNotEmpty
                          ? _bestImageForVariantIds(
                              images,
                              variantIds: matchingVariants
                                  .map(_variantIdOf)
                                  .whereType<String>()
                                  .toSet(),
                              fallbackImageUrls: matchingVariants
                                  .map(_variantImageFallback)
                                  .whereType<String>()
                                  .toList(),
                            )
                          : null;

                      return GestureDetector(
                        onTap: () {
                          setState(() {
                            _selectedColor = colorName;
                            _selectedSize = null;
                            _activeImageIndex = 0;
                          });
                        },
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 180),
                          width: 64,
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(
                              color: active
                                  ? const Color(0xFF16A34A)
                                  : const Color(0xFFE5E7EB),
                              width: active ? 3 : 1,
                            ),
                          ),
                          child: ClipRRect(
                            borderRadius: BorderRadius.circular(10),
                            child: imageUrl != null
                                ? Image.network(
                                    imageUrl,
                                    fit: BoxFit.cover,
                                    errorBuilder: (_, _, _) => Container(
                                      color: const Color(0xFFF1F5F9),
                                      child: const Icon(
                                        Icons.checkroom_outlined,
                                        color: Color(0xFF94A3B8),
                                        size: 28,
                                      ),
                                    ),
                                  )
                                : Container(
                                    color: const Color(0xFFF1F5F9),
                                    child: const Icon(
                                      Icons.checkroom_outlined,
                                      color: Color(0xFF94A3B8),
                                      size: 28,
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
                    final sizeInStock = variantMaps.any((v) {
                      final sameColor = effectiveColor == null
                          ? true
                          : (v['color'] ?? '').toString().trim() ==
                                effectiveColor;
                      final sameSize =
                          (v['size'] ?? '').toString().trim() == size;
                      final available =
                          int.tryParse(
                            (v['available_stock'] ?? 0).toString(),
                          ) ??
                          0;
                      return sameColor && sameSize && available > 0;
                    });
                    return GestureDetector(
                      onTap: sizeInStock
                          ? () => setState(() => _selectedSize = size)
                          : null,
                      child: Container(
                        width: 68,
                        height: 50,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color: !sizeInStock
                              ? const Color(0xFFF3F4F6)
                              : active
                              ? const Color(0xFFECFDF3)
                              : Colors.white,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: !sizeInStock
                                ? const Color(0xFFD1D5DB)
                                : active
                                ? const Color(0xFF22C55E)
                                : const Color(0xFFE5E7EB),
                            width: active ? 1.5 : 1,
                          ),
                        ),
                        child: Stack(
                          alignment: Alignment.center,
                          children: [
                            Text(
                              size,
                              style: TextStyle(
                                fontWeight: FontWeight.w700,
                                color: !sizeInStock
                                    ? const Color(0xFF9CA3AF)
                                    : active
                                    ? const Color(0xFF166534)
                                    : const Color(0xFF111827),
                              ),
                            ),
                            if (!sizeInStock)
                              const Positioned(
                                child: Icon(
                                  Icons.close,
                                  size: 18,
                                  color: Color(0xFFE11D48),
                                ),
                              ),
                          ],
                        ),
                      ),
                    );
                  }).toList(),
                ),
                const SizedBox(height: 4),
                if (sizeOptions.isNotEmpty)
                  const Text(
                    'Sizes with a cross are unavailable right now',
                    style: TextStyle(fontSize: 12, color: Color(0xFF6B7280)),
                  ),
                const SizedBox(height: 16),
                // ── Feature badges ───────────────────────────────────────
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 14,
                  ),
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [Color(0xFF0F172A), Color(0xFF1E3A2F)],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: const Row(
                    children: [
                      Expanded(
                        child: _FeatureBlock(
                          icon: Icons.bolt,
                          title: '60 MIN',
                          subtitle: 'Express',
                          dark: true,
                        ),
                      ),
                      Expanded(
                        child: _FeatureBlock(
                          icon: Icons.inventory_2_outlined,
                          title: 'TRY & BUY',
                          subtitle: '15 mins',
                          dark: true,
                        ),
                      ),
                      Expanded(
                        child: _FeatureBlock(
                          icon: Icons.verified_user_outlined,
                          title: 'ORIGINAL',
                          subtitle: 'Genuine',
                          dark: true,
                        ),
                      ),
                      Expanded(
                        child: _FeatureBlock(
                          icon: Icons.lock_outline,
                          title: 'SECURE',
                          subtitle: 'Safe pay',
                          dark: true,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 14),
                // ── Product Description ──────────────────────────────────
                Container(
                  width: double.infinity,
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: const Color(0xFFE5E7EB)),
                    boxShadow: [
                      BoxShadow(
                        color: const Color(0xFF16A34A).withValues(alpha: 0.06),
                        blurRadius: 12,
                        offset: const Offset(0, 4),
                      ),
                    ],
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
                        decoration: const BoxDecoration(
                          gradient: LinearGradient(
                            colors: [Color(0xFF052E16), Color(0xFF166534)],
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                          ),
                          borderRadius: BorderRadius.vertical(
                            top: Radius.circular(16),
                          ),
                        ),
                        child: const Row(
                          children: [
                            Icon(
                              Icons.auto_awesome,
                              color: Color(0xFF4ADE80),
                              size: 18,
                            ),
                            SizedBox(width: 8),
                            Text(
                              'Product Description',
                              style: TextStyle(
                                fontSize: 15,
                                fontWeight: FontWeight.w800,
                                color: Colors.white,
                              ),
                            ),
                          ],
                        ),
                      ),
                      Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            // Collapsed: plain text clipped to 4 lines
                            // Expanded: full formatted bullets/paragraphs
                            if (!_descExpanded)
                              Text(
                                description.trim().isNotEmpty
                                    ? description
                                    : 'Premium quality fashion product with a modern silhouette and clean finish. '
                                          'Comfortable all-day wear. Crafted with premium materials. '
                                          'Perfect for casual and semi-formal occasions.',
                                maxLines: 4,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                  fontSize: 14,
                                  color: Color(0xFF374151),
                                  height: 1.55,
                                ),
                              )
                            else
                              _buildDescription(
                                description.trim().isNotEmpty
                                    ? description
                                    : 'Premium quality fashion product with a modern silhouette and clean finish.\n'
                                          '• Comfortable all-day wear\n'
                                          '• Crafted with premium materials\n'
                                          '• Perfect for casual and semi-formal occasions',
                              ),
                            const SizedBox(height: 8),
                            GestureDetector(
                              onTap: () => setState(
                                () => _descExpanded = !_descExpanded,
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Text(
                                    _descExpanded ? 'Show less' : 'Read more',
                                    style: const TextStyle(
                                      color: Color(0xFF16A34A),
                                      fontWeight: FontWeight.w700,
                                      fontSize: 13,
                                    ),
                                  ),
                                  const SizedBox(width: 4),
                                  Icon(
                                    _descExpanded
                                        ? Icons.keyboard_arrow_up
                                        : Icons.keyboard_arrow_down,
                                    color: const Color(0xFF16A34A),
                                    size: 18,
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                // ── Product Details chips ────────────────────────────────
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: const Color(0xFFE5E7EB)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Row(
                        children: [
                          Icon(
                            Icons.info_outline_rounded,
                            color: Color(0xFF16A34A),
                            size: 18,
                          ),
                          SizedBox(width: 8),
                          Text(
                            'Product Details',
                            style: TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w800,
                              color: Color(0xFF0F172A),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 14),
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: [
                          if (brand.isNotEmpty)
                            _DetailChip(label: 'Brand', value: brand),
                          if (category.isNotEmpty)
                            _DetailChip(label: 'Category', value: category),
                          if (effectiveColor != null &&
                              effectiveColor.isNotEmpty)
                            _DetailChip(label: 'Color', value: effectiveColor),
                          () {
                            final v =
                                selectedVariant ?? const <String, dynamic>{};
                            final code =
                                (v['variant_code'] ?? v['variantCode'])
                                    ?.toString()
                                    .trim() ??
                                '';
                            if (code.isEmpty) return const SizedBox.shrink();
                            return _DetailChip(label: 'Code', value: code);
                          }(),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 14),
                // Cash / UPI on Delivery
                GestureDetector(
                  onTap: () => _showPaymentInfoSheet(this.context),
                  child: Container(
                    width: double.infinity,
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: const Color(0xFFE5E7EB)),
                    ),
                    child: _ExpandableInfoRow(
                      icon: Icons.payments_outlined,
                      title: _selectedPaymentMethod,
                      subtitle: 'Tap to change payment method',
                    ),
                  ),
                ),
                const SizedBox(height: 8),
                // Genuine Quality Assured
                GestureDetector(
                  onTap: () => _showQualitySheet(this.context),
                  child: Container(
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
                ),
                const SizedBox(height: 14),
                // ── Ratings & Reviews ─────────────────────────────────────
                Container(
                  width: double.infinity,
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: const Color(0xFFE5E7EB)),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.04),
                        blurRadius: 10,
                        offset: const Offset(0, 3),
                      ),
                    ],
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Header
                      Container(
                        padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
                        decoration: const BoxDecoration(
                          color: Color(0xFFFFFBEB),
                          borderRadius: BorderRadius.vertical(
                            top: Radius.circular(16),
                          ),
                          border: Border(
                            bottom: BorderSide(color: Color(0xFFFDE68A)),
                          ),
                        ),
                        child: Row(
                          children: [
                            const Icon(
                              Icons.star_rounded,
                              color: Color(0xFFF59E0B),
                              size: 22,
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const Text(
                                    'Ratings & Reviews',
                                    style: TextStyle(
                                      fontSize: 16,
                                      fontWeight: FontWeight.w800,
                                      color: Color(0xFF0F172A),
                                    ),
                                  ),
                                  if (_reviewCount > 0)
                                    Text(
                                      '${_avgRating.toStringAsFixed(1)} ★  ·  $_reviewCount ${_reviewCount == 1 ? 'review' : 'reviews'}',
                                      style: const TextStyle(
                                        fontSize: 12,
                                        color: Color(0xFF92400E),
                                        fontWeight: FontWeight.w600,
                                      ),
                                    ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                      Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            // ── Rating summary ────────────────────────────
                            if (_reviewCount > 0) ...[
                              Row(
                                crossAxisAlignment: CrossAxisAlignment.center,
                                children: [
                                  Column(
                                    children: [
                                      Text(
                                        _avgRating.toStringAsFixed(1),
                                        style: const TextStyle(
                                          fontSize: 48,
                                          fontWeight: FontWeight.w900,
                                          color: Color(0xFF0F172A),
                                          height: 1,
                                        ),
                                      ),
                                      Row(
                                        children: List.generate(
                                          5,
                                          (i) => Icon(
                                            i < _avgRating.round()
                                                ? Icons.star_rounded
                                                : Icons.star_outline_rounded,
                                            color: const Color(0xFFF59E0B),
                                            size: 16,
                                          ),
                                        ),
                                      ),
                                      const SizedBox(height: 4),
                                      Text(
                                        '$_reviewCount ${_reviewCount == 1 ? 'review' : 'reviews'}',
                                        style: const TextStyle(
                                          fontSize: 11,
                                          color: Color(0xFF64748B),
                                        ),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(width: 20),
                                  Expanded(
                                    child: Column(
                                      children: List.generate(5, (i) {
                                        final star = 5 - i;
                                        final count = _reviews
                                            .where(
                                              (r) =>
                                                  (int.tryParse(
                                                        (r['rating'] ?? 0)
                                                            .toString(),
                                                      ) ??
                                                      0) ==
                                                  star,
                                            )
                                            .length;
                                        final pct = _reviewCount > 0
                                            ? count / _reviewCount
                                            : 0.0;
                                        return Padding(
                                          padding: const EdgeInsets.symmetric(
                                            vertical: 2,
                                          ),
                                          child: Row(
                                            children: [
                                              Text(
                                                '$star',
                                                style: const TextStyle(
                                                  fontSize: 11,
                                                  color: Color(0xFF64748B),
                                                  fontWeight: FontWeight.w600,
                                                ),
                                              ),
                                              const SizedBox(width: 4),
                                              const Icon(
                                                Icons.star_rounded,
                                                size: 11,
                                                color: Color(0xFFF59E0B),
                                              ),
                                              const SizedBox(width: 6),
                                              Expanded(
                                                child: ClipRRect(
                                                  borderRadius:
                                                      BorderRadius.circular(4),
                                                  child: LinearProgressIndicator(
                                                    value: pct,
                                                    minHeight: 7,
                                                    backgroundColor:
                                                        const Color(0xFFE5E7EB),
                                                    valueColor:
                                                        const AlwaysStoppedAnimation<
                                                          Color
                                                        >(Color(0xFFF59E0B)),
                                                  ),
                                                ),
                                              ),
                                              const SizedBox(width: 6),
                                              SizedBox(
                                                width: 20,
                                                child: Text(
                                                  '$count',
                                                  style: const TextStyle(
                                                    fontSize: 11,
                                                    color: Color(0xFF64748B),
                                                  ),
                                                ),
                                              ),
                                            ],
                                          ),
                                        );
                                      }),
                                    ),
                                  ),
                                ],
                              ),
                              const Divider(height: 24),
                            ],
                            // ── Review list ───────────────────────────────
                            if (_reviewsLoading)
                              const Center(
                                child: Padding(
                                  padding: EdgeInsets.symmetric(vertical: 12),
                                  child: BfSpinner(),
                                ),
                              )
                            else if (_reviews.isEmpty)
                              const Padding(
                                padding: EdgeInsets.symmetric(vertical: 10),
                                child: Text(
                                  'No reviews yet. Be the first to review!',
                                  style: TextStyle(
                                    color: Color(0xFF94A3B8),
                                    fontSize: 14,
                                  ),
                                ),
                              )
                            else
                              ...(_reviews
                                  .take(5)
                                  .map((r) => _buildReviewCard(r))),
                            const Divider(height: 28),
                            // ── Write a Review ────────────────────────────────
                            const Row(
                              children: [
                                Icon(
                                  Icons.rate_review_outlined,
                                  color: Color(0xFF16A34A),
                                  size: 18,
                                ),
                                SizedBox(width: 8),
                                Text(
                                  'Write a Review',
                                  style: TextStyle(
                                    fontSize: 16,
                                    fontWeight: FontWeight.w800,
                                    color: Color(0xFF0F172A),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 14),
                            // Star picker with label
                            Row(
                              children: [
                                ...List.generate(5, (i) {
                                  return GestureDetector(
                                    onTap: () => setState(
                                      () => _newReviewRating = i + 1,
                                    ),
                                    child: Padding(
                                      padding: const EdgeInsets.only(right: 4),
                                      child: Icon(
                                        i < _newReviewRating
                                            ? Icons.star_rounded
                                            : Icons.star_outline_rounded,
                                        color: i < _newReviewRating
                                            ? const Color(0xFFFBBF24)
                                            : const Color(0xFFD1D5DB),
                                        size: 36,
                                      ),
                                    ),
                                  );
                                }),
                                const SizedBox(width: 10),
                                Text(
                                  [
                                    '',
                                    'Poor',
                                    'Fair',
                                    'Good',
                                    'Very Good',
                                    'Excellent',
                                  ][_newReviewRating],
                                  style: const TextStyle(
                                    color: Color(0xFFD97706),
                                    fontWeight: FontWeight.w700,
                                    fontSize: 13,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 12),
                            TextField(
                              controller: _reviewerNameCtrl,
                              decoration: InputDecoration(
                                hintText: 'Your name (optional)',
                                filled: true,
                                fillColor: const Color(0xFFF9FAFB),
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
                                contentPadding: const EdgeInsets.symmetric(
                                  horizontal: 12,
                                  vertical: 10,
                                ),
                              ),
                            ),
                            const SizedBox(height: 10),
                            TextField(
                              controller: _reviewTextCtrl,
                              maxLines: 3,
                              decoration: InputDecoration(
                                hintText:
                                    'Share your experience with this product…',
                                filled: true,
                                fillColor: const Color(0xFFF9FAFB),
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
                                contentPadding: const EdgeInsets.symmetric(
                                  horizontal: 12,
                                  vertical: 10,
                                ),
                              ),
                            ),
                            const SizedBox(height: 12),
                            // ── Image picker ──────────────────────────────────
                            Row(
                              children: [
                                GestureDetector(
                                  onTap: () async {
                                    final picker = ImagePicker();
                                    final img = await picker.pickImage(
                                      source: ImageSource.gallery,
                                      imageQuality: 80,
                                      maxWidth: 1080,
                                    );
                                    if (img != null) {
                                      setState(() => _pickedReviewImage = img);
                                    }
                                  },
                                  child: Container(
                                    width: 64,
                                    height: 64,
                                    decoration: BoxDecoration(
                                      color: const Color(0xFFF9FAFB),
                                      borderRadius: BorderRadius.circular(10),
                                      border: Border.all(
                                        color: const Color(0xFFE5E7EB),
                                        width: 1.5,
                                      ),
                                    ),
                                    child: _pickedReviewImage == null
                                        ? const Column(
                                            mainAxisAlignment:
                                                MainAxisAlignment.center,
                                            children: [
                                              Icon(
                                                Icons
                                                    .add_photo_alternate_outlined,
                                                color: Color(0xFF9CA3AF),
                                                size: 24,
                                              ),
                                              SizedBox(height: 2),
                                              Text(
                                                'Photo',
                                                style: TextStyle(
                                                  fontSize: 10,
                                                  color: Color(0xFF9CA3AF),
                                                ),
                                              ),
                                            ],
                                          )
                                        : Stack(
                                            fit: StackFit.expand,
                                            children: [
                                              ClipRRect(
                                                borderRadius:
                                                    BorderRadius.circular(9),
                                                child: Image.network(
                                                  _pickedReviewImage!.path
                                                          .startsWith('http')
                                                      ? _pickedReviewImage!.path
                                                      : _pickedReviewImage!
                                                            .path,
                                                  fit: BoxFit.cover,
                                                  errorBuilder: (ctx, e, st) =>
                                                      Image.asset(
                                                        'assets/images/logo.png',
                                                        fit: BoxFit.cover,
                                                      ),
                                                ),
                                              ),
                                              Positioned(
                                                top: 2,
                                                right: 2,
                                                child: GestureDetector(
                                                  onTap: () => setState(
                                                    () => _pickedReviewImage =
                                                        null,
                                                  ),
                                                  child: Container(
                                                    decoration:
                                                        const BoxDecoration(
                                                          color: Colors.black54,
                                                          shape:
                                                              BoxShape.circle,
                                                        ),
                                                    padding:
                                                        const EdgeInsets.all(2),
                                                    child: const Icon(
                                                      Icons.close,
                                                      size: 12,
                                                      color: Colors.white,
                                                    ),
                                                  ),
                                                ),
                                              ),
                                            ],
                                          ),
                                  ),
                                ),
                                const SizedBox(width: 12),
                                const Expanded(
                                  child: Text(
                                    'Add a photo to your review (optional)',
                                    style: TextStyle(
                                      fontSize: 12,
                                      color: Color(0xFF6B7280),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 12),
                            SizedBox(
                              width: double.infinity,
                              child: FilledButton.icon(
                                style: FilledButton.styleFrom(
                                  backgroundColor: const Color(0xFF16A34A),
                                  padding: const EdgeInsets.symmetric(
                                    vertical: 12,
                                  ),
                                  shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(10),
                                  ),
                                ),
                                onPressed: _submittingReview
                                    ? null
                                    : () => _submitReview(
                                        data['product']?['id']?.toString() ??
                                            widget.productId,
                                      ),
                                icon: _submittingReview
                                    ? const SizedBox(
                                        width: 16,
                                        height: 16,
                                        child: BfSpinner(size: 16),
                                      )
                                    : const Icon(Icons.rate_review_outlined),
                                label: const Text(
                                  'Submit Review',
                                  style: TextStyle(fontWeight: FontWeight.w700),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 14),
                // ── Similar Products ──────────────────────────────────────
                if (_similarLoading || _similarProducts.isNotEmpty)
                  Container(
                    width: double.infinity,
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: const Color(0xFFE5E7EB)),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.04),
                          blurRadius: 10,
                          offset: const Offset(0, 3),
                        ),
                      ],
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Header
                        Container(
                          padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
                          decoration: const BoxDecoration(
                            gradient: LinearGradient(
                              colors: [Color(0xFF0F172A), Color(0xFF1E293B)],
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                            ),
                            borderRadius: BorderRadius.vertical(
                              top: Radius.circular(16),
                            ),
                          ),
                          child: const Row(
                            children: [
                              Icon(
                                Icons.auto_awesome_mosaic_rounded,
                                color: Color(0xFF4ADE80),
                                size: 18,
                              ),
                              SizedBox(width: 8),
                              Text(
                                'You May Also Like',
                                style: TextStyle(
                                  fontSize: 15,
                                  fontWeight: FontWeight.w800,
                                  color: Colors.white,
                                ),
                              ),
                            ],
                          ),
                        ),
                        Padding(
                          padding: const EdgeInsets.all(14),
                          child: _similarLoading
                              ? const Center(
                                  child: Padding(
                                    padding: EdgeInsets.symmetric(vertical: 16),
                                    child: BfSpinner(),
                                  ),
                                )
                              : SizedBox(
                                  height: 285,
                                  child: ListView.separated(
                                    scrollDirection: Axis.horizontal,
                                    clipBehavior: Clip.none,
                                    itemCount: _similarProducts.length,
                                    separatorBuilder: (context, index) =>
                                        const SizedBox(width: 12),
                                    itemBuilder: (context, index) =>
                                        _buildSimilarCard(
                                          _similarProducts[index],
                                        ),
                                  ),
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

  Widget _buildSimilarCard(Map<String, dynamic> p) {
    final id = p['id']?.toString() ?? '';
    final name = (p['name'] ?? '').toString();
    final price = _formatPrice(p['discount_price'] ?? p['price']);
    final originalPrice = _formatPrice(p['price']);
    final offPct = _discountPercent(originalPrice, price);
    final imageUrl = _resolveProductImage(p);

    return GestureDetector(
      onTap: () => Navigator.of(context).push(
        MaterialPageRoute<void>(
          builder: (_) => ProductDetailScreen(productId: id, initialName: name),
        ),
      ),
      child: Container(
        width: 155,
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: const Color(0xFFE5E7EB)),
          boxShadow: const [
            BoxShadow(
              color: Color(0x0A000000),
              blurRadius: 8,
              offset: Offset(0, 2),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Stack(
              children: [
                ClipRRect(
                  borderRadius: const BorderRadius.vertical(
                    top: Radius.circular(14),
                  ),
                  child: imageUrl != null
                      ? Image.network(
                          imageUrl,
                          height: 165,
                          width: double.infinity,
                          fit: BoxFit.cover,
                          errorBuilder: (context, error, stackTrace) =>
                              Container(
                                height: 165,
                                width: double.infinity,
                                color: const Color(0xFFF1F5F9),
                                child: const Icon(
                                  Icons.image_not_supported_outlined,
                                  color: Color(0xFF94A3B8),
                                  size: 32,
                                ),
                              ),
                        )
                      : Container(
                          height: 165,
                          width: double.infinity,
                          color: const Color(0xFFF1F5F9),
                          child: const Icon(
                            Icons.checkroom_outlined,
                            color: Color(0xFF94A3B8),
                            size: 32,
                          ),
                        ),
                ),
                if (offPct != null)
                  Positioned(
                    top: 8,
                    left: 8,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 7,
                        vertical: 3,
                      ),
                      decoration: BoxDecoration(
                        color: const Color(0xFF16A34A),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        '$offPct% OFF',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 10,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                  ),
              ],
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(10, 8, 10, 10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    name,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF0F172A),
                      height: 1.35,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      Text(
                        '₹${_formatWithCommas(price)}',
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w900,
                          color: Color(0xFF0F172A),
                        ),
                      ),
                      if (originalPrice != price) ...[
                        const SizedBox(width: 5),
                        Text(
                          '₹${_formatWithCommas(originalPrice)}',
                          style: const TextStyle(
                            fontSize: 11,
                            color: Color(0xFF94A3B8),
                            decoration: TextDecoration.lineThrough,
                          ),
                        ),
                      ],
                    ],
                  ),
                  const SizedBox(height: 8),
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton(
                      onPressed: () => Navigator.of(context).push(
                        MaterialPageRoute<void>(
                          builder: (_) => ProductDetailScreen(
                            productId: id,
                            initialName: name,
                          ),
                        ),
                      ),
                      style: OutlinedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 6),
                        side: const BorderSide(color: Color(0xFF16A34A)),
                        foregroundColor: const Color(0xFF16A34A),
                        minimumSize: Size.zero,
                        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(8),
                        ),
                      ),
                      child: const Text(
                        'View',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                        ),
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

  Widget _buildReviewCard(Map<String, dynamic> r) {
    final name = (r['reviewer_name'] ?? 'Anonymous').toString();
    final text = (r['review_text'] ?? '').toString();
    final rating = int.tryParse((r['rating'] ?? 0).toString()) ?? 0;
    final imageUrl = r['image_url']?.toString();
    final date = r['created_at'] != null
        ? DateTime.tryParse(r['created_at'].toString())
        : null;
    final now = DateTime.now();
    String dateStr = '';
    if (date != null) {
      final diff = now.difference(date);
      if (diff.inDays == 0) {
        dateStr = 'Today';
      } else if (diff.inDays == 1) {
        dateStr = 'Yesterday';
      } else if (diff.inDays < 30) {
        dateStr = '${diff.inDays} days ago';
      } else {
        dateStr = '${date.day} ${_monthName(date.month)} ${date.year}';
      }
    }

    // Avatar colour based on name hash
    final colours = [
      [const Color(0xFFDCFCE7), const Color(0xFF16A34A)],
      [const Color(0xFFE0E7FF), const Color(0xFF4F46E5)],
      [const Color(0xFFFEF3C7), const Color(0xFFD97706)],
      [const Color(0xFFFFE4E6), const Color(0xFFE11D48)],
      [const Color(0xFFE0F2FE), const Color(0xFF0284C7)],
    ];
    final avatarPair = colours[name.hashCode.abs() % colours.length];

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE5E7EB)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              CircleAvatar(
                radius: 20,
                backgroundColor: avatarPair[0],
                child: Text(
                  name.isNotEmpty ? name[0].toUpperCase() : '?',
                  style: TextStyle(
                    color: avatarPair[1],
                    fontWeight: FontWeight.w900,
                    fontSize: 16,
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      name,
                      style: const TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 14,
                        color: Color(0xFF0F172A),
                      ),
                    ),
                    Row(
                      children: [
                        ...List.generate(
                          5,
                          (i) => Icon(
                            i < rating
                                ? Icons.star_rounded
                                : Icons.star_outline_rounded,
                            color: i < rating
                                ? const Color(0xFFFBBF24)
                                : const Color(0xFFD1D5DB),
                            size: 15,
                          ),
                        ),
                        const SizedBox(width: 6),
                        Text(
                          '$rating.0',
                          style: const TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                            color: Color(0xFFD97706),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              if (dateStr.isNotEmpty)
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 3,
                  ),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF1F5F9),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    dateStr,
                    style: const TextStyle(
                      fontSize: 10,
                      color: Color(0xFF64748B),
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
            ],
          ),
          if (text.isNotEmpty) ...[
            const SizedBox(height: 10),
            Text(
              text,
              style: const TextStyle(
                fontSize: 14,
                color: Color(0xFF374151),
                height: 1.5,
              ),
            ),
          ],
          if (imageUrl != null && imageUrl.isNotEmpty) ...[
            const SizedBox(height: 10),
            ClipRRect(
              borderRadius: BorderRadius.circular(10),
              child: Image.network(
                imageUrl,
                height: 130,
                width: 130,
                fit: BoxFit.cover,
                errorBuilder: (context, error, stackTrace) =>
                    const SizedBox.shrink(),
              ),
            ),
          ],
          if (imageUrl != null && imageUrl.isNotEmpty) ...[
            const SizedBox(height: 6),
            const Row(
              children: [
                Icon(
                  Icons.verified_rounded,
                  size: 12,
                  color: Color(0xFF16A34A),
                ),
                SizedBox(width: 4),
                Text(
                  'Verified photo review',
                  style: TextStyle(
                    fontSize: 11,
                    color: Color(0xFF16A34A),
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  String _monthName(int month) {
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    return months[(month - 1).clamp(0, 11)];
  }

  Widget _buildDescription(String raw) {
    final lines = raw
        .split('\n')
        .map((l) => l.trim())
        .where((l) => l.isNotEmpty)
        .toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: lines.map((line) {
        final isBullet =
            line.startsWith('•') ||
            line.startsWith('-') ||
            line.startsWith('*');
        final text = isBullet
            ? line.replaceFirst(RegExp(r'^[•\-\*]\s*'), '')
            : line;
        if (isBullet) {
          return Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Padding(
                  padding: EdgeInsets.only(top: 5, right: 8),
                  child: CircleAvatar(
                    radius: 3.5,
                    backgroundColor: Color(0xFF16A34A),
                  ),
                ),
                Expanded(
                  child: Text(
                    text,
                    style: const TextStyle(
                      fontSize: 14,
                      color: Color(0xFF374151),
                      height: 1.5,
                    ),
                  ),
                ),
              ],
            ),
          );
        }
        return Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: Text(
            text,
            style: const TextStyle(
              fontSize: 15,
              color: Color(0xFF1F2937),
              height: 1.55,
            ),
          ),
        );
      }).toList(),
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
    final colorLabelByKey = <String, String>{};
    for (final v in variantMaps) {
      final rawColor = (v['color'] ?? '').toString().trim();
      final key = _normalizeColorValue(rawColor);
      if (key.isEmpty || colorLabelByKey.containsKey(key)) continue;
      colorLabelByKey[key] = rawColor;
    }
    final selectedColorKey = _normalizeColorValue(_selectedColor);
    final effectiveColorKey = colorLabelByKey.containsKey(selectedColorKey)
        ? selectedColorKey
        : (colorLabelByKey.isNotEmpty ? colorLabelByKey.keys.first : null);
    final effectiveColor = effectiveColorKey != null
        ? colorLabelByKey[effectiveColorKey]
        : null;
    final sizeOptions = _sortSizes(
      variantMaps
          .where(
            (v) => effectiveColor == null
                ? true
                : _normalizeColorValue(v['color']) == effectiveColorKey,
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
          : _normalizeColorValue(v['color']) == effectiveColorKey;
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
        .map(
          (img) => img is Map
              ? _normalizeImageUrl(img['url'])
              : _normalizeImageUrl(img),
        )
        .whereType<String>()
        .toList();

    // Use variant's own image_url for the selected color if available
    // (covers products where images are not tagged with variant_id)
    final Map<String, String> variantColorImages = {};
    for (final v in variantMaps) {
      final color = (v['color'] ?? '').toString().trim();
      final colorKey = _normalizeColorValue(color);
      if (color.isEmpty ||
          colorKey.isEmpty ||
          variantColorImages.containsKey(colorKey)) {
        continue;
      }
      final idsForColor = variantMaps
          .where((x) => _normalizeColorValue(x['color']) == colorKey)
          .map(_variantIdOf)
          .whereType<String>()
          .toSet();
      final fallbackImages = variantMaps
          .where((x) => _normalizeColorValue(x['color']) == colorKey)
          .map(_variantImageFallback)
          .whereType<String>()
          .toList();
      final url = _bestImageForVariantIds(
        images,
        variantIds: idsForColor,
        fallbackImageUrls: fallbackImages,
      );
      if (url != null) {
        variantColorImages[colorKey] = url;
      }
    }
    final colorFirstImage = effectiveColor != null
        ? variantColorImages[effectiveColorKey]
        : null;
    final selectedImage =
        colorFirstImage ?? (imageUrls.isNotEmpty ? imageUrls.first : null);
    final title = (product['name'] ?? '').toString();
    final currentPrice = _formatPrice(
      selectedVariant['discount_price'] ?? selectedVariant['price'],
    );
    final listingPrice = _formatPrice(selectedVariant['price']);
    final variantId = selectedVariant['id']?.toString() ?? '';
    final availableStock =
        int.tryParse((selectedVariant['available_stock'] ?? 0).toString()) ?? 0;
    final hasStock = availableStock > 0;
    final isTryEnabled = product['is_try_enabled'] != false;
    final requiresSizeSelection =
        sizeOptions.length > 1 &&
        (effectiveSize == null || effectiveSize.trim().isEmpty);

    return SafeArea(
      child: Container(
        padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
        decoration: BoxDecoration(
          color: Colors.white,
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.08),
              blurRadius: 20,
              offset: const Offset(0, -4),
            ),
          ],
        ),
        child: Row(
          children: [
            // ── Add to Cart ────────────────────────────────────────────
            Expanded(
              child: _ActionBtn(
                label: 'Add to Cart',
                icon: Icons.shopping_cart_outlined,
                enabled: hasStock,
                onTap: hasStock
                    ? () => _doAddToCart(
                        title: title,
                        rawPrice: currentPrice,
                        compareRawPrice: listingPrice,
                        variantId: variantId,
                        imageUrl: selectedImage,
                        size: effectiveSize,
                        color: effectiveColor,
                        availableStock: availableStock,
                      )
                    : null,
              ),
            ),
            const SizedBox(width: 6),
            // ── Try & Buy ──────────────────────────────────────────────
            Expanded(
              child: _ActionBtn(
                label: isTryEnabled && hasStock ? 'Try & Buy' : 'Unavailable',
                icon: Icons.checkroom_outlined,
                enabled: isTryEnabled && hasStock,
                accent: true,
                onTap: (isTryEnabled && hasStock)
                    ? () {
                        if (requiresSizeSelection) {
                          _showSizePickerSheet(
                            title: title,
                            sizeOptions: sizeOptions,
                            variantMaps: variantMaps,
                            effectiveColor: effectiveColor,
                            selectedImage: selectedImage,
                            forBuyNow: false,
                          );
                          return;
                        }
                        _openTryBuy(
                          title: title,
                          price: currentPrice,
                          variantId: variantId,
                          imageUrl: selectedImage,
                          size: effectiveSize,
                          color: effectiveColor,
                        );
                      }
                    : null,
              ),
            ),
            const SizedBox(width: 6),
            // ── Buy Now ────────────────────────────────────────────────
            Expanded(
              child: _ActionBtn(
                label: 'Buy Now',
                icon: Icons.bolt_rounded,
                enabled: hasStock,
                filled: true,
                onTap: hasStock
                    ? () {
                        if (requiresSizeSelection) {
                          _showSizePickerSheet(
                            title: title,
                            sizeOptions: sizeOptions,
                            variantMaps: variantMaps,
                            effectiveColor: effectiveColor,
                            selectedImage: selectedImage,
                            forBuyNow: true,
                          );
                          return;
                        }
                        _openCheckout(
                          title: title,
                          price: currentPrice,
                          variantId: variantId,
                          imageUrl: selectedImage,
                          size: effectiveSize,
                          color: effectiveColor,
                          availableStock: availableStock,
                        );
                      }
                    : null,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Equal action button ───────────────────────────────────────────────────────
class _ActionBtn extends StatelessWidget {
  const _ActionBtn({
    required this.label,
    required this.icon,
    required this.enabled,
    this.filled = false,
    this.accent = false,
    this.onTap,
  });

  final String label;
  final IconData icon;
  final bool enabled;
  final bool filled;
  final bool accent;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    const green = Color(0xFF16A34A);
    const darkGreen = Color(0xFF052E16);

    // ── Buy Now: full green gradient ──────────────────────────────────
    if (filled) {
      return GestureDetector(
        onTap: enabled ? onTap : null,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          height: 54,
          decoration: BoxDecoration(
            gradient: enabled
                ? const LinearGradient(
                    colors: [Color(0xFF16A34A), Color(0xFF15803D)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  )
                : const LinearGradient(
                    colors: [Color(0xFFD1FAE5), Color(0xFFBBF7D0)],
                  ),
            borderRadius: BorderRadius.circular(14),
            boxShadow: enabled
                ? [
                    BoxShadow(
                      color: green.withValues(alpha: 0.35),
                      blurRadius: 12,
                      offset: const Offset(0, 4),
                    ),
                  ]
                : [],
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                icon,
                size: 18,
                color: enabled ? Colors.white : const Color(0xFF6EE7B7),
              ),
              const SizedBox(height: 3),
              Text(
                label,
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w800,
                  color: enabled ? Colors.white : const Color(0xFF6EE7B7),
                  letterSpacing: 0.2,
                ),
              ),
            ],
          ),
        ),
      );
    }

    // ── Try & Buy: dark outlined ──────────────────────────────────────
    if (accent) {
      return GestureDetector(
        onTap: enabled ? onTap : null,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          height: 54,
          decoration: BoxDecoration(
            color: enabled ? darkGreen : const Color(0xFFF1F5F9),
            borderRadius: BorderRadius.circular(14),
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                icon,
                size: 18,
                color: enabled
                    ? const Color(0xFF4ADE80)
                    : const Color(0xFFCBD5E1),
              ),
              const SizedBox(height: 3),
              Text(
                label,
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w800,
                  color: enabled
                      ? const Color(0xFF4ADE80)
                      : const Color(0xFFCBD5E1),
                  letterSpacing: 0.2,
                ),
              ),
            ],
          ),
        ),
      );
    }

    // ── Add to Cart: light outlined ───────────────────────────────────
    return GestureDetector(
      onTap: enabled ? onTap : null,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        height: 54,
        decoration: BoxDecoration(
          color: enabled ? const Color(0xFFF0FDF4) : const Color(0xFFF8FAFC),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: enabled ? green : const Color(0xFFE2E8F0),
            width: 1.5,
          ),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              icon,
              size: 18,
              color: enabled ? green : const Color(0xFFCBD5E1),
            ),
            const SizedBox(height: 3),
            Text(
              label,
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w800,
                color: enabled ? green : const Color(0xFFCBD5E1),
                letterSpacing: 0.2,
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
    this.dark = false,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final bool dark;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Icon(
          icon,
          color: dark ? const Color(0xFF4ADE80) : const Color(0xFF22C55E),
        ),
        const SizedBox(height: 6),
        Text(
          title,
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: 10,
            fontWeight: FontWeight.w800,
            color: dark ? Colors.white : const Color(0xFF111827),
          ),
        ),
        const SizedBox(height: 4),
        Text(
          subtitle,
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: 10,
            color: dark ? const Color(0xFF86EFAC) : const Color(0xFF64748B),
          ),
        ),
      ],
    );
  }
}

class _DetailChip extends StatelessWidget {
  const _DetailChip({required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
      decoration: BoxDecoration(
        color: const Color(0xFFF1F5F9),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: RichText(
        text: TextSpan(
          children: [
            TextSpan(
              text: '$label: ',
              style: const TextStyle(
                fontSize: 12,
                color: Color(0xFF64748B),
                fontWeight: FontWeight.w600,
              ),
            ),
            TextSpan(
              text: value,
              style: const TextStyle(
                fontSize: 12,
                color: Color(0xFF0F172A),
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ),
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

class _ImagePreviewScreen extends StatefulWidget {
  const _ImagePreviewScreen({required this.images, required this.initialIndex});

  final List<String> images;
  final int initialIndex;

  @override
  State<_ImagePreviewScreen> createState() => _ImagePreviewScreenState();
}

class _ImagePreviewScreenState extends State<_ImagePreviewScreen> {
  late final PageController _pageController;
  late int _activeIndex;

  @override
  void initState() {
    super.initState();
    _activeIndex = widget.initialIndex.clamp(0, widget.images.length - 1);
    _pageController = PageController(initialPage: _activeIndex);
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        iconTheme: const IconThemeData(color: Colors.white),
        title: Text(
          '${_activeIndex + 1}/${widget.images.length}',
          style: const TextStyle(color: Colors.white),
        ),
      ),
      body: PageView.builder(
        controller: _pageController,
        itemCount: widget.images.length,
        onPageChanged: (index) => setState(() => _activeIndex = index),
        itemBuilder: (context, index) {
          return InteractiveViewer(
            minScale: 1,
            maxScale: 4,
            child: Center(
              child: Image.network(
                widget.images[index],
                fit: BoxFit.contain,
                errorBuilder: (context, error, stackTrace) {
                  return const Icon(
                    Icons.broken_image_outlined,
                    color: Colors.white70,
                    size: 48,
                  );
                },
              ),
            ),
          );
        },
      ),
    );
  }
}
