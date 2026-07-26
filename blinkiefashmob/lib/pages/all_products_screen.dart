import 'dart:async';
import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';

import '../api_base.dart';
import '../services/api_client.dart';
import '../services/cart_manager.dart';
import '../services/wishlist_manager.dart';
import 'cart_screen.dart';
import 'product_detail_screen.dart';
import '../widgets/bf_loader.dart';
import '../widgets/store_closed_banner.dart';

class AllProductsScreen extends StatefulWidget {
  final String? categoryId;
  final String? categoryName;
  final String? brandId;
  final String? brandName;
  final String? initialSearch;
  final double? minPrice;
  final double? maxPrice;
  final bool autoFocusSearch;
  final String initialSort;

  const AllProductsScreen({
    super.key,
    this.categoryId,
    this.categoryName,
    this.brandId,
    this.brandName,
    this.initialSearch,
    this.minPrice,
    this.maxPrice,
    this.autoFocusSearch = false,
    this.initialSort = 'newest',
  });

  @override
  State<AllProductsScreen> createState() => _AllProductsScreenState();
}

class _AllProductsScreenState extends State<AllProductsScreen> {
  static const Color _green = Color(0xFF16A34A);

  final ApiClient _api = ApiClient();
  final TextEditingController _searchCtrl = TextEditingController();
  final ScrollController _scrollCtrl = ScrollController();
  final FocusNode _searchFocus = FocusNode();

  List<Map<String, dynamic>> _products = const [];
  List<Map<String, dynamic>> _categories = const []; // root only (for chips)
  List<Map<String, dynamic>> _allCats =
      const []; // all levels (for suggestions)
  List<Map<String, dynamic>> _brands = const [];

  // ── Search suggestions ───────────────────────────────────────────────────
  // Each item: {text, type:'category'|'brand'|'product', id?}
  List<Map<String, String>> _typedSuggestions = const [];
  bool _showSuggestions = false;
  Timer? _suggestTimer;

  bool _isLoading = false;
  bool _hasMore = true;
  int _offset = 0;
  static const int _pageSize = 40;

  // Active filters
  String? _selectedCategoryId;
  String? _selectedCategoryName;
  String? _selectedBrandId;
  String? _selectedBrandName;
  String _sort = 'newest';
  double? _minPrice;
  double? _maxPrice;

  // Filter sheet temp values
  String? _tempCatId;
  String? _tempCatName;
  String? _tempBrandId;
  String? _tempBrandName;
  String _tempSort = 'newest';
  final TextEditingController _minCtrl = TextEditingController();
  final TextEditingController _maxCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    _selectedCategoryId = widget.categoryId;
    _selectedCategoryName = widget.categoryName;
    _selectedBrandId = widget.brandId;
    _selectedBrandName = widget.brandName;
    if (widget.initialSearch != null) {
      _searchCtrl.text = widget.initialSearch!;
    }
    if (widget.autoFocusSearch) {
      WidgetsBinding.instance.addPostFrameCallback(
        (_) => _searchFocus.requestFocus(),
      );
    }
    if (widget.minPrice != null) _minPrice = widget.minPrice;
    if (widget.maxPrice != null) _maxPrice = widget.maxPrice;
    _sort = widget.initialSort;
    _loadMeta();
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
    _searchCtrl.dispose();
    _scrollCtrl.dispose();
    _searchFocus.dispose();
    _suggestTimer?.cancel();
    _minCtrl.dispose();
    _maxCtrl.dispose();
    super.dispose();
  }

  void _updateSuggestions(String query) {
    _suggestTimer?.cancel();
    final q = query.trim();
    if (q.length < 2) {
      setState(() {
        _typedSuggestions = const [];
        _showSuggestions = false;
      });
      return;
    }
    _suggestTimer = Timer(const Duration(milliseconds: 250), () {
      if (!mounted) return;
      final lower = q.toLowerCase();
      final seen = <String>{};
      final results = <Map<String, String>>[];

      // 0. Always show "Search for '[query]'" as the first item
      results.add({'text': q, 'type': 'search'});

      // 1. Categories — max 2 that contain query
      for (final c in _allCats) {
        final n = (c['name'] ?? '').toString();
        if (n.toLowerCase().contains(lower) && seen.add('cat:$n')) {
          results.add({
            'text': n,
            'type': 'category',
            'id': c['id']?.toString() ?? '',
          });
          if (results.where((r) => r['type'] == 'category').length >= 2) break;
        }
      }

      // 2. Brands — matching brands, OR top 2 if none match query
      final matchingBrands = <Map<String, dynamic>>[];
      for (final b in _brands) {
        final n = (b['name'] ?? '').toString();
        if (n.toLowerCase().contains(lower)) matchingBrands.add(b);
      }
      final brandsToShow = matchingBrands.isNotEmpty
          ? matchingBrands.take(2).toList()
          : _brands.take(2).toList();
      for (final b in brandsToShow) {
        final n = (b['name'] ?? '').toString();
        if (seen.add('brand:$n')) {
          results.add({
            'text': n,
            'type': 'brand',
            'id': b['id']?.toString() ?? '',
            'subtitle': matchingBrands.isEmpty ? 'Popular brand' : '',
          });
        }
      }

      // 3. Product names — max 4 containing query
      for (final p in _products) {
        final n = (p['name'] ?? '').toString();
        if (n.toLowerCase().contains(lower) && seen.add('prod:$n')) {
          results.add({'text': n, 'type': 'product'});
          if (results.where((r) => r['type'] == 'product').length >= 4) break;
        }
      }

      if (mounted) {
        setState(() {
          _typedSuggestions = results;
          _showSuggestions = results.isNotEmpty;
        });
      }
    });
  }

  void _applySuggestion(Map<String, String> s) {
    final type = s['type'] ?? 'product';
    // 'search' type = raw query search (same as product/keyword)
    if (type == 'search') {
      final text = s['text']!;
      _searchCtrl.text = text;
      _searchCtrl.selection = TextSelection.collapsed(offset: text.length);
      _searchFocus.unfocus();
      setState(() {
        _showSuggestions = false;
        _typedSuggestions = const [];
      });
      _loadProducts(reset: true);
      return;
    }
    if (type == 'category') {
      final name = s['text']!;
      final id = s['id'];
      _searchFocus.unfocus();
      setState(() {
        _showSuggestions = false;
        _typedSuggestions = const [];
      });
      if (id != null && id.isNotEmpty) {
        setState(() {
          _selectedCategoryId = id;
          _selectedCategoryName = name;
          _searchCtrl.clear();
        });
        _loadProducts(reset: true);
      } else {
        _searchCtrl.text = name;
        _loadProducts(reset: true);
      }
      return;
    }
    if (type == 'brand') {
      final name = s['text']!;
      final id = s['id'];
      _searchFocus.unfocus();
      setState(() {
        _showSuggestions = false;
        _typedSuggestions = const [];
      });
      if (id != null && id.isNotEmpty) {
        setState(() {
          _selectedBrandId = id;
          _selectedBrandName = name;
          _searchCtrl.clear();
        });
        _loadProducts(reset: true);
      } else {
        _searchCtrl.text = name;
        _loadProducts(reset: true);
      }
      return;
    }
    // product / keyword
    final text = s['text']!;
    _searchCtrl.text = text;
    _searchCtrl.selection = TextSelection.collapsed(offset: text.length);
    _searchFocus.unfocus();
    setState(() {
      _showSuggestions = false;
      _typedSuggestions = const [];
    });
    _loadProducts(reset: true);
  }

  Widget _suggestionsDropdown() {
    final query = _searchCtrl.text.trim().toLowerCase();
    return Container(
      color: Colors.white,
      child: ListView.separated(
        padding: EdgeInsets.zero,
        itemCount: _typedSuggestions.length,
        separatorBuilder: (_, e) => const Divider(height: 1, indent: 52),
        itemBuilder: (_, i) {
          final s = _typedSuggestions[i];
          final text = s['text']!;
          final type = s['type'] ?? 'product';
          final lower = text.toLowerCase();
          final matchStart = lower.indexOf(query);
          IconData icon;
          String badge;
          Color badgeColor;
          Color iconColor;
          switch (type) {
            case 'search':
              icon = Icons.search_rounded;
              badge = '';
              badgeColor = Colors.transparent;
              iconColor = const Color(0xFF16A34A);
            case 'category':
              icon = Icons.grid_view_rounded;
              badge = 'Category';
              badgeColor = const Color(0xFF7C3AED);
              iconColor = const Color(0xFF7C3AED);
            case 'brand':
              icon = Icons.storefront_rounded;
              badge = s['subtitle'] == 'Popular brand' ? 'Popular' : 'Brand';
              badgeColor = const Color(0xFF0891B2);
              iconColor = const Color(0xFF0891B2);
            default:
              icon = Icons.search_rounded;
              badge = '';
              badgeColor = Colors.transparent;
              iconColor = const Color(0xFF94A3B8);
          }
          return InkWell(
            onTap: () => _applySuggestion(s),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 11),
              child: Row(
                children: [
                  Icon(icon, size: 20, color: iconColor),
                  const SizedBox(width: 12),
                  Expanded(
                    child: matchStart >= 0
                        ? RichText(
                            overflow: TextOverflow.ellipsis,
                            text: TextSpan(
                              style: const TextStyle(
                                fontSize: 14,
                                color: Color(0xFF374151),
                              ),
                              children: [
                                if (matchStart > 0)
                                  TextSpan(text: text.substring(0, matchStart)),
                                TextSpan(
                                  text: text.substring(
                                    matchStart,
                                    matchStart + query.length,
                                  ),
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w800,
                                    color: Color(0xFF0F172A),
                                  ),
                                ),
                                if (matchStart + query.length < text.length)
                                  TextSpan(
                                    text: text.substring(
                                      matchStart + query.length,
                                    ),
                                  ),
                              ],
                            ),
                          )
                        : Text(
                            text,
                            style: const TextStyle(
                              fontSize: 14,
                              color: Color(0xFF374151),
                            ),
                            overflow: TextOverflow.ellipsis,
                          ),
                  ),
                  const SizedBox(width: 8),
                  if (badge.isNotEmpty)
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 7,
                        vertical: 2,
                      ),
                      decoration: BoxDecoration(
                        color: badgeColor.withAlpha(15),
                        borderRadius: BorderRadius.circular(6),
                        border: Border.all(color: badgeColor.withAlpha(60)),
                      ),
                      child: Text(
                        badge,
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                          color: badgeColor,
                        ),
                      ),
                    )
                  else
                    const Icon(
                      Icons.north_west_rounded,
                      size: 14,
                      color: Color(0xFFCBD5E1),
                    ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Future<void> _loadMeta() async {
    final results = await Future.wait([
      _api.fetchCategories(),
      _api.fetchBrands(),
    ]);
    if (!mounted) return;

    final allCats = (results[0]).whereType<Map<String, dynamic>>().toList();

    // Resolve categoryName → categoryId when only a name was passed
    String? resolvedCatId;
    String? resolvedCatName;
    if (widget.categoryName != null && widget.categoryId == null) {
      final needle = widget.categoryName!.toLowerCase();
      final match = allCats.firstWhere(
        (c) => c['name'].toString().toLowerCase() == needle,
        orElse: () => {},
      );
      if (match.isNotEmpty) {
        resolvedCatId = match['id'].toString();
        resolvedCatName = match['name'].toString();
      }
    }

    setState(() {
      _categories = allCats.where((c) => c['parent_id'] == null).toList();
      _allCats = allCats;
      _brands = (results[1]).whereType<Map<String, dynamic>>().toList();
      if (resolvedCatId != null) {
        _selectedCategoryId = resolvedCatId;
        _selectedCategoryName = resolvedCatName;
      }
    });

    // Reload with the resolved category filter
    if (resolvedCatId != null) {
      _loadProducts(reset: true);
    }
  }

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
        categoryId: _selectedCategoryId,
        brandId: _selectedBrandId,
        search: _searchCtrl.text.trim().isEmpty
            ? null
            : _searchCtrl.text.trim(),
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
        if (reset) {
          _products = rows;
        } else {
          _products = [..._products, ...rows];
        }
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
    if (_selectedCategoryId != null) c++;
    if (_selectedBrandId != null) c++;
    if (_minPrice != null || _maxPrice != null) c++;
    if (_sort != 'newest') c++;
    return c;
  }

  void _openFilterSheet() {
    _tempCatId = _selectedCategoryId;
    _tempCatName = _selectedCategoryName;
    _tempBrandId = _selectedBrandId;
    _tempBrandName = _selectedBrandName;
    _tempSort = _sort;
    _minCtrl.text = _minPrice?.toStringAsFixed(0) ?? '';
    _maxCtrl.text = _maxPrice?.toStringAsFixed(0) ?? '';

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => _FilterSheet(
        categories: _categories,
        brands: _brands,
        tempCatId: _tempCatId,
        tempCatName: _tempCatName,
        tempBrandId: _tempBrandId,
        tempBrandName: _tempBrandName,
        tempSort: _tempSort,
        minCtrl: _minCtrl,
        maxCtrl: _maxCtrl,
        onApply: (catId, catName, brandId, brandName, sort, minP, maxP) {
          setState(() {
            _selectedCategoryId = catId;
            _selectedCategoryName = catName;
            _selectedBrandId = brandId;
            _selectedBrandName = brandName;
            _sort = sort;
            _minPrice = minP;
            _maxPrice = maxP;
          });
          _loadProducts(reset: true);
        },
        onClear: () {
          setState(() {
            _selectedCategoryId = null;
            _selectedCategoryName = null;
            _selectedBrandId = null;
            _selectedBrandName = null;
            _sort = 'newest';
            _minPrice = null;
            _maxPrice = null;
          });
          _loadProducts(reset: true);
        },
      ),
    );
  }

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

  @override
  Widget build(BuildContext context) {
    final title = _selectedCategoryName ?? _selectedBrandName ?? 'All Products';
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: _buildAppBar(title),
      body: Column(
        children: [
          const StoreClosedBanner(),
          _searchBar(),
          if (_showSuggestions)
            Expanded(child: _suggestionsDropdown())
          else ...[
            if (_categories.isNotEmpty) _categoryChipsRow(),
            if (_activeFilterCount > 0) _activeFilterChips(),
          ],
          Expanded(child: _body()),
        ],
      ),
    );
  }

  PreferredSizeWidget _buildAppBar(String title) {
    return AppBar(
      backgroundColor: Colors.white,
      elevation: 0,
      surfaceTintColor: Colors.white,
      leading: IconButton(
        icon: const Icon(Icons.arrow_back_rounded, color: Color(0xFF0F172A)),
        onPressed: () => Navigator.of(context).maybePop(),
      ),
      title: Text(
        title,
        style: const TextStyle(
          fontSize: 18,
          fontWeight: FontWeight.w800,
          color: Color(0xFF0F172A),
          letterSpacing: -0.3,
        ),
      ),
      actions: [
        Stack(
          children: [
            IconButton(
              icon: const Icon(Icons.tune_rounded, color: Color(0xFF374151)),
              onPressed: _openFilterSheet,
            ),
            if (_activeFilterCount > 0)
              Positioned(
                right: 6,
                top: 6,
                child: Container(
                  width: 16,
                  height: 16,
                  decoration: const BoxDecoration(
                    color: _green,
                    shape: BoxShape.circle,
                  ),
                  child: Center(
                    child: Text(
                      '$_activeFilterCount',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 9,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                ),
              ),
          ],
        ),
        ValueListenableBuilder<int>(
          valueListenable: CartManager.instance.countNotifier,
          builder: (ctx, count, _) => Stack(
            children: [
              IconButton(
                icon: const Icon(
                  Icons.shopping_cart_outlined,
                  color: Color(0xFF374151),
                ),
                onPressed: () => Navigator.of(
                  context,
                ).push(MaterialPageRoute(builder: (_) => const CartScreen())),
              ),
              if (count > 0)
                Positioned(
                  right: 6,
                  top: 6,
                  child: Container(
                    width: 16,
                    height: 16,
                    decoration: const BoxDecoration(
                      color: _green,
                      shape: BoxShape.circle,
                    ),
                    child: Center(
                      child: Text(
                        '$count',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 9,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
        const SizedBox(width: 4),
      ],
    );
  }

  Widget _searchBar() {
    return Container(
      color: Colors.white,
      padding: const EdgeInsets.fromLTRB(12, 8, 12, 10),
      child: TextField(
        controller: _searchCtrl,
        focusNode: _searchFocus,
        onSubmitted: (_) {
          _searchFocus.unfocus();
          setState(() {
            _showSuggestions = false;
            _typedSuggestions = const [];
          });
          _loadProducts(reset: true);
        },
        textInputAction: TextInputAction.search,
        decoration: InputDecoration(
          hintText: 'Search products, brands…',
          hintStyle: const TextStyle(fontSize: 14, color: Color(0xFF94A3B8)),
          prefixIcon: const Icon(
            Icons.search_rounded,
            color: Color(0xFF94A3B8),
            size: 20,
          ),
          suffixIcon: _searchCtrl.text.isNotEmpty
              ? IconButton(
                  icon: const Icon(
                    Icons.close_rounded,
                    size: 18,
                    color: Color(0xFF94A3B8),
                  ),
                  onPressed: () {
                    _searchCtrl.clear();
                    _loadProducts(reset: true);
                    setState(() {});
                  },
                )
              : null,
          filled: true,
          fillColor: const Color(0xFFF1F5F9),
          contentPadding: const EdgeInsets.symmetric(vertical: 10),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: BorderSide.none,
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: BorderSide.none,
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: const BorderSide(color: _green, width: 1.5),
          ),
        ),
        onChanged: (v) {
          setState(() {});
          _updateSuggestions(v);
          if (v.isEmpty) _loadProducts(reset: true);
        },
      ),
    );
  }

  Widget _activeFilterChips() {
    final chips = <Widget>[];
    if (_selectedCategoryName != null) {
      chips.add(
        _filterChip(_selectedCategoryName!, () {
          setState(() {
            _selectedCategoryId = null;
            _selectedCategoryName = null;
          });
          _loadProducts(reset: true);
        }),
      );
    }
    if (_selectedBrandName != null) {
      chips.add(
        _filterChip(_selectedBrandName!, () {
          setState(() {
            _selectedBrandId = null;
            _selectedBrandName = null;
          });
          _loadProducts(reset: true);
        }),
      );
    }
    if (_minPrice != null || _maxPrice != null) {
      final label =
          '₹${_minPrice?.toStringAsFixed(0) ?? '0'} – ₹${_maxPrice?.toStringAsFixed(0) ?? '∞'}';
      chips.add(
        _filterChip(label, () {
          setState(() {
            _minPrice = null;
            _maxPrice = null;
          });
          _loadProducts(reset: true);
        }),
      );
    }
    if (_sort != 'newest') {
      final sortLabels = {
        'price_asc': 'Price ↑',
        'price_desc': 'Price ↓',
        'name_asc': 'A–Z',
      };
      chips.add(
        _filterChip(sortLabels[_sort] ?? _sort, () {
          setState(() => _sort = 'newest');
          _loadProducts(reset: true);
        }),
      );
    }
    return Container(
      color: Colors.white,
      height: 40,
      child: ListView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.fromLTRB(12, 4, 12, 4),
        children: chips,
      ),
    );
  }

  Widget _filterChip(String label, VoidCallback onRemove) {
    return Container(
      margin: const EdgeInsets.only(right: 8),
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: const Color(0xFFDCFCE7),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFF86EFAC)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            label,
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: _green,
            ),
          ),
          const SizedBox(width: 4),
          GestureDetector(
            onTap: onRemove,
            child: const Icon(Icons.close_rounded, size: 14, color: _green),
          ),
        ],
      ),
    );
  }

  // ── Category chips row ─────────────────────────────────────────────────────
  Widget _categoryChipsRow() {
    return Container(
      color: Colors.white,
      padding: const EdgeInsets.only(bottom: 6),
      child: SizedBox(
        height: 98,
        child: ListView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.fromLTRB(12, 8, 12, 4),
          children: [
            _catChip(
              id: null,
              name: 'All',
              imageUrl: null,
              selected: _selectedCategoryId == null && _selectedBrandId == null,
              onTap: () {
                setState(() {
                  _selectedCategoryId = null;
                  _selectedCategoryName = null;
                  _selectedBrandId = null;
                  _selectedBrandName = null;
                });
                _loadProducts(reset: true);
              },
            ),
            ..._categories.map(
              (c) => _catChip(
                id: c['id']?.toString(),
                name: c['name']?.toString() ?? '',
                imageUrl: _imgUrl(c['category_url']),
                selected: _selectedCategoryId == c['id']?.toString(),
                onTap: () {
                  final id = c['id']?.toString();
                  final name = c['name']?.toString() ?? '';
                  setState(() {
                    _selectedCategoryId = id;
                    _selectedCategoryName = name;
                    _selectedBrandId = null;
                    _selectedBrandName = null;
                    _searchCtrl.clear();
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

  Widget _catChip({
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
              width: 56,
              height: 56,
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
                    ? Center(
                        child: Icon(
                          Icons.apps_rounded,
                          color: selected ? _green : const Color(0xFF94A3B8),
                          size: 22,
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
                            size: 22,
                          ),
                        ),
                      )
                    : Center(
                        child: Icon(
                          Icons.checkroom_outlined,
                          color: selected ? _green : const Color(0xFF94A3B8),
                          size: 22,
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

  Widget _body() {
    if (_isLoading && _products.isEmpty) {
      return const Center(child: BfSpinner());
    }
    if (_products.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(
              Icons.search_off_rounded,
              size: 64,
              color: Color(0xFFCBD5E1),
            ),
            const SizedBox(height: 12),
            const Text(
              'No products found',
              style: TextStyle(
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
                  _selectedCategoryId = null;
                  _selectedCategoryName = null;
                  _selectedBrandId = null;
                  _selectedBrandName = null;
                  _sort = 'newest';
                  _minPrice = null;
                  _maxPrice = null;
                });
                _loadProducts(reset: true);
              },
              child: const Text(
                'Clear filters',
                style: TextStyle(color: _green),
              ),
            ),
          ],
        ),
      );
    }
    return GridView.builder(
      controller: _scrollCtrl,
      padding: const EdgeInsets.all(12),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        childAspectRatio: 0.62,
        crossAxisSpacing: 10,
        mainAxisSpacing: 10,
      ),
      itemCount: _products.length + (_hasMore ? 1 : 0),
      itemBuilder: (_, i) {
        if (i == _products.length) {
          return const Center(
            child: Padding(padding: EdgeInsets.all(16), child: BfSpinner()),
          );
        }
        return _productCard(_products[i]);
      },
    );
  }

  Widget _productCard(Map<String, dynamic> item) {
    final name = item['name']?.toString() ?? '';
    final brand = item['brand']?.toString() ?? '';
    final price = _fmt(item['discount_price'] ?? item['price']);
    final origPrice = _fmt(item['price']);
    final img = _imgUrl(item['image']);
    final color = item['color']?.toString() ?? '';
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
                            fadeInDuration: const Duration(milliseconds: 200),
                            placeholder: (_, _) =>
                                Container(color: const Color(0xFFF1F5F9)),
                            errorWidget: (_, _, _) => Container(
                              color: const Color(0xFFF1F5F9),
                              child: const Center(
                                child: Icon(
                                  Icons.checkroom_outlined,
                                  color: Color(0xFFCBD5E1),
                                  size: 36,
                                ),
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
                  else if (!item.containsKey('is_try_and_buy') ||
                      item['is_try_and_buy'] != true)
                    Positioned(
                      top: 8,
                      left: 8,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 4,
                        ),
                        decoration: BoxDecoration(
                          color: const Color(0xFF16A34A),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: const Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text('⚡', style: TextStyle(fontSize: 7, height: 1)),
                            SizedBox(width: 3),
                            Text(
                              '+ 60 MIN',
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
                  if (color.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(top: 4),
                      child: Text(
                        color,
                        style: const TextStyle(
                          fontSize: 12,
                          color: Color(0xFF64748B),
                        ),
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

// ── Filter Sheet ──────────────────────────────────────────────────────────────
class _FilterSheet extends StatefulWidget {
  final List<Map<String, dynamic>> categories;
  final List<Map<String, dynamic>> brands;
  final String? tempCatId;
  final String? tempCatName;
  final String? tempBrandId;
  final String? tempBrandName;
  final String tempSort;
  final TextEditingController minCtrl;
  final TextEditingController maxCtrl;
  final Function(
    String? catId,
    String? catName,
    String? brandId,
    String? brandName,
    String sort,
    double? minP,
    double? maxP,
  )
  onApply;
  final VoidCallback onClear;

  const _FilterSheet({
    required this.categories,
    required this.brands,
    required this.tempCatId,
    required this.tempCatName,
    required this.tempBrandId,
    required this.tempBrandName,
    required this.tempSort,
    required this.minCtrl,
    required this.maxCtrl,
    required this.onApply,
    required this.onClear,
  });

  @override
  State<_FilterSheet> createState() => _FilterSheetState();
}

class _FilterSheetState extends State<_FilterSheet> {
  static const Color _green = Color(0xFF16A34A);
  late String? _catId;
  late String? _catName;
  late String? _brandId;
  late String? _brandName;
  late String _sort;

  final _sortOptions = const [
    {'value': 'newest', 'label': 'Newest First'},
    {'value': 'price_asc', 'label': 'Price: Low to High'},
    {'value': 'price_desc', 'label': 'Price: High to Low'},
    {'value': 'name_asc', 'label': 'Name: A–Z'},
  ];

  @override
  void initState() {
    super.initState();
    _catId = widget.tempCatId;
    _catName = widget.tempCatName;
    _brandId = widget.tempBrandId;
    _brandName = widget.tempBrandName;
    _sort = widget.tempSort;
  }

  @override
  Widget build(BuildContext context) {
    return DraggableScrollableSheet(
      initialChildSize: 0.85,
      maxChildSize: 0.95,
      minChildSize: 0.5,
      expand: false,
      builder: (_, ctrl) => Column(
        children: [
          // Handle
          Container(
            margin: const EdgeInsets.symmetric(vertical: 10),
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: const Color(0xFFCBD5E1),
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          // Header
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 12),
            child: Row(
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
                    Navigator.pop(context);
                    widget.onClear();
                  },
                  child: const Text(
                    'Clear All',
                    style: TextStyle(
                      color: Color(0xFFDC2626),
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const Divider(height: 1),
          Expanded(
            child: ListView(
              controller: ctrl,
              padding: const EdgeInsets.all(20),
              children: [
                // Sort
                _sectionTitle('SORT BY'),
                const SizedBox(height: 10),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: _sortOptions.map((o) {
                    final selected = _sort == o['value'];
                    return GestureDetector(
                      onTap: () => setState(() => _sort = o['value']!),
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 14,
                          vertical: 8,
                        ),
                        decoration: BoxDecoration(
                          color: selected ? _green : const Color(0xFFF1F5F9),
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(
                            color: selected ? _green : const Color(0xFFE2E8F0),
                          ),
                        ),
                        child: Text(
                          o['label']!,
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: selected
                                ? Colors.white
                                : const Color(0xFF374151),
                          ),
                        ),
                      ),
                    );
                  }).toList(),
                ),
                const SizedBox(height: 20),

                // Category
                _sectionTitle('CATEGORY'),
                const SizedBox(height: 10),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: widget.categories.map((c) {
                    final selected = _catId == c['id'];
                    return GestureDetector(
                      onTap: () => setState(() {
                        if (selected) {
                          _catId = null;
                          _catName = null;
                        } else {
                          _catId = c['id']?.toString();
                          _catName = c['name']?.toString();
                        }
                      }),
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 14,
                          vertical: 8,
                        ),
                        decoration: BoxDecoration(
                          color: selected ? _green : const Color(0xFFF1F5F9),
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(
                            color: selected ? _green : const Color(0xFFE2E8F0),
                          ),
                        ),
                        child: Text(
                          c['name']?.toString() ?? '',
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: selected
                                ? Colors.white
                                : const Color(0xFF374151),
                          ),
                        ),
                      ),
                    );
                  }).toList(),
                ),
                const SizedBox(height: 20),

                // Brand
                _sectionTitle('BRAND'),
                const SizedBox(height: 10),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: widget.brands.take(20).map((b) {
                    final selected = _brandId == b['id'];
                    return GestureDetector(
                      onTap: () => setState(() {
                        if (selected) {
                          _brandId = null;
                          _brandName = null;
                        } else {
                          _brandId = b['id']?.toString();
                          _brandName = b['name']?.toString();
                        }
                      }),
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 14,
                          vertical: 8,
                        ),
                        decoration: BoxDecoration(
                          color: selected ? _green : const Color(0xFFF1F5F9),
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(
                            color: selected ? _green : const Color(0xFFE2E8F0),
                          ),
                        ),
                        child: Text(
                          b['name']?.toString() ?? '',
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: selected
                                ? Colors.white
                                : const Color(0xFF374151),
                          ),
                        ),
                      ),
                    );
                  }).toList(),
                ),
                const SizedBox(height: 20),

                // Price Range
                _sectionTitle('PRICE RANGE'),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: widget.minCtrl,
                        keyboardType: TextInputType.number,
                        decoration: _priceInputDecoration('Min ₹'),
                      ),
                    ),
                    const Padding(
                      padding: EdgeInsets.symmetric(horizontal: 10),
                      child: Text(
                        '–',
                        style: TextStyle(
                          fontSize: 18,
                          color: Color(0xFF94A3B8),
                        ),
                      ),
                    ),
                    Expanded(
                      child: TextField(
                        controller: widget.maxCtrl,
                        keyboardType: TextInputType.number,
                        decoration: _priceInputDecoration('Max ₹'),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 30),
              ],
            ),
          ),
          // Apply button
          Padding(
            padding: EdgeInsets.fromLTRB(
              20,
              8,
              20,
              MediaQuery.of(context).padding.bottom + 16,
            ),
            child: SizedBox(
              width: double.infinity,
              height: 50,
              child: ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: _green,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                  ),
                  elevation: 0,
                ),
                onPressed: () {
                  final minP = double.tryParse(widget.minCtrl.text);
                  final maxP = double.tryParse(widget.maxCtrl.text);
                  Navigator.pop(context);
                  widget.onApply(
                    _catId,
                    _catName,
                    _brandId,
                    _brandName,
                    _sort,
                    minP,
                    maxP,
                  );
                },
                child: const Text(
                  'Apply Filters',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _sectionTitle(String t) => Text(
    t,
    style: const TextStyle(
      fontSize: 11,
      fontWeight: FontWeight.w800,
      color: Color(0xFF94A3B8),
      letterSpacing: 0.8,
    ),
  );

  InputDecoration _priceInputDecoration(String hint) => InputDecoration(
    hintText: hint,
    hintStyle: const TextStyle(color: Color(0xFF94A3B8), fontSize: 13),
    filled: true,
    fillColor: const Color(0xFFF1F5F9),
    contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
    border: OutlineInputBorder(
      borderRadius: BorderRadius.circular(10),
      borderSide: BorderSide.none,
    ),
    enabledBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(10),
      borderSide: BorderSide.none,
    ),
    focusedBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(10),
      borderSide: const BorderSide(color: _green),
    ),
  );
}
