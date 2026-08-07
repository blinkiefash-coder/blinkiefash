import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

import '../api_base.dart';

class BackendKeepAliveService {
  BackendKeepAliveService._();

  static final BackendKeepAliveService instance = BackendKeepAliveService._();

  static const Duration _interval = Duration(minutes: 2);
  static const Duration _timeout = Duration(seconds: 25);

  Timer? _timer;
  bool _started = false;
  bool _inFlight = false;

  void start() {
    if (_started) return;
    _started = true;
    _pingOnce(reason: 'start');
    _timer = Timer.periodic(_interval, (_) {
      _pingOnce(reason: 'periodic');
    });
  }

  void stop() {
    _timer?.cancel();
    _timer = null;
    _started = false;
  }

  void pingNow({String reason = 'manual'}) {
    _pingOnce(reason: reason);
  }

  Future<void> _pingOnce({required String reason}) async {
    if (_inFlight) return;
    _inFlight = true;
    try {
      final uri = Uri.parse('$apiBaseUrl/health');
      final response = await http.get(uri).timeout(_timeout);
      if (kDebugMode) {
        debugPrint('[KeepAlive] ping($reason) -> ${response.statusCode}');
      }
    } catch (error) {
      if (kDebugMode) {
        debugPrint('[KeepAlive] ping($reason) failed: $error');
      }
    } finally {
      _inFlight = false;
    }
  }
}