import 'package:flutter/material.dart';

class PickedAddress {
  const PickedAddress({
    required this.lat,
    required this.lng,
    required this.city,
    required this.addressLine,
    this.pincode = '',
  });

  final double lat;
  final double lng;
  final String city;
  final String addressLine;
  final String pincode;
}

class LocationPickerScreen extends StatelessWidget {
  const LocationPickerScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Pick Location')),
      body: Center(
        child: ElevatedButton(
          onPressed: () {
            Navigator.of(context).pop(
              const PickedAddress(
                lat: 20.2961,
                lng: 85.8245,
                city: 'Bhubaneswar',
                addressLine: 'BlinkieFash demo pickup location',
                pincode: '751024',
              ),
            );
          },
          child: const Text('Use demo location'),
        ),
      ),
    );
  }
}
