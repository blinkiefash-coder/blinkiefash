import 'package:flutter/material.dart';

class AnimatedSearchBar extends StatelessWidget {
  const AnimatedSearchBar({
    super.key,
    this.controller,
    this.onChanged,
    this.hintText = 'Search products',
  });

  final TextEditingController? controller;
  final ValueChanged<String>? onChanged;
  final String hintText;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE5E7EB)),
      ),
      child: Row(
        children: [
          const Icon(Icons.search, color: Color(0xFF6B7280)),
          const SizedBox(width: 10),
          Expanded(
            child: TextField(
              controller: controller,
              onChanged: onChanged,
              decoration: InputDecoration(
                isDense: true,
                border: InputBorder.none,
                hintText: hintText,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
