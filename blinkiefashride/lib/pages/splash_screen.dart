import 'package:flutter/material.dart';

import 'login_screen.dart';
import '../api_service.dart';
import 'main_shell.dart';
import 'package:shared_preferences/shared_preferences.dart';

class RiderSplashScreen extends StatefulWidget {
  const RiderSplashScreen({super.key});

  @override
  State<RiderSplashScreen> createState() => _RiderSplashScreenState();
}

class _RiderSplashScreenState extends State<RiderSplashScreen>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<double> _fade;
  late final Animation<double> _logoScale;
  late final Animation<Offset> _titleSlide;

  @override
  void initState() {
    super.initState();

    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1800),
    );

    _fade = CurvedAnimation(
      parent: _controller,
      curve: const Interval(0.0, 0.7, curve: Curves.easeOut),
    );

    _logoScale = Tween<double>(begin: 0.75, end: 1.0).animate(
      CurvedAnimation(
        parent: _controller,
        curve: const Interval(0.05, 0.7, curve: Curves.easeOutBack),
      ),
    );

    _titleSlide = Tween<Offset>(begin: const Offset(0, 0.35), end: Offset.zero)
        .animate(
          CurvedAnimation(
            parent: _controller,
            curve: const Interval(0.25, 1.0, curve: Curves.easeOutCubic),
          ),
        );

    _controller.forward();

    _checkSessionAndNavigate();
  }

  Future<void> _checkSessionAndNavigate() async {
    await ApiService().loadToken();
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('jwt_token');
    if (token != null && token.isNotEmpty) {
      if (!mounted) return;
      Navigator.of(context).pushReplacement(
        PageRouteBuilder<void>(
          transitionDuration: const Duration(milliseconds: 600),
          pageBuilder: (_, _, _) => const MainShell(),
          transitionsBuilder: (_, animation, _, child) => FadeTransition(
            opacity: CurvedAnimation(parent: animation, curve: Curves.easeOut),
            child: child,
          ),
        ),
      );
    } else {
      await Future.delayed(const Duration(seconds: 3));
      if (!mounted) return;
      Navigator.of(context).pushReplacement(
        PageRouteBuilder<void>(
          transitionDuration: const Duration(milliseconds: 600),
          pageBuilder: (_, _, _) => const LoginScreen(),
          transitionsBuilder: (_, animation, _, child) => FadeTransition(
            opacity: CurvedAnimation(parent: animation, curve: Curves.easeOut),
            child: child,
          ),
        ),
      );
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0A1A10),
      body: Stack(
        fit: StackFit.expand,
        children: [
          // Background gradient
          Container(
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  Color(0xFF0A1A10),
                  Color(0xFF0F2318),
                  Color(0xFF081510),
                ],
              ),
            ),
          ),
          // Glow top-left
          Positioned(
            top: -100,
            left: -80,
            child: Container(
              width: 280,
              height: 280,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: const Color(0xFF16A34A).withValues(alpha: 0.12),
              ),
            ),
          ),
          // Glow bottom-right
          Positioned(
            bottom: -80,
            right: -60,
            child: Container(
              width: 220,
              height: 220,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: const Color(0xFF22C55E).withValues(alpha: 0.08),
              ),
            ),
          ),
          // Content
          SafeArea(
            child: FadeTransition(
              opacity: _fade,
              child: Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Text(
                      'DELIVERY PARTNER',
                      style: TextStyle(
                        color: Color(0xFF86EFAC),
                        fontSize: 10,
                        letterSpacing: 4.5,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 28),
                    // Logo circle
                    ScaleTransition(
                      scale: _logoScale,
                      child: Container(
                        width: 150,
                        height: 150,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          border: Border.all(
                            color: const Color(0x5534D399),
                            width: 1.5,
                          ),
                          gradient: const RadialGradient(
                            colors: [Color(0x4034D399), Color(0x00FFFFFF)],
                          ),
                          boxShadow: const [
                            BoxShadow(
                              color: Color(0x4016A34A),
                              blurRadius: 40,
                              spreadRadius: 2,
                            ),
                          ],
                        ),
                        child: Padding(
                          padding: const EdgeInsets.all(20),
                          child: Image.asset(
                            'asset/logo.jpeg',
                            fit: BoxFit.contain,
                            errorBuilder: (_, __, ___) => const Icon(
                              Icons.electric_moped,
                              size: 74,
                              color: Color(0xFF22C55E),
                            ),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 32),
                    // BLINKIEFASH wordmark
                    SlideTransition(
                      position: _titleSlide,
                      child: RichText(
                        text: const TextSpan(
                          style: TextStyle(
                            fontSize: 38,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 2.4,
                            height: 1,
                          ),
                          children: [
                            TextSpan(
                              text: 'BLINKIE',
                              style: TextStyle(color: Color(0xFFF0FDF4)),
                            ),
                            TextSpan(
                              text: 'FASH',
                              style: TextStyle(color: Color(0xFF22C55E)),
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 10),
                    SlideTransition(
                      position: _titleSlide,
                      child: const Text(
                        'RIDER',
                        style: TextStyle(
                          color: Color(0xFF4ADE80),
                          fontSize: 13,
                          letterSpacing: 6,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),
                    SlideTransition(
                      position: _titleSlide,
                      child: const Text(
                        'Deliver fashion in a blink ⚡',
                        style: TextStyle(
                          color: Color(0xFF86EFAC),
                          fontSize: 12,
                          letterSpacing: 0.8,
                          fontWeight: FontWeight.w400,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          // Loading dots at the bottom
          Positioned(
            bottom: 52,
            left: 0,
            right: 0,
            child: FadeTransition(opacity: _fade, child: const _PulsingDots()),
          ),
        ],
      ),
    );
  }
}

class _PulsingDots extends StatefulWidget {
  const _PulsingDots();

  @override
  State<_PulsingDots> createState() => _PulsingDotsState();
}

class _PulsingDotsState extends State<_PulsingDots>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    )..repeat();
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: List.generate(3, (i) {
        final delay = i * 0.25;
        return AnimatedBuilder(
          animation: _ctrl,
          builder: (_, _) {
            final t = ((_ctrl.value - delay) % 1.0).clamp(0.0, 1.0);
            final opacity =
                (0.25 + 0.75 * (1 - (t - 0.5).abs() * 2).clamp(0.0, 1.0));
            return Container(
              margin: const EdgeInsets.symmetric(horizontal: 4),
              width: 6,
              height: 6,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: Color.fromRGBO(74, 222, 128, opacity),
              ),
            );
          },
        );
      }),
    );
  }
}
