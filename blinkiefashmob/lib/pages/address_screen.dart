import 'package:flutter/material.dart';
import '../services/api_client.dart';

class AddressScreen extends StatelessWidget {
  final String userId;
  final ApiClient? api;

  const AddressScreen({super.key, required this.userId, this.api});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Saved Addresses')),
      body: const Center(child: Text('Address Screen')),
    );
  }
}
