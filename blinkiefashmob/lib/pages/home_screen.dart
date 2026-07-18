import 'dart:async';
import 'dart:convert';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:geocoding/geocoding.dart';
import 'package:geolocator/geolocator.dart';
import 'package:http/http.dart' as http;
import 'package:latlong2/latlong.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:url_launcher/url_launcher.dart';

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
import 'support_chat_screen.dart';
import 'wishlist_screen.dart';
import 'address_screen.dart';
import 'location_picker_screen.dart';
import 'spin_wheel_screen.dart';
import 'fashion_quest_screen.dart';
import '../widgets/animated_search_bar.dart';
import '../widgets/bf_loader.dart';
import '../widgets/store_closed_banner.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});
  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen>
    with SingleTickerProviderStateMixin {
  static const String _googleMapsApiKey = String.fromEnvironment(
    'GOOGLE_MAPS_API_KEY',
    defaultValue: '',
  );
  final ApiClient _api = ApiClient();
  int _tab = 0;
  bool _guestStartupLocationPromptShown = false;

  bool _isLoading = true;
  bool _outOfServiceArea = false; // true when nearest store exceeds DB radius
  String _currentLocation = 'Detecting location...';
  double? _lastKnownLat;
  double? _lastKnownLng;
  List<Map<String, dynamic>> _products = const [];
  List<Map<String, dynamic>> _categories = const []; // root only
  List<Map<String, dynamic>> _allCategories = const []; // full tree
  List<Map<String, dynamic>> _brands = const [];
  List<Map<String, dynamic>> _under999 = const [];
  List<Map<String, dynamic>> _under1999 = const [];

  // Shop By Category section
  String? _shopCatId;
  int _shopCatChipIndex = 0;
  List<Map<String, dynamic>> _shopProducts = const [];
  bool _shopLoading = false;
  bool _shopHasMore = false;
  int _shopOffset = 0;
  static const int _shopPageSize = 10;
  String _shopSort = 'newest';
  double? _shopMinPrice;
  double? _shopMaxPrice;

  // Hero slider
  int _heroPage = 0;
  final PageController _heroPageController = PageController();
  Timer? _heroTimer;

  // Promo banner slider
  int _promoPage = 0;
  final PageController _promoPageController = PageController();
  Timer? _promoTimer;
  static const _heroCards = [
    {'image': 'assets/images/Main_hero_card.jpeg', 'route': 'allProducts'},
    {'image': 'assets/images/accessories.jpeg', 'route': 'accessories'},
    {'image': 'assets/images/mens_hero.jpeg', 'route': 'mens'},
    {'image': 'assets/images/womens_hero.jpeg', 'route': 'women'},
    {'image': 'assets/images/mens_footwear.jpeg', 'route': 'mensFootwear'},
    {'image': 'assets/images/womens_footwear.jpeg', 'route': 'womensFootwear'},
  ];

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

  String? _selectedAvatarUrl;

  static const List<String> _predefinedAvatars = [
    'https://api.dicebear.com/9.x/adventurer/png?seed=Noah&size=160',
    'https://api.dicebear.com/9.x/adventurer/png?seed=Liam&size=160',
    'https://api.dicebear.com/9.x/adventurer/png?seed=Ethan&size=160',
    'https://api.dicebear.com/9.x/adventurer/png?seed=Arjun&size=160',
    'https://api.dicebear.com/9.x/adventurer/png?seed=Emma&size=160',
    'https://api.dicebear.com/9.x/adventurer/png?seed=Olivia&size=160',
    'https://api.dicebear.com/9.x/adventurer/png?seed=Ava&size=160',
    'https://api.dicebear.com/9.x/adventurer/png?seed=Isha&size=160',
    'https://api.dicebear.com/9.x/adventurer/png?seed=Mason&size=160',
    'https://api.dicebear.com/9.x/adventurer/png?seed=Lucas&size=160',
    'https://api.dicebear.com/9.x/adventurer/png?seed=Mia&size=160',
    'https://api.dicebear.com/9.x/adventurer/png?seed=Zara&size=160',
    'https://api.dicebear.com/9.x/bottts/png?seed=Tiger&size=160',
    'https://api.dicebear.com/9.x/bottts/png?seed=Panda&size=160',
    'https://api.dicebear.com/9.x/bottts/png?seed=Fox&size=160',
    'https://api.dicebear.com/9.x/bottts/png?seed=Koala&size=160',
    'https://api.dicebear.com/9.x/bottts/png?seed=Owl&size=160',
    'https://api.dicebear.com/9.x/bottts/png?seed=Rabbit&size=160',
    'https://api.dicebear.com/9.x/bottts/png?seed=Whale&size=160',
    'https://api.dicebear.com/9.x/bottts/png?seed=Dolphin&size=160',
  ];

  @override
  void initState() {
    super.initState();
    _loadSelectedAvatar();
    _loadHomeData();
    _tryLoadLocationSilently();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _promptGuestLocationSelection();
    });
    _initLightBannerTimer();
    _promoTimer = Timer.periodic(const Duration(seconds: 3), (_) {
      if (!mounted) return;
      if (!_promoPageController.hasClients) return;
      if (_promoPageController.positions.isEmpty) return;
      if (!_promoPageController.position.hasViewportDimension) return;
      final next = (_promoPage + 1) % _promoCards.length;
      try {
        _promoPageController.animateToPage(
          next,
          duration: const Duration(milliseconds: 500),
          curve: Curves.easeInOut,
        );
      } catch (_) {}
    });
    _heroTimer = Timer.periodic(const Duration(seconds: 12), (_) {
      if (!mounted) return;
      if (!_heroPageController.hasClients) return;
      if (_heroPageController.positions.isEmpty) return;
      if (!_heroPageController.position.hasViewportDimension) return;
      final next = (_heroPage + 1) % _heroCards.length;
      try {
        _heroPageController.animateToPage(
          next,
          duration: const Duration(milliseconds: 600),
          curve: Curves.easeInOut,
        );
      } catch (_) {
        // Ignore transient detach races when view is rebuilding.
      }
    });
  }

  Future<void> _promptGuestLocationSelection() async {
    if (_guestStartupLocationPromptShown || !mounted) return;
    if (UserSession.instance.isLoggedIn) return;
    _guestStartupLocationPromptShown = true;
    await Future<void>.delayed(const Duration(milliseconds: 300));
    if (!mounted) return;
    await _openLocationPicker();
  }

  @override
  void dispose() {
    _heroTimer?.cancel();
    _promoTimer?.cancel();
    _lightBannerTimer?.cancel();
    _deliverLiveTimer?.cancel();
    _deliverPickupDebounce?.cancel();
    _deliverDropDebounce?.cancel();
    _deliverPickupCtrl.dispose();
    _deliverDropCtrl.dispose();
    _deliverPickupFocus.dispose();
    _deliverDropFocus.dispose();
    _heroPageController.dispose();
    _promoPageController.dispose();
    _lightBannerController.dispose();
    super.dispose();
  }

  String _avatarPrefKey() =>
      'selected_avatar_${UserSession.instance.userId ?? 'guest'}';

  Future<void> _loadSelectedAvatar() async {
    final prefs = await SharedPreferences.getInstance();
    final saved = prefs.getString(_avatarPrefKey());
    if (!mounted) return;
    setState(() => _selectedAvatarUrl = saved);
  }

  Future<void> _setSelectedAvatar(String url) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_avatarPrefKey(), url);
    if (!mounted) return;
    setState(() => _selectedAvatarUrl = url);
  }

  String _currentUserAvatarUrl() {
    if (_selectedAvatarUrl != null && _selectedAvatarUrl!.isNotEmpty) {
      return _selectedAvatarUrl!;
    }
    final seed = Uri.encodeComponent(UserSession.instance.name ?? 'user');
    return 'https://api.dicebear.com/9.x/adventurer/png?seed=$seed&size=200';
  }

  void _showAvatarPickerSheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (ctx) => Container(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        child: SafeArea(
          top: false,
          child: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Center(
                  child: Container(
                    width: 42,
                    height: 4,
                    margin: const EdgeInsets.only(bottom: 16),
                    decoration: BoxDecoration(
                      color: const Color(0xFFE2E8F0),
                      borderRadius: BorderRadius.circular(4),
                    ),
                  ),
                ),
                const Text(
                  'Choose Profile Avatar',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w800,
                    color: Color(0xFF0F172A),
                  ),
                ),
                const SizedBox(height: 6),
                const Text(
                  'Pick your look from predefined avatars',
                  style: TextStyle(color: Color(0xFF64748B), fontSize: 13),
                ),
                const SizedBox(height: 18),
                _avatarGridSection(ctx),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _avatarGridSection(BuildContext sheetCtx) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Wrap(
          spacing: 12,
          runSpacing: 12,
          children: _predefinedAvatars.map((url) {
            final selected = _selectedAvatarUrl == url;
            return GestureDetector(
              onTap: () {
                _setSelectedAvatar(url);
                Navigator.pop(sheetCtx);
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text('Profile avatar updated'),
                    backgroundColor: Color(0xFF16A34A),
                  ),
                );
              },
              child: Container(
                padding: const EdgeInsets.all(2),
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: selected
                        ? const Color(0xFF16A34A)
                        : Colors.transparent,
                    width: 2,
                  ),
                ),
                child: CircleAvatar(
                  radius: 26,
                  backgroundColor: const Color(0xFFF1F5F9),
                  child: ClipOval(
                    child: CachedNetworkImage(
                      imageUrl: url,
                      width: 52,
                      height: 52,
                      fit: BoxFit.cover,
                      errorWidget: (_, _, _) => const Icon(
                        Icons.person_rounded,
                        color: Color(0xFF64748B),
                      ),
                    ),
                  ),
                ),
              ),
            );
          }).toList(),
        ),
      ],
    );
  }

  Future<void> _loadHomeData({double? lat, double? lng}) async {
    setState(() {
      _isLoading = true;
    });
    try {
      // ── Run ALL network calls in parallel so the backend cold-start
      //    delay hits only once, not 5× sequentially. ─────────────────
      final results = await Future.wait([
        _api.fetchProductsWithStore(lat: lat, lng: lng), // [0]
        _api.fetchCategories(), // [1]
        _api.fetchBrands(), // [2]
        _api.fetchProductsByPriceRange(
          // [3]
          minPrice: 0,
          maxPrice: 999,
          limit: 10,
        ),
        _api.fetchProductsByPriceRange(
          // [4]
          minPrice: 1000,
          maxPrice: 1999,
          limit: 10,
        ),
      ]);
      if (!mounted) return;

      final storeResult = results[0] as Map<String, dynamic>;
      final cats = results[1] as List;
      final brs = results[2] as List;
      final under999 = results[3] as List;
      final under1999 = results[4] as List;

      // Now that fetchProductsWithStore has run, currentStoreId is set.
      // If the price-range calls returned empty because store wasn't set
      // yet, re-fetch them if there's a store.
      final storeId = ApiClient.currentStoreId;
      List under999Final = under999;
      List under1999Final = under1999;
      if (storeId != null && (under999.isEmpty || under1999.isEmpty)) {
        final priceResults = await Future.wait([
          _api.fetchProductsByPriceRange(minPrice: 0, maxPrice: 999, limit: 10),
          _api.fetchProductsByPriceRange(
            minPrice: 1000,
            maxPrice: 1999,
            limit: 10,
          ),
        ]);
        if (!mounted) return;
        under999Final = priceResults[0];
        under1999Final = priceResults[1];
      }

      // Check radius configured for the nearest delivery partner.
      final nearestStore = storeResult['nearestStore'] as Map?;
      final locationProvided =
          storeResult['locationProvided'] == true ||
          (lat != null && lng != null);
      final distKm = nearestStore?['dist'] as num?;
      final radiusKm = (nearestStore?['deliveryRadiusKm'] as num?) ?? 45;
      final outOfArea =
          locationProvided &&
          (nearestStore == null || (distKm != null && distKm > radiusKm));

      setState(() {
        _outOfServiceArea = outOfArea;
        _products = (storeResult['products'] as List? ?? [])
            .whereType<Map<String, dynamic>>()
            .take(8)
            .toList();
        _categories = cats
            .whereType<Map<String, dynamic>>()
            .where((c) => c['parent_id'] == null)
            .take(6)
            .toList();
        _allCategories = (cats).whereType<Map<String, dynamic>>().toList();
        _brands = brs.whereType<Map<String, dynamic>>().take(8).toList();
        _under999 = under999Final.whereType<Map<String, dynamic>>().toList();
        _under1999 = under1999Final.whereType<Map<String, dynamic>>().toList();
        _isLoading = false;
      });
      // Load shop section products after home data is ready
      unawaited(_loadShopProducts(reset: true));
    } catch (_) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _loadHomeDataForCurrentSelection() {
    if (_lastKnownLat != null && _lastKnownLng != null) {
      return _loadHomeData(lat: _lastKnownLat, lng: _lastKnownLng);
    }
    return _loadHomeData();
  }

  Future<void> _loadShopProducts({bool reset = false}) async {
    if (_shopLoading) return;
    final offset = reset ? 0 : _shopOffset;
    if (mounted) setState(() => _shopLoading = true);
    try {
      final result = await _api.fetchAllProducts(
        categoryId: _shopCatId,
        sort: _shopSort,
        minPrice: _shopMinPrice,
        maxPrice: _shopMaxPrice,
        limit: _shopPageSize,
        offset: offset,
      );
      if (!mounted) return;
      final newItems = (result['products'] as List? ?? [])
          .whereType<Map<String, dynamic>>()
          .toList();
      setState(() {
        if (reset) {
          _shopProducts = newItems;
          _shopOffset = newItems.length;
        } else {
          _shopProducts = [..._shopProducts, ...newItems];
          _shopOffset += newItems.length;
        }
        _shopHasMore = newItems.length >= _shopPageSize;
        _shopLoading = false;
      });
    } catch (_) {
      if (mounted) setState(() => _shopLoading = false);
    }
  }

  Future<void> _tryLoadLocationSilently() async {
    try {
      final serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        if (mounted) setState(() => _currentLocation = 'Set location');
        return;
      }
      var permission = await Geolocator.checkPermission();
      // Auto-request permission on first launch
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.deniedForever) {
        if (mounted) setState(() => _currentLocation = 'Location denied');
        return;
      }
      if (permission == LocationPermission.whileInUse ||
          permission == LocationPermission.always) {
        await _detectCurrentLocation();
      }
    } catch (_) {
      if (mounted) setState(() => _currentLocation = 'Set location');
    }
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
          _lastKnownLat = pos.latitude;
          _lastKnownLng = pos.longitude;
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
        onAddressSelected: _selectAddress,
      ),
    );
  }

  Future<void> _selectAddress(Map<String, dynamic> addr) async {
    double? lat = double.tryParse((addr['lat'] ?? '').toString());
    double? lng = double.tryParse((addr['lng'] ?? '').toString());
    final city = (addr['city'] ?? '').toString().trim();
    final line = (addr['address_line'] ?? '').toString().trim();
    final pincode = (addr['pincode'] ?? '').toString().trim();

    if (lat == null || lng == null) {
      final query = [line, city, pincode].where((v) => v.isNotEmpty).join(', ');
      if (query.isNotEmpty) {
        try {
          final results = await locationFromAddress(query);
          if (results.isNotEmpty) {
            lat = results.first.latitude;
            lng = results.first.longitude;
          }
        } catch (_) {}
      }
    }

    if (lat == null || lng == null) {
      _snack('Unable to locate this address. Please try current location.');
      return;
    }

    ApiClient.currentStoreId = null; // will be refreshed by _loadHomeData
    ApiClient.currentStoreIds = const [];
    if (mounted) {
      setState(() {
        _currentLocation = city.isNotEmpty
            ? city
            : (line.isNotEmpty ? line : 'Selected Location');
        _lastKnownLat = lat;
        _lastKnownLng = lng;
      });
    }
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
    return PopScope(
      // If not on Home tab (0), back goes to Home instead of exiting
      canPop: _tab == 0,
      onPopInvokedWithResult: (didPop, result) {
        if (!didPop && _tab != 0) {
          setState(() => _tab = 0);
        }
      },
      child: Scaffold(
        backgroundColor: const Color(0xFFF8FAFC),
        appBar: _buildAppBar(),
        body: IndexedStack(
          index: _tab,
          children: [
            _homeBody(),
            _categoriesBody(),
            const OrdersScreen(),
            _deliverBody(),
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
              icon: Icon(Icons.local_shipping_outlined),
              activeIcon: Icon(Icons.local_shipping_rounded),
              label: 'Parcel',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.person_outline_rounded),
              activeIcon: Icon(Icons.person_rounded),
              label: 'Profile',
            ),
          ],
        ),
      ), // end Scaffold
    ); // end PopScope
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
      bottom: const PreferredSize(
        preferredSize: Size.fromHeight(52),
        child: AnimatedSearchBar(),
      ),
    );
  }

  // ── HOME BODY ───────────────────────────────────────────────────────────────
  Widget _homeBody() {
    if (_isLoading) {
      return const BfPageLoader(message: 'Finding fashion near you...');
    }
    return RefreshIndicator(
      color: const Color(0xFF22C55E),
      backgroundColor: const Color(0xFF0D2015),
      strokeWidth: 2.5,
      onRefresh: _loadHomeDataForCurrentSelection,
      child: ListView(
        padding: EdgeInsets.zero,
        children: [
          // ── Premium dark header strip ──────────────────────────────
          Container(
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                colors: [Color(0xFF052E16), Color(0xFF0F172A)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
            ),
            padding: const EdgeInsets.fromLTRB(16, 10, 16, 14),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Hey ${UserSession.instance.name?.split(' ').first ?? 'there'} 👋',
                        style: const TextStyle(
                          color: Color(0xFF4ADE80),
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(height: 2),
                      const Text(
                        'What are you shopping for today?',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 15,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 5,
                  ),
                  decoration: BoxDecoration(
                    color: const Color(0xFF16A34A),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        Icons.electric_bolt_rounded,
                        color: Colors.white,
                        size: 13,
                      ),
                      SizedBox(width: 4),
                      Text(
                        '60 MIN',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 11,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          _locationBar(),
          _promoBannerStrip(),
          _trendingTagsRow(),
          const StoreClosedBanner(),
          if (_outOfServiceArea) ...[
            _serviceAreaGate(),
          ] else ...[
            _heroBanner(),
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
              'UNDER ₹999',
              actionLabel: 'View All',
              onAction: () => Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (_) => const AllProductsScreen(maxPrice: 999),
                ),
              ),
            ),
            _under999.isNotEmpty ? _under999Cards() : _stockOutBanner(),
            _sectionHeader(
              '₹999 - ₹1999',
              actionLabel: 'View All',
              onAction: () => Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (_) =>
                      const AllProductsScreen(minPrice: 999, maxPrice: 1999),
                ),
              ),
            ),
            _under1999.isNotEmpty ? _under1999Cards() : _stockOutBanner(),
            _lightBannerStrip(),
            _sectionHeader(
              'TOP BRANDS',
              actionLabel: 'View All',
              onAction: () => Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const AllBrandsScreen()),
              ),
            ),
            _topBrands(),
            _sectionHeader('SHOP BY CATEGORY'),
            _shopByCategorySection(),
            _featuresRow(),
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
              _loadHomeDataForCurrentSelection();
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
              ApiClient.currentStoreIds = const [];
              setState(() {
                _outOfServiceArea = false;
                _currentLocation = 'Bhubaneswar';
                _lastKnownLat = null;
                _lastKnownLng = null;
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

  // ── Trending tag chips (home body only) ─────────────────────────────────
  static const _trendingTags = [
    '🔥 Trending',
    '👗 Kurta Sets',
    '👕 T-Shirts',
    '🎀 Ethnic Wear',
    '👟 Sneakers',
    '💄 Beauty',
    '🎒 Bags',
    '⌚ Watches',
    '🏠 Home Decor',
    '🧒 Kids',
    '💍 Jewellery',
    '🩴 Sandals',
  ];

  // ── Promo Banner Strip ────────────────────────────────────────────────────
  static const _promoCards = [
    {
      'tag': 'FIRST ORDER',
      'title': '50% OFF UP TO ₹300',
      'subtitle': 'On your very first order.\nNo code needed — auto-applied!',
      'icon': '🎉',
      'gradient': [Color(0xFF16A34A), Color(0xFF065F46)],
      'route': 'allProducts',
    },
    {
      'tag': 'REFER & EARN',
      'title': '₹100 for You & Friend',
      'subtitle': 'Share your referral code.\nBoth of you get ₹100 off!',
      'icon': '🎁',
      'gradient': [Color(0xFF7C3AED), Color(0xFF4338CA)],
      'route': 'refer',
    },
    {
      'tag': 'DONATE & SAVE',
      'title': 'Extra 5% Discount',
      'subtitle': 'Donate old clothes & unlock\nup to 5% off on every order.',
      'icon': '♻️',
      'gradient': [Color(0xFF0D9488), Color(0xFF0E7490)],
      'route': 'oldClothes',
    },
    {
      'tag': 'DAILY SPIN',
      'title': 'Spin & Win! 🎡',
      'subtitle': 'Spin the wheel every day.\nWin discounts & big surprises!',
      'icon': '🎰',
      'gradient': [Color(0xFFEC4899), Color(0xFFBE185D)],
      'route': 'spinWheel',
    },
    {
      'tag': 'FASHION QUEST',
      'title': '1000-Level Game 🎮',
      'subtitle': '10 levels/day = +5% off!\nConquer all 1000 levels. 🔥',
      'icon': '🃏',
      'gradient': [Color(0xFF7C3AED), Color(0xFF0EA5E9)],
      'route': 'fashionQuest',
    },
  ];

  Widget _promoBannerStrip() {
    return Column(
      children: [
        SizedBox(
          height: 128,
          child: PageView.builder(
            controller: _promoPageController,
            onPageChanged: (i) => setState(() => _promoPage = i),
            itemCount: _promoCards.length,
            itemBuilder: (ctx, i) {
              final card = _promoCards[i];
              final gradColors = card['gradient'] as List<Color>;
              return GestureDetector(
                onTap: () {
                  final route = card['route'] as String;
                  if (route == 'refer') {
                    Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) => const ReferEarnScreen(),
                      ),
                    );
                  } else if (route == 'oldClothes') {
                    Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) => const OldClothesScreen(),
                      ),
                    );
                  } else if (route == 'spinWheel') {
                    Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) => const SpinWheelScreen(),
                      ),
                    );
                  } else if (route == 'fashionQuest') {
                    Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) => const FashionQuestScreen(),
                      ),
                    );
                  } else {
                    Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) => const AllProductsScreen(),
                      ),
                    );
                  }
                },
                child: Container(
                  margin: const EdgeInsets.fromLTRB(12, 10, 12, 4),
                  padding: const EdgeInsets.fromLTRB(18, 14, 14, 14),
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: gradColors,
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    borderRadius: BorderRadius.circular(18),
                    boxShadow: [
                      BoxShadow(
                        color: gradColors[0].withAlpha(80),
                        blurRadius: 14,
                        offset: const Offset(0, 6),
                      ),
                    ],
                  ),
                  child: Row(
                    children: [
                      // Text side
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 8,
                                vertical: 3,
                              ),
                              decoration: BoxDecoration(
                                color: Colors.white.withAlpha(50),
                                borderRadius: BorderRadius.circular(20),
                              ),
                              child: Text(
                                card['tag'] as String,
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 9.5,
                                  fontWeight: FontWeight.w800,
                                  letterSpacing: 1.1,
                                ),
                              ),
                            ),
                            const SizedBox(height: 6),
                            Text(
                              card['title'] as String,
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 20,
                                fontWeight: FontWeight.w900,
                                height: 1.1,
                                letterSpacing: -0.5,
                              ),
                            ),
                            const SizedBox(height: 5),
                            Text(
                              card['subtitle'] as String,
                              style: TextStyle(
                                color: Colors.white.withAlpha(220),
                                fontSize: 11.5,
                                height: 1.35,
                              ),
                            ),
                          ],
                        ),
                      ),
                      // Emoji / icon side
                      Text(
                        card['icon'] as String,
                        style: const TextStyle(fontSize: 52),
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        ),
        // Dot indicators
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: List.generate(_promoCards.length, (i) {
            final sel = i == _promoPage;
            final color = sel
                ? (_promoCards[i]['gradient'] as List<Color>)[0]
                : const Color(0xFFD1D5DB);
            return AnimatedContainer(
              duration: const Duration(milliseconds: 300),
              margin: const EdgeInsets.symmetric(horizontal: 3),
              width: sel ? 18 : 6,
              height: 6,
              decoration: BoxDecoration(
                color: color,
                borderRadius: BorderRadius.circular(3),
              ),
            );
          }),
        ),
      ],
    );
  }

  Widget _trendingTagsRow() {
    return Container(
      margin: const EdgeInsets.fromLTRB(12, 14, 12, 0),
      decoration: BoxDecoration(
        color: const Color(0xFFF0FDF4),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFFBBF7D0), width: 1.2),
        boxShadow: const [
          BoxShadow(
            color: Color(0x08000000),
            blurRadius: 8,
            offset: Offset(0, 2),
          ),
        ],
      ),
      padding: const EdgeInsets.fromLTRB(0, 14, 0, 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 11),
            child: Row(
              children: [
                const Text(
                  'Trending Now',
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                    color: Color(0xFF0F172A),
                  ),
                ),
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 7,
                    vertical: 2,
                  ),
                  decoration: BoxDecoration(
                    color: _green,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Text(
                    'HOT',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 9,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 0.6,
                    ),
                  ),
                ),
                const Spacer(),
                const Text('🔥', style: TextStyle(fontSize: 16)),
              ],
            ),
          ),
          // Pills
          SizedBox(
            height: 38,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 0),
              itemCount: _trendingTags.length,
              separatorBuilder: (_, _) => const SizedBox(width: 8),
              itemBuilder: (_, i) {
                final tag = _trendingTags[i];
                final searchText = tag
                    .replaceAll(RegExp(r'[^\w\s\-]'), '')
                    .trim();
                final isHot = i == 0;
                return GestureDetector(
                  onTap: () => Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (_) =>
                          AllProductsScreen(initialSearch: searchText),
                    ),
                  ),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14),
                    decoration: BoxDecoration(
                      color: isHot ? _green : Colors.white,
                      borderRadius: BorderRadius.circular(19),
                      border: isHot
                          ? null
                          : Border.all(
                              color: const Color(0xFFD1FAE5),
                              width: 1.5,
                            ),
                      boxShadow: [
                        BoxShadow(
                          color: isHot
                              ? _green.withValues(alpha: 0.28)
                              : const Color(0x0A000000),
                          blurRadius: isHot ? 10 : 4,
                          offset: const Offset(0, 2),
                        ),
                      ],
                    ),
                    child: Center(
                      child: Text(
                        tag,
                        style: TextStyle(
                          fontSize: 12.5,
                          fontWeight: FontWeight.w600,
                          color: isHot ? Colors.white : const Color(0xFF065F46),
                        ),
                      ),
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

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

  // ── Hero Banner Slider ────────────────────────────────────────────────────
  Widget _heroBanner() {
    return Container(
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
      child: Stack(
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(20),
            child: PageView.builder(
              controller: _heroPageController,
              itemCount: _heroCards.length,
              onPageChanged: (i) => setState(() => _heroPage = i),
              itemBuilder: (_, i) {
                final card = _heroCards[i];
                final route = card['route'] as String;
                return GestureDetector(
                  onTap: () {
                    if (route == 'mens') {
                      Navigator.of(context).push(
                        MaterialPageRoute(
                          builder: (_) => const AllProductsScreen(
                            categoryName: 'Men',
                            initialSort: 'newest',
                          ),
                        ),
                      );
                    } else if (route == 'women') {
                      Navigator.of(context).push(
                        MaterialPageRoute(
                          builder: (_) => const AllProductsScreen(
                            categoryName: 'Women',
                            initialSort: 'newest',
                          ),
                        ),
                      );
                    } else if (route == 'accessories') {
                      Navigator.of(context).push(
                        MaterialPageRoute(
                          builder: (_) => const AllProductsScreen(
                            initialSearch: 'accessories',
                          ),
                        ),
                      );
                    } else if (route == 'mensFootwear') {
                      Navigator.of(context).push(
                        MaterialPageRoute(
                          builder: (_) => const AllProductsScreen(
                            initialSearch: 'men footwear',
                          ),
                        ),
                      );
                    } else if (route == 'womensFootwear') {
                      Navigator.of(context).push(
                        MaterialPageRoute(
                          builder: (_) => const AllProductsScreen(
                            initialSearch: 'women footwear',
                          ),
                        ),
                      );
                    } else {
                      Navigator.of(context).push(
                        MaterialPageRoute(
                          builder: (_) => const AllProductsScreen(),
                        ),
                      );
                    }
                  },
                  child: Image.asset(
                    card['image'] as String,
                    fit: BoxFit.cover,
                    width: double.infinity,
                    errorBuilder: (_, _, _) => Container(
                      color: const Color(0xFF16A34A),
                      child: const Center(
                        child: Icon(
                          Icons.image_not_supported_outlined,
                          color: Colors.white,
                          size: 40,
                        ),
                      ),
                    ),
                  ),
                );
              },
            ),
          ),
          // Dot indicators
          Positioned(
            bottom: 10,
            left: 0,
            right: 0,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: List.generate(
                _heroCards.length,
                (i) => AnimatedContainer(
                  duration: const Duration(milliseconds: 300),
                  margin: const EdgeInsets.symmetric(horizontal: 3),
                  width: _heroPage == i ? 20 : 6,
                  height: 6,
                  decoration: BoxDecoration(
                    color: _heroPage == i
                        ? Colors.white
                        : Colors.white.withValues(alpha: 0.5),
                    borderRadius: BorderRadius.circular(3),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ── Light Style Banner Strip ──────────────────────────────────────────────
  // Save your banner images to assets/images/ with these exact filenames:
  //   50.jpeg  women.jpeg  homepick.jpeg  hair.jpeg  Mens.jpeg
  static const _lightBanners = [
    {
      'image': 'assets/images/50.jpeg',
      'headline1': 'Flat',
      'headline2': '50%',
      'headline3': 'OFF',
      'sub': 'Up to ₹300 on First Order',
      'emoji': '🛍️',
      'bg': Color(0xFFF0FDF4),
      'accent': Color(0xFF16A34A),
      'route': 'sale',
    },
    {
      'image': 'assets/images/women.jpeg',
      'headline1': 'Trending',
      'headline2': "Women's",
      'headline3': 'Styles',
      'sub': 'Fresh Styles  •  Fast Delivery',
      'emoji': '👗',
      'bg': Color(0xFFFFF7ED),
      'accent': Color(0xFF15803D),
      'route': 'women',
    },
    {
      'image': 'assets/images/homepick.jpeg',
      'headline1': 'Fresh',
      'headline2': 'Home',
      'headline3': 'Picks',
      'sub': 'Up to 70% OFF',
      'emoji': '🏠',
      'bg': Color(0xFFF0FDF4),
      'accent': Color(0xFF16A34A),
      'route': 'homeLiving',
    },
    {
      'image': 'assets/images/hair.jpeg',
      'headline1': 'Stylish',
      'headline2': 'Hair',
      'headline3': 'Accessories',
      'sub': 'Up to 70% OFF',
      'emoji': '💇‍♀️',
      'bg': Color(0xFFFDF2F8),
      'accent': Color(0xFF9D174D),
      'route': 'hairAccessories',
    },
    {
      'image': 'assets/images/Mens.jpeg',
      'headline1': 'Trending',
      'headline2': "Men's",
      'headline3': 'Styles',
      'sub': 'Up to 70% OFF',
      'emoji': '👔',
      'bg': Color(0xFFF8F4EC),
      'accent': Color(0xFF92400E),
      'route': 'mens',
    },
  ];

  int _lightBannerPage = 0;
  final PageController _lightBannerController = PageController();
  Timer? _lightBannerTimer;

  void _initLightBannerTimer() {
    _lightBannerTimer?.cancel();
    _lightBannerTimer = Timer.periodic(const Duration(seconds: 9), (_) {
      if (!mounted) return;
      if (!_lightBannerController.hasClients) return;
      if (_lightBannerController.positions.isEmpty) return;
      if (!_lightBannerController.position.hasViewportDimension) return;
      final next = (_lightBannerPage + 1) % _lightBanners.length;
      try {
        _lightBannerController.animateToPage(
          next,
          duration: const Duration(milliseconds: 500),
          curve: Curves.easeInOut,
        );
      } catch (_) {}
    });
  }

  Widget _lightBannerStrip() {
    return Column(
      children: [
        const SizedBox(height: 16),
        SizedBox(
          height: 210,
          child: PageView.builder(
            controller: _lightBannerController,
            onPageChanged: (i) => setState(() => _lightBannerPage = i),
            itemCount: _lightBanners.length,
            itemBuilder: (ctx, i) {
              final b = _lightBanners[i];
              final route = b['route'] as String;
              return GestureDetector(
                onTap: () {
                  if (route == 'sale') {
                    Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) => const AllProductsScreen(
                          categoryName: 'Sale & Discounts',
                          initialSort: 'discount',
                        ),
                      ),
                    );
                  } else if (route == 'newArrivals') {
                    Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) => const AllProductsScreen(
                          categoryName: 'New Arrivals',
                          initialSort: 'newest',
                          maxPrice: 999,
                        ),
                      ),
                    );
                  } else if (route == 'mens') {
                    Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) => const AllProductsScreen(
                          categoryName: 'Men',
                          initialSort: 'newest',
                        ),
                      ),
                    );
                  } else if (route == 'women') {
                    Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) => const AllProductsScreen(
                          categoryName: 'Women',
                          initialSort: 'newest',
                        ),
                      ),
                    );
                  } else if (route == 'hairAccessories') {
                    Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) => const AllProductsScreen(
                          initialSearch: 'hair accessories',
                        ),
                      ),
                    );
                  } else if (route == 'homeLiving') {
                    Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) => const AllProductsScreen(
                          categoryName: 'Home Living',
                        ),
                      ),
                    );
                  } else {
                    Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) => const AllProductsScreen(),
                      ),
                    );
                  }
                },
                child: Container(
                  margin: const EdgeInsets.fromLTRB(12, 0, 12, 4),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(20),
                    boxShadow: const [
                      BoxShadow(
                        color: Color(0x14000000),
                        blurRadius: 12,
                        offset: Offset(0, 4),
                      ),
                    ],
                  ),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(20),
                    child: Image.asset(
                      b['image'] as String,
                      fit: BoxFit.cover,
                      width: double.infinity,
                      height: 210,
                      // Fallback to styled card when image not yet placed
                      errorBuilder: (ctx, e, st) => Container(
                        color: b['bg'] as Color,
                        child: Row(
                          children: [
                            Expanded(
                              flex: 6,
                              child: Padding(
                                padding: const EdgeInsets.fromLTRB(
                                  20,
                                  16,
                                  8,
                                  16,
                                ),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    RichText(
                                      text: TextSpan(
                                        children: [
                                          TextSpan(
                                            text: '${b['headline1']}\n',
                                            style: const TextStyle(
                                              color: Color(0xFF0F172A),
                                              fontSize: 22,
                                              fontWeight: FontWeight.w900,
                                              height: 1.1,
                                              letterSpacing: -0.5,
                                            ),
                                          ),
                                          TextSpan(
                                            text: '${b['headline2']}\n',
                                            style: TextStyle(
                                              color: b['accent'] as Color,
                                              fontSize: 22,
                                              fontWeight: FontWeight.w900,
                                              height: 1.1,
                                            ),
                                          ),
                                          if ((b['headline3'] as String)
                                              .isNotEmpty)
                                            TextSpan(
                                              text: b['headline3'] as String,
                                              style: TextStyle(
                                                color: b['accent'] as Color,
                                                fontSize: 13,
                                                fontWeight: FontWeight.w700,
                                              ),
                                            ),
                                        ],
                                      ),
                                    ),
                                    const SizedBox(height: 8),
                                    Text(
                                      b['sub'] as String,
                                      style: const TextStyle(
                                        color: Color(0xFF6B7280),
                                        fontSize: 11,
                                      ),
                                    ),
                                    const SizedBox(height: 10),
                                    Container(
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: 14,
                                        vertical: 7,
                                      ),
                                      decoration: BoxDecoration(
                                        color: b['accent'] as Color,
                                        borderRadius: BorderRadius.circular(20),
                                      ),
                                      child: const Row(
                                        mainAxisSize: MainAxisSize.min,
                                        children: [
                                          Text(
                                            'Shop Now',
                                            style: TextStyle(
                                              color: Colors.white,
                                              fontSize: 11.5,
                                              fontWeight: FontWeight.w700,
                                            ),
                                          ),
                                          SizedBox(width: 4),
                                          Icon(
                                            Icons.arrow_forward_rounded,
                                            color: Colors.white,
                                            size: 13,
                                          ),
                                        ],
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                            Expanded(
                              flex: 4,
                              child: Center(
                                child: Text(
                                  b['emoji'] as String,
                                  style: const TextStyle(fontSize: 72),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              );
            },
          ),
        ),
        // Dot indicators
        const SizedBox(height: 8),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: List.generate(_lightBanners.length, (i) {
            final sel = i == _lightBannerPage;
            final color = sel
                ? (_lightBanners[i]['accent'] as Color)
                : const Color(0xFFD1D5DB);
            return AnimatedContainer(
              duration: const Duration(milliseconds: 300),
              margin: const EdgeInsets.symmetric(horizontal: 3),
              width: sel ? 18 : 6,
              height: 6,
              decoration: BoxDecoration(
                color: color,
                borderRadius: BorderRadius.circular(3),
              ),
            );
          }),
        ),
        const SizedBox(height: 4),
      ],
    );
  }

  // ── Features Row ─────────────────────────────────────────────────────────
  Widget _featuresRow() {
    const items = [
      {
        'icon': Icons.electric_bolt_rounded,
        'label': '60 MIN\nDELIVERY',
        'color': Color(0xFF16A34A),
      },
      {
        'icon': Icons.checkroom_rounded,
        'label': 'TRENDY\nFASHION',
        'color': Color(0xFF6366F1),
      },
      {
        'icon': Icons.home_work_rounded,
        'label': 'TRY & BUY\nAT HOME',
        'color': Color(0xFFF59E0B),
      },
      {
        'icon': Icons.replay_rounded,
        'label': 'EASY\nRETURNS',
        'color': Color(0xFFEC4899),
      },
    ];
    return Container(
      margin: const EdgeInsets.fromLTRB(12, 14, 12, 0),
      padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 4),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF0F172A), Color(0xFF1E293B)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(18),
        boxShadow: const [
          BoxShadow(
            color: Color(0x30000000),
            blurRadius: 12,
            offset: Offset(0, 4),
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
                    Container(
                      width: 44,
                      height: 44,
                      decoration: BoxDecoration(
                        color: (f['color'] as Color).withValues(alpha: 0.18),
                        shape: BoxShape.circle,
                      ),
                      child: Icon(
                        f['icon'] as IconData,
                        size: 22,
                        color: f['color'] as Color,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      f['label']! as String,
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        fontSize: 9.5,
                        fontWeight: FontWeight.w800,
                        color: Colors.white,
                        height: 1.3,
                        letterSpacing: 0.3,
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
      padding: const EdgeInsets.fromLTRB(16, 22, 16, 12),
      child: Row(
        children: [
          // Green left accent bar
          Container(
            width: 4,
            height: 22,
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFF16A34A), Color(0xFF4ADE80)],
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
              ),
              borderRadius: BorderRadius.circular(4),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              title,
              style: const TextStyle(
                fontSize: 17,
                fontWeight: FontWeight.w900,
                color: Color(0xFF0F172A),
                letterSpacing: 0.2,
              ),
            ),
          ),
          if (actionLabel != null)
            GestureDetector(
              onTap: onAction,
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 5,
                ),
                decoration: BoxDecoration(
                  color: const Color(0xFFDCFCE7),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      actionLabel,
                      style: const TextStyle(
                        fontSize: 12,
                        color: Color(0xFF16A34A),
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(width: 3),
                    const Icon(
                      Icons.arrow_forward_ios_rounded,
                      size: 10,
                      color: Color(0xFF16A34A),
                    ),
                  ],
                ),
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
                      gradient: const LinearGradient(
                        colors: [Color(0xFFDCFCE7), Color(0xFFBBF7D0)],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      borderRadius: BorderRadius.circular(20),
                      boxShadow: const [
                        BoxShadow(
                          color: Color(0x14000000),
                          blurRadius: 6,
                          offset: Offset(0, 2),
                        ),
                      ],
                    ),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(19),
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
                  const SizedBox(height: 6),
                  Text(
                    item['name']?.toString() ?? '',
                    textAlign: TextAlign.center,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF0F172A),
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
          final wishItem1 = WishlistItem(
            productId: item['id']?.toString() ?? '',
            name: name,
            price: price,
            imageUrl: img,
          );

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
                                  alignment: Alignment.topCenter,
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
                                    horizontal: 8,
                                    vertical: 4,
                                  ),
                                  decoration: BoxDecoration(
                                    gradient: const LinearGradient(
                                      colors: [
                                        Color(0xFFF59E0B),
                                        Color(0xFFEF4444),
                                      ],
                                      begin: Alignment.centerLeft,
                                      end: Alignment.centerRight,
                                    ),
                                    borderRadius: BorderRadius.circular(20),
                                    boxShadow: [
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
                                      Text(
                                        '✨',
                                        style: TextStyle(
                                          fontSize: 7,
                                          height: 1,
                                        ),
                                      ),
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
                                )
                              else
                                Container(
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
                                      Text(
                                        '⚡',
                                        style: TextStyle(
                                          fontSize: 7,
                                          height: 1,
                                        ),
                                      ),
                                      SizedBox(width: 3),
                                      Text(
                                        '+60 MIN',
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
                              WishlistManager.instance.toggle(wishItem1);
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
                                fontSize: 10,
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
                              fontSize: 14,
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
                                  fontSize: 15,
                                  fontWeight: FontWeight.w800,
                                  color: Color(0xFF0F172A),
                                ),
                              ),
                              if (origP.isNotEmpty && origP != price) ...[
                                const SizedBox(width: 4),
                                Text(
                                  '₹$origP',
                                  style: const TextStyle(
                                    fontSize: 11,
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
                              fontSize: 11,
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
          final price = _fmt(item['discount_price'] ?? item['price']);
          final origP = _fmt(item['price']);
          final off = item['off']?.toString() ?? _offLabel(item);
          final img = _imgUrl(item['image']);
          final wishItem = WishlistItem(
            productId: item['id']?.toString() ?? '',
            name: name,
            price: price,
            imageUrl: img,
          );

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
                                  alignment: Alignment.topCenter,
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
                                    horizontal: 8,
                                    vertical: 4,
                                  ),
                                  decoration: BoxDecoration(
                                    gradient: const LinearGradient(
                                      colors: [
                                        Color(0xFFF59E0B),
                                        Color(0xFFEF4444),
                                      ],
                                      begin: Alignment.centerLeft,
                                      end: Alignment.centerRight,
                                    ),
                                    borderRadius: BorderRadius.circular(20),
                                    boxShadow: [
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
                                      Text(
                                        '✨',
                                        style: TextStyle(
                                          fontSize: 7,
                                          height: 1,
                                        ),
                                      ),
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
                                )
                              else
                                Container(
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
                                      Text(
                                        '⚡',
                                        style: TextStyle(
                                          fontSize: 7,
                                          height: 1,
                                        ),
                                      ),
                                      SizedBox(width: 3),
                                      Text(
                                        '+60 MIN',
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
                              WishlistManager.instance.toggle(wishItem);
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
                                fontWeight: FontWeight.w800,
                                color: Color(0xFF94A3B8),
                                letterSpacing: 1,
                              ),
                            ),
                          const SizedBox(height: 3),
                          Text(
                            name,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF0F172A),
                              height: 1.25,
                            ),
                          ),
                          const Spacer(),
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.center,
                            children: [
                              Text(
                                '₹$price',
                                style: const TextStyle(
                                  fontSize: 15,
                                  fontWeight: FontWeight.w900,
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
                                width: 30,
                                height: 30,
                                decoration: BoxDecoration(
                                  gradient: const LinearGradient(
                                    colors: [
                                      Color(0xFF16A34A),
                                      Color(0xFF15803D),
                                    ],
                                    begin: Alignment.topLeft,
                                    end: Alignment.bottomRight,
                                  ),
                                  borderRadius: BorderRadius.circular(9),
                                  boxShadow: [
                                    BoxShadow(
                                      color: const Color(
                                        0xFF16A34A,
                                      ).withValues(alpha: 0.3),
                                      blurRadius: 6,
                                      offset: const Offset(0, 2),
                                    ),
                                  ],
                                ),
                                child: const Icon(
                                  Icons.shopping_cart_outlined,
                                  size: 15,
                                  color: Colors.white,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 5),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 7,
                              vertical: 2,
                            ),
                            decoration: BoxDecoration(
                              color: const Color(0xFFDCFCE7),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(
                              off,
                              style: const TextStyle(
                                fontSize: 10,
                                color: Color(0xFF16A34A),
                                fontWeight: FontWeight.w800,
                              ),
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

  // ── Shop By Category ───────────────────────────────────────────────────────

  /// Sort label map
  static const _shopSortLabels = {
    'newest': 'Newest',
    'price_asc': 'Price: Low → High',
    'price_desc': 'Price: High → Low',
    'name_asc': 'Name A–Z',
  };

  Widget _shopByCategorySection() {
    final sw = MediaQuery.of(context).size.width;
    final cardW = (sw - 16 * 2 - 12) / 2;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Category chips
        _shopCategoryChips(),
        // Sort + Filter toolbar
        _shopToolbar(),
        const SizedBox(height: 4),
        // Product grid
        if (_shopProducts.isEmpty && !_shopLoading)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: _stockOutBanner(),
          )
        else
          _shopProductGrid(cardW),
        // Loading spinner (initial load or show-more load)
        if (_shopLoading)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 20),
            child: Center(child: BfSpinner()),
          ),
        // Show More button
        if (!_shopLoading && _shopHasMore && _shopProducts.isNotEmpty)
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
            child: SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: () => _loadShopProducts(),
                icon: const Icon(
                  Icons.expand_more_rounded,
                  size: 18,
                  color: _green,
                ),
                label: const Text(
                  'Show More Products',
                  style: TextStyle(
                    color: _green,
                    fontWeight: FontWeight.w700,
                    fontSize: 14,
                  ),
                ),
                style: OutlinedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 13),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  side: const BorderSide(color: _green, width: 1.5),
                ),
              ),
            ),
          ),
        if (!_shopLoading && !_shopHasMore && _shopProducts.isNotEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 14),
            child: Center(
              child: Text(
                'You\'ve seen all ${_shopProducts.length} products',
                style: const TextStyle(
                  fontSize: 12,
                  color: Color(0xFF94A3B8),
                  fontWeight: FontWeight.w500,
                ),
              ),
            ),
          ),
      ],
    );
  }

  Widget _shopCategoryChips() {
    // Build chips: "All" + one per root category
    final chips = <Map<String, String?>>[
      {'id': null, 'name': 'All'},
      ..._categories.map(
        (c) => {
          'id': c['id']?.toString(),
          'name': (c['name'] ?? '').toString(),
        },
      ),
    ];
    return SizedBox(
      height: 42,
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 12),
        itemCount: chips.length,
        itemBuilder: (_, i) {
          final chip = chips[i];
          final selected = _shopCatChipIndex == i;
          return GestureDetector(
            onTap: () {
              if (_shopCatChipIndex == i) return;
              setState(() {
                _shopCatChipIndex = i;
                _shopCatId = chip['id'];
                _shopProducts = const [];
                _shopOffset = 0;
                _shopHasMore = false;
              });
              _loadShopProducts(reset: true);
            },
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              margin: const EdgeInsets.only(right: 8),
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              decoration: BoxDecoration(
                color: selected ? _green : Colors.white,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(
                  color: selected ? _green : const Color(0xFFE2E8F0),
                  width: 1.5,
                ),
                boxShadow: selected
                    ? [
                        const BoxShadow(
                          color: Color(0x2216A34A),
                          blurRadius: 8,
                          offset: Offset(0, 2),
                        ),
                      ]
                    : const [
                        BoxShadow(color: Color(0x08000000), blurRadius: 4),
                      ],
              ),
              child: Text(
                chip['name'] ?? '',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: selected ? Colors.white : const Color(0xFF374151),
                  letterSpacing: 0.2,
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _shopToolbar() {
    final activeFilters = (_shopMinPrice != null || _shopMaxPrice != null);
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 0),
      child: Row(
        children: [
          // Sort pill
          Expanded(
            child: GestureDetector(
              onTap: _showShopSortSheet,
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 9,
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
                  children: [
                    const Icon(
                      Icons.sort_rounded,
                      size: 16,
                      color: Color(0xFF64748B),
                    ),
                    const SizedBox(width: 6),
                    Text(
                      _shopSortLabels[_shopSort] ?? 'Newest',
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: Color(0xFF374151),
                      ),
                    ),
                    const Spacer(),
                    const Icon(
                      Icons.keyboard_arrow_down_rounded,
                      size: 18,
                      color: Color(0xFF94A3B8),
                    ),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(width: 10),
          // Filter button
          GestureDetector(
            onTap: _showShopFilterSheet,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
              decoration: BoxDecoration(
                color: activeFilters ? _green : Colors.white,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(
                  color: activeFilters ? _green : const Color(0xFFE2E8F0),
                ),
                boxShadow: const [
                  BoxShadow(color: Color(0x08000000), blurRadius: 4),
                ],
              ),
              child: Row(
                children: [
                  Icon(
                    Icons.tune_rounded,
                    size: 16,
                    color: activeFilters
                        ? Colors.white
                        : const Color(0xFF64748B),
                  ),
                  const SizedBox(width: 6),
                  Text(
                    activeFilters ? 'Filtered' : 'Filter',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: activeFilters
                          ? Colors.white
                          : const Color(0xFF374151),
                    ),
                  ),
                  if (activeFilters) ...[
                    const SizedBox(width: 6),
                    GestureDetector(
                      onTap: () {
                        setState(() {
                          _shopMinPrice = null;
                          _shopMaxPrice = null;
                        });
                        _loadShopProducts(reset: true);
                      },
                      child: const Icon(
                        Icons.close_rounded,
                        size: 14,
                        color: Colors.white,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  void _showShopSortSheet() {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) {
        return Padding(
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Sort By',
                style: TextStyle(
                  fontSize: 17,
                  fontWeight: FontWeight.w800,
                  color: Color(0xFF0F172A),
                ),
              ),
              const SizedBox(height: 16),
              ..._shopSortLabels.entries.map((e) {
                final selected = _shopSort == e.key;
                return GestureDetector(
                  onTap: () {
                    Navigator.pop(context);
                    if (_shopSort == e.key) return;
                    setState(() => _shopSort = e.key);
                    _loadShopProducts(reset: true);
                  },
                  child: Container(
                    margin: const EdgeInsets.only(bottom: 6),
                    padding: const EdgeInsets.symmetric(
                      horizontal: 14,
                      vertical: 13,
                    ),
                    decoration: BoxDecoration(
                      color: selected
                          ? const Color(0xFFECFDF5)
                          : const Color(0xFFF8FAFC),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: selected ? _green : const Color(0xFFE2E8F0),
                      ),
                    ),
                    child: Row(
                      children: [
                        Text(
                          e.value,
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                            color: selected ? _green : const Color(0xFF374151),
                          ),
                        ),
                        const Spacer(),
                        if (selected)
                          const Icon(
                            Icons.check_circle_rounded,
                            color: _green,
                            size: 18,
                          ),
                      ],
                    ),
                  ),
                );
              }),
            ],
          ),
        );
      },
    );
  }

  void _showShopFilterSheet() {
    double? tempMin = _shopMinPrice;
    double? tempMax = _shopMaxPrice;

    final priceRanges = [
      {'label': 'Under ₹499', 'min': null, 'max': 499.0},
      {'label': '₹499 – ₹999', 'min': 499.0, 'max': 999.0},
      {'label': '₹999 – ₹1999', 'min': 999.0, 'max': 1999.0},
      {'label': '₹1999 – ₹4999', 'min': 1999.0, 'max': 4999.0},
      {'label': 'Above ₹4999', 'min': 4999.0, 'max': null},
    ];

    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.white,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (ctx2, setSheetState) {
            return Padding(
              padding: EdgeInsets.fromLTRB(
                20,
                20,
                20,
                20 + MediaQuery.of(ctx2).viewInsets.bottom,
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const Expanded(
                        child: Text(
                          'Filter',
                          style: TextStyle(
                            fontSize: 17,
                            fontWeight: FontWeight.w800,
                            color: Color(0xFF0F172A),
                          ),
                        ),
                      ),
                      TextButton(
                        onPressed: () {
                          setSheetState(() {
                            tempMin = null;
                            tempMax = null;
                          });
                        },
                        child: const Text(
                          'Clear',
                          style: TextStyle(color: Color(0xFF94A3B8)),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  const Text(
                    'Price Range',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF64748B),
                      letterSpacing: 0.3,
                    ),
                  ),
                  const SizedBox(height: 10),
                  ...priceRanges.map((r) {
                    final isSelected =
                        tempMin == (r['min'] as double?) &&
                        tempMax == (r['max'] as double?);
                    return GestureDetector(
                      onTap: () {
                        setSheetState(() {
                          if (isSelected) {
                            tempMin = null;
                            tempMax = null;
                          } else {
                            tempMin = r['min'] as double?;
                            tempMax = r['max'] as double?;
                          }
                        });
                      },
                      child: Container(
                        margin: const EdgeInsets.only(bottom: 6),
                        padding: const EdgeInsets.symmetric(
                          horizontal: 14,
                          vertical: 12,
                        ),
                        decoration: BoxDecoration(
                          color: isSelected
                              ? const Color(0xFFECFDF5)
                              : const Color(0xFFF8FAFC),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(
                            color: isSelected
                                ? _green
                                : const Color(0xFFE2E8F0),
                          ),
                        ),
                        child: Row(
                          children: [
                            Text(
                              r['label'] as String,
                              style: TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w600,
                                color: isSelected
                                    ? _green
                                    : const Color(0xFF374151),
                              ),
                            ),
                            const Spacer(),
                            if (isSelected)
                              const Icon(
                                Icons.check_circle_rounded,
                                color: _green,
                                size: 18,
                              ),
                          ],
                        ),
                      ),
                    );
                  }),
                  const SizedBox(height: 14),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: () {
                        Navigator.pop(ctx);
                        setState(() {
                          _shopMinPrice = tempMin;
                          _shopMaxPrice = tempMax;
                        });
                        _loadShopProducts(reset: true);
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: _green,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                        elevation: 0,
                      ),
                      child: const Text(
                        'Apply Filter',
                        style: TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w700,
                          fontSize: 15,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  Widget _shopProductGrid(double cardW) {
    final items = _shopProducts;
    final rows = <Widget>[];
    for (int i = 0; i < items.length; i += 2) {
      final left = _shopProductCard(items[i], cardW);
      final right = i + 1 < items.length
          ? _shopProductCard(items[i + 1], cardW)
          : SizedBox(width: cardW);
      rows.add(
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [left, const SizedBox(width: 12), right],
          ),
        ),
      );
    }
    return Column(children: rows);
  }

  Widget _shopProductCard(Map<String, dynamic> item, double cardW) {
    final name = item['name']?.toString() ?? 'Product';
    final brand = item['brand']?.toString() ?? '';
    final price = _fmt(item['discount_price'] ?? item['price']);
    final origP = _fmt(item['price']);
    final off = item['off']?.toString() ?? _offLabel(item);
    final img = _imgUrl(item['image']);
    final wishItem = WishlistItem(
      productId: item['id']?.toString() ?? '',
      name: name,
      price: price,
      imageUrl: img,
    );

    return GestureDetector(
      onTap: item['id'] != null ? () => _openProduct(item) : null,
      child: SizedBox(
        width: cardW,
        child: Container(
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            boxShadow: const [
              BoxShadow(
                color: Color(0x0F000000),
                blurRadius: 10,
                offset: Offset(0, 3),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Image
              AspectRatio(
                aspectRatio: 0.85,
                child: Stack(
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
                              width: double.infinity,
                              height: double.infinity,
                              placeholder: (ctx, url) =>
                                  Container(color: const Color(0xFFF1F5F9)),
                              errorWidget: (ctx, url, err) => Container(
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
                    // Badge
                    Positioned(
                      top: 8,
                      left: 8,
                      child: item['is_bestseller'] == true
                          ? _shopBadge('BESTSELLER', const Color(0xFFDC2626))
                          : item['is_try_and_buy'] == true
                          ? _shopBadge('✨ Try & Buy', const Color(0xFFF59E0B))
                          : _shopBadge('⚡ +60 MIN', _green),
                    ),
                    // Wishlist
                    Positioned(
                      top: 7,
                      right: 7,
                      child: GestureDetector(
                        onTap: () {
                          final id = item['id']?.toString() ?? '';
                          if (id.isEmpty) return;
                          WishlistManager.instance.toggle(wishItem);
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
              // Info
              Padding(
                padding: const EdgeInsets.fromLTRB(10, 8, 10, 10),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (brand.isNotEmpty)
                      Text(
                        brand.toUpperCase(),
                        style: const TextStyle(
                          fontSize: 9,
                          fontWeight: FontWeight.w800,
                          color: Color(0xFF94A3B8),
                          letterSpacing: 1,
                        ),
                      ),
                    const SizedBox(height: 3),
                    Text(
                      name,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF0F172A),
                        height: 1.25,
                      ),
                    ),
                    const SizedBox(height: 7),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        Text(
                          '₹$price',
                          style: const TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w900,
                            color: Color(0xFF0F172A),
                          ),
                        ),
                        if (origP.isNotEmpty && origP != price) ...[
                          const SizedBox(width: 5),
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
                        GestureDetector(
                          onTap: item['id'] != null
                              ? () => _openProduct(item)
                              : null,
                          child: Container(
                            width: 30,
                            height: 30,
                            decoration: BoxDecoration(
                              gradient: const LinearGradient(
                                colors: [Color(0xFF16A34A), Color(0xFF15803D)],
                                begin: Alignment.topLeft,
                                end: Alignment.bottomRight,
                              ),
                              borderRadius: BorderRadius.circular(9),
                              boxShadow: [
                                BoxShadow(
                                  color: const Color(
                                    0xFF16A34A,
                                  ).withValues(alpha: 0.3),
                                  blurRadius: 6,
                                  offset: const Offset(0, 2),
                                ),
                              ],
                            ),
                            child: const Icon(
                              Icons.shopping_cart_outlined,
                              size: 15,
                              color: Colors.white,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 5),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 7,
                        vertical: 2,
                      ),
                      decoration: BoxDecoration(
                        color: const Color(0xFFDCFCE7),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        off,
                        style: const TextStyle(
                          fontSize: 10,
                          color: Color(0xFF16A34A),
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _shopBadge(String label, Color color) {
    final isTryBuy = label.contains('Try');
    final is60 = label.contains('60');

    if (isTryBuy) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
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
      );
    }

    // 60 MIN or BESTSELLER pills
    final displayLabel = label.replaceAll('⚡ ', '').replaceAll('✨ ', '');
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (is60) ...[
            const Text('⚡', style: TextStyle(fontSize: 7, height: 1)),
            const SizedBox(width: 3),
          ],
          Text(
            displayLabel,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 8,
              fontWeight: FontWeight.w900,
              letterSpacing: 0.3,
            ),
          ),
        ],
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

  // ── Drawer category avatar ──────────────────────────────────────────────
  static const _drawerCatColors = [
    [Color(0xFFFFE4E6), Color(0xFFE11D48)], // pink
    [Color(0xFFDBEAFE), Color(0xFF2563EB)], // blue
    [Color(0xFFFEF9C3), Color(0xFFCA8A04)], // yellow
    [Color(0xFFDCFCE7), Color(0xFF16A34A)], // green
    [Color(0xFFF3E8FF), Color(0xFF7C3AED)], // purple
    [Color(0xFFFFEDD5), Color(0xFFEA580C)], // orange
    [Color(0xFFE0F2FE), Color(0xFF0284C7)], // sky
    [Color(0xFFFCE7F3), Color(0xFFDB2777)], // rose
  ];

  static const _drawerCatIcons = [
    Icons.woman_rounded,
    Icons.man_rounded,
    Icons.child_care_rounded,
    Icons.face_retouching_natural,
    Icons.home_rounded,
    Icons.sports_basketball_rounded,
    Icons.checkroom_rounded,
    Icons.auto_awesome_rounded,
  ];

  Widget _drawerCatAvatar(Map<String, dynamic> cat, int index) {
    final imgUrl = _imgUrl(cat['category_url'] ?? cat['image']);
    final bg = _drawerCatColors[index % _drawerCatColors.length][0];
    final ic = _drawerCatColors[index % _drawerCatColors.length][1];
    final icon = _drawerCatIcons[index % _drawerCatIcons.length];
    if (imgUrl != null && imgUrl.isNotEmpty) {
      return ClipRRect(
        borderRadius: BorderRadius.circular(8),
        child: CachedNetworkImage(
          imageUrl: imgUrl,
          width: 30,
          height: 30,
          fit: BoxFit.cover,
          errorWidget: (_, _, _) => Container(
            width: 30,
            height: 30,
            decoration: BoxDecoration(
              color: bg,
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(icon, size: 16, color: ic),
          ),
        ),
      );
    }
    return Container(
      width: 30,
      height: 30,
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Center(child: Icon(icon, size: 16, color: ic)),
    );
  }

  // Sub-category avatar (smaller, same color family as parent)
  Widget _drawerSubCatAvatar(Map<String, dynamic> sub, int parentIdx) {
    final imgUrl = _imgUrl(sub['category_url'] ?? sub['image']);
    final bg = _drawerCatColors[parentIdx % _drawerCatColors.length][0];
    final ic = _drawerCatColors[parentIdx % _drawerCatColors.length][1];
    if (imgUrl != null && imgUrl.isNotEmpty) {
      return ClipRRect(
        borderRadius: BorderRadius.circular(6),
        child: CachedNetworkImage(
          imageUrl: imgUrl,
          width: 24,
          height: 24,
          fit: BoxFit.cover,
          errorWidget: (_, _, _) => Container(
            width: 24,
            height: 24,
            decoration: BoxDecoration(
              color: bg,
              borderRadius: BorderRadius.circular(6),
            ),
            child: Center(
              child: Icon(Icons.category_rounded, size: 13, color: ic),
            ),
          ),
        ),
      );
    }
    return Container(
      width: 24,
      height: 24,
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(6),
      ),
      child: Center(
        child: Icon(
          Icons.subdirectory_arrow_right_rounded,
          size: 13,
          color: ic,
        ),
      ),
    );
  }

  // User avatar bottom sheet
  void _showUserAvatarSheet(BuildContext ctx) {
    final name = UserSession.instance.name ?? 'Guest';
    final messages = [
      'Your style speaks before you do. Let\'s find it! 🛍️',
      'Trends change. Your taste doesn\'t. Explore the latest. ✨',
      'Every great outfit starts with one great pick. Start shopping! 💚',
      'You deserve to look amazing every single day. 🌟',
      'Life\'s too short for boring fashion. Discover something new! 🔥',
    ];
    final msg = messages[name.hashCode.abs() % messages.length];
    showModalBottomSheet(
      context: ctx,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (_) => Container(
        padding: const EdgeInsets.fromLTRB(24, 12, 24, 40),
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 40,
              height: 4,
              margin: const EdgeInsets.only(bottom: 24),
              decoration: BoxDecoration(
                color: const Color(0xFFE2E8F0),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            CircleAvatar(
              radius: 52,
              backgroundColor: const Color(0xFFDCFCE7),
              child: ClipOval(
                child: CachedNetworkImage(
                  imageUrl: _currentUserAvatarUrl(),
                  width: 104,
                  height: 104,
                  fit: BoxFit.cover,
                  errorWidget: (_, _, _) => const Icon(
                    Icons.person_rounded,
                    size: 52,
                    color: Color(0xFF16A34A),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 16),
            Text(
              'Hey, $name! 👋',
              style: const TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.w800,
                color: Color(0xFF0F172A),
              ),
            ),
            const SizedBox(height: 8),
            Text(
              msg,
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 14,
                color: Color(0xFF64748B),
                height: 1.5,
              ),
            ),
            const SizedBox(height: 18),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: () {
                  Navigator.pop(ctx);
                  _showAvatarPickerSheet(context);
                },
                icon: const Icon(Icons.face_retouching_natural_rounded),
                label: const Text('Change Avatar'),
                style: OutlinedButton.styleFrom(
                  foregroundColor: const Color(0xFF166534),
                  side: const BorderSide(color: Color(0xFF16A34A)),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 24),
            Row(
              children: [
                Expanded(
                  child: _avatarSheetChip(
                    Icons.local_fire_department_rounded,
                    'Hot Deals',
                    const Color(0xFFFFEDD5),
                    const Color(0xFFEA580C),
                    ctx,
                    AllProductsScreen(
                      categoryName: 'Sale & Discounts',
                      initialSort: 'price_asc',
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: _avatarSheetChip(
                    Icons.new_releases_rounded,
                    'New In',
                    const Color(0xFFDCFCE7),
                    const Color(0xFF16A34A),
                    ctx,
                    const AllProductsScreen(
                      categoryName: 'New Arrivals',
                      initialSort: 'newest',
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: _avatarSheetChip(
                    Icons.bolt_rounded,
                    'Flash Deals',
                    const Color(0xFFFEF9C3),
                    const Color(0xFFCA8A04),
                    ctx,
                    const AllProductsScreen(
                      categoryName: 'Flash Deals',
                      initialSort: 'price_asc',
                      maxPrice: 999,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
          ],
        ),
      ),
    );
  }

  Widget _avatarSheetChip(
    IconData icon,
    String label,
    Color bg,
    Color ic,
    BuildContext ctx,
    Widget destination,
  ) {
    return GestureDetector(
      onTap: () {
        Navigator.pop(ctx);
        Navigator.of(ctx).push(MaterialPageRoute(builder: (_) => destination));
      },
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 14),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(16),
        ),
        child: Column(
          children: [
            Icon(icon, size: 24, color: ic),
            const SizedBox(height: 6),
            Text(
              label,
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w700,
                color: ic,
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ── Drawer ────────────────────────────────────────────────────────────────
  Widget _buildDrawer() {
    return Drawer(
      backgroundColor: const Color(0xFFF8FAFC),
      child: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Gradient header
            Container(
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  colors: [Color(0xFF0F172A), Color(0xFF1E3A2F)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
              ),
              padding: const EdgeInsets.fromLTRB(20, 20, 20, 20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Image.asset(
                        'assets/images/logo.png',
                        width: 36,
                        height: 36,
                      ),
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
                              style: TextStyle(color: Colors.white),
                            ),
                            TextSpan(
                              text: 'FASH',
                              style: TextStyle(color: Color(0xFF4ADE80)),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 18),
                  Row(
                    children: [
                      GestureDetector(
                        onTap: () => _showUserAvatarSheet(context),
                        child: Stack(
                          children: [
                            CircleAvatar(
                              radius: 24,
                              backgroundColor: const Color(0xFF1E3A2F),
                              child: ClipOval(
                                child: CachedNetworkImage(
                                  imageUrl: _currentUserAvatarUrl(),
                                  width: 48,
                                  height: 48,
                                  fit: BoxFit.cover,
                                  placeholder: (_, _) => const Icon(
                                    Icons.person_rounded,
                                    color: Color(0xFF4ADE80),
                                    size: 24,
                                  ),
                                  errorWidget: (_, _, _) => const Icon(
                                    Icons.person_rounded,
                                    color: Color(0xFF4ADE80),
                                    size: 24,
                                  ),
                                ),
                              ),
                            ),
                            Positioned(
                              right: 0,
                              bottom: 0,
                              child: Container(
                                width: 13,
                                height: 13,
                                decoration: BoxDecoration(
                                  color: const Color(0xFF4ADE80),
                                  shape: BoxShape.circle,
                                  border: Border.all(
                                    color: const Color(0xFF0F172A),
                                    width: 2,
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'Hi there,',
                              style: TextStyle(
                                fontSize: 12,
                                color: Color(0xFF94A3B8),
                                fontWeight: FontWeight.w400,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Row(
                              children: [
                                Expanded(
                                  child: Text(
                                    UserSession.instance.name ?? 'Guest',
                                    style: const TextStyle(
                                      fontSize: 16,
                                      fontWeight: FontWeight.w700,
                                      color: Colors.white,
                                    ),
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                                const SizedBox(width: 8),
                                InkWell(
                                  borderRadius: BorderRadius.circular(10),
                                  onTap: () => _showAvatarPickerSheet(context),
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 8,
                                      vertical: 4,
                                    ),
                                    decoration: BoxDecoration(
                                      color: const Color(0xFF166534),
                                      borderRadius: BorderRadius.circular(10),
                                    ),
                                    child: const Text(
                                      'Change',
                                      style: TextStyle(
                                        fontSize: 11,
                                        fontWeight: FontWeight.w700,
                                        color: Colors.white,
                                      ),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const Divider(height: 1, color: Color(0xFFE2E8F0)),
            Expanded(
              child: ListView(
                padding: EdgeInsets.zero,
                children: [
                  _DrawerSection(
                    title: 'PROFILE',
                    sectionIcon: Icons.person_outline_rounded,
                    children: [
                      _DrawerItem(
                        icon: Icons.face_retouching_natural_rounded,
                        iconBg: const Color(0xFF16A34A),
                        label: 'Change Avatar',
                        onTap: () {
                          Navigator.pop(context);
                          Future.delayed(const Duration(milliseconds: 180), () {
                            if (!mounted) return;
                            _showAvatarPickerSheet(context);
                          });
                        },
                      ),
                    ],
                  ),
                  _DrawerSection(
                    title: 'SHOP BY CATEGORY',
                    sectionIcon: Icons.category_outlined,
                    children: _categories.isNotEmpty
                        ? _categories
                              .asMap()
                              .entries
                              .map((entry) {
                                final idx = entry.key;
                                final c = entry.value;
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
                                  return ListTile(
                                    dense: true,
                                    leading: _drawerCatAvatar(c, idx),
                                    title: Text(
                                      catName,
                                      style: const TextStyle(
                                        fontSize: 14,
                                        fontWeight: FontWeight.w500,
                                        color: Color(0xFF0F172A),
                                      ),
                                    ),
                                    trailing: const Icon(
                                      Icons.arrow_forward_ios_rounded,
                                      size: 13,
                                      color: Color(0xFFCBD5E1),
                                    ),
                                    contentPadding: const EdgeInsets.symmetric(
                                      horizontal: 16,
                                      vertical: 2,
                                    ),
                                    visualDensity: VisualDensity.compact,
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
                                      leading: _drawerCatAvatar(c, idx),
                                      trailing: Icon(
                                        expanded
                                            ? Icons.keyboard_arrow_up_rounded
                                            : Icons.keyboard_arrow_down_rounded,
                                        size: 18,
                                        color: expanded
                                            ? _green
                                            : const Color(0xFF94A3B8),
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
                                            vertical: 2,
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
                                          children: children.asMap().entries.map((
                                            subEntry,
                                          ) {
                                            final sub = subEntry.value;
                                            return ListTile(
                                              dense: true,
                                              leading: Padding(
                                                padding: const EdgeInsets.only(
                                                  left: 12,
                                                ),
                                                child: _drawerSubCatAvatar(
                                                  sub,
                                                  idx,
                                                ),
                                              ),
                                              title: Text(
                                                sub['name']?.toString() ?? '',
                                                style: const TextStyle(
                                                  fontSize: 13,
                                                  fontWeight: FontWeight.w500,
                                                  color: Color(0xFF475569),
                                                ),
                                              ),
                                              trailing: const Icon(
                                                Icons.arrow_forward_ios_rounded,
                                                size: 11,
                                                color: Color(0xFFCBD5E1),
                                              ),
                                              contentPadding:
                                                  const EdgeInsets.only(
                                                    left: 16,
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
                                            );
                                          }).toList(),
                                        ),
                                      ),
                                  ],
                                );
                              })
                              .toList()
                              .cast<Widget>()
                        : [
                                {'name': 'Women', 'icon': Icons.woman_rounded},
                                {'name': 'Men', 'icon': Icons.man_rounded},
                                {
                                  'name': 'Kids',
                                  'icon': Icons.child_care_rounded,
                                },
                                {
                                  'name': 'Beauty',
                                  'icon': Icons.face_retouching_natural,
                                },
                                {
                                  'name': 'Home & Living',
                                  'icon': Icons.home_rounded,
                                },
                              ]
                              .asMap()
                              .entries
                              .map(
                                (e) => ListTile(
                                  dense: true,
                                  leading: Container(
                                    width: 30,
                                    height: 30,
                                    decoration: BoxDecoration(
                                      color:
                                          _drawerCatColors[e.key %
                                              _drawerCatColors.length][0],
                                      borderRadius: BorderRadius.circular(8),
                                    ),
                                    child: Center(
                                      child: Icon(
                                        e.value['icon'] as IconData,
                                        size: 16,
                                        color:
                                            _drawerCatColors[e.key %
                                                _drawerCatColors.length][1],
                                      ),
                                    ),
                                  ),
                                  title: Text(
                                    e.value['name'] as String,
                                    style: const TextStyle(
                                      fontSize: 14,
                                      fontWeight: FontWeight.w500,
                                      color: Color(0xFF0F172A),
                                    ),
                                  ),
                                  trailing: const Icon(
                                    Icons.arrow_forward_ios_rounded,
                                    size: 13,
                                    color: Color(0xFFCBD5E1),
                                  ),
                                  contentPadding: const EdgeInsets.symmetric(
                                    horizontal: 16,
                                    vertical: 2,
                                  ),
                                  visualDensity: VisualDensity.compact,
                                  onTap: () => Navigator.pop(context),
                                ),
                              )
                              .toList(),
                  ),
                  _DrawerSection(
                    title: 'SHOP BY BRANDS',
                    sectionIcon: Icons.diamond_outlined,
                    children: _brands.isNotEmpty
                        ? _brands
                              .take(6)
                              .map(
                                (b) => _DrawerItem(
                                  imageUrl: _imgUrl(
                                    b['logo_url'] ?? b['image'],
                                  ),
                                  icon: Icons.storefront_outlined,
                                  label: b['name']?.toString() ?? '',
                                  onTap: () {
                                    Navigator.pop(context);
                                    Navigator.of(context).push(
                                      MaterialPageRoute(
                                        builder: (_) => AllProductsScreen(
                                          brandId: b['id']?.toString(),
                                          brandName:
                                              b['name']?.toString() ?? '',
                                        ),
                                      ),
                                    );
                                  },
                                ),
                              )
                              .toList()
                        : ['Nike', 'Adidas', 'Puma', "Levi's", 'Zara']
                              .map(
                                (n) => _DrawerItem(
                                  icon: Icons.storefront_outlined,
                                  label: n,
                                  onTap: () {
                                    Navigator.pop(context);
                                    Navigator.of(context).push(
                                      MaterialPageRoute(
                                        builder: (_) =>
                                            AllProductsScreen(brandName: n),
                                      ),
                                    );
                                  },
                                ),
                              )
                              .toList(),
                  ),
                  _DrawerSection(
                    title: 'OFFERS & PROGRAMS',
                    sectionIcon: Icons.local_fire_department_rounded,
                    children: [
                      _DrawerItem(
                        icon: Icons.card_giftcard_rounded,
                        iconBg: const Color(0xFFEA580C),
                        label: 'Refer & Earn',
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
                        icon: Icons.recycling_rounded,
                        iconBg: const Color(0xFF059669),
                        label: 'Donate Old Clothes',
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
                        icon: Icons.local_offer_rounded,
                        iconBg: const Color(0xFFE11D48),
                        label: 'Sale & Discounts',
                        onTap: () {
                          Navigator.pop(context);
                          Navigator.of(context).push(
                            MaterialPageRoute(
                              builder: (_) => const AllProductsScreen(
                                categoryName: 'Sale & Discounts',
                                initialSort: 'price_asc',
                              ),
                            ),
                          );
                        },
                      ),
                      _DrawerItem(
                        icon: Icons.bolt_rounded,
                        iconBg: const Color(0xFFD97706),
                        label: 'Flash Deals',
                        onTap: () {
                          Navigator.pop(context);
                          Navigator.of(context).push(
                            MaterialPageRoute(
                              builder: (_) => const AllProductsScreen(
                                categoryName: 'Flash Deals',
                                initialSort: 'price_asc',
                                maxPrice: 999,
                              ),
                            ),
                          );
                        },
                      ),
                      _DrawerItem(
                        icon: Icons.auto_awesome_rounded,
                        iconBg: const Color(0xFF7C3AED),
                        label: 'New Arrivals',
                        onTap: () {
                          Navigator.pop(context);
                          Navigator.of(context).push(
                            MaterialPageRoute(
                              builder: (_) => const AllProductsScreen(
                                categoryName: 'New Arrivals',
                                initialSort: 'newest',
                              ),
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
                        icon: Icons.store_rounded,
                        iconBg: const Color(0xFF0EA5E9),
                        label: 'Vendor Login',
                        onTap: () {
                          Navigator.pop(context);
                          Navigator.of(context).push(
                            MaterialPageRoute(
                              builder: (_) =>
                                  const LoginScreen(startAsVendor: true),
                            ),
                          );
                        },
                      ),
                      _DrawerItem(
                        icon: Icons.headset_mic_rounded,
                        iconBg: const Color(0xFF0284C7),
                        label: 'Customer Support',
                        onTap: () {
                          Navigator.pop(context);
                          _showHelpSheet(context);
                        },
                      ),
                      _DrawerItem(
                        icon: Icons.privacy_tip_rounded,
                        iconBg: const Color(0xFF475569),
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
                        icon: Icons.description_rounded,
                        iconBg: const Color(0xFF7C3AED),
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
                  UserSession.instance.clear();
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
      return const Center(child: BfSpinner());
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

  final _deliverPickupCtrl = TextEditingController();
  final _deliverDropCtrl = TextEditingController();
  final _deliverPickupFocus = FocusNode();
  final _deliverDropFocus = FocusNode();
  double? _deliverPickupLat;
  double? _deliverPickupLng;
  double? _deliverDropLat;
  double? _deliverDropLng;
  Timer? _deliverPickupDebounce;
  Timer? _deliverDropDebounce;
  bool _deliverEstimating = false;
  bool _deliverSubmitting = false;
  bool _deliverPickupSearching = false;
  bool _deliverDropSearching = false;
  List<Map<String, dynamic>> _deliverPickupSuggestions = const [];
  List<Map<String, dynamic>> _deliverDropSuggestions = const [];
  int _deliverPickupSearchToken = 0;
  int _deliverDropSearchToken = 0;
  bool _deliverPickupAutoInitialized = false;
  bool _deliverRouteLoading = false;
  List<LatLng> _deliverRoutePoints = const [];
  List<LatLng> _deliverNearbyRiders = const [];
  Timer? _deliverLiveTimer;
  int _deliverLiveTick = 0;
  int? _deliverEtaMinutes;
  Map<String, dynamic>? _deliverEstimate;

  Future<void> _setDeliverPickupFromCurrentLocation() async {
    if (_deliverPickupAutoInitialized) return;
    _deliverPickupAutoInitialized = true;

    double? lat = _lastKnownLat;
    double? lng = _lastKnownLng;

    if (lat == null || lng == null) {
      try {
        final permission = await Geolocator.checkPermission();
        if (permission == LocationPermission.whileInUse ||
            permission == LocationPermission.always) {
          final pos = await Geolocator.getCurrentPosition(
            desiredAccuracy: LocationAccuracy.low,
          );
          lat = pos.latitude;
          lng = pos.longitude;
        }
      } catch (_) {}
    }

    if (lat == null || lng == null || !mounted) return;

    String addressText = 'Current location';
    try {
      final marks = await placemarkFromCoordinates(lat, lng);
      if (marks.isNotEmpty) {
        final p = marks.first;
        final parts = [
          p.name,
          p.subLocality,
          p.locality,
        ].whereType<String>().where((e) => e.trim().isNotEmpty).toList();
        if (parts.isNotEmpty) addressText = parts.take(3).join(', ');
      }
    } catch (_) {}

    if (!mounted) return;
    setState(() {
      _deliverPickupCtrl.text = addressText;
      _deliverPickupLat = lat;
      _deliverPickupLng = lng;
      _deliverPickupSuggestions = const [];
    });
    _refreshDeliverNearbyRiders();
    _refreshDeliverRoute();
  }

  void _refreshDeliverNearbyRiders() {
    if (_deliverPickupLat == null || _deliverPickupLng == null) {
      _stopDeliverLiveTracking();
      setState(() => _deliverNearbyRiders = const []);
      return;
    }

    setState(() => _deliverNearbyRiders = _buildDeliverLiveRiders());
    _startDeliverLiveTracking();
  }

  List<LatLng> _buildDeliverLiveRiders() {
    if (_deliverPickupLat == null || _deliverPickupLng == null) return const [];
    final baseLat = _deliverPickupLat!;
    final baseLng = _deliverPickupLng!;
    final cosLat = math.cos(baseLat * math.pi / 180).abs().clamp(0.2, 1.0);
    final riders = <LatLng>[];

    for (int i = 0; i < 2; i++) {
      if (_deliverRoutePoints.length >= 2) {
        final idx =
            (_deliverLiveTick * 2 + i * 23) % _deliverRoutePoints.length;
        riders.add(_deliverRoutePoints[idx]);
        continue;
      }

      final angle = ((_deliverLiveTick * 16) + (i * 58 + 17)) * math.pi / 180;
      final radiusKm = 0.20 + i * 0.18;
      final dLat = (radiusKm / 111.0) * math.cos(angle);
      final dLng = (radiusKm / (111.0 * cosLat)) * math.sin(angle);
      riders.add(LatLng(baseLat + dLat, baseLng + dLng));
    }
    return riders;
  }

  void _startDeliverLiveTracking() {
    _deliverLiveTimer?.cancel();
    _deliverLiveTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted || _deliverPickupLat == null || _deliverPickupLng == null) {
        return;
      }
      setState(() {
        _deliverLiveTick++;
        _deliverNearbyRiders = _buildDeliverLiveRiders();
      });
    });
  }

  void _stopDeliverLiveTracking() {
    _deliverLiveTimer?.cancel();
    _deliverLiveTimer = null;
  }

  double _deliverHaversineKm(
    double lat1,
    double lng1,
    double lat2,
    double lng2,
  ) {
    const r = 6371.0;
    final dLat = (lat2 - lat1) * math.pi / 180.0;
    final dLng = (lng2 - lng1) * math.pi / 180.0;
    final a =
        math.sin(dLat / 2) * math.sin(dLat / 2) +
        math.cos(lat1 * math.pi / 180.0) *
            math.cos(lat2 * math.pi / 180.0) *
            math.sin(dLng / 2) *
            math.sin(dLng / 2);
    return r * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a));
  }

  void _recalculateDeliverEta() {
    double? distanceKm;
    final estDistance = (_deliverEstimate?['distanceKm'] as num?)?.toDouble();
    if (estDistance != null && estDistance > 0) {
      distanceKm = estDistance;
    } else if (_deliverPickupLat != null &&
        _deliverPickupLng != null &&
        _deliverDropLat != null &&
        _deliverDropLng != null) {
      distanceKm = _deliverHaversineKm(
        _deliverPickupLat!,
        _deliverPickupLng!,
        _deliverDropLat!,
        _deliverDropLng!,
      );
    }

    if (distanceKm == null) {
      setState(() => _deliverEtaMinutes = null);
      return;
    }

    final mins = ((distanceKm / 24.0) * 60.0).round().clamp(6, 95);
    setState(() => _deliverEtaMinutes = mins);
  }

  Future<void> _refreshDeliverRoute() async {
    if (_deliverPickupLat == null ||
        _deliverPickupLng == null ||
        _deliverDropLat == null ||
        _deliverDropLng == null) {
      if (mounted) {
        setState(() => _deliverRoutePoints = const []);
        _recalculateDeliverEta();
      }
      return;
    }

    if (mounted) setState(() => _deliverRouteLoading = true);
    try {
      final uri = Uri.parse(
        'https://router.project-osrm.org/route/v1/driving/'
        '${_deliverPickupLng!.toStringAsFixed(6)},${_deliverPickupLat!.toStringAsFixed(6)};'
        '${_deliverDropLng!.toStringAsFixed(6)},${_deliverDropLat!.toStringAsFixed(6)}'
        '?overview=full&geometries=geojson',
      );

      final res = await http.get(
        uri,
        headers: const {'User-Agent': 'BlinkieFashApp/1.0'},
      );

      if (!mounted) return;

      final fallback = [
        LatLng(_deliverPickupLat!, _deliverPickupLng!),
        LatLng(_deliverDropLat!, _deliverDropLng!),
      ];

      if (res.statusCode != 200) {
        setState(() => _deliverRoutePoints = fallback);
        _recalculateDeliverEta();
        _refreshDeliverNearbyRiders();
        return;
      }

      final decoded = jsonDecode(res.body);
      final routes = decoded is Map
          ? (decoded['routes'] as List? ?? const [])
          : const [];
      if (routes.isEmpty) {
        setState(() => _deliverRoutePoints = fallback);
        _recalculateDeliverEta();
        _refreshDeliverNearbyRiders();
        return;
      }

      final geometry = routes.first['geometry'];
      final coords = geometry is Map
          ? (geometry['coordinates'] as List? ?? const [])
          : const [];

      final points = <LatLng>[];
      for (final c in coords) {
        if (c is List && c.length >= 2) {
          final lng = (c[0] as num?)?.toDouble();
          final lat = (c[1] as num?)?.toDouble();
          if (lat != null && lng != null) points.add(LatLng(lat, lng));
        }
      }

      setState(() => _deliverRoutePoints = points.isEmpty ? fallback : points);
      _recalculateDeliverEta();
      _refreshDeliverNearbyRiders();
    } catch (_) {
      if (!mounted) return;
      setState(() {
        if (_deliverPickupLat != null &&
            _deliverPickupLng != null &&
            _deliverDropLat != null &&
            _deliverDropLng != null) {
          _deliverRoutePoints = [
            LatLng(_deliverPickupLat!, _deliverPickupLng!),
            LatLng(_deliverDropLat!, _deliverDropLng!),
          ];
        }
      });
      _recalculateDeliverEta();
      _refreshDeliverNearbyRiders();
    } finally {
      if (mounted) setState(() => _deliverRouteLoading = false);
    }
  }

  Widget _deliverMapPreview() {
    final startReady = _deliverPickupLat != null && _deliverPickupLng != null;
    if (!startReady) {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: const Color(0xFFF8FAFC),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFFE2E8F0)),
        ),
        child: const Text(
          'Allow location and set starting point to see live route map and nearby riders.',
          style: TextStyle(fontSize: 12, color: Color(0xFF64748B)),
        ),
      );
    }

    final center = LatLng(_deliverPickupLat!, _deliverPickupLng!);
    final markers = <Marker>[
      Marker(
        point: center,
        width: 40,
        height: 40,
        child: const Icon(
          Icons.trip_origin_rounded,
          color: Color(0xFF16A34A),
          size: 26,
        ),
      ),
      for (final rider in _deliverNearbyRiders)
        Marker(
          point: rider,
          width: 30,
          height: 30,
          child: Container(
            decoration: const BoxDecoration(
              color: Color(0xFF0EA5E9),
              shape: BoxShape.circle,
            ),
            child: const Icon(
              Icons.two_wheeler_rounded,
              color: Colors.white,
              size: 16,
            ),
          ),
        ),
    ];

    if (_deliverDropLat != null && _deliverDropLng != null) {
      markers.add(
        Marker(
          point: LatLng(_deliverDropLat!, _deliverDropLng!),
          width: 40,
          height: 40,
          child: const Icon(
            Icons.place_rounded,
            color: Color(0xFFEF4444),
            size: 30,
          ),
        ),
      );
    }

    return Container(
      height: 250,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(12),
        child: Stack(
          children: [
            FlutterMap(
              options: MapOptions(initialCenter: center, initialZoom: 13),
              children: [
                TileLayer(
                  urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                  userAgentPackageName: 'com.blinkiefash.app',
                ),
                if (_deliverRoutePoints.length >= 2)
                  PolylineLayer(
                    polylines: [
                      Polyline(
                        points: _deliverRoutePoints,
                        color: const Color(0xFF2563EB),
                        strokeWidth: 4,
                      ),
                    ],
                  ),
                MarkerLayer(markers: markers),
              ],
            ),
            Positioned(
              top: 10,
              left: 10,
              child: DecoratedBox(
                decoration: const BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.all(Radius.circular(20)),
                ),
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 6,
                  ),
                  child: Text(
                    _deliverEtaMinutes == null
                        ? 'Set destination for ETA'
                        : 'ETA ~ $_deliverEtaMinutes min • $_deliverNearbyRiders.length riders nearby',
                    style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ),
            ),
            if (_deliverRouteLoading)
              const Positioned(
                top: 10,
                right: 10,
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.all(Radius.circular(20)),
                  ),
                  child: Padding(
                    padding: EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        SizedBox(
                          width: 12,
                          height: 12,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        ),
                        SizedBox(width: 6),
                        Text('Loading route', style: TextStyle(fontSize: 11)),
                      ],
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Future<List<Map<String, dynamic>>> _buildDeliverSuggestions(
    String query,
  ) async {
    final seen = <String>{};
    final suggestions = <Map<String, dynamic>>[];

    Future<void> addSuggestion({
      required String title,
      required String subtitle,
      required double lat,
      required double lng,
    }) async {
      if (suggestions.length >= 12) return;
      final key = '${lat.toStringAsFixed(5)},${lng.toStringAsFixed(5)}';
      if (seen.contains(key)) return;
      seen.add(key);
      suggestions.add({
        'title': title,
        'subtitle': subtitle,
        'lat': lat,
        'lng': lng,
      });
    }

    // Better POI/address coverage using Google Places (if key is provided).
    if (_googleMapsApiKey.isNotEmpty) {
      try {
        final autoUri = Uri.parse(
          'https://maps.googleapis.com/maps/api/place/autocomplete/json'
          '?input=${Uri.encodeComponent(query)}'
          '&components=country:in'
          '&language=en'
          '&key=${Uri.encodeComponent(_googleMapsApiKey)}',
        );

        final autoRes = await http.get(
          autoUri,
          headers: const {'User-Agent': 'BlinkieFashApp/1.0'},
        );

        if (autoRes.statusCode == 200) {
          final autoData = jsonDecode(autoRes.body);
          final predictions = autoData is Map
              ? (autoData['predictions'] as List? ?? const [])
              : const [];

          for (final p in predictions.take(8)) {
            if (p is! Map) continue;
            final pred = Map<String, dynamic>.from(p);
            final placeId = (pred['place_id'] ?? '').toString();
            if (placeId.isEmpty) continue;

            try {
              final detailsUri = Uri.parse(
                'https://maps.googleapis.com/maps/api/place/details/json'
                '?place_id=${Uri.encodeComponent(placeId)}'
                '&fields=name,formatted_address,geometry/location'
                '&key=${Uri.encodeComponent(_googleMapsApiKey)}',
              );
              final detailsRes = await http.get(
                detailsUri,
                headers: const {'User-Agent': 'BlinkieFashApp/1.0'},
              );
              if (detailsRes.statusCode != 200) continue;

              final detailsData = jsonDecode(detailsRes.body);
              final result = detailsData is Map
                  ? (detailsData['result'] as Map? ?? const {})
                  : const {};
              final geometry = result['geometry'] as Map?;
              final location = geometry?['location'] as Map?;
              final lat = (location?['lat'] as num?)?.toDouble();
              final lng = (location?['lng'] as num?)?.toDouble();
              if (lat == null || lng == null) continue;

              final title =
                  (result['name'] ??
                          pred['structured_formatting']?['main_text'] ??
                          pred['description'] ??
                          query)
                      .toString();
              final subtitle =
                  (result['formatted_address'] ??
                          pred['structured_formatting']?['secondary_text'] ??
                          pred['description'] ??
                          'Tap to select')
                      .toString();

              await addSuggestion(
                title: title,
                subtitle: subtitle,
                lat: lat,
                lng: lng,
              );
            } catch (_) {
              // Keep processing other predictions.
            }
          }
        }
      } catch (_) {
        // Keep empty suggestions when Google search fails.
      }
    }

    return suggestions;
  }

  Future<void> _searchDeliverSuggestions(
    String query, {
    required bool pickup,
  }) async {
    final q = query.trim();
    if (q.length < 2) {
      if (!mounted) return;
      setState(() {
        if (pickup) {
          _deliverPickupSuggestions = const [];
          _deliverPickupSearching = false;
        } else {
          _deliverDropSuggestions = const [];
          _deliverDropSearching = false;
        }
      });
      return;
    }

    final token = pickup
        ? ++_deliverPickupSearchToken
        : ++_deliverDropSearchToken;

    if (!mounted) return;
    setState(() {
      if (pickup) {
        _deliverPickupSearching = true;
      } else {
        _deliverDropSearching = true;
      }
    });

    try {
      final suggestions = await _buildDeliverSuggestions(q);
      if (!mounted) return;
      final isStale = pickup
          ? token != _deliverPickupSearchToken
          : token != _deliverDropSearchToken;
      if (isStale) return;
      setState(() {
        if (pickup) {
          _deliverPickupSuggestions = suggestions;
          _deliverPickupSearching = false;
        } else {
          _deliverDropSuggestions = suggestions;
          _deliverDropSearching = false;
        }
      });
    } catch (_) {
      if (!mounted) return;
      final isStale = pickup
          ? token != _deliverPickupSearchToken
          : token != _deliverDropSearchToken;
      if (isStale) return;
      setState(() {
        if (pickup) {
          _deliverPickupSuggestions = const [];
          _deliverPickupSearching = false;
        } else {
          _deliverDropSuggestions = const [];
          _deliverDropSearching = false;
        }
      });
    }
  }

  void _onDeliverLocationChanged(String value, {required bool pickup}) {
    setState(() {
      _deliverEstimate = null;
      if (pickup) {
        _deliverPickupLat = null;
        _deliverPickupLng = null;
        _deliverNearbyRiders = const [];
        _deliverRoutePoints = const [];
        _deliverEtaMinutes = null;
        _stopDeliverLiveTracking();
      } else {
        _deliverDropLat = null;
        _deliverDropLng = null;
        _deliverRoutePoints = const [];
        _deliverEtaMinutes = null;
      }
    });

    final debounce = pickup ? _deliverPickupDebounce : _deliverDropDebounce;
    debounce?.cancel();
    final nextDebounce = Timer(const Duration(milliseconds: 420), () {
      _searchDeliverSuggestions(value, pickup: pickup);
    });
    if (pickup) {
      _deliverPickupDebounce = nextDebounce;
    } else {
      _deliverDropDebounce = nextDebounce;
    }

    // If both coordinates are already available, keep fare in sync on edits.
    _autoEstimateDeliverIfReady();
  }

  void _selectDeliverSuggestion(
    Map<String, dynamic> suggestion, {
    required bool pickup,
  }) {
    final title = (suggestion['title'] ?? '').toString();
    final subtitle = (suggestion['subtitle'] ?? '').toString();
    final text = subtitle.trim().isEmpty ? title : '$title, $subtitle';
    final lat = (suggestion['lat'] as num?)?.toDouble();
    final lng = (suggestion['lng'] as num?)?.toDouble();

    setState(() {
      _deliverEstimate = null;
      if (pickup) {
        _deliverPickupCtrl.text = text;
        _deliverPickupLat = lat;
        _deliverPickupLng = lng;
        _deliverPickupSuggestions = const [];
      } else {
        _deliverDropCtrl.text = text;
        _deliverDropLat = lat;
        _deliverDropLng = lng;
        _deliverDropSuggestions = const [];
      }
    });
    if (pickup) _refreshDeliverNearbyRiders();
    _refreshDeliverRoute();
    _autoEstimateDeliverIfReady();
    FocusScope.of(context).unfocus();
  }

  Future<void> _pickDeliverLocationFromMap({required bool pickup}) async {
    final picked = await Navigator.of(context).push<PickedAddress>(
      MaterialPageRoute(builder: (_) => const LocationPickerScreen()),
    );
    if (!mounted || picked == null) return;

    final text = picked.addressLine.trim().isNotEmpty
        ? picked.addressLine.trim()
        : [
            picked.city,
            picked.pincode,
          ].where((e) => e.trim().isNotEmpty).join(', ');

    setState(() {
      _deliverEstimate = null;
      if (pickup) {
        _deliverPickupCtrl.text = text;
        _deliverPickupLat = picked.lat;
        _deliverPickupLng = picked.lng;
        _deliverPickupSuggestions = const [];
      } else {
        _deliverDropCtrl.text = text;
        _deliverDropLat = picked.lat;
        _deliverDropLng = picked.lng;
        _deliverDropSuggestions = const [];
      }
    });
    if (pickup) _refreshDeliverNearbyRiders();
    _refreshDeliverRoute();
    _autoEstimateDeliverIfReady();
  }

  Widget _deliverSuggestionList({required bool pickup}) {
    final suggestions = pickup
        ? _deliverPickupSuggestions
        : _deliverDropSuggestions;
    if (suggestions.isEmpty) return const SizedBox.shrink();

    return Container(
      margin: const EdgeInsets.only(top: 8),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        children: [
          for (final s in suggestions)
            ListTile(
              dense: true,
              leading: Icon(
                pickup ? Icons.trip_origin_rounded : Icons.place_outlined,
                color: const Color(0xFF0EA5E9),
                size: 18,
              ),
              title: Text(
                (s['title'] ?? '').toString(),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              subtitle: Text(
                (s['subtitle'] ?? '').toString(),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              onTap: () => _selectDeliverSuggestion(s, pickup: pickup),
            ),
        ],
      ),
    );
  }

  Future<void> _resolveDeliverAddresses() async {
    final pickup = _deliverPickupCtrl.text.trim();
    final drop = _deliverDropCtrl.text.trim();
    if (pickup.isEmpty || drop.isEmpty) {
      _snack('Enter both pickup and drop locations');
      return;
    }

    setState(() {
      _deliverEstimating = true;
      _deliverEstimate = null;
    });

    try {
      if (_deliverPickupLat == null || _deliverPickupLng == null) {
        final g = await _geocodeDeliverAddressWithGoogle(pickup);
        if (g != null) {
          _deliverPickupLat = g.latitude;
          _deliverPickupLng = g.longitude;
        }
      }
      if (_deliverDropLat == null || _deliverDropLng == null) {
        final g = await _geocodeDeliverAddressWithGoogle(drop);
        if (g != null) {
          _deliverDropLat = g.latitude;
          _deliverDropLng = g.longitude;
        }
      }

      if (_deliverPickupLat == null ||
          _deliverPickupLng == null ||
          _deliverDropLat == null ||
          _deliverDropLng == null) {
        _snack('Unable to locate addresses. Try more specific locations.');
        return;
      }
      _refreshDeliverNearbyRiders();
      _refreshDeliverRoute();
      await _estimateDeliverFareNow(showError: true);
    } catch (_) {
      _snack('Could not estimate fare. Please try again.');
    } finally {
      if (mounted) setState(() => _deliverEstimating = false);
    }
  }

  Future<Location?> _geocodeDeliverAddressWithGoogle(String query) async {
    final q = query.trim();
    if (q.isEmpty || _googleMapsApiKey.isEmpty) return null;

    try {
      final uri = Uri.parse(
        'https://maps.googleapis.com/maps/api/geocode/json'
        '?address=${Uri.encodeComponent(q)}'
        '&components=country:IN'
        '&key=${Uri.encodeComponent(_googleMapsApiKey)}',
      );
      final res = await http.get(
        uri,
        headers: const {'User-Agent': 'BlinkieFashApp/1.0'},
      );
      if (res.statusCode != 200) return null;
      final data = jsonDecode(res.body);
      if (data is! Map || data['status'] != 'OK') return null;
      final results = (data['results'] as List? ?? const []);
      if (results.isEmpty || results.first is! Map) return null;
      final first = Map<String, dynamic>.from(results.first as Map);
      final geometry = first['geometry'] as Map?;
      final location = geometry?['location'] as Map?;
      final lat = (location?['lat'] as num?)?.toDouble();
      final lng = (location?['lng'] as num?)?.toDouble();
      if (lat == null || lng == null) return null;
      return Location(latitude: lat, longitude: lng, timestamp: DateTime.now());
    } catch (_) {
      return null;
    }
  }

  Future<void> _estimateDeliverFareNow({required bool showError}) async {
    if (_deliverPickupLat == null ||
        _deliverPickupLng == null ||
        _deliverDropLat == null ||
        _deliverDropLng == null) {
      return;
    }

    final estimate = await _api.estimateDeliverFare(
      pickupLat: _deliverPickupLat!,
      pickupLng: _deliverPickupLng!,
      dropLat: _deliverDropLat!,
      dropLng: _deliverDropLng!,
      city: _currentLocation,
    );

    if (!mounted) return;
    if (estimate['success'] == true) {
      setState(() => _deliverEstimate = estimate);
      _recalculateDeliverEta();
    } else if (showError) {
      _snack((estimate['message'] ?? 'Unable to estimate fare').toString());
    }
  }

  void _autoEstimateDeliverIfReady() {
    if (_deliverEstimating || _deliverSubmitting) return;
    if (_deliverPickupLat == null ||
        _deliverPickupLng == null ||
        _deliverDropLat == null ||
        _deliverDropLng == null) {
      return;
    }

    Future.microtask(() async {
      if (!mounted) return;
      setState(() => _deliverEstimating = true);
      try {
        await _estimateDeliverFareNow(showError: false);
      } catch (_) {
        // Keep UI stable on transient network issues.
      } finally {
        if (mounted) setState(() => _deliverEstimating = false);
      }
    });
  }

  Future<void> _submitDeliverRequest() async {
    if (_deliverEstimate == null ||
        _deliverPickupLat == null ||
        _deliverPickupLng == null ||
        _deliverDropLat == null ||
        _deliverDropLng == null) {
      _snack('Please estimate fare first');
      return;
    }

    setState(() => _deliverSubmitting = true);
    try {
      final res = await _api.createDeliverRequest(
        userId: UserSession.instance.userId,
        pickupText: _deliverPickupCtrl.text.trim(),
        dropText: _deliverDropCtrl.text.trim(),
        pickupLat: _deliverPickupLat!,
        pickupLng: _deliverPickupLng!,
        dropLat: _deliverDropLat!,
        dropLng: _deliverDropLng!,
        city: _currentLocation,
      );

      if (!mounted) return;
      if (res['success'] == true) {
        _snack('Parcel request created successfully');
        setState(() {
          _deliverPickupCtrl.clear();
          _deliverDropCtrl.clear();
          _deliverEstimate = null;
          _deliverPickupLat = null;
          _deliverPickupLng = null;
          _deliverDropLat = null;
          _deliverDropLng = null;
          _deliverPickupSuggestions = const [];
          _deliverDropSuggestions = const [];
          _deliverNearbyRiders = const [];
          _deliverRoutePoints = const [];
          _deliverEtaMinutes = null;
          _deliverPickupAutoInitialized = false;
        });
        _stopDeliverLiveTracking();
      } else {
        _snack((res['message'] ?? res['error'] ?? 'Request failed').toString());
      }
    } catch (_) {
      _snack('Request failed. Please try again.');
    } finally {
      if (mounted) setState(() => _deliverSubmitting = false);
    }
  }

  Widget _deliverBody() {
    if (!_deliverPickupAutoInitialized) {
      Future.microtask(_setDeliverPickupFromCurrentLocation);
    }

    final estimate = _deliverEstimate;
    final fare = (estimate?['estimatedFare'] ?? 0).toString();
    final distance = (estimate?['distanceKm'] ?? 0).toString();
    final cityZone = (estimate?['cityZone'] ?? '').toString();
    final routeSource = (estimate?['routeSource'] ?? '').toString();
    final routeLabel = routeSource == 'google-directions'
        ? 'Google'
        : routeSource == 'osrm'
        ? 'OSRM'
        : routeSource == 'haversine-fallback'
        ? 'Fallback (approx)'
        : '';

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            gradient: const LinearGradient(
              colors: [Color(0xFF0F172A), Color(0xFF0EA5E9)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
          ),
          child: const Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Parcel Service',
                style: TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.w800,
                  color: Colors.white,
                ),
              ),
              SizedBox(height: 6),
              Text(
                'Send parcels from one place to another with quick local pickup and drop.',
                style: TextStyle(color: Color(0xFFE0F2FE)),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFFE2E8F0)),
          ),
          child: Column(
            children: [
              TextField(
                controller: _deliverPickupCtrl,
                focusNode: _deliverPickupFocus,
                onChanged: (v) => _onDeliverLocationChanged(v, pickup: true),
                decoration: InputDecoration(
                  labelText: 'Starting location',
                  border: const OutlineInputBorder(),
                  prefixIcon: const Icon(Icons.trip_origin_rounded),
                  suffixIcon: _deliverPickupSearching
                      ? const Padding(
                          padding: EdgeInsets.all(10),
                          child: SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          ),
                        )
                      : null,
                ),
              ),
              _deliverSuggestionList(pickup: true),
              Align(
                alignment: Alignment.centerLeft,
                child: TextButton.icon(
                  onPressed: () => _pickDeliverLocationFromMap(pickup: true),
                  icon: const Icon(Icons.map_outlined),
                  label: const Text('Set Starting on map'),
                ),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: _deliverDropCtrl,
                focusNode: _deliverDropFocus,
                onChanged: (v) => _onDeliverLocationChanged(v, pickup: false),
                decoration: InputDecoration(
                  labelText: 'Destination location',
                  border: const OutlineInputBorder(),
                  prefixIcon: const Icon(Icons.place_outlined),
                  suffixIcon: _deliverDropSearching
                      ? const Padding(
                          padding: EdgeInsets.all(10),
                          child: SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          ),
                        )
                      : null,
                ),
              ),
              _deliverSuggestionList(pickup: false),
              Align(
                alignment: Alignment.centerLeft,
                child: TextButton.icon(
                  onPressed: () => _pickDeliverLocationFromMap(pickup: false),
                  icon: const Icon(Icons.map_outlined),
                  label: const Text('Set Destination on map'),
                ),
              ),
              const SizedBox(height: 6),
              _deliverMapPreview(),
              const SizedBox(height: 10),
              if (_deliverEstimating)
                const Align(
                  alignment: Alignment.centerLeft,
                  child: Padding(
                    padding: EdgeInsets.only(left: 2, bottom: 6),
                    child: Text(
                      'Calculating fare automatically...',
                      style: TextStyle(
                        fontSize: 12,
                        color: Color(0xFF64748B),
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
        if (estimate != null) ...[
          const SizedBox(height: 10),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: const Color(0xFFF0FDF4),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFBBF7D0)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Zone: $cityZone',
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 4),
                Text('Distance: $distance km'),
                if (routeLabel.isNotEmpty)
                  Text(
                    'Route source: $routeLabel',
                    style: const TextStyle(
                      fontSize: 12,
                      color: Color(0xFF475569),
                    ),
                  ),
                Text(
                  'Estimated Fare: ₹$fare',
                  style: const TextStyle(
                    fontWeight: FontWeight.w800,
                    color: Color(0xFF166534),
                  ),
                ),
                const SizedBox(height: 8),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(
                    onPressed: _deliverSubmitting
                        ? null
                        : _submitDeliverRequest,
                    icon: _deliverSubmitting
                        ? const SizedBox(
                            width: 14,
                            height: 14,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.local_shipping_rounded),
                    label: Text(
                      _deliverSubmitting
                          ? 'Submitting...'
                          : 'Book Parcel Pickup',
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ],
    );
  }

  // ── Edit Profile Sheet ────────────────────────────────────────────────────
  void _showEditProfileSheet(BuildContext context) {
    final session = UserSession.instance;
    final nameCtrl = TextEditingController(text: session.name ?? '');
    // Pre-populate email from session (or fetch from API if missing)
    final emailCtrl = TextEditingController(text: session.email ?? '');
    // If session email is empty, try to fetch from API in background
    if ((session.email == null || session.email!.isEmpty) &&
        session.userId != null) {
      _api
          .fetchUserProfile(session.userId!)
          .then((profile) {
            final apiEmail = profile['email']?.toString() ?? '';
            if (apiEmail.isNotEmpty && emailCtrl.text.isEmpty) {
              emailCtrl.text = apiEmail;
              UserSession.instance.email = apiEmail;
            }
          })
          .catchError((_) {});
    }
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
                          child: BfSpinner(),
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
    final isLoggedIn = session.isLoggedIn;
    final name = session.name ?? 'Guest';
    final phone = session.phone ?? '';
    final initial = name.isNotEmpty ? name[0].toUpperCase() : '?';

    return ListView(
      padding: EdgeInsets.zero,
      children: [
        // ── Header banner ─────────────────────────────────────────────────
        Container(
          padding: const EdgeInsets.fromLTRB(20, 52, 20, 24),
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [Color(0xFF052E16), Color(0xFF16A34A)],
            ),
          ),
          child: Row(
            children: [
              GestureDetector(
                onTap: () => _showAvatarPickerSheet(context),
                child: Stack(
                  children: [
                    CircleAvatar(
                      radius: 36,
                      backgroundColor: const Color(0xFF4ADE80),
                      child: ClipOval(
                        child: CachedNetworkImage(
                          imageUrl: _currentUserAvatarUrl(),
                          width: 72,
                          height: 72,
                          fit: BoxFit.cover,
                          placeholder: (_, _) => Text(
                            initial,
                            style: const TextStyle(
                              fontSize: 28,
                              fontWeight: FontWeight.w900,
                              color: Colors.white,
                            ),
                          ),
                          errorWidget: (_, _, _) => Text(
                            initial,
                            style: const TextStyle(
                              fontSize: 28,
                              fontWeight: FontWeight.w900,
                              color: Colors.white,
                            ),
                          ),
                        ),
                      ),
                    ),
                    Positioned(
                      bottom: 0,
                      right: 0,
                      child: Container(
                        width: 22,
                        height: 22,
                        decoration: BoxDecoration(
                          color: Colors.white,
                          shape: BoxShape.circle,
                          border: Border.all(
                            color: const Color(0xFF16A34A),
                            width: 1.5,
                          ),
                        ),
                        child: const Icon(
                          Icons.edit_rounded,
                          size: 12,
                          color: Color(0xFF16A34A),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      name,
                      style: const TextStyle(
                        fontSize: 19,
                        fontWeight: FontWeight.w800,
                        color: Colors.white,
                      ),
                    ),
                    if (phone.isNotEmpty) ...[
                      const SizedBox(height: 3),
                      Text(
                        phone,
                        style: const TextStyle(
                          fontSize: 13,
                          color: Color(0xFFBBF7D0),
                        ),
                      ),
                    ],
                    const SizedBox(height: 10),
                    GestureDetector(
                      onTap: () => _showEditProfileSheet(context),
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 14,
                          vertical: 5,
                        ),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.2),
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(
                            color: Colors.white.withValues(alpha: 0.5),
                          ),
                        ),
                        child: const Text(
                          'Edit Profile',
                          style: TextStyle(
                            color: Colors.white,
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

        const SizedBox(height: 8),

        // ── Section: My Activity ──────────────────────────────────────────
        _profileSectionHeader('MY ACTIVITY'),
        _ProfileTile(
          icon: Icons.shopping_bag_outlined,
          label: 'My Orders',
          subtitle: 'Track, return or buy again',
          color: const Color(0xFF16A34A),
          onTap: () => setState(() => _tab = 2),
        ),
        _ProfileTile(
          icon: Icons.favorite_border_rounded,
          label: 'Wishlist',
          subtitle: 'Products you have saved',
          color: const Color(0xFFEC4899),
          onTap: () => Navigator.of(
            context,
          ).push(MaterialPageRoute(builder: (_) => const WishlistScreen())),
        ),
        _ProfileTile(
          icon: Icons.local_offer_outlined,
          label: 'My Offers',
          subtitle: 'Coupons, rewards & referrals',
          color: const Color(0xFFF59E0B),
          onTap: () => _showMyOffersSheet(context),
        ),

        const SizedBox(height: 8),

        // ── Section: My Account ───────────────────────────────────────────
        _profileSectionHeader('MY ACCOUNT'),
        _ProfileTile(
          icon: Icons.manage_accounts_outlined,
          label: 'Manage Account',
          subtitle: 'Name, email, phone',
          color: const Color(0xFF6366F1),
          onTap: () => _showEditProfileSheet(context),
        ),
        _ProfileTile(
          icon: Icons.location_on_outlined,
          label: 'Saved Addresses',
          subtitle: 'Home, work and other addresses',
          color: const Color(0xFF0EA5E9),
          onTap: () => Navigator.of(context).push(
            MaterialPageRoute(
              builder: (_) => AddressScreen(
                userId: UserSession.instance.userId ?? '',
                api: _api,
              ),
            ),
          ),
        ),

        const SizedBox(height: 8),

        // ── Section: Support ──────────────────────────────────────────────
        _profileSectionHeader('HELP & SUPPORT'),
        _ProfileTile(
          icon: Icons.headset_mic_outlined,
          label: 'Help & Query',
          subtitle: 'Call, WhatsApp, email & ticket',
          color: const Color(0xFF10B981),
          onTap: () => _showHelpSheet(context),
        ),

        const SizedBox(height: 8),

        // ── Section: Legal ────────────────────────────────────────────────
        _profileSectionHeader('LEGAL & POLICIES'),
        _ProfileTile(
          icon: Icons.gavel_outlined,
          label: 'Terms & Conditions',
          color: const Color(0xFF6B7280),
          onTap: () =>
              _showPolicySheet(context, 'Terms & Conditions', _termsContent),
        ),
        _ProfileTile(
          icon: Icons.privacy_tip_outlined,
          label: 'Privacy Policy',
          color: const Color(0xFF6B7280),
          onTap: () =>
              _showPolicySheet(context, 'Privacy Policy', _privacyContent),
        ),
        _ProfileTile(
          icon: Icons.business_outlined,
          label: 'Company Policy',
          color: const Color(0xFF6B7280),
          onTap: () =>
              _showPolicySheet(context, 'Company Policy', _companyContent),
        ),

        const SizedBox(height: 16),

        // ── Logout ────────────────────────────────────────────────────────
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: OutlinedButton.icon(
            onPressed: () {
              if (isLoggedIn) {
                NotificationService.instance.clearForCurrentUser();
                UserSession.instance.clear();
              }
              Navigator.of(context).pushReplacement(
                MaterialPageRoute(builder: (_) => const LoginScreen()),
              );
            },
            icon: Icon(
              isLoggedIn ? Icons.logout_rounded : Icons.login_rounded,
              color: isLoggedIn
                  ? const Color(0xFFEF4444)
                  : const Color(0xFF16A34A),
            ),
            label: Text(
              isLoggedIn ? 'Log Out' : 'Log In',
              style: TextStyle(
                color: isLoggedIn
                    ? const Color(0xFFEF4444)
                    : const Color(0xFF16A34A),
                fontWeight: FontWeight.w700,
                fontSize: 15,
              ),
            ),
            style: OutlinedButton.styleFrom(
              side: BorderSide(
                color: isLoggedIn
                    ? const Color(0xFFEF4444)
                    : const Color(0xFF16A34A),
              ),
              padding: const EdgeInsets.symmetric(vertical: 14),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
              minimumSize: const Size(double.infinity, 0),
            ),
          ),
        ),

        const SizedBox(height: 32),

        const Center(
          child: Text(
            'BlinkieFash v2.0',
            style: TextStyle(color: Color(0xFFCBD5E1), fontSize: 12),
          ),
        ),
        const SizedBox(height: 24),
      ],
    );
  }

  Widget _profileSectionHeader(String title) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
      child: Text(
        title,
        style: const TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w700,
          color: Color(0xFF9CA3AF),
          letterSpacing: 1.2,
        ),
      ),
    );
  }

  void _showHelpSheet(BuildContext ctx) {
    showModalBottomSheet(
      context: ctx,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (_) => _HelpSupportSheet(api: _api),
    );
  }

  // ── My Offers sheet ───────────────────────────────────────────────────────
  void _showMyOffersSheet(BuildContext ctx) {
    showModalBottomSheet(
      context: ctx,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
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
                margin: const EdgeInsets.only(bottom: 20),
                decoration: BoxDecoration(
                  color: const Color(0xFFE2E8F0),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const Text(
              'My Offers & Rewards',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w800,
                color: Color(0xFF0F172A),
              ),
            ),
            const SizedBox(height: 4),
            const Text(
              'Tap any offer to explore or apply',
              style: TextStyle(color: Color(0xFF94A3B8), fontSize: 13),
            ),
            const SizedBox(height: 18),
            _offerSheetTile(
              ctx,
              '🎁',
              'Refer & Earn',
              'Earn \u20b9100 for every friend you invite',
              const Color(0xFFEA580C),
              () {
                Navigator.of(ctx).push(
                  MaterialPageRoute(builder: (_) => const ReferEarnScreen()),
                );
              },
            ),
            _offerSheetTile(
              ctx,
              '\u267b\ufe0f',
              'Donate Old Clothes',
              'Give back old clothes & earn up to 5% off',
              const Color(0xFF059669),
              () {
                Navigator.of(ctx).push(
                  MaterialPageRoute(builder: (_) => const OldClothesScreen()),
                );
              },
            ),
            _offerSheetTile(
              ctx,
              '\ud83c\udfa1',
              'Spin & Win',
              'Spin the wheel daily — win discounts & big prizes!',
              const Color(0xFFEC4899),
              () {
                Navigator.of(ctx).push(
                  MaterialPageRoute(builder: (_) => const SpinWheelScreen()),
                );
              },
            ),
            _offerSheetTile(
              ctx,
              '\ud83c\udfae',
              'Fashion Quest',
              '1000 levels \u2022 10/day \u2022 Complete levels = +5% off daily',
              const Color(0xFF7C3AED),
              () {
                Navigator.of(ctx).push(
                  MaterialPageRoute(builder: (_) => const FashionQuestScreen()),
                );
              },
            ),
            _offerSheetTile(
              ctx,
              '\ud83d\udcb0',
              'Order Discounts',
              '\u20b9100 off \u20b91000+ \u2022 \u20b9250 off \u20b92000+ \u2022 Buy 2 save 10%',
              const Color(0xFFCA8A04),
              null,
            ),
          ],
        ),
      ),
    );
  }

  Widget _offerSheetTile(
    BuildContext ctx,
    String emoji,
    String title,
    String subtitle,
    Color color,
    VoidCallback? onTap,
  ) {
    return GestureDetector(
      onTap: onTap == null
          ? null
          : () {
              Navigator.pop(ctx);
              onTap();
            },
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.06),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: color.withValues(alpha: 0.2)),
        ),
        child: Row(
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: color,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Center(
                child: Text(emoji, style: const TextStyle(fontSize: 22)),
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF0F172A),
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    subtitle,
                    style: TextStyle(
                      fontSize: 12,
                      color: color.withValues(alpha: 0.85),
                    ),
                  ),
                ],
              ),
            ),
            if (onTap != null)
              Icon(Icons.arrow_forward_ios_rounded, size: 13, color: color)
            else
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  'Auto',
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    color: color,
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  void _showPolicySheet(BuildContext ctx, String title, String body) {
    showModalBottomSheet(
      context: ctx,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => DraggableScrollableSheet(
        initialChildSize: 0.85,
        maxChildSize: 0.95,
        minChildSize: 0.5,
        builder: (_, ctrl) => Container(
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
          ),
          child: Column(
            children: [
              const SizedBox(height: 8),
              Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: const Color(0xFFE5E7EB),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              Padding(
                padding: const EdgeInsets.all(16),
                child: Text(
                  title,
                  style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              const Divider(height: 1),
              Expanded(
                child: SingleChildScrollView(
                  controller: ctrl,
                  padding: const EdgeInsets.all(20),
                  child: Text(
                    body,
                    style: const TextStyle(
                      fontSize: 14,
                      height: 1.7,
                      color: Color(0xFF374151),
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

  static const _termsContent = """TERMS & CONDITIONS

Last updated: July 2026

1. ACCEPTANCE
By using BlinkieFash you agree to these terms.

2. ORDERS & DELIVERY
Orders are subject to availability. 60-minute delivery is our goal but not guaranteed during peak hours or adverse conditions.

3. TRY & BUY
The Try & Buy window is 20 minutes from rider arrival. You may return unused items within the window. Items accepted after the window cannot be returned.

4. RETURNS & REFUNDS
Returns are processed within 2–5 business days. Refunds are credited to the original payment method.

5. PAYMENTS
We accept UPI, cards, net banking and cash on delivery where available.

6. USER CONDUCT
Users must not engage in fraudulent, abusive or illegal activities on the platform.

7. INTELLECTUAL PROPERTY
All content on BlinkieFash is owned by or licensed to Satyamk Technologies Pvt. Ltd.

8. CHANGES
We may update these terms periodically. Continued use constitutes acceptance.

For questions: legal@blinkiefash.in""";

  static const _privacyContent = """PRIVACY POLICY

Last updated: July 2026

1. INFORMATION WE COLLECT
• Name, phone, email and address for order fulfillment
• Location data (with permission) to find nearest dark stores
• Device and usage data for app improvement

2. HOW WE USE YOUR DATA
• Process and deliver your orders
• Send order updates and offers (with consent)
• Improve our services and personalise your experience

3. DATA SHARING
We do not sell your personal data. We share data only with delivery partners and payment processors necessary to fulfill orders.

4. DATA SECURITY
We use industry-standard encryption to protect your data in transit and at rest.

5. YOUR RIGHTS
You may request deletion of your account and data at any time by contacting support@blinkiefash.in.

6. COOKIES
Our app uses minimal cookies/tokens solely for authentication.

7. CONTACT
For privacy concerns: privacy@blinkiefash.in""";

  static const _companyContent = """COMPANY POLICY

BlinkieFash is operated by Satyamk Technologies Pvt. Ltd.

MISSION
To deliver authentic fashion to every doorstep in 60 minutes, empowering local vendors and giving customers a risk-free shopping experience.

VENDOR POLICY
• All vendors undergo manual verification before onboarding
• Vendors must maintain authentic, high-quality inventory
• Commission structures are communicated transparently

DELIVERY POLICY
• 60-minute delivery target in serviceable areas
• Delivery partners are background-verified
• Real-time tracking available in the app

CUSTOMER COMMITMENT
• Genuine products, guaranteed
• Try & Buy: 20-minute home trial, 90-second returns
• 24×7 customer support

SUSTAINABILITY
We are committed to eco-friendly packaging and supporting local fashion ecosystems.

Registered Office:
Satyamk Technologies Pvt. Ltd., Bhubaneswar, Odisha, India

CIN: [Registration Number]
Email: company@blinkiefash.in""";
}

// ── Profile tile ──────────────────────────────────────────────────────────────
class _ProfileTile extends StatelessWidget {
  const _ProfileTile({
    required this.icon,
    required this.label,
    required this.onTap,
    this.subtitle,
    this.color,
  });
  final IconData icon;
  final String label;
  final String? subtitle;
  final VoidCallback onTap;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final ic = color ?? const Color(0xFF374151);
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        child: Row(
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: ic.withValues(alpha: 0.10),
                borderRadius: BorderRadius.circular(14),
              ),
              child: Icon(icon, color: ic, size: 22),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    label,
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF111827),
                    ),
                  ),
                  if (subtitle != null) ...[
                    const SizedBox(height: 2),
                    Text(
                      subtitle!,
                      style: const TextStyle(
                        fontSize: 12,
                        color: Color(0xFF9CA3AF),
                      ),
                    ),
                  ],
                ],
              ),
            ),
            const Icon(
              Icons.chevron_right_rounded,
              color: Color(0xFFD1D5DB),
              size: 20,
            ),
          ],
        ),
      ),
    );
  }
}

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
          const Expanded(child: Center(child: BfSpinner()))
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

// ── Ticket step widget ────────────────────────────────────────────────────────
class _TicketStep extends StatelessWidget {
  const _TicketStep({
    required this.icon,
    required this.label,
    required this.done,
  });

  final IconData icon;
  final String label;
  final bool done;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Column(
        children: [
          Container(
            width: 32,
            height: 32,
            decoration: BoxDecoration(
              color: done
                  ? const Color(0xFF4ADE80)
                  : Colors.white.withValues(alpha: 0.15),
              shape: BoxShape.circle,
            ),
            child: Icon(
              icon,
              size: 16,
              color: done ? const Color(0xFF052E16) : Colors.white54,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            label,
            style: TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w600,
              color: done ? const Color(0xFF4ADE80) : Colors.white54,
            ),
          ),
        ],
      ),
    );
  }
}

class _TicketDivider extends StatelessWidget {
  const _TicketDivider();

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        height: 1,
        margin: const EdgeInsets.only(bottom: 18),
        color: Colors.white.withValues(alpha: 0.2),
      ),
    );
  }
}

// ── Drawer Section ────────────────────────────────────────────────────────────
class _DrawerSection extends StatelessWidget {
  const _DrawerSection({
    required this.title,
    required this.children,
    this.sectionIcon,
  });
  final String title;
  final List<Widget> children;
  final IconData? sectionIcon;
  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 6),
          child: Row(
            children: [
              if (sectionIcon != null)
                ...([
                  Container(
                    width: 24,
                    height: 24,
                    decoration: BoxDecoration(
                      color: const Color(0xFFF1F5F9),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Icon(
                      sectionIcon,
                      size: 14,
                      color: const Color(0xFF475569),
                    ),
                  ),
                  const SizedBox(width: 8),
                ]),
              Text(
                title,
                style: TextStyle(
                  fontSize: sectionIcon != null ? 13 : 10,
                  fontWeight: FontWeight.w800,
                  color: sectionIcon != null
                      ? const Color(0xFF1E293B)
                      : const Color(0xFF94A3B8),
                  letterSpacing: 0.8,
                ),
              ),
            ],
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
    this.icon,
    this.imageUrl,
    this.iconBg,
    required this.label,
    required this.onTap,
  });
  final IconData? icon;
  final String? imageUrl;
  final Color? iconBg;
  final String label;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) {
    Widget leading;
    if (imageUrl != null && imageUrl!.isNotEmpty) {
      leading = ClipRRect(
        borderRadius: BorderRadius.circular(6),
        child: Image.network(
          imageUrl!,
          width: 26,
          height: 26,
          fit: BoxFit.cover,
          errorBuilder: (_, _, _) => Icon(
            icon ?? Icons.storefront_outlined,
            size: 18,
            color: const Color(0xFF374151),
          ),
        ),
      );
    } else if (iconBg != null) {
      leading = Container(
        width: 32,
        height: 32,
        decoration: BoxDecoration(
          color: iconBg,
          borderRadius: BorderRadius.circular(9),
        ),
        child: Icon(icon ?? Icons.circle, size: 17, color: Colors.white),
      );
    } else {
      leading = Icon(
        icon ?? Icons.chevron_right_rounded,
        size: 18,
        color: const Color(0xFF374151),
      );
    }
    return ListTile(
      dense: true,
      leading: leading,
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
                child: Center(child: BfSpinner()),
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
                  onTap: () {
                    Navigator.pop(context);
                    widget.onAddressSelected(addr);
                  },
                  contentPadding: const EdgeInsets.symmetric(
                    horizontal: 20,
                    vertical: 2,
                  ),
                );
              }).toList()),
            ],
            // ── Add new location ────────────────────────────────────
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
              child: InkWell(
                onTap: () {
                  Navigator.pop(context);
                  if (widget.userId != null && widget.userId!.isNotEmpty) {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => AddressScreen(
                          userId: widget.userId!,
                          api: widget.api,
                        ),
                      ),
                    );
                  } else {
                    Navigator.push<PickedAddress>(
                      context,
                      MaterialPageRoute(
                        builder: (_) => const LocationPickerScreen(),
                      ),
                    ).then((picked) {
                      if (picked == null) return;
                      widget.onAddressSelected({
                        'lat': picked.lat,
                        'lng': picked.lng,
                        'city': picked.city,
                        'address_line': picked.addressLine,
                      });
                    });
                  }
                },
                borderRadius: BorderRadius.circular(14),
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 14,
                  ),
                  decoration: BoxDecoration(
                    border: Border.all(color: _green, width: 1.5),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: const Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        Icons.add_location_alt_outlined,
                        color: _green,
                        size: 20,
                      ),
                      SizedBox(width: 8),
                      Text(
                        '+ Add New Location',
                        style: TextStyle(
                          color: _green,
                          fontWeight: FontWeight.w700,
                          fontSize: 14,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Help & Support Sheet ──────────────────────────────────────────────────────
class _HelpSupportSheet extends StatefulWidget {
  const _HelpSupportSheet({required this.api});
  final ApiClient api;
  @override
  State<_HelpSupportSheet> createState() => _HelpSupportSheetState();
}

class _HelpSupportSheetState extends State<_HelpSupportSheet> {
  static const _phoneNum = '919827901891';
  static const _emailAddr = 'support@blinkiefash.in';

  // Ticket form
  bool _showTicket = false;
  bool _submitting = false;
  bool _submitted = false;
  String? _submittedTicketId;
  String _category = 'Order Issue';
  String? _selectedOrderId;
  String? _selectedOrderLabel;
  final _msgCtrl = TextEditingController();

  List<dynamic> _orders = [];
  bool _loadingOrders = false;

  static const _categories = [
    'Order Issue',
    'Delivery Problem',
    'Payment Issue',
    'Return Request',
    'Product Quality',
    'Damaged Item',
    'Wrong Item',
    'Other',
  ];

  @override
  void initState() {
    super.initState();
    _loadOrders();
  }

  Future<void> _loadOrders() async {
    final uid = UserSession.instance.userId;
    if (uid == null) return;
    setState(() => _loadingOrders = true);
    try {
      final list = await widget.api.fetchUserOrders(uid);
      if (mounted) {
        setState(() {
          _orders = list.take(10).toList();
        });
      }
    } catch (_) {}
    if (mounted) setState(() => _loadingOrders = false);
  }

  Future<void> _launch(String url) async {
    final uri = Uri.parse(url);
    try {
      final ok = await launchUrl(uri, mode: LaunchMode.externalApplication);
      if (!ok && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Could not open app. Please try manually.'),
          ),
        );
      }
    } catch (_) {
      // Try without mode
      try {
        await launchUrl(uri);
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(
            context,
          ).showSnackBar(SnackBar(content: Text('Error: $e')));
        }
      }
    }
  }

  Future<void> _openWhatsApp() async {
    final text = Uri.encodeComponent(
      'Hi BlinkieFash Support, I need help with my order. App: BlinkieFash',
    );
    // Try native WhatsApp first
    final nativeUri = Uri.parse('whatsapp://send?phone=$_phoneNum&text=$text');
    try {
      if (await canLaunchUrl(nativeUri)) {
        await launchUrl(nativeUri, mode: LaunchMode.externalApplication);
        return;
      }
    } catch (_) {}
    // Fallback to wa.me
    await _launch('https://wa.me/$_phoneNum?text=$text');
  }

  Future<void> _openEmail() async {
    final subject = Uri.encodeComponent('Support Request - BlinkieFash');
    final body = Uri.encodeComponent(
      'Hi BlinkieFash Support,\n\nI need help with:\n\n',
    );
    final uri = Uri.parse('mailto:$_emailAddr?subject=$subject&body=$body');
    try {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    } catch (_) {
      await _launch('mailto:$_emailAddr');
    }
  }

  void _openInAppChat() {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => SupportChatScreen(api: widget.api),
      ),
    );
  }

  Future<void> _submitTicket() async {
    final msg = _msgCtrl.text.trim();
    if (msg.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please describe your issue')),
      );
      return;
    }
    if (_submitting) return;
    setState(() => _submitting = true);
    try {
      final uid = UserSession.instance.userId;
      final result = await widget.api.submitSupportTicket(
        message: msg,
        category: _category,
        userId: uid,
        orderId: _selectedOrderId,
      );
      if (!mounted) return;

      final success = result['success'] == true;
      if (success) {
        final ticketId = result['ticket']?['id']?.toString();
        setState(() {
          _submitted = true;
          _submittedTicketId = ticketId;
        });
        return;
      }

      // API returned an error — fall back to email
      final errMsg =
          result['error']?.toString() ??
          result['message']?.toString() ??
          'Failed to submit';
      debugPrint('Ticket submit failed: $errMsg');
      await _emailFallback(msg);
    } catch (e) {
      debugPrint('Ticket submit exception: $e');
      if (!mounted) return;
      await _emailFallback(msg);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Future<void> _emailFallback(String msg) async {
    final subject = Uri.encodeComponent('[$_category] Support Ticket');
    final order = _selectedOrderId != null
        ? 'Order: $_selectedOrderLabel\n'
        : '';
    final body = Uri.encodeComponent(
      'Category: $_category\n${order}Issue:\n$msg',
    );
    await _launch('mailto:$_emailAddr?subject=$subject&body=$body');
    if (mounted) {
      setState(() {
        _submitted = true;
        _submittedTicketId = null;
      });
    }
  }

  @override
  void dispose() {
    _msgCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return DraggableScrollableSheet(
      initialChildSize: 0.75,
      maxChildSize: 0.95,
      minChildSize: 0.45,
      expand: false,
      builder: (_, scrollCtrl) => Container(
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        child: Column(
          children: [
            // Handle
            const SizedBox(height: 10),
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: const Color(0xFFE5E7EB),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            // Scrollable body
            Expanded(
              child: SingleChildScrollView(
                controller: scrollCtrl,
                padding: EdgeInsets.only(
                  bottom: MediaQuery.of(context).viewInsets.bottom + 24,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Header
                    Container(
                      margin: const EdgeInsets.fromLTRB(16, 16, 16, 0),
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: [Color(0xFF052E16), Color(0xFF16A34A)],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: Row(
                        children: [
                          Container(
                            width: 44,
                            height: 44,
                            decoration: BoxDecoration(
                              color: Colors.white.withValues(alpha: 0.2),
                              shape: BoxShape.circle,
                            ),
                            child: const Icon(
                              Icons.headset_mic_rounded,
                              color: Colors.white,
                              size: 22,
                            ),
                          ),
                          const SizedBox(width: 14),
                          const Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Help & Support',
                                style: TextStyle(
                                  color: Colors.white,
                                  fontSize: 17,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                              SizedBox(height: 2),
                              Text(
                                'We are here for you 24/7',
                                style: TextStyle(
                                  color: Color(0xFFBBF7D0),
                                  fontSize: 12,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),

                    // Contact cards
                    const Padding(
                      padding: EdgeInsets.fromLTRB(16, 18, 16, 8),
                      child: Text(
                        'CONTACT US',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          color: Color(0xFF9CA3AF),
                          letterSpacing: 1.2,
                        ),
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      child: Row(
                        children: [
                          Expanded(
                            child: _ContactCard(
                              icon: Icons.phone_rounded,
                              label: 'Call Us',
                              subtitle: '+91 98279 01891',
                              color: const Color(0xFF10B981),
                              onTap: () => _launch('tel:+$_phoneNum'),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: _ContactCard(
                              icon: Icons.chat_rounded,
                              label: 'WhatsApp',
                              subtitle: 'Chat instantly',
                              color: const Color(0xFF25D366),
                              onTap: _openWhatsApp,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 12),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      child: Row(
                        children: [
                          Expanded(
                            child: _ContactCard(
                              icon: Icons.email_outlined,
                              label: 'Email',
                              subtitle: 'support@blinkiefash',
                              color: const Color(0xFF6366F1),
                              onTap: _openEmail,
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: _ContactCard(
                              icon: Icons.confirmation_number_outlined,
                              label: 'Create Ticket',
                              subtitle: _showTicket
                                  ? 'Tap to collapse'
                                  : 'Fill & submit issue',
                              color: const Color(0xFFF59E0B),
                              onTap: () => setState(() {
                                _showTicket = !_showTicket;
                                _submitted = false;
                              }),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 12),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      child: SizedBox(
                        width: double.infinity,
                        child: ElevatedButton.icon(
                          onPressed: _openInAppChat,
                          icon: const Icon(Icons.forum_rounded, size: 18),
                          label: const Text(
                            'Open In-App Support Chat',
                            style: TextStyle(fontWeight: FontWeight.w800),
                          ),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF2563EB),
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(vertical: 14),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                          ),
                        ),
                      ),
                    ),

                    // Ticket form
                    if (_showTicket) ...[
                      const Padding(
                        padding: EdgeInsets.fromLTRB(16, 20, 16, 8),
                        child: Text(
                          'CREATE SUPPORT TICKET',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                            color: Color(0xFF9CA3AF),
                            letterSpacing: 1.2,
                          ),
                        ),
                      ),

                      if (_submitted)
                        Container(
                          margin: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                          padding: const EdgeInsets.all(20),
                          decoration: BoxDecoration(
                            gradient: const LinearGradient(
                              colors: [Color(0xFF052E16), Color(0xFF166534)],
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                            ),
                            borderRadius: BorderRadius.circular(18),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Container(
                                    width: 44,
                                    height: 44,
                                    decoration: const BoxDecoration(
                                      color: Color(0xFF16A34A),
                                      shape: BoxShape.circle,
                                    ),
                                    child: const Icon(
                                      Icons.check_rounded,
                                      color: Colors.white,
                                      size: 26,
                                    ),
                                  ),
                                  const SizedBox(width: 14),
                                  const Expanded(
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          'Ticket Raised!',
                                          style: TextStyle(
                                            color: Colors.white,
                                            fontSize: 18,
                                            fontWeight: FontWeight.w800,
                                          ),
                                        ),
                                        SizedBox(height: 2),
                                        Text(
                                          'We will respond within 2–4 hours',
                                          style: TextStyle(
                                            color: Color(0xFFBBF7D0),
                                            fontSize: 12,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ],
                              ),
                              if (_submittedTicketId != null) ...[
                                const SizedBox(height: 16),
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 14,
                                    vertical: 10,
                                  ),
                                  decoration: BoxDecoration(
                                    color: Colors.white.withValues(alpha: 0.12),
                                    borderRadius: BorderRadius.circular(10),
                                  ),
                                  child: Row(
                                    children: [
                                      const Icon(
                                        Icons.confirmation_number_outlined,
                                        color: Color(0xFF4ADE80),
                                        size: 18,
                                      ),
                                      const SizedBox(width: 8),
                                      Text(
                                        'Ticket ID: #${_submittedTicketId!.length > 8 ? _submittedTicketId!.substring(0, 8).toUpperCase() : _submittedTicketId!.toUpperCase()}',
                                        style: const TextStyle(
                                          color: Colors.white,
                                          fontWeight: FontWeight.w700,
                                          fontSize: 13,
                                          letterSpacing: 0.5,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                              const SizedBox(height: 14),
                              const Row(
                                children: [
                                  _TicketStep(
                                    icon: Icons.send_rounded,
                                    label: 'Submitted',
                                    done: true,
                                  ),
                                  _TicketDivider(),
                                  _TicketStep(
                                    icon: Icons.person_search_rounded,
                                    label: 'Reviewing',
                                    done: false,
                                  ),
                                  _TicketDivider(),
                                  _TicketStep(
                                    icon: Icons.mark_email_read_rounded,
                                    label: 'Resolved',
                                    done: false,
                                  ),
                                ],
                              ),
                            ],
                          ),
                        )
                      else ...[
                        // Category chips
                        const Padding(
                          padding: EdgeInsets.fromLTRB(16, 4, 16, 8),
                          child: Text(
                            'Issue Type',
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF374151),
                            ),
                          ),
                        ),
                        SizedBox(
                          height: 36,
                          child: ListView.separated(
                            scrollDirection: Axis.horizontal,
                            padding: const EdgeInsets.symmetric(horizontal: 16),
                            itemCount: _categories.length,
                            separatorBuilder: (_, _) =>
                                const SizedBox(width: 8),
                            itemBuilder: (_, i) {
                              final sel = _categories[i] == _category;
                              return GestureDetector(
                                onTap: () =>
                                    setState(() => _category = _categories[i]),
                                child: Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 14,
                                    vertical: 7,
                                  ),
                                  decoration: BoxDecoration(
                                    color: sel
                                        ? const Color(0xFF16A34A)
                                        : const Color(0xFFF3F4F6),
                                    borderRadius: BorderRadius.circular(20),
                                    border: Border.all(
                                      color: sel
                                          ? const Color(0xFF16A34A)
                                          : const Color(0xFFE5E7EB),
                                    ),
                                  ),
                                  child: Text(
                                    _categories[i],
                                    style: TextStyle(
                                      fontSize: 12,
                                      fontWeight: FontWeight.w700,
                                      color: sel
                                          ? Colors.white
                                          : const Color(0xFF374151),
                                    ),
                                  ),
                                ),
                              );
                            },
                          ),
                        ),

                        // Order selector
                        const Padding(
                          padding: EdgeInsets.fromLTRB(16, 14, 16, 8),
                          child: Text(
                            'Related Order (optional)',
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF374151),
                            ),
                          ),
                        ),
                        if (_loadingOrders)
                          const Center(
                            child: Padding(
                              padding: EdgeInsets.all(8),
                              child: BfSpinner(size: 20),
                            ),
                          )
                        else if (_orders.isEmpty)
                          const Padding(
                            padding: EdgeInsets.fromLTRB(16, 0, 16, 8),
                            child: Text(
                              'No recent orders found',
                              style: TextStyle(
                                color: Color(0xFF9CA3AF),
                                fontSize: 13,
                              ),
                            ),
                          )
                        else
                          SizedBox(
                            height: 44,
                            child: ListView.separated(
                              scrollDirection: Axis.horizontal,
                              padding: const EdgeInsets.symmetric(
                                horizontal: 16,
                              ),
                              itemCount: _orders.length + 1,
                              separatorBuilder: (_, _) =>
                                  const SizedBox(width: 8),
                              itemBuilder: (_, i) {
                                if (i == 0) {
                                  final sel = _selectedOrderId == null;
                                  return GestureDetector(
                                    onTap: () => setState(() {
                                      _selectedOrderId = null;
                                      _selectedOrderLabel = null;
                                    }),
                                    child: Container(
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: 14,
                                        vertical: 10,
                                      ),
                                      decoration: BoxDecoration(
                                        color: sel
                                            ? const Color(0xFFEFF6FF)
                                            : const Color(0xFFF3F4F6),
                                        borderRadius: BorderRadius.circular(10),
                                        border: Border.all(
                                          color: sel
                                              ? const Color(0xFF3B82F6)
                                              : const Color(0xFFE5E7EB),
                                        ),
                                      ),
                                      child: Text(
                                        'None',
                                        style: TextStyle(
                                          fontSize: 12,
                                          fontWeight: FontWeight.w700,
                                          color: sel
                                              ? const Color(0xFF3B82F6)
                                              : const Color(0xFF374151),
                                        ),
                                      ),
                                    ),
                                  );
                                }
                                final order =
                                    _orders[i - 1] as Map<String, dynamic>;
                                final oid = order['id']?.toString() ?? '';
                                final short = oid.length > 8
                                    ? '#${oid.substring(0, 8)}'
                                    : '#$oid';
                                final status =
                                    order['status']?.toString() ?? '';
                                final label = '$short · $status';
                                final sel = _selectedOrderId == oid;
                                return GestureDetector(
                                  onTap: () => setState(() {
                                    _selectedOrderId = oid;
                                    _selectedOrderLabel = label;
                                  }),
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 14,
                                      vertical: 10,
                                    ),
                                    decoration: BoxDecoration(
                                      color: sel
                                          ? const Color(0xFFF0FDF4)
                                          : const Color(0xFFF3F4F6),
                                      borderRadius: BorderRadius.circular(10),
                                      border: Border.all(
                                        color: sel
                                            ? const Color(0xFF16A34A)
                                            : const Color(0xFFE5E7EB),
                                      ),
                                    ),
                                    child: Text(
                                      label,
                                      style: TextStyle(
                                        fontSize: 12,
                                        fontWeight: FontWeight.w700,
                                        color: sel
                                            ? const Color(0xFF16A34A)
                                            : const Color(0xFF374151),
                                      ),
                                    ),
                                  ),
                                );
                              },
                            ),
                          ),

                        // Message
                        const Padding(
                          padding: EdgeInsets.fromLTRB(16, 14, 16, 8),
                          child: Text(
                            'Describe Your Issue',
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF374151),
                            ),
                          ),
                        ),
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 16),
                          child: Container(
                            decoration: BoxDecoration(
                              color: const Color(0xFFF9FAFB),
                              borderRadius: BorderRadius.circular(14),
                              border: Border.all(
                                color: const Color(0xFFE5E7EB),
                              ),
                            ),
                            child: TextField(
                              controller: _msgCtrl,
                              maxLines: 5,
                              style: const TextStyle(fontSize: 14),
                              decoration: const InputDecoration(
                                hintText:
                                    'E.g. My order was not delivered, Item was damaged...',
                                hintStyle: TextStyle(color: Color(0xFFD1D5DB)),
                                border: InputBorder.none,
                                contentPadding: EdgeInsets.all(14),
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(height: 14),
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 16),
                          child: SizedBox(
                            width: double.infinity,
                            child: ElevatedButton.icon(
                              onPressed: _submitting ? null : _submitTicket,
                              icon: _submitting
                                  ? const SizedBox(
                                      width: 16,
                                      height: 16,
                                      child: BfSpinner(size: 16),
                                    )
                                  : const Icon(Icons.send_rounded, size: 16),
                              label: Text(
                                _submitting ? 'Submitting...' : 'Submit Ticket',
                                style: const TextStyle(
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                              style: ElevatedButton.styleFrom(
                                backgroundColor: const Color(0xFFF59E0B),
                                foregroundColor: Colors.white,
                                padding: const EdgeInsets.symmetric(
                                  vertical: 14,
                                ),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                disabledBackgroundColor: const Color(
                                  0xFFE5E7EB,
                                ),
                              ),
                            ),
                          ),
                        ),
                      ],
                    ],
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

class _ContactCard extends StatelessWidget {
  const _ContactCard({
    required this.icon,
    required this.label,
    required this.subtitle,
    required this.color,
    required this.onTap,
  });
  final IconData icon;
  final String label, subtitle;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.07),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: color.withValues(alpha: 0.2)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(icon, color: color, size: 20),
            ),
            const SizedBox(height: 10),
            Text(
              label,
              style: const TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w800,
                color: Color(0xFF111827),
              ),
            ),
            const SizedBox(height: 3),
            Text(
              subtitle,
              style: const TextStyle(fontSize: 11, color: Color(0xFF9CA3AF)),
            ),
          ],
        ),
      ),
    );
  }
}
