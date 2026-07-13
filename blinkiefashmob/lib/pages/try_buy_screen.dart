import 'package:flutter/material.dart';

class TryBuyScreen extends StatelessWidget {
  const TryBuyScreen({
    super.key,
    required this.productName,
    required this.price,
    required this.variantId,
    this.imageUrl,
    this.size,
    this.color,
  });

  final String productName;
  final String price;
  final String variantId;
  final String? imageUrl;
  final String? size;
  final String? color;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Try & Buy')),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Text(
            '$productName\nPrice: ₹$price\nVariant: $variantId\nSize: ${size ?? '-'}\nColor: ${color ?? '-'}',
            textAlign: TextAlign.center,
          ),
        ),
      ),
    );
  }
}
