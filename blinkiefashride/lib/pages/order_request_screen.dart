import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

class OrderRequestScreen extends StatefulWidget {
  const OrderRequestScreen({super.key, this.delivery});

  /// If provided, shows real delivery data. Otherwise shows a preview.
  final Map<String, dynamic>? delivery;

  @override
  State<OrderRequestScreen> createState() => _OrderRequestScreenState();
}

class _OrderRequestScreenState extends State<OrderRequestScreen>
    with SingleTickerProviderStateMixin {
  late AnimationController _timerController;
  int _seconds = 25;

  @override
  void initState() {
    super.initState();
    // Play Uber-like alarm when order request arrives
    // FlutterRingtonePlayer API requires investigation for v4.0.0
    // Temporarily disabled to get app running
    HapticFeedback.vibrate();
    _timerController =
        AnimationController(vsync: this, duration: const Duration(seconds: 25))
          ..addListener(() {
            if (!mounted) return;
            setState(() {
              _seconds = (25 * (1 - _timerController.value)).ceil().clamp(
                0,
                25,
              );
            });
            if (_timerController.isCompleted) {
              Navigator.of(context).pop(false);
            }
          })
          ..forward();
  }

  @override
  void dispose() {
    // FlutterRingtonePlayer.stop();
    _timerController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final d = widget.delivery;
    final deliveryId = (d?['id'] ?? '') as String;
    final shortId = deliveryId.length > 8
        ? deliveryId.substring(0, 8).toUpperCase()
        : deliveryId.toUpperCase();
    final fee = d?['delivery_fee'];
    final distance = d?['distance'];
    final feeStr = fee != null ? '\u20B9$fee' : '\u20B9--';
    final distStr = distance != null ? '$distance km' : '-- km';

    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      body: SafeArea(
        child: Stack(
          children: [
            // Map placeholder
            Container(
              height: MediaQuery.of(context).size.height * 0.42,
              color: const Color(0xFF1E293B),
              child: const Center(
                child: Icon(
                  Icons.map_outlined,
                  color: Colors.white24,
                  size: 80,
                ),
              ),
            ),
            // Notification bar
            Positioned(
              top: 12,
              left: 14,
              right: 14,
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 14,
                  vertical: 10,
                ),
                decoration: BoxDecoration(
                  color: const Color(0xFF1E293B),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Row(
                  children: [
                    Icon(Icons.notifications, color: Colors.amber, size: 20),
                    SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'New Order Alert',
                            style: TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.w700,
                              fontSize: 13,
                            ),
                          ),
                          Text(
                            'You have a new delivery request!',
                            style: TextStyle(
                              color: Colors.white60,
                              fontSize: 12,
                            ),
                          ),
                        ],
                      ),
                    ),
                    Text(
                      'now',
                      style: TextStyle(color: Colors.white54, fontSize: 11),
                    ),
                  ],
                ),
              ),
            ),
            // Order sheet
            Align(
              alignment: Alignment.bottomCenter,
              child: Container(
                decoration: const BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
                ),
                padding: const EdgeInsets.fromLTRB(20, 20, 20, 24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const SizedBox.shrink(),
                        const CircleAvatar(
                          radius: 28,
                          backgroundColor: Color(0xFFECFDF3),
                          child: Icon(
                            Icons.shopping_bag_outlined,
                            color: Color(0xFF16A34A),
                            size: 28,
                          ),
                        ),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            Text(
                              '00:${_seconds.toString().padLeft(2, '0')}',
                              style: const TextStyle(
                                fontSize: 22,
                                fontWeight: FontWeight.w900,
                                color: Color(0xFF0F172A),
                              ),
                            ),
                            const Text(
                              'Time left',
                              style: TextStyle(
                                color: Color(0xFF16A34A),
                                fontSize: 12,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    const Text(
                      'New Delivery Request',
                      style: TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    if (shortId.isNotEmpty)
                      Text(
                        '#$shortId',
                        style: const TextStyle(
                          color: Color(0xFF16A34A),
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    const SizedBox(height: 14),
                    Row(
                      children: [
                        const Icon(
                          Icons.radio_button_checked,
                          color: Color(0xFF16A34A),
                          size: 16,
                        ),
                        const SizedBox(width: 8),
                        const Expanded(
                          child: Text(
                            'Pickup: Blinkie Fashion Store',
                            style: TextStyle(
                              fontWeight: FontWeight.w700,
                              fontSize: 14,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Row(
                      children: [
                        const Icon(
                          Icons.location_on,
                          color: Color(0xFFEF4444),
                          size: 16,
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            'Drop: Customer Address',
                            style: const TextStyle(
                              fontWeight: FontWeight.w700,
                              fontSize: 14,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 14),
                    Row(
                      children: [
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'Your Earning',
                              style: TextStyle(
                                color: Color(0xFF64748B),
                                fontSize: 12,
                              ),
                            ),
                            Text(
                              feeStr,
                              style: const TextStyle(
                                fontSize: 26,
                                fontWeight: FontWeight.w900,
                                color: Color(0xFF16A34A),
                              ),
                            ),
                          ],
                        ),
                        const Spacer(),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 10,
                            vertical: 6,
                          ),
                          decoration: BoxDecoration(
                            color: const Color(0xFFECFDF3),
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: Row(
                            children: [
                              const Icon(
                                Icons.route_outlined,
                                color: Color(0xFF16A34A),
                                size: 14,
                              ),
                              const SizedBox(width: 4),
                              Text(
                                distStr,
                                style: const TextStyle(
                                  color: Color(0xFF16A34A),
                                  fontWeight: FontWeight.w700,
                                  fontSize: 12,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        _MetaChip(
                          icon: Icons.directions_bike_outlined,
                          label: 'Distance',
                          value: distStr,
                        ),
                        const SizedBox(width: 10),
                        const _MetaChip(
                          icon: Icons.local_shipping_outlined,
                          label: 'Type',
                          value: 'Fashion',
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    SizedBox(
                      width: double.infinity,
                      child: FilledButton(
                        onPressed: () {
                          Navigator.of(
                            context,
                          ).pop(true); // duty_screen handles navigation
                        },
                        style: FilledButton.styleFrom(
                          backgroundColor: const Color(0xFF16A34A),
                          minimumSize: const Size.fromHeight(50),
                        ),
                        child: const Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text(
                              'Accept Order',
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                            SizedBox(width: 10),
                            Icon(Icons.arrow_forward),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 10),
                    SizedBox(
                      width: double.infinity,
                      child: OutlinedButton(
                        onPressed: () =>
                            Navigator.of(context).pop(false), // declined
                        style: OutlinedButton.styleFrom(
                          foregroundColor: const Color(0xFFEF4444),
                          side: const BorderSide(color: Color(0xFFEF4444)),
                          minimumSize: const Size.fromHeight(46),
                        ),
                        child: const Text(
                          'Decline',
                          style: TextStyle(fontWeight: FontWeight.w700),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _MetaChip extends StatelessWidget {
  const _MetaChip({
    required this.icon,
    required this.label,
    required this.value,
  });
  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: const Color(0xFFF8FAFC),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFFE5E7EB)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, size: 16, color: const Color(0xFF16A34A)),
            const SizedBox(height: 4),
            Text(
              label,
              style: const TextStyle(color: Color(0xFF64748B), fontSize: 10),
            ),
            Text(
              value,
              style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
            ),
          ],
        ),
      ),
    );
  }
}
