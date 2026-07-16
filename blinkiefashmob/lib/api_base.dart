const _envApiBase = String.fromEnvironment('API_BASE_URL');

const _fallbackApiBase = 'https://blinkiefash.onrender.com';

String _trimTrailingSlash(String value) {
  if (value.endsWith('/')) {
    return value.substring(0, value.length - 1);
  }
  return value;
}

final String apiBaseUrl = _trimTrailingSlash(
  _envApiBase.trim().isEmpty ? _fallbackApiBase : _envApiBase.trim(),
);

final String apiApiBaseUrl = '$apiBaseUrl/api';
