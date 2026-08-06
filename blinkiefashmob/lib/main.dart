import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:http/http.dart' as http;
import 'splash_screen.dart';
import 'pages/login_screen.dart';
import 'pages/signup_screen.dart';
import 'pages/home_screen.dart';
import 'pages/product_detail_screen.dart';
import 'services/notification_service.dart';
import 'services/firebase_app_check_config.dart';
import 'firebase_options.dart';
import 'api_base.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Keep typography stable across devices even when system font settings change.
  // Allow runtime font fetching so GoogleFonts.orbitron and similar
  // specialty fonts can load on first launch.
  GoogleFonts.config.allowRuntimeFetching = true;

  // Lock to portrait for all Android/iOS devices
  await SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
    DeviceOrientation.portraitDown,
  ]);

  // ── Pre-warm backend FIRST (fire-and-forget) so it wakes up while
  //    Firebase initializes and the splash animation plays.
  //    On Render free tier this prevents the 30-90 s cold-start delay.
  _prewarmBackend();

  try {
    await Firebase.initializeApp(
      options: DefaultFirebaseOptions.currentPlatform,
    );
    await FirebaseAppCheckConfig.initialize();
    await NotificationService.instance.init();
  } catch (e) {
    debugPrint('Firebase init failed: $e');
  }
  runApp(const BlinkieFashApp());
}

/// Fire a lightweight GET /health to wake the Render backend.
/// This is intentionally unawaited — we just want to start the wake-up
/// as early as possible, not block app startup.
void _prewarmBackend() {
  http
      .get(Uri.parse('$apiBaseUrl/health'))
      .timeout(const Duration(seconds: 90))
      .catchError((_) => http.Response('', 0));
}

class BlinkieFashApp extends StatefulWidget {
  const BlinkieFashApp({super.key});

  // Keep light mode by default because most screens are designed for light UI.
  static final themeModeNotifier = ValueNotifier<ThemeMode>(ThemeMode.light);

  @override
  State<BlinkieFashApp> createState() => _BlinkieFashAppState();
}

class _BlinkieFashAppState extends State<BlinkieFashApp> {
  @override
  void initState() {
    super.initState();
    BlinkieFashApp.themeModeNotifier.addListener(_onThemeChanged);
  }

  @override
  void dispose() {
    BlinkieFashApp.themeModeNotifier.removeListener(_onThemeChanged);
    super.dispose();
  }

  void _onThemeChanged() => setState(() {});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'BlinkieFash',
      themeMode: BlinkieFashApp.themeModeNotifier.value,
      builder: (context, child) {
        final media = MediaQuery.of(context);
        return MediaQuery(
          data: media.copyWith(
            textScaler: const TextScaler.linear(1.0),
            boldText: false,
          ),
          child: SafeArea(
            top: false,
            left: false,
            right: false,
            bottom: true,
            child: child ?? const SizedBox.shrink(),
          ),
        );
      },
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF16A34A)),
        scaffoldBackgroundColor: const Color(0xFFF9FAFB),
        fontFamily: GoogleFonts.inter().fontFamily,
        textTheme: GoogleFonts.interTextTheme().apply(
          bodyColor: const Color(0xFF0F172A),
          displayColor: const Color(0xFF0F172A),
        ),
        primaryTextTheme: GoogleFonts.interTextTheme().apply(
          bodyColor: const Color(0xFF0F172A),
          displayColor: const Color(0xFF0F172A),
        ),
        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: Colors.white,
          hintStyle: const TextStyle(color: Color(0xFF64748B)),
          labelStyle: const TextStyle(color: Color(0xFF334155)),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: const BorderSide(color: Color(0xFFCBD5E1)),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: const BorderSide(color: Color(0xFF16A34A), width: 1.4),
          ),
        ),
        useMaterial3: true,
      ),
      darkTheme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF16A34A),
          brightness: Brightness.dark,
        ),
        scaffoldBackgroundColor: const Color(0xFF0F172A),
        fontFamily: GoogleFonts.inter().fontFamily,
        textTheme: GoogleFonts.interTextTheme(
          ThemeData(brightness: Brightness.dark).textTheme,
        ),
        primaryTextTheme: GoogleFonts.interTextTheme(
          ThemeData(brightness: Brightness.dark).textTheme,
        ),
        useMaterial3: true,
      ),
      home: const SplashScreen(),
      onGenerateRoute: (settings) {
        // Handle deep links: https://blinkiefash.in/product/{id}
        //                    blinkiefash://product/{id}
        final name = settings.name ?? '';
        final uri = Uri.tryParse(name);
        if (uri != null) {
          final segs = uri.pathSegments;
          // https://blinkiefash.in/product/{id}
          if (segs.length >= 2 && segs[0] == 'product') {
            return MaterialPageRoute(
              builder: (_) => ProductDetailScreen(productId: segs[1]),
            );
          }
          // blinkiefash://product/{id}  →  host=product, path=/{id}
          if (uri.scheme == 'blinkiefash' &&
              uri.host == 'product' &&
              segs.isNotEmpty) {
            return MaterialPageRoute(
              builder: (_) => ProductDetailScreen(productId: segs[0]),
            );
          }
        }
        return null;
      },
      routes: {
        '/login': (context) => const LoginScreen(),
        '/signup': (context) => const SignupScreen(),
        '/home': (context) => const HomeScreen(),
      },
    );
  }
}
