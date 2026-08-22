import 'dart:ui';
import 'package:flutter/material.dart';
import 'pages/login_screen.dart';
import 'services/user_session.dart';
import 'services/notification_service.dart';
import 'pages/home_screen.dart';
import 'pages/vendor_dashboard_screen.dart';

// ─────────────────────────────────────────────────────────────
//  BlinkieFash Splash Screen
//  • Animated neon-green ⚡ lightning bolt (pulse + glow)
//  • BLINKIEFASH brand text fade-in
// ─────────────────────────────────────────────────────────────

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen>
    with TickerProviderStateMixin {
  // ── Intro: logo / brand reveal ──────────────────────────────
  late final AnimationController _introCtrl;
  late final Animation<double> _brandFade;
  late final Animation<double> _brandScale;
  late final Animation<double> _boltIntro; // 0→1 scale in

  // ── Lightning pulse (looping) ───────────────────────────────
  late final AnimationController _pulseCtrl;
  late final Animation<double> _pulseScale;
  late final Animation<double> _glowOpacity;

  bool _isReadyToSwipe = false;
  bool _isNavigating = false;
  double _dragDistance = 0;

  static const _green = Color(0xFF22C55E);
  static const _greenBright = Color(0xFF4ADE80);

  @override
  void initState() {
    super.initState();

    // ── Intro (plays once, 2.4 s) ────────────────────────────
    _introCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2400),
    );

    _boltIntro = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(
        parent: _introCtrl,
        curve: const Interval(0.0, 0.5, curve: Curves.elasticOut),
      ),
    );

    _brandFade = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(
        parent: _introCtrl,
        curve: const Interval(0.4, 0.85, curve: Curves.easeOut),
      ),
    );

    _brandScale = Tween<double>(begin: 0.88, end: 1.0).animate(
      CurvedAnimation(
        parent: _introCtrl,
        curve: const Interval(0.4, 0.9, curve: Curves.easeOutBack),
      ),
    );

    _introCtrl.forward();

    // ── Pulse (loops, 1.4 s) ─────────────────────────────────
    _pulseCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1400),
    )..repeat(reverse: true);

    _pulseScale = Tween<double>(
      begin: 0.93,
      end: 1.07,
    ).animate(CurvedAnimation(parent: _pulseCtrl, curve: Curves.easeInOut));

    _glowOpacity = Tween<double>(
      begin: 0.35,
      end: 0.80,
    ).animate(CurvedAnimation(parent: _pulseCtrl, curve: Curves.easeInOut));

    _checkSessionAndNavigate();
  }

  Future<void> _checkSessionAndNavigate() async {
    await UserSession.instance.loadFromPrefs();
    if (UserSession.instance.isLoggedIn) {
      NotificationService.instance.registerForCurrentUser();
      if (mounted) {
        if (UserSession.instance.role == 'vendor' &&
            (UserSession.instance.vendorId ?? '').isNotEmpty) {
          Navigator.of(context).pushReplacement(
            MaterialPageRoute(
              builder: (_) => VendorDashboardScreen(
                vendorId: UserSession.instance.vendorId!,
                storeName:
                    (UserSession.instance.vendorStoreName ?? '').isNotEmpty
                    ? UserSession.instance.vendorStoreName!
                    : (UserSession.instance.name ?? 'Vendor Store'),
                email: UserSession.instance.vendorEmail ?? '',
              ),
            ),
          );
        } else {
          Navigator.of(context).pushReplacement(
            MaterialPageRoute(builder: (_) => const HomeScreen()),
          );
        }
      }
    } else {
      await Future.delayed(const Duration(seconds: 3));
      if (!mounted) return;
      setState(() => _isReadyToSwipe = true);
      await Future.delayed(const Duration(seconds: 2));
      if (mounted && !_isNavigating) _openHome();
    }
  }

  void _openHome() {
    if (_isNavigating || !_isReadyToSwipe || !mounted) return;
    _isNavigating = true;
    Navigator.of(
      context,
    ).pushReplacement(MaterialPageRoute(builder: (_) => const HomeScreen()));
  }

  void _openLogin() {
    if (_isNavigating || !_isReadyToSwipe || !mounted) return;
    _isNavigating = true;
    Navigator.of(context).pushReplacement(
      PageRouteBuilder<void>(
        transitionDuration: const Duration(milliseconds: 650),
        reverseTransitionDuration: const Duration(milliseconds: 300),
        pageBuilder: (context, animation, secondaryAnimation) =>
            const LoginScreen(),
        transitionsBuilder: (context, animation, secondaryAnimation, child) {
          final slide =
              Tween<Offset>(
                begin: const Offset(0, 1),
                end: Offset.zero,
              ).animate(
                CurvedAnimation(parent: animation, curve: Curves.easeOutCubic),
              );
          return SlideTransition(
            position: slide,
            child: FadeTransition(
              opacity: CurvedAnimation(
                parent: animation,
                curve: Curves.easeOut,
              ),
              child: child,
            ),
          );
        },
      ),
    );
  }

  @override
  void dispose() {
    _introCtrl.dispose();
    _pulseCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: GestureDetector(
        behavior: HitTestBehavior.translucent,
        onVerticalDragUpdate: (d) {
          if (!_isReadyToSwipe || _isNavigating) return;
          if (d.delta.dy < 0) _dragDistance += -d.delta.dy;
        },
        onVerticalDragEnd: (d) {
          if (!_isReadyToSwipe || _isNavigating) return;
          final vel = d.primaryVelocity ?? 0;
          if (vel < -450 || _dragDistance > 110) _openHome();
          _dragDistance = 0;
        },
        onTap: () {
          if (_isReadyToSwipe) _openHome();
        },
        child: Stack(
          fit: StackFit.expand,
          children: [
            // ── Blurred hero image background ─────────────────
            Image.asset(
              'assets/images/hero.png',
              fit: BoxFit.cover,
              alignment: Alignment.topCenter,
            ),
            // ── Frosted glass blur layer ──────────────────────
            BackdropFilter(
              filter: ImageFilter.blur(sigmaX: 22, sigmaY: 22),
              child: Container(color: Colors.black.withValues(alpha: 0.52)),
            ),
            // ── Subtle green tint overlay ─────────────────────
            Container(
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    Color(0x22052E16), // very faint green top
                    Color(0x44000000), // slightly darker bottom
                  ],
                ),
              ),
            ),

            // ── Central content ──────────────────────────────
            Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const SizedBox(height: 20),

                // ── ⚡ Lightning bolt ──────────────────────────
                AnimatedBuilder(
                  animation: Listenable.merge([_introCtrl, _pulseCtrl]),
                  builder: (context, _) {
                    final intro = _boltIntro.value;
                    final pulse = _pulseScale.value;
                    final glow = _glowOpacity.value;
                    return Transform.scale(
                      scale: intro * pulse,
                      child: Stack(
                        alignment: Alignment.center,
                        children: [
                          // Outer glow ring
                          Container(
                            width: 140,
                            height: 140,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              boxShadow: [
                                BoxShadow(
                                  color: _green.withValues(alpha: glow * 0.5),
                                  blurRadius: 55,
                                  spreadRadius: 10,
                                ),
                              ],
                            ),
                          ),
                          // Soft ring
                          Container(
                            width: 110,
                            height: 110,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              border: Border.all(
                                color: _greenBright.withValues(alpha: 0.25),
                                width: 1.5,
                              ),
                              gradient: RadialGradient(
                                colors: [
                                  _green.withValues(alpha: 0.18),
                                  _green.withValues(alpha: 0.0),
                                ],
                              ),
                            ),
                          ),
                          // The bolt itself
                          ShaderMask(
                            shaderCallback: (bounds) => const LinearGradient(
                              begin: Alignment.topCenter,
                              end: Alignment.bottomCenter,
                              colors: [
                                Color(0xFFBBF7D0),
                                Color(0xFF22C55E),
                                Color(0xFF15803D),
                              ],
                            ).createShader(bounds),
                            child: const Text(
                              '⚡',
                              style: TextStyle(
                                fontSize: 72,
                                color: Colors.white,
                              ),
                            ),
                          ),
                        ],
                      ),
                    );
                  },
                ),

                const SizedBox(height: 28),

                // ── BLINKIEFASH brand ─────────────────────────
                AnimatedBuilder(
                  animation: _introCtrl,
                  builder: (context, _) => Opacity(
                    opacity: _brandFade.value,
                    child: Transform.scale(
                      scale: _brandScale.value,
                      child: Column(
                        children: [
                          RichText(
                            text: const TextSpan(
                              style: TextStyle(
                                fontSize: 38,
                                fontWeight: FontWeight.w900,
                                letterSpacing: 2.2,
                                height: 1,
                              ),
                              children: [
                                TextSpan(
                                  text: 'BLINKIE',
                                  style: TextStyle(color: Colors.white),
                                ),
                                TextSpan(
                                  text: 'FASH',
                                  style: TextStyle(color: Color(0xFF4ADE80)),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(height: 10),
                          const Text(
                            'FASHION DELIVERED IN A BLINK',
                            style: TextStyle(
                              color: Color(0xFFA7F3D0),
                              fontSize: 11,
                              letterSpacing: 1.8,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            ),

            // ── Bottom: loading / swipe hint ──────────────────
            Positioned(
              bottom: 90,
              left: 0,
              right: 0,
              child: AnimatedSwitcher(
                duration: const Duration(milliseconds: 320),
                child: _isReadyToSwipe
                    ? Column(
                        key: const ValueKey('swipe'),
                        children: [
                          const Icon(
                            Icons.keyboard_double_arrow_up_rounded,
                            color: _green,
                            size: 26,
                          ),
                          const SizedBox(height: 5),
                          const Text(
                            'Swipe up to explore',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              color: Color(0xFFBBF7D0),
                              fontSize: 12,
                              letterSpacing: 1.0,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                          const SizedBox(height: 12),
                          TextButton(
                            onPressed: _openLogin,
                            child: const Text(
                              'Sign in instead',
                              style: TextStyle(
                                color: Colors.white,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                        ],
                      )
                    : Column(
                        key: const ValueKey('loading'),
                        children: [
                          SizedBox(
                            width: 140,
                            child: TweenAnimationBuilder<double>(
                              tween: Tween<double>(begin: 0.1, end: 1.0),
                              duration: const Duration(milliseconds: 2800),
                              curve: Curves.easeOutCubic,
                              builder: (context, v, _) =>
                                  LinearProgressIndicator(
                                    value: v,
                                    minHeight: 2.5,
                                    borderRadius: BorderRadius.circular(999),
                                    backgroundColor: const Color(0x2234D399),
                                    valueColor:
                                        const AlwaysStoppedAnimation<Color>(
                                          Color(0xFF22C55E),
                                        ),
                                  ),
                            ),
                          ),
                          const SizedBox(height: 8),
                          const Text(
                            'Revving up your fashion...',
                            style: TextStyle(
                              color: Color(0xFF6B8F72),
                              fontSize: 11,
                              letterSpacing: 0.8,
                            ),
                          ),
                        ],
                      ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
