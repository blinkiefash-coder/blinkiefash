import 'dart:async';
import 'dart:convert';
import 'dart:math';

import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

import '../api_base.dart';
import 'user_session.dart';

/// Fire-and-forget logging of searches, product views/clicks and dwell time
/// so the backend can build search ranking + personalization data later.
///
/// Every call is best-effort: network/parsing failures are swallowed so
/// analytics can never crash the app or block the UI.
class AnalyticsService {
  AnalyticsService._();
  static final AnalyticsService instance = AnalyticsService._();

  static const _sessionIdKey = 'analytics_session_id';
  String? _sessionId;

  Future<String> _getSessionId() async {
    if (_sessionId != null) return _sessionId!;
    final prefs = await SharedPreferences.getInstance();
    var id = prefs.getString(_sessionIdKey);
    if (id == null || id.isEmpty) {
      id = _generateId();
      await prefs.setString(_sessionIdKey, id);
    }
    _sessionId = id;
    return id;
  }

  // Persistent per-install anonymous id — no uuid package dependency needed.
  String _generateId() {
    final rand = Random();
    final ts = DateTime.now().microsecondsSinceEpoch.toRadixString(36);
    final rnd = List.generate(
      12,
      (_) => rand.nextInt(36).toRadixString(36),
    ).join();
    return '$ts-$rnd';
  }

  Future<void> logEvent({
    required String eventType,
    String? searchQuery,
    String? productId,
    String? categoryId,
    int? resultCount,
    int? durationMs,
    Map<String, dynamic>? metadata,
  }) async {
    try {
      final sessionId = await _getSessionId();
      final userId = UserSession.instance.userId;
      final uri = Uri.parse('$apiApiBaseUrl/analytics/event');
      final body = jsonEncode({
        'session_id': sessionId,
        if (userId != null && userId.isNotEmpty) 'user_id': userId,
        'event_type': eventType,
        if (searchQuery != null && searchQuery.isNotEmpty)
          'search_query': searchQuery,
        if (productId != null && productId.isNotEmpty) 'product_id': productId,
        if (categoryId != null && categoryId.isNotEmpty)
          'category_id': categoryId,
        if (resultCount != null) 'result_count': resultCount,
        if (durationMs != null) 'duration_ms': durationMs,
        if (metadata != null) 'metadata': metadata,
      });
      unawaited(
        http
            .post(
              uri,
              headers: {'Content-Type': 'application/json'},
              body: body,
            )
            .timeout(const Duration(seconds: 8))
            .catchError((_) => http.Response('', 0)),
      );
    } catch (_) {
      // Never let analytics break the UI.
    }
  }

  Future<void> logSearch(String query, {int? resultCount}) {
    return logEvent(
      eventType: 'search',
      searchQuery: query,
      resultCount: resultCount,
    );
  }

  Future<void> logProductClick(
    String productId, {
    String? searchQuery,
    String? source,
  }) {
    return logEvent(
      eventType: 'product_click',
      productId: productId,
      searchQuery: searchQuery,
      metadata: source != null ? {'source': source} : null,
    );
  }

  Future<void> logProductView(
    String productId, {
    String? searchQuery,
    String? source,
  }) {
    return logEvent(
      eventType: 'product_view',
      productId: productId,
      searchQuery: searchQuery,
      metadata: source != null ? {'source': source} : null,
    );
  }

  Future<void> logProductDwell(
    String productId,
    int durationMs, {
    String? searchQuery,
    String? source,
  }) {
    return logEvent(
      eventType: 'product_dwell',
      productId: productId,
      durationMs: durationMs,
      searchQuery: searchQuery,
      metadata: source != null ? {'source': source} : null,
    );
  }
}
