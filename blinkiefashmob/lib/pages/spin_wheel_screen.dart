import 'dart:math';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import '../services/api_client.dart';
import '../services/user_session.dart';

// ── Segment model ──────────────────────────────────────────────────────────
class _Seg {
  const _Seg(this.label, this.emoji, this.bg, this.fg);
  final String label;
  final String emoji;
  final Color bg;
  final Color fg;
}

// 10 segments — 3 Sorry (most common), discounts, free items, Car (1-lakh)
const _kSegs = [
  _Seg('Sorry 😅', '😅', Color(0xFF334155), Color(0xFF94A3B8)), // 0
  _Seg('1% Off', '🎫', Color(0xFFFBBF24), Color(0xFF78350F)), // 1
  _Seg('5% Off', '🎯', Color(0xFF34D399), Color(0xFF064E3B)), // 2
  _Seg('Sorry 😅', '😅', Color(0xFF1E293B), Color(0xFF64748B)), // 3
  _Seg('2% Off', '💙', Color(0xFF60A5FA), Color(0xFF1E3A8A)), // 4
  _Seg('10% Off', '🔥', Color(0xFFF97316), Color(0xFF431407)), // 5
  _Seg('Sorry 😅', '😅', Color(0xFF374151), Color(0xFF94A3B8)), // 6
  _Seg('Free 👕', '👕', Color(0xFFF9A8D4), Color(0xFF831843)), // 7
  _Seg('Free ⌚', '⌚', Color(0xFFC4B5FD), Color(0xFF4C1D95)), // 8
  _Seg('CAR! 🚗', '🚗', Color(0xFFFFD700), Color(0xFF78350F)), // 9 — 1-lakh
];

// Base weights (Sorry ~58%, Discounts ~35%, Free ~5%, Car ~1% when unlocked)
const _kBaseWeights = [30, 12, 8, 19, 10, 5, 9, 3, 2, 0];

// ── Screen ─────────────────────────────────────────────────────────────────
class SpinWheelScreen extends StatefulWidget {
  const SpinWheelScreen({super.key});
  @override
  State<SpinWheelScreen> createState() => _SpinWheelScreenState();
}

class _SpinWheelScreenState extends State<SpinWheelScreen>
    with TickerProviderStateMixin {
  final ApiClient _api = ApiClient();

  late AnimationController _spinCtrl;
  late Animation<double> _spinAnim;
  late AnimationController _pulseCtrl;
  late Animation<double> _pulseAnim;
  late AnimationController _confettiCtrl;
  late AnimationController _pointerSnapCtrl;
  late Animation<double> _pointerTiltAnim;
  late Animation<double> _pointerDropAnim;

  double _startAngle = 0;
  double _targetAngle = 0;
  bool _spinning = false;
  bool _hasSpunToday = false;
  bool _loading = true;
  bool _carUnlocked = false;
  int _wonIndex = 0;
  String? _userId;
  int _lastTickBucket = -1;
  DateTime? _lastTickAt;

  @override
  void initState() {
    super.initState();
    _spinCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 4500),
    );
    _spinAnim = CurvedAnimation(parent: _spinCtrl, curve: Curves.easeOutCubic);
    _spinCtrl.addListener(() {
      setState(() {});
      if (_spinning) {
        _emitTickHaptic();
      }
    });
    _spinCtrl.addStatusListener((s) {
      if (s == AnimationStatus.completed) _onSpinDone();
    });
    _pulseCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    )..repeat(reverse: true);
    _pulseAnim = Tween<double>(
      begin: 1.0,
      end: 1.07,
    ).animate(CurvedAnimation(parent: _pulseCtrl, curve: Curves.easeInOut));

    _confettiCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1300),
    )..addListener(() => setState(() {}));

    _pointerSnapCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 110),
    )..addListener(() => setState(() {}));

    _pointerTiltAnim = TweenSequence<double>([
      TweenSequenceItem(tween: Tween(begin: 0.0, end: -0.22), weight: 55),
      TweenSequenceItem(tween: Tween(begin: -0.22, end: 0.08), weight: 25),
      TweenSequenceItem(tween: Tween(begin: 0.08, end: 0.0), weight: 20),
    ]).animate(CurvedAnimation(parent: _pointerSnapCtrl, curve: Curves.linear));

    _pointerDropAnim = TweenSequence<double>(
      [
        TweenSequenceItem(tween: Tween(begin: 0.0, end: 5.0), weight: 60),
        TweenSequenceItem(tween: Tween(begin: 5.0, end: 0.0), weight: 40),
      ],
    ).animate(CurvedAnimation(parent: _pointerSnapCtrl, curve: Curves.easeOut));

    _init();
  }

  Future<void> _init() async {
    _userId = UserSession.instance.userId;
    if (_userId == null) {
      setState(() {
        _hasSpunToday = true;
        _carUnlocked = false;
        _loading = false;
      });
      return;
    }
    try {
      final data = await _api.fetchGamificationState(_userId!);
      if (!mounted) return;
      setState(() {
        _hasSpunToday = data['hasSpunToday'] == true;
        _carUnlocked =
            ((data['successfulOrderCount'] as num?)?.toInt() ?? 0) >= 100000;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _loading = false);
    }
  }

  int _pickPrize() {
    final weights = List<int>.from(_kBaseWeights);
    if (_carUnlocked) weights[9] = 1;
    final total = weights.fold(0, (a, b) => a + b);
    int r = Random().nextInt(total);
    for (int i = 0; i < weights.length; i++) {
      r -= weights[i];
      if (r < 0) return i;
    }
    return 0;
  }

  void _spin() {
    if (_spinning || _hasSpunToday || _loading) return;
    final userId = _userId;
    if (userId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please login to spin and claim rewards.'),
          backgroundColor: Color(0xFFDC2626),
        ),
      );
      return;
    }

    _spinFromBackend(userId);
  }

  Future<void> _spinFromBackend(String userId) async {
    HapticFeedback.heavyImpact();
    _lastTickBucket = -1;
    _lastTickAt = null;

    final saveRes = await _api.spinAndClaimReward(userId: userId);
    if (saveRes['success'] != true) {
      if (!mounted) return;
      final message = saveRes['message']?.toString() ?? 'Unable to spin now.';
      final low = message.toLowerCase();
      final isDailyLimit =
          low.contains('already spun') ||
          low.contains('daily') ||
          saveRes['hasSpunToday'] == true;
      setState(() {
        if (isDailyLimit) _hasSpunToday = true;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            isDailyLimit
                ? 'You already used today\'s spin. Try again tomorrow.'
                : 'Spin service is busy. Please try again in a moment.',
          ),
          backgroundColor: const Color(0xFFDC2626),
        ),
      );
      return;
    }

    final spinIndex = (saveRes['spinIndex'] as num?)?.toInt();
    _wonIndex =
        (spinIndex != null && spinIndex >= 0 && spinIndex < _kSegs.length)
        ? spinIndex
        : _pickPrize();

    const segAngle = 2 * pi / 10;
    final desired = pi / 2 - (_wonIndex * segAngle + segAngle / 2);
    final normalized = _startAngle % (2 * pi);
    var adj = desired - normalized;
    if (adj < 0) adj += 2 * pi;
    _targetAngle = _startAngle + 6 * 2 * pi + adj;
    setState(() => _spinning = true);
    _spinCtrl.reset();
    _spinCtrl.forward();
  }

  double get _angle =>
      _startAngle + (_targetAngle - _startAngle) * _spinAnim.value;

  bool get _isSorry => _wonIndex == 0 || _wonIndex == 3 || _wonIndex == 6;
  bool get _isCar => _wonIndex == 9;

  void _emitTickHaptic() {
    const segAngle = 2 * pi / 10;
    final bucket = ((_angle % (2 * pi)) / segAngle).floor();
    final now = DateTime.now();
    final elapsed = _lastTickAt == null
        ? 999
        : now.difference(_lastTickAt!).inMilliseconds;

    if (bucket != _lastTickBucket && elapsed >= 45) {
      _lastTickBucket = bucket;
      _lastTickAt = now;
      HapticFeedback.selectionClick();
      _pointerSnapCtrl.forward(from: 0);
    }
  }

  void _triggerConfetti() {
    _confettiCtrl.forward(from: 0);
  }

  void _onSpinDone() async {
    HapticFeedback.lightImpact();
    _startAngle = _targetAngle % (2 * pi);
    setState(() {
      _spinning = false;
      _hasSpunToday = true;
    });
    await Future.delayed(const Duration(milliseconds: 250));
    if (!mounted) return;
    if (_isCar) {
      _triggerConfetti();
      _showCarDialog();
    } else if (_isSorry) {
      _showSorryDialog();
    } else {
      _triggerConfetti();
      _showWinDialog();
    }
  }

  // ── Dialogs ───────────────────────────────────────────────────────────────

  void _showSorryDialog() {
    final msgs = [
      'Luck wasn\'t on your side today.\nTry again tomorrow! 🤞',
      'The wheel is feeling stingy today…\nCome back tomorrow! 😄',
      'Almost! Tomorrow could be YOUR day. 🌟',
      'No prize today, but your streak continues!\nSee you tomorrow 🔥',
    ];
    final msg = msgs[Random().nextInt(msgs.length)];
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (_) => Dialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(28)),
        backgroundColor: const Color(0xFF1E293B),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(28, 36, 28, 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text('😅', style: TextStyle(fontSize: 72)),
              const SizedBox(height: 14),
              const Text(
                'Not This Time!',
                style: TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.w900,
                  color: Colors.white,
                ),
              ),
              const SizedBox(height: 10),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 18,
                  vertical: 12,
                ),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.06),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(
                    color: Colors.white.withValues(alpha: 0.12),
                  ),
                ),
                child: Text(
                  msg,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    color: Color(0xFF94A3B8),
                    fontSize: 13.5,
                    height: 1.5,
                  ),
                ),
              ),
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () => Navigator.pop(context),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF334155),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                  ),
                  child: const Text(
                    'See You Tomorrow! 👋',
                    style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _showWinDialog() {
    final seg = _kSegs[_wonIndex];
    HapticFeedback.mediumImpact();
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (_) => Dialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(28)),
        backgroundColor: Colors.white,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(28, 36, 28, 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(seg.emoji, style: const TextStyle(fontSize: 72)),
              const SizedBox(height: 14),
              const Text(
                '🎊 You Won!',
                style: TextStyle(
                  fontSize: 26,
                  fontWeight: FontWeight.w900,
                  color: Color(0xFF0F172A),
                ),
              ),
              const SizedBox(height: 10),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 20,
                  vertical: 10,
                ),
                decoration: BoxDecoration(
                  color: seg.bg.withValues(alpha: 0.2),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: seg.bg),
                ),
                child: Text(
                  seg.label,
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w800,
                    color: seg.fg,
                  ),
                ),
              ),
              const SizedBox(height: 12),
              const Text(
                'Your reward has been added to your account.\nApply it on your next order! 🛍️',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 12.5,
                  color: Color(0xFF64748B),
                  height: 1.5,
                ),
              ),
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () => Navigator.pop(context),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF16A34A),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                  ),
                  child: const Text(
                    'Awesome! 🎉',
                    style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _showCarDialog() {
    Future.microtask(() async {
      for (int i = 0; i < 6; i++) {
        await Future.delayed(Duration(milliseconds: 100 + i * 80));
        HapticFeedback.heavyImpact();
      }
    });
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (_) => Dialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(28)),
        child: Container(
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [Color(0xFFFFD700), Color(0xFFFF8C00)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(28),
          ),
          padding: const EdgeInsets.fromLTRB(28, 36, 28, 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text('🚗', style: TextStyle(fontSize: 80)),
              const SizedBox(height: 14),
              const Text(
                '🎊 YOU WIN A CAR! 🎊',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.w900,
                  color: Color(0xFF431407),
                ),
              ),
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.3),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: const Text(
                  'Unbelievable! You\'ve just won a brand-new car! 🏆\n\nOur team will contact you within 24 hours to confirm and arrange delivery.',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: Color(0xFF431407),
                    fontSize: 13,
                    height: 1.5,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () => Navigator.pop(context),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF431407),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                  ),
                  child: const Text(
                    'I Can\'t Believe It! 🚗🎉',
                    style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  void dispose() {
    _spinCtrl.dispose();
    _pulseCtrl.dispose();
    _confettiCtrl.dispose();
    _pointerSnapCtrl.dispose();
    super.dispose();
  }

  // ── Build ─────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF090E1A),
      appBar: AppBar(
        backgroundColor: const Color(0xFF090E1A),
        foregroundColor: Colors.white,
        elevation: 0,
        title: const Text(
          'Spin & Win 🎡',
          style: TextStyle(fontWeight: FontWeight.w800),
        ),
        titleTextStyle: GoogleFonts.orbitron(
          color: Colors.white,
          fontWeight: FontWeight.w800,
          fontSize: 21,
          letterSpacing: 0.8,
        ),
        actions: [
          if (_carUnlocked)
            Padding(
              padding: EdgeInsets.only(right: 16),
              child: Center(
                child: Text(
                  '🚗 UNLOCKED!',
                  style: GoogleFonts.orbitron(
                    color: Color(0xFFFFD700),
                    fontWeight: FontWeight.w800,
                    fontSize: 12,
                    letterSpacing: 0.6,
                  ),
                ),
              ),
            ),
        ],
      ),
      body: _loading
          ? const Center(
              child: CircularProgressIndicator(color: Color(0xFF16A34A)),
            )
          : Stack(
              children: [
                Positioned(
                  top: -140,
                  right: -120,
                  child: Container(
                    width: 340,
                    height: 340,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      gradient: RadialGradient(
                        colors: [
                          const Color(0xFFEC4899).withValues(alpha: 0.32),
                          Colors.transparent,
                        ],
                      ),
                    ),
                  ),
                ),
                Positioned(
                  bottom: -170,
                  left: -110,
                  child: Container(
                    width: 360,
                    height: 360,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      gradient: RadialGradient(
                        colors: [
                          const Color(0xFF14B8A6).withValues(alpha: 0.24),
                          Colors.transparent,
                        ],
                      ),
                    ),
                  ),
                ),
                SingleChildScrollView(
                  child: Column(
                    children: [
                      const SizedBox(height: 8),
                      Container(
                        margin: const EdgeInsets.symmetric(horizontal: 20),
                        padding: const EdgeInsets.symmetric(
                          horizontal: 16,
                          vertical: 10,
                        ),
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            colors: [
                              Colors.white.withValues(alpha: 0.12),
                              Colors.white.withValues(alpha: 0.05),
                            ],
                          ),
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(
                            color: Colors.white.withValues(alpha: 0.18),
                          ),
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const Text('✨ ', style: TextStyle(fontSize: 15)),
                            Flexible(
                              child: Text(
                                _userId == null
                                    ? 'Login required to save Spin & Win rewards.'
                                    : _hasSpunToday
                                    ? 'You\'ve spun today — see you tomorrow!'
                                    : 'Your daily luck window is open. Spin now!',
                                style: GoogleFonts.inter(
                                  color: Color(0xFFC7D2FE),
                                  fontSize: 12.8,
                                  fontWeight: FontWeight.w600,
                                  letterSpacing: 0.15,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 20),

                      Container(
                        margin: const EdgeInsets.symmetric(horizontal: 14),
                        padding: const EdgeInsets.fromLTRB(8, 12, 8, 16),
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(30),
                          gradient: LinearGradient(
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                            colors: [
                              const Color(0xFF111827).withValues(alpha: 0.92),
                              const Color(0xFF1F2937).withValues(alpha: 0.88),
                            ],
                          ),
                          border: Border.all(
                            color: const Color(
                              0xFF64748B,
                            ).withValues(alpha: 0.35),
                          ),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withValues(alpha: 0.35),
                              blurRadius: 30,
                              offset: const Offset(0, 14),
                            ),
                          ],
                        ),
                        child: Stack(
                          alignment: Alignment.topCenter,
                          children: [
                            Padding(
                              padding: const EdgeInsets.only(top: 14),
                              child: Container(
                                width: 402,
                                height: 402,
                                decoration: BoxDecoration(
                                  shape: BoxShape.circle,
                                  gradient: RadialGradient(
                                    colors: [
                                      const Color(
                                        0xFF22D3EE,
                                      ).withValues(alpha: 0.14),
                                      const Color(
                                        0xFFEC4899,
                                      ).withValues(alpha: 0.12),
                                      Colors.transparent,
                                    ],
                                    stops: const [0.0, 0.56, 1.0],
                                  ),
                                ),
                              ),
                            ),
                            if (_spinning)
                              Padding(
                                padding: const EdgeInsets.only(top: 22),
                                child: Container(
                                  width: 376,
                                  height: 376,
                                  decoration: BoxDecoration(
                                    shape: BoxShape.circle,
                                    boxShadow: [
                                      BoxShadow(
                                        color: const Color(0xFFEC4899)
                                            .withValues(
                                              alpha:
                                                  0.45 *
                                                  _spinAnim.value.clamp(
                                                    0.0,
                                                    1.0,
                                                  ),
                                            ),
                                        blurRadius: 64,
                                        spreadRadius: 16,
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            Padding(
                              padding: const EdgeInsets.only(top: 22),
                              child: Transform.rotate(
                                angle: _spinning ? _angle : _startAngle,
                                child: CustomPaint(
                                  size: const Size(350, 350),
                                  painter: _WheelPainter(_carUnlocked),
                                ),
                              ),
                            ),
                            Padding(
                              padding: const EdgeInsets.only(top: 22),
                              child: Container(
                                width: 64,
                                height: 64,
                                decoration: BoxDecoration(
                                  gradient: const LinearGradient(
                                    colors: [
                                      Color(0xFFFFFFFF),
                                      Color(0xFFE2E8F0),
                                    ],
                                    begin: Alignment.topLeft,
                                    end: Alignment.bottomRight,
                                  ),
                                  shape: BoxShape.circle,
                                  border: Border.all(
                                    color: const Color(
                                      0xFF16A34A,
                                    ).withValues(alpha: 0.35),
                                    width: 2,
                                  ),
                                  boxShadow: [
                                    BoxShadow(
                                      color: Colors.black.withValues(
                                        alpha: 0.45,
                                      ),
                                      blurRadius: 14,
                                    ),
                                  ],
                                ),
                                child: const Icon(
                                  Icons.auto_awesome,
                                  color: Color(0xFF16A34A),
                                  size: 32,
                                ),
                              ),
                            ),
                            Transform.translate(
                              offset: Offset(0, _pointerDropAnim.value),
                              child: Transform.rotate(
                                angle: _pointerTiltAnim.value,
                                alignment: Alignment.topCenter,
                                child: CustomPaint(
                                  size: const Size(36, 48),
                                  painter: _PointerPainter(),
                                ),
                              ),
                            ),
                            if (_confettiCtrl.value > 0 &&
                                _confettiCtrl.value < 1)
                              IgnorePointer(
                                child: Padding(
                                  padding: const EdgeInsets.only(top: 8),
                                  child: SizedBox(
                                    width: 420,
                                    height: 420,
                                    child: CustomPaint(
                                      painter: _ConfettiPainter(
                                        progress: _confettiCtrl.value,
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                          ],
                        ),
                      ),

                      const SizedBox(height: 18),

                      if (!_hasSpunToday)
                        AnimatedBuilder(
                          animation: _pulseAnim,
                          builder: (_, _) => Transform.scale(
                            scale: _spinning ? 1.0 : _pulseAnim.value,
                            child: GestureDetector(
                              onTap: _spin,
                              child: Container(
                                width: 240,
                                height: 62,
                                decoration: BoxDecoration(
                                  gradient: LinearGradient(
                                    colors: _spinning
                                        ? const [
                                            Color(0xFF334155),
                                            Color(0xFF334155),
                                          ]
                                        : const [
                                            Color(0xFFF43F5E),
                                            Color(0xFF7C3AED),
                                            Color(0xFF2563EB),
                                          ],
                                  ),
                                  borderRadius: BorderRadius.circular(31),
                                  border: Border.all(
                                    color: Colors.white.withValues(alpha: 0.2),
                                  ),
                                  boxShadow: _spinning
                                      ? []
                                      : [
                                          BoxShadow(
                                            color: const Color(
                                              0xFFF43F5E,
                                            ).withValues(alpha: 0.4),
                                            blurRadius: 26,
                                            offset: const Offset(0, 8),
                                          ),
                                        ],
                                ),
                                child: Row(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    const Icon(
                                      Icons.casino_rounded,
                                      color: Colors.white,
                                      size: 20,
                                    ),
                                    const SizedBox(width: 8),
                                    Text(
                                      _spinning
                                          ? 'SPINNING...'
                                          : 'SPIN FOR REWARD',
                                      style: GoogleFonts.orbitron(
                                        color: Colors.white,
                                        fontSize: 15,
                                        fontWeight: FontWeight.w900,
                                        letterSpacing: 0.9,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ),
                        )
                      else
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 28,
                            vertical: 14,
                          ),
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.08),
                            borderRadius: BorderRadius.circular(29),
                            border: Border.all(
                              color: Colors.white.withValues(alpha: 0.18),
                            ),
                          ),
                          child: const Text(
                            '✅ Done for today. Come back tomorrow!',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 14.5,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),

                      const SizedBox(height: 26),

                      Container(
                        margin: const EdgeInsets.fromLTRB(14, 0, 14, 28),
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.07),
                          borderRadius: BorderRadius.circular(22),
                          border: Border.all(
                            color: Colors.white.withValues(alpha: 0.12),
                          ),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'Possible Rewards',
                              style: TextStyle(
                                color: Colors.white,
                                fontWeight: FontWeight.w800,
                                fontSize: 13.5,
                                letterSpacing: 0.2,
                              ),
                            ),
                            const SizedBox(height: 10),
                            Wrap(
                              spacing: 8,
                              runSpacing: 8,
                              children: [
                                _prizeTile(
                                  '😅',
                                  'Try Again Tomorrow',
                                  const Color(0xFF94A3B8),
                                  icon: Icons.history_rounded,
                                ),
                                _prizeTile(
                                  '🎫',
                                  '1% Discount',
                                  const Color(0xFFFBBF24),
                                  icon: Icons.local_offer_rounded,
                                ),
                                _prizeTile(
                                  '💙',
                                  '2% Discount',
                                  const Color(0xFF60A5FA),
                                  icon: Icons.percent_rounded,
                                ),
                                _prizeTile(
                                  '🎯',
                                  '5% Discount',
                                  const Color(0xFF34D399),
                                  icon: Icons.workspace_premium_rounded,
                                ),
                                _prizeTile(
                                  '🔥',
                                  '10% Discount',
                                  const Color(0xFFF97316),
                                  icon: Icons.bolt_rounded,
                                ),
                                _prizeTile(
                                  '👕',
                                  'Free T-shirt',
                                  const Color(0xFFF9A8D4),
                                  icon: Icons.checkroom_rounded,
                                ),
                                _prizeTile(
                                  '⌚',
                                  'Free Smartwatch',
                                  const Color(0xFFC4B5FD),
                                  icon: Icons.watch_rounded,
                                ),
                                _prizeTile(
                                  _carUnlocked ? '🚗' : '🔒',
                                  _carUnlocked ? 'Car' : 'Car Locked',
                                  _carUnlocked
                                      ? const Color(0xFFFFD700)
                                      : const Color(0xFF64748B),
                                  icon: _carUnlocked
                                      ? Icons.directions_car_filled_rounded
                                      : Icons.lock_rounded,
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
    );
  }

  Widget _prizeTile(
    String emoji,
    String label,
    Color color, {
    required IconData icon,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withValues(alpha: 0.42)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(emoji, style: const TextStyle(fontSize: 16)),
          const SizedBox(width: 5),
          Container(
            width: 18,
            height: 18,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.18),
              borderRadius: BorderRadius.circular(5),
            ),
            child: Icon(icon, size: 13, color: color),
          ),
          const SizedBox(width: 6),
          Text(
            label,
            style: GoogleFonts.inter(
              color: color,
              fontWeight: FontWeight.w700,
              fontSize: 11.5,
              letterSpacing: 0.1,
            ),
          ),
        ],
      ),
    );
  }
}

// ── Wheel Painter (10 segments) ────────────────────────────────────────────
class _WheelPainter extends CustomPainter {
  const _WheelPainter(this.carUnlocked);
  final bool carUnlocked;

  IconData _segmentIcon(int i) {
    if (i == 0 || i == 3 || i == 6) return Icons.refresh_rounded;
    if (i == 1) return Icons.local_offer_rounded;
    if (i == 2) return Icons.workspace_premium_rounded;
    if (i == 4) return Icons.percent_rounded;
    if (i == 5) return Icons.bolt_rounded;
    if (i == 7) return Icons.checkroom_rounded;
    if (i == 8) return Icons.watch_rounded;
    return carUnlocked
        ? Icons.directions_car_filled_rounded
        : Icons.lock_rounded;
  }

  String _shortLabel(int i) {
    if (i == 0 || i == 3 || i == 6) return 'TRY';
    if (i == 1) return '1%';
    if (i == 2) return '5%';
    if (i == 4) return '2%';
    if (i == 5) return '10%';
    if (i == 7) return 'TEE';
    if (i == 8) return 'WATCH';
    return carUnlocked ? 'CAR' : 'LOCK';
  }

  @override
  void paint(Canvas canvas, Size size) {
    final c = Offset(size.width / 2, size.height / 2);
    final r = size.width / 2;
    const n = 10;
    const sa = 2 * pi / n;

    final wheelRect = Rect.fromCircle(center: c, radius: r - 8);

    canvas.drawCircle(
      c,
      r,
      Paint()
        ..shader = const RadialGradient(
          colors: [Color(0xFF0F172A), Color(0xFF020617)],
          stops: [0.35, 1.0],
        ).createShader(Rect.fromCircle(center: c, radius: r)),
    );

    for (int i = 0; i < n; i++) {
      final seg = _kSegs[i];
      final startA = -pi / 2 + i * sa;

      final segPath = Path()
        ..moveTo(c.dx, c.dy)
        ..arcTo(wheelRect, startA, sa, false)
        ..close();

      canvas.drawPath(
        segPath,
        Paint()
          ..shader = LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              seg.bg.withValues(alpha: 0.95),
              Color.lerp(seg.bg, Colors.black, 0.22)!.withValues(alpha: 0.98),
            ],
          ).createShader(wheelRect),
      );

      canvas.drawPath(
        segPath,
        Paint()
          ..color = Colors.white.withValues(alpha: 0.07)
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1.6,
      );

      canvas.save();
      canvas.translate(c.dx, c.dy);
      canvas.rotate(startA + sa / 2);

      final icon = _segmentIcon(i);
      final iconPainter = TextPainter(
        text: TextSpan(
          text: String.fromCharCode(icon.codePoint),
          style: TextStyle(
            fontSize: 21,
            color: Colors.white,
            fontFamily: icon.fontFamily,
            package: icon.fontPackage,
            shadows: const [Shadow(color: Color(0xAA000000), blurRadius: 8)],
          ),
        ),
        textDirection: TextDirection.ltr,
      )..layout();
      iconPainter.paint(
        canvas,
        Offset(r * 0.48 - iconPainter.width / 2, -iconPainter.height / 2 - 2),
      );

      final glowChip = Paint()
        ..shader =
            RadialGradient(
              colors: [
                Colors.white.withValues(alpha: 0.33),
                Colors.white.withValues(alpha: 0.0),
              ],
            ).createShader(
              Rect.fromCircle(center: Offset(r * 0.48, 0), radius: 20),
            );
      canvas.drawCircle(Offset(r * 0.48, 0), 17, glowChip);

      final tp = TextPainter(
        text: TextSpan(
          text: (i == 9 && !carUnlocked) ? 'LOCK' : seg.emoji,
          style: const TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w900,
            color: Colors.white,
          ),
        ),
        textDirection: TextDirection.ltr,
      )..layout();
      tp.paint(canvas, Offset(r * 0.48 - tp.width / 2, 12));

      final lp = TextPainter(
        text: TextSpan(
          text: _shortLabel(i),
          style: TextStyle(
            color: Colors.white,
            fontSize: i == 8 ? 8.0 : 9.4,
            fontWeight: FontWeight.w900,
            letterSpacing: 0.45,
            shadows: const [Shadow(color: Color(0xAA000000), blurRadius: 6)],
          ),
        ),
        textDirection: TextDirection.ltr,
        textAlign: TextAlign.center,
      )..layout(maxWidth: r * 0.40);
      lp.paint(canvas, Offset(r * 0.67 - lp.width / 2, tp.height / 2 + 7));

      canvas.restore();

      canvas.drawArc(
        Rect.fromCircle(center: c, radius: r - 8),
        startA + sa - 0.008,
        0.012,
        false,
        Paint()
          ..color = Colors.white.withValues(alpha: 0.28)
          ..strokeWidth = 2.2
          ..strokeCap = StrokeCap.round
          ..style = PaintingStyle.stroke,
      );
    }

    canvas.drawCircle(
      c,
      r - 10,
      Paint()
        ..shader = const SweepGradient(
          colors: [
            Color(0xFFFDE68A),
            Color(0xFFF59E0B),
            Color(0xFFFDE68A),
            Color(0xFFB45309),
            Color(0xFFFDE68A),
          ],
        ).createShader(Rect.fromCircle(center: c, radius: r - 10))
        ..style = PaintingStyle.stroke
        ..strokeWidth = 7,
    );

    for (int i = 0; i < 20; i++) {
      final a = -pi / 2 + (i / 20) * 2 * pi;
      final p = Offset(c.dx + cos(a) * (r - 6), c.dy + sin(a) * (r - 6));
      canvas.drawCircle(
        p,
        2.2,
        Paint()..color = const Color(0xFFFFF3C4).withValues(alpha: 0.9),
      );
    }

    canvas.drawCircle(
      c,
      r * 0.83,
      Paint()
        ..color = Colors.white.withValues(alpha: 0.055)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2.4,
    );

    canvas.drawArc(
      Rect.fromCircle(center: c, radius: r * 0.86),
      -2.4,
      1.3,
      false,
      Paint()
        ..color = Colors.white.withValues(alpha: 0.10)
        ..strokeWidth = 16
        ..strokeCap = StrokeCap.round
        ..style = PaintingStyle.stroke,
    );

    // Outer ring
    canvas.drawCircle(
      c,
      r - 1,
      Paint()
        ..color = Colors.white.withValues(alpha: 0.16)
        ..strokeWidth = 1.6
        ..style = PaintingStyle.stroke,
    );

    // Inner hub circle
    canvas.drawCircle(
      c,
      r * 0.17,
      Paint()
        ..shader = const RadialGradient(
          colors: [Color(0xFFFEF3C7), Color(0xFFF59E0B), Color(0xFF92400E)],
          stops: [0.0, 0.56, 1.0],
        ).createShader(Rect.fromCircle(center: c, radius: r * 0.17)),
    );
    canvas.drawCircle(
      c,
      r * 0.085,
      Paint()
        ..color = const Color(0xFF111827)
        ..style = PaintingStyle.fill,
    );
  }

  @override
  bool shouldRepaint(_WheelPainter o) => o.carUnlocked != carUnlocked;
}

// ── Pointer ────────────────────────────────────────────────────────────────
class _PointerPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final path = Path()
      ..moveTo(size.width / 2, size.height)
      ..lineTo(4, 3)
      ..quadraticBezierTo(size.width / 2, 10, size.width - 4, 3)
      ..close();

    canvas.drawShadow(path, Colors.black.withValues(alpha: 0.5), 8, false);
    canvas.drawPath(
      path,
      Paint()
        ..shader = const LinearGradient(
          colors: [Color(0xFFFFF3C4), Color(0xFFF59E0B), Color(0xFFB45309)],
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
        ).createShader(Rect.fromLTWH(0, 0, size.width, size.height)),
    );
    canvas.drawPath(
      path,
      Paint()
        ..color = Colors.white.withValues(alpha: 0.32)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.2,
    );

    canvas.drawCircle(
      Offset(size.width / 2, 6),
      3,
      Paint()..color = const Color(0xFFFFF7D1),
    );
  }

  @override
  bool shouldRepaint(_PointerPainter o) => false;
}

class _ConfettiPainter extends CustomPainter {
  const _ConfettiPainter({required this.progress});

  final double progress;

  static const _palette = [
    Color(0xFFEC4899),
    Color(0xFF22D3EE),
    Color(0xFFFBBF24),
    Color(0xFF34D399),
    Color(0xFFA78BFA),
    Color(0xFFF97316),
  ];

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height * 0.30);
    final eased = Curves.easeOut.transform(progress.clamp(0.0, 1.0));
    final fade = (1 - Curves.easeIn.transform(progress.clamp(0.0, 1.0))).clamp(
      0.0,
      1.0,
    );

    for (int i = 0; i < 90; i++) {
      final angle = (i / 90) * 2 * pi;
      final radius = 40 + eased * (120 + (i % 7) * 12);
      final driftX = sin(progress * pi * 2 + i) * 8;
      final driftY = cos(progress * pi * 1.6 + i) * 6;
      final p = Offset(
        center.dx + cos(angle) * radius + driftX,
        center.dy + sin(angle) * (radius * 0.75) + driftY + progress * 90,
      );
      final color = _palette[i % _palette.length].withValues(alpha: fade);
      final paint = Paint()
        ..color = color
        ..style = PaintingStyle.fill;
      final w = 4 + (i % 3).toDouble();
      final h = 8 + (i % 5).toDouble();
      canvas.save();
      canvas.translate(p.dx, p.dy);
      canvas.rotate(angle + progress * 6 + i * 0.1);
      canvas.drawRRect(
        RRect.fromRectAndRadius(
          Rect.fromCenter(center: Offset.zero, width: w, height: h),
          const Radius.circular(2),
        ),
        paint,
      );
      canvas.restore();
    }
  }

  @override
  bool shouldRepaint(covariant _ConfettiPainter oldDelegate) {
    return oldDelegate.progress != progress;
  }
}
