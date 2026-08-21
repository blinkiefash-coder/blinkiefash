import 'package:flutter/material.dart';

class CategoryLandingScreen extends StatelessWidget {
  final String? category;
  final String? categoryId;
  final String? categoryName;

  const CategoryLandingScreen({
    super.key,
    this.category,
    this.categoryId,
    this.categoryName,
  });

  @override
  Widget build(BuildContext context) {
    final title = category ?? categoryName ?? categoryId ?? 'Category';
    return Scaffold(
      appBar: AppBar(title: Text(title)),
      body: Center(child: Text('$title Products')),
    );
  }
}
