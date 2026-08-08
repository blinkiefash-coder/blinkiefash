## Basic ProGuard rules for Flutter app
# Keep Flutter embedding classes
-keep class io.flutter.embedding.** { *; }
-keep class io.flutter.plugin.** { *; }

# Keep Kotlin/Java entry points
-keep class com.blinkiefash.app.** { *; }

# Suppress R8 warnings for optional Play Core classes used by Flutter engine's
# deferred component manager — these are not needed unless deferred components
# are used in this app.
-dontwarn com.google.android.play.core.tasks.OnFailureListener
-dontwarn com.google.android.play.core.tasks.OnSuccessListener
-dontwarn com.google.android.play.core.tasks.Task
-dontwarn com.google.android.play.core.**
-dontwarn io.flutter.embedding.engine.deferredcomponents.**

# firebase_app_check's plugin code references the SafetyNet provider class, but this
# app only ever activates AndroidProvider.playIntegrity/debug (see
# lib/services/firebase_app_check_config.dart), and play-services-safetynet is
# intentionally excluded in build.gradle.kts to clear Play Console's SafetyNet SDK
# warning — that code path is dead, so just suppress the missing-class warning.
-dontwarn com.google.firebase.appcheck.safetynet.SafetyNetAppCheckProviderFactory
-dontwarn com.google.android.gms.safetynet.**
