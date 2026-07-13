import 'package:flutter/material.dart';
import '_simple_screen.dart';

class AllBrandsScreen extends StatelessWidget {
  const AllBrandsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const SimpleScreen(
      title: 'All Brands',
      message:
          'Brand browsing will appear here once the catalog data is loaded.',
    );
  }
}
