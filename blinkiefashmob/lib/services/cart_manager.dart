import 'package:flutter/foundation.dart';

class CartItem {
  CartItem({
    required this.productId,
    required this.name,
    required this.price,
    required this.rawPrice,
    this.compareRawPrice,
    this.imageUrl,
    this.size,
    this.color,
    this.quantity = 1,
    this.availableStock,
  });

  final String productId;
  final String name;
  final String price;
  final String rawPrice;
  final String? compareRawPrice;
  final String? imageUrl;
  final String? size;
  final String? color;
  int quantity;
  int? availableStock;

  String get _key => '$productId|${size ?? ''}|${color ?? ''}';
}

class CartManager {
  CartManager._();

  static final CartManager instance = CartManager._();

  final List<CartItem> _items = [];
  final ValueNotifier<int> countNotifier = ValueNotifier<int>(0);

  List<CartItem> get items => List.unmodifiable(_items);

  double get subtotal => _items.fold<double>(0, (sum, item) {
    final price =
        double.tryParse(item.rawPrice) ??
        double.tryParse(item.price.replaceAll(RegExp(r'[^0-9.]'), '')) ??
        0;
    return sum + (price * item.quantity);
  });

  void _sync() {
    countNotifier.value = _items.fold<int>(
      0,
      (sum, item) => sum + item.quantity,
    );
  }

  int _indexOf(CartItem item) =>
      _items.indexWhere((row) => row._key == item._key);

  bool addItem(CartItem item) {
    final index = _indexOf(item);
    if (index == -1) {
      _items.add(item);
      _sync();
      return true;
    }
    final existing = _items[index];
    if (existing.availableStock != null &&
        existing.quantity >= existing.availableStock!) {
      return false;
    }
    existing.quantity += item.quantity;
    _sync();
    return true;
  }

  bool increment(CartItem item) {
    if (item.availableStock != null && item.quantity >= item.availableStock!) {
      return false;
    }
    item.quantity += 1;
    _sync();
    return true;
  }

  void decrement(CartItem item) {
    if (item.quantity <= 1) {
      remove(item);
      return;
    }
    item.quantity -= 1;
    _sync();
  }

  void remove(CartItem item) {
    _items.removeWhere((row) => row._key == item._key);
    _sync();
  }

  void clear() {
    _items.clear();
    _sync();
  }
}
