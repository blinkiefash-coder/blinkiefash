import 'package:firebase_app_check/firebase_app_check.dart';
import 'package:flutter/foundation.dart';

class FirebaseAppCheckConfig {
  static AndroidProvider androidProviderFor(bool debugMode) {
    return debugMode ? AndroidProvider.debug : AndroidProvider.playIntegrity;
  }

  static Future<void> initialize({bool? debugMode}) async {
    await FirebaseAppCheck.instance.activate(
      androidProvider: androidProviderFor(debugMode ?? kDebugMode),
      appleProvider: (debugMode ?? kDebugMode)
          ? AppleProvider.debug
          : AppleProvider.appAttest,
    );
  }
}
