import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

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

  // Show dialog for rider to enter store pickup OTP
  void _showStoreOtpDialog(BuildContext context, String deliveryId) {
    final otpController = TextEditingController();
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        title: const Text('Store Pickup OTP'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text(
              'Enter the 4-digit OTP given by the store staff',
              style: TextStyle(fontSize: 13, color: Color(0xFF64748B)),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: otpController,
              keyboardType: TextInputType.number,
              maxLength: 4,
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.bold,
                letterSpacing: 8,
              ),
              decoration: InputDecoration(
                hintText: '0000',
                counterText: '',
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                  borderSide: const BorderSide(
                    color: Color(0xFF16A34A),
                    width: 2,
                  ),
                ),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () async {
              final otp = otpController.text.trim();
              if (otp.length != 4) {
                ScaffoldMessenger.of(ctx).showSnackBar(
                  const SnackBar(content: Text('Enter valid 4-digit OTP')),
                );
                return;
              }
              Navigator.pop(ctx);

              // Verify OTP with backend
              final result = await _api.verifyStoreOtp(deliveryId, otp);
              if (result['success'] == true) {
                // OTP verified, update status to picked
                await _api.updateDeliveryStatus(deliveryId, 'picked');
                if (mounted) {
                  _load();
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('✓ Pickup confirmed. Proceed to customer'),
                      backgroundColor: Color(0xFF16A34A),
                    ),
                  );
                }
              } else {
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text(
                        '❌ ${result['message'] ?? 'OTP verification failed'}',
                      ),
                      backgroundColor: Colors.red,
                    ),
                  );
                }
              }
            },
            style: FilledButton.styleFrom(
              backgroundColor: const Color(0xFF16A34A),
            ),
            child: const Text('Verify'),
          ),
        ],
      ),
    );
  }

  // Open location in Google Maps
  Future<void> _openMaps(double? lat, double? lng, String name) async {
    if (lat == null || lng == null) return;
    final googleUrl = 'https://maps.google.com/maps?q=$lat,$lng';
    try {
      await launchUrl(Uri.parse(googleUrl), mode: LaunchMode.externalApplication);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Could not open maps: $e')),
        );
      }
    }
  }

  // Make phone call
  Future<void> _makeCall(String? phone) async {
    if (phone == null || phone.isEmpty) return;
    final uri = Uri(scheme: 'tel', path: phone);
    try {
      await launchUrl(uri);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Could not make call: $e')),
        );
      }
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
                // Vendor location (when assigned)
                if (status == 'assigned') ...[
                  Container(
                    padding: const EdgeInsets.all(10),
                    margin: const EdgeInsets.only(bottom: 8),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF0F9FF),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: const Color(0xFFBFDBFE)),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Row(
                          children: [
                            Icon(
                              Icons.store_outlined,
                              size: 16,
                              color: Color(0xFF0369A1),
                            ),
                            SizedBox(width: 6),
                            Text(
                              'Pick Up From',
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                                color: Color(0xFF0369A1),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 6),
                        if ((d['store_name'] as String?)?.isNotEmpty == true)
                          Text(
                            d['store_name'] ?? '',
                            style: const TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              color: Color(0xFF1E293B),
                            ),
                          ),
                        if ((d['vendor_address'] as String?)?.isNotEmpty == true)
                          Padding(
                            padding: const EdgeInsets.only(top: 4),
                            child: Text(
                              d['vendor_address'] ?? '',
                              style: const TextStyle(
                                fontSize: 12,
                                color: Color(0xFF64748B),
                              ),
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        const SizedBox(height: 8),
                        Row(
                          children: [
                            Expanded(
                              child: GestureDetector(
                                onTap: () => _openMaps(
                                  d['vendor_lat'] as double?,
                                  d['vendor_lng'] as double?,
                                  d['store_name'] ?? 'Store',
                                ),
                                child: Container(
                                  padding: const EdgeInsets.symmetric(
                                    vertical: 6,
                                    horizontal: 8,
                                  ),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFE0F2FE),
                                    borderRadius: BorderRadius.circular(6),
                                  ),
                                  child: const Row(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: [
                                      Icon(
                                        Icons.location_on_outlined,
                                        size: 14,
                                        color: Color(0xFF0369A1),
                                      ),
                                      SizedBox(width: 4),
                                      Text(
                                        'Map',
                                        style: TextStyle(
                                          fontSize: 12,
                                          fontWeight: FontWeight.w600,
                                          color: Color(0xFF0369A1),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: GestureDetector(
                                onTap: () => _makeCall(d['vendor_phone'] as String?),
                                child: Container(
                                  padding: const EdgeInsets.symmetric(
                                    vertical: 6,
                                    horizontal: 8,
                                  ),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFE0F2FE),
                                    borderRadius: BorderRadius.circular(6),
                                  ),
                                  child: const Row(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: [
                                      Icon(
                                        Icons.call_outlined,
                                        size: 14,
                                        color: Color(0xFF0369A1),
                                      ),
                                      SizedBox(width: 4),
                                      Text(
                                        'Call',
                                        style: TextStyle(
                                          fontSize: 12,
                                          fontWeight: FontWeight.w600,
                                          color: Color(0xFF0369A1),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
                // Customer location (when picked or later)
                if (status != 'assigned') ...[
                  Container(
                    padding: const EdgeInsets.all(10),
                    margin: const EdgeInsets.only(bottom: 8),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF0FDF4),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: const Color(0xFFBBF7D0)),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Row(
                          children: [
                            Icon(
                              Icons.person_outlined,
                              size: 16,
                              color: Color(0xFF16A34A),
                            ),
                            SizedBox(width: 6),
                            Text(
                              'Deliver To',
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                                color: Color(0xFF16A34A),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 6),
                        if ((d['customer_name'] as String?)?.isNotEmpty == true)
                          Text(
                            d['customer_name'] ?? '',
                            style: const TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              color: Color(0xFF1E293B),
                            ),
                          ),
                        if ((d['delivery_address'] as String?)?.isNotEmpty == true)
                          Padding(
                            padding: const EdgeInsets.only(top: 4),
                            child: Text(
                              d['delivery_address'] ?? '',
                              style: const TextStyle(
                                fontSize: 12,
                                color: Color(0xFF64748B),
                              ),
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        const SizedBox(height: 8),
                        Row(
                          children: [
                            Expanded(
                              child: GestureDetector(
                                onTap: () => _openMaps(
                                  d['customer_lat'] as double?,
                                  d['customer_lng'] as double?,
                                  d['customer_name'] ?? 'Customer',
                                ),
                                child: Container(
                                  padding: const EdgeInsets.symmetric(
                                    vertical: 6,
                                    horizontal: 8,
                                  ),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFDCFCE7),
                                    borderRadius: BorderRadius.circular(6),
                                  ),
                                  child: const Row(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: [
                                      Icon(
                                        Icons.location_on_outlined,
                                        size: 14,
                                        color: Color(0xFF16A34A),
                                      ),
                                      SizedBox(width: 4),
                                      Text(
                                        'Map',
                                        style: TextStyle(
                                          fontSize: 12,
                                          fontWeight: FontWeight.w600,
                                          color: Color(0xFF16A34A),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: GestureDetector(
                                onTap: () => _makeCall(d['customer_phone'] as String?),
                                child: Container(
                                  padding: const EdgeInsets.symmetric(
                                    vertical: 6,
                                    horizontal: 8,
                                  ),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFDCFCE7),
                                    borderRadius: BorderRadius.circular(6),
                                  ),
                                  child: const Row(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: [
                                      Icon(
                                        Icons.call_outlined,
                                        size: 14,
                                        color: Color(0xFF16A34A),
                                      ),
                                      SizedBox(width: 4),
                                      Text(
                                        'Call',
                                        style: TextStyle(
                                          fontSize: 12,
                                          fontWeight: FontWeight.w600,
                                          color: Color(0xFF16A34A),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
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
                          if (status == 'assigned') {
                            // Step 1: Mark as arrived at store → generates store OTP
                            await _api.storeArrived(id);
                            // Step 2: Show OTP entry dialog
                            if (mounted) {
                              _showStoreOtpDialog(context, id);
                            }
                          } else if (status == 'picked') {
                            // From "picked" to "completed" after delivery
                            // This will be updated after delivery OTP verification
                            await _api.updateDeliveryStatus(id, 'completed');
                            if (mounted) _load();
                          }
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
