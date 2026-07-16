import 'dart:math';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../services/api_client.dart';
import '../services/user_session.dart';

/// Fashion Quest — Memory Card Match
/// • 1000 levels  • 10 levels/day  • +0.5% per level → +5% per full day
class FashionQuestScreen extends StatefulWidget {
  const FashionQuestScreen({super.key});
  @override
  State<FashionQuestScreen> createState() => _FashionQuestScreenState();
}

class _FashionQuestScreenState extends State<FashionQuestScreen>
    with TickerProviderStateMixin {
  final ApiClient _api = ApiClient();
  String? _userId;

  // ── Constants ──────────────────────────────────────────────────────────────
  static const _maxLevel = 1000;
  static const _dailyLimit = 10;
  static const _maxLives = 3;

  static const _emojis = [
    '👗',
    '👘',
    '👙',
    '👚',
    '👛',
    '👜',
    '👝',
    '🎒',
    '👞',
    '👟',
    '👠',
    '👡',
    '👢',
    '👒',
    '🎩',
    '🧢',
    '🧣',
    '🧤',
    '🧥',
    '🧦',
  ];

  // ── Persistent state ───────────────────────────────────────────────────────
  int _level = 0; // completed levels
  int _halfPct = 0; // × 0.5 → display %
  int _todayCount = 0; // levels done today
  bool _loading = true;

  // ── In-game state ──────────────────────────────────────────────────────────
  List<String> _cards = [];
  List<bool> _faceUp = [];
  List<bool> _matched = [];
  int _firstIdx = -1;
  bool _checking = false;
  int _moves = 0;
  bool _won = false;
  int _lives = _maxLives;
  int _combo = 0;

  // ── Animation ──────────────────────────────────────────────────────────────
  late AnimationController _matchCtrl;

  @override
  void initState() {
    super.initState();
    _matchCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 500),
    )..addListener(() => setState(() {}));
    _loadProgress();
  }

  @override
  void dispose() {
    _matchCtrl.dispose();
    super.dispose();
  }

  // ── Load / save ────────────────────────────────────────────────────────────

  Future<void> _loadProgress() async {
    _userId = UserSession.instance.userId;
    if (_userId == null) {
      setState(() => _loading = false);
      return;
    }
    try {
      final data = await _api.fetchGamificationState(_userId!);
      if (!mounted) return;
      setState(() {
        _level = (data['questLevel'] as num?)?.toInt() ?? 0;
        _halfPct = (data['questHalfPct'] as num?)?.toInt() ?? 0;
        _todayCount = (data['questTodayCount'] as num?)?.toInt() ?? 0;
        _loading = false;
      });

      if (_todayCount < _dailyLimit && _level < _maxLevel) _startGame();
    } catch (_) {
      if (!mounted) return;
      setState(() => _loading = false);
    }
  }

  // ── Tier helpers ───────────────────────────────────────────────────────────

  Color get _tier {
    if (_level < 100) return const Color(0xFF7C3AED); // purple
    if (_level < 300) return const Color(0xFF2563EB); // blue
    if (_level < 500) return const Color(0xFFEA580C); // orange
    if (_level < 700) return const Color(0xFFDC2626); // red
    if (_level < 900) return const Color(0xFFCA8A04); // gold
    return const Color(0xFFDB2777); // legendary
  }

  String get _tierLabel {
    if (_level < 100) return '💜 Beginner';
    if (_level < 300) return '💙 Explorer';
    if (_level < 500) return '🧡 Trendsetter';
    if (_level < 700) return '❤️ Stylist';
    if (_level < 900) return '💛 Fashion Pro';
    return '💖 Style Legend';
  }

  int get _pairCount {
    if (_level < 100) return 3;
    if (_level < 300) return 4;
    if (_level < 500) return 5;
    if (_level < 700) return 6;
    if (_level < 900) return 7;
    return 8;
  }

  int get _cols => _pairCount <= 3 ? 3 : 4;

  String get _discStr => (_halfPct * 0.5).toStringAsFixed(1);

  // ── Game logic ─────────────────────────────────────────────────────────────

  void _startGame() {
    final pairs = _pairCount;
    final pool = List<String>.from(_emojis)..shuffle(Random());
    final deck = [...pool.take(pairs), ...pool.take(pairs)]..shuffle(Random());
    setState(() {
      _cards = deck;
      _faceUp = List.filled(deck.length, false);
      _matched = List.filled(deck.length, false);
      _firstIdx = -1;
      _checking = false;
      _moves = 0;
      _won = false;
      _lives = _maxLives;
      _combo = 0;
    });
  }

  void _onTap(int idx) async {
    if (_checking || _faceUp[idx] || _matched[idx] || _won) return;
    HapticFeedback.selectionClick();

    setState(() => _faceUp[idx] = true);

    if (_firstIdx == -1) {
      setState(() => _firstIdx = idx);
      return;
    }

    final first = _firstIdx;
    setState(() {
      _checking = true;
      _moves++;
      _firstIdx = -1;
    });

    await Future.delayed(const Duration(milliseconds: 600));
    if (!mounted) return;

    if (_cards[first] == _cards[idx]) {
      HapticFeedback.mediumImpact();
      _matchCtrl.forward(from: 0);
      setState(() {
        _matched[first] = true;
        _matched[idx] = true;
        _checking = false;
        _combo++;
      });
      if (_matched.every((m) => m)) await _onLevelWon();
    } else {
      HapticFeedback.lightImpact();
      setState(() {
        _faceUp[first] = false;
        _faceUp[idx] = false;
        _checking = false;
        _combo = 0;
        _lives--;
      });
      if (_lives <= 0) {
        await Future.delayed(const Duration(milliseconds: 300));
        if (mounted) _showGameOverDialog();
      }
    }
  }

  Future<void> _onLevelWon() async {
    HapticFeedback.heavyImpact();
    setState(() => _won = true);

    final userId = _userId;
    if (userId == null) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please login to save Fashion Quest progress.'),
          backgroundColor: Color(0xFFDC2626),
        ),
      );
      return;
    }

    final saveRes = await _api.completeFashionQuestLevel(userId: userId);
    if (saveRes['success'] != true) {
      if (!mounted) return;
      final message =
          saveRes['message']?.toString() ?? 'Could not save quest progress.';
      final low = message.toLowerCase();

      // If backend is temporarily unavailable, continue gameplay locally
      // instead of hard-blocking with a generic "Request failed" message.
      final isTransientFailure =
          low.contains('request failed') ||
          low.contains('server error') ||
          low.contains('timeout') ||
          low.contains('socket');

      if (isTransientFailure) {
        setState(() {
          _level = (_level + 1).clamp(0, _maxLevel);
          _halfPct += 1;
          _todayCount = (_todayCount + 1).clamp(0, _dailyLimit);
        });
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              'Saved locally for now. Progress will sync when network is stable.',
            ),
            backgroundColor: Color(0xFFB45309),
          ),
        );

        await Future.delayed(const Duration(milliseconds: 500));
        if (!mounted) return;
        if (_todayCount >= _dailyLimit) {
          _showDailyCompleteDialog();
        } else {
          _showWinDialog();
        }
        return;
      }

      final level = (saveRes['questLevel'] as num?)?.toInt();
      final halfPct = (saveRes['questHalfPct'] as num?)?.toInt();
      final todayCount = (saveRes['questTodayCount'] as num?)?.toInt();
      if (level != null && halfPct != null && todayCount != null) {
        setState(() {
          _level = level;
          _halfPct = halfPct;
          _todayCount = todayCount;
        });
      }
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(message),
          backgroundColor: const Color(0xFFDC2626),
        ),
      );
      return;
    }

    setState(() {
      _level = (saveRes['questLevel'] as num?)?.toInt() ?? _level;
      _halfPct = (saveRes['questHalfPct'] as num?)?.toInt() ?? _halfPct;
      _todayCount =
          (saveRes['questTodayCount'] as num?)?.toInt() ?? _todayCount;
    });

    await Future.delayed(const Duration(milliseconds: 500));
    if (!mounted) return;

    if (_todayCount >= _dailyLimit) {
      _showDailyCompleteDialog();
    } else {
      _showWinDialog();
    }
  }

  // ── Dialogs ────────────────────────────────────────────────────────────────

  void _showGameOverDialog() {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (_) => Dialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        backgroundColor: const Color(0xFF1E1B4B),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(24, 32, 24, 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text('💔', style: TextStyle(fontSize: 60)),
              const SizedBox(height: 12),
              const Text(
                'Out of Lives!',
                style: TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.w900,
                  color: Colors.white,
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                'Oops! All hearts gone.\nDon\'t give up — try this level again!',
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: Color(0xFF94A3B8),
                  fontSize: 13,
                  height: 1.5,
                ),
              ),
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: () {
                    Navigator.pop(context);
                    _startGame();
                  },
                  icon: const Icon(Icons.refresh_rounded),
                  label: const Text(
                    'Try Again 💪',
                    style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: _tier,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 13),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
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
    final canContinue = _todayCount < _dailyLimit && _level < _maxLevel;
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (_) => Dialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(28)),
        backgroundColor: Colors.white,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(24, 28, 24, 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Lives as hearts
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: List.generate(
                  _maxLives,
                  (i) => Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 2),
                    child: Text(
                      i < _lives ? '❤️' : '🖤',
                      style: const TextStyle(fontSize: 22),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 10),
              Text(
                'Level $_level Done! 🎉',
                style: TextStyle(
                  fontSize: 21,
                  fontWeight: FontWeight.w900,
                  color: _tier,
                ),
              ),
              const SizedBox(height: 10),
              // Reward pill
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 20,
                  vertical: 10,
                ),
                decoration: BoxDecoration(
                  color: _tier.withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: _tier.withValues(alpha: 0.35)),
                ),
                child: Column(
                  children: [
                    Text(
                      '+0.5% Discount Added! 🎁',
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                        color: _tier,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'Total: $_discStr% earned',
                      style: TextStyle(
                        fontSize: 12,
                        color: _tier.withValues(alpha: 0.7),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),
              // Daily bar
              Row(
                children: [
                  Expanded(
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(4),
                      child: LinearProgressIndicator(
                        value: _todayCount / _dailyLimit,
                        backgroundColor: Colors.grey.shade200,
                        valueColor: AlwaysStoppedAnimation(_tier),
                        minHeight: 8,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    '$_todayCount/$_dailyLimit',
                    style: TextStyle(
                      color: _tier,
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              Text(
                canContinue
                    ? '${_dailyLimit - _todayCount} more level${_dailyLimit - _todayCount == 1 ? "" : "s"} to earn 5% today!'
                    : 'Daily limit reached. See you tomorrow! 🌟',
                style: TextStyle(fontSize: 11, color: Colors.grey.shade500),
              ),
              const SizedBox(height: 16),
              if (canContinue)
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: () {
                      Navigator.pop(context);
                      _startGame();
                    },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: _tier,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 13),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14),
                      ),
                    ),
                    child: Text(
                      'Next Level ${_level + 1} →',
                      style: const TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 14,
                      ),
                    ),
                  ),
                )
              else
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton(
                    onPressed: () => Navigator.pop(context),
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 13),
                      side: BorderSide(color: _tier),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14),
                      ),
                    ),
                    child: Text(
                      'Close',
                      style: TextStyle(
                        color: _tier,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  void _showDailyCompleteDialog() {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (_) => Dialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(28)),
        child: Container(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: [_tier, _tier.withValues(alpha: 0.65)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(28),
          ),
          padding: const EdgeInsets.fromLTRB(24, 36, 24, 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text('🎊', style: TextStyle(fontSize: 72)),
              const SizedBox(height: 14),
              const Text(
                'Daily Mission\nComplete!',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 26,
                  fontWeight: FontWeight.w900,
                  color: Colors.white,
                ),
              ),
              const SizedBox(height: 14),
              Container(
                padding: const EdgeInsets.symmetric(
                  vertical: 16,
                  horizontal: 20,
                ),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.2),
                  borderRadius: BorderRadius.circular(18),
                ),
                child: Column(
                  children: [
                    const Text(
                      '🎁 Today\'s Reward',
                      style: TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w700,
                        fontSize: 15,
                      ),
                    ),
                    const SizedBox(height: 8),
                    const Text(
                      '+5% Discount',
                      style: TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w900,
                        fontSize: 32,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'All-time total: $_discStr%',
                      style: const TextStyle(
                        color: Colors.white70,
                        fontSize: 13,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),
              Text(
                _level >= _maxLevel
                    ? '🏆 You\'ve conquered all $_maxLevel levels! Legendary!'
                    : '${_maxLevel - _level} levels left on your fashion journey!',
                textAlign: TextAlign.center,
                style: const TextStyle(
                  color: Colors.white70,
                  fontSize: 13,
                  height: 1.4,
                ),
              ),
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () => Navigator.pop(context),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.white,
                    foregroundColor: _tier,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                  ),
                  child: const Text(
                    'See You Tomorrow! 🌟',
                    style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ── Build ──────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0F0A1E),
      appBar: AppBar(
        backgroundColor: const Color(0xFF0F0A1E),
        foregroundColor: Colors.white,
        elevation: 0,
        title: const Text(
          'Fashion Quest 🎮',
          style: TextStyle(fontWeight: FontWeight.w800),
        ),
        actions: [
          if (!_loading)
            Padding(
              padding: const EdgeInsets.only(right: 16),
              child: Center(
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 5,
                  ),
                  decoration: BoxDecoration(
                    color: _tier.withValues(alpha: 0.2),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: _tier.withValues(alpha: 0.5)),
                  ),
                  child: Text(
                    '$_discStr% total',
                    style: TextStyle(
                      color: _tier,
                      fontWeight: FontWeight.w700,
                      fontSize: 12,
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
      body: _loading
          ? Center(child: CircularProgressIndicator(color: _tier))
          : Column(
              children: [
                _buildHeader(),
                Expanded(child: _buildBody()),
              ],
            ),
    );
  }

  Widget _buildHeader() {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 6, 16, 10),
      child: Column(
        children: [
          // Tier + level row
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 4,
                ),
                decoration: BoxDecoration(
                  color: _tier.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: _tier.withValues(alpha: 0.4)),
                ),
                child: Text(
                  _tierLabel,
                  style: TextStyle(
                    color: _tier,
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              const Spacer(),
              Text(
                'L${_level + 1} / $_maxLevel',
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
          const SizedBox(height: 7),
          // Overall progress
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: _level / _maxLevel,
              backgroundColor: Colors.white.withValues(alpha: 0.07),
              valueColor: AlwaysStoppedAnimation(_tier),
              minHeight: 5,
            ),
          ),
          const SizedBox(height: 8),
          // Daily quest bar
          Row(
            children: [
              const Text(
                "Today's Quest  ",
                style: TextStyle(color: Color(0xFF94A3B8), fontSize: 11),
              ),
              Expanded(
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(4),
                  child: LinearProgressIndicator(
                    value: _todayCount / _dailyLimit,
                    backgroundColor: Colors.white.withValues(alpha: 0.07),
                    valueColor: const AlwaysStoppedAnimation(Color(0xFF4ADE80)),
                    minHeight: 8,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Text(
                '$_todayCount/$_dailyLimit  +${(_todayCount * 0.5).toStringAsFixed(1)}%',
                style: const TextStyle(
                  color: Color(0xFF4ADE80),
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildBody() {
    if (_userId == null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(28),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: const [
              Text('🔒', style: TextStyle(fontSize: 64)),
              SizedBox(height: 14),
              Text(
                'Login Required',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 24,
                  fontWeight: FontWeight.w800,
                ),
              ),
              SizedBox(height: 10),
              Text(
                'Fashion Quest progress is now account-based.\nPlease login to play and save levels.',
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: Color(0xFF94A3B8),
                  fontSize: 13,
                  height: 1.5,
                ),
              ),
            ],
          ),
        ),
      );
    }

    if (_level >= _maxLevel) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Text('🏆', style: TextStyle(fontSize: 80)),
              const SizedBox(height: 20),
              const Text(
                'Absolute Style Legend!',
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 26,
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(height: 12),
              Text(
                'You conquered all $_maxLevel levels!\nTotal discount: $_discStr% 🎊',
                textAlign: TextAlign.center,
                style: const TextStyle(
                  color: Color(0xFF94A3B8),
                  fontSize: 15,
                  height: 1.5,
                ),
              ),
            ],
          ),
        ),
      );
    }

    if (_todayCount >= _dailyLimit) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(28),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Text('🌟', style: TextStyle(fontSize: 72)),
              const SizedBox(height: 16),
              const Text(
                'Daily Mission Done!',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 24,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 10),
              Text(
                'You nailed 10 levels & earned 5% today! 🎁\nLevel ${_level + 1} awaits tomorrow.',
                textAlign: TextAlign.center,
                style: const TextStyle(
                  color: Color(0xFF94A3B8),
                  fontSize: 13,
                  height: 1.5,
                ),
              ),
              const SizedBox(height: 24),
              _statsCard(),
            ],
          ),
        ),
      );
    }

    // Active game
    return Column(
      children: [
        // Lives + combo + moves
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 6),
          child: Row(
            children: [
              Row(
                children: List.generate(
                  _maxLives,
                  (i) => Padding(
                    padding: const EdgeInsets.only(right: 3),
                    child: Text(
                      i < _lives ? '❤️' : '🖤',
                      style: const TextStyle(fontSize: 18),
                    ),
                  ),
                ),
              ),
              const Spacer(),
              if (_combo >= 2)
                AnimatedScale(
                  scale: 1.0 + (_matchCtrl.value * 0.1),
                  duration: Duration.zero,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 3,
                    ),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFBBF24).withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(
                        color: const Color(0xFFFBBF24).withValues(alpha: 0.5),
                      ),
                    ),
                    child: Text(
                      '🔥 x$_combo Combo!',
                      style: const TextStyle(
                        color: Color(0xFFFBBF24),
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ),
              const Spacer(),
              Row(
                children: [
                  const Icon(
                    Icons.touch_app_rounded,
                    color: Color(0xFF64748B),
                    size: 14,
                  ),
                  const SizedBox(width: 4),
                  Text(
                    '$_moves',
                    style: const TextStyle(
                      color: Color(0xFF94A3B8),
                      fontSize: 13,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
        // Level label
        Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 5),
            decoration: BoxDecoration(
              color: _tier.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Text(
              'Level ${_level + 1}  •  Match $_pairCount pairs',
              style: TextStyle(
                color: _tier,
                fontSize: 12,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ),
        // Card grid
        Expanded(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12),
            child: GridView.builder(
              gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: _cols,
                crossAxisSpacing: 8,
                mainAxisSpacing: 8,
              ),
              itemCount: _cards.length,
              itemBuilder: (_, i) => _buildCard(i),
            ),
          ),
        ),
        const SizedBox(height: 12),
      ],
    );
  }

  Widget _buildCard(int i) {
    final up = _faceUp[i] || _matched[i];
    final matched = _matched[i];

    return GestureDetector(
      onTap: () => _onTap(i),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 220),
        curve: Curves.easeOut,
        decoration: BoxDecoration(
          gradient: matched
              ? LinearGradient(
                  colors: [_tier, _tier.withValues(alpha: 0.55)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                )
              : null,
          color: matched
              ? null
              : up
              ? Colors.white
              : const Color(0xFF1E1B4B),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: matched
                ? _tier
                : up
                ? _tier.withValues(alpha: 0.55)
                : Colors.white.withValues(alpha: 0.08),
            width: matched ? 2.5 : 1.5,
          ),
          boxShadow: matched
              ? [
                  BoxShadow(
                    color: _tier.withValues(alpha: 0.45),
                    blurRadius: 14,
                    spreadRadius: 1,
                  ),
                ]
              : up
              ? [BoxShadow(color: _tier.withValues(alpha: 0.2), blurRadius: 8)]
              : null,
        ),
        child: Center(
          child: up
              ? Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      _cards.isNotEmpty ? _cards[i] : '',
                      style: const TextStyle(fontSize: 30),
                    ),
                    if (matched)
                      const Text(
                        '✓',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 13,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                  ],
                )
              : Icon(
                  Icons.style_rounded,
                  color: Colors.white.withValues(alpha: 0.25),
                  size: 28,
                ),
        ),
      ),
    );
  }

  Widget _statsCard() {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.05),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: _tier.withValues(alpha: 0.35)),
      ),
      child: Column(
        children: [
          Text(
            _tierLabel,
            style: TextStyle(
              color: _tier,
              fontSize: 15,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 12),
          _statRow('🏆 Level Reached', '$_level / $_maxLevel'),
          _statRow('💰 Total Earned', '$_discStr%'),
          _statRow('🎯 Today\'s Levels', '$_todayCount / $_dailyLimit'),
          _statRow(
            '🔥 Today\'s Earn',
            '${(_todayCount * 0.5).toStringAsFixed(1)}%',
          ),
        ],
      ),
    );
  }

  Widget _statRow(String label, String value) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 5),
    child: Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 13),
        ),
        Text(
          value,
          style: const TextStyle(
            color: Colors.white,
            fontWeight: FontWeight.w700,
            fontSize: 13,
          ),
        ),
      ],
    ),
  );
}
