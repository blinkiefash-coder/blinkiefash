import 'package:flutter/material.dart';

class BfSpinner extends StatelessWidget {
  const BfSpinner({
    super.key,
    this.size = 24,
    this.color = const Color(0xFF16A34A),
  });

  final double size;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: size,
      height: size,
      child: CircularProgressIndicator(strokeWidth: 2.5, color: color),
    );
  }
}

class BfPageLoader extends StatelessWidget {
  const BfPageLoader({super.key, this.message = 'Loading...', this.size = 28});

  final String message;
  final double size;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          BfSpinner(size: size),
          const SizedBox(height: 12),
          Text(message, style: const TextStyle(fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}
