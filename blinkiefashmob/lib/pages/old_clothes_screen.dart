import 'package:flutter/material.dart';

class OldClothesScreen extends StatelessWidget {
  const OldClothesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Old Clothes Pickup')),
      body: const Center(child: Text('Old Clothes Screen')),
    );
  }
}
