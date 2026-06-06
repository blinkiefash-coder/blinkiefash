import 'package:flutter/material.dart';
import 'pages/login_screen.dart';
import 'services/user_session.dart';
import 'services/notification_service.dart';
import 'pages/home_screen.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<double> _fadeAnimation;
  late final Animation<double> _logoScaleAnimation;
  late final Animation<Offset> _titleSlideAnimation;
  bool _isReadyToSwipe = false;
  bool _isNavigating = false;
  double _dragDistance = 0;

  @override
  @override
  void initState() {
    super.initState();

    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1700),
    );

    _fadeAnimation = CurvedAnimation(
      parent: _controller,
      curve: const Interval(0.0, 0.75, curve: Curves.easeOut),
    );

    _logoScaleAnimation = Tween<double>(begin: 0.84, end: 1.0).animate(
      CurvedAnimation(
        parent: _controller,
        curve: const Interval(0.05, 0.7, curve: Curves.easeOutBack),
      ),
    );

    _titleSlideAnimation =
        Tween<Offset>(begin: const Offset(0, 0.32), end: Offset.zero).animate(
          CurvedAnimation(
            parent: _controller,
            curve: const Interval(0.2, 1.0, curve: Curves.easeOutCubic),
          ),
        );

    _controller.forward();

    _checkSessionAndNavigate();
  }

  Future<void> _checkSessionAndNavigate() async {
    await UserSession.instance.loadFromPrefs();
    if (UserSession.instance.isLoggedIn) {
      // Refresh FCM token for the already-logged-in user.
      NotificationService.instance.registerForCurrentUser();
      // Go directly to HomeScreen
      if (mounted) {
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(builder: (_) => const HomeScreen()),
        );
      }
    } else {
      // Show splash, then allow swipe to login
      await Future.delayed(const Duration(seconds: 3));
      if (mounted) {
        setState(() {
          _isReadyToSwipe = true;
        });
      }
    }
  }

  void _openLogin() {
    if (_isNavigating || !_isReadyToSwipe || !mounted) {
      return;
    }

    _isNavigating = true;

    Navigator.of(context).pushReplacement(
      PageRouteBuilder<void>(
        transitionDuration: const Duration(milliseconds: 650),
        reverseTransitionDuration: const Duration(milliseconds: 300),
        pageBuilder: (context, animation, secondaryAnimation) =>
            const LoginScreen(),
        transitionsBuilder: (context, animation, secondaryAnimation, child) {
          final slideAnimation =
              Tween<Offset>(
                begin: const Offset(0, 1),
                end: Offset.zero,
              ).animate(
                CurvedAnimation(parent: animation, curve: Curves.easeOutCubic),
              );

          final fadeAnimation = CurvedAnimation(
            parent: animation,
            curve: Curves.easeOut,
          );

          return SlideTransition(
            position: slideAnimation,
            child: FadeTransition(opacity: fadeAnimation, child: child),
          );
        },
      ),
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: GestureDetector(
        behavior: HitTestBehavior.translucent,
        onVerticalDragUpdate: (details) {
          if (!_isReadyToSwipe || _isNavigating) {
            return;
          }

          if (details.delta.dy < 0) {
            _dragDistance += -details.delta.dy;
          }
        },
        onVerticalDragEnd: (details) {
          if (!_isReadyToSwipe || _isNavigating) {
            return;
          }

          final hasVelocitySwipe =
              details.primaryVelocity != null &&
              details.primaryVelocity! < -450;
          final hasDistanceSwipe = _dragDistance > 110;
          _dragDistance = 0;

          if (hasVelocitySwipe || hasDistanceSwipe) {
            _openLogin();
          }
        },
        child: Stack(
          fit: StackFit.expand,
          children: [
            Container(
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    Color(0x8A040404),
                    Color(0xCC070707),
                    Color(0xE6040404),
                  ],
                ),
              ),
            ),
            Positioned.fill(
              child: IgnorePointer(
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: RadialGradient(
                      center: Alignment.topCenter,
                      radius: 1.2,
                      colors: [
                        const Color(0x00FFFFFF),
                        const Color(0x00000000),
                        const Color(0x96020202),
                      ],
                      stops: const [0.0, 0.58, 1.0],
                    ),
                  ),
                ),
              ),
            ),
            const _GlowBubble(
              size: 240,
              top: -86,
              left: -58,
              color: Color(0xFF22C55E),
              opacity: 0.1,
            ),
            const _GlowBubble(
              size: 180,
              bottom: -70,
              right: -30,
              color: Color(0xFF16A34A),
              opacity: 0.08,
            ),
            SafeArea(
              child: FadeTransition(
                opacity: _fadeAnimation,
                child: Center(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 28),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Text(
                          'EST. 2025',
                          style: TextStyle(
                            color: Color(0xFF86EFAC),
                            fontSize: 10,
                            letterSpacing: 4.6,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        const SizedBox(height: 20),
                        ScaleTransition(
                          scale: _logoScaleAnimation,
                          child: Container(
                            width: 162,
                            height: 162,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              border: Border.all(
                                color: const Color(0x6634D399),
                                width: 1.2,
                              ),
                              gradient: const RadialGradient(
                                colors: [Color(0x4034D399), Color(0x00FFFFFF)],
                              ),
                              boxShadow: const [
                                BoxShadow(
                                  color: Color(0x3322C55E),
                                  blurRadius: 36,
                                  spreadRadius: 1,
                                ),
                              ],
                            ),
                            child: Padding(
                              padding: const EdgeInsets.all(22),
                              child: Image.asset('assets/images/logo.png'),
                            ),
                          ),
                        ),
                        const SizedBox(height: 34),
                        SlideTransition(
                          position: _titleSlideAnimation,
                          child: RichText(
                            text: const TextSpan(
                              style: TextStyle(
                                fontSize: 41,
                                fontWeight: FontWeight.w700,
                                letterSpacing: 2.6,
                                height: 1,
                              ),
                              children: [
                                TextSpan(
                                  text: 'BLINKIE',
                                  style: TextStyle(color: Color(0xFFF7F2E8)),
                                ),
                                TextSpan(
                                  text: 'FASH',
                                  style: TextStyle(color: Color(0xFF22C55E)),
                                ),
                              ],
                            ),
                          ),
                        ),
                        const SizedBox(height: 14),
                        SlideTransition(
                          position: _titleSlideAnimation,
                          child: const Text(
                            'FASHION DELIVERED IN A BLINK⚡️',
                            style: TextStyle(
                              color: Color(0xFFA7F3D0),
                              fontSize: 12.5,
                              letterSpacing: 1.4,
                              fontWeight: FontWeight.w400,
                            ),
                          ),
                        ),
                        const SizedBox(height: 24),
                        const SizedBox(
                          width: 180,
                          child: Divider(
                            thickness: 0.7,
                            color: Color(0x4634D399),
                            height: 1,
                          ),
                        ),
                        const SizedBox(height: 30),
                        AnimatedSwitcher(
                          duration: const Duration(milliseconds: 320),
                          switchInCurve: Curves.easeOut,
                          switchOutCurve: Curves.easeIn,
                          child: _isReadyToSwipe
                              ? Column(
                                  key: const ValueKey('swipe'),
                                  children: const [
                                    Icon(
                                      Icons.keyboard_double_arrow_up_rounded,
                                      color: Color(0xFF22C55E),
                                      size: 26,
                                    ),
                                    SizedBox(height: 6),
                                    Text(
                                      'Swipe up to continue',
                                      style: TextStyle(
                                        color: Color(0xFFBBF7D0),
                                        fontSize: 12,
                                        letterSpacing: 1.0,
                                        fontWeight: FontWeight.w500,
                                      ),
                                    ),
                                  ],
                                )
                              : Column(
                                  key: const ValueKey('loading'),
                                  children: [
                                    SizedBox(
                                      width: 136,
                                      child: TweenAnimationBuilder<double>(
                                        tween: Tween<double>(
                                          begin: 0.15,
                                          end: 1.0,
                                        ),
                                        duration: const Duration(
                                          milliseconds: 1600,
                                        ),
                                        curve: Curves.easeOutCubic,
                                        builder: (context, value, child) {
                                          return LinearProgressIndicator(
                                            value: value,
                                            minHeight: 2.5,
                                            borderRadius: BorderRadius.circular(
                                              999,
                                            ),
                                            backgroundColor: const Color(
                                              0x2A3F3120,
                                            ),
                                            valueColor:
                                                const AlwaysStoppedAnimation<
                                                  Color
                                                >(Color(0xFF22C55E)),
                                          );
                                        },
                                      ),
                                    ),
                                    const SizedBox(height: 10),
                                    const Text(
                                      'Preparing your runway...',
                                      style: TextStyle(
                                        color: Color(0xFF86A592),
                                        fontSize: 11.5,
                                        letterSpacing: 1.0,
                                      ),
                                    ),
                                  ],
                                ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _GlowBubble extends StatelessWidget {
  final double size;
  final double? top;
  final double? left;
  final double? right;
  final double? bottom;
  final Color color;
  final double opacity;

  const _GlowBubble({
    required this.size,
    required this.color,
    required this.opacity,
    this.top,
    this.left,
    this.right,
    this.bottom,
  });

  @override
  Widget build(BuildContext context) {
    return Positioned(
      top: top,
      left: left,
      right: right,
      bottom: bottom,
      child: IgnorePointer(
        child: Container(
          width: size,
          height: size,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            gradient: RadialGradient(
              colors: [
                color.withValues(alpha: opacity),
                color.withValues(alpha: 0.0),
              ],
              stops: const [0.15, 1.0],
            ),
          ),
        ),
      ),
    );
  }
}
