import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:geocoding/geocoding.dart';
import 'package:geolocator/geolocator.dart';

import '../api_base.dart';
import '../services/api_client.dart';
import '../services/cart_manager.dart';
import '../services/user_session.dart';
import '../services/notification_service.dart';
import '../services/wishlist_manager.dart';
import 'all_brands_screen.dart';
import 'all_products_screen.dart';
import 'category_landing_screen.dart';
import 'cart_screen.dart';
import 'login_screen.dart';
import 'orders_screen.dart';
import 'refer_earn_screen.dart';
import 'old_clothes_screen.dart';
import 'policies_screen.dart';
import 'product_detail_screen.dart';
import 'wishlist_screen.dart';
import 'address_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});
  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen>
    with SingleTickerProviderStateMixin {
  final ApiClient _api = ApiClient();
  int _tab = 0;

  bool _isLoading = true;
  bool _outOfServiceArea = false; // true when nearest store > 15 km
  String _currentLocation = 'Bhubaneswar';
  String? _nearestStoreName;

  List<Map<String, dynamic>> _products = const [];
  List<Map<String, dynamic>> _categories = const []; // root only
  List<Map<String, dynamic>> _allCategories = const []; // full tree
  List<Map<String, dynamic>> _brands = const [];
  List<Map<String, dynamic>> _bestsellers = const [];
  List<Map<String, dynamic>> _under999 = const [];
  List<Map<String, dynamic>> _under1999 = const [];
  List<Map<String, dynamic>> _above1999 = const [];
  List<Map<String, dynamic>> _bulkOffers = const [];

  // Categories tab: index of selected root category
  int _catSelectedIndex = 0;
  // Drawer: expanded state per root category id
  final Map<String, bool> _drawerExpandedCats = {};

  static const Color _green = Color(0xFF16A34A);

  static const List<Map<String, String>> _fallbackCategories = [
    {'name': 'WOMEN'},
    {'name': 'MEN'},
    {'name': 'KIDS'},
    {'name': 'BEAUTY'},
    {'name': 'HOME LIVING'},
  ];

  @override
  void initState() {
    super.initState();
    _loadHomeData();
    _tryLoadLocationSilently();
  }

  Future<void> _loadHomeData({double? lat, double? lng}) async {
    setState(() {
      _isLoading = true;
    });
    try {
      // Fetch products first so ApiClient.currentStoreId is set before
      // bestsellers (and any other store-filtered calls) are fired.
      final storeResult = await _api.fetchProductsWithStore(lat: lat, lng: lng);
      if (!mounted) return;

      final results = await Future.wait([
        _api.fetchCategories(),
        _api.fetchBrands(),
        _api.fetchBestsellers(),
        _api.fetchProductsByPriceRange(minPrice: 0, maxPrice: 999, limit: 10),
        _api.fetchProductsByPriceRange(minPrice: 0, maxPrice: 1999, limit: 10),
        _api.fetchProductsByPriceRange(
          minPrice: 1999,
          maxPrice: 999999,
          limit: 10,
        ),
        _api.fetchBulkOffers(limit: 10),
      ]);
      if (!mounted) return;
      final cats = results[0];
      final brs = results[1];
      final bests = results[2];
      final under999 = results[3];
      final under1999 = results[4];
      final above1999 = results[5];
      final bulkOffers = results[6];

      // Check 15 km service radius
      final nearestStore = storeResult['nearestStore'] as Map?;
      final locationProvided =
          storeResult['locationProvided'] == true ||
          (lat != null && lng != null);
      final distKm = nearestStore?['dist'] as num?;
      final outOfArea =
          locationProvided &&
          (nearestStore == null || (distKm != null && distKm > 15));

      setState(() {
        _outOfServiceArea = outOfArea;
        _products = (storeResult['products'] as List? ?? [])
            .whereType<Map<String, dynamic>>()
            .take(8)
            .toList();
        _nearestStoreName = nearestStore?['name']?.toString();
        _categories = cats
            .whereType<Map<String, dynamic>>()
            .where((c) => c['parent_id'] == null)
            .take(6)
            .toList();
        _allCategories = cats.whereType<Map<String, dynamic>>().toList();
        _brands = brs.whereType<Map<String, dynamic>>().take(8).toList();
        _bestsellers = bests.whereType<Map<String, dynamic>>().toList();
        _under999 = under999.whereType<Map<String, dynamic>>().toList();
        _under1999 = under1999.whereType<Map<String, dynamic>>().toList();
        _above1999 = above1999.whereType<Map<String, dynamic>>().toList();
        _bulkOffers = bulkOffers.whereType<Map<String, dynamic>>().toList();
        _isLoading = false;
      });
    } catch (_) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _tryLoadLocationSilently() async {
    try {
      final serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) return;
      final permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.whileInUse ||
          permission == LocationPermission.always) {
        await _detectCurrentLocation();
      }
    } catch (_) {}
  }

  Future<void> _requestAndDetectCurrentLocation() async {
    try {
      final serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        _snack('Please turn on location services.');
        return;
      }
      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.denied ||
          permission == LocationPermission.deniedForever) {
        _snack('Location permission denied.');
        return;
      }
      await _detectCurrentLocation();
    } catch (_) {
      _snack('Unable to fetch current location.');
    } finally {
      // location detection complete
    }
  }

  Future<void> _detectCurrentLocation() async {
    try {
      final pos = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.low,
        timeLimit: const Duration(seconds: 6),
      );
      final placemarks = await placemarkFromCoordinates(
        pos.latitude,
        pos.longitude,
      );
      if (!mounted || placemarks.isEmpty) return;
      final place = placemarks.first;
      final city =
          [
                place.locality,
                place.subLocality,
                place.subAdministrativeArea,
                place.administrativeArea,
              ]
              .map((v) => (v ?? '').trim())
              .firstWhere((v) => v.isNotEmpty, orElse: () => '');
      if (city.isNotEmpty) {
        setState(() {
          _currentLocation = city;
        });
        _loadHomeData(lat: pos.latitude, lng: pos.longitude);
      }
    } catch (_) {}
  }

  Future<void> _openLocationPicker() async {
    final userId = UserSession.instance.userId;
    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) => _LocationSheet(
        api: _api,
        userId: userId,
        onCurrentLocation: () {
          Navigator.pop(ctx);
          _requestAndDetectCurrentLocation();
        },
        onAddressSelected: (address) {
          Navigator.pop(ctx);
          _selectAddress(address);
        },
      ),
    );
  }

  void _selectAddress(Map<String, dynamic> addr) {
    final lat = double.tryParse((addr['lat'] ?? '').toString());
    final lng = double.tryParse((addr['lng'] ?? '').toString());
    if (lat == null || lng == null) return;
    ApiClient.currentStoreId = null; // will be refreshed by _loadHomeData
    final city = (addr['city'] ?? '').toString().trim();
    final line = (addr['address_line'] ?? '').toString().trim();
    setState(() {
      _currentLocation = city.isNotEmpty
          ? city
          : (line.isNotEmpty ? line : 'Selected Location');
    });
    _loadHomeData(lat: lat, lng: lng);
  }

  void _snack(String msg) {
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
    }
  }

  String _fmt(dynamic v) {
    if (v == null) return '0';
    if (v is int) return v.toString();
    if (v is double) return v.round().toString();
    return (double.tryParse(v.toString()) ?? 0).round().toString();
  }

  String _offLabel(Map<String, dynamic> p) {
    final price = double.tryParse((p['price'] ?? '').toString());
    final disc = double.tryParse((p['discount_price'] ?? '').toString());
    if (price == null || disc == null || price <= disc) return 'Fresh Drop';
    return '${((price - disc) / price * 100).round()}% OFF';
  }

  String? _imgUrl(dynamic v) {
    final raw = (v ?? '').toString().trim();
    if (raw.isEmpty) return null;
    if (raw.startsWith('http')) return raw;
    if (raw.startsWith('/')) return '$apiBaseUrl$raw';
    return '$apiBaseUrl/$raw';
  }

  void _openProduct(Map<String, dynamic> item) {
    final id = item['id']?.toString() ?? '';
    if (id.isEmpty) return;
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => ProductDetailScreen(
          productId: id,
          initialName: item['name']?.toString(),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: _buildAppBar(),
      body: IndexedStack(
        index: _tab,
        children: [
          _homeBody(),
          _categoriesBody(),
          const OrdersScreen(),
          const WishlistScreen(),
          _profileBody(),
        ],
      ),
      drawer: _buildDrawer(),
      bottomNavigationBar: BottomNavigationBar(
        type: BottomNavigationBarType.fixed,
        selectedItemColor: _green,
        unselectedItemColor: const Color(0xFF94A3B8),
        selectedLabelStyle: const TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w600,
        ),
        unselectedLabelStyle: const TextStyle(fontSize: 11),
        backgroundColor: Colors.white,
        elevation: 12,
        currentIndex: _tab,
        onTap: (i) => setState(() => _tab = i),
        items: const [
          BottomNavigationBarItem(
            icon: Icon(Icons.home_outlined),
            activeIcon: Icon(Icons.home_rounded),
            label: 'Home',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.grid_view_outlined),
            activeIcon: Icon(Icons.grid_view_rounded),
            label: 'Categories',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.receipt_long_outlined),
            activeIcon: Icon(Icons.receipt_long_rounded),
            label: 'Orders',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.favorite_border_rounded),
            activeIcon: Icon(Icons.favorite_rounded),
            label: 'Wishlist',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.person_outline_rounded),
            activeIcon: Icon(Icons.person_rounded),
            label: 'Profile',
          ),
        ],
      ),
    );
  }

  PreferredSizeWidget _buildAppBar() {
    return AppBar(
      backgroundColor: Colors.white,
      elevation: 0,
      surfaceTintColor: Colors.white,
      titleSpacing: 0,
      toolbarHeight: 60,
      leading: Padding(
        padding: const EdgeInsets.only(left: 12),
        child: Builder(
          builder: (ctx) => IconButton(
            icon: const Icon(Icons.menu_rounded, color: Color(0xFF0F172A)),
            onPressed: () => Scaffold.of(ctx).openDrawer(),
          ),
        ),
      ),
      title: Row(
        children: [
          Image.asset('assets/images/logo.png', width: 32, height: 32),
          const SizedBox(width: 6),
          Flexible(
            child: RichText(
              overflow: TextOverflow.ellipsis,
              text: const TextSpan(
                style: TextStyle(
                  fontFamily: 'Montserrat',
                  fontWeight: FontWeight.w900,
                  fontSize: 20,
                  letterSpacing: 0,
                ),
                children: [
                  TextSpan(
                    text: 'BLINKIE',
                    style: TextStyle(color: Color(0xFF0F172A)),
                  ),
                  TextSpan(
                    text: 'FASH',
                    style: TextStyle(color: _green),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
      actions: [
        IconButton(
          icon: const Icon(Icons.search_rounded, color: Color(0xFF374151)),
          onPressed: () => Navigator.of(
            context,
          ).push(MaterialPageRoute(builder: (_) => const AllProductsScreen())),
        ),
        IconButton(
          icon: const Icon(
            Icons.favorite_border_rounded,
            color: Color(0xFF374151),
          ),
          onPressed: () => Navigator.of(
            context,
          ).push(MaterialPageRoute(builder: (_) => const WishlistScreen())),
        ),
        ValueListenableBuilder<int>(
          valueListenable: CartManager.instance.countNotifier,
          builder: (context, count, child) => Stack(
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
        const SizedBox(width: 4),
      ],
    );
  }

  // ── HOME BODY ───────────────────────────────────────────────────────────────
  Widget _homeBody() {
    return RefreshIndicator(
      color: _green,
      onRefresh: () => _loadHomeData(),
      child: ListView(
        padding: EdgeInsets.zero,
        children: [
          if (_isLoading)
            const LinearProgressIndicator(
              minHeight: 3,
              color: _green,
              backgroundColor: Colors.transparent,
            ),
          _locationBar(),
          if (_outOfServiceArea) ...[
            _serviceAreaGate(),
          ] else ...[
            _heroBanner(),
            _featuresRow(),
            _sectionHeader(
              'EXPLORE',
              actionLabel: 'View All',
              onAction: () => setState(() => _tab = 1),
            ),
            _exploreCategories(),
            _sectionHeader(
              'TRENDING NOW',
              actionLabel: 'View All',
              onAction: () => Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const AllProductsScreen()),
              ),
            ),
            _products.isNotEmpty ? _trendingHorizontal() : _stockOutBanner(),
            _sectionHeader(
              'BESTSELLERS',
              actionLabel: 'View All',
              onAction: () => Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const AllProductsScreen()),
              ),
            ),
            _bestsellers.isNotEmpty
                ? _bestsellerProductCards()
                : _stockOutBanner(),
            _sectionHeader(
              'UNDER ₹999',
              actionLabel: 'View All',
              onAction: () => Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const AllProductsScreen()),
              ),
            ),
            _under999.isNotEmpty ? _under999Cards() : _stockOutBanner(),
            _sectionHeader(
              'UNDER ₹1999',
              actionLabel: 'View All',
              onAction: () => Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const AllProductsScreen()),
              ),
            ),
            _under1999.isNotEmpty ? _under1999Cards() : _stockOutBanner(),
            _sectionHeader(
              'ABOVE ₹1999',
              actionLabel: 'View All',
              onAction: () => Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const AllProductsScreen()),
              ),
            ),
            _above1999.isNotEmpty ? _above1999Cards() : _stockOutBanner(),
            _sectionHeader(
              'SPECIAL BULK OFFERS',
              actionLabel: 'View All',
              onAction: () => Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const AllProductsScreen()),
              ),
            ),
            _bulkOffers.isNotEmpty ? _bulkOffersCards() : _stockOutBanner(),
            _sectionHeader(
              'TOP BRANDS',
              actionLabel: 'View All',
              onAction: () => Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const AllBrandsScreen()),
              ),
            ),
            _topBrands(),
            _trustBadges(),
            _newsletterStrip(),
            _downloadBanner(),
            const SizedBox(height: 24),
          ], // end else (in service area)
        ],
      ),
    );
  }

  // ── Service area gate ─────────────────────────────────────────────────────
  Widget _serviceAreaGate() {
    return SizedBox(
      height: MediaQuery.of(context).size.height * 0.72,
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            width: 110,
            height: 110,
            decoration: BoxDecoration(
              color: const Color(0xFFECFDF5),
              shape: BoxShape.circle,
              border: Border.all(color: const Color(0xFF86EFAC), width: 2),
            ),
            child: const Icon(
              Icons.location_off_outlined,
              size: 52,
              color: Color(0xFF16A34A),
            ),
          ),
          const SizedBox(height: 28),
          const Text(
            "Oops! We Haven't\nReached You Yet 🛍️",
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.w800,
              color: Color(0xFF0F172A),
              height: 1.3,
            ),
          ),
          const SizedBox(height: 12),
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 40),
            child: Text(
              "BlinkieFash isn't available at your location yet.\nWe're expanding fast — stay tuned!",
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 14,
                color: Color(0xFF64748B),
                height: 1.6,
              ),
            ),
          ),
          const SizedBox(height: 32),
          FilledButton.icon(
            onPressed: () {
              setState(() => _outOfServiceArea = false);
              _loadHomeData();
            },
            icon: const Icon(Icons.refresh_rounded, size: 18),
            label: const Text(
              'Try Again',
              style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
            ),
            style: FilledButton.styleFrom(
              backgroundColor: const Color(0xFF16A34A),
              minimumSize: const Size(160, 48),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(14),
              ),
            ),
          ),
          const SizedBox(height: 14),
          TextButton(
            onPressed: () {
              ApiClient.currentStoreId = null; // clear store filter
              setState(() {
                _outOfServiceArea = false;
                _currentLocation = 'Bhubaneswar';
              });
              _loadHomeData();
            },
            child: const Text(
              'Browse without location',
              style: TextStyle(
                color: Color(0xFF16A34A),
                fontWeight: FontWeight.w600,
                fontSize: 13,
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ── Location bar ──────────────────────────────────────────────────────────
  Widget _locationBar() {
    return Container(
      margin: const EdgeInsets.fromLTRB(12, 12, 12, 0),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE5E7EB)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x0A000000),
            blurRadius: 8,
            offset: Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        children: [
          Expanded(
            child: GestureDetector(
              onTap: _openLocationPicker,
              child: Row(
                children: [
                  const Icon(
                    Icons.location_on_outlined,
                    color: _green,
                    size: 20,
                  ),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Deliver in 60 mins to',
                          style: TextStyle(
                            fontSize: 11,
                            color: Color(0xFF64748B),
                          ),
                        ),
                        Row(
                          children: [
                            Flexible(
                              child: Text(
                                _currentLocation,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                  fontSize: 15,
                                  fontWeight: FontWeight.w700,
                                  color: Color(0xFF0F172A),
                                ),
                              ),
                            ),
                            const Icon(
                              Icons.keyboard_arrow_down_rounded,
                              size: 18,
                              color: _green,
                            ),
                          ],
                        ),
                        if (_nearestStoreName != null)
                          Text(
                            'From: $_nearestStoreName',
                            style: const TextStyle(fontSize: 11, color: _green),
                            overflow: TextOverflow.ellipsis,
                          ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(
              color: const Color(0xFFDCFCE7),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: const Color(0xFFBBF7D0)),
            ),
            child: const Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.timer_outlined, color: _green, size: 14),
                SizedBox(width: 4),
                Text(
                  '60 MIN DELIVERY',
                  style: TextStyle(
                    color: _green,
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // ── Hero Banner ───────────────────────────────────────────────────────────
  Widget _heroBanner() {
    return GestureDetector(
      onTap: () => Navigator.of(
        context,
      ).push(MaterialPageRoute(builder: (_) => const AllProductsScreen())),
      child: Container(
        margin: const EdgeInsets.fromLTRB(12, 12, 12, 0),
        height: 180,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(20),
          boxShadow: const [
            BoxShadow(
              color: Color(0x20000000),
              blurRadius: 12,
              offset: Offset(0, 4),
            ),
          ],
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(20),
          child: Image.asset('assets/images/hero.png', fit: BoxFit.cover),
        ),
      ),
    );
  }

  // ── Features Row ─────────────────────────────────────────────────────────
  Widget _featuresRow() {
    const items = [
      {'icon': Icons.bolt_outlined, 'label': '60 MINUTE\nDELIVERY'},
      {'icon': Icons.checkroom_outlined, 'label': 'TRENDY\nFASHION'},
      {'icon': Icons.home_outlined, 'label': 'TRY & BUY\nAT HOME'},
      {'icon': Icons.replay_outlined, 'label': 'EASY\nRETURNS'},
    ];
    return Container(
      margin: const EdgeInsets.fromLTRB(12, 14, 12, 0),
      padding: const EdgeInsets.symmetric(vertical: 14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: const [
          BoxShadow(
            color: Color(0x0A000000),
            blurRadius: 6,
            offset: Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        children: items
            .map(
              (f) => Expanded(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(f['icon'] as IconData, size: 26, color: _green),
                    const SizedBox(height: 6),
                    Text(
                      f['label']! as String,
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF374151),
                        height: 1.3,
                      ),
                    ),
                  ],
                ),
              ),
            )
            .toList(),
      ),
    );
  }

  // ── Section Header ────────────────────────────────────────────────────────
  Widget _sectionHeader(
    String title, {
    String? actionLabel,
    VoidCallback? onAction,
  }) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 20, 16, 10),
      child: Row(
        children: [
          Expanded(
            child: Text(
              title,
              style: const TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w800,
                color: Color(0xFF0F172A),
                letterSpacing: 0.3,
              ),
            ),
          ),
          if (actionLabel != null)
            GestureDetector(
              onTap: onAction,
              child: Row(
                children: [
                  Text(
                    actionLabel,
                    style: const TextStyle(
                      fontSize: 13,
                      color: _green,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const Icon(
                    Icons.chevron_right_rounded,
                    color: _green,
                    size: 18,
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }

  // ── Explore Categories ────────────────────────────────────────────────────
  Widget _exploreCategories() {
    final cats = _categories.isNotEmpty
        ? _categories
        : _fallbackCategories
              .map(
                (m) => <String, dynamic>{
                  'name': m['name'],
                  '_localImage': m['image'],
                },
              )
              .toList();

    final items = <Map<String, dynamic>>[...cats];

    return SizedBox(
      height: 105,
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 12),
        itemCount: items.length,
        itemBuilder: (_, i) {
          final item = items[i];
          final localImg = item['_localImage'] as String?;
          final netImg = _imgUrl(item['category_url'] ?? item['image']);
          return GestureDetector(
            onTap: () {
              String? catId = item['id']?.toString();
              final catName = item['name']?.toString() ?? '';
              // If using fallback items (no id), try to match from loaded data
              if (catId == null && catName.isNotEmpty) {
                final match = _allCategories.firstWhere(
                  (c) =>
                      (c['name']?.toString() ?? '').toUpperCase() ==
                          catName.toUpperCase() &&
                      c['parent_id'] == null,
                  orElse: () => <String, dynamic>{},
                );
                catId = match['id']?.toString();
              }
              if (catId != null) {
                Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) => CategoryLandingScreen(
                      categoryId: catId!,
                      categoryName: catName,
                    ),
                  ),
                );
              } else {
                Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) => AllProductsScreen(categoryName: catName),
                  ),
                );
              }
            },
            child: Container(
              width: 72,
              margin: const EdgeInsets.only(right: 10),
              child: Column(
                children: [
                  Container(
                    width: 64,
                    height: 64,
                    decoration: BoxDecoration(
                      color: const Color(0xFFDCFCE7),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: const Color(0xFFBBF7D0)),
                    ),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(15),
                      child: localImg != null
                          ? Image.asset(localImg, fit: BoxFit.cover)
                          : netImg != null
                          ? CachedNetworkImage(
                              imageUrl: netImg,
                              fit: BoxFit.cover,
                              errorWidget: (context, url, error) => const Icon(
                                Icons.category_outlined,
                                color: _green,
                              ),
                            )
                          : const Icon(Icons.category_outlined, color: _green),
                    ),
                  ),
                  const SizedBox(height: 5),
                  Text(
                    item['name']?.toString() ?? '',
                    textAlign: TextAlign.center,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF374151),
                      height: 1.2,
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  // ── Stock-out empty state ─────────────────────────────────────────────────
  Widget _stockOutBanner() {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      padding: const EdgeInsets.symmetric(vertical: 28, horizontal: 20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x08000000),
            blurRadius: 8,
            offset: Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: const Color(0xFFFFF7ED),
              borderRadius: BorderRadius.circular(14),
            ),
            child: const Icon(
              Icons.inventory_2_outlined,
              color: Color(0xFFF97316),
              size: 28,
            ),
          ),
          const SizedBox(width: 16),
          const Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Sorry, Stock Out!',
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                    color: Color(0xFF0F172A),
                  ),
                ),
                SizedBox(height: 4),
                Text(
                  'No products available at this location right now. Check back soon!',
                  style: TextStyle(
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
    );
  }

  // ── Trending Grid ─────────────────────────────────────────────────────────
  Widget _trendingHorizontal() {
    final items = <Map<String, dynamic>>[..._products];
    return SizedBox(
      height: 300,
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 12),
        itemCount: items.length,
        itemBuilder: (_, i) {
          final item = items[i];
          final name = item['name']?.toString() ?? 'Product';
          final brand = item['brand']?.toString() ?? '';
          final price = _fmt(item['discount_price'] ?? item['price']);
          final origP = _fmt(item['price']);
          final off = item['off']?.toString() ?? _offLabel(item);
          final img = _imgUrl(item['image']);

          return GestureDetector(
            onTap: item['id'] != null ? () => _openProduct(item) : null,
            child: Container(
              width: 160,
              margin: const EdgeInsets.only(right: 12),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(18),
                boxShadow: const [
                  BoxShadow(
                    color: Color(0x0F000000),
                    blurRadius: 12,
                    offset: Offset(0, 4),
                  ),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    flex: 3,
                    child: Stack(
                      children: [
                        ClipRRect(
                          borderRadius: const BorderRadius.vertical(
                            top: Radius.circular(18),
                          ),
                          child: img != null
                              ? CachedNetworkImage(
                                  imageUrl: img,
                                  fit: BoxFit.cover,
                                  width: double.infinity,
                                  height: double.infinity,
                                  placeholder: (context, url) =>
                                      Container(color: const Color(0xFFF1F5F9)),
                                  errorWidget: (context, url, error) =>
                                      Container(
                                        color: const Color(0xFFF1F5F9),
                                        child: const Icon(
                                          Icons.image_not_supported_outlined,
                                          color: Color(0xFFCBD5E1),
                                        ),
                                      ),
                                )
                              : Container(
                                  color: const Color(0xFFF1F5F9),
                                  child: const Icon(
                                    Icons.checkroom_outlined,
                                    size: 40,
                                    color: Color(0xFFCBD5E1),
                                  ),
                                ),
                        ),
                        Positioned(
                          top: 8,
                          left: 8,
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              // Primary label: Bestseller or Try and Buy
                              if (item['is_bestseller'] == true)
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 7,
                                    vertical: 4,
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
                                      letterSpacing: 0.3,
                                    ),
                                  ),
                                )
                              else if (item['is_try_and_buy'] == true)
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 7,
                                    vertical: 4,
                                  ),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFF7C3AED),
                                    borderRadius: BorderRadius.circular(6),
                                  ),
                                  child: const Text(
                                    'TRY & BUY',
                                    style: TextStyle(
                                      color: Colors.white,
                                      fontSize: 8,
                                      fontWeight: FontWeight.w800,
                                      letterSpacing: 0.3,
                                    ),
                                  ),
                                )
                              else
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 7,
                                    vertical: 4,
                                  ),
                                  decoration: BoxDecoration(
                                    color: _green,
                                    borderRadius: BorderRadius.circular(6),
                                  ),
                                  child: const Text(
                                    '+ 60 MIN',
                                    style: TextStyle(
                                      color: Colors.white,
                                      fontSize: 9,
                                      fontWeight: FontWeight.w800,
                                      letterSpacing: 0.3,
                                    ),
                                  ),
                                ),
                            ],
                          ),
                        ),
                        Positioned(
                          top: 7,
                          right: 7,
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
                              decoration: BoxDecoration(
                                color: Colors.white,
                                shape: BoxShape.circle,
                                boxShadow: const [
                                  BoxShadow(
                                    color: Color(0x18000000),
                                    blurRadius: 6,
                                  ),
                                ],
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
                  Expanded(
                    flex: 2,
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(10, 8, 10, 10),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          if (brand.isNotEmpty)
                            Text(
                              brand.toUpperCase(),
                              style: const TextStyle(
                                fontSize: 9,
                                fontWeight: FontWeight.w700,
                                color: Color(0xFF9CA3AF),
                                letterSpacing: 0.8,
                              ),
                            ),
                          const SizedBox(height: 2),
                          Text(
                            name,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF0F172A),
                              height: 1.2,
                            ),
                          ),
                          const Spacer(),
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.end,
                            children: [
                              Text(
                                '₹$price',
                                style: const TextStyle(
                                  fontSize: 14,
                                  fontWeight: FontWeight.w800,
                                  color: Color(0xFF0F172A),
                                ),
                              ),
                              if (origP.isNotEmpty && origP != price) ...[
                                const SizedBox(width: 4),
                                Text(
                                  '₹$origP',
                                  style: const TextStyle(
                                    fontSize: 10,
                                    color: Color(0xFF94A3B8),
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
                          const SizedBox(height: 4),
                          Text(
                            off,
                            style: const TextStyle(
                              fontSize: 10,
                              color: _green,
                              fontWeight: FontWeight.w700,
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
        },
      ),
    );
  }

  // ── Bestseller Product Cards ───────────────────────────────────────────────
  Widget _bestsellerProductCards() {
    final items = _bestsellers;
    return SizedBox(
      height: 300,
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 12),
        itemCount: items.length,
        itemBuilder: (_, i) {
          final item = items[i];
          final name = item['name']?.toString() ?? 'Product';
          final brand = item['brand']?.toString() ?? '';
          final price = _fmt(item['price'] ?? item['discount_price']);
          final origP = _fmt(item['original_price'] ?? item['price']);
          final off = _offLabel(item);
          final img = _imgUrl(item['image']);

          return GestureDetector(
            onTap: item['id'] != null ? () => _openProduct(item) : null,
            child: Container(
              width: 160,
              margin: const EdgeInsets.only(right: 12),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(18),
                boxShadow: const [
                  BoxShadow(
                    color: Color(0x0F000000),
                    blurRadius: 12,
                    offset: Offset(0, 4),
                  ),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    flex: 3,
                    child: Stack(
                      children: [
                        ClipRRect(
                          borderRadius: const BorderRadius.vertical(
                            top: Radius.circular(18),
                          ),
                          child: img != null
                              ? CachedNetworkImage(
                                  imageUrl: img,
                                  fit: BoxFit.cover,
                                  width: double.infinity,
                                  height: double.infinity,
                                  placeholder: (context, url) =>
                                      Container(color: const Color(0xFFF1F5F9)),
                                  errorWidget: (context, url, error) =>
                                      Container(
                                        color: const Color(0xFFF1F5F9),
                                        child: const Icon(
                                          Icons.image_not_supported_outlined,
                                          color: Color(0xFFCBD5E1),
                                        ),
                                      ),
                                )
                              : Container(
                                  color: const Color(0xFFF1F5F9),
                                  child: const Icon(
                                    Icons.checkroom_outlined,
                                    size: 40,
                                    color: Color(0xFFCBD5E1),
                                  ),
                                ),
                        ),
                        Positioned(
                          top: 8,
                          left: 8,
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              // Primary label: Bestseller or Try and Buy
                              if (item['is_bestseller'] == true)
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 7,
                                    vertical: 4,
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
                                      letterSpacing: 0.3,
                                    ),
                                  ),
                                )
                              else if (item['is_try_and_buy'] == true)
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 7,
                                    vertical: 4,
                                  ),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFF7C3AED),
                                    borderRadius: BorderRadius.circular(6),
                                  ),
                                  child: const Text(
                                    'TRY & BUY',
                                    style: TextStyle(
                                      color: Colors.white,
                                      fontSize: 8,
                                      fontWeight: FontWeight.w800,
                                      letterSpacing: 0.3,
                                    ),
                                  ),
                                )
                              else
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 7,
                                    vertical: 4,
                                  ),
                                  decoration: BoxDecoration(
                                    color: _green,
                                    borderRadius: BorderRadius.circular(6),
                                  ),
                                  child: const Text(
                                    '+ 60 MIN',
                                    style: TextStyle(
                                      color: Colors.white,
                                      fontSize: 9,
                                      fontWeight: FontWeight.w800,
                                      letterSpacing: 0.3,
                                    ),
                                  ),
                                ),
                            ],
                          ),
                        ),
                        Positioned(
                          top: 7,
                          right: 7,
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
                              decoration: BoxDecoration(
                                color: Colors.white,
                                shape: BoxShape.circle,
                                boxShadow: const [
                                  BoxShadow(
                                    color: Color(0x18000000),
                                    blurRadius: 6,
                                  ),
                                ],
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
                  Expanded(
                    flex: 2,
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(10, 8, 10, 10),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          if (brand.isNotEmpty)
                            Text(
                              brand.toUpperCase(),
                              style: const TextStyle(
                                fontSize: 9,
                                fontWeight: FontWeight.w700,
                                color: Color(0xFF9CA3AF),
                                letterSpacing: 0.8,
                              ),
                            ),
                          const SizedBox(height: 2),
                          Text(
                            name,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF0F172A),
                              height: 1.2,
                            ),
                          ),
                          const Spacer(),
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.end,
                            children: [
                              Text(
                                '₹$price',
                                style: const TextStyle(
                                  fontSize: 14,
                                  fontWeight: FontWeight.w800,
                                  color: Color(0xFF0F172A),
                                ),
                              ),
                              if (origP.isNotEmpty && origP != price) ...[
                                const SizedBox(width: 4),
                                Text(
                                  '₹$origP',
                                  style: const TextStyle(
                                    fontSize: 10,
                                    color: Color(0xFF94A3B8),
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
                          const SizedBox(height: 4),
                          Text(
                            off,
                            style: const TextStyle(
                              fontSize: 10,
                              color: _green,
                              fontWeight: FontWeight.w700,
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
        },
      ),
    );
  }

  // ── Products Under 999 ────────────────────────────────────────────────────
  Widget _under999Cards() {
    return _buildPriceRangeCards(_under999);
  }

  // ── Products Under 1999 ───────────────────────────────────────────────────
  Widget _under1999Cards() {
    return _buildPriceRangeCards(_under1999);
  }

  // ── Products Above 1999 ───────────────────────────────────────────────────
  Widget _above1999Cards() {
    return _buildPriceRangeCards(_above1999);
  }

  // ── Shared method for price range cards ────────────────────────────────────
  Widget _buildPriceRangeCards(List<Map<String, dynamic>> items) {
    return SizedBox(
      height: 300,
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 12),
        itemCount: items.length,
        itemBuilder: (_, i) {
          final item = items[i];
          final name = item['name']?.toString() ?? 'Product';
          final brand = item['brand']?.toString() ?? '';
          final price = _fmt(item['price'] ?? item['discount_price']);
          final origP = _fmt(item['original_price'] ?? item['price']);
          final img = _imgUrl(item['image']);

          return GestureDetector(
            onTap: item['id'] != null ? () => _openProduct(item) : null,
            child: Container(
              width: 160,
              margin: const EdgeInsets.only(right: 12),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(18),
                boxShadow: const [
                  BoxShadow(
                    color: Color(0x0F000000),
                    blurRadius: 12,
                    offset: Offset(0, 4),
                  ),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    flex: 3,
                    child: ClipRRect(
                      borderRadius: const BorderRadius.vertical(
                        top: Radius.circular(18),
                      ),
                      child: img != null
                          ? CachedNetworkImage(
                              imageUrl: img,
                              fit: BoxFit.cover,
                              width: double.infinity,
                              height: double.infinity,
                              placeholder: (context, url) =>
                                  Container(color: const Color(0xFFF1F5F9)),
                              errorWidget: (context, url, error) => Container(
                                color: const Color(0xFFF1F5F9),
                                child: const Icon(
                                  Icons.image_not_supported_outlined,
                                  color: Color(0xFFCBD5E1),
                                ),
                              ),
                            )
                          : Container(
                              color: const Color(0xFFF1F5F9),
                              child: const Icon(
                                Icons.checkroom_outlined,
                                size: 40,
                                color: Color(0xFFCBD5E1),
                              ),
                            ),
                    ),
                  ),
                  Expanded(
                    flex: 2,
                    child: Padding(
                      padding: const EdgeInsets.all(10),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            name,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            brand,
                            style: const TextStyle(
                              fontSize: 9,
                              color: Color(0xFF64748B),
                            ),
                          ),
                          const SizedBox(height: 6),
                          Row(
                            children: [
                              Text(
                                '₹$price',
                                style: const TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                              const SizedBox(width: 4),
                              Text(
                                '₹$origP',
                                style: const TextStyle(
                                  fontSize: 9,
                                  color: Color(0xFF94A3B8),
                                  decoration: TextDecoration.lineThrough,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  // ── Bulk Offers Cards ─────────────────────────────────────────────────────
  Widget _bulkOffersCards() {
    return SizedBox(
      height: 300,
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 12),
        itemCount: _bulkOffers.length,
        itemBuilder: (_, i) {
          final item = _bulkOffers[i];
          final name = item['name']?.toString() ?? 'Product';
          final brand = item['brand']?.toString() ?? '';
          final price = _fmt(item['price'] ?? item['discount_price']);
          final origP = _fmt(item['original_price'] ?? item['price']);
          final img = _imgUrl(item['image']);
          final bulkOffers = item['bulk_offers'] as List?;

          // Extract first bulk offer for display
          String offerLabel = '';
          if (bulkOffers != null && bulkOffers.isNotEmpty) {
            final firstOffer = bulkOffers[0] as Map?;
            if (firstOffer != null) {
              final quantity = firstOffer['quantity']?.toString() ?? '';
              final offerPrice = _fmt(firstOffer['offer_price']);
              offerLabel = 'Buy $quantity at ₹$offerPrice';
            }
          }

          return GestureDetector(
            onTap: item['id'] != null ? () => _openProduct(item) : null,
            child: Container(
              width: 160,
              margin: const EdgeInsets.only(right: 12),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(18),
                boxShadow: const [
                  BoxShadow(
                    color: Color(0x0F000000),
                    blurRadius: 12,
                    offset: Offset(0, 4),
                  ),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    flex: 3,
                    child: Stack(
                      children: [
                        ClipRRect(
                          borderRadius: const BorderRadius.vertical(
                            top: Radius.circular(18),
                          ),
                          child: img != null
                              ? CachedNetworkImage(
                                  imageUrl: img,
                                  fit: BoxFit.cover,
                                  width: double.infinity,
                                  height: double.infinity,
                                  placeholder: (context, url) =>
                                      Container(color: const Color(0xFFF1F5F9)),
                                  errorWidget: (context, url, error) =>
                                      Container(
                                        color: const Color(0xFFF1F5F9),
                                        child: const Icon(
                                          Icons.image_not_supported_outlined,
                                          color: Color(0xFFCBD5E1),
                                        ),
                                      ),
                                )
                              : Container(
                                  color: const Color(0xFFF1F5F9),
                                  child: const Icon(
                                    Icons.checkroom_outlined,
                                    size: 40,
                                    color: Color(0xFFCBD5E1),
                                  ),
                                ),
                        ),
                        if (offerLabel.isNotEmpty)
                          Positioned(
                            bottom: 0,
                            left: 0,
                            right: 0,
                            child: Container(
                              color: const Color(0xFF7C3AED).withOpacity(0.9),
                              padding: const EdgeInsets.all(6),
                              child: Text(
                                offerLabel,
                                textAlign: TextAlign.center,
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                  fontSize: 8,
                                  color: Colors.white,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
                  Expanded(
                    flex: 2,
                    child: Padding(
                      padding: const EdgeInsets.all(10),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            name,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            brand,
                            style: const TextStyle(
                              fontSize: 9,
                              color: Color(0xFF64748B),
                            ),
                          ),
                          const SizedBox(height: 6),
                          Row(
                            children: [
                              Text(
                                '₹$price',
                                style: const TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                              const SizedBox(width: 4),
                              Text(
                                '₹$origP',
                                style: const TextStyle(
                                  fontSize: 9,
                                  color: Color(0xFF94A3B8),
                                  decoration: TextDecoration.lineThrough,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  // ── Top Brands
  Widget _topBrands() {
    return SizedBox(
      height: 90,
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 12),
        itemCount: _brands.isNotEmpty ? _brands.length + 1 : 7,
        itemBuilder: (_, i) {
          if (_brands.isNotEmpty && i == _brands.length) {
            return Container(
              width: 72,
              margin: const EdgeInsets.only(right: 10),
              child: Column(
                children: [
                  Container(
                    width: 64,
                    height: 64,
                    decoration: BoxDecoration(
                      color: const Color(0xFFDCFCE7),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: _green.withValues(alpha: 0.4)),
                    ),
                    child: const Center(
                      child: Icon(Icons.add_rounded, color: _green, size: 24),
                    ),
                  ),
                  const SizedBox(height: 5),
                  const Text(
                    '+ More',
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                      color: _green,
                    ),
                  ),
                ],
              ),
            );
          }
          final fallbackNames = const [
            'Nike',
            'Adidas',
            'Puma',
            "Levi's",
            'Zara',
            'H&M',
          ];
          final brand = _brands.isNotEmpty ? _brands[i] : <String, dynamic>{};
          final name =
              brand['name']?.toString() ??
              fallbackNames[i % fallbackNames.length];
          final imgUrl = _imgUrl(brand['logo_url'] ?? brand['image']);

          return GestureDetector(
            onTap: () {
              if (brand['id'] != null) {
                Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) => AllProductsScreen(
                      brandId: brand['id']?.toString(),
                      brandName: name,
                    ),
                  ),
                );
              } else {
                Navigator.of(context).push(
                  MaterialPageRoute(builder: (_) => const AllBrandsScreen()),
                );
              }
            },
            child: Container(
              width: 72,
              margin: const EdgeInsets.only(right: 10),
              child: Column(
                children: [
                  Container(
                    width: 64,
                    height: 64,
                    decoration: BoxDecoration(
                      color: const Color(0xFFF8FAFC),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: const Color(0xFFE2E8F0)),
                    ),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(15),
                      child: imgUrl != null
                          ? CachedNetworkImage(
                              imageUrl: imgUrl,
                              fit: BoxFit.contain,
                              placeholder: (ctx, u) => const Center(
                                child: Icon(
                                  Icons.storefront_outlined,
                                  color: Color(0xFFCBD5E1),
                                  size: 24,
                                ),
                              ),
                              errorWidget: (ctx, u, e) => Center(
                                child: Text(
                                  name.length > 2
                                      ? name.substring(0, 2).toUpperCase()
                                      : name.toUpperCase(),
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w800,
                                    fontSize: 16,
                                    color: Color(0xFF374151),
                                  ),
                                ),
                              ),
                            )
                          : Center(
                              child: Text(
                                name.length > 2
                                    ? name.substring(0, 2).toUpperCase()
                                    : name.toUpperCase(),
                                style: const TextStyle(
                                  fontWeight: FontWeight.w800,
                                  fontSize: 16,
                                  color: Color(0xFF374151),
                                ),
                              ),
                            ),
                    ),
                  ),
                  const SizedBox(height: 5),
                  Text(
                    name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF374151),
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  // ── Trust Badges ──────────────────────────────────────────────────────────
  Widget _trustBadges() {
    const badges = [
      {
        'icon': Icons.electric_bolt_outlined,
        'title': '60 MINUTE DELIVERY',
        'sub': 'Lightning fast delivery',
      },
      {
        'icon': Icons.loop_outlined,
        'title': 'TRY & BUY AT HOME',
        'sub': 'Try first, pay later',
      },
      {
        'icon': Icons.replay_rounded,
        'title': 'EASY RETURNS',
        'sub': 'Hassle free returns',
      },
      {
        'icon': Icons.verified_outlined,
        'title': '100% ORIGINAL PRODUCTS',
        'sub': 'Authenticity guaranteed',
      },
    ];
    return Container(
      margin: const EdgeInsets.fromLTRB(12, 20, 12, 0),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: const [BoxShadow(color: Color(0x0A000000), blurRadius: 6)],
      ),
      child: Wrap(
        spacing: 8,
        runSpacing: 12,
        children: badges
            .map(
              (b) => SizedBox(
                width: (MediaQuery.of(context).size.width - 56) / 2,
                child: Row(
                  children: [
                    Container(
                      width: 36,
                      height: 36,
                      decoration: BoxDecoration(
                        color: const Color(0xFFDCFCE7),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Icon(
                        b['icon'] as IconData,
                        color: _green,
                        size: 18,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            b['title']! as String,
                            style: const TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF0F172A),
                            ),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                          ),
                          Text(
                            b['sub']! as String,
                            style: const TextStyle(
                              fontSize: 10,
                              color: Color(0xFF64748B),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            )
            .toList(),
      ),
    );
  }

  // ── Newsletter Strip ──────────────────────────────────────────────────────
  Widget _newsletterStrip() {
    final TextEditingController emailCtrl = TextEditingController();
    return Container(
      margin: const EdgeInsets.fromLTRB(12, 16, 12, 0),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF14532D), Color(0xFF16A34A)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: const [
              Icon(Icons.mail_outline_rounded, color: Colors.white, size: 20),
              SizedBox(width: 8),
              Text(
                'BE THE FIRST TO KNOW',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 15,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 0.5,
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          const Text(
            'Get updates on new arrivals, sales & exclusive offers',
            style: TextStyle(color: Color(0xFFD1FAE5), fontSize: 13),
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: Container(
                  height: 46,
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: TextField(
                    controller: emailCtrl,
                    keyboardType: TextInputType.emailAddress,
                    decoration: const InputDecoration(
                      hintText: 'Enter your email',
                      hintStyle: TextStyle(
                        color: Color(0xFF9CA3AF),
                        fontSize: 13,
                      ),
                      contentPadding: EdgeInsets.symmetric(
                        horizontal: 14,
                        vertical: 0,
                      ),
                      border: InputBorder.none,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              SizedBox(
                height: 46,
                child: ElevatedButton(
                  onPressed: () {
                    if (emailCtrl.text.trim().isNotEmpty) {
                      _snack('Subscribed! 🎉');
                    }
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.white,
                    foregroundColor: _green,
                    elevation: 0,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                    padding: const EdgeInsets.symmetric(horizontal: 18),
                  ),
                  child: const Text(
                    'SUBSCRIBE',
                    style: TextStyle(fontWeight: FontWeight.w800, fontSize: 12),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  // ── Download Banner ───────────────────────────────────────────────────────
  Widget _downloadBanner() {
    const policies = [
      {'icon': Icons.privacy_tip_outlined, 'label': 'Privacy Policy'},
      {'icon': Icons.description_outlined, 'label': 'Terms of Service'},
      {'icon': Icons.assignment_return_outlined, 'label': 'Return Policy'},
      {'icon': Icons.local_shipping_outlined, 'label': 'Shipping Policy'},
      {'icon': Icons.currency_rupee_outlined, 'label': 'Refund Policy'},
      {'icon': Icons.headset_mic_outlined, 'label': 'Contact Us'},
    ];
    return Container(
      margin: const EdgeInsets.fromLTRB(12, 16, 12, 0),
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE5E7EB)),
        boxShadow: const [BoxShadow(color: Color(0x06000000), blurRadius: 8)],
      ),
      child: Column(
        children: [
          Row(
            children: [
              Image.asset('assets/images/logo.png', width: 28, height: 28),
              const SizedBox(width: 8),
              RichText(
                text: const TextSpan(
                  style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15),
                  children: [
                    TextSpan(
                      text: 'BLINKIE',
                      style: TextStyle(color: Color(0xFF0F172A)),
                    ),
                    TextSpan(
                      text: 'FASH',
                      style: TextStyle(color: _green),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          const Text(
            'Fashion delivered in 60 minutes — quality you trust.',
            style: TextStyle(
              fontSize: 12,
              color: Color(0xFF64748B),
              height: 1.4,
            ),
          ),
          const Divider(height: 24, color: Color(0xFFE5E7EB)),
          GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            childAspectRatio: 4.5,
            crossAxisSpacing: 4,
            mainAxisSpacing: 4,
            children: policies
                .map(
                  (p) => GestureDetector(
                    onTap: () => Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => const PoliciesScreen()),
                    ),
                    child: Row(
                      children: [
                        Icon(
                          p['icon'] as IconData,
                          size: 16,
                          color: const Color(0xFF64748B),
                        ),
                        const SizedBox(width: 6),
                        Text(
                          p['label'] as String,
                          style: const TextStyle(
                            fontSize: 12,
                            color: Color(0xFF374151),
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ],
                    ),
                  ),
                )
                .toList(),
          ),
          const Divider(height: 24, color: Color(0xFFE5E7EB)),
          const Text(
            '© 2025 BlinkieFash. All rights reserved.',
            style: TextStyle(fontSize: 11, color: Color(0xFF94A3B8)),
          ),
        ],
      ),
    );
  }

  // ── Drawer ────────────────────────────────────────────────────────────────
  Widget _buildDrawer() {
    return Drawer(
      backgroundColor: Colors.white,
      child: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 20, 20, 12),
              child: Row(
                children: [
                  Image.asset('assets/images/logo.png', width: 36, height: 36),
                  const SizedBox(width: 10),
                  RichText(
                    text: const TextSpan(
                      style: TextStyle(
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
                          style: TextStyle(color: _green),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const Divider(height: 1),
            Expanded(
              child: ListView(
                padding: EdgeInsets.zero,
                children: [
                  _DrawerSection(
                    title: 'SHOP BY CATEGORY',
                    children: _categories.isNotEmpty
                        ? _categories
                              .map((c) {
                                final catId = c['id']?.toString() ?? '';
                                final catName = c['name']?.toString() ?? '';
                                final children = _allCategories
                                    .where(
                                      (x) =>
                                          x['parent_id']?.toString() == catId,
                                    )
                                    .toList();
                                final expanded =
                                    _drawerExpandedCats[catId] == true;
                                if (children.isEmpty) {
                                  return _DrawerItem(
                                    icon: Icons.chevron_right_rounded,
                                    label: catName,
                                    onTap: () {
                                      Navigator.pop(context);
                                      Navigator.of(context).push(
                                        MaterialPageRoute(
                                          builder: (_) => CategoryLandingScreen(
                                            categoryId: catId,
                                            categoryName: catName,
                                          ),
                                        ),
                                      );
                                    },
                                  );
                                }
                                return Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    ListTile(
                                      dense: true,
                                      leading: Icon(
                                        expanded
                                            ? Icons.keyboard_arrow_down_rounded
                                            : Icons.chevron_right_rounded,
                                        size: 18,
                                        color: expanded
                                            ? _green
                                            : const Color(0xFF374151),
                                      ),
                                      title: Text(
                                        catName,
                                        style: TextStyle(
                                          fontSize: 14,
                                          fontWeight: FontWeight.w600,
                                          color: expanded
                                              ? _green
                                              : const Color(0xFF0F172A),
                                        ),
                                      ),
                                      contentPadding:
                                          const EdgeInsets.symmetric(
                                            horizontal: 16,
                                            vertical: 0,
                                          ),
                                      visualDensity: VisualDensity.compact,
                                      onTap: () => setState(
                                        () => _drawerExpandedCats[catId] =
                                            !expanded,
                                      ),
                                    ),
                                    if (expanded)
                                      Container(
                                        color: const Color(0xFFF8FAFC),
                                        child: Column(
                                          children: children
                                              .map(
                                                (sub) => ListTile(
                                                  dense: true,
                                                  leading: const SizedBox(
                                                    width: 8,
                                                  ),
                                                  title: Text(
                                                    sub['name']?.toString() ??
                                                        '',
                                                    style: const TextStyle(
                                                      fontSize: 13,
                                                      fontWeight:
                                                          FontWeight.w500,
                                                      color: Color(0xFF475569),
                                                    ),
                                                  ),
                                                  trailing: const Icon(
                                                    Icons
                                                        .arrow_forward_ios_rounded,
                                                    size: 12,
                                                    color: Color(0xFFCBD5E1),
                                                  ),
                                                  contentPadding:
                                                      const EdgeInsets.only(
                                                        left: 44,
                                                        right: 16,
                                                      ),
                                                  visualDensity:
                                                      VisualDensity.compact,
                                                  onTap: () {
                                                    Navigator.pop(context);
                                                    Navigator.of(context).push(
                                                      MaterialPageRoute(
                                                        builder: (_) =>
                                                            AllProductsScreen(
                                                              categoryId: sub['id']
                                                                  ?.toString(),
                                                              categoryName:
                                                                  sub['name']
                                                                      ?.toString(),
                                                            ),
                                                      ),
                                                    );
                                                  },
                                                ),
                                              )
                                              .toList(),
                                        ),
                                      ),
                                  ],
                                );
                              })
                              .toList()
                              .cast<Widget>()
                        : ['Women', 'Men', 'Kids', 'Beauty', 'Home & Living']
                              .map(
                                (name) => _DrawerItem(
                                  icon: Icons.chevron_right_rounded,
                                  label: name,
                                  onTap: () => Navigator.pop(context),
                                ),
                              )
                              .toList(),
                  ),
                  _DrawerSection(
                    title: 'BRANDS',
                    children: _brands.isNotEmpty
                        ? _brands
                              .take(6)
                              .map(
                                (b) => _DrawerItem(
                                  icon: Icons.storefront_outlined,
                                  label: b['name']?.toString() ?? '',
                                  onTap: () => Navigator.pop(context),
                                ),
                              )
                              .toList()
                        : ['Nike', 'Adidas', 'Puma', "Levi's", 'Zara']
                              .map(
                                (n) => _DrawerItem(
                                  icon: Icons.storefront_outlined,
                                  label: n,
                                  onTap: () => Navigator.pop(context),
                                ),
                              )
                              .toList(),
                  ),
                  _DrawerSection(
                    title: 'OFFERS',
                    children: [
                      _DrawerItem(
                        icon: Icons.card_giftcard_outlined,
                        label: 'Refer & Earn — ₹50 each',
                        onTap: () {
                          Navigator.pop(context);
                          Navigator.of(context).push(
                            MaterialPageRoute(
                              builder: (_) => const ReferEarnScreen(),
                            ),
                          );
                        },
                      ),
                      _DrawerItem(
                        icon: Icons.recycling_outlined,
                        label: 'Donate Old Clothes — 1% off each',
                        onTap: () {
                          Navigator.pop(context);
                          Navigator.of(context).push(
                            MaterialPageRoute(
                              builder: (_) => const OldClothesScreen(),
                            ),
                          );
                        },
                      ),
                      _DrawerItem(
                        icon: Icons.local_offer_outlined,
                        label: 'Sale & Discounts',
                        onTap: () {
                          Navigator.pop(context);
                          Navigator.of(context).push(
                            MaterialPageRoute(
                              builder: (_) =>
                                  const AllProductsScreen(initialSearch: null),
                            ),
                          );
                        },
                      ),
                      _DrawerItem(
                        icon: Icons.bolt_outlined,
                        label: 'Flash Deals',
                        onTap: () {
                          Navigator.pop(context);
                          Navigator.of(context).push(
                            MaterialPageRoute(
                              builder: (_) => const AllProductsScreen(),
                            ),
                          );
                        },
                      ),
                      _DrawerItem(
                        icon: Icons.new_releases_outlined,
                        label: 'New Arrivals',
                        onTap: () {
                          Navigator.pop(context);
                          Navigator.of(context).push(
                            MaterialPageRoute(
                              builder: (_) => const AllProductsScreen(),
                            ),
                          );
                        },
                      ),
                    ],
                  ),
                  _DrawerSection(
                    title: 'HELP',
                    children: [
                      _DrawerItem(
                        icon: Icons.headset_mic_outlined,
                        label: 'Customer Support',
                        onTap: () {
                          Navigator.pop(context);
                          Navigator.of(context).push(
                            MaterialPageRoute(
                              builder: (_) => const PoliciesScreen(),
                            ),
                          );
                        },
                      ),
                      _DrawerItem(
                        icon: Icons.privacy_tip_outlined,
                        label: 'Privacy Policy',
                        onTap: () {
                          Navigator.pop(context);
                          Navigator.of(context).push(
                            MaterialPageRoute(
                              builder: (_) => const PoliciesScreen(),
                            ),
                          );
                        },
                      ),
                      _DrawerItem(
                        icon: Icons.description_outlined,
                        label: 'Terms of Service',
                        onTap: () {
                          Navigator.pop(context);
                          Navigator.of(context).push(
                            MaterialPageRoute(
                              builder: (_) => const PoliciesScreen(),
                            ),
                          );
                        },
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const Divider(height: 1),
            Padding(
              padding: const EdgeInsets.all(16),
              child: GestureDetector(
                onTap: () async {
                  final nav = Navigator.of(context);
                  nav.pop();
                  await NotificationService.instance.clearForCurrentUser();
                  await UserSession.instance.clear();
                  nav.pushReplacement(
                    MaterialPageRoute(builder: (_) => const LoginScreen()),
                  );
                },
                child: Row(
                  children: const [
                    Icon(
                      Icons.logout_rounded,
                      color: Color(0xFFEF4444),
                      size: 20,
                    ),
                    SizedBox(width: 10),
                    Text(
                      'Logout',
                      style: TextStyle(
                        color: Color(0xFFEF4444),
                        fontWeight: FontWeight.w600,
                        fontSize: 14,
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

  // ── Other Tabs ────────────────────────────────────────────────────────────
  Widget _categoriesBody() {
    // All root categories — use DB data or fallback
    final roots = _categories.isNotEmpty
        ? _categories
        : _fallbackCategories
              .map(
                (m) => <String, dynamic>{
                  'name': m['name'],
                  '_localImage': m['image'],
                },
              )
              .toList();

    if (roots.isEmpty) {
      return const Center(
        child: CircularProgressIndicator(color: _green, strokeWidth: 2),
      );
    }

    // Clamp selected index
    final selIdx = _catSelectedIndex.clamp(0, roots.length - 1);
    final selectedRoot = roots[selIdx];
    final selectedId = selectedRoot['id']?.toString() ?? '';

    // Sub-categories of selected root
    final subs = _allCategories
        .where((c) => c['parent_id']?.toString() == selectedId)
        .toList();

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // ── Left rail: root categories ─────────────────────────────
        Container(
          width: 104,
          color: const Color(0xFFF1F5F9),
          child: ListView.builder(
            padding: EdgeInsets.zero,
            itemCount: roots.length,
            itemBuilder: (_, i) {
              final cat = roots[i];
              final isSelected = i == selIdx;
              final localImg = cat['_localImage'] as String?;
              final netImg = _imgUrl(cat['category_url'] ?? cat['image']);
              return GestureDetector(
                onTap: () {
                  setState(() => _catSelectedIndex = i);
                },
                child: Container(
                  color: isSelected ? Colors.white : Colors.transparent,
                  padding: const EdgeInsets.symmetric(
                    vertical: 14,
                    horizontal: 8,
                  ),
                  child: Column(
                    children: [
                      Container(
                        width: 52,
                        height: 52,
                        decoration: BoxDecoration(
                          color: isSelected
                              ? const Color(0xFFDCFCE7)
                              : const Color(0xFFE2E8F0),
                          borderRadius: BorderRadius.circular(14),
                          border: isSelected
                              ? Border.all(color: _green, width: 2)
                              : null,
                        ),
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(13),
                          child: localImg != null
                              ? Image.asset(localImg, fit: BoxFit.cover)
                              : netImg != null
                              ? CachedNetworkImage(
                                  imageUrl: netImg,
                                  fit: BoxFit.cover,
                                  placeholder: (_, _) =>
                                      Container(color: const Color(0xFFE2E8F0)),
                                  errorWidget: (_, _, _) => const Icon(
                                    Icons.category_outlined,
                                    color: _green,
                                    size: 22,
                                  ),
                                )
                              : const Icon(
                                  Icons.category_outlined,
                                  color: _green,
                                  size: 22,
                                ),
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        cat['name']?.toString() ?? '',
                        textAlign: TextAlign.center,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                          color: isSelected ? _green : const Color(0xFF475569),
                          height: 1.2,
                        ),
                      ),
                      if (isSelected)
                        Container(
                          margin: const EdgeInsets.only(top: 4),
                          width: 16,
                          height: 2,
                          decoration: BoxDecoration(
                            color: _green,
                            borderRadius: BorderRadius.circular(1),
                          ),
                        ),
                    ],
                  ),
                ),
              );
            },
          ),
        ),
        // ── Right panel: sub-categories ─────────────────────────────
        Expanded(
          child: Container(
            color: Colors.white,
            child: subs.isEmpty
                // No sub-categories → show a "View All" card for the root
                ? GestureDetector(
                    onTap: () => Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) => CategoryLandingScreen(
                          categoryId: selectedId,
                          categoryName: selectedRoot['name']?.toString() ?? '',
                        ),
                      ),
                    ),
                    child: Container(
                      margin: const EdgeInsets.all(16),
                      height: 100,
                      decoration: BoxDecoration(
                        color: const Color(0xFFDCFCE7),
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(
                            Icons.grid_view_rounded,
                            color: _green,
                            size: 22,
                          ),
                          const SizedBox(width: 8),
                          Text(
                            'View All ${selectedRoot['name'] ?? ''}',
                            style: const TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w700,
                              color: _green,
                            ),
                          ),
                        ],
                      ),
                    ),
                  )
                : ListView(
                    padding: const EdgeInsets.all(12),
                    children: [
                      // "All <Category>" button at top
                      GestureDetector(
                        onTap: () => Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (_) => CategoryLandingScreen(
                              categoryId: selectedId,
                              categoryName:
                                  selectedRoot['name']?.toString() ?? '',
                            ),
                          ),
                        ),
                        child: Container(
                          margin: const EdgeInsets.only(bottom: 10),
                          padding: const EdgeInsets.symmetric(
                            horizontal: 14,
                            vertical: 10,
                          ),
                          decoration: BoxDecoration(
                            color: const Color(0xFFDCFCE7),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: const Color(0xFF86EFAC)),
                          ),
                          child: Row(
                            children: [
                              const Icon(
                                Icons.apps_rounded,
                                color: _green,
                                size: 18,
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  'All ${selectedRoot['name'] ?? ''}',
                                  style: const TextStyle(
                                    fontSize: 13,
                                    fontWeight: FontWeight.w700,
                                    color: _green,
                                  ),
                                ),
                              ),
                              const Icon(
                                Icons.arrow_forward_ios_rounded,
                                size: 12,
                                color: _green,
                              ),
                            ],
                          ),
                        ),
                      ),
                      GridView.builder(
                        shrinkWrap: true,
                        physics: const NeverScrollableScrollPhysics(),
                        itemCount: subs.length,
                        gridDelegate:
                            const SliverGridDelegateWithFixedCrossAxisCount(
                              crossAxisCount: 2,
                              childAspectRatio: 0.85,
                              crossAxisSpacing: 10,
                              mainAxisSpacing: 10,
                            ),
                        itemBuilder: (_, i) {
                          final sub = subs[i];
                          final subId = sub['id']?.toString() ?? '';
                          final subName = sub['name']?.toString() ?? '';
                          final subImg = _imgUrl(
                            sub['category_url'] ?? sub['image'],
                          );
                          return GestureDetector(
                            onTap: () => Navigator.of(context).push(
                              MaterialPageRoute(
                                builder: (_) => AllProductsScreen(
                                  categoryId: subId,
                                  categoryName: subName,
                                ),
                              ),
                            ),
                            child: Container(
                              decoration: BoxDecoration(
                                color: const Color(0xFFF8FAFC),
                                borderRadius: BorderRadius.circular(14),
                                border: Border.all(
                                  color: const Color(0xFFE2E8F0),
                                ),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.stretch,
                                children: [
                                  Expanded(
                                    flex: 3,
                                    child: ClipRRect(
                                      borderRadius: const BorderRadius.vertical(
                                        top: Radius.circular(14),
                                      ),
                                      child: subImg != null
                                          ? CachedNetworkImage(
                                              imageUrl: subImg,
                                              fit: BoxFit.cover,
                                              placeholder: (_, _) => Container(
                                                color: const Color(0xFFE2E8F0),
                                              ),
                                              errorWidget: (_, _, _) =>
                                                  Container(
                                                    color: const Color(
                                                      0xFFDCFCE7,
                                                    ),
                                                    child: const Icon(
                                                      Icons.category_outlined,
                                                      color: _green,
                                                      size: 28,
                                                    ),
                                                  ),
                                            )
                                          : Container(
                                              color: const Color(0xFFDCFCE7),
                                              child: const Icon(
                                                Icons.category_outlined,
                                                color: _green,
                                                size: 28,
                                              ),
                                            ),
                                    ),
                                  ),
                                  Expanded(
                                    flex: 1,
                                    child: Padding(
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: 8,
                                        vertical: 6,
                                      ),
                                      child: Text(
                                        subName,
                                        textAlign: TextAlign.center,
                                        maxLines: 2,
                                        overflow: TextOverflow.ellipsis,
                                        style: const TextStyle(
                                          fontSize: 11,
                                          fontWeight: FontWeight.w600,
                                          color: Color(0xFF374151),
                                          height: 1.2,
                                        ),
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          );
                        },
                      ),
                    ],
                  ),
          ),
        ),
      ],
    );
  }

  // ── Edit Profile Sheet ────────────────────────────────────────────────────
  void _showEditProfileSheet(BuildContext context) {
    final session = UserSession.instance;
    final nameCtrl = TextEditingController(text: session.name ?? '');
    final emailCtrl = TextEditingController();
    bool saving = false;
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheetState) => Padding(
          padding: EdgeInsets.only(
            left: 20,
            right: 20,
            top: 24,
            bottom: MediaQuery.of(ctx).viewInsets.bottom + 24,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'My Profile',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
              ),
              const SizedBox(height: 20),
              TextField(
                controller: nameCtrl,
                decoration: const InputDecoration(
                  labelText: 'Full Name',
                  prefixIcon: Icon(Icons.person_outline),
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 14),
              TextField(
                controller: emailCtrl,
                keyboardType: TextInputType.emailAddress,
                decoration: const InputDecoration(
                  labelText: 'Email (optional)',
                  prefixIcon: Icon(Icons.email_outlined),
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 6),
              Text(
                'Phone: ${session.phone ?? ""}',
                style: const TextStyle(color: Color(0xFF64748B), fontSize: 13),
              ),
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: saving
                      ? null
                      : () async {
                          final name = nameCtrl.text.trim();
                          if (name.isEmpty) return;
                          setSheetState(() => saving = true);
                          final res = await _api.updateUserProfile(
                            userId: session.userId ?? '',
                            name: name,
                            email: emailCtrl.text.trim().isNotEmpty
                                ? emailCtrl.text.trim()
                                : null,
                          );
                          setSheetState(() => saving = false);
                          if (res['success'] == true ||
                              res['message'] == null) {
                            session.name = name;
                            setState(() {});
                          }
                          if (ctx.mounted) Navigator.pop(ctx);
                          _snack(
                            res['success'] == true
                                ? 'Profile updated!'
                                : (res['message'] ?? 'Saved'),
                          );
                        },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: _green,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  child: saving
                      ? const SizedBox(
                          height: 18,
                          width: 18,
                          child: CircularProgressIndicator(
                            color: Colors.white,
                            strokeWidth: 2,
                          ),
                        )
                      : const Text(
                          'Save Changes',
                          style: TextStyle(fontWeight: FontWeight.w700),
                        ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _profileBody() {
    final session = UserSession.instance;
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        const SizedBox(height: 20),
        CircleAvatar(
          radius: 40,
          backgroundColor: const Color(0xFFDCFCE7),
          child: Text(
            (session.name?.isNotEmpty == true ? session.name![0] : '?')
                .toUpperCase(),
            style: const TextStyle(
              fontSize: 32,
              fontWeight: FontWeight.w800,
              color: _green,
            ),
          ),
        ),
        const SizedBox(height: 12),
        Center(
          child: Text(
            session.name ?? 'Guest',
            style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700),
          ),
        ),
        Center(
          child: Text(
            session.phone ?? '',
            style: const TextStyle(fontSize: 14, color: Color(0xFF64748B)),
          ),
        ),
        const SizedBox(height: 24),
        _ProfileTile(
          icon: Icons.person_outline_rounded,
          label: 'My Profile',
          onTap: () => _showEditProfileSheet(context),
        ),
        _ProfileTile(
          icon: Icons.location_on_outlined,
          label: 'Saved Addresses',
          onTap: () {
            final session = UserSession.instance;
            Navigator.of(context).push(
              MaterialPageRoute(
                builder: (_) =>
                    AddressScreen(userId: session.userId ?? '', api: _api),
              ),
            );
          },
        ),
        _ProfileTile(
          icon: Icons.receipt_long_outlined,
          label: 'My Orders',
          onTap: () => setState(() => _tab = 3),
        ),
        _ProfileTile(
          icon: Icons.favorite_border_rounded,
          label: 'Wishlist',
          onTap: () => Navigator.of(
            context,
          ).push(MaterialPageRoute(builder: (_) => const WishlistScreen())),
        ),
        _ProfileTile(
          icon: Icons.headset_mic_outlined,
          label: 'Help & Support',
          onTap: () => Navigator.of(
            context,
          ).push(MaterialPageRoute(builder: (_) => const PoliciesScreen())),
        ),
        const SizedBox(height: 8),
        _ProfileTile(
          icon: Icons.logout_rounded,
          label: 'Logout',
          color: const Color(0xFFEF4444),
          onTap: () {
            NotificationService.instance.clearForCurrentUser();
            UserSession.instance.clear();
            Navigator.of(context).pushReplacement(
              MaterialPageRoute(builder: (_) => const LoginScreen()),
            );
          },
        ),
      ],
    );
  }
}

// ── Profile tile ──────────────────────────────────────────────────────────────
class _ProfileTile extends StatelessWidget {
  const _ProfileTile({
    required this.icon,
    required this.label,
    required this.onTap,
    this.color,
  });
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final c = color ?? const Color(0xFF374151);
    return ListTile(
      leading: Container(
        width: 40,
        height: 40,
        decoration: BoxDecoration(
          color: c.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Icon(icon, color: c, size: 20),
      ),
      title: Text(
        label,
        style: TextStyle(fontWeight: FontWeight.w600, fontSize: 15, color: c),
      ),
      trailing: color == null
          ? const Icon(Icons.chevron_right_rounded, color: Color(0xFF94A3B8))
          : null,
      onTap: onTap,
      contentPadding: const EdgeInsets.symmetric(vertical: 4, horizontal: 4),
    );
  }
}

// ── Address List Sheet ────────────────────────────────────────────────────────
class _AddressListSheet extends StatefulWidget {
  const _AddressListSheet({
    required this.userId,
    required this.api,
    required this.scrollController,
  });
  final String userId;
  final ApiClient api;
  final ScrollController scrollController;
  @override
  State<_AddressListSheet> createState() => _AddressListSheetState();
}

class _AddressListSheetState extends State<_AddressListSheet> {
  List<dynamic> _addresses = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final list = await widget.api.fetchAddresses(widget.userId);
    if (mounted) {
      setState(() {
        _addresses = list;
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Container(
          margin: const EdgeInsets.only(top: 10, bottom: 4),
          width: 36,
          height: 4,
          decoration: BoxDecoration(
            color: const Color(0xFFCBD5E1),
            borderRadius: BorderRadius.circular(2),
          ),
        ),
        const Padding(
          padding: EdgeInsets.fromLTRB(20, 12, 20, 8),
          child: Align(
            alignment: Alignment.centerLeft,
            child: Text(
              'Saved Addresses',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
            ),
          ),
        ),
        if (_loading)
          const Expanded(child: Center(child: CircularProgressIndicator()))
        else if (_addresses.isEmpty)
          const Expanded(
            child: Center(
              child: Text(
                'No addresses saved yet.',
                style: TextStyle(color: Color(0xFF64748B)),
              ),
            ),
          )
        else
          Expanded(
            child: ListView.builder(
              controller: widget.scrollController,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
              itemCount: _addresses.length,
              itemBuilder: (ctx, i) {
                final a = _addresses[i] as Map;
                return Container(
                  margin: const EdgeInsets.only(bottom: 10),
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF8FAFC),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFFE2E8F0)),
                  ),
                  child: Row(
                    children: [
                      const Icon(
                        Icons.location_on_outlined,
                        color: Color(0xFF16A34A),
                        size: 22,
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
                                fontSize: 14,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              [a['city'], a['pincode']]
                                  .where(
                                    (s) => s != null && s.toString().isNotEmpty,
                                  )
                                  .join(', '),
                              style: const TextStyle(
                                color: Color(0xFF64748B),
                                fontSize: 12,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                );
              },
            ),
          ),
        Padding(
          padding: EdgeInsets.fromLTRB(
            16,
            8,
            16,
            MediaQuery.of(context).viewInsets.bottom + 16,
          ),
          child: SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: () => Navigator.pop(context),
              icon: const Icon(Icons.add),
              label: const Text('Add Address via Checkout'),
              style: OutlinedButton.styleFrom(
                foregroundColor: const Color(0xFF16A34A),
                side: const BorderSide(color: Color(0xFF16A34A)),
                padding: const EdgeInsets.symmetric(vertical: 13),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

// ── Drawer Section ────────────────────────────────────────────────────────────
class _DrawerSection extends StatelessWidget {
  const _DrawerSection({required this.title, required this.children});
  final String title;
  final List<Widget> children;
  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 4),
          child: Text(
            title,
            style: const TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w800,
              color: Color(0xFF94A3B8),
              letterSpacing: 1.0,
            ),
          ),
        ),
        ...children,
        const Divider(height: 1),
      ],
    );
  }
}

// ── Drawer Item ───────────────────────────────────────────────────────────────
class _DrawerItem extends StatelessWidget {
  const _DrawerItem({
    required this.icon,
    required this.label,
    required this.onTap,
  });
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) {
    return ListTile(
      dense: true,
      leading: Icon(icon, size: 18, color: const Color(0xFF374151)),
      title: Text(
        label,
        style: const TextStyle(
          fontSize: 14,
          fontWeight: FontWeight.w500,
          color: Color(0xFF0F172A),
        ),
      ),
      onTap: onTap,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 0),
      visualDensity: VisualDensity.compact,
    );
  }
}

// ── Location picker bottom sheet ───────────────────────────────────────────
class _LocationSheet extends StatefulWidget {
  final ApiClient api;
  final String? userId;
  final VoidCallback onCurrentLocation;
  final ValueChanged<Map<String, dynamic>> onAddressSelected;

  const _LocationSheet({
    required this.api,
    required this.userId,
    required this.onCurrentLocation,
    required this.onAddressSelected,
  });

  @override
  State<_LocationSheet> createState() => _LocationSheetState();
}

class _LocationSheetState extends State<_LocationSheet> {
  List<dynamic> _addresses = [];
  bool _loading = true;

  static const Color _green = Color(0xFF16A34A);

  @override
  void initState() {
    super.initState();
    _fetchAddresses();
  }

  Future<void> _fetchAddresses() async {
    if (widget.userId != null && widget.userId!.isNotEmpty) {
      try {
        final list = await widget.api.fetchAddresses(widget.userId!);
        if (mounted) {
          setState(() {
            _addresses = list;
            _loading = false;
          });
        }
      } catch (_) {
        if (mounted) setState(() => _loading = false);
      }
    } else {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(0, 8, 0, 16),
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
                  color: const Color(0xFFCBD5E1),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const Padding(
              padding: EdgeInsets.fromLTRB(20, 0, 20, 12),
              child: Text(
                'Deliver to',
                style: TextStyle(
                  fontSize: 17,
                  fontWeight: FontWeight.w800,
                  color: Color(0xFF0F172A),
                ),
              ),
            ),
            // GPS option
            ListTile(
              leading: Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: const Color(0xFFDCFCE7),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Icon(
                  Icons.my_location_rounded,
                  color: _green,
                  size: 20,
                ),
              ),
              title: const Text(
                'Use Current Location',
                style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
              ),
              subtitle: const Text(
                'Detect via GPS',
                style: TextStyle(color: Color(0xFF64748B), fontSize: 12),
              ),
              onTap: widget.onCurrentLocation,
              contentPadding: const EdgeInsets.symmetric(
                horizontal: 20,
                vertical: 2,
              ),
            ),
            if (_loading)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 24),
                child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
              )
            else if (_addresses.isNotEmpty) ...[
              const Padding(
                padding: EdgeInsets.fromLTRB(20, 12, 20, 6),
                child: Text(
                  'SAVED ADDRESSES',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF94A3B8),
                    letterSpacing: 0.6,
                  ),
                ),
              ),
              ...(_addresses.take(5).map((a) {
                final addr = a as Map<String, dynamic>;
                final type = (addr['address_type'] ?? addr['type'] ?? 'home')
                    .toString()
                    .toLowerCase();
                final icon = type == 'work'
                    ? Icons.work_outline
                    : type == 'other'
                    ? Icons.location_on_outlined
                    : Icons.home_outlined;
                final city = (addr['city'] ?? '').toString().trim();
                final line = (addr['address_line'] ?? '').toString().trim();
                final subtitle = [
                  line,
                  city,
                ].where((s) => s.isNotEmpty).join(', ');
                return ListTile(
                  leading: Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF1F5F9),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Icon(icon, color: const Color(0xFF475569), size: 20),
                  ),
                  title: Text(
                    type[0].toUpperCase() + type.substring(1),
                    style: const TextStyle(
                      fontWeight: FontWeight.w700,
                      fontSize: 13,
                      color: _green,
                    ),
                  ),
                  subtitle: Text(
                    subtitle,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: Color(0xFF475569),
                      fontSize: 12,
                    ),
                  ),
                  onTap: () => widget.onAddressSelected(addr),
                  contentPadding: const EdgeInsets.symmetric(
                    horizontal: 20,
                    vertical: 2,
                  ),
                );
              }).toList()),
            ],
          ],
        ),
      ),
    );
  }
}
