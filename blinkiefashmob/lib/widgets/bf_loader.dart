import 'dart:math' as math;

import 'package:flutter/material.dart';

// ─────────────────────────────────────────────────────────────
//  BlinkieFash Custom Loaders
//
//  BfSpinner   – small inline spinner (replaces CircularProgressIndicator)
//  BfPageLoader – frosted-glass full-screen loader with ⚡ spark animation
// ─────────────────────────────────────────────────────────────

const _green = Color(0xFF22C55E);
const _greenBright = Color(0xFF4ADE80);

// ─────────────────────────────────────────────────────────────
//  BfSpinner
//  • A rotating arc with a ⚡ bolt center
//  • Sizes: small (20), medium (28, default), large (44)
// ─────────────────────────────────────────────────────────────
class BfSpinner extends StatefulWidget {
  final double size;
  final Color color;
  const BfSpinner({super.key, this.size = 28, this.color = _green});

  @override
  State<BfSpinner> createState() => _BfSpinnerState();
}

class _BfSpinnerState extends State<BfSpinner>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;
  late final Animation<double> _arc; // 0→2π (arc rotation)
  late final Animation<double> _pulse; // bolt scale/opacity

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    )..repeat();

    _arc = Tween<double>(begin: 0, end: 2 * math.pi).animate(_ctrl);

    _pulse = TweenSequence<double>([
      TweenSequenceItem(tween: Tween(begin: 0.5, end: 1.0), weight: 50),
      TweenSequenceItem(tween: Tween(begin: 1.0, end: 0.5), weight: 50),
    ]).animate(CurvedAnimation(parent: _ctrl, curve: Curves.easeInOut));
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final s = widget.size;
    return AnimatedBuilder(
      animation: _ctrl,
      builder: (context, _) => SizedBox(
        width: s,
        height: s,
        child: Stack(
          alignment: Alignment.center,
          children: [
            // Rotating arc
            CustomPaint(
              size: Size(s, s),
              painter: _ArcPainter(angle: _arc.value, color: widget.color),
            ),
            // Pulsing ⚡ in center
            Opacity(
              opacity: _pulse.value,
              child: Text('⚡', style: TextStyle(fontSize: s * 0.36, height: 1)),
            ),
          ],
        ),
      ),
    );
  }
}

class _ArcPainter extends CustomPainter {
  final double angle;
  final Color color;
  _ArcPainter({required this.angle, required this.color});

  @override
  void paint(Canvas canvas, Size size) {
    final cx = size.width / 2;
    final cy = size.height / 2;
    final r = (size.width / 2) - 3;

    // Faint track
    final trackPaint = Paint()
      ..color = color.withValues(alpha: 0.15)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.5
      ..strokeCap = StrokeCap.round;
    canvas.drawCircle(Offset(cx, cy), r, trackPaint);

    // Bright arc (270° sweep)
    final arcPaint = Paint()
      ..shader = SweepGradient(
        colors: [color.withValues(alpha: 0.0), color, _greenBright],
        transform: GradientRotation(angle),
      ).createShader(Rect.fromCircle(center: Offset(cx, cy), radius: r))
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.8
      ..strokeCap = StrokeCap.round;

    canvas.drawArc(
      Rect.fromCircle(center: Offset(cx, cy), radius: r),
      angle,
      math.pi * 1.5, // 270°
      false,
      arcPaint,
    );

    // Glow dot at arc head
    final dotPaint = Paint()
      ..color = _greenBright
      ..style = PaintingStyle.fill
      ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 3);
    canvas.drawCircle(
      Offset(
        cx + r * math.cos(angle + math.pi * 1.5),
        cy + r * math.sin(angle + math.pi * 1.5),
      ),
      2.5,
      dotPaint,
    );
  }

  @override
  bool shouldRepaint(_ArcPainter old) =>
      old.angle != angle || old.color != color;
}

// ─────────────────────────────────────────────────────────────
//  BfPageLoader
//  Full-screen illustrated scene: cyclist + trees + road + sky
// ─────────────────────────────────────────────────────────────
class BfPageLoader extends StatefulWidget {
  final String message;
  const BfPageLoader({super.key, this.message = 'Loading...'});

  @override
  State<BfPageLoader> createState() => _BfPageLoaderState();
}

class _BfPageLoaderState extends State<BfPageLoader>
    with TickerProviderStateMixin {
  late final AnimationController _riderCtrl; // cyclist movement
  late final AnimationController _boltCtrl; // ⚡ pulse
  late final AnimationController _dotsCtrl; // loading dots
  late final Animation<double> _wheelAngle; // wheel/pedal rotation
  late final Animation<double> _boltScale; // bolt breathe

  @override
  void initState() {
    super.initState();

    _riderCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2600),
    )..repeat();

    _wheelAngle = Tween<double>(
      begin: 0,
      end: 2 * math.pi,
    ).animate(CurvedAnimation(parent: _riderCtrl, curve: Curves.linear));

    _boltCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    )..repeat(reverse: true);

    _boltScale = Tween<double>(
      begin: 0.8,
      end: 1.2,
    ).animate(CurvedAnimation(parent: _boltCtrl, curve: Curves.easeInOut));

    _dotsCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 750),
    )..repeat();
  }

  @override
  void dispose() {
    _riderCtrl.dispose();
    _boltCtrl.dispose();
    _dotsCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final screenW = MediaQuery.sizeOf(context).width;
    final screenH = MediaQuery.sizeOf(context).height;
    // Road y sits at 62% of screen height
    final roadY = screenH * 0.62;

    return ColoredBox(
      color: const Color(0xFFF0FDF4), // very light green-white sky
      child: Stack(
        children: [
          // ── Sky gradient ──────────────────────────────────────
          const Positioned.fill(
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    Color(0xFFECFDF5), // mint top
                    Color(0xFFF0FDF4), // light mid
                    Color(0xFFDCFCE7), // slightly greener bottom
                  ],
                  stops: [0.0, 0.55, 1.0],
                ),
              ),
            ),
          ),

          // ── Static illustrated scene (trees + road) ───────────
          Positioned.fill(
            child: CustomPaint(painter: _ScenePainter(roadY: roadY)),
          ),

          // ── Brand name ────────────────────────────────────────
          Positioned(
            top: screenH * 0.09,
            left: 0,
            right: 0,
            child: Center(
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 30,
                    height: 30,
                    margin: const EdgeInsets.only(right: 8),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(8),
                      boxShadow: [
                        BoxShadow(
                          color: const Color(
                            0xFF22C55E,
                          ).withValues(alpha: 0.25),
                          blurRadius: 8,
                          spreadRadius: 1,
                        ),
                      ],
                    ),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(8),
                      child: Image.asset(
                        'assets/images/logo.png',
                        fit: BoxFit.cover,
                      ),
                    ),
                  ),
                  RichText(
                    text: const TextSpan(
                      style: TextStyle(
                        fontFamily: 'Inter',
                        fontSize: 22,
                        fontWeight: FontWeight.w900,
                        letterSpacing: 2.5,
                      ),
                      children: [
                        TextSpan(
                          text: 'BLINKIE',
                          style: TextStyle(color: Color(0xFF14532D)),
                        ),
                        TextSpan(
                          text: 'FASH',
                          style: TextStyle(color: Color(0xFF22C55E)),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),

          // ── Animated: cyclist + bolt ──────────────────────────
          AnimatedBuilder(
            animation: Listenable.merge([_riderCtrl, _boltCtrl]),
            builder: (context, _) {
              final t = _riderCtrl.value; // 0→1
              final riderX = t * (screenW + 280) - 140;
              final bob = math.sin(t * math.pi * 14) * 2.0;
              final boltScale = _boltScale.value;
              final wheel = _wheelAngle.value;

              return Stack(
                children: [
                  // ⚡ floating bubble above rider
                  Positioned(
                    left: riderX + 44,
                    top: roadY - 118 + bob,
                    child: Transform.scale(
                      scale: boltScale,
                      child: Container(
                        width: 34,
                        height: 34,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: const Color(
                            0xFF22C55E,
                          ).withValues(alpha: 0.15),
                          border: Border.all(
                            color: const Color(
                              0xFF22C55E,
                            ).withValues(alpha: 0.4),
                            width: 1.5,
                          ),
                          boxShadow: [
                            BoxShadow(
                              color: const Color(
                                0xFF22C55E,
                              ).withValues(alpha: 0.3),
                              blurRadius: 12,
                              spreadRadius: 2,
                            ),
                          ],
                        ),
                        child: const Center(
                          child: Text('⚡', style: TextStyle(fontSize: 16)),
                        ),
                      ),
                    ),
                  ),

                  // Green cyclist
                  Positioned(
                    left: riderX,
                    top: roadY - 92 + bob,
                    child: CustomPaint(
                      size: const Size(88, 88),
                      painter: _CyclistPainter(wheelAngle: wheel),
                    ),
                  ),
                ],
              );
            },
          ),

          // ── Tagline + dots (between brand and trees) ───────────
          Positioned(
            top: screenH * 0.22,
            left: 0,
            right: 0,
            child: AnimatedBuilder(
              animation: _dotsCtrl,
              builder: (context, _) {
                final t = _dotsCtrl.value;
                return Column(
                  children: [
                    const Text(
                      'FASHION DELIVERED IN A BLINK',
                      style: TextStyle(
                        color: Color(0xFF15803D),
                        fontSize: 14,
                        letterSpacing: 2.0,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 10),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(
                          widget.message,
                          style: const TextStyle(
                            color: Color(0xFF374151),
                            fontSize: 17,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                        const SizedBox(width: 5),
                        _Dot(active: t <= 0.33),
                        const SizedBox(width: 3),
                        _Dot(active: t > 0.33 && t <= 0.66),
                        const SizedBox(width: 3),
                        _Dot(active: t > 0.66),
                      ],
                    ),
                  ],
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _Dot extends StatelessWidget {
  final bool active;
  const _Dot({required this.active});
  @override
  Widget build(BuildContext context) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 150),
      width: active ? 5 : 3,
      height: active ? 5 : 3,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: active
            ? const Color(0xFF22C55E)
            : const Color(0xFF22C55E).withValues(alpha: 0.3),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────
//  Static scene: road + trees + clouds + ground
// ─────────────────────────────────────────────────────────────
class _ScenePainter extends CustomPainter {
  final double roadY;
  const _ScenePainter({required this.roadY});

  @override
  void paint(Canvas canvas, Size s) {
    final w = s.width;

    // ── Ground strip ─────────────────────────────────────────
    canvas.drawRect(
      Rect.fromLTWH(0, roadY, w, s.height - roadY),
      Paint()..color = const Color(0xFFBBF7D0),
    );

    // ── Road ─────────────────────────────────────────────────
    canvas.drawRect(
      Rect.fromLTWH(0, roadY - 6, w, 14),
      Paint()..color = const Color(0xFF4B5563),
    );
    // Road edge lines
    canvas.drawLine(
      Offset(0, roadY - 6),
      Offset(w, roadY - 6),
      Paint()
        ..color = const Color(0xFFFFFFFF)
        ..strokeWidth = 1.5,
    );
    canvas.drawLine(
      Offset(0, roadY + 8),
      Offset(w, roadY + 8),
      Paint()
        ..color = const Color(0xFFFFFFFF)
        ..strokeWidth = 1.5,
    );
    // Dashes
    final dashPaint = Paint()
      ..color = const Color(0xFFFBBF24)
      ..strokeWidth = 2;
    for (double x = 0; x < w; x += 40) {
      canvas.drawLine(
        Offset(x, roadY + 1),
        Offset(x + 22, roadY + 1),
        dashPaint,
      );
    }

    // ── Trees (icon-style, various sizes) ────────────────────
    final treePositions = [
      // (x, groundY, scale, layered)
      (w * 0.05, roadY - 2.0, 0.70, true),
      (w * 0.18, roadY - 2.0, 0.55, false),
      (w * 0.32, roadY - 2.0, 0.85, true),
      (w * 0.47, roadY - 2.0, 0.60, false),
      (w * 0.60, roadY - 2.0, 0.78, true),
      (w * 0.75, roadY - 2.0, 0.65, false),
      (w * 0.88, roadY - 2.0, 0.80, true),
      (w * 0.97, roadY - 2.0, 0.50, false),
      // Background trees (smaller)
      (w * 0.12, roadY - 45.0, 0.45, true),
      (w * 0.28, roadY - 38.0, 0.38, false),
      (w * 0.42, roadY - 42.0, 0.50, true),
      (w * 0.58, roadY - 35.0, 0.40, false),
      (w * 0.72, roadY - 44.0, 0.48, true),
      (w * 0.85, roadY - 36.0, 0.35, false),
    ];

    for (final tp in treePositions) {
      _drawTree(canvas, tp.$1, tp.$2, tp.$3, tp.$4);
    }

    // ── Small bushes along ground ─────────────────────────────
    for (double x = 20; x < w; x += 55) {
      _drawBush(canvas, x, roadY + 10);
    }

    // ── Mini clouds ───────────────────────────────────────────
    final cloudPositions = [
      (w * 0.15, 60.0, 0.7),
      (w * 0.45, 45.0, 0.5),
      (w * 0.70, 70.0, 0.65),
      (w * 0.88, 38.0, 0.45),
    ];
    for (final cp in cloudPositions) {
      _drawCloud(canvas, cp.$1, cp.$2, cp.$3);
    }
  }

  void _drawTree(
    Canvas canvas,
    double cx,
    double groundY,
    double scale,
    bool layered,
  ) {
    final h = 70 * scale;
    final hw = 28 * scale;
    final trunkH = 16 * scale;
    final trunkW = 6 * scale;

    // Trunk
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromLTWH(cx - trunkW / 2, groundY - trunkH, trunkW, trunkH),
        const Radius.circular(2),
      ),
      Paint()..color = const Color(0xFF78350F),
    );

    // Tree canopy (layered pine style)
    final canopyPaint = Paint()..color = const Color(0xFF16A34A);
    final canopyDarkPaint = Paint()..color = const Color(0xFF14532D);

    if (layered) {
      // Bottom layer (widest)
      _drawTreeTriangle(
        canvas,
        cx,
        groundY - trunkH,
        hw,
        h * 0.45,
        canopyPaint,
      );
      // Middle layer
      _drawTreeTriangle(
        canvas,
        cx,
        groundY - trunkH - h * 0.30,
        hw * 0.75,
        h * 0.40,
        canopyPaint,
      );
      // Top layer
      _drawTreeTriangle(
        canvas,
        cx,
        groundY - trunkH - h * 0.55,
        hw * 0.50,
        h * 0.32,
        canopyDarkPaint,
      );
    } else {
      // Simple rounded canopy
      canvas.drawOval(
        Rect.fromCenter(
          center: Offset(cx, groundY - trunkH - h * 0.45),
          width: hw * 1.6,
          height: h * 0.85,
        ),
        canopyPaint,
      );
    }

    // Highlight dot
    canvas.drawCircle(
      Offset(cx - hw * 0.2, groundY - trunkH - h * 0.55),
      4 * scale,
      Paint()..color = const Color(0xFF4ADE80).withValues(alpha: 0.5),
    );
  }

  void _drawTreeTriangle(
    Canvas canvas,
    double cx,
    double baseY,
    double halfW,
    double height,
    Paint paint,
  ) {
    final path = Path()
      ..moveTo(cx, baseY - height)
      ..lineTo(cx - halfW, baseY)
      ..lineTo(cx + halfW, baseY)
      ..close();
    canvas.drawPath(path, paint);
  }

  void _drawBush(Canvas canvas, double cx, double y) {
    final p = Paint()..color = const Color(0xFF22C55E).withValues(alpha: 0.7);
    canvas.drawOval(
      Rect.fromCenter(center: Offset(cx, y), width: 18, height: 11),
      p,
    );
    canvas.drawOval(
      Rect.fromCenter(center: Offset(cx + 8, y - 2), width: 14, height: 9),
      p,
    );
    canvas.drawOval(
      Rect.fromCenter(center: Offset(cx - 7, y - 1), width: 13, height: 8),
      p,
    );
  }

  void _drawCloud(Canvas canvas, double cx, double cy, double scale) {
    final p = Paint()..color = Colors.white.withValues(alpha: 0.85);
    final r = 18 * scale;
    canvas.drawCircle(Offset(cx, cy), r, p);
    canvas.drawCircle(Offset(cx + r * 0.9, cy + r * 0.15), r * 0.75, p);
    canvas.drawCircle(Offset(cx - r * 0.8, cy + r * 0.2), r * 0.65, p);
    canvas.drawRect(
      Rect.fromLTWH(cx - r * 1.45, cy + r * 0.2, r * 3.0, r * 0.7),
      p,
    );
  }

  @override
  bool shouldRepaint(_ScenePainter old) => old.roadY != roadY;
}

// ─────────────────────────────────────────────────────────────
//  Cyclist painter – matches the green cycling icon
//  Rider bent forward, green bike, rotating wheels + pedals
// ─────────────────────────────────────────────────────────────
class _CyclistPainter extends CustomPainter {
  final double wheelAngle;
  _CyclistPainter({required this.wheelAngle});

  @override
  void paint(Canvas canvas, Size s) {
    final w = s.width;
    final h = s.height;

    // Wheel centres
    final rearC = Offset(w * 0.24, h * 0.72);
    final frontC = Offset(w * 0.76, h * 0.72);
    const wheelR = 20.0;

    // ── Wheels ─────────────────────────────────────────────
    void wheel(Offset c) {
      // Tyre
      canvas.drawCircle(
        c,
        wheelR,
        Paint()
          ..color = const Color(0xFF14532D)
          ..style = PaintingStyle.stroke
          ..strokeWidth = 4.5,
      );
      // Inner rim
      canvas.drawCircle(
        c,
        wheelR - 5,
        Paint()
          ..color = const Color(0xFF22C55E)
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1.5,
      );
      // Hub
      canvas.drawCircle(c, 3.5, Paint()..color = const Color(0xFF14532D));
      // Spokes
      final sp = Paint()
        ..color = const Color(0xFF16A34A)
        ..strokeWidth = 1.2;
      for (int i = 0; i < 6; i++) {
        final a = wheelAngle + i * (math.pi / 3);
        canvas.drawLine(
          c,
          Offset(
            c.dx + (wheelR - 3) * math.cos(a),
            c.dy + (wheelR - 3) * math.sin(a),
          ),
          sp,
        );
      }
    }

    wheel(rearC);
    wheel(frontC);

    // ── Bike frame ──────────────────────────────────────────
    // Chain stay (rear axle → bottom bracket)
    final bbC = Offset(w * 0.45, h * 0.72);
    final framePaint = Paint()
      ..color = const Color(0xFF16A34A)
      ..strokeWidth = 3.5
      ..strokeCap = StrokeCap.round
      ..style = PaintingStyle.stroke;

    canvas.drawLine(rearC, bbC, framePaint);
    // Seat tube
    final seatC = Offset(w * 0.42, h * 0.42);
    canvas.drawLine(bbC, seatC, framePaint);
    // Top tube
    final headC = Offset(w * 0.64, h * 0.40);
    canvas.drawLine(seatC, headC, framePaint);
    // Down tube
    canvas.drawLine(headC, bbC, framePaint);
    // Chain stay (bb → front fork)
    canvas.drawLine(frontC, headC, framePaint..color = const Color(0xFF22C55E));
    // Fork
    canvas.drawLine(
      headC,
      frontC,
      framePaint
        ..color = const Color(0xFF16A34A)
        ..strokeWidth = 3.0,
    );

    // Seat
    canvas.drawLine(
      seatC,
      Offset(seatC.dx - 8, seatC.dy - 2),
      Paint()
        ..color = const Color(0xFF14532D)
        ..strokeWidth = 3.5
        ..strokeCap = StrokeCap.round
        ..style = PaintingStyle.stroke,
    );
    final seatRRect = RRect.fromRectAndRadius(
      Rect.fromLTWH(seatC.dx - 14, seatC.dy - 6, 16, 5),
      const Radius.circular(3),
    );
    canvas.drawRRect(seatRRect, Paint()..color = const Color(0xFF14532D));

    // Handlebar
    canvas.drawLine(
      headC,
      Offset(w * 0.76, h * 0.28),
      Paint()
        ..color = const Color(0xFF14532D)
        ..strokeWidth = 3.5
        ..strokeCap = StrokeCap.round
        ..style = PaintingStyle.stroke,
    );
    canvas.drawLine(
      Offset(w * 0.73, h * 0.26),
      Offset(w * 0.82, h * 0.29),
      Paint()
        ..color = const Color(0xFF14532D)
        ..strokeWidth = 4
        ..strokeCap = StrokeCap.round
        ..style = PaintingStyle.stroke,
    );

    // Pedal crank
    final crankAngle = wheelAngle * 1.5;
    final pedal1 = Offset(
      bbC.dx + 10 * math.cos(crankAngle),
      bbC.dy + 10 * math.sin(crankAngle),
    );
    final pedal2 = Offset(
      bbC.dx - 10 * math.cos(crankAngle),
      bbC.dy - 10 * math.sin(crankAngle),
    );
    final crankPaint = Paint()
      ..color = const Color(0xFF14532D)
      ..strokeWidth = 3
      ..strokeCap = StrokeCap.round
      ..style = PaintingStyle.stroke;
    canvas.drawLine(pedal1, pedal2, crankPaint);
    for (final p in [pedal1, pedal2]) {
      canvas.drawRRect(
        RRect.fromRectAndRadius(
          Rect.fromCenter(center: p, width: 8, height: 3),
          const Radius.circular(1),
        ),
        Paint()..color = const Color(0xFF14532D),
      );
    }

    // ── Rider (bent-forward cycling position) ────────────────
    // Torso (leaning forward ~45°)
    final hipC = Offset(seatC.dx + 2, seatC.dy - 3);
    final neckC = Offset(w * 0.68, h * 0.24);
    canvas.drawLine(
      hipC,
      neckC,
      Paint()
        ..color = const Color(0xFF16A34A)
        ..strokeWidth = 7
        ..strokeCap = StrokeCap.round
        ..style = PaintingStyle.stroke,
    );

    // Upper arm → handlebar
    canvas.drawLine(
      neckC,
      Offset(w * 0.76, h * 0.30),
      Paint()
        ..color = const Color(0xFF22C55E)
        ..strokeWidth = 5
        ..strokeCap = StrokeCap.round
        ..style = PaintingStyle.stroke,
    );

    // Thigh + lower leg (connected to pedal)
    canvas.drawLine(
      hipC,
      Offset(pedal1.dx + 2, pedal1.dy - 4),
      Paint()
        ..color = const Color(0xFF16A34A)
        ..strokeWidth = 5.5
        ..strokeCap = StrokeCap.round
        ..style = PaintingStyle.stroke,
    );

    // Helmet (round, green with visor)
    canvas.drawOval(
      Rect.fromCenter(
        center: Offset(neckC.dx + 2, neckC.dy - 9),
        width: 22,
        height: 19,
      ),
      Paint()..color = const Color(0xFF22C55E),
    );
    // Visor
    canvas.drawArc(
      Rect.fromCenter(
        center: Offset(neckC.dx + 2, neckC.dy - 5),
        width: 20,
        height: 12,
      ),
      0,
      math.pi,
      false,
      Paint()
        ..color = const Color(0xFF14532D)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 3,
    );
    // Face
    canvas.drawCircle(
      Offset(neckC.dx + 5, neckC.dy - 3),
      4,
      Paint()..color = const Color(0xFFFDE68A),
    );
  }

  @override
  bool shouldRepaint(_CyclistPainter old) => old.wheelAngle != wheelAngle;
}
