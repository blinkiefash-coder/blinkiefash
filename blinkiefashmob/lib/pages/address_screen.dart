import 'package:flutter/material.dart';
import '../services/api_client.dart';

class AddressScreen extends StatelessWidget {
  const AddressScreen({super.key, required this.userId, required this.api});

  final String userId;
  final ApiClient api;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Saved Addresses')),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Text(
            'Saved addresses for user $userId will be managed here.',
            textAlign: TextAlign.center,
          ),
        ),
      ),
    );
  }
}
