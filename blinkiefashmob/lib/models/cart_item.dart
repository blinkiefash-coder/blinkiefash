/// Represents a product in the shopping cart
class CartItem {
  final String id;
  final String name;
  final String rawPrice;
  final String? imageUrl;
  final String? color;
  final String? size;
  int quantity;

  CartItem({
    required this.id,
    required this.name,
    required this.rawPrice,
    this.imageUrl,
    this.color,
    this.size,
    this.quantity = 1,
  });

  /// Price formatted for display
  String get price => rawPrice;

  factory CartItem.fromMap(Map<String, dynamic> map) {
    return CartItem(
      id: map['id']?.toString() ?? '',
      name: map['name']?.toString() ?? 'Unknown',
      rawPrice: map['price']?.toString() ?? '0',
      imageUrl: map['image']?.toString() ?? map['imageUrl']?.toString(),
      color: map['color']?.toString(),
      size: map['size']?.toString(),
      quantity: map['quantity'] as int? ?? 1,
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'name': name,
      'price': rawPrice,
      'image': imageUrl,
      'color': color,
      'size': size,
      'quantity': quantity,
    };
  }
}
