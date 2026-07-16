import 'package:flutter/foundation.dart';

class CartItem {
  CartItem({
    required this.productId,
    required this.name,
    required this.price,
    required this.rawPrice,
    this.compareRawPrice, // MRP / listing price (null = same as rawPrice)
    this.imageUrl,
    this.size,
    this.color,
    this.quantity = 1,
    this.availableStock,
  });

  final String productId;
  final String name;
  final String price; // formatted display (e.g. "1,299")
  final String rawPrice; // numeric string for calculations
  final String? compareRawPrice; // MRP numeric string (original listing price)
  final String? imageUrl;
  final String? size;
  final String? color;
  int? availableStock;
  int quantity;
}

class CartManager {
  CartManager._();
  static final CartManager instance = CartManager._();

  final List<CartItem> _items = [];
  final ValueNotifier<int> countNotifier = ValueNotifier<int>(0);

  int get count => _items.fold(0, (sum, i) => sum + i.quantity);
  List<CartItem> get items => List.unmodifiable(_items);

  int? _effectiveLimit(CartItem item) {
    final stock = item.availableStock;
    if (stock == null || stock <= 0) return stock;
    return stock;
  }

  double get subtotal => _items.fold(0.0, (sum, i) {
    final p = double.tryParse(i.rawPrice) ?? 0.0;
    return sum + p * i.quantity;
  });

  bool addItem(CartItem item) {
    final index = _items.indexWhere(
      (i) =>
          i.productId == item.productId &&
          i.size == item.size &&
          i.color == item.color,
    );
    if (index >= 0) {
      final existing = _items[index];
      if (existing.availableStock == null && item.availableStock != null) {
        existing.availableStock = item.availableStock;
      } else if (existing.availableStock != null &&
          item.availableStock != null) {
        existing.availableStock =
            existing.availableStock! < item.availableStock!
            ? existing.availableStock
            : item.availableStock;
      }
      return increment(existing);
    } else {
      final limit = _effectiveLimit(item);
      if (limit != null && limit <= 0) {
        return false;
      }
      if (limit != null && item.quantity > limit) {
        item.quantity = limit;
      }
      _items.add(item);
      countNotifier.value = count;
      return true;
    }
  }

  bool increment(CartItem item) {
    final limit = _effectiveLimit(item);
    if (limit != null && item.quantity >= limit) {
      return false;
    }
    item.quantity++;
    countNotifier.value = count;
    return true;
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
