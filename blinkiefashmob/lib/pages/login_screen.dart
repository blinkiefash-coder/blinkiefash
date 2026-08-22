import 'package:flutter/material.dart';

class LoginScreen extends StatelessWidget {
  const LoginScreen({
    super.key,
    this.startAsVendor = false,
    this.redirectBuilder,
  });

  final bool startAsVendor;
  final Widget Function(BuildContext)? redirectBuilder;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Login'),
        backgroundColor: Colors.white,
        elevation: 0,
        foregroundColor: const Color(0xFF111827),
      ),
      body: const Center(child: Text('Login Screen')),
    );
  }
}
