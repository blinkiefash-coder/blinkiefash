import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';

import '../api_base.dart';
import '../services/api_client.dart';
import '../services/cart_manager.dart';
import '../services/wishlist_manager.dart';
import 'cart_screen.dart';
import 'product_detail_screen.dart';
import 'wishlist_screen.dart';
import '../widgets/bf_loader.dart';

// ─── Soft background colour per category ─────────────────────────────────────
const _kCategoryThemes = <String, _CatTheme>{
  'men': _CatTheme(
    bg: Color(0xFFEFF6FF),
    accent: Color(0xFF2563EB),
    subtitle: 'Trendy styles for every occasion',
  ),
  'women': _CatTheme(
    bg: Color(0xFFFFF1F2),
    accent: Color(0xFFE11D48),
    subtitle: 'Trendy styles for every occasion',
  ),
  'kids': _CatTheme(
    bg: Color(0xFFFFFBEB),
    accent: Color(0xFFD97706),
    subtitle: 'Fun & comfy fits for little ones',
  ),
  'beauty': _CatTheme(
    bg: Color(0xFFF5F3FF),
    accent: Color(0xFF7C3AED),
    subtitle: 'Glow up with premium beauty',
  ),
  'sport': _CatTheme(
    bg: Color(0xFFECFDF5),
    accent: Color(0xFF059669),
    subtitle: 'Perform at your best',
  ),
  'home': _CatTheme(
    bg: Color(0xFFF0FDFA),
    accent: Color(0xFF0D9488),
    subtitle: 'Style for every corner',
  ),
};

const _kDefaultTheme = _CatTheme(
  bg: Color(0xFFF8FAFC),
  accent: Color(0xFF16A34A),
  subtitle: 'Explore the collection',
);

class _CatTheme {
  final Color bg;
  final Color accent;
  final String subtitle;
  const _CatTheme({
    required this.bg,
    required this.accent,
    required this.subtitle,
  });
}

_CatTheme _themeFor(String name) {
  final key = name.toLowerCase();
  for (final entry in _kCategoryThemes.entries) {
    if (key.contains(entry.key)) return entry.value;
  }
  return _kDefaultTheme;
}

// ─── Screen ──────────────────────────────────────────────────────────────────
class CategoryLandingScreen extends StatefulWidget {
  final String categoryId;
  final String categoryName;

  const CategoryLandingScreen({
    super.key,
    required this.categoryId,
    required this.categoryName,
  });

  @override
  State<CategoryLandingScreen> createState() => _CategoryLandingScreenState();
}

class _CategoryLandingScreenState extends State<CategoryLandingScreen> {
  static const Color _green = Color(0xFF16A34A);

  final ApiClient _api = ApiClient();
  final ScrollController _scrollCtrl = ScrollController();
  final TextEditingController _searchCtrl = TextEditingController();
  String _searchQuery = '';

  late final _CatTheme _theme;

  // Category hierarchy (loaded once)
  List<Map<String, dynamic>> _allCategories = [];
  List<Map<String, dynamic>> _subCats = [];

  // Selections
  String? _selectedSubId; // null = All
  String? _selectedSubSubId; // null = All within sub

  // Products
  List<Map<String, dynamic>> _products = [];
  bool _isLoading = false;
  bool _hasMore = true;
  int _offset = 0;
  static const int _pageSize = 20;

  // Filters
  String _sort = 'newest';
  double? _minPrice;
  double? _maxPrice;

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  @override
  void initState() {
    super.initState();
    _theme = _themeFor(widget.categoryName);
    _loadCategories();
    _loadProducts(reset: true);
    _scrollCtrl.addListener(() {
      if (_scrollCtrl.position.pixels >
              _scrollCtrl.position.maxScrollExtent - 300 &&
          !_isLoading &&
          _hasMore) {
        _loadProducts();
      }
    });
  }

  @override
  void dispose() {
    _scrollCtrl.dispose();
    _searchCtrl.dispose();
    super.dispose();
  }

  // ── Data loading ───────────────────────────────────────────────────────────
  Future<void> _loadCategories() async {
    final list = await _api.fetchCategories();
    if (!mounted) return;
    final maps = list.whereType<Map<String, dynamic>>().toList();
    setState(() {
      _allCategories = maps;
      _subCats = maps
          .where((c) => c['parent_id']?.toString() == widget.categoryId)
          .toList();
    });
  }

  List<Map<String, dynamic>> _subSubCats() {
    if (_selectedSubId == null) return [];
    return _allCategories
        .where((c) => c['parent_id']?.toString() == _selectedSubId)
        .toList();
  }

  String get _activeCategoryId =>
      _selectedSubSubId ?? _selectedSubId ?? widget.categoryId;

  Future<void> _loadProducts({bool reset = false}) async {
    if (_isLoading) return;
    if (reset) {
      setState(() {
        _isLoading = true;
        _products = [];
        _offset = 0;
        _hasMore = true;
      });
    } else {
      setState(() => _isLoading = true);
    }
    try {
      final data = await _api.fetchAllProducts(
        categoryId: _activeCategoryId,
        sort: _sort,
        minPrice: _minPrice,
        maxPrice: _maxPrice,
        limit: _pageSize,
        offset: reset ? 0 : _offset,
      );
      final rows = (data['products'] as List? ?? [])
          .whereType<Map<String, dynamic>>()
          .toList();
      if (!mounted) return;
      setState(() {
        _products = reset ? rows : [..._products, ...rows];
        _offset = _products.length;
        _hasMore = rows.length == _pageSize;
        _isLoading = false;
      });
    } catch (_) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  int get _activeFilterCount {
    int c = 0;
    if (_minPrice != null || _maxPrice != null) c++;
    if (_sort != 'newest') c++;
    return c;
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  String _fmt(dynamic v) {
    if (v == null) return '0';
    if (v is int) return v.toString();
    if (v is double) return v.round().toString();
    return (double.tryParse(v.toString()) ?? 0).round().toString();
  }

  String? _imgUrl(dynamic v) {
    final raw = (v ?? '').toString().trim();
    if (raw.isEmpty) return null;
    if (raw.startsWith('http')) return raw;
    if (raw.startsWith('/')) return '$apiBaseUrl$raw';
    return '$apiBaseUrl/$raw';
  }

  // ── Filter sheet ───────────────────────────────────────────────────────────
  void _openFilterSheet() {
    String tempSort = _sort;
    final minCtrl = TextEditingController(
      text: _minPrice?.toStringAsFixed(0) ?? '',
    );
    final maxCtrl = TextEditingController(
      text: _maxPrice?.toStringAsFixed(0) ?? '',
    );

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheetState) => Padding(
          padding: EdgeInsets.only(
            bottom: MediaQuery.of(ctx).viewInsets.bottom,
          ),
          child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(20, 20, 20, 28),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      'Filters',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w800,
                        color: Color(0xFF0F172A),
                      ),
                    ),
                    TextButton(
                      onPressed: () {
                        setSheetState(() => tempSort = 'newest');
                        minCtrl.clear();
                        maxCtrl.clear();
                      },
                      child: const Text(
                        'Clear all',
                        style: TextStyle(color: _green),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                const Text(
                  'SORT BY',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w800,
                    color: Color(0xFF94A3B8),
                    letterSpacing: 0.8,
                  ),
                ),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children:
                      {
                        'newest': 'Newest',
                        'price_asc': 'Price ↑',
                        'price_desc': 'Price ↓',
                        'popular': 'Popular',
                      }.entries.map((e) {
                        final sel = tempSort == e.key;
                        return GestureDetector(
                          onTap: () => setSheetState(() => tempSort = e.key),
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 14,
                              vertical: 7,
                            ),
                            decoration: BoxDecoration(
                              color: sel ? _green : Colors.white,
                              borderRadius: BorderRadius.circular(20),
                              border: Border.all(
                                color: sel ? _green : const Color(0xFFE2E8F0),
                              ),
                            ),
                            child: Text(
                              e.value,
                              style: TextStyle(
                                color: sel
                                    ? Colors.white
                                    : const Color(0xFF374151),
                                fontWeight: FontWeight.w600,
                                fontSize: 13,
                              ),
                            ),
                          ),
                        );
                      }).toList(),
                ),
                const SizedBox(height: 20),
                const Text(
                  'PRICE RANGE',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w800,
                    color: Color(0xFF94A3B8),
                    letterSpacing: 0.8,
                  ),
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: minCtrl,
                        keyboardType: TextInputType.number,
                        decoration: InputDecoration(
                          labelText: 'Min ₹',
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(10),
                            borderSide: const BorderSide(
                              color: Color(0xFFE2E8F0),
                            ),
                          ),
                          contentPadding: const EdgeInsets.symmetric(
                            horizontal: 12,
                            vertical: 10,
                          ),
                        ),
                      ),
                    ),
                    const Padding(
                      padding: EdgeInsets.symmetric(horizontal: 10),
                      child: Text('–'),
                    ),
                    Expanded(
                      child: TextField(
                        controller: maxCtrl,
                        keyboardType: TextInputType.number,
                        decoration: InputDecoration(
                          labelText: 'Max ₹',
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(10),
                            borderSide: const BorderSide(
                              color: Color(0xFFE2E8F0),
                            ),
                          ),
                          contentPadding: const EdgeInsets.symmetric(
                            horizontal: 12,
                            vertical: 10,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 24),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    style: FilledButton.styleFrom(
                      backgroundColor: _green,
                      minimumSize: const Size.fromHeight(48),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                    onPressed: () {
                      Navigator.pop(ctx);
                      setState(() {
                        _sort = tempSort;
                        _minPrice = double.tryParse(minCtrl.text);
                        _maxPrice = double.tryParse(maxCtrl.text);
                      });
                      _loadProducts(reset: true);
                    },
                    child: const Text(
                      'Apply Filters',
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  // ── Build ──────────────────────────────────────────────────────────────────
  @override
  Widget build(BuildContext context) {
    final subSub = _subSubCats();
    return Scaffold(
      backgroundColor: _theme.bg,
      body: SafeArea(
        bottom: false,
        child: CustomScrollView(
          controller: _scrollCtrl,
          slivers: [
            // Header
            SliverToBoxAdapter(child: _buildHeader()),
            // Sub-categories row
            if (_subCats.isNotEmpty)
              SliverToBoxAdapter(child: _buildSubCatRow()),
            // Sub-sub-categories row (only when a sub is selected and has children)
            if (subSub.isNotEmpty)
              SliverToBoxAdapter(child: _buildSubSubCatRow(subSub)),
            // Products
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(12, 4, 12, 32),
              sliver: _buildProductsSliver(),
            ),
          ],
        ),
      ),
    );
  }

  // ── Header ─────────────────────────────────────────────────────────────────
  Widget _buildHeader() {
    return Container(
      color: _theme.bg,
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Back row + logo + cart icon
          Row(
            children: [
              GestureDetector(
                onTap: () => Navigator.of(context).maybePop(),
                child: Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(10),
                    boxShadow: const [
                      BoxShadow(
                        color: Color(0x0D000000),
                        blurRadius: 4,
                        offset: Offset(0, 1),
                      ),
                    ],
                  ),
                  child: const Icon(
                    Icons.arrow_back_rounded,
                    size: 18,
                    color: Color(0xFF0F172A),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              // App logo + name
              Image.asset(
                'assets/images/logo.png',
                width: 26,
                height: 26,
                errorBuilder: (_, _, _) => const SizedBox.shrink(),
              ),
              const SizedBox(width: 5),
              RichText(
                text: const TextSpan(
                  style: TextStyle(
                    fontWeight: FontWeight.w900,
                    fontSize: 15,
                    letterSpacing: 0,
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
              const Spacer(),
              // Wishlist icon
              ValueListenableBuilder<int>(
                valueListenable: WishlistManager.instance.countNotifier,
                builder: (_, count, _) => GestureDetector(
                  onTap: () => Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => const WishlistScreen()),
                  ),
                  child: Container(
                    width: 36,
                    height: 36,
                    margin: const EdgeInsets.only(right: 8),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(10),
                      boxShadow: const [
                        BoxShadow(
                          color: Color(0x0D000000),
                          blurRadius: 4,
                          offset: Offset(0, 1),
                        ),
                      ],
                    ),
                    child: Stack(
                      children: [
                        const Center(
                          child: Icon(
                            Icons.favorite_border_rounded,
                            size: 18,
                            color: Color(0xFF0F172A),
                          ),
                        ),
                        if (count > 0)
                          Positioned(
                            right: 2,
                            top: 2,
                            child: Container(
                              width: 12,
                              height: 12,
                              decoration: BoxDecoration(
                                color: _theme.accent,
                                shape: BoxShape.circle,
                                border: Border.all(
                                  color: Colors.white,
                                  width: 1.5,
                                ),
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
                ),
              ),
              // Cart icon
              ValueListenableBuilder<int>(
                valueListenable: CartManager.instance.countNotifier,
                builder: (_, count, _) => GestureDetector(
                  onTap: () => Navigator.of(
                    context,
                  ).push(MaterialPageRoute(builder: (_) => const CartScreen())),
                  child: Stack(
                    children: [
                      Container(
                        width: 36,
                        height: 36,
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(10),
                          boxShadow: const [
                            BoxShadow(
                              color: Color(0x0D000000),
                              blurRadius: 4,
                              offset: Offset(0, 1),
                            ),
                          ],
                        ),
                        child: const Icon(
                          Icons.shopping_bag_outlined,
                          size: 18,
                          color: Color(0xFF0F172A),
                        ),
                      ),
                      if (count > 0)
                        Positioned(
                          right: 0,
                          top: 0,
                          child: Container(
                            width: 16,
                            height: 16,
                            decoration: BoxDecoration(
                              color: _theme.accent,
                              shape: BoxShape.circle,
                              border: Border.all(color: _theme.bg, width: 1.5),
                            ),
                            child: Center(
                              child: Text(
                                '$count',
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 8,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          // Search bar
          Container(
            height: 42,
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              boxShadow: const [
                BoxShadow(
                  color: Color(0x0A000000),
                  blurRadius: 4,
                  offset: Offset(0, 1),
                ),
              ],
            ),
            child: TextField(
              controller: _searchCtrl,
              onChanged: (v) => setState(() => _searchQuery = v.trim()),
              style: const TextStyle(fontSize: 14, color: Color(0xFF0F172A)),
              decoration: InputDecoration(
                hintText: 'Search in ${widget.categoryName}...',
                hintStyle: const TextStyle(
                  fontSize: 14,
                  color: Color(0xFF94A3B8),
                ),
                prefixIcon: const Icon(
                  Icons.search_rounded,
                  size: 20,
                  color: Color(0xFF94A3B8),
                ),
                suffixIcon: _searchQuery.isNotEmpty
                    ? GestureDetector(
                        onTap: () {
                          _searchCtrl.clear();
                          setState(() => _searchQuery = '');
                        },
                        child: const Icon(
                          Icons.close_rounded,
                          size: 18,
                          color: Color(0xFF94A3B8),
                        ),
                      )
                    : null,
                border: InputBorder.none,
                contentPadding: const EdgeInsets.symmetric(vertical: 12),
              ),
            ),
          ),
          const SizedBox(height: 14),
          // Category name + subtitle + Filters button
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      widget.categoryName.toUpperCase(),
                      style: const TextStyle(
                        fontSize: 30,
                        fontWeight: FontWeight.w900,
                        color: Color(0xFF0F172A),
                        letterSpacing: -0.5,
                        height: 1.0,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      _theme.subtitle,
                      style: const TextStyle(
                        fontSize: 13,
                        color: Color(0xFF64748B),
                        fontWeight: FontWeight.w400,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              // Filters button
              GestureDetector(
                onTap: _openFilterSheet,
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 14,
                    vertical: 8,
                  ),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: const Color(0xFFE2E8F0)),
                    boxShadow: const [
                      BoxShadow(color: Color(0x08000000), blurRadius: 4),
                    ],
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        Icons.tune_rounded,
                        size: 16,
                        color: _activeFilterCount > 0
                            ? _theme.accent
                            : const Color(0xFF374151),
                      ),
                      const SizedBox(width: 6),
                      Text(
                        _activeFilterCount > 0
                            ? 'Filters ($_activeFilterCount)'
                            : 'Filters',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: _activeFilterCount > 0
                              ? _theme.accent
                              : const Color(0xFF374151),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  // ── Sub-category chips row ─────────────────────────────────────────────────
  Widget _buildSubCatRow() {
    return Container(
      color: _theme.bg,
      padding: const EdgeInsets.only(bottom: 4),
      child: SizedBox(
        height: 95,
        child: ListView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 16),
          children: [
            // "All" chip
            _subCatChip(
              id: null,
              name: 'All',
              imageUrl: null,
              selected: _selectedSubId == null,
              onTap: () {
                setState(() {
                  _selectedSubId = null;
                  _selectedSubSubId = null;
                });
                _loadProducts(reset: true);
              },
            ),
            ..._subCats.map(
              (c) => _subCatChip(
                id: c['id']?.toString(),
                name: c['name']?.toString() ?? '',
                imageUrl: _imgUrl(c['category_url']),
                selected: _selectedSubId == c['id']?.toString(),
                onTap: () {
                  final id = c['id']?.toString();
                  setState(() {
                    _selectedSubId = id;
                    _selectedSubSubId = null;
                  });
                  _loadProducts(reset: true);
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _subCatChip({
    required String? id,
    required String name,
    required String? imageUrl,
    required bool selected,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 68,
        margin: const EdgeInsets.only(right: 10),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              width: 58,
              height: 58,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: Colors.white,
                border: Border.all(
                  color: selected ? _green : const Color(0xFFE5E7EB),
                  width: selected ? 2.5 : 1.5,
                ),
                boxShadow: selected
                    ? [
                        BoxShadow(
                          color: _green.withValues(alpha: 0.15),
                          blurRadius: 8,
                          spreadRadius: 1,
                        ),
                      ]
                    : null,
              ),
              child: ClipOval(
                child: id == null
                    // "All" icon
                    ? Center(
                        child: Icon(
                          Icons.apps_rounded,
                          color: selected ? _green : const Color(0xFF94A3B8),
                          size: 24,
                        ),
                      )
                    : imageUrl != null
                    ? CachedNetworkImage(
                        imageUrl: imageUrl,
                        fit: BoxFit.cover,
                        placeholder: (_, _) =>
                            Container(color: const Color(0xFFF1F5F9)),
                        errorWidget: (_, _, _) => Center(
                          child: Icon(
                            Icons.checkroom_outlined,
                            color: selected ? _green : const Color(0xFF94A3B8),
                            size: 24,
                          ),
                        ),
                      )
                    : Center(
                        child: Icon(
                          Icons.checkroom_outlined,
                          color: selected ? _green : const Color(0xFF94A3B8),
                          size: 24,
                        ),
                      ),
              ),
            ),
            const SizedBox(height: 5),
            Text(
              name,
              textAlign: TextAlign.center,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontSize: 10,
                fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                color: selected ? _green : const Color(0xFF374151),
                height: 1.2,
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ── Sub-sub-category chips row ─────────────────────────────────────────────
  // ── Sub-sub-category chips row (circular image style, smaller) ────────────────
  Widget _buildSubSubCatRow(List<Map<String, dynamic>> subSubs) {
    return Container(
      color: _theme.bg,
      padding: const EdgeInsets.only(bottom: 6),
      child: SizedBox(
        height: 80,
        child: ListView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 16),
          children: [
            _subSubChip(
              id: null,
              name: 'All',
              imageUrl: null,
              selected: _selectedSubSubId == null,
            ),
            ...subSubs.map(
              (c) => _subSubChip(
                id: c['id']?.toString(),
                name: c['name']?.toString() ?? '',
                imageUrl: _imgUrl(c['category_url']),
                selected: _selectedSubSubId == c['id']?.toString(),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _subSubChip({
    required String? id,
    required String name,
    required String? imageUrl,
    required bool selected,
  }) {
    return GestureDetector(
      onTap: () {
        setState(() => _selectedSubSubId = id);
        _loadProducts(reset: true);
      },
      child: Container(
        width: 58,
        margin: const EdgeInsets.only(right: 10),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            AnimatedContainer(
              duration: const Duration(milliseconds: 180),
              width: 46,
              height: 46,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: Colors.white,
                border: Border.all(
                  color: selected ? _green : const Color(0xFFE5E7EB),
                  width: selected ? 2.5 : 1.5,
                ),
                boxShadow: selected
                    ? [
                        BoxShadow(
                          color: _green.withValues(alpha: 0.15),
                          blurRadius: 6,
                          spreadRadius: 1,
                        ),
                      ]
                    : null,
              ),
              child: ClipOval(
                child: id == null
                    ? Center(
                        child: Icon(
                          Icons.apps_rounded,
                          color: selected ? _green : const Color(0xFF94A3B8),
                          size: 20,
                        ),
                      )
                    : imageUrl != null
                    ? CachedNetworkImage(
                        imageUrl: imageUrl,
                        fit: BoxFit.cover,
                        placeholder: (_, _) =>
                            Container(color: const Color(0xFFF1F5F9)),
                        errorWidget: (_, _, _) => Center(
                          child: Icon(
                            Icons.checkroom_outlined,
                            color: selected ? _green : const Color(0xFF94A3B8),
                            size: 20,
                          ),
                        ),
                      )
                    : Center(
                        child: Icon(
                          Icons.checkroom_outlined,
                          color: selected ? _green : const Color(0xFF94A3B8),
                          size: 20,
                        ),
                      ),
              ),
            ),
            const SizedBox(height: 4),
            Text(
              name,
              textAlign: TextAlign.center,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontSize: 9,
                fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                color: selected ? _green : const Color(0xFF374151),
                height: 1.2,
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ── Products sliver ────────────────────────────────────────────────────────
  Widget _buildProductsSliver() {
    final display = _searchQuery.isEmpty
        ? _products
        : _products.where((p) {
            final q = _searchQuery.toLowerCase();
            return (p['name']?.toString().toLowerCase() ?? '').contains(q) ||
                (p['brand']?.toString().toLowerCase() ?? '').contains(q);
          }).toList();

    if (_isLoading && _products.isEmpty) {
      return const SliverFillRemaining(child: Center(child: BfSpinner()));
    }
    if (!_isLoading && display.isEmpty) {
      return SliverFillRemaining(
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(
                Icons.search_off_rounded,
                size: 64,
                color: Color(0xFFCBD5E1),
              ),
              const SizedBox(height: 12),
              Text(
                _searchQuery.isNotEmpty
                    ? 'No results for "$_searchQuery"'
                    : 'No products found',
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                  color: Color(0xFF64748B),
                ),
              ),
              const SizedBox(height: 6),
              TextButton(
                onPressed: () {
                  _searchCtrl.clear();
                  setState(() {
                    _searchQuery = '';
                    _selectedSubId = null;
                    _selectedSubSubId = null;
                    _sort = 'newest';
                    _minPrice = null;
                    _maxPrice = null;
                  });
                  _loadProducts(reset: true);
                },
                child: Text(
                  'Clear filters',
                  style: TextStyle(color: _theme.accent),
                ),
              ),
            ],
          ),
        ),
      );
    }

    return SliverGrid(
      delegate: SliverChildBuilderDelegate(
        (_, i) {
          if (i == display.length) {
            return const Center(
              child: Padding(padding: EdgeInsets.all(16), child: BfSpinner()),
            );
          }
          return _productCard(display[i]);
        },
        childCount: display.length + (_hasMore && _searchQuery.isEmpty ? 1 : 0),
      ),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        childAspectRatio: 0.62,
        crossAxisSpacing: 10,
        mainAxisSpacing: 10,
      ),
    );
  }

  // ── Product card ───────────────────────────────────────────────────────────
  Widget _productCard(Map<String, dynamic> item) {
    final name = item['name']?.toString() ?? '';
    final brand = item['brand']?.toString() ?? '';
    final price = _fmt(item['discount_price'] ?? item['price']);
    final origPrice = _fmt(item['price']);
    final img = _imgUrl(item['image']);
    final hasDiscount = origPrice != price && origPrice != '0';
    final discPct = hasDiscount
        ? (((double.tryParse(origPrice) ?? 0) - (double.tryParse(price) ?? 0)) /
                  (double.tryParse(origPrice) ?? 1) *
                  100)
              .round()
        : 0;
    final offLabel = discPct > 0 ? '$discPct% OFF' : '';

    return GestureDetector(
      onTap: item['id'] != null
          ? () => Navigator.of(context).push(
              MaterialPageRoute(
                builder: (_) => ProductDetailScreen(
                  productId: item['id'].toString(),
                  initialName: name,
                ),
              ),
            )
          : null,
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          boxShadow: const [
            BoxShadow(
              color: Color(0x0D000000),
              blurRadius: 8,
              offset: Offset(0, 2),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              flex: 3,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  ClipRRect(
                    borderRadius: const BorderRadius.vertical(
                      top: Radius.circular(16),
                    ),
                    child: img != null
                        ? CachedNetworkImage(
                            imageUrl: img,
                            fit: BoxFit.cover,
                            alignment: Alignment.topCenter,
                            placeholder: (_, _) =>
                                Container(color: const Color(0xFFF1F5F9)),
                            errorWidget: (_, _, _) => Container(
                              color: const Color(0xFFF1F5F9),
                              child: const Icon(
                                Icons.checkroom_outlined,
                                color: Color(0xFFCBD5E1),
                                size: 36,
                              ),
                            ),
                          )
                        : Container(
                            color: const Color(0xFFF1F5F9),
                            child: const Icon(
                              Icons.checkroom_outlined,
                              color: Color(0xFFCBD5E1),
                              size: 36,
                            ),
                          ),
                  ),
                  if (item['is_bestseller'] == true)
                    Positioned(
                      top: 8,
                      left: 8,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 6,
                          vertical: 3,
                        ),
                        decoration: BoxDecoration(
                          color: const Color(0xFFDC2626),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: const Text(
                          'BESTSELLER',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 8,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ),
                    )
                  else if (item['is_try_and_buy'] == true)
                    Positioned(
                      top: 8,
                      left: 8,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 4,
                        ),
                        decoration: BoxDecoration(
                          gradient: const LinearGradient(
                            colors: [Color(0xFFF59E0B), Color(0xFFEF4444)],
                            begin: Alignment.centerLeft,
                            end: Alignment.centerRight,
                          ),
                          borderRadius: BorderRadius.circular(20),
                          boxShadow: const [
                            BoxShadow(
                              color: Color(0x55F59E0B),
                              blurRadius: 6,
                              offset: Offset(0, 2),
                            ),
                          ],
                        ),
                        child: const Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text('✨', style: TextStyle(fontSize: 7, height: 1)),
                            SizedBox(width: 3),
                            Text(
                              'Try & Buy',
                              style: TextStyle(
                                color: Colors.white,
                                fontSize: 8,
                                fontWeight: FontWeight.w900,
                                letterSpacing: 0.3,
                              ),
                            ),
                          ],
                        ),
                      ),
                    )
                  else if (!item.containsKey('is_try_and_buy') || item['is_try_and_buy'] != true)
                    Positioned(
                      top: 8,
                      left: 8,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: const Color(0xFF16A34A),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: const Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text('⚡', style: TextStyle(fontSize: 7, height: 1)),
                            SizedBox(width: 3),
                            Text('+ 60 MIN',
                              style: TextStyle(
                                color: Colors.white, fontSize: 8,
                                fontWeight: FontWeight.w900, letterSpacing: 0.3,
                              ),
                            ),
                          ],
                        ),
                      ),
                    )
                  else if (hasDiscount)
                    Positioned(
                      top: 8,
                      left: 8,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 6,
                          vertical: 3,
                        ),
                        decoration: BoxDecoration(
                          color: const Color(0xFFDC2626),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          offLabel,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 8,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ),
                    ),
                  Positioned(
                    top: 6,
                    right: 6,
                    child: GestureDetector(
                      onTap: () {
                        final id = item['id']?.toString() ?? '';
                        if (id.isEmpty) return;
                        WishlistManager.instance.toggle(
                          WishlistItem(
                            productId: id,
                            name: name,
                            price: price,
                            imageUrl: img,
                          ),
                        );
                        setState(() {});
                      },
                      child: Container(
                        width: 30,
                        height: 30,
                        decoration: const BoxDecoration(
                          color: Colors.white,
                          shape: BoxShape.circle,
                        ),
                        child: Icon(
                          WishlistManager.instance.isWishlisted(
                                item['id']?.toString() ?? '',
                              )
                              ? Icons.favorite_rounded
                              : Icons.favorite_border_rounded,
                          size: 16,
                          color:
                              WishlistManager.instance.isWishlisted(
                                item['id']?.toString() ?? '',
                              )
                              ? const Color(0xFFE11D48)
                              : const Color(0xFF94A3B8),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(10, 8, 10, 8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (brand.isNotEmpty)
                    Text(
                      brand.toUpperCase(),
                      style: const TextStyle(
                        fontSize: 10,
                        color: Color(0xFF94A3B8),
                        fontWeight: FontWeight.w700,
                        letterSpacing: 0.5,
                      ),
                    ),
                  Text(
                    name,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF0F172A),
                      height: 1.2,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      Text(
                        '\u20b9$price',
                        style: const TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w800,
                          color: Color(0xFF0F172A),
                        ),
                      ),
                      if (hasDiscount) ...[
                        const SizedBox(width: 4),
                        Text(
                          '\u20b9$origPrice',
                          style: const TextStyle(
                            fontSize: 11,
                            color: Color(0xFF9CA3AF),
                            decoration: TextDecoration.lineThrough,
                          ),
                        ),
                      ],
                      const Spacer(),
                      Container(
                        width: 28,
                        height: 28,
                        decoration: BoxDecoration(
                          color: const Color(0xFFDCFCE7),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Icon(
                          Icons.shopping_cart_outlined,
                          size: 15,
                          color: _green,
                        ),
                      ),
                    ],
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
