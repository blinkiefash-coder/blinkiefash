import 'package:flutter/material.dart';
import '_simple_screen.dart';

class CategoryLandingScreen extends StatelessWidget {
  const CategoryLandingScreen({super.key, this.categoryId, this.categoryName});

  final String? categoryId;
  final String? categoryName;

  @override
  Widget build(BuildContext context) {
    return SimpleScreen(
      title: categoryName ?? 'Category',
      message:
          'Category landing for ${categoryName ?? 'this section'} is ready.',
    );
  }
}
