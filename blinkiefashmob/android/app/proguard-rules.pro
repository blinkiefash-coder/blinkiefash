## Basic ProGuard rules for Flutter app
# Keep Flutter embedding classes
-keep class io.flutter.embedding.** { *; }
-keep class io.flutter.plugin.** { *; }

# Keep Kotlin/Java entry points
-keep class com.blinkiefash.app.** { *; }

# Add rules for common libraries if needed (R8 will report missing rules during build)
