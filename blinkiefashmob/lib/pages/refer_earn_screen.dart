import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../services/api_client.dart';
import '../services/user_session.dart';
import '../widgets/bf_loader.dart';

class ReferEarnScreen extends StatefulWidget {
  const ReferEarnScreen({super.key});

  @override
  State<ReferEarnScreen> createState() => _ReferEarnScreenState();
}

class _ReferEarnScreenState extends State<ReferEarnScreen> {
  final ApiClient _api = ApiClient();
  final TextEditingController _redeemCodeCtrl = TextEditingController();

  bool _loading = true;
  String? _error;
  String? _code;
  int _totalReferrals = 0;
  double _availableReward = 0;
  int _perReferralReward = 50;
  bool _userHasAppliedCode = false;
  bool _redeeming = false;
  String? _redeemError;
  String? _redeemSuccess;

  static const Color _green = Color(0xFF16A34A);

  @override
  void initState() {
    super.initState();
    _load();
    _checkIfUserAppliedCode();
  }

  @override
  void dispose() {
    _redeemCodeCtrl.dispose();
    super.dispose();
  }

  Future<void> _checkIfUserAppliedCode() async {
    final userId = UserSession.instance.userId;
    if (userId == null) return;
    try {
      final response = await _api.fetchUserDetails(userId);
      if (mounted && response['user']?['referred_by'] != null) {
        setState(() => _userHasAppliedCode = true);
      }
    } catch (_) {}
  }

  Future<void> _applyRedeemCode() async {
    final code = _redeemCodeCtrl.text.trim();
    if (code.isEmpty) {
      setState(() => _redeemError = 'Please enter a referral code');
      return;
    }

    setState(() {
      _redeeming = true;
      _redeemError = null;
      _redeemSuccess = null;
    });

    try {
      final userId = UserSession.instance.userId;
      if (userId == null) {
        setState(() => _redeemError = 'Please login first');
        return;
      }

      final res = await _api.applyReferralCode(userId, code);
      if (!mounted) return;

      if (res['success'] == true) {
        setState(() {
          _redeemSuccess = res['message'] ?? 'Code applied successfully!';
          _redeeming = false;
          _userHasAppliedCode = true;
          _redeemCodeCtrl.clear();
        });
        // Reload referral info to update available reward
        await Future.delayed(const Duration(seconds: 1));
        _load();
      } else {
        setState(() {
          _redeemError = res['message'] ?? 'Failed to apply code';
          _redeeming = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _redeemError = 'Connection error. Please try again.';
          _redeeming = false;
        });
      }
    }
  }

  Future<void> _load() async {
    final userId = UserSession.instance.userId;
    if (userId == null || userId.isEmpty) {
      setState(() {
        _loading = false;
        _error = 'Please login to view your referral code.';
      });
      return;
    }

    // Show initial skeleton state immediately
    setState(() => _loading = true);

    try {
      // Fetch with timeout to ensure fast response
      final data = await _api
          .fetchReferralInfo(userId)
          .timeout(
            const Duration(seconds: 8),
            onTimeout: () => {
              'success': false,
              'message': 'Request timed out. Please try again.',
            },
          );

      if (!mounted) return;
      if (data['success'] == true) {
        setState(() {
          _code = data['code']?.toString();
          _totalReferrals = (data['totalReferrals'] as num?)?.toInt() ?? 0;
          _availableReward =
              (data['availableReward'] as num?)?.toDouble() ?? 0.0;
          _perReferralReward =
              (data['perReferralReward'] as num?)?.toInt() ?? 50;
          _loading = false;
        });
      } else {
        setState(() {
          _loading = false;
          _error = data['message']?.toString() ?? 'Failed to load referral.';
        });
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = 'Connection error. Please try again.';
      });
    }
  }

  Future<void> _copy() async {
    if (_code == null) return;
    await Clipboard.setData(ClipboardData(text: _code!));
    if (!mounted) return;
    ScaffoldMessenger.of(context)
      ..removeCurrentSnackBar()
      ..showSnackBar(const SnackBar(content: Text('Referral code copied')));
  }

  void _share() {
    if (_code == null) return;
    final msg =
        'Hey! Use my referral code $_code on BlinkieFash and we both get ₹$_perReferralReward off our next order. Download the app now!';
    Clipboard.setData(ClipboardData(text: msg));
    ScaffoldMessenger.of(context)
      ..removeCurrentSnackBar()
      ..showSnackBar(
        const SnackBar(content: Text('Invite message copied — paste & share!')),
      );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8F9FA),
      appBar: AppBar(
        title: const Text(
          'Refer & Earn',
          style: TextStyle(fontWeight: FontWeight.w700),
        ),
        backgroundColor: Colors.white,
        foregroundColor: const Color(0xFF0F172A),
        elevation: 0,
        surfaceTintColor: Colors.transparent,
      ),
      body: _loading
          ? _buildSkeleton()
          : _error != null
          ? Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Text(
                  _error!,
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: Color(0xFFDC2626)),
                ),
              ),
            )
          : _buildBody(),
    );
  }

  Widget _buildSkeleton() {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // Hero section skeleton
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: Colors.grey[300],
            borderRadius: BorderRadius.circular(18),
          ),
          height: 140,
        ),
        const SizedBox(height: 18),
        Container(height: 14, width: 100, color: Colors.grey[300]),
        const SizedBox(height: 12),
        // Code skeleton
        Container(
          height: 60,
          decoration: BoxDecoration(
            color: Colors.grey[300],
            borderRadius: BorderRadius.circular(14),
          ),
        ),
        const SizedBox(height: 12),
        // Button skeleton
        Container(
          height: 50,
          decoration: BoxDecoration(
            color: Colors.grey[300],
            borderRadius: BorderRadius.circular(12),
          ),
        ),
        const SizedBox(height: 24),
        // Stats skeleton
        Row(
          children: [
            Expanded(
              child: Container(
                height: 100,
                decoration: BoxDecoration(
                  color: Colors.grey[300],
                  borderRadius: BorderRadius.circular(14),
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Container(
                height: 100,
                decoration: BoxDecoration(
                  color: Colors.grey[300],
                  borderRadius: BorderRadius.circular(14),
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildBody() {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [Color(0xFF16A34A), Color(0xFF166534)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(18),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  const Icon(
                    Icons.card_giftcard,
                    color: Colors.white,
                    size: 28,
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      'Give ₹$_perReferralReward, Get ₹$_perReferralReward',
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w800,
                        fontSize: 20,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                'Share your code with friends. When they sign up using it, BOTH of you instantly get ₹$_perReferralReward off your next order.',
                style: const TextStyle(color: Colors.white70, height: 1.4),
              ),
            ],
          ),
        ),
        const SizedBox(height: 18),
        const Text(
          'YOUR REFERRAL CODE',
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w700,
            color: Color(0xFF6B7280),
            letterSpacing: 1.1,
          ),
        ),
        const SizedBox(height: 8),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 18),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: const Color(0xFFE5E7EB)),
          ),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  _code ?? '------',
                  style: const TextStyle(
                    fontSize: 22,
                    letterSpacing: 3,
                    fontWeight: FontWeight.w800,
                    color: Color(0xFF0F172A),
                  ),
                ),
              ),
              IconButton(
                onPressed: _copy,
                icon: const Icon(Icons.copy_rounded, color: _green),
                tooltip: 'Copy',
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        FilledButton.icon(
          style: FilledButton.styleFrom(
            backgroundColor: _green,
            minimumSize: const Size.fromHeight(50),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
          ),
          onPressed: _share,
          icon: const Icon(Icons.share_rounded),
          label: const Text(
            'Share Invite',
            style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
          ),
        ),
        const SizedBox(height: 24),
        // Redeem referral code section
        if (!_userHasAppliedCode)
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: const Color(0xFFF0F9FF),
              border: Border.all(color: const Color(0xFFC7D2FE)),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Row(
                  children: [
                    Icon(Icons.card_giftcard, color: Color(0xFF3B82F6)),
                    SizedBox(width: 8),
                    Text(
                      'Have a Referral Code?',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF1E40AF),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Text(
                  'Redeem a friend\'s code and both of you get ₹$_perReferralReward instantly!',
                  style: const TextStyle(
                    fontSize: 13,
                    color: Color(0xFF4B5563),
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _redeemCodeCtrl,
                  enabled: !_redeeming,
                  textCapitalization: TextCapitalization.characters,
                  decoration: InputDecoration(
                    hintText: 'Enter referral code',
                    hintStyle: const TextStyle(color: Color(0xFFCCCCCC)),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10),
                      borderSide: const BorderSide(color: Color(0xFFE5E7EB)),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10),
                      borderSide: const BorderSide(
                        color: Color(0xFF3B82F6),
                        width: 2,
                      ),
                    ),
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: 14,
                      vertical: 12,
                    ),
                  ),
                ),
                if (_redeemError != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: Text(
                      _redeemError!,
                      style: const TextStyle(
                        color: Color(0xFFC62828),
                        fontSize: 12,
                      ),
                    ),
                  ),
                if (_redeemSuccess != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: Text(
                      _redeemSuccess!,
                      style: const TextStyle(
                        color: _green,
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                const SizedBox(height: 10),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    onPressed: _redeeming ? null : _applyRedeemCode,
                    style: FilledButton.styleFrom(
                      backgroundColor: const Color(0xFF3B82F6),
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10),
                      ),
                    ),
                    child: _redeeming
                        ? const SizedBox(
                            height: 18,
                            width: 18,
                            child: BfSpinner(),
                          )
                        : const Text(
                            'Redeem Code',
                            style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                  ),
                ),
              ],
            ),
          ),
        if (!_userHasAppliedCode) const SizedBox(height: 24),
        Row(
          children: [
            Expanded(
              child: _StatCard(
                label: 'Successful Referrals',
                value: '$_totalReferrals',
                icon: Icons.people_alt_rounded,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _StatCard(
                label: 'Available Reward',
                value: '₹${_availableReward.toStringAsFixed(0)}',
                icon: Icons.account_balance_wallet_rounded,
              ),
            ),
          ],
        ),
        const SizedBox(height: 24),
        const Text(
          'HOW IT WORKS',
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w700,
            color: Color(0xFF6B7280),
            letterSpacing: 1.1,
          ),
        ),
        const SizedBox(height: 8),
        const _Step(
          step: '1',
          title: 'Share your code',
          subtitle: 'Send it to friends & family.',
        ),
        const _Step(
          step: '2',
          title: 'They sign up using your code',
          subtitle: 'They enter it during registration.',
        ),
        _Step(
          step: '3',
          title: 'Both get ₹$_perReferralReward off',
          subtitle: 'Reward is auto-applied at checkout. Use it on any order.',
        ),
      ],
    );
  }
}

class _StatCard extends StatelessWidget {
  const _StatCard({
    required this.label,
    required this.value,
    required this.icon,
  });
  final String label;
  final String value;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE5E7EB)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: const Color(0xFF16A34A)),
          const SizedBox(height: 8),
          Text(
            value,
            style: const TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.w800,
              color: Color(0xFF0F172A),
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: const TextStyle(fontSize: 12, color: Color(0xFF6B7280)),
          ),
        ],
      ),
    );
  }
}

class _Step extends StatelessWidget {
  const _Step({
    required this.step,
    required this.title,
    required this.subtitle,
  });
  final String step;
  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE5E7EB)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          CircleAvatar(
            radius: 14,
            backgroundColor: const Color(0xFFECFDF5),
            child: Text(
              step,
              style: const TextStyle(
                color: Color(0xFF16A34A),
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF0F172A),
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  subtitle,
                  style: const TextStyle(
                    fontSize: 13,
                    color: Color(0xFF6B7280),
                    height: 1.4,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
