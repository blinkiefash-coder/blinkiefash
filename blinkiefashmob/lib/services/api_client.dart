import 'dart:convert';
import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

import '../api_base.dart';

class ApiClient {
  ApiClient({http.Client? httpClient})
    : _httpClient = httpClient ?? http.Client();

  final http.Client _httpClient;
  static const Duration _requestTimeout = Duration(seconds: 30);

  /// The nearest dark store to the user's selected location.
  /// Set automatically whenever fetchProductsWithStore returns a storeId.
  /// Passed as [store_id] to all product listing calls so only items
  /// stocked at that specific store are shown.
  static String? currentStoreId;
  static List<String> currentStoreIds = const [];

  /// Human-readable name of the selected delivery area (city or store name).
  /// Used to display delivery location on the product detail screen.
  static String? currentStoreName;
  static const Duration _retryTimeout = Duration(seconds: 45);

  Future<Map<String, dynamic>> startLogin({
    required String phone,
    String expectedRole = 'customer',
  }) async {
    final uri = Uri.parse('$apiBaseUrl/login/start');
    return _postJson(uri, {'phone': phone, 'expectedRole': expectedRole});
  }

  Future<Map<String, dynamic>> verifyLoginOtp({
    required String phone,
    required String otp,
    String expectedRole = 'customer',
  }) async {
    final uri = Uri.parse('$apiBaseUrl/login/verify');
    return _postJson(uri, {
      'phone': phone,
      'otp': otp,
      'expectedRole': expectedRole,
    });
  }

  Future<Map<String, dynamic>> loginWithPassword({
    required String phone,
    required String password,
    String expectedRole = 'customer',
  }) async {
    final uri = Uri.parse('$apiBaseUrl/login/login-password');
    return _postJson(uri, {
      'phone': phone,
      'password': password,
      'expectedRole': expectedRole,
    });
  }

  Future<Map<String, dynamic>> setPassword({
    required String phone,
    required String password,
  }) async {
    final uri = Uri.parse('$apiBaseUrl/login/set-password');
    return _postJson(uri, {'phone': phone, 'password': password});
  }

  Future<Map<String, dynamic>> register({
    required String phone,
    required String name,
    String? email,
    String? password,
    String? referralCode,
  }) async {
    final uri = Uri.parse('$apiBaseUrl/login/register');
    final body = <String, dynamic>{
      'phone': phone,
      'name': name,
      if (email != null && email.isNotEmpty) 'email': email,
      if (referralCode != null && referralCode.isNotEmpty)
        'referralCode': referralCode,
    };
    final registerRes = await _postJson(uri, body);
    // If registration succeeded and password provided, also set the password
    if (registerRes['success'] == true &&
        password != null &&
        password.isNotEmpty) {
      await _postJson(Uri.parse('$apiBaseUrl/login/set-password'), {
        'phone': phone,
        'password': password,
      });
    }
    return registerRes;
  }

  Future<Map<String, dynamic>> googleLogin({required String idToken}) async {
    final uri = Uri.parse('$apiBaseUrl/login/google');
    return _postJson(uri, {'idToken': idToken});
  }

  /// Register the FCM device token for the given user so backend can push
  /// order status updates to this device.
  Future<Map<String, dynamic>> registerFcmToken({
    required String userId,
    required String token,
  }) async {
    final uri = Uri.parse('$apiApiBaseUrl/users/fcm-token');
    return _postJson(uri, {'userId': userId, 'token': token});
  }

  Future<Map<String, dynamic>> verifyWithFirebaseToken({
    required String idToken,
    String expectedRole = 'customer',
  }) async {
    final uri = Uri.parse('$apiBaseUrl/login/verify');
    return _postJson(uri, {'idToken': idToken, 'expectedRole': expectedRole});
  }

  Future<List<dynamic>> fetchBrands() async {
    final uri = Uri.parse('$apiApiBaseUrl/brands');
    final data = await _getJson(uri);
    if (data is List) return data;
    return const [];
  }

  // ── Addresses ──────────────────────────────────────────────────────────────

  Future<List<dynamic>> fetchAddresses(String userId) async {
    final uri = Uri.parse('$apiApiBaseUrl/checkout/addresses?userId=$userId');
    final data = await _getJson(uri);
    if (data is Map && data['addresses'] is List) {
      return data['addresses'] as List;
    }
    return const [];
  }

  Future<Map<String, dynamic>> addAddress({
    required String userId,
    required String addressLine,
    required String city,
    required String pincode,
    double? lat,
    double? lng,
  }) async {
    final uri = Uri.parse('$apiApiBaseUrl/checkout/addresses');
    return _postJson(uri, {
      'userId': userId,
      'address_line': addressLine,
      'city': city,
      'pincode': pincode,
      'lat': lat,
      'lng': lng,
    });
  }

  Future<Map<String, dynamic>> deleteAddress(String addressId) async {
    final uri = Uri.parse('$apiApiBaseUrl/checkout/addresses/$addressId');
    return _deleteJson(uri);
  }

  // ── Orders ─────────────────────────────────────────────────────────────────

  Future<Map<String, dynamic>> placeOrder({
    required String userId,
    required String addressId,
    required List<Map<String, dynamic>> items,
    required double totalAmount,
    bool isTryOrder = false,
    bool useReferralReward = false,
    bool useClothingReward = false,
    bool useFirstOrderDiscount = false,
    String? manualOfferType,
    double? manualOfferDiscount,
    String deliveryScheduleType = 'asap',
    String? scheduledFor,
    String? scheduledSlotLabel,
  }) async {
    final uri = Uri.parse('$apiApiBaseUrl/checkout/orders');
    return _postJson(uri, {
      'userId': userId,
      'addressId': addressId,
      'items': items,
      'totalAmount': totalAmount,
      'isTryOrder': isTryOrder,
      'useReferralReward': useReferralReward,
      'useClothingReward': useClothingReward,
      'useFirstOrderDiscount': useFirstOrderDiscount,
      if (manualOfferType != null && manualOfferType.isNotEmpty)
        'manualOfferType': manualOfferType,
      if (manualOfferDiscount != null && manualOfferDiscount > 0)
        'manualOfferDiscount': manualOfferDiscount,
      'deliveryScheduleType': deliveryScheduleType,
      if (scheduledFor != null && scheduledFor.isNotEmpty)
        'scheduledFor': scheduledFor,
      if (scheduledSlotLabel != null && scheduledSlotLabel.isNotEmpty)
        'scheduledSlotLabel': scheduledSlotLabel,
    });
  }

  Future<List<dynamic>> fetchUserOrders(String userId) async {
    final uri = Uri.parse('$apiApiBaseUrl/checkout/orders?userId=$userId');
    final data = await _getJson(uri);
    if (data is Map && data['orders'] is List) return data['orders'] as List;
    return const [];
  }

  Future<Map<String, dynamic>> fetchOrderDetail(String orderId) async {
    final uri = Uri.parse('$apiApiBaseUrl/checkout/orders/$orderId');
    final data = await _getJson(uri);
    if (data is Map<String, dynamic>) return data;
    return const {};
  }

  Future<Map<String, dynamic>> cancelOrder(
    String orderId, {
    String? reason,
  }) async {
    final uri = Uri.parse('$apiApiBaseUrl/checkout/orders/$orderId/status');
    return _patchJson(uri, {
      'status': 'cancelled',
      if (reason != null && reason.isNotEmpty) 'cancelReason': reason,
    });
  }

  Future<Map<String, dynamic>> fetchOrderRider(String orderId) async {
    final uri = Uri.parse('$apiApiBaseUrl/checkout/orders/$orderId/rider');
    final data = await _getJson(uri);
    if (data is Map<String, dynamic>) return data;
    return const {};
  }

  Future<Map<String, dynamic>> fetchRiderLocation(String orderId) async {
    final uri = Uri.parse('$apiApiBaseUrl/checkout/orders/$orderId/location');
    final data = await _getJson(uri);
    if (data is Map<String, dynamic>) return data;
    return const {};
  }

  /// Poll for OTP + try-buy status on an order (from customer backend).
  /// Returns the order fields: delivery_otp, otp_verified_at,
  /// try_buy_mode, try_buy_started_at, try_buy_deadline, try_buy_decision,
  /// delivery_status.
  Future<Map<String, dynamic>> fetchOrderDeliveryStatus(String orderId) async {
    final uri = Uri.parse(
      '$apiApiBaseUrl/checkout/orders/$orderId/delivery-status',
    );
    final data = await _getJson(uri);
    if (data is Map<String, dynamic>) return data;
    return const {};
  }

  /// Returns `{ products: List, nearestStore: Map? }`
  Future<Map<String, dynamic>> fetchProductsWithStore({
    double? lat,
    double? lng,
  }) async {
    String url = '$apiApiBaseUrl/products';
    if (lat != null && lng != null) {
      url += '?lat=$lat&lng=$lng';
    }
    final uri = Uri.parse(url);
    final data = await _getJson(uri);
    if (data is Map<String, dynamic>) {
      // Persist the nearest store id so all subsequent product calls filter
      // to only show items available at this store.
      final storeId = (data['nearestStore'] as Map?)?['id']?.toString();
      final nearbyStoreIds = (data['nearbyStoreIds'] as List?)
          ?.map((e) => e.toString())
          .where((e) => e.isNotEmpty)
          .toList();
      final storeName =
          (data['nearestStore'] as Map?)?['city']?.toString() ??
          (data['nearestStore'] as Map?)?['name']?.toString();
      if (storeId != null && storeId.isNotEmpty) {
        ApiClient.currentStoreId = storeId;
        ApiClient.currentStoreIds =
            (nearbyStoreIds != null && nearbyStoreIds.isNotEmpty)
            ? nearbyStoreIds
            : [storeId];
        if (storeName != null && storeName.isNotEmpty) {
          ApiClient.currentStoreName = storeName;
        }
      } else if (lat == null && lng == null) {
        ApiClient.currentStoreId = null; // reset when no location
        ApiClient.currentStoreIds = const [];
        ApiClient.currentStoreName = null;
      }
      return data;
    }
    // Legacy: server may return a plain list
    if (data is List<dynamic>) {
      return {'products': data, 'nearestStore': null};
    }
    return const {'products': [], 'nearestStore': null};
  }

  Future<List<dynamic>> fetchProducts({double? lat, double? lng}) async {
    final result = await fetchProductsWithStore(lat: lat, lng: lng);
    final products = result['products'];
    return products is List ? products : const [];
  }

  /// Calculates delivery fee for a given saved address.
  Future<Map<String, dynamic>> fetchDeliveryFee({
    required String addressId,
    required double subtotal,
  }) async {
    final uri = Uri.parse(
      '$apiApiBaseUrl/checkout/delivery-fee?addressId=$addressId&subtotal=${subtotal.toStringAsFixed(2)}',
    );
    final data = await _getJson(uri);
    if (data is Map<String, dynamic>) return data;
    // Fallback when backend is unreachable: apply fee rule client-side
    return {
      'success': false,
      'fee': subtotal >= 1299 ? 0 : 39,
      'distance': null,
      'deliveryRadiusKm': 45,
      'etaMinutes': 60,
      'etaMinMinutes': 50,
      'etaMaxMinutes': 67,
      'withinRange': true,
    };
  }

  Future<List<dynamic>> fetchCategories() async {
    final uri = Uri.parse('$apiApiBaseUrl/categories');
    final data = await _getJson(uri);
    if (data is List<dynamic>) {
      return data;
    }
    return const [];
  }

  Future<List<dynamic>> fetchCategoryMirrors() async {
    final uri = Uri.parse('$apiApiBaseUrl/categories/mirrors');
    final data = await _getJson(uri);
    if (data is List<dynamic>) {
      return data;
    }
    return const [];
  }

  Future<Map<String, dynamic>> fetchAllProducts({
    String? categoryId,
    String? brandId,
    String? search,
    String? sort,
    double? minPrice,
    double? maxPrice,
    int? minDiscount,
    bool noDiscount = false,
    int limit = 40,
    int offset = 0,
  }) async {
    final params = <String, String>{'limit': '$limit', 'offset': '$offset'};
    if (categoryId != null) params['category_id'] = categoryId;
    if (brandId != null) params['brand_id'] = brandId;
    if (search != null && search.isNotEmpty) params['search'] = search;
    if (sort != null) params['sort'] = sort;
    if (minPrice != null) params['min_price'] = minPrice.toStringAsFixed(0);
    if (maxPrice != null) params['max_price'] = maxPrice.toStringAsFixed(0);
    if (minDiscount != null) params['min_discount'] = '$minDiscount';
    if (noDiscount) params['no_discount'] = 'true';
    if (ApiClient.currentStoreId != null) {
      if (ApiClient.currentStoreIds.isNotEmpty) {
        params['store_ids'] = ApiClient.currentStoreIds.join(',');
      } else {
        params['store_id'] = ApiClient.currentStoreId!;
      }
    }
    final uri = Uri.parse(
      '$apiApiBaseUrl/products',
    ).replace(queryParameters: params);
    final data = await _getJson(uri);
    if (data is Map<String, dynamic>) return data;
    return const {};
  }

  Future<List<dynamic>> fetchBestsellers() async {
    final storeParam = ApiClient.currentStoreIds.isNotEmpty
        ? '&store_ids=${ApiClient.currentStoreIds.join(',')}'
        : (ApiClient.currentStoreId != null
              ? '&store_id=${ApiClient.currentStoreId}'
              : '');
    // Try the dedicated bestsellers endpoint first
    final uri = Uri.parse(
      '$apiApiBaseUrl/products/bestsellers?limit=10$storeParam',
    );
    final data = await _getJson(uri);
    if (data is Map &&
        data['bestsellers'] is List &&
        (data['bestsellers'] as List).isNotEmpty) {
      return data['bestsellers'] as List;
    }
    // Fallback: query regular products endpoint with is_bestseller filter
    final uri2 = Uri.parse(
      '$apiApiBaseUrl/products?is_bestseller=true&limit=10$storeParam',
    );
    final data2 = await _getJson(uri2);
    if (data2 is Map &&
        data2['products'] is List &&
        (data2['products'] as List).isNotEmpty) {
      return data2['products'] as List;
    }
    return const [];
  }

  /// Fetch products within a specific price range
  /// [minPrice] and [maxPrice] define the range (inclusive)
  /// Returns list of products with id, name, price, image, etc.
  /// Uses the main /products endpoint so is_try_and_buy is correctly returned.
  Future<List<dynamic>> fetchProductsByPriceRange({
    required double minPrice,
    required double maxPrice,
    int limit = 10,
  }) async {
    final params = <String, String>{
      'limit': '$limit',
      'min_price': minPrice.toStringAsFixed(0),
      'max_price': maxPrice.toStringAsFixed(0),
    };
    if (ApiClient.currentStoreId != null) {
      if (ApiClient.currentStoreIds.isNotEmpty) {
        params['store_ids'] = ApiClient.currentStoreIds.join(',');
      } else {
        params['store_id'] = ApiClient.currentStoreId!;
      }
    }
    final uri = Uri.parse(
      '$apiApiBaseUrl/products',
    ).replace(queryParameters: params);
    final data = await _getJson(uri);
    if (data is Map && data['products'] is List) {
      return data['products'] as List;
    }
    if (data is List) return data;
    return const [];
  }

  /// Fetch products with active bulk offers (Buy 2 at 999, Buy 3 at 999, etc.)
  /// Returns list of products with bulk_offers field containing offer details
  Future<List<dynamic>> fetchBulkOffers({int limit = 10}) async {
    // Do NOT filter by store_id — show all bulk offers regardless of store
    final uri = Uri.parse('$apiApiBaseUrl/products/bulk-offers?limit=$limit');
    final data = await _getJson(uri);
    if (data is Map && data['products'] is List) {
      return data['products'] as List;
    }
    return const [];
  }

  Future<Map<String, dynamic>> estimateDeliverFare({
    required double pickupLat,
    required double pickupLng,
    required double dropLat,
    required double dropLng,
    String? city,
    String distanceProvider = 'auto',
  }) async {
    final params = <String, String>{
      'pickupLat': pickupLat.toStringAsFixed(7),
      'pickupLng': pickupLng.toStringAsFixed(7),
      'dropLat': dropLat.toStringAsFixed(7),
      'dropLng': dropLng.toStringAsFixed(7),
      'distanceProvider': distanceProvider,
      if (city != null && city.trim().isNotEmpty) 'city': city.trim(),
    };
    final uri = Uri.parse(
      '$apiApiBaseUrl/deliver/estimate',
    ).replace(queryParameters: params);
    final data = await _getJson(uri);
    if (data is Map<String, dynamic>) return data;
    return const {'success': false, 'message': 'Invalid estimate response'};
  }

  Future<Map<String, dynamic>> createDeliverRequest({
    String? userId,
    required String pickupText,
    required String dropText,
    required double pickupLat,
    required double pickupLng,
    required double dropLat,
    required double dropLng,
    String? city,
    String distanceProvider = 'auto',
    String? receiverName,
    String? receiverPhone,
    String? note,
    String whoPays = 'sender',
  }) async {
    final uri = Uri.parse('$apiApiBaseUrl/deliver/request');
    return _postJson(uri, {
      if (userId != null && userId.isNotEmpty) 'userId': userId,
      'pickupText': pickupText,
      'dropText': dropText,
      'pickupLat': pickupLat,
      'pickupLng': pickupLng,
      'dropLat': dropLat,
      'dropLng': dropLng,
      'distanceProvider': distanceProvider,
      if (city != null && city.trim().isNotEmpty) 'city': city.trim(),
      if (receiverName != null && receiverName.isNotEmpty)
        'receiverName': receiverName,
      if (receiverPhone != null && receiverPhone.isNotEmpty)
        'receiverPhone': receiverPhone,
      if (note != null && note.isNotEmpty) 'note': note,
      'whoPays': whoPays,
    });
  }

  Future<List<dynamic>> fetchVendorDeliverRequests({
    required String vendorId,
    String status = 'pending',
  }) async {
    final uri = Uri.parse(
      '$apiApiBaseUrl/deliver/vendor/$vendorId/requests?status=$status',
    );
    final data = await _getJson(uri);
    if (data is Map && data['requests'] is List) {
      return data['requests'] as List;
    }
    return const [];
  }

  Future<Map<String, dynamic>> updateVendorDeliverRequestStatus({
    required String vendorId,
    required String requestId,
    required String status,
  }) async {
    final uri = Uri.parse(
      '$apiApiBaseUrl/deliver/vendor/$vendorId/requests/$requestId',
    );
    return _patchJson(uri, {'status': status});
  }

  Future<Map<String, dynamic>> submitSupportTicket({
    required String message,
    required String category,
    String? userId,
    String? orderId,
  }) async {
    final uri = Uri.parse('$apiApiBaseUrl/support/tickets');
    try {
      final response = await _httpClient
          .post(
            uri,
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode({
              'user_id': userId,
              'order_id': orderId,
              'category': category,
              'message': message,
            }),
          )
          .timeout(const Duration(seconds: 20));
      final decoded = _decodeBody(response.body);
      if (response.statusCode >= 200 && response.statusCode < 300) {
        return decoded is Map<String, dynamic> ? decoded : {'success': true};
      }
      final errMsg =
          (decoded is Map ? (decoded['error'] ?? decoded['message']) : null)
              ?.toString() ??
          'Server error (${response.statusCode})';
      return {'success': false, 'error': errMsg};
    } catch (e) {
      return {'success': false, 'error': e.toString()};
    }
  }

  Future<List<dynamic>> fetchSupportTickets(String userId) async {
    final uri = Uri.parse('$apiApiBaseUrl/support/tickets?user_id=$userId');
    final data = await _getJson(uri);
    if (data is Map && data['tickets'] is List) return data['tickets'] as List;
    return const [];
  }

  Future<Map<String, dynamic>> fetchProductDetail(String productId) async {
    final uri = Uri.parse('$apiApiBaseUrl/products/$productId');
    final data = await _getJson(uri);
    if (data is Map<String, dynamic>) {
      return data;
    }
    return const {};
  }

  // ── Vendor (mobile vendor panel) ─────────────────────────────────────────

  Future<Map<String, dynamic>> vendorLoginWithPassword({
    required String email,
    required String password,
  }) async {
    final uri = Uri.parse('$apiApiBaseUrl/vendor/login-password');
    return _postJson(uri, {
      'email': email.trim().toLowerCase(),
      'password': password,
    });
  }

  Future<List<dynamic>> fetchVendorProducts(String vendorId) async {
    final uri = Uri.parse('$apiApiBaseUrl/vendor/$vendorId/products');
    final data = await _getJson(uri);
    if (data is List) return data;
    return const [];
  }

  Future<List<dynamic>> fetchVendorOrders(String vendorId) async {
    final uri = Uri.parse('$apiApiBaseUrl/vendor/$vendorId/orders');
    final data = await _getJson(uri);
    if (data is List) return data;
    return const [];
  }

  Future<Map<String, dynamic>> updateVendorOrderStatus({
    required String vendorId,
    required String orderId,
    required String status,
    String? cancelReason,
  }) async {
    final uri = Uri.parse(
      '$apiApiBaseUrl/vendor/$vendorId/orders/$orderId/status',
    );
    return _patchJson(uri, {
      'status': status,
      if (cancelReason != null && cancelReason.trim().isNotEmpty)
        'cancelReason': cancelReason.trim(),
    });
  }

  Future<Map<String, dynamic>> fetchVendorOrderDeliveryStatus(
    String orderId,
  ) async {
    final uri = Uri.parse(
      '$apiApiBaseUrl/checkout/orders/$orderId/delivery-status',
    );
    final data = await _getJson(uri);
    if (data is Map<String, dynamic>) return data;
    return const {};
  }

  Future<List<dynamic>> fetchDarkStores() async {
    final uri = Uri.parse('$apiApiBaseUrl/checkout/darkstores');
    final data = await _getJson(uri);
    if (data is Map && data['stores'] is List) return data['stores'] as List;
    return const [];
  }

  Future<List<dynamic>> fetchDarkStoreProducts(String storeId) async {
    final uri = Uri.parse(
      '$apiApiBaseUrl/checkout/darkstore/$storeId/products',
    );
    final data = await _getJson(uri);
    if (data is List) return data;
    return const [];
  }

  Future<List<String>> uploadImages(List<String> filePaths) async {
    if (filePaths.isEmpty) return const [];

    final uri = Uri.parse('$apiApiBaseUrl/upload');
    final request = http.MultipartRequest('POST', uri);
    for (final path in filePaths) {
      request.files.add(await http.MultipartFile.fromPath('image', path));
    }

    final streamed = await request.send().timeout(const Duration(seconds: 45));
    final body = await streamed.stream.bytesToString();
    final decoded = _decodeBody(body);
    if (streamed.statusCode >= 200 && streamed.statusCode < 300) {
      final urls = (decoded is Map) ? decoded['image_urls'] : null;
      if (urls is List) {
        return urls
            .map((e) => e.toString())
            .where((e) => e.isNotEmpty)
            .toList();
      }
    }
    return const [];
  }

  Future<Map<String, dynamic>> fetchVendorProfile(String vendorId) async {
    final uri = Uri.parse('$apiApiBaseUrl/vendor/$vendorId');
    final data = await _getJson(uri);
    if (data is Map<String, dynamic>) return data;
    return const {};
  }

  Future<Map<String, dynamic>> fetchVendorLinkedStore(String vendorId) async {
    final uri = Uri.parse('$apiApiBaseUrl/vendor/$vendorId/store');
    final data = await _getJson(uri);
    if (data is Map<String, dynamic>) return data;
    return const {};
  }

  Future<Map<String, dynamic>> setVendorOperationalStatus({
    required String vendorId,
    required bool isOperational,
  }) async {
    final uri = Uri.parse('$apiApiBaseUrl/vendor/$vendorId/operational-status');
    return _patchJson(uri, {'is_operational': isOperational});
  }

  Future<Map<String, dynamic>> createVendorProduct({
    required String vendorId,
    required String categoryId,
    required String name,
    String? description,
    String? shortDescription,
    String? fullDescription,
    String? brand,
    double? price,
    double? mrp,
    int? stock,
    bool isTryEnabled = true,
    List<Map<String, dynamic>> bundleOffers = const [],
    String size = 'M',
    String color = 'Black',
    String? barcode,
    List<String> images = const [],
    String? storeId,
    List<Map<String, dynamic>> variants = const [],
  }) async {
    final uri = Uri.parse('$apiApiBaseUrl/products/create');

    final payloadVariants = variants.isNotEmpty
        ? variants
        : <Map<String, dynamic>>[
            {
              'size': size,
              'color': color,
              if (barcode != null && barcode.trim().isNotEmpty)
                'barcode': barcode.trim(),
              'price': price ?? 0,
              'mrp': mrp ?? 0,
              'quantity': stock ?? 0,
              'images': images,
            },
          ];

    return _postJson(uri, {
      'product': {
        'vendor_id': vendorId,
        'category_id': categoryId,
        if (brand != null && brand.trim().isNotEmpty) 'brand': brand.trim(),
        'name': name,
        if (shortDescription != null && shortDescription.trim().isNotEmpty)
          'short_description': shortDescription.trim(),
        if (fullDescription != null && fullDescription.trim().isNotEmpty)
          'full_description': fullDescription.trim(),
        if (description != null && description.trim().isNotEmpty)
          'full_description': description.trim(),
        'is_try_enabled': isTryEnabled,
        'store_id': storeId,
      },
      'variants': payloadVariants,
      'bundleOffers': bundleOffers,
    });
  }

  Future<Map<String, dynamic>> updateVendorVariantStock({
    required String vendorId,
    required String variantId,
    required int quantity,
    double? price,
    double? mrp,
  }) async {
    final uri = Uri.parse(
      '$apiApiBaseUrl/vendor/$vendorId/variants/$variantId/stock',
    );
    return _patchJson(uri, {
      'stock': quantity,
      if (price != null) 'price': price,
      if (mrp != null) 'mrp': mrp,
    });
  }

  Future<Map<String, dynamic>> fetchVariantAvailability(
    List<String> variantIds,
  ) async {
    final ids = variantIds
        .map((v) => v.trim())
        .where((v) => v.isNotEmpty)
        .toList();
    if (ids.isEmpty) {
      return const {'success': true, 'availability': []};
    }
    final uri = Uri.parse('$apiApiBaseUrl/products/variants/availability');
    return _postJson(uri, {
      'variantIds': ids,
      // Match against all nearby stores (same as product listing), not just the
      // single nearest one, so vendors tied to a specific nearby dark store
      // aren't wrongly marked unavailable at checkout.
      if (ApiClient.currentStoreIds.isNotEmpty)
        'storeIds': ApiClient.currentStoreIds
      else if (ApiClient.currentStoreId != null)
        'storeId': ApiClient.currentStoreId,
    });
  }

  // ── Reviews ────────────────────────────────────────────────────────────────

  /// GET /api/reviews/product/:productId
  /// Returns { success, count, average_rating, reviews: [...] }
  Future<Map<String, dynamic>> fetchReviews(String productId) async {
    final uri = Uri.parse('$apiApiBaseUrl/reviews/product/$productId');
    final data = await _getJson(uri);
    if (data is Map<String, dynamic>) return data;
    return const {};
  }

  /// Upload a single image file and return the Cloudinary URL.
  Future<String?> uploadReviewImage(String filePath) async {
    try {
      final uri = Uri.parse('$apiApiBaseUrl/upload');
      final request = http.MultipartRequest('POST', uri);
      request.files.add(await http.MultipartFile.fromPath('image', filePath));
      final streamed = await request.send().timeout(
        const Duration(seconds: 30),
      );
      final body = await streamed.stream.bytesToString();
      final decoded = jsonDecode(body);
      if (streamed.statusCode >= 200 && streamed.statusCode < 300) {
        final urls = decoded['image_urls'];
        if (urls is List && urls.isNotEmpty) return urls.first?.toString();
      }
      debugPrint('Image upload failed: $body');
      return null;
    } catch (e) {
      debugPrint('Image upload error: $e');
      return null;
    }
  }

  /// POST /api/reviews
  Future<Map<String, dynamic>> submitReview({
    required String productId,
    required int rating,
    required String reviewText,
    String? reviewerName,
    String? imageUrl,
    String? userId,
  }) async {
    final uri = Uri.parse('$apiApiBaseUrl/reviews');
    return _postJson(uri, {
      'productId': productId,
      'rating': rating,
      'reviewText': reviewText,
      if (reviewerName != null && reviewerName.isNotEmpty)
        'reviewerName': reviewerName,
      if (imageUrl != null && imageUrl.isNotEmpty) 'imageUrl': imageUrl,
      if (userId != null && userId.isNotEmpty) 'userId': userId,
    });
  }

  // ── User profile ───────────────────────────────────────────────────────────

  Future<Map<String, dynamic>> fetchUserProfile(String userId) async {
    final uri = Uri.parse('$apiApiBaseUrl/users/$userId');
    final data = await _getJson(uri);
    if (data is Map<String, dynamic>) return data;
    return const {};
  }

  // Alias for fetchUserProfile - returns user details including referred_by field
  Future<Map<String, dynamic>> fetchUserDetails(String userId) async {
    return fetchUserProfile(userId);
  }

  Future<Map<String, dynamic>> updateUserProfile({
    required String userId,
    String? name,
    String? email,
  }) async {
    final uri = Uri.parse('$apiApiBaseUrl/users/$userId');
    return _patchJson(uri, {'name': ?name, 'email': ?email});
  }

  Future<Map<String, dynamic>> _postJson(
    Uri uri,
    Map<String, dynamic> body,
  ) async {
    final response = await _withTimeoutRetry(
      () => _httpClient.post(
        uri,
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode(body),
      ),
    );

    if (response.statusCode < 200 || response.statusCode >= 300) {
      final errBody = _decodeBody(response.body);
      final msg =
          (errBody is Map ? errBody['message'] : null)?.toString() ??
          (errBody is Map ? errBody['error'] : null)?.toString() ??
          'Request failed (${response.statusCode})';
      return {'success': false, 'message': msg};
    }

    final decoded = _decodeBody(response.body);
    if (decoded is Map<String, dynamic>) {
      return decoded;
    }

    return {'success': false, 'message': 'Unexpected server response'};
  }

  Future<dynamic> _getJson(Uri uri) async {
    final response = await _withTimeoutRetry(() => _httpClient.get(uri));
    if (response.statusCode < 200 || response.statusCode >= 300) {
      return null;
    }
    return _decodeBody(response.body);
  }

  Future<http.Response> _withTimeoutRetry(
    Future<http.Response> Function() request,
  ) async {
    try {
      return await request().timeout(_requestTimeout);
    } on TimeoutException {
      return request().timeout(_retryTimeout);
    }
  }

  Future<Map<String, dynamic>> _deleteJson(Uri uri) async {
    final response = await _withTimeoutRetry(() => _httpClient.delete(uri));
    if (response.statusCode < 200 || response.statusCode >= 300) {
      return {
        'success': false,
        'message': 'Delete failed (${response.statusCode})',
      };
    }
    final decoded = _decodeBody(response.body);
    if (decoded is Map<String, dynamic>) return decoded;
    return {'success': true};
  }

  Future<Map<String, dynamic>> _patchJson(
    Uri uri,
    Map<String, dynamic> body,
  ) async {
    final response = await _withTimeoutRetry(
      () => _httpClient.patch(
        uri,
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode(body),
      ),
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      final errBody = _decodeBody(response.body);
      final msg =
          (errBody is Map ? errBody['message'] : null)?.toString() ??
          (errBody is Map ? errBody['error'] : null)?.toString() ??
          'Request failed (${response.statusCode})';
      return {'success': false, 'message': msg};
    }
    final decoded = _decodeBody(response.body);
    if (decoded is Map<String, dynamic>) return decoded;
    return {'success': false, 'message': 'Unexpected server response'};
  }

  dynamic _decodeBody(String body) {
    try {
      return jsonDecode(body);
    } catch (_) {
      return null;
    }
  }

  // ── Referrals ──────────────────────────────────────────────────────────────

  Future<Map<String, dynamic>> fetchReferralInfo(String userId) async {
    final uri = Uri.parse('$apiApiBaseUrl/referrals/$userId');
    final data = await _getJson(uri);
    if (data is Map<String, dynamic>) return data;
    return const {};
  }

  Future<Map<String, dynamic>> validateReferralCode(String code) async {
    final uri = Uri.parse('$apiApiBaseUrl/referrals/validate/$code');
    final data = await _getJson(uri);
    if (data is Map<String, dynamic>) return data;
    return const {'valid': false};
  }

  Future<Map<String, dynamic>> applyReferralCode(
    String userId,
    String code,
  ) async {
    final uri = Uri.parse('$apiApiBaseUrl/users/$userId/apply-referral-code');
    final body = {'referralCode': code};
    final data = await _postJson(uri, body);
    return data;
  }

  // ── Old clothes pickup ─────────────────────────────────────────────────────

  Future<Map<String, dynamic>> fetchOldClothesInfo(String userId) async {
    final uri = Uri.parse('$apiApiBaseUrl/old-clothes/$userId');
    final data = await _getJson(uri);
    if (data is Map<String, dynamic>) return data;
    return const {};
  }

  Future<Map<String, dynamic>> requestClothesPickup({
    required String userId,
    required String addressId,
    required int itemCount,
    String? pickupSlot,
    String? notes,
  }) async {
    final uri = Uri.parse('$apiApiBaseUrl/old-clothes');
    return _postJson(uri, {
      'userId': userId,
      'addressId': addressId,
      'itemCount': itemCount,
      if (pickupSlot != null && pickupSlot.isNotEmpty) 'pickupSlot': pickupSlot,
      if (notes != null && notes.isNotEmpty) 'notes': notes,
    });
  }

  // ── Rewards (checkout preview) ─────────────────────────────────────────────

  Future<Map<String, dynamic>> fetchAvailableRewards(String userId) async {
    final uri = Uri.parse('$apiApiBaseUrl/checkout/rewards?userId=$userId');
    final data = await _getJson(uri);
    if (data is Map<String, dynamic>) return data;
    return const {};
  }

  // ── Gamification (account-scoped) ─────────────────────────────────────────

  Future<Map<String, dynamic>> fetchGamificationState(String userId) async {
    final uri = Uri.parse('$apiApiBaseUrl/gamification/state?userId=$userId');
    final data = await _getJson(uri);
    if (data is Map<String, dynamic>) return data;
    return const {};
  }

  Future<Map<String, dynamic>> claimSpinReward({
    required String userId,
    required String prizeLabel,
    required double rewardPercent,
  }) async {
    final uri = Uri.parse('$apiApiBaseUrl/gamification/spin');
    return _postJson(uri, {
      'userId': userId,
      'prizeLabel': prizeLabel,
      'rewardPercent': rewardPercent,
    });
  }

  Future<Map<String, dynamic>> spinAndClaimReward({
    required String userId,
  }) async {
    final uri = Uri.parse('$apiApiBaseUrl/gamification/spin');
    return _postJson(uri, {'userId': userId});
  }

  Future<Map<String, dynamic>> completeFashionQuestLevel({
    required String userId,
  }) async {
    final uri = Uri.parse('$apiApiBaseUrl/gamification/quest/complete-level');
    return _postJson(uri, {'userId': userId});
  }
}
