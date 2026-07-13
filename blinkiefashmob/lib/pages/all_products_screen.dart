import 'package:flutter/material.dart';
import '_simple_screen.dart';

class AllProductsScreen extends StatelessWidget {
  const AllProductsScreen({
    super.key,
    this.categoryName,
    this.categoryId,
    this.initialSearch,
    this.brandId,
    this.brandName,
    this.sortBy,
    this.initialSort,
    this.minPrice,
    this.maxPrice,
    this.title,
  });

  final String? categoryName;
  final String? categoryId;
  final String? initialSearch;
  final String? brandId;
  final String? brandName;
  final String? sortBy;
  final String? initialSort;
  final double? minPrice;
  final double? maxPrice;
  final String? title;

  @override
  Widget build(BuildContext context) {
    final lines = <String>[];
    if (categoryName != null) lines.add('Category: $categoryName');
    if (initialSearch != null) lines.add('Search: $initialSearch');
    if (brandId != null) lines.add('Brand ID: $brandId');
    if (brandName != null) lines.add('Brand: $brandName');
    if (initialSort != null) lines.add('Sort: $initialSort');
    if (minPrice != null || maxPrice != null) {
      lines.add('Price range: ${minPrice ?? 0} - ${maxPrice ?? 'any'}');
    }
    return SimpleScreen(
      title: title ?? 'All Products',
      message: lines.isEmpty
          ? 'All products will be listed here.'
          : lines.join('\n'),
    );
  }
}
