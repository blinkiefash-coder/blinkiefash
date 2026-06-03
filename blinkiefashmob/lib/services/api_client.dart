import 'dart:convert';
import 'dart:async';

import 'package:http/http.dart' as http;

import '../api_base.dart';

class ApiClient {
  ApiClient({http.Client? httpClient})
    : _httpClient = httpClient ?? http.Client();

  final http.Client _httpClient;
  static const Duration _requestTimeout = Duration(seconds: 8);

  /// The nearest dark store to the user's selected location.
  /// Set automatically whenever fetchProductsWithStore returns a storeId.
  /// Passed as [store_id] to all product listing calls so only items
  /// stocked at that specific store are shown.
  static String? currentStoreId;
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
    final uri = Uri.parse('$apiBaseUrl/users/fcm-token');
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
      if (lat != null) 'lat': lat,
      if (lng != null) 'lng': lng,
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

  Future<Map<String, dynamic>> cancelOrder(String orderId) async {
    final uri = Uri.parse('$apiApiBaseUrl/checkout/orders/$orderId/status');
    return _patchJson(uri, {'status': 'cancelled'});
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
      if (storeId != null && storeId.isNotEmpty) {
        ApiClient.currentStoreId = storeId;
      } else if (lat == null && lng == null) {
        ApiClient.currentStoreId = null; // reset when no location
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
      'fee': subtotal >= 1499 ? 0 : 49,
      'distance': null,
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

  Future<Map<String, dynamic>> fetchAllProducts({
    String? categoryId,
    String? brandId,
    String? search,
    String? sort,
    double? minPrice,
    double? maxPrice,
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
    if (ApiClient.currentStoreId != null) {
      params['store_id'] = ApiClient.currentStoreId!;
    }
    final uri = Uri.parse(
      '$apiApiBaseUrl/products',
    ).replace(queryParameters: params);
    final data = await _getJson(uri);
    if (data is Map<String, dynamic>) return data;
    return const {};
  }

  Future<List<dynamic>> fetchBestsellers() async {
    final storeParam = ApiClient.currentStoreId != null
        ? '&store_id=${ApiClient.currentStoreId}'
        : '';
    final uri = Uri.parse(
      '$apiApiBaseUrl/products/bestsellers?limit=10$storeParam',
    );
    final data = await _getJson(uri);
    if (data is Map && data['bestsellers'] is List) {
      return data['bestsellers'] as List;
    }
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
    return _patchJson(uri, {
      if (name != null) 'name': name,
      if (email != null) 'email': email,
    });
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
    if (data is Map<String, dynamic>) return data;
    return const {'success': false, 'message': 'Network error'};
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
}
