import 'package:flutter/material.dart';
import '../services/wishlist_manager.dart';

class WishlistScreen extends StatefulWidget {
  const WishlistScreen({super.key});

  @override
  State<WishlistScreen> createState() => _WishlistScreenState();
}

class _WishlistScreenState extends State<WishlistScreen> {
  @override
  Widget build(BuildContext context) {
    final items = WishlistManager.instance.items;
    return Scaffold(
      appBar: AppBar(title: const Text('Wishlist')),
      body: items.isEmpty
          ? const Center(child: Text('Your wishlist is empty.'))
          : ListView.builder(
              itemCount: items.length,
              itemBuilder: (context, index) {
                final item = items[index];
                return ListTile(
                  title: Text(item.name),
                  subtitle: Text(item.price),
                  trailing: IconButton(
                    icon: const Icon(Icons.delete_outline),
                    onPressed: () {
                      setState(() {
                        WishlistManager.instance.remove(item.productId);
                      });
                    },
                  ),
                );
              },
            ),
    );
  }
}
