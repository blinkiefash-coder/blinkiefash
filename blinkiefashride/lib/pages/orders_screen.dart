import 'package:flutter/material.dart';

import '../api_service.dart';
import 'navigation_screen.dart';

class OrdersScreen extends StatefulWidget {
  const OrdersScreen({super.key});
  @override
  State<OrdersScreen> createState() => _OrdersScreenState();
}

class _OrdersScreenState extends State<OrdersScreen>
    with SingleTickerProviderStateMixin {
  final _api = ApiService();
  late TabController _tab;
  List<dynamic> _deliveries = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _tab = TabController(length: 2, vsync: this);
    _load();
  }

  @override
  void dispose() {
    _tab.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    await _api.loadToken();
    final deliveries = await _api.getDeliveries();
    if (mounted) {
      setState(() {
        _deliveries = deliveries;
        _loading = false;
      });
    }
  }

  List<dynamic> get _active => _deliveries
      .where(
        (d) => !['completed', 'cancelled', 'returned'].contains(d['status']),
      )
      .toList();

  List<dynamic> get _past => _deliveries
      .where(
        (d) =>
            d['status'] == 'completed' ||
            d['status'] == 'cancelled' ||
            d['status'] == 'returned',
      )
      .toList();

  Color _statusColor(String status) {
    if (status == 'completed') return const Color(0xFF16A34A);
    if (status == 'cancelled') return const Color(0xFFEF4444);
    if (status == 'arrived') return const Color(0xFF7C3AED);
    return const Color(0xFF2563EB);
  }

  Color _statusBg(String status) {
    if (status == 'completed') return const Color(0xFFECFDF3);
    if (status == 'cancelled') return const Color(0xFFFEF2F2);
    if (status == 'arrived') return const Color(0xFFF5F3FF);
    return const Color(0xFFEFF6FF);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF2FAF4),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        title: const Text(
          'My Deliveries',
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
          tabs: [
            Tab(text: 'Active (${_active.length})'),
            Tab(text: 'Past (${_past.length})'),
          ],
        ),
      ),
      body: _loading
          ? const Center(
              child: CircularProgressIndicator(color: Color(0xFF16A34A)),
            )
          : RefreshIndicator(
              color: const Color(0xFF16A34A),
              onRefresh: _load,
              child: TabBarView(
                controller: _tab,
                children: [
                  _buildList(_active, isActive: true),
                  _buildList(_past, isActive: false),
                ],
              ),
            ),
    );
  }

  Widget _buildList(List<dynamic> list, {required bool isActive}) {
    if (list.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.delivery_dining_outlined,
              size: 56,
              color: Colors.grey.shade400,
            ),
            const SizedBox(height: 10),
            Text(
              isActive ? 'No active deliveries' : 'No past deliveries',
              style: const TextStyle(
                color: Color(0xFF64748B),
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      );
    }
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: list.length,
      itemBuilder: (context, i) {
        final d = list[i];
        final status = (d['status'] ?? 'unknown') as String;
        final id = (d['id'] ?? '') as String;
        final shortId = id.length > 8
            ? '#${id.substring(0, 8).toUpperCase()}'
            : '#$id';
        return Container(
          margin: const EdgeInsets.only(bottom: 10),
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFFE5E7EB)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Text(
                    shortId,
                    style: const TextStyle(fontWeight: FontWeight.w800),
                  ),
                  const Spacer(),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 4,
                    ),
                    decoration: BoxDecoration(
                      color: _statusBg(status),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      status,
                      style: TextStyle(
                        color: _statusColor(status),
                        fontWeight: FontWeight.w700,
                        fontSize: 12,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  const Icon(
                    Icons.local_shipping_outlined,
                    color: Color(0xFF64748B),
                    size: 16,
                  ),
                  const SizedBox(width: 6),
                  Text(
                    'Fee: \u20B9${d["delivery_fee"] ?? "--"}',
                    style: const TextStyle(
                      color: Color(0xFF64748B),
                      fontSize: 13,
                    ),
                  ),
                  const Spacer(),
                  Text(
                    '${d["distance"] ?? "--"} km',
                    style: const TextStyle(
                      color: Color(0xFF64748B),
                      fontSize: 13,
                    ),
                  ),
                ],
              ),
              if (isActive) ...[
                const SizedBox(height: 10),
                // Show order status from store
                if ((d['order_status'] ?? '').toString().isNotEmpty)
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 5,
                    ),
                    margin: const EdgeInsets.only(bottom: 8),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFFF7ED),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Row(
                      children: [
                        const Icon(
                          Icons.store_outlined,
                          size: 14,
                          color: Color(0xFFF97316),
                        ),
                        const SizedBox(width: 6),
                        Text(
                          'Store: ${(d["order_status"] ?? "").toString().replaceAll("_", " ").toUpperCase()}',
                          style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: Color(0xFFEA580C),
                          ),
                        ),
                      ],
                    ),
                  ),
                // Show items
                if ((d['items'] as List?)?.isNotEmpty == true) ...[
                  ...((d['items'] as List)
                      .take(3)
                      .map(
                        (it) => Padding(
                          padding: const EdgeInsets.only(bottom: 2),
                          child: Text(
                            '• ${it["name"]} (${it["size"] ?? ""} ${it["color"] ?? ""})',
                            style: const TextStyle(
                              fontSize: 12,
                              color: Color(0xFF374151),
                            ),
                          ),
                        ),
                      )),
                  const SizedBox(height: 6),
                ],
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: () {
                          Navigator.of(context).push(
                            MaterialPageRoute<void>(
                              builder: (_) => NavigationScreen(
                                order: d as Map<String, dynamic>,
                                deliveryId: (d['id'] ?? '') as String,
                              ),
                            ),
                          );
                        },
                        icon: const Icon(Icons.navigation, size: 16),
                        label: const Text('Navigate'),
                        style: OutlinedButton.styleFrom(
                          minimumSize: const Size(0, 38),
                          side: const BorderSide(color: Color(0xFF16A34A)),
                          foregroundColor: const Color(0xFF16A34A),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: FilledButton(
                        onPressed: () async {
                          final newStatus = status == 'assigned'
                              ? 'picked'
                              : 'completed';
                          await _api.updateDeliveryStatus(id, newStatus);
                          if (mounted) _load();
                        },
                        style: FilledButton.styleFrom(
                          minimumSize: const Size(0, 38),
                          backgroundColor: const Color(0xFF16A34A),
                        ),
                        child: Text(
                          status == 'assigned' ? 'Picked Up' : 'Delivered',
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ],
          ),
        );
      },
    );
  }
}
