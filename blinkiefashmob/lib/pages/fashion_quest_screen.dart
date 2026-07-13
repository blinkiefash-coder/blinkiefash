import 'package:flutter/material.dart';
import '_simple_screen.dart';

class FashionQuestScreen extends StatelessWidget {
  const FashionQuestScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const SimpleScreen(
      title: 'Fashion Quest',
      message: 'Quest progress and rewards will appear here.',
    );
  }
}
