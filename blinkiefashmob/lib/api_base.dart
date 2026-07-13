import 'package:flutter/foundation.dart';

String _resolveApiOrigin() {
  if (kIsWeb) {
    return 'http://localhost:5000';
  }

  switch (defaultTargetPlatform) {
    case TargetPlatform.android:
      return 'http://10.0.2.2:5000';
    default:
      return 'http://localhost:5000';
  }
}

final String apiBaseUrl = _resolveApiOrigin();
final String apiApiBaseUrl = '$apiBaseUrl/api';
