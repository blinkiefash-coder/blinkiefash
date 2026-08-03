import 'package:flutter/material.dart';

import '../api_service.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});
  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  final _api = ApiService();
  Map<String, dynamic>? _profile;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    await _api.loadToken();
    final profile = await _api.getProfile();
    if (mounted) {
      setState(() {
        _profile = profile;
        _loading = false;
      });
    }
  }

  Future<void> _logout() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Logout'),
        content: const Text('Are you sure you want to logout?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: FilledButton.styleFrom(
              backgroundColor: const Color(0xFFEF4444),
            ),
            child: const Text('Logout'),
          ),
        ],
      ),
    );
    if (confirmed == true && mounted) {
      await _api.logout();
      if (!mounted) return;
      Navigator.of(context).pushNamedAndRemoveUntil('/login', (_) => false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final name = (_profile?['name'] ?? 'Rider') as String;
    final phone = (_profile?['phone'] ?? '--') as String;
    final vehicle = (_profile?['vehicle_type'] ?? '--') as String;
    final vehicleNo = (_profile?['vehicle_number'] ?? '--') as String;
    final isVerified = _profile?['is_verified'] == true;
    final balRaw = _profile?['earnings_balance'];
    final balance = double.tryParse('$balRaw') ?? 0.0;

    return Scaffold(
      backgroundColor: const Color(0xFFF2FAF4),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        title: const Text(
          'My Profile',
          style: TextStyle(
            fontWeight: FontWeight.w800,
            color: Color(0xFF0F172A),
          ),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout, color: Color(0xFFEF4444)),
            tooltip: 'Logout',
            onPressed: _logout,
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
                  Center(
                    child: Column(
                      children: [
                        Container(
                          width: 88,
                          height: 88,
                          decoration: const BoxDecoration(
                            color: Color(0xFF16A34A),
                            shape: BoxShape.circle,
                          ),
                          child: Center(
                            child: Text(
                              name.isNotEmpty ? name[0].toUpperCase() : 'R',
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 36,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(height: 12),
                        Text(
                          name,
                          style: const TextStyle(
                            fontSize: 22,
                            fontWeight: FontWeight.w800,
                            color: Color(0xFF0F172A),
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          phone,
                          style: const TextStyle(
                            color: Color(0xFF64748B),
                            fontSize: 15,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 12,
                            vertical: 4,
                          ),
                          decoration: BoxDecoration(
                            color: isVerified
                                ? const Color(0xFFECFDF3)
                                : const Color(0xFFFEF9C3),
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(
                              color: isVerified
                                  ? const Color(0xFF86EFAC)
                                  : const Color(0xFFFDE68A),
                            ),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(
                                isVerified
                                    ? Icons.verified
                                    : Icons.info_outline,
                                size: 14,
                                color: isVerified
                                    ? const Color(0xFF16A34A)
                                    : const Color(0xFFD97706),
                              ),
                              const SizedBox(width: 4),
                              Text(
                                isVerified
                                    ? 'Verified'
                                    : 'Pending Verification',
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600,
                                  color: isVerified
                                      ? const Color(0xFF16A34A)
                                      : const Color(0xFFD97706),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 20),
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [Color(0xFF16A34A), Color(0xFF15803D)],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: Row(
                      children: [
                        const Icon(
                          Icons.account_balance_wallet_outlined,
                          color: Colors.white70,
                          size: 28,
                        ),
                        const SizedBox(width: 12),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'Earnings Balance',
                              style: TextStyle(
                                color: Colors.white70,
                                fontSize: 12,
                              ),
                            ),
                            Text(
                              '\u20B9${balance.toStringAsFixed(2)}',
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 22,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                  _Section(
                    title: 'Vehicle Details',
                    items: [
                      _InfoRow(
                        Icons.directions_bike_outlined,
                        'Vehicle Type',
                        vehicle,
                      ),
                      _InfoRow(Icons.pin_outlined, 'Vehicle Number', vehicleNo),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFEF9C3),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xFFFDE68A)),
                    ),
                    child: const Row(
                      children: [
                        Icon(Icons.info_outline, color: Color(0xFFD97706)),
                        SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            'Please visit our office with your original driving license to complete verification.',
                            style: TextStyle(
                              color: Color(0xFF92400E),
                              fontSize: 13,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 24),
                  FilledButton.icon(
                    onPressed: _logout,
                    icon: const Icon(Icons.logout),
                    label: const Text('Logout'),
                    style: FilledButton.styleFrom(
                      backgroundColor: const Color(0xFFEF4444),
                      minimumSize: const Size.fromHeight(50),
                    ),
                  ),
                ],
              ),
            ),
    );
  }
}

class _Section extends StatelessWidget {
  const _Section({required this.title, required this.items});
  final String title;
  final List<Widget> items;

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
          Text(
            title,
            style: const TextStyle(
              fontWeight: FontWeight.w700,
              fontSize: 14,
              color: Color(0xFF0F172A),
            ),
          ),
          const SizedBox(height: 10),
          ...items,
        ],
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow(this.icon, this.label, this.value);
  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          Icon(icon, size: 18, color: const Color(0xFF16A34A)),
          const SizedBox(width: 10),
          Text(
            label,
            style: const TextStyle(color: Color(0xFF64748B), fontSize: 13),
          ),
          const Spacer(),
          Text(
            value,
            style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
          ),
        ],
      ),
    );
  }
}
