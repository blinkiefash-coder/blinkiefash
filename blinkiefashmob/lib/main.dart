import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:http/http.dart' as http;

import 'firebase_options.dart';
import 'services/firebase_app_check_config.dart';
import 'services/notification_service.dart';
import 'services/backend_keep_alive_service.dart';
import 'pages/login_screen.dart';
import 'pages/signup_screen.dart';
import 'pages/home_screen.dart';
import 'pages/product_detail_screen.dart';
import 'splash_screen.dart';
import 'api_base.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  GoogleFonts.config.allowRuntimeFetching = true;
  await SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
    DeviceOrientation.portraitDown,
  ]);
  _prewarmBackend();
  runApp(const BlinkieFashApp());
  unawaited(_initializeServices());
}

Future<void> _initializeServices() async {
  try {
    await Firebase.initializeApp(
      options: DefaultFirebaseOptions.currentPlatform,
    );
    await FirebaseAppCheckConfig.initialize();
    await NotificationService.instance.init();
  } catch (e) {
    debugPrint('Firebase init failed: $e');
  }
}

void _prewarmBackend() {
  http
      .get(Uri.parse('$apiBaseUrl/health'))
      .timeout(const Duration(seconds: 90))
      .catchError((_) => http.Response('', 0));
}

class BlinkieFashApp extends StatefulWidget {
  const BlinkieFashApp({super.key});

  static final themeModeNotifier = ValueNotifier<ThemeMode>(ThemeMode.light);

  @override
  State<BlinkieFashApp> createState() => _BlinkieFashAppState();
}

class _BlinkieFashAppState extends State<BlinkieFashApp>
    with WidgetsBindingObserver {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    BlinkieFashApp.themeModeNotifier.addListener(_onThemeChanged);
    BackendKeepAliveService.instance.start();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    BackendKeepAliveService.instance.stop();
    BlinkieFashApp.themeModeNotifier.removeListener(_onThemeChanged);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      BackendKeepAliveService.instance.start();
      BackendKeepAliveService.instance.pingNow(reason: 'resume');
    } else if (state == AppLifecycleState.paused ||
        state == AppLifecycleState.hidden ||
        state == AppLifecycleState.inactive) {
      BackendKeepAliveService.instance.pingNow(reason: 'background');
    } else if (state == AppLifecycleState.detached) {
      BackendKeepAliveService.instance.stop();
    }
  }

  void _onThemeChanged() => setState(() {});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'BlinkieFash',
      themeMode: BlinkieFashApp.themeModeNotifier.value,
      builder: (context, child) => MediaQuery(
        data: MediaQuery.of(
          context,
        ).copyWith(textScaler: const TextScaler.linear(1.0), boldText: false),
        child: child ?? const SizedBox.shrink(),
      ),
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF16A34A)),
        scaffoldBackgroundColor: const Color(0xFFF9FAFB),
        fontFamily: GoogleFonts.inter().fontFamily,
        textTheme: GoogleFonts.interTextTheme().apply(
          bodyColor: const Color(0xFF0F172A),
          displayColor: const Color(0xFF0F172A),
        ),
        useMaterial3: true,
      ),
      darkTheme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF16A34A),
          brightness: Brightness.dark,
        ),
        scaffoldBackgroundColor: const Color(0xFF0F172A),
        useMaterial3: true,
      ),
      home: const SplashScreen(),
      routes: {
        '/login': (context) => const LoginScreen(),
        '/signup': (context) => const SignupScreen(),
        '/home': (context) => const HomeScreen(),
      },
      onGenerateRoute: (settings) {
        final uri = Uri.tryParse(settings.name ?? '');
        if (uri == null) return null;
        final segments = uri.pathSegments;
        if (segments.length >= 2 && segments.first == 'product') {
          return MaterialPageRoute(
            builder: (_) => ProductDetailScreen(productId: segments[1]),
          );
        }
        if (uri.scheme == 'blinkiefash' &&
            uri.host == 'product' &&
            segments.isNotEmpty) {
          return MaterialPageRoute(
            builder: (_) => ProductDetailScreen(productId: segments.first),
          );
        }
        return null;
      },
    );
  }
}
