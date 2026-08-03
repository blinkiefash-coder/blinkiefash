// File generated based on google-services.json and GoogleService-Info.plist
// for project: blinkiefash-18d9f

import 'package:firebase_core/firebase_core.dart' show FirebaseOptions;
import 'package:flutter/foundation.dart'
    show defaultTargetPlatform, kIsWeb, TargetPlatform;

class DefaultFirebaseOptions {
  static FirebaseOptions get currentPlatform {
    if (kIsWeb) throw UnsupportedError('Web is not supported for this app.');
    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
        return android;
      case TargetPlatform.iOS:
        return ios;
      default:
        throw UnsupportedError(
          'DefaultFirebaseOptions are not supported for this platform.',
        );
    }
  }

  static const FirebaseOptions android = FirebaseOptions(
    apiKey: 'AIzaSyBtDSqUmXgko2b9wn6aLnd6DjsLL3TiLeg',
    appId: '1:492570746016:android:ca0cf85a7edf1c99edbdc5',
    messagingSenderId: '492570746016',
    projectId: 'blinkiefash-18d9f',
    storageBucket: 'blinkiefash-18d9f.firebasestorage.app',
  );

  static const FirebaseOptions ios = FirebaseOptions(
    apiKey: 'AIzaSyC8MYijybqhqCOLtGyfIIPyCqT4CcLswb8',
    appId: '1:492570746016:ios:c76105053de4310bedbdc5',
    messagingSenderId: '492570746016',
    projectId: 'blinkiefash-18d9f',
    storageBucket: 'blinkiefash-18d9f.firebasestorage.app',
    iosBundleId: 'com.blinkiefash.blinkiefashride',
  );
}
