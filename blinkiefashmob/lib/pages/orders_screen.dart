import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';

import '../services/api_client.dart';
import '../services/user_session.dart';
import '../api_base.dart';
import 'order_detail_screen.dart';
import '../widgets/bf_loader.dart';

class OrdersScreen extends StatefulWidget {
  const OrdersScreen({super.key});

  @override
  State<OrdersScreen> createState() => _OrdersScreenState();
}

class _OrdersScreenState extends State<OrdersScreen> {
  final _api = ApiClient();
  List<dynamic> _orders = const [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final userId = UserSession.instance.userId;
    if (userId == null) {
      setState(() {
        _loading = false;
        _error = 'Please log in to view orders.';
      });
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    final orders = await _api.fetchUserOrders(userId);
    if (!mounted) return;
    setState(() {
      _orders = orders;
      _loading = false;
    });
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  String _shortId(String id) =>
      'BLF${id.replaceAll('-', '').substring(0, 10).toUpperCase()}';

  String _fmtDate(String? iso) {
    if (iso == null) return '';
    final dt = DateTime.tryParse(iso)?.toLocal();
    if (dt == null) return '';
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    return '${dt.day} ${months[dt.month - 1]} ${dt.year}';
  }

  Color _badgeColor(String status) {
    switch (status) {
      case 'delivered':
      case 'completed':
        return const Color(0xFF16A34A);
      case 'cancelled':
        return const Color(0xFFEF4444);
      case 'out_for_delivery':
      case 'picked':
        return const Color(0xFFF97316);
      default:
        return const Color(0xFF2563EB);
    }
  }

  String _badgeLabel(String status) => status
      .replaceAll('_', ' ')
      .split(' ')
      .map((w) => w.isEmpty ? '' : '${w[0].toUpperCase()}${w.substring(1)}')
      .join(' ');

  String? _resolveImageUrl(dynamic raw) {
    final value = raw?.toString().trim();
    if (value == null || value.isEmpty) return null;
    if (value.startsWith('http://') || value.startsWith('https://')) {
      return value;
    }
    if (value.startsWith('/')) return '$apiBaseUrl$value';
    return '$apiBaseUrl/$value';
  }

  // ── Build ──────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8F9FA),
      appBar: AppBar(
        backgroundColor: Colors.white,
        foregroundColor: const Color(0xFF0F172A),
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        title: const Text(
          'My Orders',
          style: TextStyle(fontWeight: FontWeight.w700),
        ),
      ),
      body: RefreshIndicator(
        color: const Color(0xFF22C55E),
        backgroundColor: const Color(0xFF0D2015),
        strokeWidth: 2.5,
        onRefresh: _load,
        child: _buildBody(),
      ),
    );
  }

  Widget _buildBody() {
    if (_loading) {
      return const BfPageLoader(message: 'Loading your orders...');
    }
    if (_error != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Text(
            _error!,
            textAlign: TextAlign.center,
            style: const TextStyle(color: Color(0xFF6B7280)),
          ),
        ),
      );
    }
    if (_orders.isEmpty) {
      return ListView(
        children: [
          const SizedBox(height: 80),
          const Icon(
            Icons.receipt_long_outlined,
            size: 72,
            color: Color(0xFFD1D5DB),
          ),
          const SizedBox(height: 16),
          const Text(
            'No orders yet',
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w700,
              color: Color(0xFF374151),
            ),
          ),
          const SizedBox(height: 8),
          const Text(
            'Your placed orders will appear here',
            textAlign: TextAlign.center,
            style: TextStyle(color: Color(0xFF6B7280)),
          ),
        ],
      );
    }
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: _orders.length,
      itemBuilder: (_, i) => _orderCard(_orders[i] as Map<String, dynamic>),
    );
  }

  Widget _orderCard(Map<String, dynamic> order) {
    final status = (order['status'] ?? 'placed').toString();
    final cancelReason = (order['cancel_reason'] ?? '').toString().trim();
    final items = (order['items'] as List?) ?? [];
    final total =
        double.tryParse(
          order['final_amount']?.toString() ??
              order['total_amount']?.toString() ??
              '0',
        ) ??
        0;
    final firstItem = items.isNotEmpty ? items.first as Map : null;
    final firstImage = _resolveImageUrl(
      firstItem?['image'] ?? firstItem?['image_url'] ?? firstItem?['url'],
    );
    final badgeColor = _badgeColor(status);

    return GestureDetector(
      onTap: () => Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) => OrderDetailScreen(orderId: order['id'].toString()),
        ),
      ),
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: const Color(0xFFE5E7EB)),
        ),
        child: Column(
          children: [
            Row(
              children: [
                // Product thumbnail
                ClipRRect(
                  borderRadius: BorderRadius.circular(10),
                  child: firstImage != null && firstImage.isNotEmpty
                      ? CachedNetworkImage(
                          imageUrl: firstImage,
                          width: 60,
                          height: 60,
                          fit: BoxFit.cover,
                          placeholder: (ctx, url) => Container(
                            width: 60,
                            height: 60,
                            color: const Color(0xFFF1F5F9),
                          ),
                          errorWidget: (ctx, url, err) => Container(
                            width: 60,
                            height: 60,
                            color: const Color(0xFFF1F5F9),
                            child: const Icon(Icons.image_outlined),
                          ),
                        )
                      : Container(
                          width: 60,
                          height: 60,
                          color: const Color(0xFFF1F5F9),
                          child: const Icon(
                            Icons.image_outlined,
                            color: Color(0xFFCBD5E1),
                          ),
                        ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '#${_shortId(order['id'].toString())}',
                        style: const TextStyle(
                          fontWeight: FontWeight.w700,
                          fontSize: 13,
                          color: Color(0xFF0F172A),
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        '${items.length} item${items.length == 1 ? '' : 's'} · ${_fmtDate(order['created_at']?.toString())}',
                        style: const TextStyle(
                          color: Color(0xFF6B7280),
                          fontSize: 12,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 3,
                        ),
                        decoration: BoxDecoration(
                          color: badgeColor.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Text(
                          _badgeLabel(status),
                          style: TextStyle(
                            color: badgeColor,
                            fontWeight: FontWeight.w600,
                            fontSize: 11,
                          ),
                        ),
                      ),
                      if (status == 'cancelled' && cancelReason.isNotEmpty) ...[
                        const SizedBox(height: 6),
                        Text(
                          'Reason: $cancelReason',
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            color: Color(0xFFB91C1C),
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      '₹${total.toStringAsFixed(0)}',
                      style: const TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 16,
                      ),
                    ),
                    const SizedBox(height: 8),
                    const Icon(Icons.chevron_right, color: Color(0xFF9CA3AF)),
                  ],
                ),
              ],
            ),
            if (items.length > 1) ...[
              const SizedBox(height: 10),
              const Divider(height: 1, color: Color(0xFFF1F5F9)),
              const SizedBox(height: 8),
              Row(
                children: [
                  const Icon(
                    Icons.inventory_2_outlined,
                    size: 14,
                    color: Color(0xFF9CA3AF),
                  ),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      items
                          .map(
                            (i) => (i as Map)['product_name']?.toString() ?? '',
                          )
                          .join(', '),
                      style: const TextStyle(
                        fontSize: 12,
                        color: Color(0xFF6B7280),
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}
