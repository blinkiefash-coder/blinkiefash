import 'package:flutter/material.dart';
import '_simple_screen.dart';

class OrdersScreen extends StatelessWidget {
  const OrdersScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const SimpleScreen(
      title: 'My Orders',
      message: 'Your recent orders will appear here.',
    );
  }
}
