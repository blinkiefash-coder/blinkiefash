import 'package:flutter/material.dart';

/// Returns true if current time is outside store hours (7:30 AM – 9:00 PM).
bool isStoreClosed() {
  final now = DateTime.now();
  final afterClose = now.hour >= 21; // 9:00 PM or later
  final beforeOpen =
      now.hour < 7 || (now.hour == 7 && now.minute < 30); // before 7:30 AM
  return afterClose || beforeOpen;
}

/// Banner shown when the store is closed.
/// Displays a warm amber strip: "Service not available right now.
/// You can schedule delivery tomorrow between 7:30 AM and 9:00 PM."
class StoreClosedBanner extends StatelessWidget {
  const StoreClosedBanner({super.key});

  @override
  Widget build(BuildContext context) {
    if (!isStoreClosed()) return const SizedBox.shrink();
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.fromLTRB(12, 10, 12, 0),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: const Color(0xFFFFF8E1),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFFFCC02)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('🕘', style: TextStyle(fontSize: 18)),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: const [
                Text(
                  'Service not available right now',
                  style: TextStyle(
                    fontSize: 13.5,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF7C4F00),
                  ),
                ),
                SizedBox(height: 2),
                Text(
                  'Store hours: 7:30 AM – 9:00 PM\nYou can schedule delivery tomorrow between 7:30 AM and 9:00 PM.',
                  style: TextStyle(
                    fontSize: 12.5,
                    color: Color(0xFF9C6500),
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
