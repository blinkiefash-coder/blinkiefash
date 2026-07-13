import 'package:flutter/material.dart';
import '_simple_screen.dart';

class OldClothesScreen extends StatelessWidget {
  const OldClothesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const SimpleScreen(
      title: 'Old Clothes Pickup',
      message:
          'Pickup scheduling for old clothes is not wired in this minimal build yet.',
    );
  }
}
