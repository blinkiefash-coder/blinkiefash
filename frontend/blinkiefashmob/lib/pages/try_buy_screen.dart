import 'package:flutter/material.dart';

import 'checkout_screen.dart';
import '../services/cart_manager.dart';

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
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: const Color(0xFFF0FDF4),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: const Color(0xFFBBF7D0)),
            ),
            child: const Row(
              children: [
                Icon(Icons.inventory_2_outlined, color: Color(0xFF16A34A)),
                SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'Try this product at home for 15 minutes.',
                    style: TextStyle(
                      color: Color(0xFF166534),
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: const Color(0xFFE5E7EB)),
            ),
            child: Row(
              children: [
                Container(
                  width: 82,
                  height: 82,
                  decoration: BoxDecoration(
                    color: const Color(0xFFF1F5F9),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: imageUrl == null
                      ? const Icon(Icons.image_outlined)
                      : ClipRRect(
                          borderRadius: BorderRadius.circular(12),
                          child: Image.network(imageUrl!, fit: BoxFit.cover),
                        ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        productName,
                        style: const TextStyle(fontWeight: FontWeight.w700),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        'Color: ${color ?? '-'}  Size: ${size ?? '-'}',
                        style: const TextStyle(color: Color(0xFF64748B)),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        'Rs $price',
                        style: const TextStyle(
                          fontWeight: FontWeight.w800,
                          fontSize: 18,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: const Color(0xFFE5E7EB)),
            ),
            child: const Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'How Try & Buy works',
                  style: TextStyle(fontWeight: FontWeight.w800),
                ),
                SizedBox(height: 8),
                Text('1. We deliver in 60 minutes.'),
                Text('2. You can try for 15 minutes.'),
                Text('3. Keep it only if you love it.'),
              ],
            ),
          ),
        ],
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
          child: FilledButton(
            style: FilledButton.styleFrom(
              minimumSize: const Size.fromHeight(52),
              backgroundColor: const Color(0xFF16A34A),
            ),
            onPressed: () {
              final item = CartItem(
                productId: variantId,
                name: productName,
                price: price,
                rawPrice: price.replaceAll(RegExp(r'[^0-9.]'), ''),
                imageUrl: imageUrl,
                size: size ?? 'Free',
                color: color ?? 'Default',
              );
              Navigator.of(context).push(
                MaterialPageRoute<void>(
                  builder: (_) =>
                      CheckoutScreen(isTryOrder: true, overrideItems: [item]),
                ),
              );
            },
            child: const Text('Continue to Final Checkout'),
          ),
        ),
      ),
    );
  }
}
