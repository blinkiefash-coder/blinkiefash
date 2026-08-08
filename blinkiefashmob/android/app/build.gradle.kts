import java.util.Properties

plugins {
    id("com.android.application")
    id("dev.flutter.flutter-gradle-plugin")
    id("com.google.gms.google-services")
}

val keyPropertiesFile = rootProject.file("key.properties")
val keyProperties = Properties()
if (keyPropertiesFile.exists()) {
    keyPropertiesFile.inputStream().use { keyProperties.load(it) }
}

val hasReleaseSigningConfig =
    keyPropertiesFile.exists() &&
    !keyProperties.getProperty("storeFile").isNullOrBlank() &&
    !keyProperties.getProperty("storePassword").isNullOrBlank() &&
    !keyProperties.getProperty("keyAlias").isNullOrBlank() &&
    !keyProperties.getProperty("keyPassword").isNullOrBlank()

android {
    namespace = "com.blinkiefash.app"
    // Explicit (not flutter.compileSdkVersion) - some transitive androidx deps
    // require compileSdk 34+, which AGP 8.13's stricter AAR checks now enforce.
    compileSdk = 36
    buildToolsVersion = "36.0.0"
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
        isCoreLibraryDesugaringEnabled = true
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    defaultConfig {
        applicationId = "com.blinkiefash.app"
        minSdk = 24
        targetSdk = flutter.targetSdkVersion
        versionCode = 11470
        versionName = "2.0.3"
    }

    signingConfigs {
        if (hasReleaseSigningConfig) {
            create("release") {
                keyAlias = keyProperties.getProperty("keyAlias")
                keyPassword = keyProperties.getProperty("keyPassword")
                storeFile = rootProject.file(keyProperties.getProperty("storeFile"))
                storePassword = keyProperties.getProperty("storePassword")
            }
        }
    }

    buildTypes {
        named("debug") {
            // No applicationIdSuffix so Firebase google-services.json matches com.blinkiefash.app
        }

        named("release") {
            signingConfig = if (hasReleaseSigningConfig) {
                signingConfigs.getByName("release")
            } else {
                println("[blinkiefash] key.properties missing/incomplete; using debug signing for release bundle.")
                signingConfigs.getByName("debug")
            }
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    lint {
        disable.addAll(listOf(
            "MissingDimensionAndroidApi",
            "GradleCompatible"
        ))
    }
}

flutter {
    source = "../.."
}

dependencies {
    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.1.4")
    implementation("com.google.code.gson:gson:2.10.1")
    implementation("androidx.media:media:1.0.1")
}

// firebase_app_check only ever activates AndroidProvider.playIntegrity in this app
// (see lib/services/firebase_app_check_config.dart) - the SafetyNet provider library
// is pulled in transitively but never used, and Play Console flags it since Google
// deprecated the SafetyNet Attestation API.
configurations.all {
    exclude(group = "com.google.android.gms", module = "play-services-safetynet")
    exclude(group = "com.google.firebase", module = "firebase-appcheck-safetynet")
}

// Suppress deprecation and unchecked warnings from third-party plugins
tasks.withType<JavaCompile>().configureEach {
    options.isWarnings = false
    options.compilerArgs.addAll(listOf(
        "-nowarn",
        "-Xlint:none",
        "-Xlint:-deprecation",
        "-Xlint:-unchecked"
    ))
}
