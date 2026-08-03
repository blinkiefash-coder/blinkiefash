import 'package:flutter/material.dart';

import '../api_service.dart';

class EarningsScreen extends StatefulWidget {
  const EarningsScreen({super.key});

  @override
  State<EarningsScreen> createState() => _EarningsScreenState();
}

class _EarningsScreenState extends State<EarningsScreen> {
  final _api = ApiService();
  List<dynamic> _payouts = [];
  double _balance = 0;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    await _api.loadToken();
    final data = await _api.getEarnings();
    if (mounted) {
      setState(() {
        _payouts = data['payouts'] ?? [];
        _balance = double.tryParse('${data['balance'] ?? 0}') ?? 0;
        _loading = false;
      });
    }
  }

  Future<void> _requestPayout() async {
    final ctrl = TextEditingController();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Request Payout'),
        content: TextField(
          controller: ctrl,
          keyboardType: TextInputType.number,
          decoration: const InputDecoration(
            labelText: 'Amount (₹)',
            prefixText: '₹',
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: FilledButton.styleFrom(
              backgroundColor: const Color(0xFF16A34A),
            ),
            child: const Text('Request'),
          ),
        ],
      ),
    );
    if (confirmed == true && ctrl.text.isNotEmpty) {
      final amount = double.tryParse(ctrl.text);
      if (amount != null && amount > 0) {
        final ok = await _api.requestPayout(amount);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(
                ok
                    ? 'Payout requested successfully'
                    : 'Failed to request payout',
              ),
            ),
          );
          if (ok) _load();
        }
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF2FAF4),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        title: const Text(
          'My Earnings',
          style: TextStyle(
            fontWeight: FontWeight.w800,
            color: Color(0xFF0F172A),
          ),
        ),
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
                  // Balance card
                  Container(
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [Color(0xFF16A34A), Color(0xFF15803D)],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      borderRadius: BorderRadius.circular(18),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Earnings Balance',
                          style: TextStyle(color: Colors.white70, fontSize: 13),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          '₹${_balance.toStringAsFixed(2)}',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 36,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                        const SizedBox(height: 16),
                        SizedBox(
                          width: double.infinity,
                          child: OutlinedButton(
                            onPressed: _requestPayout,
                            style: OutlinedButton.styleFrom(
                              foregroundColor: Colors.white,
                              side: const BorderSide(color: Colors.white54),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(10),
                              ),
                            ),
                            child: const Text(
                              'Request Payout',
                              style: TextStyle(fontWeight: FontWeight.w700),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 20),
                  const Text(
                    'Payout History',
                    style: TextStyle(
                      fontWeight: FontWeight.w700,
                      fontSize: 16,
                      color: Color(0xFF0F172A),
                    ),
                  ),
                  const SizedBox(height: 10),
                  if (_payouts.isEmpty)
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
                            Icons.account_balance_wallet_outlined,
                            size: 40,
                            color: Color(0xFF94A3B8),
                          ),
                          SizedBox(height: 8),
                          Text(
                            'No payouts yet',
                            style: TextStyle(
                              color: Color(0xFF64748B),
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                    )
                  else
                    ...List.generate(_payouts.length, (i) {
                      final p = _payouts[i];
                      final status = p['status'] ?? 'pending';
                      final isSuccess = status == 'completed';
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
                                color: isSuccess
                                    ? const Color(0xFFECFDF3)
                                    : const Color(0xFFFEF9C3),
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: Icon(
                                isSuccess
                                    ? Icons.check_circle_outline
                                    : Icons.hourglass_empty,
                                color: isSuccess
                                    ? const Color(0xFF16A34A)
                                    : const Color(0xFFD97706),
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    'Payout #\${i + 1}',
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w700,
                                      fontSize: 14,
                                    ),
                                  ),
                                  Text(
                                    p['payout_date']
                                            ?.toString()
                                            .split('T')
                                            .first ??
                                        '',
                                    style: const TextStyle(
                                      color: Color(0xFF64748B),
                                      fontSize: 12,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.end,
                              children: [
                                Text(
                                  '\u20B9${p['amount']}',
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w800,
                                    fontSize: 16,
                                  ),
                                ),
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 8,
                                    vertical: 2,
                                  ),
                                  decoration: BoxDecoration(
                                    color: isSuccess
                                        ? const Color(0xFFECFDF3)
                                        : const Color(0xFFFEF9C3),
                                    borderRadius: BorderRadius.circular(10),
                                  ),
                                  child: Text(
                                    status,
                                    style: TextStyle(
                                      color: isSuccess
                                          ? const Color(0xFF16A34A)
                                          : const Color(0xFFD97706),
                                      fontSize: 11,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                ),
                              ],
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

class _EarningsTabView extends StatefulWidget {
  const _EarningsTabView();

  @override
  State<_EarningsTabView> createState() => _EarningsTabViewState();
}

class _EarningsTabViewState extends State<_EarningsTabView>
    with SingleTickerProviderStateMixin {
  late TabController _tab;

  final _daily = [
    _EarningsRow('Base Fare', '₹950.00'),
    _EarningsRow('Tips', '₹150.00'),
    _EarningsRow('Incentives', '₹100.00'),
    _EarningsRow('Adjustments', '-₹0.00'),
  ];

  @override
  void initState() {
    super.initState();
    _tab = TabController(length: 3, vsync: this);
  }

  @override
  void dispose() {
    _tab.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF2FAF4),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        title: const Text(
          'My Earnings',
          style: TextStyle(
            fontWeight: FontWeight.w800,
            color: Color(0xFF0F172A),
          ),
        ),
        bottom: TabBar(
          controller: _tab,
          labelColor: const Color(0xFF16A34A),
          unselectedLabelColor: const Color(0xFF64748B),
          indicatorColor: const Color(0xFF16A34A),
          tabs: const [
            Tab(text: 'Daily'),
            Tab(text: 'Weekly'),
            Tab(text: 'Monthly'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tab,
        children: [
          _EarningsTab(rows: _daily, total: '₹1,200.00', period: 'Today'),
          _EarningsTab(rows: _daily, total: '₹7,850.00', period: 'This Week'),
          _EarningsTab(rows: _daily, total: '₹31,200.00', period: 'This Month'),
        ],
      ),
    );
  }
}

class _EarningsTab extends StatelessWidget {
  const _EarningsTab({
    required this.rows,
    required this.total,
    required this.period,
  });

  final List<_EarningsRow> rows;
  final String total;
  final String period;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // Date nav
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            IconButton(onPressed: () {}, icon: const Icon(Icons.chevron_left)),
            const Text(
              'Mon, 14 Jul 2025',
              style: TextStyle(fontWeight: FontWeight.w700),
            ),
            IconButton(onPressed: () {}, icon: const Icon(Icons.chevron_right)),
          ],
        ),
        const SizedBox(height: 8),
        // Total card
        Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [Color(0xFF16A34A), Color(0xFF15803D)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(18),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Total Earnings ($period)',
                style: const TextStyle(color: Colors.white70, fontSize: 13),
              ),
              const SizedBox(height: 4),
              Text(
                total,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 34,
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(height: 6),
              const Row(
                children: [
                  Icon(
                    Icons.local_shipping_outlined,
                    color: Colors.white70,
                    size: 16,
                  ),
                  SizedBox(width: 6),
                  Text(
                    '9 deliveries completed',
                    style: TextStyle(color: Colors.white70, fontSize: 13),
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        // Bar chart
        Container(
          height: 160,
          padding: const EdgeInsets.fromLTRB(12, 12, 12, 4),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
          ),
          child: CustomPaint(
            painter: _BarChartPainter([180, 230, 150, 280, 200, 260, 300]),
            child: Container(),
          ),
        ),
        const SizedBox(height: 4),
        const Padding(
          padding: EdgeInsets.symmetric(horizontal: 4),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              Text(
                'M',
                style: TextStyle(color: Color(0xFF94A3B8), fontSize: 11),
              ),
              Text(
                'T',
                style: TextStyle(color: Color(0xFF94A3B8), fontSize: 11),
              ),
              Text(
                'W',
                style: TextStyle(color: Color(0xFF94A3B8), fontSize: 11),
              ),
              Text(
                'T',
                style: TextStyle(color: Color(0xFF94A3B8), fontSize: 11),
              ),
              Text(
                'F',
                style: TextStyle(color: Color(0xFF94A3B8), fontSize: 11),
              ),
              Text(
                'S',
                style: TextStyle(color: Color(0xFF94A3B8), fontSize: 11),
              ),
              Text(
                'S',
                style: TextStyle(color: Color(0xFF94A3B8), fontSize: 11),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        // Breakdown table
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Earnings Breakdown',
                style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15),
              ),
              const SizedBox(height: 12),
              ...rows.map(
                (r) => Padding(
                  padding: const EdgeInsets.symmetric(vertical: 6),
                  child: Row(
                    children: [
                      Text(
                        r.label,
                        style: const TextStyle(color: Color(0xFF64748B)),
                      ),
                      const Spacer(),
                      Text(
                        r.value,
                        style: const TextStyle(fontWeight: FontWeight.w700),
                      ),
                    ],
                  ),
                ),
              ),
              const Divider(height: 20),
              Row(
                children: [
                  const Text(
                    'Total',
                    style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
                  ),
                  const Spacer(),
                  Text(
                    total,
                    style: const TextStyle(
                      fontWeight: FontWeight.w900,
                      fontSize: 18,
                      color: Color(0xFF16A34A),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _EarningsRow {
  final String label;
  final String value;
  const _EarningsRow(this.label, this.value);
}

class _BarChartPainter extends CustomPainter {
  final List<double> values;
  const _BarChartPainter(this.values);

  @override
  void paint(Canvas canvas, Size size) {
    final max = values.reduce((a, b) => a > b ? a : b);
    final barWidth = (size.width - 20) / values.length;
    final paint = Paint()
      ..color = const Color(0xFF16A34A)
      ..style = PaintingStyle.fill;

    for (var i = 0; i < values.length; i++) {
      final ratio = values[i] / max;
      final barH = ratio * (size.height - 10);
      final left = 10 + i * barWidth + 6;
      final rect = Rect.fromLTWH(
        left,
        size.height - barH - 4,
        barWidth - 12,
        barH,
      );
      canvas.drawRRect(
        RRect.fromRectAndRadius(rect, const Radius.circular(6)),
        paint,
      );
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
