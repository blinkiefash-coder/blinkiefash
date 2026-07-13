import 'package:flutter/material.dart';
import '_simple_screen.dart';

class SpinWheelScreen extends StatelessWidget {
  const SpinWheelScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const SimpleScreen(
      title: 'Spin the Wheel',
      message: 'Spin rewards will be available here.',
    );
  }
}
