import 'package:flutter/foundation.dart';

class WishlistItem {
  const WishlistItem({
    required this.productId,
    required this.name,
    required this.price,
    this.imageUrl,
  });

  final String productId;
  final String name;
  final String price; // formatted display price
  final String? imageUrl;
}

class WishlistManager {
  WishlistManager._();
  static final WishlistManager instance = WishlistManager._();

  final List<WishlistItem> _items = [];
  final ValueNotifier<int> countNotifier = ValueNotifier<int>(0);

  List<WishlistItem> get items => List.unmodifiable(_items);
  int get count => _items.length;

  bool isWishlisted(String productId) =>
      _items.any((i) => i.productId == productId);

  void toggle(WishlistItem item) {
    final index = _items.indexWhere((i) => i.productId == item.productId);
    if (index >= 0) {
      _items.removeAt(index);
    } else {
      _items.add(item);
    }
    countNotifier.value = _items.length;
  }

  void remove(String productId) {
    _items.removeWhere((i) => i.productId == productId);
    countNotifier.value = _items.length;
  }
}
