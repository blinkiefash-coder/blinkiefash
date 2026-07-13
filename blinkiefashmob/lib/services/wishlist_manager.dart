import 'package:flutter/foundation.dart';

class WishlistItem {
  WishlistItem({
    required this.productId,
    required this.name,
    required this.price,
    this.imageUrl,
  });

  final String productId;
  final String name;
  final String price;
  final String? imageUrl;
}

class WishlistManager {
  WishlistManager._();

  static final WishlistManager instance = WishlistManager._();

  final List<WishlistItem> _items = [];
  final ValueNotifier<int> countNotifier = ValueNotifier<int>(0);

  List<WishlistItem> get items => List.unmodifiable(_items);

  void _sync() {
    countNotifier.value = _items.length;
  }

  bool isWishlisted(String productId) =>
      _items.any((item) => item.productId == productId);

  void toggle(WishlistItem item) {
    final index = _items.indexWhere((row) => row.productId == item.productId);
    if (index >= 0) {
      _items.removeAt(index);
    } else {
      _items.add(item);
    }
    _sync();
  }

  void remove(String productId) {
    _items.removeWhere((item) => item.productId == productId);
    _sync();
  }

  void clear() {
    _items.clear();
    _sync();
  }
}
