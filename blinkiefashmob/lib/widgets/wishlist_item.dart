import 'package:flutter/material.dart';

class WishlistItem extends StatelessWidget {
  final Map<String, dynamic> product;
  final VoidCallback? onRemove;

  const WishlistItem({super.key, required this.product, this.onRemove});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(8.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              product['name'] ?? 'Unknown Product',
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: 8),
            Text(
              '₹${product['price'] ?? 'N/A'}',
              style: const TextStyle(fontWeight: FontWeight.bold),
            ),
            if (onRemove != null) ...[
              const SizedBox(height: 8),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: onRemove,
                  child: const Text('Remove'),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
