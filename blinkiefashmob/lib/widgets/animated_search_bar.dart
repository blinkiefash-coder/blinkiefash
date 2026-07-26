import 'dart:async';
import 'package:flutter/material.dart';
import '../pages/all_products_screen.dart';

class AnimatedSearchBar extends StatefulWidget {
  /// Extra bottom padding so the bar doesn't hug the AppBar edge.
  final double bottomPadding;

  const AnimatedSearchBar({super.key, this.bottomPadding = 10});

  @override
  State<AnimatedSearchBar> createState() => _AnimatedSearchBarState();
}

class _AnimatedSearchBarState extends State<AnimatedSearchBar> {
  static const _searchHints = [
    'Search "Kurta Sets, Puma Shoes, Bags & more"',
    'Search Skirts & Dresses…',
    'Search Men\'s T-Shirts…',
    'Search Ethnic Wear…',
    'Search Kids Clothing…',
    'Search Beauty Products…',
    'Search Jewellery…',
    'Search Shoes & Sandals…',
    'Search Home Decor…',
    'Search Backpacks & Bags…',
  ];

  int _hintIndex = 0;
  Timer? _hintTimer;

  @override
  void initState() {
    super.initState();
    _hintTimer = Timer.periodic(const Duration(milliseconds: 2500), (_) {
      if (mounted) {
        setState(() => _hintIndex = (_hintIndex + 1) % _searchHints.length);
      }
    });
  }

  @override
  void dispose() {
    _hintTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) => const AllProductsScreen(autoFocusSearch: true),
        ),
      ),
      child: Container(
        margin: EdgeInsets.fromLTRB(16, 4, 16, widget.bottomPadding),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: const Color(0xFFE5E7EB)),
          boxShadow: const [
            BoxShadow(
              color: Color(0x08000000),
              blurRadius: 12,
              offset: Offset(0, 4),
            ),
          ],
        ),
        child: Row(
          children: [
            const Icon(
              Icons.search_rounded,
              color: Color(0xFF9CA3AF),
              size: 18,
            ),
            const SizedBox(width: 8),
            // Animated rotating hint text
            Expanded(
              child: AnimatedSwitcher(
                duration: const Duration(milliseconds: 400),
                transitionBuilder: (child, anim) => FadeTransition(
                  opacity: anim,
                  child: SlideTransition(
                    position:
                        Tween<Offset>(
                          begin: const Offset(0, 0.3),
                          end: Offset.zero,
                        ).animate(
                          CurvedAnimation(parent: anim, curve: Curves.easeOut),
                        ),
                    child: child,
                  ),
                ),
                child: Text(
                  _searchHints[_hintIndex],
                  key: ValueKey(_hintIndex),
                  style: const TextStyle(
                    fontSize: 13,
                    color: Color(0xFFADB5BD),
                    fontWeight: FontWeight.w400,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ),
            const SizedBox(width: 4),
            // Scan / camera icon
            GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: () {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text('Scan feature coming soon!'),
                    duration: Duration(seconds: 2),
                  ),
                );
              },
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 6),
                child: const Icon(
                  Icons.camera_alt_rounded,
                  color: Color(0xFF6B7280),
                  size: 19,
                ),
              ),
            ),
            Container(width: 1, height: 14, color: const Color(0xFFE5E7EB)),
            // Mic / voice search icon
            GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: () {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text('Voice search coming soon!'),
                    duration: Duration(seconds: 2),
                  ),
                );
              },
              child: Padding(
                padding: const EdgeInsets.only(left: 8),
                child: const Icon(
                  Icons.mic_none_rounded,
                  color: Color(0xFF6B7280),
                  size: 19,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// Small pulsing red dot shown while the mic is active
class _PulsingDot extends StatefulWidget {
  const _PulsingDot();
  @override
  State<_PulsingDot> createState() => _PulsingDotState();
}

class _PulsingDotState extends State<_PulsingDot>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;
  late final Animation<double> _scale;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 700),
    )..repeat(reverse: true);
    _scale = Tween<double>(
      begin: 0.6,
      end: 1.0,
    ).animate(CurvedAnimation(parent: _ctrl, curve: Curves.easeInOut));
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ScaleTransition(
      scale: _scale,
      child: Container(
        width: 8,
        height: 8,
        decoration: const BoxDecoration(
          color: Color(0xFFEF4444),
          shape: BoxShape.circle,
        ),
      ),
    );
  }
}
