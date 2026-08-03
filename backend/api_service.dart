import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

class ApiService {
  static const String baseUrl = 'https://blinkiefashrider.onrender.com';
  String? _token;

  Future<void> loadToken() async {
    final prefs = await SharedPreferences.getInstance();
    _token = prefs.getString('jwt_token');
  }

  Future<void> saveToken(String token, {String? name}) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('jwt_token', token);
    if (name case final n?) await prefs.setString('rider_name', n);
    _token = token;
  }

  Future<String?> getSavedName() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString('rider_name');
  }

  Future<void> logout() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('jwt_token');
    await prefs.remove('rider_name');
    _token = null;
  }

  Map<String, String> get _headers {
    final h = <String, String>{'Content-Type': 'application/json'};
    if (_token != null) h['Authorization'] = _token!;
    return h;
  }

  Future<Map<String, dynamic>?> register({
    required String name,
    required String phone,
    required String password,
    required String vehicleType,
    required String vehicleNumber,
    required String licenseNumber,
  }) async {
    try {
      final res = await http.post(
        Uri.parse('$baseUrl/rider/register'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'name': name,
          'phone': phone,
          'password': password,
          'vehicle_type': vehicleType,
          'vehicle_number': vehicleNumber,
          'license_number': licenseNumber,
        }),
      );
      final body = jsonDecode(res.body) as Map<String, dynamic>;
      if (res.statusCode == 200) {
        await saveToken(
          body['token'] as String,
          name: (body['name'] ?? name) as String?,
        );
        return body;
      }
      return {'error': body['message'] ?? 'Registration failed'};
    } catch (e) {
      return {'error': 'Connection failed: $e'};
    }
  }

  Future<Map<String, dynamic>?> login(String phone, String password) async {
    try {
      final res = await http.post(
        Uri.parse('$baseUrl/rider/login'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'phone': phone, 'password': password}),
      );
      final body = jsonDecode(res.body) as Map<String, dynamic>;
      if (res.statusCode == 200) {
        await saveToken(body['token'] as String, name: body['name'] as String?);
        return body;
      }
      return {'error': body['message'] ?? 'Login failed'};
    } catch (e) {
      return {'error': 'Connection failed: $e'};
    }
  }

  Future<Map<String, dynamic>?> firebaseLogin(String idToken) async {
    try {
      final res = await http
          .post(
            Uri.parse('$baseUrl/rider/firebase-login'),
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode({'idToken': idToken}),
          )
          .timeout(const Duration(seconds: 15));
      return jsonDecode(res.body) as Map<String, dynamic>;
    } catch (_) {
      return null;
    }
  }

  Future<Map<String, dynamic>?> getProfile() async {
    try {
      final res = await http.get(
        Uri.parse('$baseUrl/rider/profile'),
        headers: _headers,
      );
      if (res.statusCode == 200) {
        return jsonDecode(res.body) as Map<String, dynamic>;
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  Future<bool> toggleAvailability(bool isAvailable) async {
    try {
      final res = await http.patch(
        Uri.parse('$baseUrl/rider/availability'),
        headers: _headers,
        body: jsonEncode({'is_available': isAvailable}),
      );
      return res.statusCode == 200;
    } catch (e) {
      return false;
    }
  }

  Future<List<dynamic>> getDeliveries() async {
    try {
      final res = await http.get(
        Uri.parse('$baseUrl/delivery'),
        headers: _headers,
      );
      if (res.statusCode == 200) return jsonDecode(res.body) as List<dynamic>;
      return [];
    } catch (e) {
      return [];
    }
  }

  Future<bool> updateDeliveryStatus(String deliveryId, String status) async {
    try {
      final res = await http.patch(
        Uri.parse('$baseUrl/delivery/$deliveryId/status'),
        headers: _headers,
        body: jsonEncode({'status': status}),
      );
      return res.statusCode == 200;
    } catch (e) {
      return false;
    }
  }

  Future<Map<String, dynamic>> getEarnings() async {
    try {
      final res = await http.get(
        Uri.parse('$baseUrl/rider/earnings'),
        headers: _headers,
      );
      if (res.statusCode == 200) {
        return jsonDecode(res.body) as Map<String, dynamic>;
      }
      return {'payouts': [], 'balance': 0};
    } catch (e) {
      return {'payouts': [], 'balance': 0};
    }
  }

  Future<bool> requestPayout(double amount) async {
    try {
      final res = await http.post(
        Uri.parse('$baseUrl/payout/request'),
        headers: _headers,
        body: jsonEncode({'amount': amount}),
      );
      return res.statusCode == 200;
    } catch (e) {
      return false;
    }
  }

  Future<List<dynamic>> getShifts() async {
    try {
      final res = await http.get(
        Uri.parse('$baseUrl/rider/shifts'),
        headers: _headers,
      );
      if (res.statusCode == 200) return jsonDecode(res.body) as List<dynamic>;
      return [];
    } catch (e) {
      return [];
    }
  }

  Future<Map<String, dynamic>?> startShift() async {
    try {
      final res = await http.post(
        Uri.parse('$baseUrl/shift/start'),
        headers: _headers,
      );
      if (res.statusCode == 200) {
        return jsonDecode(res.body) as Map<String, dynamic>;
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  Future<bool> endShift(String shiftId) async {
    try {
      final res = await http.post(
        Uri.parse('$baseUrl/shift/end'),
        headers: _headers,
        body: jsonEncode({'shiftId': shiftId}),
      );
      return res.statusCode == 200;
    } catch (e) {
      return false;
    }
  }

  Future<List<dynamic>> getNotifications() async {
    try {
      final res = await http.get(
        Uri.parse('$baseUrl/rider/notifications'),
        headers: _headers,
      );
      if (res.statusCode == 200) return jsonDecode(res.body) as List<dynamic>;
      return [];
    } catch (e) {
      return [];
    }
  }

  Future<List<dynamic>> getReviews() async {
    try {
      final res = await http.get(
        Uri.parse('$baseUrl/rider/reviews'),
        headers: _headers,
      );
      if (res.statusCode == 200) return jsonDecode(res.body) as List<dynamic>;
      return [];
    } catch (e) {
      return [];
    }
  }

  Future<List<dynamic>> getSupportTickets() async {
    try {
      final res = await http.get(
        Uri.parse('$baseUrl/rider/support'),
        headers: _headers,
      );
      if (res.statusCode == 200) return jsonDecode(res.body) as List<dynamic>;
      return [];
    } catch (e) {
      return [];
    }
  }

  Future<bool> createSupportTicket(String subject, String description) async {
    try {
      final res = await http.post(
        Uri.parse('$baseUrl/support/create'),
        headers: _headers,
        body: jsonEncode({'subject': subject, 'description': description}),
      );
      return res.statusCode == 200;
    } catch (e) {
      return false;
    }
  }

  // ── Available orders for riders ───────────────────────────────────────────
  Future<List<dynamic>> getAvailableOrders() async {
    try {
      final res = await http.get(
        Uri.parse('$baseUrl/delivery/available'),
        headers: _headers,
      );
      if (res.statusCode == 200) {
        final body = jsonDecode(res.body) as Map<String, dynamic>;
        return (body['orders'] as List?) ?? [];
      }
      return [];
    } catch (e) {
      return [];
    }
  }

  // ── Accept an order (atomic) ──────────────────────────────────────────────
  Future<Map<String, dynamic>> acceptOrder(String orderId) async {
    try {
      final res = await http.post(
        Uri.parse('$baseUrl/delivery/accept/$orderId'),
        headers: _headers,
      );
      final body = jsonDecode(res.body) as Map<String, dynamic>;
      return body;
    } catch (e) {
      return {'success': false, 'message': 'Connection failed'};
    }
  }

  // ── Send rider GPS location (tied to a delivery) ─────────────────────────
  Future<void> updateLocation(String deliveryId, double lat, double lng) async {
    try {
      await http.post(
        Uri.parse('$baseUrl/delivery/$deliveryId/location'),
        headers: _headers,
        body: jsonEncode({'lat': lat, 'lng': lng}),
      );
    } catch (_) {}
  }

  // ── Update rider's general duty location (no delivery required) ───────────
  Future<void> updateRiderLocation(double lat, double lng) async {
    try {
      await http.patch(
        Uri.parse('$baseUrl/rider/location'),
        headers: _headers,
        body: jsonEncode({'lat': lat, 'lng': lng}),
      );
    } catch (_) {}
  }

  // ── Send rider location to parcel delivery system ─────────────────────────
  Future<void> updateParcelDeliveryLocation(
    String requestId,
    double lat,
    double lng, {
    String? riderName,
    String? riderPhone,
    String? riderId,
  }) async {
    try {
      final body = {'lat': lat, 'lng': lng};
      if (riderName != null) body['rider_name'] = riderName;
      if (riderPhone != null) body['rider_phone'] = riderPhone;
      if (riderId != null) body['rider_id'] = riderId;
      await http.patch(
        Uri.parse(
            'https://blinkiefash.onrender.com/api/deliver/request/$requestId/rider-location'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode(body),
      );
    } catch (_) {}
  }

  // ── Get available parcel delivery requests nearby ──────────────────────────
  Future<List<Map<String, dynamic>>> getAvailableParcelRequests(
    double riderLat,
    double riderLng, {
    double radiusKm = 10,
  }) async {
    try {
      final res = await http.get(
        Uri.parse(
          'https://blinkiefash.onrender.com/api/deliver/available?riderLat=$riderLat&riderLng=$riderLng&radiusKm=$radiusKm',
        ),
      );
      if (res.statusCode == 200) {
        final body = jsonDecode(res.body) as Map<String, dynamic>;
        if (body['success'] == true && body['requests'] is List) {
          return (body['requests'] as List)
              .map((e) => e as Map<String, dynamic>)
              .toList();
        }
      }
      return [];
    } catch (_) {
      return [];
    }
  }

  // ── Accept a parcel delivery request (generates OTP) ──────────────────────
  Future<Map<String, dynamic>?> acceptParcelRequest(
    String requestId, {
    required String riderId,
    required String riderName,
    required String riderPhone,
    double? riderLat,
    double? riderLng,
  }) async {
    try {
      final body = {
        'riderId': riderId,
        'riderName': riderName,
        'riderPhone': riderPhone,
      };
      if (riderLat != null) body['riderLat'] = riderLat;
      if (riderLng != null) body['riderLng'] = riderLng;

      final res = await http.patch(
        Uri.parse(
          'https://blinkiefash.onrender.com/api/deliver/request/$requestId/accept',
        ),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode(body),
      );

      if (res.statusCode == 200) {
        return jsonDecode(res.body) as Map<String, dynamic>;
      }
      return jsonDecode(res.body) as Map<String, dynamic>?;
    } catch (e) {
      return {'success': false, 'message': 'Connection failed'};
    }
  }
      return jsonDecode(res.body) as Map<String, dynamic>;
    } catch (e) {
      return {'success': false, 'message': 'Connection failed'};
    }
  }

  /// Submit OTP entered by rider; returns {success, is_try_order}
  Future<Map<String, dynamic>> verifyOtp(String deliveryId, String otp) async {
    try {
      final res = await http.post(
        Uri.parse('$baseUrl/delivery/$deliveryId/verify-otp'),
        headers: _headers,
        body: jsonEncode({'otp': otp}),
      );
      return jsonDecode(res.body) as Map<String, dynamic>;
    } catch (e) {
      return {'success': false, 'message': 'Connection failed'};
    }
  }

  /// Rider selects "try" or "buy"; returns {success, mode, deadline?}
  Future<Map<String, dynamic>> tryBuySelect(
    String deliveryId,
    String mode,
  ) async {
    try {
      final res = await http.post(
        Uri.parse('$baseUrl/delivery/$deliveryId/try-buy-select'),
        headers: _headers,
        body: jsonEncode({'mode': mode}),
      );
      return jsonDecode(res.body) as Map<String, dynamic>;
    } catch (e) {
      return {'success': false, 'message': 'Connection failed'};
    }
  }

  /// Record try-buy final decision: "kept" or "returned"
  Future<Map<String, dynamic>> tryBuyComplete(
    String deliveryId,
    String decision,
  ) async {
    try {
      final res = await http.post(
        Uri.parse('$baseUrl/delivery/$deliveryId/try-buy-complete'),
        headers: _headers,
        body: jsonEncode({'decision': decision}),
      );
      return jsonDecode(res.body) as Map<String, dynamic>;
    } catch (e) {
      return {'success': false, 'message': 'Connection failed'};
    }
  }

  // ── Store pickup OTP ──────────────────────────────────────────────────────

  /// Rider arrived at dark store — triggers store OTP generation
  Future<Map<String, dynamic>> storeArrived(String deliveryId) async {
    try {
      final res = await http.post(
        Uri.parse('$baseUrl/delivery/$deliveryId/store-arrived'),
        headers: _headers,
      );
      return jsonDecode(res.body) as Map<String, dynamic>;
    } catch (e) {
      return {'success': false, 'message': 'Connection failed'};
    }
  }

  /// Verify the 4-digit OTP given by store staff
  Future<Map<String, dynamic>> verifyStoreOtp(
    String deliveryId,
    String otp,
  ) async {
    try {
      final res = await http.post(
        Uri.parse('$baseUrl/delivery/$deliveryId/verify-store-otp'),
        headers: _headers,
        body: jsonEncode({'otp': otp}),
      );
      return jsonDecode(res.body) as Map<String, dynamic>;
    } catch (e) {
      return {'success': false, 'message': 'Connection failed'};
    }
  }

  /// Fetch the current detail of a delivery (to restore phase on re-open)
  Future<Map<String, dynamic>> getDeliveryDetail(String deliveryId) async {
    try {
      final res = await http.get(
        Uri.parse('$baseUrl/delivery/$deliveryId/detail'),
        headers: _headers,
      );
      return jsonDecode(res.body) as Map<String, dynamic>;
    } catch (e) {
      return {'success': false, 'message': 'Connection failed'};
    }
  }

  // ── Pre-delivery photo upload ─────────────────────────────────────────────

  Future<Map<String, dynamic>> uploadDeliveryPhoto(
    String deliveryId,
    String filePath,
  ) async {
    try {
      final file = File(filePath);
      if (!await file.exists()) {
        return {'success': false, 'message': 'Photo file not found'};
      }
      final request = http.MultipartRequest(
        'POST',
        Uri.parse('$baseUrl/upload/delivery-photo/$deliveryId'),
      );
      // Add auth header only (no Content-Type — multipart sets its own)
      if (_token != null) request.headers['Authorization'] = _token!;
      request.files.add(await http.MultipartFile.fromPath('image', file.path));
      final streamed = await request.send().timeout(
        const Duration(seconds: 30),
      );
      final body = await streamed.stream.bytesToString();
      final json = jsonDecode(body) as Map<String, dynamic>;
      if (streamed.statusCode == 200) return json;
      return {
        'success': false,
        'message': json['message'] ?? 'Upload failed (${streamed.statusCode})',
      };
    } catch (e) {
      return {'success': false, 'message': 'Upload failed: $e'};
    }
  }
}
