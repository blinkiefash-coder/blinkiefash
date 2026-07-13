import 'package:flutter/material.dart';

bool isStoreClosed() => false;

class StoreClosedBanner extends StatelessWidget {
  const StoreClosedBanner({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFFFFF7ED),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFF59E0B)),
      ),
      child: const Row(
        children: [
          Icon(Icons.schedule_outlined, color: Color(0xFFB45309)),
          SizedBox(width: 10),
          Expanded(
            child: Text(
              'The store is currently closed. Orders will be scheduled for the next available slot.',
              style: TextStyle(
                color: Color(0xFF92400E),
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
