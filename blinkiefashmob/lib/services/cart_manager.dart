import 'package:flutter/foundation.dart';

class CartItem {
  CartItem({
    required this.productId,
    required this.name,
    required this.price,
    required this.rawPrice,
    this.imageUrl,
    this.size,
    this.color,
    this.quantity = 1,
  });

  final String productId;
  final String name;
  final String price; // formatted display (e.g. "1,299")
  final String rawPrice; // numeric string for calculations
  final String? imageUrl;
  final String? size;
  final String? color;
  int quantity;
}

class CartManager {
  CartManager._();
  static final CartManager instance = CartManager._();

  final List<CartItem> _items = [];
  final ValueNotifier<int> countNotifier = ValueNotifier<int>(0);

  int get count => _items.fold(0, (sum, i) => sum + i.quantity);
  List<CartItem> get items => List.unmodifiable(_items);

  double get subtotal => _items.fold(0.0, (sum, i) {
    final p = double.tryParse(i.rawPrice) ?? 0.0;
    return sum + p * i.quantity;
  });

  void addItem(CartItem item) {
    final index = _items.indexWhere(
      (i) =>
          i.productId == item.productId &&
          i.size == item.size &&
          i.color == item.color,
    );
    if (index >= 0) {
      _items[index].quantity++;
    } else {
      _items.add(item);
    }
    countNotifier.value = count;
  }

  void increment(CartItem item) {
    item.quantity++;
    countNotifier.value = count;
  }

  void decrement(CartItem item) {
    if (item.quantity > 1) {
      item.quantity--;
    } else {
      _items.remove(item);
    }
    countNotifier.value = count;
  }

  void remove(CartItem item) {
    _items.remove(item);
    countNotifier.value = count;
  }

  void clear() {
    _items.clear();
    countNotifier.value = 0;
  }
}
