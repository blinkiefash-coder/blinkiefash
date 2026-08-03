import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../api_service.dart';
import 'order_request_screen.dart';
import 'navigation_screen.dart';

class DutyScreen extends StatefulWidget {
  const DutyScreen({super.key});
  @override
  State<DutyScreen> createState() => _DutyScreenState();
}

class _DutyScreenState extends State<DutyScreen> {
  final _api = ApiService();
  List<dynamic> _shifts = [];
  Map<String, dynamic>? _activeShift;
  bool _loading = true;
  bool _toggling = false;

  // ── Order polling ─────────────────────────────────────────────────────────
  Timer? _pollTimer;
  bool _showingRequest = false;
  final Set<String> _seenOrderIds = {};

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    await _api.loadToken();
    final shifts = await _api.getShifts();
    if (mounted) {
      setState(() {
        _shifts = shifts;
        _activeShift = shifts.cast<Map<String, dynamic>?>().firstWhere(
          (s) => s?['status'] == 'active',
          orElse: () => null,
        );
        _loading = false;
      });
      if (_activeShift != null) {
        _startPolling();
      } else {
        _stopPolling();
      }
    }
  }

  void _startPolling() {
    _pollTimer?.cancel();
    _pollTimer = Timer.periodic(
      const Duration(seconds: 5),
      (_) => _checkOrders(),
    );
    _checkOrders(); // immediate first check
  }

  void _stopPolling() {
    _pollTimer?.cancel();
    _pollTimer = null;
  }

  Future<void> _checkOrders() async {
    if (_showingRequest || !mounted) return;
    final orders = await _api.getAvailableOrders();
    if (!mounted || _showingRequest) return;
    for (final order in orders) {
      final id = order['id'] as String? ?? '';
      if (_seenOrderIds.contains(id)) continue;
      // Add to seen ONLY inside triggerOrderAlert after the dialog resolves
      await _triggerOrderAlert(order, id);
      break; // show one at a time
    }
  }

  Future<void> _triggerOrderAlert(Map<String, dynamic> order, String id) async {
    if (!mounted) return;
    _showingRequest = true;
    _seenOrderIds.add(id);
    try {
      // Play alarm (wrapped so a ringtone failure doesn't kill the dialog)
      try {
        // FlutterRingtonePlayer API requires investigation for v4.0.0
        // Temporarily disabled to get app running
        HapticFeedback.vibrate();
      } catch (_) {}

      final accepted = await Navigator.of(context).push<bool>(
        MaterialPageRoute(
          fullscreenDialog: true,
          builder: (_) => OrderRequestScreen(delivery: order),
        ),
      );

      try {
        // FlutterRingtonePlayer.stop();
      } catch (_) {}

      if (accepted == true) {
        final result = await _api.acceptOrder(order['id'] as String);
        if (!mounted) return;
        if (result['success'] == true) {
          final deliveryId = result['deliveryId'] as String? ?? '';
          Navigator.of(context).push(
            MaterialPageRoute(
              builder: (_) =>
                  NavigationScreen(order: order, deliveryId: deliveryId),
            ),
          );
        } else {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(
                result['message']?.toString() ?? 'Order no longer available',
              ),
              backgroundColor: const Color(0xFFEF4444),
            ),
          );
          // Remove from seen so we don't permanently block it
          _seenOrderIds.remove(id);
        }
      }
    } finally {
      _showingRequest = false;
    }
  }

  Future<void> _startShift() async {
    setState(() => _toggling = true);
    final shift = await _api.startShift();
    if (!mounted) return;
    if (shift != null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Shift started! You are now on duty.')),
      );
      _load();
    } else {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Failed to start shift')));
    }
    setState(() => _toggling = false);
  }

  Future<void> _endShift() async {
    if (_activeShift == null) return;
    setState(() => _toggling = true);
    final ok = await _api.endShift(_activeShift!['id'] as String);
    if (!mounted) return;
    _stopPolling();
    if (ok) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Shift ended. Good work!')));
      _load();
    } else {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Failed to end shift')));
    }
    setState(() => _toggling = false);
  }

  String _duration(String? start, String? end) {
    try {
      if (start == null) return '--';
      final s = DateTime.parse(start);
      final e = end != null ? DateTime.parse(end) : DateTime.now();
      final diff = e.difference(s);
      return '${diff.inHours}h ${diff.inMinutes % 60}m';
    } catch (_) {
      return '--';
    }
  }

  @override
  Widget build(BuildContext context) {
    final isOnDuty = _activeShift != null;
    return Scaffold(
      backgroundColor: const Color(0xFFF2FAF4),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        title: const Text(
          'Duty',
          style: TextStyle(
            fontWeight: FontWeight.w800,
            color: Color(0xFF0F172A),
          ),
        ),
        actions: [
          if (isOnDuty)
            Padding(
              padding: const EdgeInsets.only(right: 16),
              child: Row(
                children: [
                  Container(
                    width: 8,
                    height: 8,
                    decoration: const BoxDecoration(
                      color: Color(0xFF16A34A),
                      shape: BoxShape.circle,
                    ),
                  ),
                  const SizedBox(width: 6),
                  const Text(
                    'Live',
                    style: TextStyle(
                      color: Color(0xFF16A34A),
                      fontWeight: FontWeight.w700,
                      fontSize: 13,
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
      body: _loading
          ? const Center(
              child: CircularProgressIndicator(color: Color(0xFF16A34A)),
            )
          : RefreshIndicator(
              color: const Color(0xFF16A34A),
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  // ── Duty toggle card ─────────────────────────────────────
                  Container(
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      color: isOnDuty ? const Color(0xFF16A34A) : Colors.white,
                      borderRadius: BorderRadius.circular(18),
                      border: Border.all(
                        color: isOnDuty
                            ? const Color(0xFF16A34A)
                            : const Color(0xFFE5E7EB),
                      ),
                    ),
                    child: Column(
                      children: [
                        Icon(
                          isOnDuty
                              ? Icons.electric_moped
                              : Icons.electric_moped_outlined,
                          size: 52,
                          color: isOnDuty
                              ? Colors.white
                              : const Color(0xFF94A3B8),
                        ),
                        const SizedBox(height: 10),
                        Text(
                          isOnDuty ? 'You are On Duty' : 'You are Off Duty',
                          style: TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.w800,
                            color: isOnDuty
                                ? Colors.white
                                : const Color(0xFF0F172A),
                          ),
                        ),
                        if (isOnDuty) ...[
                          const SizedBox(height: 4),
                          const Text(
                            'Listening for new orders...',
                            style: TextStyle(
                              color: Colors.white70,
                              fontSize: 13,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            'Duration: ${_duration(_activeShift?['start_time'] as String?, null)}',
                            style: const TextStyle(
                              color: Colors.white60,
                              fontSize: 12,
                            ),
                          ),
                        ],
                        const SizedBox(height: 16),
                        _toggling
                            ? const CircularProgressIndicator(
                                color: Colors.white,
                              )
                            : SizedBox(
                                width: double.infinity,
                                child: isOnDuty
                                    ? OutlinedButton(
                                        onPressed: _endShift,
                                        style: OutlinedButton.styleFrom(
                                          foregroundColor: Colors.white,
                                          side: const BorderSide(
                                            color: Colors.white54,
                                          ),
                                          minimumSize: const Size.fromHeight(
                                            48,
                                          ),
                                        ),
                                        child: const Text(
                                          'End Shift',
                                          style: TextStyle(
                                            fontWeight: FontWeight.w700,
                                            fontSize: 16,
                                          ),
                                        ),
                                      )
                                    : FilledButton(
                                        onPressed: _startShift,
                                        child: const Text(
                                          'Start Shift',
                                          style: TextStyle(
                                            fontWeight: FontWeight.w700,
                                            fontSize: 16,
                                          ),
                                        ),
                                      ),
                              ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 20),
                  // ── Shift history ────────────────────────────────────────
                  const Text(
                    'Shift History',
                    style: TextStyle(
                      fontWeight: FontWeight.w700,
                      fontSize: 16,
                      color: Color(0xFF0F172A),
                    ),
                  ),
                  const SizedBox(height: 10),
                  if (_shifts.isEmpty)
                    Container(
                      padding: const EdgeInsets.all(24),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: const Color(0xFFE5E7EB)),
                      ),
                      child: const Column(
                        children: [
                          Icon(
                            Icons.history,
                            size: 40,
                            color: Color(0xFF94A3B8),
                          ),
                          SizedBox(height: 8),
                          Text(
                            'No shifts recorded yet',
                            style: TextStyle(
                              color: Color(0xFF64748B),
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                    )
                  else
                    ...List.generate(_shifts.length, (i) {
                      final s = _shifts[i] as Map<String, dynamic>;
                      final status = (s['status'] ?? 'ended') as String;
                      final isActive = status == 'active';
                      return Container(
                        margin: const EdgeInsets.only(bottom: 10),
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: const Color(0xFFE5E7EB)),
                        ),
                        child: Row(
                          children: [
                            Container(
                              width: 42,
                              height: 42,
                              decoration: BoxDecoration(
                                color: isActive
                                    ? const Color(0xFFECFDF3)
                                    : const Color(0xFFF1F5F9),
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: Icon(
                                isActive ? Icons.timer : Icons.timer_off,
                                color: isActive
                                    ? const Color(0xFF16A34A)
                                    : const Color(0xFF64748B),
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    (s['start_time'] as String?)
                                            ?.split('T')
                                            .first ??
                                        'Unknown',
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w700,
                                      fontSize: 14,
                                    ),
                                  ),
                                  Text(
                                    isActive
                                        ? 'Currently active'
                                        : 'Duration: ${_duration(s['start_time'] as String?, s['end_time'] as String?)}',
                                    style: const TextStyle(
                                      color: Color(0xFF64748B),
                                      fontSize: 12,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 8,
                                vertical: 3,
                              ),
                              decoration: BoxDecoration(
                                color: isActive
                                    ? const Color(0xFFECFDF3)
                                    : const Color(0xFFF1F5F9),
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: Text(
                                status,
                                style: TextStyle(
                                  color: isActive
                                      ? const Color(0xFF16A34A)
                                      : const Color(0xFF64748B),
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ),
                          ],
                        ),
                      );
                    }),
                ],
              ),
            ),
    );
  }
}
