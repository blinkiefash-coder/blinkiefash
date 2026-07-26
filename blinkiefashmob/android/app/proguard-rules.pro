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
